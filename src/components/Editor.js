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
import AIAssistant from './AIAssistant';
import PanelSwitcher from './PanelSwitcher';
import DebugAssistant from './DebugAssistant';
import AutoDoc from './AutoDoc';

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
    const [activeBottomTab, setActiveBottomTab] = useState('terminal');
    const [terminalHeight, setTerminalHeight] = useState(200);
    const [isResizing, setIsResizing] = useState(false);
    const [activePanel, setActivePanel] = useState('chat');
    const [aiMessages, setAiMessages] = useState([]);
    const [terminalFontSize, setTerminalFontSize] = useState(13);
    const [copyPopup, setCopyPopup] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    // Sync states
    const [initialCodeReceived, setInitialCodeReceived] = useState(false);
    const [initialOutputReceived, setInitialOutputReceived] = useState(false);

    // Extract filename from URL parameters
    const getFilenameFromUrl = () => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('filename') || 'Untitled';
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // If timestamp is a number, convert to Date
        if (typeof timestamp === 'number') {
            return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // If it's already a string, return as is
        if (typeof timestamp === 'string') {
            return timestamp;
        }
        
        // Default fallback
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };


    const [currentFilename] = useState(getFilenameFromUrl());

    /* ---------------- TERMINAL RESIZE HANDLER ---------------- */
    const handleResizeMouseDown = (e) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight >= 100 && newHeight <= 500) {
                setTerminalHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    /* ---------------- BACKEND URL + FILE LOAD/SAVE HELPERS ---------------- */
    const getBackendUrl = () => {
        const isLocalhost =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        return isLocalhost
            ? 'http://localhost:5000'
            : 'https://codeverseai-editor-production.up.railway.app';
    };
    const downloadCodeFile = () => {
        if (!editorRef.current) return;

        const code = editorRef.current.getValue();
        if (!code.trim()) {
            alert("No code to download!");
            return;
        }

        const extMap = {
            javascript: "js",
            python: "py",
            cpp: "cpp",
            java: "java",
            typescript: "ts",
        };

        const extension = extMap[language] || "txt";
        const filename = `code.${extension}`;

        const blob = new Blob([code], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        };

    const saveFileToServer = async () => {
        if (!editorRef.current) return;
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

    /* ---------------- SOCKET CONNECTION MONITORING ---------------- */
    useEffect(() => {
        if (!socketRef.current) return;

        const socket = socketRef.current;
        
        setIsSocketReady(socket.connected);

        const handleConnect = () => {
            setIsSocketReady(true);
        };

        const handleDisconnect = () => {
            setIsSocketReady(false);
        };

        const handleConnectError = (error) => {
            setIsSocketReady(false);
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

        const loadFileFromServer = async () => {
            try {
                const backendUrl = getBackendUrl();
                const res = await fetch(`${backendUrl}/api/file/${currentRoomId}`);
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
        };
        
        setTimeout(() => {
            const textarea = document.getElementById('realtimeEditor');
            if (!textarea) return;

            editorRef.current = Codemirror.fromTextArea(textarea, {
                mode: language,
                theme: currentIsDarkMode ? 'dracula' : 'default',
                autoCloseTags: true,
                autoCloseBrackets: true,
                lineNumbers: true,
                lineWrapping: true,
                scrollbarStyle: 'native',
                value: ""
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
            loadFileFromServer();

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
    }, [isDarkMode, onCodeChange, roomId, socketRef]);

    /* ---------------- UPDATE CODEMIRROR MODE WHEN LANGUAGE CHANGES ---------------- */
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
        
        editorRef.current.setOption('mode', mode);
    }, [language]);

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
                const isDuplicate = prev.some(m => 
                    m.id === message.id || 
                    (m.text === message.text && 
                     m.sender === message.sender && 
                     Math.abs(m.timestamp - message.timestamp) < 5000)
                );
                
                if (isDuplicate) return prev;
                return [...prev, message];
            });
        };

        if (chatMessages.length === 0) {
            const welcomeMessage = {
                id: Date.now(),
                text: 'Welcome to CodeVerse AI! Start coding collaboratively...',
                sender: 'System',
                timestamp: Date.now(), // Add timestamp
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setChatMessages([welcomeMessage]);
        }

        const handleAiMessage = (message) => {
            setAiMessages((prev) => {
                const isDuplicate = prev.some(m => 
                    m.id === message.id || 
                    (m.text === message.text && m.sender === message.sender && Math.abs(m.timestamp - message.timestamp) < 5000)
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
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setChatMessages([welcomeMessage]);
        }

        if (aiMessages.length === 0) {
            const aiWelcomeMessage = {
                id: Date.now() + 1,
                text: "Hello! I'm your AI coding assistant. I can help explain code, debug issues, suggest improvements, and answer programming questions. What would you like to know?",
                sender: 'AI Assistant',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: Date.now(),
                isAi: true
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
    }, [socketRef, chatMessages, username, aiMessages.length, roomId, isSocketReady, initialCodeReceived, initialOutputReceived]);

    useEffect(() => {
        if (activePanel === 'assistant' && socketRef.current && isSocketReady && roomId) {
            socketRef.current.emit(ACTIONS.AI_HISTORY_REQUEST, { roomId });
        }
    }, [activePanel, socketRef, isSocketReady, roomId]);

    useEffect(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    useEffect(() => {
        if (terminalInputRef.current && isTerminalOpen) {
            terminalInputRef.current.focus();
        }
    }, [output, isTerminalOpen]);

    /* ---------------- HANDLE LANGUAGE CHANGE ---------------- */
    const handleLanguageChange = (e) => {
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

    /* ---------------- Chat input handler ---------------- */
    const handleChatInputChange = (e) => {
        setChatText(e.target.value);
    };

    /* ---------------- Chat send handler ---------------- */
    const sendChatMessage = () => {
        if (!chatText.trim() || !socketRef.current || !isSocketReady) return;

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
        const displayTime = formatTime(message.timestamp || message.time);
        
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
        background: isDarkMode ? '#0a0f1c' : '#f8f9fa',
        surface: isDarkMode ? '#0f172a' : '#ffffff',
        surfaceSecondary: isDarkMode ? '#1e293b' : '#f1f3f5',
        text: isDarkMode ? '#f8fafc' : '#2f3542',
        textSecondary: isDarkMode ? '#94a3b8' : '#747d8c',
        border: isDarkMode ? '#334155' : '#dee2e6',
        accent: '#8b5cf6',
        success: '#10b981',
        terminalBg: isDarkMode ? '#020617' : '#ffffff',
        terminalText: isDarkMode ? '#f8fafc' : '#2f3542',
        chatBg: isDarkMode ? '#0a0f1c' : '#ffffff',
        chatSurface: isDarkMode ? '#0f172a' : '#f8f9fa',
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
                position: 'relative',
            }}
        >
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
                opacity: 0.4,
                zIndex: 0
            }}></div>

            {/* Floating Code Icons */}
            <div style={{
                position: 'absolute',
                top: '10%',
                left: '5%',
                fontSize: '24px',
                opacity: 0.05,
                zIndex: 0
            }}>{'</>'}</div>

            <div style={{
                position: 'absolute',
                top: '80%',
                right: '10%',
                fontSize: '20px',
                opacity: 0.05,
                zIndex: 0
            }}>{'{}'}</div>

            <div style={{
                position: 'absolute',
                top: '20%',
                right: '15%',
                fontSize: '18px',
                opacity: 0.04,
                zIndex: 0
            }}>{'<>'}</div>

            <div style={{
                position: 'absolute',
                bottom: '15%',
                left: '10%',
                fontSize: '22px',
                opacity: 0.05,
                zIndex: 0
            }}>{'()'}</div>

            {/* MAIN AREA (editor + terminal) */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    position: 'relative',
                    zIndex: 1,
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
                        position: 'relative',
                        zIndex: 2,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Filename Display */}
                        <div
                            style={{
                                fontSize: '14px',
                                color: theme.accent,
                                backgroundColor: `${theme.accent}20`,
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            📄 {currentFilename}
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
                                        backgroundColor: '#ef4444',
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
                        {/* FULL SCREEN TOGGLE */}
                        <button
                            onClick={() => setIsFullScreen(!isFullScreen)}
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
                                fontSize: '16px',
                            }}
                            title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
                        >
                            {isFullScreen ? '📱' : '🖥️'}
                        </button>

                        {/* SAVE BUTTON */}
                        <button
                            onClick={saveFileToServer}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                backgroundColor: theme.success,
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
                                color: '#fff',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                        >
                            {isRunning ? (
                                <>
                                    <div style={{ width: '12px', height: '12px', border: '2px solid transparent', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                    Running...
                                </>
                            ) : (
                                <>
                                    ▶ Run
                                </>
                            )}
                        </button>
                        <button
                        onClick={downloadCodeFile}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            backgroundColor: theme.accent,
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            color: '#fff',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = theme.success)}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = theme.accent)}
                        >
                        📥 Download
                        </button>


                    </div>
                </div>

                {/* Editor - Scrollable with Real-time Sync */}
                <div style={{ 
                flex: isFullScreen ? 0 : 1,  // ← Full screen mein 0, normal mein 1
                height: isFullScreen ? '0px' : 'auto',  // ← Height control
                overflow: 'auto',
                position: 'relative',
                transition: 'all 0.3s ease',
                }}>
                <textarea id="realtimeEditor"></textarea>
                </div>          

                {/* COLLAPSIBLE TERMINAL WITH TABS AND RESIZE */}
                {(isTerminalOpen || isFullScreen) && (
                    <div
                        style={{
                            backgroundColor: theme.background,
                            borderTop: `1px solid ${theme.border}`,
                            height: isFullScreen ? '100vh' : `${terminalHeight}px`,
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                        }}
                    >
                        {/* RESIZE HANDLE */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '-4px',
                                left: 0,
                                right: 0,
                                height: '8px',
                                cursor: 'row-resize',
                                backgroundColor: 'transparent',
                                zIndex: 10,
                            }}
                            onMouseDown={handleResizeMouseDown}
                        />

                        {/* Terminal Header with Tabs */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0px',
                                backgroundColor: isDarkMode ? '#1e293b' : '#e9ecef',
                                borderBottom: `1px solid ${theme.border}`,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <div className="terminal-tabs" style={{ display: 'flex', flex: 1 }}>
                                    <button
                                        className={`tab ${activeBottomTab === 'terminal' ? 'active' : ''}`}
                                        onClick={() => setActiveBottomTab('terminal')}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'none',
                                            border: 'none',
                                            borderRight: `1px solid ${theme.border}`,
                                            cursor: 'pointer',
                                            color: theme.text,
                                            transition: 'background-color 0.2s',
                                            backgroundColor: activeBottomTab === 'terminal' ? theme.terminalBg : 'transparent',
                                            borderBottom: activeBottomTab === 'terminal' ? `2px solid ${theme.accent}` : 'none',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            flex: 1,
                                        }}
                                    >
                                        TERMINAL
                                    </button>
                                    <button
                                        className={`tab ${activeBottomTab === 'ai' ? 'active' : ''}`}
                                        onClick={() => setActiveBottomTab('ai')}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'none',
                                            border: 'none',
                                            borderRight: `1px solid ${theme.border}`,
                                            cursor: 'pointer',
                                            color: theme.text,
                                            transition: 'background-color 0.2s',
                                            backgroundColor: activeBottomTab === 'ai' ? theme.terminalBg : 'transparent',
                                            borderBottom: activeBottomTab === 'ai' ? `2px solid ${theme.accent}` : 'none',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            flex: 1,
                                        }}
                                    >
                                        AI DEBUG ASSISTANT
                                    </button>
                                    <button
                                        className={`tab ${activeBottomTab === 'input' ? 'active' : ''}`}
                                        onClick={() => setActiveBottomTab('input')}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: theme.text,
                                            transition: 'background-color 0.2s',
                                            backgroundColor: activeBottomTab === 'input' ? theme.terminalBg : 'transparent',
                                            borderBottom: activeBottomTab === 'input' ? `2px solid ${theme.accent}` : 'none',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            flex: 1,
                                        }}
                                    >
                                        AI DOCUMENTATION 
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
                                {/* FULL SCREEN BUTTON - YEH ADD KARO */}
                                <button
                                    onClick={() => setIsFullScreen(!isFullScreen)}
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
                                    title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
                                >
                                    {isFullScreen ? '📱 Exit Full' : '🖥️ Full Screen'}
                                </button>
                                
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

                        {/* Terminal Content Area */}
                        <div
                        style={{
                            flex: 1,
                            backgroundColor: theme.terminalBg,
                            position: 'relative',
                            overflow: 'hidden',
                            fontFamily: 'Monaco, "Courier New", monospace',
                            fontSize: '13px',
                            zIndex: 9999,
                        }}
                        >


                            {/* TERMINAL Tab */}
                            <div
                                style={{
                                    display: activeBottomTab === 'terminal' ? 'flex' : 'none',
                                    flexDirection: 'column',
                                    height: '100%',
                                    width: '100%',
                                    overflow: 'auto',
                                }}
                            >
                                {/* ⬇️ Your entire TERMINAL UI code (unchanged) */}
                                <div className="terminal-output">

                                    <div style={{
                                        position: 'relative',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 16px',
                                        backgroundColor: isDarkMode ? '#0a0a0f' : '#f8f9fa',
                                        borderBottom: `1px solid ${theme.border}`
                                    }}>
                                        <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                                            Terminal Output
                                        </span>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <button
                                                onClick={() => setTerminalFontSize(size => Math.max(10, size - 1))}
                                                style={{
                                                    padding: '2px 6px',
                                                    fontSize: '12px',
                                                    borderRadius: '4px',
                                                    border: `1px solid ${theme.border}`,
                                                    backgroundColor: theme.surfaceSecondary,
                                                    color: theme.text,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Size -
                                            </button>
                                            <button
                                                onClick={() => setTerminalFontSize(size => Math.min(40, size + 1))}
                                                style={{
                                                    padding: '2px 6px',
                                                    fontSize: '12px',
                                                    borderRadius: '4px',
                                                    border: `1px solid ${theme.border}`,
                                                    backgroundColor: theme.surfaceSecondary,
                                                    color: theme.text,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Size +
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (output) {
                                                        navigator.clipboard.writeText(output);
                                                        setCopyPopup(true);
                                                        setTimeout(() => setCopyPopup(false), 1500);
                                                    }
                                                }}
                                                disabled={!output}
                                                style={{
                                                    padding: '4px 8px',
                                                    border: `1px solid ${theme.border}`,
                                                    borderRadius: '4px',
                                                    backgroundColor: theme.surfaceSecondary,
                                                    color: theme.text,
                                                    cursor: output ? 'pointer' : 'not-allowed',
                                                    fontSize: '11px',
                                                    opacity: output ? 1 : 0.5
                                                }}
                                            >
                                                📋 Copy
                                            </button>
                                        </div>

                                        {copyPopup && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '40px',
                                                    right: '16px',
                                                    backgroundColor: theme.accent,
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '10px',
                                                    color: '#000',
                                                    fontWeight: 'bold',
                                                    boxShadow: '0px 2px 6px rgba(0,0,0,0.3)',
                                                    zIndex: 10
                                                }}
                                            >
                                                ✔ Copied!
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            flex: 1,
                                            padding: '12px 16px',
                                            overflowY: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            color: theme.terminalText,
                                            lineHeight: '1.4',
                                            fontSize: `${terminalFontSize}px`,
                                        }}
                                    >
                                        {output ? (
                                            <div style={{ marginBottom: '8px' }}>
                                                {output}
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
                                            backgroundColor: isDarkMode ? '#0f172a' : '#f8f9fa',
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

                            {/* AI DEBUG ASSISTANT */}
                            <div
                                style={{
                                    display: activeBottomTab === 'ai' ? 'flex' : 'none',
                                    flexDirection: 'column',
                                    height: '100%',
                                    width: '100%',
                                    overflow: 'auto',
                                }}
                            >
                                <DebugAssistant 
                                    terminalFontSize={terminalFontSize}
                                    currentCode={editorRef.current ? editorRef.current.getValue() : ''}
                                    currentLanguage={language}
                                    terminalOutput={output}
                                    theme={theme}
                                    isDarkMode={isDarkMode}
                                />
                            </div>

                            {/* AI DOCUMENTATION */}
                            <div
                                style={{
                                    visibility: activeBottomTab === 'input' ? 'visible' : 'hidden',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    width: '100%',
                                    overflow: 'auto',
                                }}
                            >
                                <AutoDoc 
                                    terminalFontSize={terminalFontSize}
                                    currentCode={editorRef.current ? editorRef.current.getValue() : ''}
                                    currentLanguage={language}
                                    theme={theme}
                                    isDarkMode={isDarkMode}
                                    socketRef={socketRef}
                                    username={username}
                                    roomId={roomId}
                                    isSocketReady={isSocketReady}
                                />
                            </div>

                        </div>

                    </div>
                )}
            </div>

            {/* RIGHT PANEL - Switches between Chat and AI Assistant */}
            { isChatOpen && (
                <div
                    style={{
                        width: '320px',
                        borderLeft: `1px solid ${theme.border}`,
                        backgroundColor: theme.chatBg,
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0,
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {/* Panel Switcher */}
                    <PanelSwitcher
                        activePanel={activePanel}
                        setActivePanel={setActivePanel}
                        theme={theme}
                        chatMessages={chatMessages}
                        aiMessages={aiMessages}
                    />

                    {/* Close Button */}
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
                            {activePanel === 'chat' ?
                                `${chatMessages.length - 1} messages • Online` :
                                `${aiMessages.length - 1} AI conversations`
                            }
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

                    {/* Dynamic Panel Content */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        minHeight: 0,
                    }}>
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
                                                color: (chatText.trim() && isSocketReady) ? '#fff' : theme.textSecondary,
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
                                currentCode={editorRef.current ? editorRef.current.getValue() : ''}
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