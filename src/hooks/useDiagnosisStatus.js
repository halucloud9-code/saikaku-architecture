import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../firebase';

export default function useDiagnosisStatus(user) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const uid = user?.uid ?? null;
  const requestSeq = useRef(0);
  const mountedRef = useRef(false);
  const statusUidRef = useRef(uid);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSeq.current += 1;
    };
  }, []);

  const applyState = useCallback((requestId, nextStatus, nextError) => {
    if (!mountedRef.current || requestSeq.current !== requestId) return;
    setStatus(nextStatus);
    setError(nextError);
  }, []);

  const refresh = useCallback(async () => {
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;

    if (!uid) {
      setStatus(null);
      setError(null);
      return;
    }

    setError(null);

    let idToken;
    try {
      idToken = await auth.currentUser?.getIdToken();
    } catch {
      applyState(requestId, null, 'auth');
      return;
    }

    if (!idToken) {
      applyState(requestId, null, 'auth');
      return;
    }

    let res;
    try {
      res = await fetch('/api/me/diagnosis-status', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch {
      applyState(requestId, null, 'network');
      return;
    }

    if (!res.ok) {
      applyState(requestId, null, 'fetch');
      return;
    }

    let json;
    try {
      json = await res.json();
    } catch {
      applyState(requestId, null, 'fetch');
      return;
    }

    applyState(requestId, json, null);
  }, [applyState, uid]);

  useEffect(() => {
    if (statusUidRef.current === uid) return;
    statusUidRef.current = uid;
    requestSeq.current += 1;
    setStatus(null);
    setError(null);
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!uid) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh, uid]);

  return {
    status: statusUidRef.current === uid ? status : null,
    error: statusUidRef.current === uid ? error : null,
    refresh,
  };
}
