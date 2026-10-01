import { io } from 'socket.io-client';

// Automatically use the host's IP address if testing on a local Wi-Fi network
const defaultUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
  ? `http://${window.location.hostname}:4000` 
  : 'http://localhost:4000';

const URL = import.meta.env.VITE_SERVER_URL || defaultUrl;

export const socket = io(URL, {
  autoConnect: false, // We'll connect when needed
});
