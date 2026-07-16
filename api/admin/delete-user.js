import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/firebaseAdmin.js';
import { requireAdmin } from '../lib/requireAdmin.js';

const UID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

async function deriveFirestoreUidsByEmail(email) {
  const snapshots = await Promise.all([
    db.collection('results').where('email', '==', email).get(),
    db.collection('uaam_results').where('email', '==', email).get(),
  ]);
  const uids = new Set();
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      const storedUid = document.data()?.uid;
      const candidate = typeof storedUid === 'string' && UID_RE.test(storedUid)
        ? storedUid
        : document.id;
      if (UID_RE.test(candidate)) uids.add(candidate);
    }
  }
  return [...uids];
}

function isNotFoundError(error) {
  return error?.code === 'auth/user-not-found'
    || error?.code === 'not-found'
    || error?.code === 'NOT_FOUND'
    || error?.code === 5
    || error?.code === '5';
}

function failureDetails(operation, target, error) {
  return {
    operation,
    target,
    code: error?.code ?? null,
    message: error?.message || String(error),
  };
}

function failedUidsFromFailures(failures, targetUids) {
  return [...targetUids].filter((uid) => failures.some(({ target }) => (
    target === uid || target.startsWith(`${uid}/`)
  )));
}

async function attemptDeletion(failures, operation, target, task) {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    if (isNotFoundError(error)) return { ok: true, value: null };
    failures.push(failureDetails(operation, target, error));
    return { ok: false, value: null };
  }
}

async function deleteDocuments(failures, operation, target, documents) {
  await Promise.all(documents.map((document) => (
    attemptDeletion(failures, operation, `${target}/${document.id}`, () => document.ref.delete())
  )));
}

async function deleteUaamPeerData(uid, requestedBy, failures) {
  // 1. Tombstone is deliberately committed before any destructive write. Public
  // and issue endpoints use it as the authoritative deletion barrier.
  const tombstone = await attemptDeletion(failures, 'peer_tombstone', uid, () => (
    db.collection('uaam_peer_deletions').doc(uid).set({
      requestedAt: FieldValue.serverTimestamp(),
      requestedBy,
    }, { merge: true })
  ));
  if (!tombstone.ok) return false;

  // 2. Record the deleted invite IDs in the tombstone, remove every invite,
  // and clear the active pointer. The compact ID list lets public endpoints
  // preserve the 410 deletion barrier without retaining subject invite data.
  const invitesResult = await attemptDeletion(failures, 'peer_invites_query', uid, () => (
    db.collection('uaam_peer_invites').where('subjectUid', '==', uid).get()
  ));
  if (invitesResult.ok && invitesResult.value) {
    const inviteIds = invitesResult.value.docs.map((document) => document.id);
    if (inviteIds.length > 0) {
      await attemptDeletion(failures, 'peer_tombstone_invites', uid, () => (
        db.collection('uaam_peer_deletions').doc(uid).set({
          inviteIds: FieldValue.arrayUnion(...inviteIds),
        }, { merge: true })
      ));
    }
    await deleteDocuments(failures, 'peer_invite_delete', uid, invitesResult.value.docs);
  }
  await attemptDeletion(failures, 'peer_pointer_delete', uid, () => (
    db.collection('uaam_peer_invite_index').doc(uid).delete()
  ));

  // 3. Remove the root and every anonymous submission below it.
  await attemptDeletion(failures, 'peer_results_delete', uid, () => (
    db.recursiveDelete(db.collection('uaam_peer_results').doc(uid))
  ));

  // 4. Audit documents contain no subcollections and can be removed directly.
  const auditsResult = await attemptDeletion(failures, 'peer_audits_query', uid, () => (
    db.collection('uaam_peer_audits').where('subjectUid', '==', uid).get()
  ));
  if (auditsResult.ok && auditsResult.value) {
    await deleteDocuments(failures, 'peer_audit_delete', uid, auditsResult.value.docs);
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const decoded = await requireAdmin(req, res);
  if (!decoded) return undefined;

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const hasUid = Object.prototype.hasOwnProperty.call(body, 'uid');
  const hasEmail = Object.prototype.hasOwnProperty.call(body, 'email');
  if (hasUid === hasEmail) {
    return res.status(400).json({ error: 'uid または email のどちらか一方だけを指定してください' });
  }

  const uid = hasUid && typeof body.uid === 'string' ? body.uid.trim() : '';
  const email = hasEmail && typeof body.email === 'string' ? body.email.trim() : '';
  if ((hasUid && !UID_RE.test(uid)) || (hasEmail && !email)) {
    return res.status(400).json({ error: 'uid または email の値が不正です' });
  }

  const requestId = randomUUID();
  const failures = [];
  const targetUids = new Set();

  try {
    const deletionReadyUids = new Set();
    let targetUid = uid || null;
    let emailUidLookupComplete = true;

    if (uid) {
      targetUids.add(uid);
    } else {
      const authLookup = await attemptDeletion(failures, 'auth_lookup_by_email', 'email', () => (
        getAuth().getUserByEmail(email)
      ));
      if (authLookup.value?.uid) {
        targetUids.add(authLookup.value.uid);
        targetUid = authLookup.value.uid;
      }

      const derivedLookup = await attemptDeletion(failures, 'firestore_uid_lookup_by_email', 'email', () => (
        deriveFirestoreUidsByEmail(email)
      ));
      emailUidLookupComplete = derivedLookup.ok;
      for (const derivedUid of derivedLookup.value ?? []) targetUids.add(derivedUid);
      targetUid ??= derivedLookup.value?.[0] ?? null;
    }

    // UAAM peer data is swept before the existing diagnosis-result deletion.
    // Each sweep enforces tombstone -> invites/pointer -> results -> audits.
    for (const peerUid of targetUids) {
      if (await deleteUaamPeerData(peerUid, decoded.uid, failures)) deletionReadyUids.add(peerUid);
    }

    // Firestore の才覚領域結果を UID で削除（ドキュメントID直接 + uid フィールドクエリ）
    for (const resultUid of deletionReadyUids) {
      await attemptDeletion(failures, 'results_root_delete', resultUid, () => (
        db.collection('results').doc(resultUid).delete()
      ));
      await attemptDeletion(failures, 'uaam_results_root_delete', resultUid, () => (
        db.collection('uaam_results').doc(resultUid).delete()
      ));
      // ドキュメントID != uid の場合に備えてフィールドでも検索
      const resultsQuery = await attemptDeletion(failures, 'results_uid_query', resultUid, () => (
        db.collection('results').where('uid', '==', resultUid).get()
      ));
      if (resultsQuery.value) {
        await deleteDocuments(failures, 'results_uid_delete', resultUid, resultsQuery.value.docs);
      }
      const uaamResultsQuery = await attemptDeletion(failures, 'uaam_results_uid_query', resultUid, () => (
        db.collection('uaam_results').where('uid', '==', resultUid).get()
      ));
      if (uaamResultsQuery.value) {
        await deleteDocuments(failures, 'uaam_results_uid_delete', resultUid, uaamResultsQuery.value.docs);
      }
    }

    // email で Firestore を検索して削除（uid が取れなかった場合の保険）
    if (email && emailUidLookupComplete && deletionReadyUids.size === targetUids.size) {
      const resultsEmailQuery = await attemptDeletion(failures, 'results_email_query', 'email', () => (
        db.collection('results').where('email', '==', email).get()
      ));
      if (resultsEmailQuery.value) {
        await deleteDocuments(failures, 'results_email_delete', 'email', resultsEmailQuery.value.docs);
      }
      const uaamResultsEmailQuery = await attemptDeletion(failures, 'uaam_results_email_query', 'email', () => (
        db.collection('uaam_results').where('email', '==', email).get()
      ));
      if (uaamResultsEmailQuery.value) {
        await deleteDocuments(failures, 'uaam_results_email_delete', 'email', uaamResultsEmailQuery.value.docs);
      }
    }

    // Firebase Auth のユーザーを削除
    for (const authUid of deletionReadyUids) {
      await attemptDeletion(failures, 'auth_user_delete', authUid, () => getAuth().deleteUser(authUid));
    }

    if (failures.length > 0) {
      console.error('[delete-user] partial failure', { requestId, failures });
      return res.status(500).json({
        success: false,
        code: 'partial_failure',
        requestId,
        failedUids: failedUidsFromFailures(failures, targetUids),
        error: '削除を完了できませんでした',
      });
    }

    return res.status(200).json({ success: true, deletedUid: targetUid || null });
  } catch (error) {
    console.error('[delete-user] unexpected failure', { requestId, error });
    return res.status(500).json({
      success: false,
      code: 'partial_failure',
      requestId,
      failedUids: failedUidsFromFailures(failures, targetUids),
      error: '削除を完了できませんでした',
    });
  }
}
