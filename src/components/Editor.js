import React, { useEffect, useRef, useState } from 'react';
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/clike/clike';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import ACTIONS from '../Actions';

const Editor = ({ roomId, onCodeChange, username, socketRef }) => {
    const editorRef = useRef(null);
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [language, setLanguage] = useState('javascript');
    const [userInput, setUserInput] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(true);

    // Chat state
    const [chatMessages, setChatMessages] = useState([]);
    const [chatText, setChatText] = useState('');
    const chatMessagesEndRef = useRef(null);
    const [isSocketReady, setIsSocketReady] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(true);
    const terminalInputRef = useRef(null);
    const [isTerminalOpen, setIsTerminalOpen] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('connecting');

    /* ---------------- USE SOCKET FROM PROPS ---------------- */
    useEffect(() => {
        if (!socketRef.current) {
            console.log('⏳ Waiting for socket from parent...');
            return;
        }

        const socket = socketRef.current;
        
        // Set initial connection state
        setIsSocketReady(socket.connected);
        setConnectionStatus(socket.connected ? 'connected' : 'connecting');

        // Listen for connection status changes
        const handleConnect = () => {
            console.log('✅ Editor: Socket connected');
            setIsSocketReady(true);
            setConnectionStatus('connected');
        };

        const handleDisconnect = () => {
            console.log('🔌 Editor: Socket disconnected');
            setIsSocketReady(false);
            setConnectionStatus('disconnected');
        };

        const handleConnectError = (error) => {
            console.error('❌ Editor: Socket connection error', error);
            setIsSocketReady(false);
            setConnectionStatus('error');
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect_error', handleConnectError);
        };
    }, [socketRef]);

/* ---------------- Initialize CodeMirror (ONCE) ---------------- */
useEffect(() => {
    console.log('🔧 Initializing CodeMirror...');
    
    setTimeout(() => {
        const textarea = document.getElementById('realtimeEditor');
        if (!textarea) return;

        editorRef.current = Codemirror.fromTextArea(textarea, {
            mode: 'javascript', // Start with default mode
            theme: isDarkMode ? 'dracula' : 'default',
            autoCloseTags: true,
            autoCloseBrackets: true,
            lineNumbers: true,
            lineWrapping: true,
            scrollbarStyle: 'native',
            value: "// Start coding here...\nconsole.log('Hello World!');"
        });

        console.log('✅ CodeMirror initialized');

        editorRef.current.on('change', (instance, changes) => {
            const { origin } = changes;
            const code = instance.getValue();
            onCodeChange(code);
            if (origin !== 'setValue' && socketRef.current) {
                socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                    roomId,
                    code,
                });
            }
        });

        setTimeout(() => {
            if (editorRef.current) {
                editorRef.current.refresh();
            }
        }, 100);

    }, 100);

    return () => {
        if (editorRef.current) {
            editorRef.current.toTextArea();
        }
    };
}, []); // ✅ RUN ONLY ONCE - remove all dependencies

/* ---------------- Update CodeMirror Mode When Language Changes ---------------- */
useEffect(() => {
    if (!editorRef.current) return;
    
    let mode;
    switch(language) {
        case 'javascript':
            mode = 'javascript';
            break;
        case 'python':
            mode = 'python';
            break;
        case 'cpp':
        case 'java':
            mode = 'text/x-c++src';
            break;
        default:
            mode = 'javascript';
    }
    
    console.log('🔄 Updating CodeMirror mode to:', mode);
    editorRef.current.setOption('mode', mode);
    
}, [language]); // ✅ Only update mode, not recreate editor

/* ---------------- Update CodeMirror Theme ---------------- */
useEffect(() => {
    if (!editorRef.current) return;
    
    console.log('🎨 Updating CodeMirror theme');
    editorRef.current.setOption('theme', isDarkMode ? 'dracula' : 'default');
}, [isDarkMode]); // ✅ Only update theme

    /* ---------------- Socket event listeners ---------------- */
    useEffect(() => {
        if (!socketRef.current) {
            console.log('⏳ No socket available for listeners');
            return;
        }

        const socket = socketRef.current;
        console.log('🔌 Setting up socket listeners for chat and code sync');

        // Handle incoming code changes from other users
        const handleCodeChange = ({ code }) => {
            if (!editorRef.current) {
                console.log('⏳ Editor not ready yet, skipping code change');
                return;
            }
            
            const currentCode = editorRef.current.getValue();
            if (code !== null && code !== currentCode) {
                console.log('📝 Receiving code change from other user');
                editorRef.current.setValue(code);
            }
        };

        // Handle language changes from other users
        const handleLanguageChange = ({ language: newLanguage }) => {
            console.log('🌐 Receiving language change from socket:', newLanguage);
            setLanguage(newLanguage);
        };

        // Handle output from other users
        const handleRunOutput = ({ output }) => {
            console.log('📊 Receiving output from other user');
            setOutput(output);
        };

        // Handle input changes from other users
        const handleInputChange = ({ input }) => {
            console.log('⌨️ Receiving input change from other user');
            setUserInput(input);
        };

        // Handle chat messages
        const handleChatMessage = (message) => {
            console.log('📨 handleChatMessage triggered:', message);
            console.log('💬 Current messages before:', chatMessages);
            
            setChatMessages((prev) => {
                if (prev.find(m => m.id === message.id)) {
                    console.log('🚫 Duplicate message prevented');
                    return prev;
                }
                const newMessages = [...prev, message];
                console.log('💬 New messages after:', newMessages);
                return newMessages;
            });
        };

        // Handle user joined
        const handleUserJoined = ({ clients, username, socketId }) => {
            console.log(`👋 ${username} joined the room`);
        };

        // Add welcome message only if no messages exist
        if (chatMessages.length === 0) {
            const welcomeMessage = {
                id: Date.now(),
                text: 'Welcome to CodeVerse AI! Start coding collaboratively...',
                sender: 'System',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setChatMessages([welcomeMessage]);
        }

        // Set up all event listeners
        socket.on(ACTIONS.CODE_CHANGE, handleCodeChange);
        socket.on(ACTIONS.LANGUAGE_CHANGE, handleLanguageChange);
        socket.on(ACTIONS.RUN_OUTPUT, handleRunOutput);
        socket.on(ACTIONS.INPUT_CHANGE, handleInputChange);
        socket.on(ACTIONS.CHAT_MESSAGE, handleChatMessage);
        socket.on(ACTIONS.JOINED, handleUserJoined);

        console.log('✅ All socket listeners setup complete');

        // Cleanup
        return () => {
            socket.off(ACTIONS.CODE_CHANGE, handleCodeChange);
            socket.off(ACTIONS.LANGUAGE_CHANGE, handleLanguageChange);
            socket.off(ACTIONS.RUN_OUTPUT, handleRunOutput);
            socket.off(ACTIONS.INPUT_CHANGE, handleInputChange);
            socket.off(ACTIONS.CHAT_MESSAGE, handleChatMessage);
            socket.off(ACTIONS.JOINED, handleUserJoined);
        };
    }, [socketRef, chatMessages]);

    /* ---------------- Update CodeMirror Theme & Mode ---------------- */
    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.setOption('theme', isDarkMode ? 'dracula' : 'default');
        }
    }, [isDarkMode]);

    useEffect(() => {
        if (editorRef.current) {
            let mode;
            switch(language) {
                case 'javascript':
                    mode = 'javascript';
                    break;
                case 'python':
                    mode = 'python';
                    break;
                case 'cpp':
                case 'java':
                    mode = 'text/x-c++src';
                    break;
                default:
                    mode = 'javascript';
            }
            editorRef.current.setOption('mode', mode);
        }
    }, [language]);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // Focus terminal input when it becomes available
    useEffect(() => {
        if (terminalInputRef.current && isTerminalOpen) {
            terminalInputRef.current.focus();
        }
    }, [output, isTerminalOpen]);

    /* ---------------- Handle language change ---------------- */
    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        console.log('🌐 User changing language to:', newLang);
        
        setLanguage(newLang);
        
        if (socketRef.current) {
            console.log('📡 Emitting language change to socket');
            socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, {
                roomId,
                language: newLang,
            });
        } else {
            console.error('❌ Socket not available for language change');
        }
    };

    /* ---------------- Run code via backend ---------------- */
    const runCode = async () => {
        if (!editorRef.current) return;

        setIsRunning(true);
        const code = editorRef.current.getValue();

        console.log('🚀 runCode triggered');
        console.log('📝 Code:', code.substring(0, 100) + '...');
        console.log('🌐 Language:', language);
        console.log('⌨️ Input:', userInput);

        try {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost 
                ? 'http://localhost:5000'
                : 'https://codeverseai-editor-production.up.railway.app';
            
            console.log('🔗 Backend URL:', backendUrl, '(Auto-detected)');
            
            const response = await fetch(`${backendUrl}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language, input: userInput }),
            });
            
            console.log('📡 Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📊 Result:', result);
            
            const outputText = result.output || result.error || 'No output';
            setOutput(outputText);

            if (socketRef.current && isSocketReady) {
                socketRef.current.emit(ACTIONS.RUN_OUTPUT, {
                    roomId,
                    output: outputText,
                });
            }
        } catch (err) {
            console.error('❌ Run code error:', err);
            setOutput('Error running code: ' + err.message);
        } finally {
            setIsRunning(false);
        }
    };

    /* ---------------- Chat input handler ---------------- */
    const handleChatInputChange = (e) => {
        const newText = e.target.value;
        console.log('⌨️ Chat input changed:', newText);
        setChatText(newText);
    };

    /* ---------------- Chat send handler ---------------- */
    const sendChatMessage = () => {
        console.log('💬 Send button clicked, text:', chatText);
        
        if (!chatText.trim()) {
            console.log('❌ Empty message, not sending');
            return;
        }
        
        if (!socketRef.current) {
            console.error('❌ Socket not available for chat');
            return;
        }

        if (!isSocketReady) {
            console.error('❌ Socket not ready for chat');
            return;
        }

        const messageData = {
            roomId,
            message: {
                text: chatText.trim()
            }
        };

        console.log('📤 Sending chat message:', messageData);
        socketRef.current.emit(ACTIONS.CHAT_MESSAGE, messageData);
        setChatText('');
    };

    const handleChatKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    };

    /* ---------------- Toggle Dark/Light Mode ---------------- */
    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
    };

    /* ---------------- Toggle Chat Visibility ---------------- */
    const toggleChat = () => {
        setIsChatOpen(!isChatOpen);
    };

    /* ---------------- Toggle Terminal Visibility ---------------- */
    const toggleTerminal = () => {
        setIsTerminalOpen(!isTerminalOpen);
    };

    /* ---------------- Handle Terminal Input ---------------- */
    const handleTerminalInput = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = e.target.value;
            if (input.trim()) {
                setOutput(prev => prev + `\n> ${input}`);
                setUserInput(input);
                e.target.value = '';
                
                if (editorRef.current) {
                    runCode();
                }
            }
        }
    };

    /* ---------------- Clear Terminal ---------------- */
    const clearTerminal = () => {
        setOutput('');
        setUserInput('');
    };

    /* ---------------- Chat Message Component ---------------- */
    const ChatMessage = ({ message }) => {
        const isMe = message.sender === username;
        
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: isMe ? 'flex-end' : 'flex-start',
                    marginBottom: '8px',
                    padding: '0 8px',
                }}
            >
                <div
                    style={{
                        maxWidth: '85%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                    }}
                >
                    <div
                        style={{
                            backgroundColor: isMe ? theme.accent : theme.surfaceSecondary,
                            color: isMe ? '#000' : theme.text,
                            padding: '8px 12px',
                            borderRadius: '12px',
                            borderTopRightRadius: isMe ? '4px' : '12px',
                            borderTopLeftRadius: isMe ? '12px' : '4px',
                            wordBreak: 'break-word',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            border: isMe ? 'none' : `1px solid ${theme.border}`,
                        }}
                    >
                        {!isMe && (
                            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px', color: theme.accent }}>
                                {message.sender}
                            </div>
                        )}
                        
                        <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                            {message.text}
                        </div>
                        
                        <div
                            style={{
                                fontSize: '10px',
                                color: isMe ? 'rgba(0,0,0,0.6)' : theme.textSecondary,
                                textAlign: 'right',
                                marginTop: '2px',
                            }}
                        >
                            {message.time}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Theme variables
    const theme = {
        background: isDarkMode ? '#1e1f29' : '#f8f9fa',
        surface: isDarkMode ? '#282a36' : '#ffffff',
        surfaceSecondary: isDarkMode ? '#2d303d' : '#f1f3f5',
        text: isDarkMode ? '#f8f8f2' : '#2f3542',
        textSecondary: isDarkMode ? '#bd93f9' : '#747d8c',
        border: isDarkMode ? '#44475a' : '#dee2e6',
        accent: '#61dafb',
        success: '#50fa7b',
        terminalBg: isDarkMode ? '#0e1119' : '#ffffff',
        terminalText: isDarkMode ? '#f8f8f2' : '#2f3542',
        chatBg: isDarkMode ? '#1e1f29' : '#ffffff',
        chatSurface: isDarkMode ? '#282a36' : '#f8f9fa',
    };

    return (
        <div
            style={{
                display: 'flex',
                height: '100vh',
                backgroundColor: theme.background,
                color: theme.text,
                overflow: 'hidden',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
        >
            {/* MAIN AREA (editor + terminal) */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                }}
            >
                {/* Top bar */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 24px',
                        backgroundColor: theme.surface,
                        borderBottom: `1px solid ${theme.border}`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            fontSize: '14px',
                            color: connectionStatus === 'connected' ? theme.success : 
                                   connectionStatus === 'connecting' ? '#ffa500' : '#ff4757',
                            backgroundColor: `${connectionStatus === 'connected' ? theme.success : 
                                             connectionStatus === 'connecting' ? '#ffa500' : '#ff4757'}20`,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontWeight: '500',
                        }}>
                            {connectionStatus === 'connected' ? '🟢 Connected' : 
                             connectionStatus === 'connecting' ? '🟡 Connecting...' : '🔴 Disconnected'}
                        </div>
                        
                        <div
                            style={{
                                fontSize: '14px',
                                color: theme.success,
                                backgroundColor: `${theme.success}20`,
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontWeight: '500',
                            }}
                        >
                            🔄 Real-time Sync
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <select
                            value={language}
                            onChange={handleLanguageChange}
                            style={{
                                backgroundColor: theme.surfaceSecondary,
                                color: theme.text,
                                border: `1px solid ${theme.border}`,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                outline: 'none',
                                minWidth: '120px',
                            }}
                        >
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="cpp">C++</option>
                            <option value="java">Java</option>
                        </select>

                        <button
                            onClick={toggleDarkMode}
                            style={{
                                padding: '8px',
                                borderRadius: '8px',
                                backgroundColor: 'transparent',
                                border: `1px solid ${theme.border}`,
                                cursor: 'pointer',
                                color: theme.text,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                            }}
                            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>

                        <button
                            onClick={toggleTerminal}
                            style={{
                                padding: '8px',
                                borderRadius: '8px',
                                backgroundColor: 'transparent',
                                border: `1px solid ${theme.border}`,
                                cursor: 'pointer',
                                color: theme.text,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                            }}
                            title={isTerminalOpen ? 'Hide Terminal' : 'Show Terminal'}
                        >
                            {isTerminalOpen ? '📟' : '💻'}
                        </button>

                        <button
                            onClick={toggleChat}
                            style={{
                                padding: '8px',
                                borderRadius: '8px',
                                backgroundColor: 'transparent',
                                border: `1px solid ${theme.border}`,
                                cursor: 'pointer',
                                color: theme.text,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                position: 'relative',
                            }}
                            title={isChatOpen ? 'Hide Chat' : 'Show Chat'}
                        >
                            💬
                            {chatMessages.length > 1 && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: '-5px',
                                        right: '-5px',
                                        backgroundColor: '#ff4757',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: '16px',
                                        height: '16px',
                                        fontSize: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    {chatMessages.length - 1}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={runCode}
                            disabled={isRunning}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                backgroundColor: isRunning ? theme.border : theme.accent,
                                border: 'none',
                                cursor: isRunning ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                color: '#000',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                        >
                            {isRunning ? (
                                <>
                                    <div style={{ width: '12px', height: '12px', border: '2px solid transparent', borderTop: '2px solid #000', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                    Running...
                                </>
                            ) : (
                                <>
                                    ▶ Run
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Editor - Scrollable with Real-time Sync */}
                <div style={{ 
                    flex: 1, 
                    overflow: 'auto',
                    position: 'relative',
                }}>
                    <textarea id="realtimeEditor"></textarea>
                </div>

                {/* COLLAPSIBLE TERMINAL */}
                {isTerminalOpen && (
                    <div
                        style={{
                            backgroundColor: theme.background,
                            borderTop: `1px solid ${theme.border}`,
                            height: '200px',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 16px',
                                backgroundColor: isDarkMode ? '#1a1b26' : '#e9ecef',
                                borderBottom: `1px solid ${theme.border}`,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div
                                    style={{
                                        color: theme.accent,
                                        fontWeight: 'bold',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }}
                                >
                                    TERMINAL
                                </div>
                                <div
                                    style={{
                                        fontSize: '10px',
                                        color: theme.textSecondary,
                                        backgroundColor: theme.surfaceSecondary,
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                    }}
                                >
                                    {language.toUpperCase()}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={clearTerminal}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: theme.textSecondary,
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                    }}
                                    title="Clear Terminal"
                                >
                                    🗑️ Clear
                                </button>
                                <button
                                    onClick={toggleTerminal}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: theme.textSecondary,
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        padding: '4px',
                                        borderRadius: '4px',
                                    }}
                                    title="Close Terminal"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div
                            style={{
                                flex: 1,
                                backgroundColor: theme.terminalBg,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                fontFamily: 'Monaco, "Courier New", monospace',
                                fontSize: '13px',
                            }}
                        >
                            <div
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    color: theme.terminalText,
                                    lineHeight: '1.4',
                                }}
                            >
                                {output ? (
                                    <div>
                                        <div style={{ marginBottom: '8px' }}>
                                            {output}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: theme.textSecondary }}>
                                        {/* Terminal will show output here after running code */}
                                    </div>
                                )}
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    backgroundColor: isDarkMode ? '#0a0a0f' : '#f8f9fa',
                                    borderTop: `1px solid ${theme.border}`,
                                }}
                            >
                                <span
                                    style={{
                                        color: theme.success,
                                        fontWeight: 'bold',
                                        fontFamily: 'Monaco, "Courier New", monospace',
                                    }}
                                >
                                    ❯
                                </span>
                                <input
                                    ref={terminalInputRef}
                                    type="text"
                                    placeholder="Type input here and press Enter to run..."
                                    onKeyDown={handleTerminalInput}
                                    style={{
                                        flex: 1,
                                        backgroundColor: 'transparent',
                                        color: theme.terminalText,
                                        border: 'none',
                                        outline: 'none',
                                        fontFamily: 'Monaco, "Courier New", monospace',
                                        fontSize: '13px',
                                        padding: '4px 0',
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT CHAT PANEL - Collapsible with Updated Theme */}
            {isChatOpen && (
                <div
                    style={{
                        width: '320px',
                        borderLeft: `1px solid ${theme.border}`,
                        backgroundColor: theme.chatBg,
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0,
                        transition: 'all 0.3s ease',
                    }}
                >
                    <div
                        style={{
                            padding: '16px 20px',
                            borderBottom: `1px solid ${theme.border}`,
                            backgroundColor: theme.surface,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '16px', color: theme.text }}>Room Chat</div>
                            <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                                {isSocketReady ? 
                                    `${chatMessages.length - 1} messages • Online` : 
                                    'Connecting...'
                                }
                            </div>
                        </div>
                        <button
                            onClick={toggleChat}
                            style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: theme.text,
                                cursor: 'pointer',
                                fontSize: '18px',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            title="Close Chat"
                        >
                            ✕
                        </button>
                    </div>

                    <div
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            backgroundColor: theme.background,
                            padding: '12px 0',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {chatMessages.length === 0 ? (
                            <div
                                style={{
                                    color: theme.textSecondary,
                                    textAlign: 'center',
                                    marginTop: '50px',
                                    fontSize: '14px',
                                    fontStyle: 'italic',
                                }}
                            >
                                No messages yet. Start the conversation! 👋
                            </div>
                        ) : (
                            chatMessages.map((message) => (
                                <ChatMessage key={message.id} message={message} />
                            ))
                        )}
                        <div ref={chatMessagesEndRef} />
                    </div>

                    <div
                        style={{
                            padding: '16px',
                            backgroundColor: theme.surface,
                            borderTop: `1px solid ${theme.border}`,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                gap: '8px',
                                backgroundColor: theme.surfaceSecondary,
                                borderRadius: '8px',
                                padding: '8px 12px',
                                border: `1px solid ${theme.border}`,
                            }}
                        >
                            <textarea
                                value={chatText}
                                onChange={handleChatInputChange}
                                onKeyDown={handleChatKeyDown}
                                placeholder={isSocketReady ? "Type a message..." : "Connecting..."}
                                disabled={!isSocketReady}
                                rows={1}
                                style={{
                                    flex: 1,
                                    resize: 'none',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: isSocketReady ? theme.text : theme.textSecondary,
                                    fontSize: '14px',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    maxHeight: '80px',
                                    padding: '6px 0',
                                    lineHeight: '1.4',
                                }}
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={!chatText.trim() || !isSocketReady}
                                style={{
                                    backgroundColor: (chatText.trim() && isSocketReady) ? theme.accent : theme.border,
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    cursor: (chatText.trim() && isSocketReady) ? 'pointer' : 'not-allowed',
                                    color: (chatText.trim() && isSocketReady) ? '#000' : theme.textSecondary,
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                Send
                            </button>
                        </div>
                        <div
                            style={{
                                fontSize: '11px',
                                color: theme.textSecondary,
                                textAlign: 'center',
                                marginTop: '8px',
                            }}
                        >
                            Press Enter to send • Shift+Enter for new line
                        </div>
                    </div>
                </div>
            )}

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
};

export default Editor;