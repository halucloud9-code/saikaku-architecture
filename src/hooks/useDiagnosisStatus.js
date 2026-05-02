import { useEffect, useState } from 'react';
import { auth } from '../firebase';

export default function useDiagnosisStatus(user) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setStatus(null);
      return undefined;
    }

    let cancelled = false;
    setStatus(null);

    async function loadStatus() {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        const res = await fetch('/api/me/diagnosis-status', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;

        const json = await res.json();
        if (!cancelled) setStatus(json);
      } catch {
        // Keep degraded behavior: badges/history links stay hidden.
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  return status;
}
