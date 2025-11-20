import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempts: 'Infinity', // ✅ FIX TYPO: was 'reconnectionAttempt'
        timeout: 10000,
        transports: ['websocket', 'polling'], // ✅ ADD POLLING FALLBACK
        withCredentials: true, // ✅ ADD CREDENTIALS SUPPORT
    };
    
    // ✅ KEEP SMART URL DETECTION (this is correct)
    const isBrowser = typeof window !== 'undefined';
    const backendUrl = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5000'
        : 'https://codeverseai-editor-production.up.railway.app';
    
    console.log('🔌 Connecting to backend:', backendUrl, '(Auto-detected)');
    
    return io(backendUrl, options);
};