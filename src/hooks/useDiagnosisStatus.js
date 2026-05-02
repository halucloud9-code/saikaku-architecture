import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { summarizeFromParent } from '../utils/attemptLoader';

const ERROR_STATUS = {
  committedCount: 0,
  attemptCount: 0,
  hasPending: false,
  pendingAttemptId: null,
  hasResult: false,
  isStartBlocked: true,
};

export default function useDiagnosisStatus(user) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setStatus(null);
      return undefined;
    }

    let cancelled = false;
    let saikakuReady = false;
    let uaamReady = false;
    let latestStatus = {};

    const setKindStatus = (kind, nextStatus) => {
      if (cancelled) return;
      if (kind === 'saikaku') {
        saikakuReady = true;
      }
      if (kind === 'uaam') {
        uaamReady = true;
      }
      latestStatus = { ...latestStatus, [kind]: nextStatus };

      if (!saikakuReady || !uaamReady) {
        setStatus(null);
        return;
      }

      setStatus(latestStatus);
    };

    const unsubSaikaku = onSnapshot(
      doc(db, 'results', user.uid),
      (snap) => setKindStatus('saikaku', summarizeFromParent(snap.exists() ? snap.data() : null)),
      () => setKindStatus('saikaku', ERROR_STATUS),
    );

    const unsubUaam = onSnapshot(
      doc(db, 'uaam_results', user.uid),
      (snap) => setKindStatus('uaam', summarizeFromParent(snap.exists() ? snap.data() : null)),
      () => setKindStatus('uaam', ERROR_STATUS),
    );

    return () => {
      cancelled = true;
      unsubSaikaku();
      unsubUaam();
    };
  }, [user?.uid]);

  return status;
}
