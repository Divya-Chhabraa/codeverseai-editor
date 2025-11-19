import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ['websocket', 'polling'], // Allow fallback to polling
    };
    
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://codeverseai-editor-production.up.railway.app';
    
    console.log('🔌 Connecting to backend:', backendUrl);
    
    return new Promise((resolve, reject) => {
        const socket = io(backendUrl, options);

        const connectionTimeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
            socket.disconnect();
        }, 10000);

        socket.on('connect', () => {
            console.log('✅ Socket connected successfully!');
            clearTimeout(connectionTimeout);
            resolve(socket);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
            clearTimeout(connectionTimeout);
            reject(error);
        });

        socket.on('connect_timeout', () => {
            console.error('❌ Socket connection timeout');
            clearTimeout(connectionTimeout);
            reject(new Error('Connection timeout'));
        });
    });
};