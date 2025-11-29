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
    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();

    // 🔹 Correct order
    const searchParams = new URLSearchParams(location.search);
    const langFromQuery = searchParams.get('lang') || 'javascript';
    const usernameFromQuery = searchParams.get('username') || '';

    const username =
        (location.state && location.state.username) || usernameFromQuery;

    const [language, setLanguage] = useState(langFromQuery);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const socketRef = useRef(null);
    const codeRef = useRef(null);
    const editorRef = useRef(null);

    const [clients, setClients] = useState([]);
    const [isConnecting, setIsConnecting] = useState(true);
    const [connectionError, setConnectionError] = useState(false);
    const [copied, setCopied] = useState(false);

    // Check screen size
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(true);
            } else {
                setIsSidebarOpen(false);
            }
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    const copyRoomId = async () => {
        const shareMessage = `🚀 Join me on CodeVerse AI!

👤 Host: ${username}
🆔 Room ID: ${roomId}
🔗 Quick Join Link:
${window.location.origin}/?roomId=${roomId}

Let's build something amazing together! 💻🔥`;

        try {
            await navigator.clipboard.writeText(shareMessage);
            setCopied(true);
            toast.success("Invitation copied! Send it to your friend 🚀");
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            toast.error("Could not copy invitation!");
            console.error(err);
        }
    };

    useEffect(() => {
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

                socketRef.current.emit(ACTIONS.JOIN, {
                    roomId,
                    username: username,
                });

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

    if (!username) {
        return <Navigate to="/" />;
    }

    if (isConnecting) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <div className="loading-text">Connecting to Room...</div>
                <div className="room-id">{`Room ID: ${roomId}`}</div>
            </div>
        );
    }

    if (connectionError) {
        return (
            <div className="error-container">
                <div className="error-icon">🔌</div>
                <div className="error-title">Connection Failed</div>
                <div className="error-message">
                    Unable to connect to the server. Please check your internet
                    connection and try again.
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="retry-btn"
                >
                    🔄 Retry Connection
                </button>
                <button
                    onClick={() => reactNavigator('/')}
                    className="home-btn"
                >
                    🏠 Return Home
                </button>
            </div>
        );
    }

    function leaveRoom() {
        const token = localStorage.getItem("accessToken"); // read stored login token
        window.location.href = `https://codeverseai.streamlit.app/?page=dashboard&token=${token}`;
    }


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
        <div className="editor-page">
            {/* Mobile Header */}
            {isMobile && (
                <div className="mobile-header">
                    <button 
                        className="menu-toggle"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        {isSidebarOpen ? '✕' : '☰'}
                    </button>
                    <div className="mobile-logo">
                        <div className="logo-text">CodeVerse AI</div>
                    </div>
                    <div className="mobile-room-info">
                        <span className="room-badge">{roomId}</span>
                    </div>
                </div>
            )}

            {/* Overlay for mobile */}
            {isMobile && isSidebarOpen && (
                <div 
                    className="sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <div 
                className={`sidebar ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${isMobile ? 'sidebar-mobile' : ''}`}
            >
                {/* Logo Section */}
                <div className="logo-section">
                    <div className="logo-main">CodeVerse AI</div>
                    <div className="logo-subtitle">Collaborative Code Editor</div>
                </div>

                {/* Connection Status */}
                <div className="connection-status">
                    <div className="status-dot"></div>
                    <div className="status-text">Connected</div>
                </div>

                {/* Room Info */}
                <div className="room-info">
                    <div className="room-label">Room ID</div>
                    <div className="room-id-display">{roomId}</div>
                </div>

                {/* Connected Users */}
                <div className="users-section">
                    <div className="users-header">
                        <span>👥 Connected ({clients.length})</span>
                    </div>
                    <div className="users-list">
                        {clients.map((client) => (
                            <div key={client.socketId} className="user-item">
                                <div className="user-dot"></div>
                                <div className="username">{client.username}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                    <button
                        onClick={copyRoomId}
                        className={`copy-btn ${copied ? 'copied' : ''}`}
                    >
                        📋 {copied ? 'Copied!' : 'Copy Invite'}
                    </button>
                    <button
                        onClick={leaveRoom}
                        className="leave-btn"
                    >
                        🚪 Leave Room
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="editor-area">
                <Editor
                    socketRef={socketRef}
                    roomId={roomId}
                    username={username}
                    language={language}
                    setLanguage={setLanguage}
                    onCodeChange={(code) => {
                        codeRef.current = code;
                    }}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                />
            </div>

            <style jsx>{`
                .editor-page {
                    display: flex;
                    height: 100vh;
                    background-color: ${theme.background};
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    position: relative;
                }

                /* Mobile Header */
                .mobile-header {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 60px;
                    background: ${theme.surface};
                    border-bottom: 1px solid ${theme.border};
                    padding: 0 16px;
                    z-index: 1000;
                    align-items: center;
                    justify-content: space-between;
                }

                .menu-toggle {
                    background: transparent;
                    border: 1px solid ${theme.border};
                    color: ${theme.text};
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                }

                .mobile-logo .logo-text {
                    font-size: 18px;
                    font-weight: bold;
                    background: linear-gradient(135deg, #61dafb, #bd93f9);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .room-badge {
                    background: ${theme.surfaceSecondary};
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: Monaco, "Courier New", monospace;
                    color: ${theme.text};
                }

                /* Sidebar */
                .sidebar {
                    width: 200px;
                    background-color: ${theme.surface};
                    border-right: 1px solid ${theme.border};
                    display: flex;
                    flex-direction: column;
                    padding: 20px;
                    color: ${theme.text};
                    transition: transform 0.3s ease;
                    z-index: 100;
                }

                .sidebar-mobile {
                    position: fixed;
                    top: 60px;
                    left: 0;
                    bottom: 0;
                    transform: translateX(-100%);
                    box-shadow: 2px 0 10px rgba(0,0,0,0.3);
                }

                .sidebar-mobile.sidebar-open {
                    transform: translateX(0);
                }

                .sidebar-overlay {
                    position: fixed;
                    top: 60px;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    z-index: 99;
                }

                /* Logo Section */
                .logo-section {
                    text-align: center;
                    margin-bottom: 20px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid ${theme.border};
                }

                .logo-main {
                    font-size: 24px;
                    font-weight: bold;
                    background: linear-gradient(135deg, #61dafb, #bd93f9);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin-bottom: 4px;
                }

                .logo-subtitle {
                    font-size: 12px;
                    color: #bd93f9;
                    font-weight: 500;
                }

                /* Connection Status */
                .connection-status {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid ${theme.success};
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    background: ${theme.success};
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                .status-text {
                    font-size: 14px;
                    font-weight: bold;
                    color: ${theme.success};
                }

                /* Room Info */
                .room-info {
                    background: ${theme.surfaceSecondary};
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border: 1px solid ${theme.border};
                }

                .room-label {
                    font-size: 12px;
                    color: ${theme.accent};
                    margin-bottom: 8px;
                    font-weight: 500;
                }

                .room-id-display {
                    font-size: 14px;
                    font-weight: bold;
                    font-family: Monaco, "Courier New", monospace;
                    word-break: break-all;
                    color: ${theme.text};
                }

                /* Users Section */
                .users-section {
                    margin-bottom: 20px;
                }

                .users-header {
                    font-size: 16px;
                    font-weight: bold;
                    color: ${theme.accent};
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .users-list {
                    max-height: 200px;
                    overflow-y: auto;
                }

                .user-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: ${theme.surfaceSecondary};
                    border-radius: 6px;
                    margin-bottom: 6px;
                    border: 1px solid ${theme.border};
                }

                .user-dot {
                    width: 6px;
                    height: 6px;
                    background: ${theme.success};
                    border-radius: 50%;
                }

                .username {
                    font-size: 14px;
                    color: ${theme.text};
                }

                /* Action Buttons */
                .action-buttons {
                    margin-top: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .copy-btn, .leave-btn {
                    padding: 12px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 14px;
                    transition: all 0.2s ease;
                    border: 2px solid;
                }

                .copy-btn {
                    background: transparent;
                    border-color: ${theme.accent};
                    color: ${theme.accent};
                }

                .copy-btn.copied {
                    background: ${theme.accent};
                    color: #fff;
                }

                .copy-btn:hover {
                    background: ${theme.accent};
                    color: #fff;
                }

                .leave-btn {
                    background: transparent;
                    border-color: #ef4444;
                    color: #ef4444;
                }

                .leave-btn:hover {
                    background: #ef4444;
                    color: #fff;
                }

                /* Editor Area */
                .editor-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }

                /* Loading State */
                .loading-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    flex-direction: column;
                    gap: 20px;
                    background-color: #0a0f1c;
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }

                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid #334155;
                    border-top: 4px solid #8b5cf6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                .loading-text {
                    font-size: 18px;
                    font-weight: bold;
                }

                .room-id {
                    font-size: 14px;
                    color: #8b5cf6;
                }

                /* Error State */
                .error-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    flex-direction: column;
                    gap: 20px;
                    background-color: #0a0f1c;
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }

                .error-icon {
                    font-size: 48px;
                }

                .error-title {
                    font-size: 24px;
                    font-weight: bold;
                    color: #ef4444;
                }

                .error-message {
                    font-size: 16px;
                    text-align: center;
                    max-width: 400px;
                    color: #94a3b8;
                }

                .retry-btn, .home-btn {
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 14px;
                    transition: all 0.2s ease;
                }

                .retry-btn {
                    background: #8b5cf6;
                    border: none;
                    color: #fff;
                }

                .retry-btn:hover {
                    background: #7c3aed;
                }

                .home-btn {
                    background: transparent;
                    border: 2px solid #ef4444;
                    color: #ef4444;
                }

                .home-btn:hover {
                    background: #ef4444;
                    color: #fff;
                }

                /* Animations */
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .mobile-header {
                        display: flex;
                    }

                    .sidebar {
                        width: 280px;
                    }

                    .editor-area {
                        margin-top: 60px;
                    }
                }

                @media (max-width: 480px) {
                    .sidebar {
                        width: 100%;
                    }

                    .logo-main {
                        font-size: 20px;
                    }

                    .connection-status, 
                    .room-info, 
                    .user-item {
                        padding: 12px;
                    }
                }
            `}</style>
        </div>
    );
};

export default EditorPage;