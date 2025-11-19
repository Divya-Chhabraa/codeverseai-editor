import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';
import Client from '../components/Client';
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

    useEffect(() => {
        const init = async () => {
            socketRef.current = await initSocket();
            socketRef.current.on('connect_error', (err) => handleErrors(err));
            socketRef.current.on('connect_failed', (err) => handleErrors(err));

            function handleErrors(e) {
                console.log('socket error', e);
                toast.error('Socket connection failed, try again later.');
                reactNavigator('/');
            }

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
        };
        init();
        return () => {
            socketRef.current.disconnect();
            socketRef.current.off(ACTIONS.JOINED);
            socketRef.current.off(ACTIONS.DISCONNECTED);
        };
    }, []);

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

    if (!location.state) {
        return <Navigate to="/" />;
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
        </div>
    );
};

export default EditorPage;