import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempt: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
    };
    
    // ✅ SMART URL DETECTION FOR BOTH LOCAL AND DEPLOYED
    const isBrowser = typeof window !== 'undefined';
    const backendUrl = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5000'  // Local development
        : 'https://codeverseai-editor-production.up.railway.app'; // Deployed
    
    console.log('🔌 Connecting to backend:', backendUrl, '(Auto-detected)');
    
    return io(backendUrl, options);
};