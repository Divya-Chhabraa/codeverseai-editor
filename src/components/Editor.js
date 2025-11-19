/* eslint-disable react-hooks/exhaustive-deps */
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

const Editor = ({ socketRef, roomId, onCodeChange, username }) => {
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

    // Monitor socketRef changes
    useEffect(() => {
        if (socketRef.current) {
            console.log('✅ Socket ref is now available:', socketRef.current.id);
            setIsSocketReady(true);
        } else {
            console.log('❌ Socket ref is null');
            setIsSocketReady(false);
        }
    }, [socketRef]);

    // Auto-scroll to bottom of chat and focus terminal input
    const scrollToBottom = () => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    // Focus terminal input when it becomes available
    useEffect(() => {
        if (terminalInputRef.current && isTerminalOpen) {
            terminalInputRef.current.focus();
        }
    }, [output, isTerminalOpen]);

    /* ---------------- Initialize CodeMirror ---------------- */
    useEffect(() => {
        const textarea = document.getElementById('realtimeEditor');
        if (!textarea) return;

        editorRef.current = Codemirror.fromTextArea(textarea, {
            mode: { name: language === 'cpp' || language === 'java' ? 'text/x-c++src' : language },
            theme: isDarkMode ? 'dracula' : 'default',
            autoCloseTags: true,
            autoCloseBrackets: true,
            lineNumbers: true,
            lineWrapping: true,
            scrollbarStyle: 'native',
        });

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

        return () => {
            if (editorRef.current) {
                editorRef.current.toTextArea();
            }
        };
    }, [language, isDarkMode, socketRef, roomId, onCodeChange]);

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

    /* ---------------- Socket event listeners ---------------- */
    useEffect(() => {
        if (!socketRef.current) {
            console.log('⏳ Waiting for socketRef...');
            return;
        }

        const socket = socketRef.current;
        console.log('🔌 Setting up socket listeners for chat and code sync');

        // Handle incoming code changes from other users
        const handleCodeChange = ({ code }) => {
            try {
                if (code !== null && code !== editorRef.current?.getValue()) {
                    console.log('📝 Receiving code change from other user');
                    editorRef.current.setValue(code);
                }
            } catch (error) {
                console.error('Error handling code change:', error);
            }
        };

        // Handle language changes from other users
        const handleLanguageChange = ({ language }) => {
            try {
                console.log('🌐 Receiving language change:', language);
                setLanguage(language);
            } catch (error) {
                console.error('Error handling language change:', error);
            }
        };

        // Handle output from other users
        const handleRunOutput = ({ output }) => {
            try {
                console.log('📊 Receiving output from other user');
                setOutput(output);
            } catch (error) {
                console.error('Error handling run output:', error);
            }
        };

        // Handle input changes from other users
        const handleInputChange = ({ input }) => {
            try {
                console.log('⌨️ Receiving input change from other user');
                setUserInput(input);
            } catch (error) {
                console.error('Error handling input change:', error);
            }
        };

        // Handle chat messages
        const handleChatMessage = (message) => {
            try {
                console.log('📨 handleChatMessage triggered:', message);
                setChatMessages((prev) => {
                    if (prev.find(m => m.id === message.id)) {
                        return prev;
                    }
                    return [...prev, message];
                });
            } catch (error) {
                console.error('Error handling chat message:', error);
            }
        };

        // Add welcome message
        const welcomeMessage = {
            id: Date.now(),
            text: 'Welcome to CodeVerse AI! Start coding collaboratively...',
            sender: 'System',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages([welcomeMessage]);

        // Set up all event listeners
        socket.on(ACTIONS.CODE_CHANGE, handleCodeChange);
        socket.on(ACTIONS.LANGUAGE_CHANGE, handleLanguageChange);
        socket.on(ACTIONS.RUN_OUTPUT, handleRunOutput);
        socket.on(ACTIONS.INPUT_CHANGE, handleInputChange);
        socket.on(ACTIONS.CHAT_MESSAGE, handleChatMessage);

        console.log('✅ All socket listeners setup complete');

        // Cleanup
        return () => {
            socket.off(ACTIONS.CODE_CHANGE, handleCodeChange);
            socket.off(ACTIONS.LANGUAGE_CHANGE, handleLanguageChange);
            socket.off(ACTIONS.RUN_OUTPUT, handleRunOutput);
            socket.off(ACTIONS.INPUT_CHANGE, handleInputChange);
            socket.off(ACTIONS.CHAT_MESSAGE, handleChatMessage);
        };
    }, [socketRef, roomId, username]);

    /* ---------------- Handle language change ---------------- */
    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
        if (socketRef.current) {
            socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, {
                roomId,
                language: newLang,
            });
        }
    };

    /* ---------------- Run code via backend ---------------- */
    const runCode = async () => {
        if (!editorRef.current) return;

        setIsRunning(true);
        const code = editorRef.current.getValue();

        try {
            // ✅ FIXED: Added https:// protocol
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://codeverseai-editor-production.up.railway.app';
            
            console.log('🚀 Sending code to backend:', backendUrl);

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
            console.log('✅ Execution result:', result);
            
            const outputText = result.output || result.error || 'No output';
            setOutput(outputText);

            if (socketRef.current) {
                socketRef.current.emit(ACTIONS.RUN_OUTPUT, {
                    roomId,
                    output: outputText,
                });
            }
        } catch (err) {
            console.error('❌ Code execution error:', err);
            setOutput('Error: Unable to connect to code execution service. Please try again.');
        } finally {
            setIsRunning(false);
        }
    };

    /* ---------------- Chat send handler ---------------- */
    const sendChatMessage = () => {
        if (!chatText.trim() || !socketRef.current) return;

        const messageData = {
            roomId,
            message: {
                text: chatText.trim()
            }
        };

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
                // Add the input to output with prompt
                setOutput(prev => prev + `\n> ${input}`);
                setUserInput(input);
                e.target.value = '';
                
                // Auto-run code when input is provided
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
                    {/* Message bubble */}
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
                        {/* Sender name */}
                        {!isMe && (
                            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px', color: theme.accent }}>
                                {message.sender}
                            </div>
                        )}
                        
                        {/* Message text */}
                        <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                            {message.text}
                        </div>
                        
                        {/* Time stamp */}
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

                        {/* Terminal Toggle Button */}
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

                        {/* Chat Toggle Button */}
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
                            {chatMessages.length > 0 && (
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
                                    {chatMessages.length}
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
                        {/* Terminal Header */}
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

                        {/* Terminal Content - Unified Output and Input */}
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
                            {/* Scrollable Output Area */}
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
                                        {/* Empty terminal state */}
                                    </div>
                                )}
                            </div>

                            {/* Input Line - Integrated at bottom */}
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
                    {/* Chat Header with Close Button */}
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
                                    `${chatMessages.length} messages • Online` : 
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

                    {/* Messages Area */}
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

                    {/* Chat Input */}
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
                                onChange={(e) => setChatText(e.target.value)}
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

            {/* Add CSS for spinner animation */}
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