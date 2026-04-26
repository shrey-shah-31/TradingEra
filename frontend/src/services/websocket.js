import { io } from 'socket.io-client';

let socket;
let lastToken;

export function getSocket(token) {
  const url = import.meta.env.VITE_API_URL || undefined;
  if (!socket) {
    socket = io(url, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
    lastToken = token;
    return socket;
  }

  if (lastToken !== token) {
    lastToken = token;
    socket.auth = { token };
    if (socket.connected) socket.disconnect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = undefined;
    lastToken = undefined;
  }
}
