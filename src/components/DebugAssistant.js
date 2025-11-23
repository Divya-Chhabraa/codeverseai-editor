// src/components/DebugAssistant.js
import React, { useState } from 'react';

const DebugAssistant = ({ 
  currentCode, 
  currentLanguage, 
  terminalOutput, 
  theme, 
  isDarkMode 
}) => {
  const [debugQuestion, setDebugQuestion] = useState('');
  const [debugResult, setDebugResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentModel, setCurrentModel] = useState('llama-3.1-8b-instant');

  const analyzeWithAI = async () => {
    if (!debugQuestion.trim() && !terminalOutput) {
      setDebugResult('❌ Please enter a question or run code to see errors first.');
      return;
    }

    setIsAnalyzing(true);
    setDebugResult('');

    try {
      const userContent = `
Focus ONLY on errors and solutions for this ${currentLanguage} code:

CODE:
${currentCode}

ERROR OUTPUT: 
${terminalOutput || 'No specific error'}

USER QUESTION: ${debugQuestion || 'Find and fix errors'}

IMPORTANT: Be very concise. Only provide:
1. Specific errors found (if any)
2. Exact fixes needed
3. Minimal code corrections

Do NOT explain what the code does.
Do NOT give general programming advice.
Do NOT provide lengthy explanations.
Keep response under 200 words.
      `.trim();

      const requestBody = {
        model: currentModel,
        messages: [
          {
            role: 'system',
            content: `You are a code debugger. Be extremely concise. Only identify errors and provide direct fixes. No explanations, no fluff. Maximum 3-4 sentences.`
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        temperature: 0.1, // Lower temperature for more focused responses
        max_tokens: 300,  // Limit response length
        top_p: 0.9,
        stream: false
      };

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API error! status: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.choices[0]?.message?.content || 'No analysis generated.';
      setDebugResult(analysis);
      
    } catch (err) {
      console.error('Debug analysis error:', err);
      setDebugResult(`❌ Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const autoAnalyzeError = async () => {
    if (!terminalOutput) {
      setDebugResult('❌ No terminal output to analyze. Run your code first.');
      return;
    }

    setDebugQuestion('Find and fix the exact error shown in terminal');
    setTimeout(() => {
      analyzeWithAI();
    }, 100);
  };

  
  const handleModelChange = (e) => {
    setCurrentModel(e.target.value);
  };

  return (
    <div className="ai-debug-assistant" style={{ 
      flex: 1, 
      padding: '16px', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <h3 style={{ color: theme.accent, marginBottom: '12px', fontSize: '14px' }}>
        🤖 AI Debug Assistant
      </h3>
      
      {/* Model Selector */}
      <div style={{ marginBottom: '12px' }}>
        <select
          value={currentModel}
          onChange={handleModelChange}
          style={{
            width: '100%',
            backgroundColor: isDarkMode ? '#1a1b26' : '#ffffff',
            color: theme.terminalText,
            border: `1px solid ${theme.border}`,
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            outline: 'none'
          }}
        >
          <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
          <option value="llama-3.2-1b-preview">Llama 3.2 1B Preview</option>
          <option value="llama-3.2-3b-preview">Llama 3.2 3B Preview</option>
          <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
        </select>
      </div>

      {/* Debug Input Area */}
      <div style={{ marginBottom: '16px' }}>
        <textarea
          value={debugQuestion}
          onChange={(e) => setDebugQuestion(e.target.value)}
          placeholder="Describe the specific error or issue..."
          style={{
            width: '100%',
            height: '60px',
            backgroundColor: isDarkMode ? '#1a1b26' : '#ffffff',
            color: theme.terminalText,
            border: `1px solid ${theme.border}`,
            borderRadius: '6px',
            padding: '12px',
            fontFamily: 'inherit',
            fontSize: '13px',
            resize: 'none',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={analyzeWithAI}
            disabled={isAnalyzing}
            style={{
              padding: '8px 16px',
              backgroundColor: isAnalyzing ? theme.border : theme.accent,
              border: 'none',
              borderRadius: '6px',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              color: '#000',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isAnalyzing ? '🔍 Fixing...' : 'Ask AI'}
          </button>
          <button
            onClick={autoAnalyzeError}
            disabled={!terminalOutput}
            style={{
              padding: '8px 16px',
              backgroundColor: terminalOutput ? '#50fa7b' : theme.border,
              border: 'none',
              borderRadius: '6px',
              cursor: terminalOutput ? 'pointer' : 'not-allowed',
              color: '#000',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Auto Analyze Code
          </button>
          
        </div>
      </div>

      {/* Debug Results */}
      <div style={{
        flex: 1,
        backgroundColor: isDarkMode ? '#1a1b26' : '#ffffff',
        border: `1px solid ${theme.border}`,
        borderRadius: '6px',
        padding: '12px',
        overflowY: 'auto',
        fontSize: '12px',
        lineHeight: '1.5'
      }}>
        {debugResult ? (
          <div style={{ whiteSpace: 'pre-wrap', color: theme.terminalText }}>
            {debugResult}
          </div>
        ) : (
          <div style={{ 
            color: theme.textSecondary, 
            textAlign: 'center',
            fontStyle: 'italic',
            marginTop: '20px'
          }}>
            {isAnalyzing ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid transparent', 
                  borderTop: `2px solid ${theme.accent}`, 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }} />
                Finding and fixing errors...
              </div>
            ) : (
              <div>
                Quick error detection and fixes
                <div style={{ fontSize: '10px', marginTop: '8px' }}>
                  • Fix Errors: Custom question
                  • Auto-Fix: Uses terminal output  
                  • Quick Scan: Fast syntax check
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div style={{ 
        marginTop: '12px', 
        padding: '8px 12px', 
        backgroundColor: isDarkMode ? '#1a1b26' : '#f1f3f5', 
        borderRadius: '6px',
        fontSize: '11px',
        color: theme.textSecondary
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            Mode: <span style={{ color: theme.accent }}>Ask AI</span>
          </span>
          <span>
            Model: <span style={{ color: theme.accent }}>{currentModel.split('-')[0]}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default DebugAssistant;