import React, { useEffect, useRef, useState } from 'react';
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/clike/clike';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import ACTIONS from '../Actions';

const Editor = ({ socketRef, roomId, onCodeChange }) => {
    const editorRef = useRef(null);
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [language, setLanguage] = useState('javascript');
    const [userInput, setUserInput] = useState('');

    /* ---------------- Initialize CodeMirror ---------------- */
    useEffect(() => {
        editorRef.current = Codemirror.fromTextArea(
            document.getElementById('realtimeEditor'),
            {
                mode: { name: language },
                theme: 'dracula',
                autoCloseTags: true,
                autoCloseBrackets: true,
                lineNumbers: true,
            }
        );

        editorRef.current.on('change', (instance, changes) => {
            const { origin } = changes;
            const code = instance.getValue();
            onCodeChange(code);
            if (origin !== 'setValue') {
                socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                    roomId,
                    code,
                });
            }
        });
    }, []);

    /* ---------------- Change mode dynamically ---------------- */
    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.setOption('mode', { name: language });
        }
    }, [language]);

    /* ---------------- Socket event listeners ---------------- */
    useEffect(() => {
        if (socketRef.current) {
            // 🔹 Code sync
            socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
                if (code !== null && code !== editorRef.current.getValue()) {
                    editorRef.current.setValue(code);
                }
            });

            // 🔹 Language sync
            socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, ({ language }) => {
                setLanguage(language);
            });

            // 🔹 Output sync
            socketRef.current.on(ACTIONS.RUN_OUTPUT, ({ output }) => {
                setOutput(output);
            });

            // 🔹 Input box sync
            socketRef.current.on(ACTIONS.INPUT_CHANGE, ({ input }) => {
                setUserInput(input);
            });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.off(ACTIONS.CODE_CHANGE);
                socketRef.current.off(ACTIONS.LANGUAGE_CHANGE);
                socketRef.current.off(ACTIONS.RUN_OUTPUT);
                socketRef.current.off(ACTIONS.INPUT_CHANGE);
            }
        };
    }, [socketRef.current]);

    /* ---------------- Handle language change ---------------- */
    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
        socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, {
            roomId,
            language: newLang,
        });
    };

    /* ---------------- Run code via backend ---------------- */
    const runCode = async () => {
        setIsRunning(true);
        const code = editorRef.current.getValue();
        try {
            const response = await fetch('/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language, input: userInput }),
            });
            const result = await response.json();
            const outputText = result.output || result.error || 'No output';
            setOutput(outputText);

            // Broadcast output to other users
            socketRef.current.emit(ACTIONS.RUN_OUTPUT, {
                roomId,
                output: outputText,
            });
        } catch (err) {
            setOutput('Error running code');
        } finally {
            setIsRunning(false);
        }
    };

    /* ---------------- UI ---------------- */
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                backgroundColor: '#1e1f29',
                color: 'white',
                overflow: 'hidden',
            }}
        >
            {/* Top bar */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 20px',
                    backgroundColor: '#282a36',
                    borderBottom: '1px solid #444',
                }}
            >
                <h3>Codeverse AI ⚡</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <select
                        value={language}
                        onChange={handleLanguageChange}
                        style={{
                            backgroundColor: '#444',
                            color: 'white',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="cpp">C++</option>
                        <option value="java">Java</option>
                    </select>

                    <button
                        onClick={runCode}
                        disabled={isRunning}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            backgroundColor: '#61dafb',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            color: '#000',
                        }}
                    >
                        {isRunning ? 'Running...' : '▶ Run'}
                    </button>
                </div>
            </div>

            {/* Editor */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                <textarea id="realtimeEditor"></textarea>
            </div>

            {/* Input + Output area side-by-side */}
            <div
                style={{
                    display: 'flex',
                    backgroundColor: '#1e1f29',
                    borderTop: '2px solid #61dafb',
                    padding: '15px 20px',
                    gap: '30px',
                    height: '200px',
                    boxSizing: 'border-box',
                }}
            >
                {/* Input Section */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                    }}
                >
                    <label
                        style={{
                            color: '#00ffc8',
                            fontWeight: 'bold',
                            marginBottom: '6px',
                            fontSize: '15px',
                        }}
                    >
                        🧾 Input
                    </label>
                    <textarea
                        placeholder="✏️ Type your input here (e.g., 7)"
                        value={userInput}
                        onChange={(e) => {
                            const value = e.target.value;
                            setUserInput(value);

                            // 🟢 Emit input sync to others
                            socketRef.current.emit(ACTIONS.INPUT_CHANGE, {
                                roomId,
                                input: value,
                            });
                        }}
                        style={{
                            backgroundColor: '#0e1119',
                            color: '#00ffcc',
                            width: '100%',
                            height: '100%',
                            borderRadius: '10px',
                            padding: '10px',
                            border: '2px solid #61dafb',
                            fontSize: '15px',
                            fontFamily: 'monospace',
                            resize: 'none',
                            outline: 'none',
                            boxShadow: '0 0 12px #61dafb55 inset',
                        }}
                    ></textarea>
                </div>

                {/* Output Section */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                    }}
                >
                    <label
                        style={{
                            color: '#61dafb',
                            fontWeight: 'bold',
                            marginBottom: '6px',
                            fontSize: '15px',
                        }}
                    >
                        💡 Output
                    </label>
                    <pre
                        style={{
                            backgroundColor: '#0e1119',
                            color: '#f8f8f2',
                            width: '100%',
                            height: '100%',
                            borderRadius: '10px',
                            padding: '10px',
                            overflowY: 'auto',
                            border: '2px solid #61dafb',
                            boxShadow: '0 0 12px #61dafb55 inset',
                            whiteSpace: 'pre-wrap',
                            margin: 0,
                        }}
                    >
                        {output || 'Output will appear here...'}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default Editor;
