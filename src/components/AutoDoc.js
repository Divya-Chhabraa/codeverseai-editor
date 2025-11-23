// src/components/AutoDoc.js
import React, { useState, useEffect } from 'react';
import ACTIONS from '../Actions';

const AutoDoc = ({ 
  currentCode = '', 
  currentLanguage = 'javascript', 
  theme = {}, 
  isDarkMode = true, 
  socketRef, 
  username, 
  roomId,
  isSocketReady = false 
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [documentation, setDocumentation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // ✅ YE WALA LISTENER ZAROOR HONA CHAHIYE
  useEffect(() => {
    if (!socketRef?.current) {
      console.log('❌ No socket ref available');
      return;
    }

    console.log('👂 Setting up AI_DOC_RESULT listener...');

    const handleDocResult = (data) => {
      console.log('📨 Received documentation result:', data);
      setIsGenerating(false);
      
      if (data.error) {
        setError(data.error);
        console.error('❌ Documentation error:', data.error);
      } else {
        setDocumentation(data.documentation);
        console.log('✅ Documentation received and set in state!');
      }
    };

    socketRef.current.on(ACTIONS.AI_DOC_RESULT, handleDocResult);

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.AI_DOC_RESULT, handleDocResult);
      }
    };
  }, [socketRef]);

  // ... rest of your code

  // 🚀 NEW: Socket-based Documentation Request
  const generateDocumentation = () => {
    console.log('📄 Sending doc request with:', {
      roomId,
      username,
      codeLength: codeInput.length,
      language
    });

    if (!codeInput.trim()) return;
    if (!socketRef?.current || !isSocketReady) {
      setError("Socket not connected to AI service");
      return;
    }

    setIsGenerating(true);
    setError('');
    setDocumentation('');

    socketRef.current.emit(ACTIONS.AI_DOC_REQUEST, {
      roomId,
      code: codeInput,
      language,
      username
    });
  };

  const clearAll = () => {
    setCodeInput(currentCode);
    setDocumentation('');
    setError('');
    console.log('🗑️ Cleared all');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(documentation);
    console.log('📋 Copied to clipboard');
  };

  const useCurrentEditorCode = () => {
    setCodeInput(currentCode);
    console.log('📝 Using current editor code:', currentCode?.length || 0, 'chars');
  };

  const handleCodeInputChange = (e) => {
    const newValue = e.target.value;
    setCodeInput(newValue);
  };

  const hasCode = codeInput.trim().length > 0;
  const isButtonDisabled = isGenerating || !hasCode;

  const defaultTheme = {
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
  };

  const currentTheme = { ...defaultTheme, ...theme };

  return (
    <div style={{
      padding: '16px',
      fontFamily: 'Arial, sans-serif',
      color: currentTheme.text,
      height: '100%',
      overflowY: 'auto',
      backgroundColor: currentTheme.background,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        borderBottom: `1px solid ${currentTheme.border}`,
        paddingBottom: '10px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: currentTheme.text }}>
          🤖 AI Documentation Assistant
        </h3>
        <div style={{
          backgroundColor: currentTheme.surfaceSecondary,
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          color: currentTheme.textSecondary
        }}>
          <span>llama-3.1-8b-instant</span>
        </div>
      </div>

      
      {/* Language Selector */}
      {/* ------- UI BELOW UNCHANGED ------ */}

      <div style={{ marginBottom: '12px' }}>
        <label style={{
          display: 'block',
          marginBottom: '5px',
          fontWeight: 'bold',
          fontSize: '13px',
          color: currentTheme.text
        }}>
          Select Language:
        </label>
        <select 
          value={language} 
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            border: `1px solid ${currentTheme.border}`,
            borderRadius: '4px',
            fontSize: '13px',
            backgroundColor: currentTheme.surfaceSecondary,
            color: currentTheme.text
          }}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="typescript">TypeScript</option>
        </select>
      </div>

      {/* Code Input Area */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{
            display: 'block',
            fontWeight: 'bold',
            fontSize: '13px',
            color: currentTheme.text
          }}>
            Code to Document:
          </label>
          <button 
            onClick={useCurrentEditorCode}
            disabled={!currentCode}
            style={{
              padding: '6px 12px',
              border: `1px solid ${currentTheme.border}`,
              borderRadius: '4px',
              cursor: currentCode ? 'pointer' : 'not-allowed',
              fontSize: '11px',
              backgroundColor: currentCode ? currentTheme.accent : currentTheme.border,
              color: currentCode ? '#000' : currentTheme.textSecondary,
              fontWeight: 'bold',
              opacity: currentCode ? 1 : 0.6
            }}
          >
            Use Current Editor Code
          </button>
        </div>
        <textarea
          value={codeInput}
          onChange={handleCodeInputChange}
          placeholder="Paste your code here... or click 'Use Current Editor Code'"
          style={{
            width: '100%',
            padding: '10px',
            border: `1px solid ${currentTheme.border}`,
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'monospace',
            resize: 'vertical',
            backgroundColor: currentTheme.surfaceSecondary,
            color: currentTheme.text,
            minHeight: '120px'
          }}
          rows={6}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button 
          onClick={generateDocumentation}
          disabled={isButtonDisabled}
          style={{
            padding: '12px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            flex: 1,
            fontWeight: 'bold',
            backgroundColor: isButtonDisabled ? currentTheme.border : currentTheme.accent,
            color: isButtonDisabled ? currentTheme.textSecondary : '#000',
            opacity: isButtonDisabled ? 0.6 : 1,
            transition: 'all 0.2s ease'
          }}
        >
          {isGenerating ? '📝 Generating Documentation...' : '✨ Generate Documentation'}
        </button>
        
        <button 
          onClick={clearAll}
          style={{
            padding: '12px 16px',
            border: `1px solid ${currentTheme.border}`,
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            flex: 1,
            backgroundColor: currentTheme.surfaceSecondary,
            color: currentTheme.text
          }}
        >
          🗑️ Clear All
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '12px',
          border: '1px solid #f5c6cb',
          fontSize: '12px'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Documentation Output */}
      {documentation && (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <h4 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 'bold',
              color: currentTheme.text
            }}>
              📚 Generated Documentation:
            </h4>
            <button 
              onClick={copyToClipboard}
              style={{
                padding: '4px 8px',
                border: `1px solid ${currentTheme.border}`,
                borderRadius: '4px',
                backgroundColor: currentTheme.surfaceSecondary,
                color: currentTheme.text,
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              📋 Copy
            </button>
          </div>
          <pre style={{
            backgroundColor: currentTheme.surfaceSecondary,
            padding: '12px',
            borderRadius: '4px',
            border: `1px solid ${currentTheme.border}`,
            whiteSpace: 'pre-wrap',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: currentTheme.text,
            maxHeight: '300px',
            overflowY: 'auto',
            margin: 0
          }}>
            {documentation}
          </pre>
        </div>
      )}

      {/* Mode Indicator */}
      <div style={{
        marginTop: '16px',
        padding: '8px',
        backgroundColor: currentTheme.surfaceSecondary,
        borderRadius: '4px',
        fontSize: '11px',
        textAlign: 'center',
        color: currentTheme.text,
        border: `1px solid ${currentTheme.border}`
      }}>
        <strong>Mode:</strong> Socket Backend AI
      </div>
    </div>
  );
};

export default AutoDoc;
