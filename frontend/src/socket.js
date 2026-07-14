import { io } from 'socket.io-client';

const TOKEN_KEY = 'settleup_token';

let socket = null;

/**
 * Lazily creates (or returns) a single shared socket connection, authenticated
 * with the same JWT used for REST calls. The dev server proxies /socket.io
 * to the backend (see vite.config.js), so no separate host/port is needed -
 * in production, VITE_SOCKET_URL can point at the deployed API host.
 */
export function getSocket() {
  if (socket) return socket;

  socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
    autoConnect: false,
    auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }),
    transports: ['websocket', 'polling'],
  });

  return socket;
}

/** Connects (if needed) and joins a group's live-update room. */
export function joinGroupRoom(groupId) {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit('group:join', groupId);
}

/** Leaves a group's room without tearing down the whole connection. */
export function leaveGroupRoom(groupId) {
  if (socket?.connected) socket.emit('group:leave', groupId);
}
