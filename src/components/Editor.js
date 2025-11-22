import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import AIAssistant from './AIAssistant';
import PanelSwitcher from './PanelSwitcher';

/* ---------------- GLOBAL BACKEND URL HELPER ---------------- */
const getBackendUrl = () => {
    const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
    return isLocalhost
        ? 'http://localhost:5000'
        : 'https://codeverseai-editor-production.up.railway.app';
};

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
    const [activePanel, setActivePanel] = useState('chat');
    const [aiMessages, setAiMessages] = useState([]);

    // Sync states
    const [initialCodeReceived, setInitialCodeReceived] = useState(false);
    const [initialOutputReceived, setInitialOutputReceived] = useState(false);

    /* ---------------- FILE LOAD/SAVE HELPERS ---------------- */

    const loadFileFromServer = useCallback(async () => {
        if (!roomId || !editorRef.current) return;
        try {
            const backendUrl = getBackendUrl();
            const res = await fetch(`${backendUrl}/api/file/${roomId}`);
            if (!res.ok) {
                console.error('Failed to load file from server');
                return;
            }
            const data = await res.json();
            if (data && data.success && editorRef.current) {
                if (data.language) {
                    setLanguage(data.language);
                }
                if (typeof data.content === 'string') {
                    editorRef.current.setValue(data.content);
                }
            }
        } catch (err) {
            console.error('Error loading file:', err);
        }
    }, [roomId]);

    const saveFileToServer = async () => {
        if (!editorRef.current || !roomId) return;
        const content = editorRef.current.getValue();
        try {
            const backendUrl = getBackendUrl();
            const res = await fetch(`${backendUrl}/api/file/${roomId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    language,
                }),
            });
            const data = await res.json();
            if (data.success) {
                console.log('File saved successfully');
            } else {
                console.error('Save failed:', data.error);
            }
        } catch (err) {
            console.error('Error saving file:', err);
        }
    };

    /* ---------------- COMBINED SOCKET CONNECTION MONITORING ---------------- */
    useEffect(() => {
        if (!socketRef.current) return;

        const socket = socketRef.current;

        setIsSocketReady(socket.connected);
        setConnectionStatus(socket.connected ? 'connected' : 'connecting');

        const handleConnect = () => {
            setIsSocketReady(true);
            setConnectionStatus('connected');
        };

        const handleDisconnect = () => {
            setIsSocketReady(false);
            setConnectionStatus('disconnected');
        };

        const handleConnectError = () => {
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

    /* ---------------- CODE SYNC REQUEST ---------------- */
    useEffect(() => {
        if (isSocketReady && socketRef.current && roomId && !initialCodeReceived) {
            socketRef.current.emit(ACTIONS.SYNC_CODE_REQUEST, { roomId });

            const timeoutId = setTimeout(() => {
                setInitialCodeReceived(true);
                setInitialOutputReceived(true);
            }, 2000);

            return () => clearTimeout(timeoutId);
        }
    }, [isSocketReady, socketRef, roomId, initialCodeReceived]);

    /* ---------------- RESET ON ROOM CHANGE ---------------- */
    useEffect(() => {
        setInitialCodeReceived(false);
        setInitialOutputReceived(false);
        setOutput('');
        setUserInput('');
    }, [roomId]);

    /* ---------------- INITIALIZE CODEMIRROR (ONCE) ---------------- */
    useEffect(() => {
        const currentSocketRef = socketRef.current;
        const currentRoomId = roomId;
        const currentOnCodeChange = onCodeChange;
        const currentIsDarkMode = isDarkMode;

        setTimeout(() => {
            const textarea = document.getElementById('realtimeEditor');
            if (!textarea) return;

            editorRef.current = Codemirror.fromTextArea(textarea, {
                mode: 'javascript',
                theme: currentIsDarkMode ? 'dracula' : 'default',
                autoCloseTags: true,
                autoCloseBrackets: true,
                lineNumbers: true,
                lineWrapping: true,
                scrollbarStyle: 'native',
                value: '',
            });

            editorRef.current.on('change', (instance, changes) => {
                const { origin } = changes;
                const code = instance.getValue();
                currentOnCodeChange(code);
                if (origin !== 'setValue' && currentSocketRef) {
                    currentSocketRef.emit(ACTIONS.CODE_CHANGE, {
                        roomId: currentRoomId,
                        code,
                    });
                }
            });

            // Load initial file content from backend
            if (editorRef.current) {
                loadFileFromServer();
            }

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
    }, [isDarkMode, onCodeChange, roomId, socketRef, loadFileFromServer]);

    /* ---------------- UPDATE CODEMIRROR MODE WHEN LANGUAGE CHANGES ---------------- */
    useEffect(() => {
        if (!editorRef.current) return;

        let mode;
        switch (language) {
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
    }, [language]);

    /* ---------------- UPDATE CODEMIRROR THEME ---------------- */
    useEffect(() => {
        if (!editorRef.current) return;
        editorRef.current.setOption('theme', isDarkMode ? 'dracula' : 'default');
    }, [isDarkMode]);

    /* ---------------- SOCKET EVENT LISTENERS ---------------- */
    useEffect(() => {
        if (!socketRef.current) return;

        const socket = socketRef.current;

        const handleCodeChange = ({ code }) => {
            if (!editorRef.current) return;

            const currentCode = editorRef.current.getValue();

            if (code !== null && code !== currentCode) {
                if (!initialCodeReceived) {
                    editorRef.current.setValue(code);
                    setInitialCodeReceived(true);
                } else if (code.trim() !== currentCode.trim()) {
                    editorRef.current.setValue(code);
                }
            }
        };

        const handleLanguageChange = ({ language: newLanguage }) => {
            setLanguage(newLanguage);
        };

        const handleRunOutput = ({ output }) => {
            if (!initialOutputReceived && output) {
                setOutput(output);
                setInitialOutputReceived(true);
            } else if (initialOutputReceived) {
                setOutput(output);
            }
        };

        const handleInputChange = ({ input }) => {
            setUserInput(input);
        };

        const handleChatMessage = (message) => {
            setChatMessages((prev) => {
                const isDuplicate = prev.some(
                    (m) =>
                        m.id === message.id ||
                        (m.text === message.text &&
                            m.sender === message.sender &&
                            Math.abs(m.timestamp - message.timestamp) < 5000)
                );

                if (isDuplicate) return prev;
                return [...prev, message];
            });
        };

        const handleAiMessage = (message) => {
            setAiMessages((prev) => {
                const isDuplicate = prev.some(
                    (m) =>
                        m.id === message.id ||
                        (m.text === message.text &&
                            m.sender === message.sender &&
                            Math.abs(m.timestamp - message.timestamp) < 5000)
                );

                if (isDuplicate) return prev;
                return [...prev, message];
            });
        };

        const handleAiHistorySync = ({ messages }) => {
            if (aiMessages.length <= 1) {
                setAiMessages(messages);
            }
        };

        if (chatMessages.length === 0) {
            const welcomeMessage = {
                id: Date.now(),
                text: 'Welcome to CodeVerse AI! Start coding collaboratively...',
                sender: 'System',
                time: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
            };
            setChatMessages([welcomeMessage]);
        }

        if (aiMessages.length === 0) {
            const aiWelcomeMessage = {
                id: Date.now() + 1,
                text: "Hello! I'm your AI coding assistant. I can help explain code, debug issues, suggest improvements, and answer programming questions. What would you like to know?",
                sender: 'AI Assistant',
                time: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                timestamp: Date.now(),
                isAi: true,
            };
            setAiMessages([aiWelcomeMessage]);
        }

        socket.on(ACTIONS.CODE_CHANGE, handleCodeChange);
        socket.on(ACTIONS.LANGUAGE_CHANGE, handleLanguageChange);
        socket.on(ACTIONS.RUN_OUTPUT, handleRunOutput);
        socket.on(ACTIONS.INPUT_CHANGE, handleInputChange);
        socket.on(ACTIONS.CHAT_MESSAGE, handleChatMessage);
        socket.on(ACTIONS.AI_MESSAGE, handleAiMessage);
        socket.on(ACTIONS.AI_HISTORY_SYNC, handleAiHistorySync);

        return () => {
            socket.off(ACTIONS.CODE_CHANGE, handleCodeChange);
            socket.off(ACTIONS.LANGUAGE_CHANGE, handleLanguageChange);
            socket.off(ACTIONS.RUN_OUTPUT, handleRunOutput);
            socket.off(ACTIONS.INPUT_CHANGE, handleInputChange);
            socket.off(ACTIONS.CHAT_MESSAGE, handleChatMessage);
            socket.off(ACTIONS.AI_MESSAGE, handleAiMessage);
            socket.off(ACTIONS.AI_HISTORY_SYNC, handleAiHistorySync);
        };
    }, [
        socketRef,
        chatMessages,
        username,
        aiMessages.length,
        roomId,
        isSocketReady,
        initialCodeReceived,
        initialOutputReceived,
    ]);

    useEffect(() => {
        if (activePanel === 'assistant' && socketRef.current && isSocketReady && roomId) {
            socketRef.current.emit(ACTIONS.AI_HISTORY_REQUEST, { roomId });
        }
    }, [activePanel, socketRef, isSocketReady, roomId]);

    useEffect(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    useEffect(() => {
        if (terminalInputRef.current && isTerminalOpen) {
            terminalInputRef.current.focus();
        }
    }, [output, isTerminalOpen]);

    /* ---------------- HANDLE LANGUAGE CHANGE ---------------- */
    const handleLanguageChangeSelect = (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);

        if (socketRef.current && isSocketReady) {
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
            const backendUrl = getBackendUrl();

            const response = await fetch(`${backendUrl}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language, input: userInput }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const outputText = result.output || result.error || 'No output';
            setOutput(outputText);

            if (socketRef.current && isSocketReady) {
                socketRef.current.emit(ACTIONS.RUN_OUTPUT, {
                    roomId,
                    output: outputText,
                });
            }
        } catch (err) {
            const errorOutput = 'Error running code: ' + err.message;
            setOutput(errorOutput);

            if (socketRef.current && isSocketReady) {
                socketRef.current.emit(ACTIONS.RUN_OUTPUT, {
                    roomId,
                    output: errorOutput,
                });
            }
        } finally {
            setIsRunning(false);
        }
    };

    /* ---------------- Chat handlers ---------------- */
    const handleChatInputChange = (e) => {
        setChatText(e.target.value);
    };

    const sendChatMessage = () => {
        if (!chatText.trim() || !socketRef.current || !isSocketReady) return;

        const messageData = {
            roomId,
            message: {
                text: chatText.trim(),
            },
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

    /* ---------------- Toggles ---------------- */
    const toggleDarkMode = () => setIsDarkMode((prev) => !prev);
    const toggleChat = () => setIsChatOpen((prev) => !prev);
    const toggleTerminal = () => setIsTerminalOpen((prev) => !prev);

    /* ---------------- Terminal input ---------------- */
    const handleTerminalInput = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = e.target.value;
            if (input.trim()) {
                setOutput((prev) => prev + `\n> ${input}`);
                setUserInput(input);
                e.target.value = '';

                if (editorRef.current) {
                    runCode();
                }
            }
        }
    };

    const clearTerminal = () => {
        setOutput('');
        setUserInput('');
    };

    /* ---------------- Chat Message Component ---------------- */
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
                            <div
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    marginBottom: '2px',
                                    color: theme.accent,
                                }}
                            >
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

    return (
        <div
            style={{
                display: 'flex',
                height: '100vh',
                backgroundColor: theme.background,
                color: theme.text,
                overflow: 'hidden',
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
                                color:
                                    connectionStatus === 'connected'
                                        ? theme.success
                                        : connectionStatus === 'connecting'
                                        ? '#ffa500'
                                        : '#ff4757',
                                backgroundColor: `${
                                    connectionStatus === 'connected'
                                        ? theme.success
                                        : connectionStatus === 'connecting'
                                        ? '#ffa500'
                                        : '#ff4757'
                                }20`,
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontWeight: '500',
                            }}
                        >
                            {connectionStatus === 'connected'
                                ? '🟢 Connected'
                                : connectionStatus === 'connecting'
                                ? '🟡 Connecting...'
                                : '🔴 Disconnected'}
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
                            onChange={handleLanguageChangeSelect}
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

                        {/* SAVE BUTTON */}
                        <button
                            onClick={saveFileToServer}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                backgroundColor: '#50fa7b',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                color: '#000',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                        >
                            💾 Save
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
                                    <div
                                        style={{
                                            width: '12px',
                                            height: '12px',
                                            border: '2px solid transparent',
                                            borderTop: '2px solid #000',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite',
                                        }}
                                    />
                                    Running...
                                </>
                            ) : (
                                <>▶ Run</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Editor */}
                <div
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        position: 'relative',
                    }}
                >
                    <textarea id="realtimeEditor"></textarea>
                </div>

                {/* Terminal */}
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
                                        <div style={{ marginBottom: '8px' }}>{output}</div>
                                    </div>
                                ) : (
                                    <div style={{ color: theme.textSecondary }} />
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

            {/* RIGHT PANEL */}
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
                    <PanelSwitcher
                        activePanel={activePanel}
                        setActivePanel={setActivePanel}
                        theme={theme}
                        chatMessages={chatMessages}
                        aiMessages={aiMessages}
                    />

                    <div
                        style={{
                            padding: '12px 20px',
                            borderBottom: `1px solid ${theme.border}`,
                            backgroundColor: theme.surface,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                            {activePanel === 'chat'
                                ? `${chatMessages.length - 1} messages • Online`
                                : `${aiMessages.length - 1} AI conversations`}
                        </div>
                        <button
                            onClick={toggleChat}
                            style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: theme.text,
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            title="Close Panel"
                        >
                            ✕
                        </button>
                    </div>

                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            minHeight: 0,
                        }}
                    >
                        {activePanel === 'chat' ? (
                            <>
                                <div
                                    style={{
                                        flex: 1,
                                        overflowY: 'auto',
                                        backgroundColor: theme.background,
                                        padding: '12px 0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        minHeight: 0,
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
                                            placeholder={
                                                isSocketReady ? 'Type a message...' : 'Connecting...'
                                            }
                                            disabled={!isSocketReady}
                                            rows={1}
                                            style={{
                                                flex: 1,
                                                resize: 'none',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                color: isSocketReady
                                                    ? theme.text
                                                    : theme.textSecondary,
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
                                                backgroundColor:
                                                    chatText.trim() && isSocketReady
                                                        ? theme.accent
                                                        : theme.border,
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '8px 12px',
                                                cursor:
                                                    chatText.trim() && isSocketReady
                                                        ? 'pointer'
                                                        : 'not-allowed',
                                                color:
                                                    chatText.trim() && isSocketReady
                                                        ? '#000'
                                                        : theme.textSecondary,
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
                            </>
                        ) : (
                            <AIAssistant
                                roomId={roomId}
                                username={username}
                                socketRef={socketRef}
                                isSocketReady={isSocketReady}
                                theme={theme}
                                currentCode={
                                    editorRef.current ? editorRef.current.getValue() : ''
                                }
                                currentLanguage={language}
                                aiMessages={aiMessages}
                                setAiMessages={setAiMessages}
                            />
                        )}
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
