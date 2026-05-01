import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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
    let saikakuErrored = false;
    let uaamErrored = false;
    let latestStatus = {};

    const computeFromDoc = (snap, kind) => {
      if (!snap?.exists()) return { attemptCount: 0, hasResult: false };
      const data = snap.data() || {};
      const hasResult = kind === 'saikaku'
        ? !!data.result || !!data.analysis
        : !!data.scores || !!data.analysis;
      const rawCount = data.attemptCount ?? 0;

      return {
        attemptCount: Math.max(rawCount, hasResult ? 1 : 0),
        hasResult,
      };
    };

    const setKindStatus = (kind, nextStatus, errored = false) => {
      if (cancelled) return;
      if (kind === 'saikaku') {
        saikakuReady = true;
        saikakuErrored = errored;
      }
      if (kind === 'uaam') {
        uaamReady = true;
        uaamErrored = errored;
      }
      latestStatus = { ...latestStatus, [kind]: nextStatus };

      if (!saikakuReady || !uaamReady || (saikakuErrored && uaamErrored)) {
        setStatus(null);
        return;
      }

      setStatus(latestStatus);
    };

    const unsubSaikaku = onSnapshot(
      doc(db, 'results', user.uid),
      (snap) => setKindStatus('saikaku', computeFromDoc(snap, 'saikaku')),
      () => setKindStatus('saikaku', { attemptCount: 0, hasResult: false }, true),
    );

    const unsubUaam = onSnapshot(
      doc(db, 'uaam_results', user.uid),
      (snap) => setKindStatus('uaam', computeFromDoc(snap, 'uaam')),
      () => setKindStatus('uaam', { attemptCount: 0, hasResult: false }, true),
    );

    return () => {
      cancelled = true;
      unsubSaikaku();
      unsubUaam();
    };
  }, [user?.uid]);

  return status;
}
