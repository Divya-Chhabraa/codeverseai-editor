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
            backgroundColor: '#1e1f29',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{
                backgroundColor: '#282a36',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                border: '1px solid #44475a',
                width: '400px',
                textAlign: 'center'
            }}>
                {/* Logo */}
                <div style={{
                    marginBottom: '30px'
                }}>
                    <div style={{
                        fontSize: '36px',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #61dafb, #bd93f9)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        marginBottom: '8px'
                    }}>
                        CodeVerse AI
                    </div>
                    <div style={{
                        fontSize: '14px',
                        color: '#bd93f9',
                        fontWeight: '500'
                    }}>
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
                            backgroundColor: '#44475a',
                            border: '1px solid #6272a4',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            color: '#f8f8f2',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                            e.target.borderColor = '#61dafb';
                            e.target.boxShadow = '0 0 0 2px rgba(97, 218, 251, 0.2)';
                        }}
                        onBlur={(e) => {
                            e.target.borderColor = '#6272a4';
                            e.target.boxShadow = 'none';
                        }}
                    />
                    <input
                        type="text"
                        placeholder="USERNAME"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyUp={handleInputEnter}
                        style={{
                            backgroundColor: '#44475a',
                            border: '1px solid #6272a4',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            color: '#f8f8f2',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                            e.target.borderColor = '#61dafb';
                            e.target.boxShadow = '0 0 0 2px rgba(97, 218, 251, 0.2)';
                        }}
                        onBlur={(e) => {
                            e.target.borderColor = '#6272a4';
                            e.target.boxShadow = 'none';
                        }}
                    />
                    
                    <button 
                        onClick={joinRoom}
                        style={{
                            backgroundColor: '#61dafb',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            color: '#000',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            marginTop: '8px'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.backgroundColor = '#8be9fd';
                            e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.backgroundColor = '#61dafb';
                            e.target.style.transform = 'translateY(0)';
                        }}
                    >
                        🚀 Join Room
                    </button>
                </div>

                {/* Create New Room */}
                <div style={{
                    fontSize: '14px',
                    color: '#6272a4',
                    borderTop: '1px solid #44475a',
                    paddingTop: '20px'
                }}>
                    If you don't have an invite then create{' '}
                    <a
                        onClick={createNewRoom}
                        href=""
                        style={{
                            color: '#bd93f9',
                            textDecoration: 'none',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            borderBottom: '1px dashed #bd93f9'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.color = '#61dafb';
                            e.target.style.borderBottomColor = '#61dafb';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.color = '#bd93f9';
                            e.target.style.borderBottomColor = '#bd93f9';
                        }}
                    >
                        new room
                    </a>
                </div>

                {/* Room ID Display (when created) */}
                {roomId && (
                    <div style={{
                        marginTop: '20px',
                        padding: '12px',
                        backgroundColor: '#44475a',
                        borderRadius: '6px',
                        border: '1px solid #50fa7b'
                    }}>
                        <div style={{
                            fontSize: '12px',
                            color: '#50fa7b',
                            fontWeight: 'bold',
                            marginBottom: '4px'
                        }}>
                            Room Created!
                        </div>
                        <div style={{
                            fontSize: '11px',
                            color: '#f8f8f2',
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