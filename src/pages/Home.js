import React, { useState } from 'react';
import { v4 as uuidV4 } from 'uuid';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Home = () => {
    const navigate = useNavigate();

    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');
    const createNewRoom = (e) => {
        e.preventDefault();
        const id = uuidV4();
        setRoomId(id);
        toast.success('Created a new room');
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomFromURL = params.get("roomId");
        if (roomFromURL) {
            setRoomId(roomFromURL);
        }
    }, []);

    const joinRoom = () => {
        if (!roomId || !username) {
            toast.error('ROOM ID & username is required');
            return;
        }

        // Redirect
        navigate(`/editor/${roomId}`, {
            state: {
                username,
            },
        });
    };

    const handleInputEnter = (e) => {
        if (e.code === 'Enter') {
            joinRoom();
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#0a0f1c',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Pattern */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `
                    radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
                    radial-gradient(circle at 50% 10%, rgba(16, 185, 129, 0.05) 0%, transparent 50%),
                    radial-gradient(circle at 90% 40%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)
                `,
                backgroundSize: '400px 400px, 300px 300px, 500px 500px, 350px 350px',
                backgroundPosition: '0% 0%, 100% 100%, 50% 0%, 100% 40%',
                opacity: 0.4
            }}></div>

            {/* Floating Code Icons */}
            <div style={{
                position: 'absolute',
                top: '20%',
                left: '10%',
                fontSize: '24px',
                opacity: 0.05
            }}>{'</>'}</div>

            <div style={{
                position: 'absolute',
                top: '70%',
                right: '15%',
                fontSize: '20px',
                opacity: 0.05
            }}>{'{}'}</div>

            <div style={{
                position: 'absolute',
                top: '30%',
                right: '20%',
                fontSize: '18px',
                opacity: 0.04
            }}>{'<>'}</div>

            <div style={{
                position: 'absolute',
                bottom: '20%',
                left: '15%',
                fontSize: '22px',
                opacity: 0.05
            }}>{'()'}</div>

            {/* Main Content */}
            <div style={{
                backgroundColor: '#0f172a',
                padding: '40px',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                border: '1px solid #334155',
                width: '400px',
                textAlign: 'center',
                position: 'relative',
                zIndex: 10
            }}>
                {/* Logo - EXACTLY AS YOU SPECIFIED */}
                <div style={{
                    marginBottom: '30px'
                }}>
                    <div
                        style={{
                            fontSize: '36px',
                            fontWeight: 'bold',
                            background: 'linear-gradient(135deg, #61dafb, #bd93f9)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            marginBottom: '8px'
                        }}
                    >
                        CodeVerse AI
                    </div>
                    <div
                        style={{
                            fontSize: '14px',
                            color: '#bd93f9',
                            fontWeight: '500'
                        }}
                    >
                        Collaborative Code Editor
                    </div>
                </div>

                {/* Input Group */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    marginBottom: '20px'
                }}>
                    <input
                        type="text"
                        placeholder="ROOM ID"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        onKeyUp={handleInputEnter}
                        style={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            color: '#f8fafc',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#8b5cf6';
                            e.target.style.boxShadow = '0 0 0 2px rgba(139, 92, 246, 0.2)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#475569';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                    <input
                        type="text"
                        placeholder="USERNAME"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyUp={handleInputEnter}
                        style={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            color: '#f8fafc',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#8b5cf6';
                            e.target.style.boxShadow = '0 0 0 2px rgba(139, 92, 246, 0.2)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#475569';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                    
                    <button 
                        onClick={joinRoom}
                        style={{
                            backgroundColor: '#8b5cf6',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            marginTop: '8px'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.backgroundColor = '#7c3aed';
                            e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.backgroundColor = '#8b5cf6';
                            e.target.style.transform = 'translateY(0)';
                        }}
                    >
                        🚀 Join Room
                    </button>
                </div>

                {/* Create New Room */}
                <div style={{
                    fontSize: '14px',
                    color: '#94a3b8',
                    borderTop: '1px solid #334155',
                    paddingTop: '20px'
                }}>
                    If you don't have an invite then create{' '}
                    <button
                        onClick={createNewRoom}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#8b5cf6',
                            textDecoration: 'none',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            borderBottom: '1px dashed #8b5cf6',
                            fontSize: '14px',
                            padding: '0',
                            margin: '0'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.color = '#3b82f6';
                            e.target.style.borderBottomColor = '#3b82f6';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.color = '#8b5cf6';
                            e.target.style.borderBottomColor = '#8b5cf6';
                        }}
                    >
                        new room
                    </button>
                </div>

                {/* Room ID Display (when created) */}
                {roomId && (
                    <div style={{
                        marginTop: '20px',
                        padding: '12px',
                        backgroundColor: '#1e293b',
                        borderRadius: '6px',
                        border: '1px solid #10b981'
                    }}>
                        <div style={{
                            fontSize: '12px',
                            color: '#10b981',
                            fontWeight: 'bold',
                            marginBottom: '4px'
                        }}>
                            Room Created!
                        </div>
                        <div style={{
                            fontSize: '11px',
                            color: '#f8fafc',
                            fontFamily: 'Monaco, "Courier New", monospace',
                            wordBreak: 'break-all'
                        }}>
                            {roomId}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Home;