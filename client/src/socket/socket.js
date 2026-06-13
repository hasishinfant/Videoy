import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let callSocket = null;
let adminSocket = null;

export function getCallSocket(auth) {
  if (callSocket) {
    callSocket.disconnect();
  }
  callSocket = io(`${SOCKET_URL}/call`, {
    auth,
    transports: ['websocket'],
    reconnectionAttempts: 5,
  });
  return callSocket;
}

export function getAdminSocket(token) {
  if (!adminSocket || !adminSocket.connected) {
    adminSocket = io(`${SOCKET_URL}/admin`, {
      auth: { token },
      transports: ['websocket'],
    });
  }
  return adminSocket;
}

export function disconnectCallSocket() {
  if (callSocket) {
    callSocket.disconnect();
    callSocket = null;
  }
}

export function disconnectAdminSocket() {
  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
  }
}
