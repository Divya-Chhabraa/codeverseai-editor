import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempt: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
    };
    
    // ADD THIS - Provide fallback URL
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://codeverseai-editor-production.up.railway.app';
    
    console.log('🔌 Connecting to backend:', backendUrl); // Debug line
    
    return io(backendUrl, options);
};