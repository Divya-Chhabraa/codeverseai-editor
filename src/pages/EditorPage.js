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
    const editorRef= useRef(null);
    const[language, setLanguage]=useState('javascript');
    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();
    const [clients, setClients] = useState([]);
    const [isConnecting, setIsConnecting] = useState(true);
    const [connectionError, setConnectionError] = useState(false);

    // 🔹 Get username from query params as fallback
    const searchParams = new URLSearchParams(location.search);
    const usernameFromQuery = searchParams.get('username') || '';

    // Final username coming either from Home (state) or dashboard (query)
    const username =
        (location.state && location.state.username) || usernameFromQuery;
        
    
    useEffect(() => {
        // If we don't have a username, don't try to init socket
        if (!username) {
            setIsConnecting(false);
            setConnectionError(false);
            return;
        }

        
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

                // 🔹 JOIN room using the resolved username
                socketRef.current.emit(ACTIONS.JOIN, {
                    roomId,
                    username: username,
                });

                // Listening for joined event
                socketRef.current.on(
                    ACTIONS.JOINED,
                    ({ clients, username: joinedUser, socketId }) => {
                        if (joinedUser !== username) {
                            toast.success(`${joinedUser} joined the room.`);
                            console.log(`${joinedUser} joined`);
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
                    ({ socketId, username: leftUser }) => {
                        toast.success(`${leftUser} left the room.`);
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
    }, [roomId, username, reactNavigator]);

    // If we have no username at all, THEN redirect to Home
    if (!username) {
        return <Navigate to="/" />;
    }

    // Show loading/connection state
    if (isConnecting) {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    flexDirection: 'column',
                    gap: '20px',
                    backgroundColor: '#0a0f1c',
                    color: '#f8fafc',
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
            >
                <div
                    style={{
                        width: '50px',
                        height: '50px',
                        border: '4px solid #334155',
                        borderTop: '4px solid #8b5cf6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    }}
                ></div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    Connecting to Room...
                </div>
                <div
                    style={{ fontSize: '14px', color: '#8b5cf6' }}
                >{`Room ID: ${roomId}`}</div>
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
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    flexDirection: 'column',
                    gap: '20px',
                    backgroundColor: '#0a0f1c',
                    color: '#f8fafc',
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
            >
                <div style={{ fontSize: '48px' }}>🔌</div>
                <div
                    style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#ef4444',
                    }}
                >
                    Connection Failed
                </div>
                <div
                    style={{
                        fontSize: '16px',
                        textAlign: 'center',
                        maxWidth: '400px',
                        color: '#94a3b8',
                    }}
                >
                    Unable to connect to the server. Please check your internet
                    connection and try again.
                </div>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#8b5cf6',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: '#fff',
                        fontSize: '14px',
                        marginTop: '10px',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseOver={(e) => {
                        e.target.style.backgroundColor = '#7c3aed';
                    }}
                    onMouseOut={(e) => {
                        e.target.style.backgroundColor = '#8b5cf6';
                    }}
                >
                    🔄 Retry Connection
                </button>
                <button
                    onClick={() => reactNavigator('/')}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: 'transparent',
                        border: '2px solid #ef4444',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: '#ef4444',
                        fontSize: '14px',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseOver={(e) => {
                        e.target.style.backgroundColor = '#ef4444';
                        e.target.style.color = '#fff';
                    }}
                    onMouseOut={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#ef4444';
                    }}
                >
                    🏠 Return Home
                </button>
            </div>
        );
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

    const downloadCodeFile = () => {
  if (!editorRef.current) return;
  
  const code = editorRef.current.getValue();
  if (!code.trim()) {
    alert("No code to download!");
    return;
  }

  const langMap = {
    javascript: 'js',
    python: 'py',
    cpp: 'cpp',
    java: 'java',
    typescript: 'ts',
  };

  const fileExt = langMap[language] || 'txt';
  const fileName = `code.${fileExt}`;

  const blob = new Blob([code], { type: 'text/plain' });
  const link = document.createElement('a');

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(link.href);
};

    // Theme variables matching Editor component
    const theme = {
        background: '#0a0f1c',
        surface: '#0f172a',
        surfaceSecondary: '#1e293b',
        text: '#f8fafc',
        textSecondary: '#94a3b8',
        border: '#334155',
        accent: '#8b5cf6',
        success: '#10b981',
    };

    return (
        <div
            style={{
                display: 'flex',
                height: '100vh',
                backgroundColor: theme.background,
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
        >
            {/* Left Sidebar - Reduced Width */}
            <div
                style={{
                    width: '220px',
                    backgroundColor: theme.surface,
                    borderRight: `1px solid ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px',
                    color: theme.text,
                }}
            >
                {/* Logo Section - Kept Intact */}
                <div
                    style={{
                        textAlign: 'center',
                        marginBottom: '10px',
                        paddingBottom: '16px',
                    }}
                >
                    <div
                        style={{
                            fontSize: '30px',
                            fontWeight: 'bold',
                            background:
                                'linear-gradient(135deg, #61dafb, #bd93f9)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            marginBottom: '6px',
                        }}
                    >
                        CodeVerse AI
                    </div>
                    <div
                        style={{
                            fontSize: '14px',
                            color: '#bd93f9',
                            fontWeight: '500',
                        }}
                    >
                        Collaborative Code Editor
                    </div>
                </div>

                {/* Connection Status */}
                <div
                    style={{
                        backgroundColor: `${theme.success}20`,
                        border: `1px solid ${theme.success}`,
                        padding: '8px',
                        borderRadius: '6px',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <div
                        style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: theme.success,
                            borderRadius: '50%',
                            animation: 'pulse 2s infinite',
                        }}
                    ></div>
                    <div
                        style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: theme.success,
                        }}
                    >
                        Connected
                    </div>
                </div>

                {/* Room Info */}
                <div
                    style={{
                        backgroundColor: theme.surfaceSecondary,
                        padding: '10px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        border: `1px solid ${theme.border}`,
                    }}
                >
                    <div
                        style={{
                            fontSize: '11px',
                            color: theme.accent,
                            marginBottom: '4px',
                            fontWeight: '500',
                        }}
                    >
                        Room ID
                    </div>
                    <div
                        style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            fontFamily: 'Monaco, "Courier New", monospace',
                            wordBreak: 'break-all',
                            color: theme.text,
                        }}
                    >
                        {roomId}
                    </div>
                </div>

                {/* Connected Users */}
                <div style={{ marginBottom: '16px' }}>
                    <div
                        style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: theme.accent,
                            marginBottom: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <span>👥 Connected ({clients.length})</span>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {clients.map((client) => (
                            <div
                                key={client.socketId}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    backgroundColor: theme.surfaceSecondary,
                                    borderRadius: '4px',
                                    marginBottom: '4px',
                                    border: `1px solid ${theme.border}`,
                                }}
                            >
                                <div
                                    style={{
                                        width: '6px',
                                        height: '6px',
                                        backgroundColor: theme.success,
                                        borderRadius: '50%',
                                    }}
                                ></div>
                                <div style={{ fontSize: '14px', color: theme.text }}>
                                    {client.username}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div
                    style={{
                        marginTop: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                    }}
                >
                    <button
                        onClick={copyRoomId}
                        style={{
                            backgroundColor: 'transparent',
                            border: `2px solid ${theme.accent}`,
                            color: theme.accent,
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseOver={(e) => {
                            e.target.style.backgroundColor = theme.accent;
                            e.target.style.color = '#fff';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.backgroundColor = 'transparent';
                            e.target.style.color = theme.accent;
                        }}
                    >
                        📋 Copy ID
                    </button>
                    <button
                        onClick={leaveRoom}
                        style={{
                            backgroundColor: 'transparent',
                            border: '2px solid #ef4444',
                            color: '#ef4444',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseOver={(e) => {
                            e.target.style.backgroundColor = '#ef4444';
                            e.target.style.color = '#fff';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.backgroundColor = 'transparent';
                            e.target.style.color = '#ef4444';
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
                    username={username}
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