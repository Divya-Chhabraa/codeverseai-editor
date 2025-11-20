import React, { useState, useRef, useEffect } from 'react';
import ACTIONS from '../Actions';

const AIAssistant = ({ 
  roomId, 
  username, 
  socketRef, 
  isSocketReady, 
  theme,
  currentCode,
  currentLanguage,
  aiMessages,
  setAiMessages
}) => {
  const [aiInput, setAiInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const aiMessagesEndRef = useRef(null);

  // Initialize with natural welcome message
  useEffect(() => {
    if (aiMessages.length === 0) {
      const welcomeMessage = {
        id: Date.now(),
        text: "Hey there! 👋 I'm your coding assistant. What would you like to build today?",
        sender: 'AI Assistant',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        isAi: true
      };
      setAiMessages([welcomeMessage]);
    }
  }, [aiMessages.length, setAiMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // Listen for AI messages from other users
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    const handleAiMessage = (message) => {
      setAiMessages((prev) => {
        const isDuplicate = prev.some(m => 
          m.id === message.id || 
          (m.text === message.text && m.sender === message.sender && Math.abs(m.timestamp - message.timestamp) < 5000)
        );
        
        if (isDuplicate) return prev;
        return [...prev, message];
      });

      if (message.isAi) {
        setIsAiThinking(false);
      }
    };

    socket.on(ACTIONS.AI_MESSAGE, handleAiMessage);
    
    // Listen for history sync
    const handleAiHistorySync = ({ messages }) => {
      console.log('📋 Received AI history:', messages.length, 'messages');
      setAiMessages(messages);
    };

    socket.on(ACTIONS.AI_HISTORY_SYNC, handleAiHistorySync);

    return () => {
      socket.off(ACTIONS.AI_MESSAGE, handleAiMessage);
      socket.off(ACTIONS.AI_HISTORY_SYNC, handleAiHistorySync);
    };
  }, [socketRef, setAiMessages]);

  // Send message
  const sendAiMessage = async () => {
    if (!aiInput.trim() || !socketRef.current || !isSocketReady) return;

    const userMessage = {
      id: Date.now() + Math.random(),
      text: aiInput.trim(),
      sender: username,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      isAi: false
    };

    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setIsAiThinking(true);

    // Broadcast user message
    try {
      socketRef.current.emit(ACTIONS.AI_MESSAGE, {
        roomId,
        message: userMessage
      });
    } catch (error) {
      console.error('Error broadcasting message:', error);
    }

    // Send to AI API
    try {
  // Get the correct backend URL for production
  const getBackendUrl = () => {
    // If we're in development (localhost)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    // If we're in production - REPLACE THIS WITH YOUR ACTUAL RAILWAY URL
    return 'https://codeverseai-editor-production.up.railway.app';
  };

  const backendUrl = getBackendUrl();
  const response = await fetch(`${backendUrl}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: aiInput.trim(),
          code: currentCode,
          language: currentLanguage,
          roomId: roomId
        }),
      });

      if (!response.ok) throw new Error('API request failed');
      const result = await response.json();
      
      const aiResponse = {
        id: Date.now() + Math.random(),
        text: result.response,
        sender: 'AI Assistant',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        isAi: true
      };

      setAiMessages(prev => [...prev, aiResponse]);
      setIsAiThinking(false);

      // Broadcast AI response
      socketRef.current.emit(ACTIONS.AI_MESSAGE, {
        roomId,
        message: aiResponse
      });

    } catch (error) {
      console.error('AI error:', error);
      const errorMessage = {
        id: Date.now() + Math.random(),
        text: "Sorry, I'm having trouble connecting right now. Please try again! 🔄",
        sender: 'AI Assistant',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        isAi: true
      };
      setAiMessages(prev => [...prev, errorMessage]);
      setIsAiThinking(false);
    }
  };

  const handleAiInputChange = (e) => setAiInput(e.target.value);
  const handleAiKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAiMessage();
    }
  };

  // Simple Code Block Component
  const CodeBlock = ({ code, language, theme }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    return (
      <div
        style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '8px',
          margin: '8px 0',
          overflow: 'hidden',
        }}
      >
        {/* Code Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 12px',
            backgroundColor: theme.surfaceSecondary,
            borderBottom: `1px solid ${theme.border}`,
            fontSize: '11px',
            fontWeight: 'bold',
          }}
        >
          <span style={{ color: theme.text, textTransform: 'uppercase' }}>
            {language || 'code'}
          </span>
          <button
            onClick={copyToClipboard}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.accent,
              cursor: 'pointer',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {copied ? '✅' : '📋'}
          </button>
        </div>
        
        {/* Code Content */}
        <pre
          style={{
            margin: 0,
            padding: '12px',
            fontSize: '13px',
            fontFamily: 'Monaco, "Courier New", monospace',
            color: theme.text,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4',
            backgroundColor: theme.surface,
          }}
        >
          <code>{code}</code>
        </pre>
      </div>
    );
  };

  // Message Component - Same as Chat
  const AIMessage = ({ message }) => {
    const isUser = message.sender === username;
    
    // Format message with code blocks
    const formatMessage = (text) => {
      if (!text) return text;
      
      const parts = text.split(/(```[\w]*\n[\s\S]*?\n```)/g);
      
      return parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const codeMatch = part.match(/```(\w*)\n([\s\S]*?)\n```/);
          if (codeMatch) {
            const [, language, code] = codeMatch;
            return (
              <CodeBlock 
                key={index}
                code={code} 
                language={language || 'text'}
                theme={theme}
              />
            );
          }
        }
        return (
          <div key={index} style={{ 
            marginBottom: '8px', 
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4',
          }}>
            {part}
          </div>
        );
      });
    };

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: '8px',
          padding: '0 8px',
        }}
      >
        <div
          style={{
            maxWidth: '85%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          {!isUser && (
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px', color: theme.accent }}>
              {message.sender}
            </div>
          )}
          
          <div
            style={{
              backgroundColor: isUser ? theme.accent : theme.surfaceSecondary,
              color: isUser ? '#000' : theme.text,
              padding: '8px 12px',
              borderRadius: '12px',
              borderTopRightRadius: isUser ? '4px' : '12px',
              borderTopLeftRadius: isUser ? '12px' : '4px',
              wordBreak: 'break-word',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              border: isUser ? 'none' : `1px solid ${theme.border}`,
            }}
          >
            <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
              {formatMessage(message.text)}
            </div>
            
            <div
              style={{
                fontSize: '10px',
                color: isUser ? 'rgba(0,0,0,0.6)' : theme.textSecondary,
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
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.chatBg,
      }}
    >
      {/* SIMPLIFIED - No extra headers, just messages and input */}

      {/* Messages Area - Same as Chat */}
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
        {aiMessages.map((message) => (
          <AIMessage key={message.id} message={message} />
        ))}
        
        {/* Thinking Indicator */}
        {isAiThinking && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '8px',
              padding: '0 8px',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px', color: theme.accent }}>
                AI Assistant
              </div>
              <div
                style={{
                  backgroundColor: theme.surfaceSecondary,
                  color: theme.text,
                  padding: '8px 12px',
                  borderRadius: '12px',
                  borderTopLeftRadius: '4px',
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontStyle: 'italic',
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid transparent',
                    borderTop: '2px solid #50fa7b',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}
                />
                Thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={aiMessagesEndRef} />
      </div>

      {/* Input Area - Same as Chat */}
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
            value={aiInput}
            onChange={handleAiInputChange}
            onKeyDown={handleAiKeyDown}
            placeholder={isSocketReady ? "Ask AI about code..." : "Connecting..."}
            disabled={!isSocketReady || isAiThinking}
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
            onClick={sendAiMessage}
            disabled={!aiInput.trim() || !isSocketReady || isAiThinking}
            style={{
              backgroundColor: (aiInput.trim() && isSocketReady && !isAiThinking) ? '#50fa7b' : theme.border,
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              cursor: (aiInput.trim() && isSocketReady && !isAiThinking) ? 'pointer' : 'not-allowed',
              color: (aiInput.trim() && isSocketReady && !isAiThinking) ? '#000' : theme.textSecondary,
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease',
            }}
          >
            {isAiThinking ? '...' : 'Ask'}
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

export default AIAssistant;