/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';
import Editor from '../components/Editor';
import { initSocket } from '../socket';
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';

const EditorPage = () => {
    const socketRef = useRef(null);
    const codeRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();
    const [clients, setClients] = useState([]);
    const [isConnecting, setIsConnecting] = useState(true);
    const [connectionError, setConnectionError] = useState(false);

    useEffect(() => {
        const init = async () => {
            setIsConnecting(true);
            setConnectionError(false);

            try {
                console.log('🚀 Initializing socket connection...');
                socketRef.current = await initSocket();
                
                // Connection event handlers
                socketRef.current.on('connect', () => {
                    console.log('✅ Socket connected successfully!');
                    setIsConnecting(false);
                    toast.success('Connected to room!');
                });

                socketRef.current.on('connect_error', (err) => {
                    console.error('❌ Socket connection error:', err);
                    setIsConnecting(false);
                    setConnectionError(true);
                    handleErrors(err);
                });

                socketRef.current.on('connect_failed', (err) => {
                    console.error('❌ Socket connection failed:', err);
                    setIsConnecting(false);
                    setConnectionError(true);
                    handleErrors(err);
                });

                socketRef.current.on('disconnect', (reason) => {
                    console.log('🔌 Socket disconnected:', reason);
                    if (reason === 'io server disconnect') {
                        toast.error('Disconnected from server');
                    }
                });

                function handleErrors(e) {
                    console.log('Socket error:', e);
                    toast.error('Connection failed. Please try again later.');
                    setTimeout(() => {
                        reactNavigator('/');
                    }, 2000);
                }

                // Join room after successful connection
                socketRef.current.emit(ACTIONS.JOIN, {
                    roomId,
                    username: location.state?.username,
                });

                // Listening for joined event
                socketRef.current.on(
                    ACTIONS.JOINED,
                    ({ clients, username, socketId }) => {
                        if (username !== location.state?.username) {
                            toast.success(`${username} joined the room.`);
                            console.log(`${username} joined`);
                        }
                        setClients(clients);
                        socketRef.current.emit(ACTIONS.SYNC_CODE, {
                            code: codeRef.current,
                            socketId,
                        });
                    }
                );

                // Listening for disconnected
                socketRef.current.on(
                    ACTIONS.DISCONNECTED,
                    ({ socketId, username }) => {
                        toast.success(`${username} left the room.`);
                        setClients((prev) => {
                            return prev.filter(
                                (client) => client.socketId !== socketId
                            );
                        });
                    }
                );

            } catch (error) {
                console.error('❌ Failed to initialize socket:', error);
                setIsConnecting(false);
                setConnectionError(true);
                toast.error('Failed to connect to server');
            }
        };

        init();

        return () => {
            if (socketRef.current) {
                console.log('🧹 Cleaning up socket connection...');
                socketRef.current.disconnect();
                socketRef.current.off(ACTIONS.JOINED);
                socketRef.current.off(ACTIONS.DISCONNECTED);
                socketRef.current.off('connect_error');
                socketRef.current.off('connect_failed');
                socketRef.current.off('connect');
                socketRef.current.off('disconnect');
            }
        };
    }, []);

    // Show loading/connection state
    if (isConnecting) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column',
                gap: '20px',
                backgroundColor: '#1e1f29',
                color: '#f8f8f2',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
                <div style={{ 
                    width: '50px', 
                    height: '50px', 
                    border: '4px solid #44475a', 
                    borderTop: '4px solid #61dafb', 
                    borderRadius: '50%', 
                    animation: 'spin 1s linear infinite' 
                }}></div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Connecting to Room...</div>
                <div style={{ fontSize: '14px', color: '#bd93f9' }}>Room ID: {roomId}</div>
                <style>
                    {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    `}
                </style>
            </div>
        );
    }

    // Show connection error state
    if (connectionError) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column',
                gap: '20px',
                backgroundColor: '#1e1f29',
                color: '#f8f8f2',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
                <div style={{ fontSize: '48px' }}>🔌</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff5555' }}>Connection Failed</div>
                <div style={{ fontSize: '16px', textAlign: 'center', maxWidth: '400px' }}>
                    Unable to connect to the server. Please check your internet connection and try again.
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#61dafb',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: '#000',
                        fontSize: '14px',
                        marginTop: '10px'
                    }}
                >
                    🔄 Retry Connection
                </button>
                <button 
                    onClick={() => reactNavigator('/')}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: 'transparent',
                        border: '2px solid #ff5555',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: '#ff5555',
                        fontSize: '14px'
                    }}
                >
                    🏠 Return Home
                </button>
            </div>
        );
    }

    if (!location.state) {
        return <Navigate to="/" />;
    }

    async function copyRoomId() {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID has been copied to your clipboard');
        } catch (err) {
            toast.error('Could not copy the Room ID');
            console.error(err);
        }
    }

    function leaveRoom() {
        reactNavigator('/');
    }

    return (
        <div style={{ 
            display: 'flex', 
            height: '100vh', 
            backgroundColor: '#1e1f29',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            {/* Left Sidebar - Reduced Width */}
            <div style={{
                width: '220px',
                backgroundColor: '#282a36',
                borderRight: '1px solid #44475a',
                display: 'flex',
                flexDirection: 'column',
                padding: '16px',
                color: '#f8f8f2'
            }}>
                <div style={{
                    textAlign: 'center',
                    marginBottom: '10px',
                    paddingBottom: '16px',
                   
                }}>
                    <div style={{
                        fontSize: '30px',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #61dafb, #bd93f9)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        marginBottom: '6px'
                    }}>
                        CodeVerse AI
                    </div>
                    <div style={{
                        fontSize: '14px',
                        color: '#bd93f9',
                        fontWeight:'500'
                    }}>
                        Collaborative Code Editor
                    </div>
                </div>

                {/* Connection Status */}
                <div style={{
                    backgroundColor: '#50fa7b20',
                    border: '1px solid #50fa7b',
                    padding: '8px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#50fa7b',
                        borderRadius: '50%',
                        animation: 'pulse 2s infinite'
                    }}></div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#50fa7b' }}>
                        Connected
                    </div>
                </div>

                {/* Room Info */}
                <div style={{
                    backgroundColor: '#44475a',
                    padding: '10px',
                    borderRadius: '6px',
                    marginBottom: '16px'
                }}>
                    <div style={{ fontSize: '11px', color: '#bd93f9', marginBottom: '4px' }}>Room ID</div>
                    <div style={{ 
                        fontSize: '12px', 
                        fontWeight: 'bold',
                        fontFamily: 'Monaco, "Courier New", monospace',
                        wordBreak: 'break-all'
                    }}>
                        {roomId}
                    </div>
                </div>

                {/* Connected Users */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#61dafb',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span>👥 Connected ({clients.length})</span>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {clients.map((client) => (
                            <div key={client.socketId} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 8px',
                                backgroundColor: '#44475a',
                                borderRadius: '4px',
                                marginBottom: '4px'
                            }}>
                                <div style={{
                                    width: '6px',
                                    height: '6px',
                                    backgroundColor: '#50fa7b',
                                    borderRadius: '50%'
                                }}></div>
                                <div style={{ fontSize: '14px' }}>
                                    {client.username}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button 
                        onClick={copyRoomId}
                        style={{
                            backgroundColor: 'transparent',
                            border: '2px solid #61dafb',
                            color: '#61dafb',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.backgroundColor = '#61dafb';
                            e.target.style.color = '#000';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.backgroundColor = 'transparent';
                            e.target.style.color = '#61dafb';
                        }}
                    >
                        📋 Copy ID
                    </button>
                    <button 
                        onClick={leaveRoom}
                        style={{
                            backgroundColor: 'transparent',
                            border: '2px solid #ff5555',
                            color: '#ffffffff',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.backgroundColor = '#ff7979';
                        }}
                    >
                        🚪 Leave
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Editor
    socketRef={socketRef}
    roomId={roomId}
    username={location.state?.username}
    onCodeChange={(code) => {
        codeRef.current = code;
    }}
/>
            </div>

            <style>
                {`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
                `}
            </style>
        </div>
    );
};

export default EditorPage;