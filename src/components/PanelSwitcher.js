import React from 'react';

const PanelSwitcher = ({ activePanel, setActivePanel, theme, chatMessages, aiMessages }) => {
  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: theme.surface,
        borderBottom: `1px solid ${theme.border}`,
        padding: '0',
      }}
    >
      <button
        onClick={() => setActivePanel('chat')}
        style={{
          flex: 1,
          padding: '12px 16px',
          backgroundColor: activePanel === 'chat' ? theme.accent : 'transparent',
          border: 'none',
          color: activePanel === 'chat' ? '#000' : theme.text,
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
          borderRight: `1px solid ${theme.border}`,
        }}
      >
        💬 Room Chat
        {chatMessages.length > 1 && (
          <span
            style={{
              backgroundColor: activePanel === 'chat' ? '#000' : theme.accent,
              color: activePanel === 'chat' ? theme.accent : '#000',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
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
        onClick={() => setActivePanel('assistant')}
        style={{
          flex: 1,
          padding: '12px 16px',
          backgroundColor: activePanel === 'assistant' ? '#50fa7b' : 'transparent',
          border: 'none',
          color: activePanel === 'assistant' ? '#000' : theme.text,
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
        }}
      >
        🤖 AI Assistant
        {aiMessages.length > 1 && (
          <span
            style={{
              backgroundColor: activePanel === 'assistant' ? '#000' : '#50fa7b',
              color: activePanel === 'assistant' ? '#50fa7b' : '#000',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
            }}
          >
            {aiMessages.length - 1}
          </span>
        )}
      </button>
    </div>
  );
};

export default PanelSwitcher;