import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth.js';
import { getSocket } from '../services/websocket.js';

/**
 * Subscribe to Socket.io events while authenticated.
 * Handler map keys are event names; values are callbacks (kept fresh via ref).
 */
export function useWebSocket(handlers) {
  const { token } = useAuth();
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const events = Object.keys(ref.current || {});
    const fns = {};
    for (const ev of events) {
      const fn = (...args) => ref.current[ev]?.(...args);
      fns[ev] = fn;
      socket.on(ev, fn);
    }
    return () => {
      for (const ev of events) {
        socket.off(ev, fns[ev]);
      }
    };
  }, [token]);
}
