import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { listFromAttempts, summarizeFromParent } from '../../shared/attemptLogic.js';

export {
  listFromAttempts,
  summarizeFromParent,
  timestampToMillis,
} from '../../shared/attemptLogic.js';

export async function loadAttemptDetails({ db, uid, kind }) {
  const collName = kind === 'uaam' ? 'uaam_results' : 'results';
  const parentRef = doc(db, collName, uid);

  const [parentSnap, attemptsSnap] = await Promise.all([
    getDoc(parentRef),
    getDocs(collection(parentRef, 'attempts')),
  ]);

  const parentData = parentSnap.exists() ? parentSnap.data() : null;
  const attemptDocs = attemptsSnap.docs.map((attempt) => ({
    id: attempt.id,
    ...attempt.data(),
  }));
  const { committedAttempts, pendingAttempt } = listFromAttempts(attemptDocs, parentData, kind);
  const summary = summarizeFromParent(parentData);

  return { committedAttempts, pendingAttempt, summary };
}
