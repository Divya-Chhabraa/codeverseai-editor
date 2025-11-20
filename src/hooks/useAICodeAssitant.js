import { useState, useCallback, useEffect, useRef } from 'react';

const useAICodeAssistant = (editorRef) => {
    const [selectedCode, setSelectedCode] = useState('');
    const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0, show: false });
    const [isExplaining, setIsExplaining] = useState(false);
    const [explanation, setExplanation] = useState('');
    const [showPopup, setShowPopup] = useState(false);
    
    const selectionRef = useRef(null);

    // Detect text selection in CodeMirror
    const handleTextSelection = useCallback(() => {
        if (!editorRef.current) return;

        const selection = editorRef.current.getSelection();
        
        if (selection && selection.trim().length > 5) { // Minimum 5 characters
            setSelectedCode(selection);
            
            // Get cursor position for button placement
            const cursor = editorRef.current.getCursor();
            const coords = editorRef.current.cursorCoords(cursor, 'window');
            
            setButtonPosition({
                x: coords.right + 10,
                y: coords.top,
                show: true
            });
        } else {
            setButtonPosition(prev => ({ ...prev, show: false }));
            setSelectedCode('');
        }
    }, [editorRef]);

    // Clear selection when clicking elsewhere
    const clearSelection = useCallback(() => {
        setButtonPosition(prev => ({ ...prev, show: false }));
        setSelectedCode('');
    }, []);

    // Get AI explanation
    const getExplanation = useCallback(async () => {
        if (!selectedCode || !editorRef.current) return;
        
        setIsExplaining(true);
        setShowPopup(true);
        setExplanation(''); // Clear previous explanation
        
        try {
            const language = 'javascript'; // You can get this from your editor state
            
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const backendUrl = isLocalhost 
                ? 'http://localhost:5000'
                : 'https://codeverseai-editor-production.up.railway.app';
            
            const response = await fetch(`${backendUrl}/api/explain-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    code: selectedCode,
                    language: language 
                }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                setExplanation(result.explanation);
            } else {
                throw new Error(result.error || 'Failed to get explanation');
            }
        } catch (error) {
            console.error('❌ Error getting AI explanation:', error);
            setExplanation(`❌ Error: ${error.message}\n\nPlease check your backend server and API key configuration.`);
        } finally {
            setIsExplaining(false);
        }
    }, [selectedCode, editorRef]);

    // Set up event listeners
    useEffect(() => {
        if (!editorRef.current) return;

        const editor = editorRef.current;
        
        // Listen for selection changes in CodeMirror
        editor.on('cursorActivity', handleTextSelection);
        
        // Also listen for mouse up (when selection ends)
        const handleMouseUp = () => {
            setTimeout(handleTextSelection, 100); // Small delay to ensure selection is captured
        };
        
        editor.getWrapperElement().addEventListener('mouseup', handleMouseUp);
        
        // Click outside to clear selection
        const handleClickOutside = (e) => {
            if (!editor.getWrapperElement().contains(e.target)) {
                clearSelection();
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            editor.off('cursorActivity', handleTextSelection);
            editor.getWrapperElement().removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editorRef, handleTextSelection, clearSelection]);

    return {
        selectedCode,
        buttonPosition,
        isExplaining,
        explanation,
        showPopup,
        getExplanation,
        setShowPopup,
        clearSelection
    };
};

export default useAICodeAssistant;