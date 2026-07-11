import { db } from '../lib/firebaseAdmin.js';
import { normalizeInternalProfile, profileAvailability } from '../lib/compatProfiles.js';
import { requireAdmin } from '../lib/requireAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', error: 'GETのみ対応しています' });
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    const [resultsSnapshot, uaamSnapshot] = await Promise.all([
      db.collection('results').get(),
      db.collection('uaam_results').get(),
    ]);
    const uaamById = new Map(uaamSnapshot.docs.map((doc) => [doc.id, doc.data()]));
    const profiles = resultsSnapshot.docs
      .map((doc) => normalizeInternalProfile(doc.id, doc.data(), uaamById.get(doc.id)))
      .map((profile) => ({
        id: profile.id,
        source: profile.source,
        displayName: profile.displayName,
        profileVersion: profile.profileVersion,
        availability: profileAvailability(profile),
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'ja'));

    return res.status(200).json({
      profiles,
      publicImport: {
        enabled: !!process.env.COMPAT_IMPORT_TOKEN,
        message: process.env.COMPAT_IMPORT_TOKEN
          ? '公開アプリの共有URLを取り込めます。'
          : '公開アプリ取込は現在無効です（COMPAT_IMPORT_TOKEN 未設定）。',
      },
    });
  } catch (error) {
    console.error('[compat-profiles] failed:', error?.message || error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', error: 'プロフィール一覧を取得できませんでした' });
  }
}

