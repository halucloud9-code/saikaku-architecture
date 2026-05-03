import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../firebase';

const STORAGE_PREFIX = 'diag-status:';

function readCachedStatus(uid) {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + uid);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedStatus(uid, value) {
  if (!uid || typeof window === 'undefined') return;
  try {
    if (value === null) {
      window.sessionStorage.removeItem(STORAGE_PREFIX + uid);
    } else {
      window.sessionStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(value));
    }
  } catch {
    // sessionStorage unavailable or quota exceeded — best-effort only
  }
}

export default function useDiagnosisStatus(user) {
  const uid = user?.uid ?? null;
  const [status, setStatus] = useState(() => readCachedStatus(uid));
  const [error, setError] = useState(null);
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
    writeCachedStatus(uid, json);
  }, [applyState, uid]);

  useEffect(() => {
    if (statusUidRef.current === uid) return;
    statusUidRef.current = uid;
    requestSeq.current += 1;
    setStatus(readCachedStatus(uid));
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
