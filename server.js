const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('/.src/Actions');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
require('dotenv').config();

const server = http.createServer(app);
const RUN_SESSIONS = {};

// ✅ CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:8501',
    'https://warm-trifle-d2c345.netlify.app',
    'https://codeverse-ai.netlify.app',
    'https://codeverseai-editor-production.up.railway.app',
    'https://codeverseai-editor.vercel.app',
];

app.use(
    cors({
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
    })
);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'build')));

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
});

/* ---------------- SOCKET.IO STATE ---------------- */
const userSocketMap = {};
const roomAiChatHistory = {};
const roomCodeState = {};
const roomLanguageState = {};
const roomOutputState = {};
const roomInputState = {};
const roomVideoState = {};

function getCommandForLanguage(language) {
    // You can extend this object as you add more languages
    switch (language) {
        case 'javascript':
            return { cmd: 'node', args: ['-'] };       // code via stdin
        case 'python':
            return { cmd: 'python', args: ['-u', '-'] }; // -u for unbuffered, code via stdin
        // For compiled languages you'd need a separate compile+run flow.
        default:
            throw new Error(`Unsupported language: ${language}`);
    }
}

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => ({
            socketId,
            username: userSocketMap[socketId],
        })
    );
}

io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);

        if (!roomAiChatHistory[roomId]) roomAiChatHistory[roomId] = [];
        if (!roomCodeState[roomId]) roomCodeState[roomId] = '';
        if (!roomLanguageState[roomId]) roomLanguageState[roomId] = 'javascript';
        if (!roomOutputState[roomId]) roomOutputState[roomId] = '';
        if (!roomInputState[roomId]) roomInputState[roomId] = '';

        const clients = getAllConnectedClients(roomId);

        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });

        // Send existing state to newly joined user
        socket.emit(ACTIONS.AI_HISTORY_SYNC, {
            messages: roomAiChatHistory[roomId],
        });

        if (roomCodeState[roomId] && roomCodeState[roomId].trim()) {
            socket.emit(ACTIONS.CODE_CHANGE, {
                code: roomCodeState[roomId],
            });
        }

        socket.emit(ACTIONS.LANGUAGE_CHANGE, {
            language: roomLanguageState[roomId],
        });

        if (roomOutputState[roomId] && roomOutputState[roomId].trim()) {
            socket.emit(ACTIONS.RUN_OUTPUT, {
                output: roomOutputState[roomId],
            });
        }

        if (roomInputState[roomId] && roomInputState[roomId].trim()) {
            socket.emit(ACTIONS.INPUT_CHANGE, {
                input: roomInputState[roomId],
            });
        }
    });

    // Sync code request
    socket.on(ACTIONS.SYNC_CODE_REQUEST, ({ roomId }) => {
        if (roomCodeState[roomId] && roomCodeState[roomId].trim()) {
            socket.emit(ACTIONS.CODE_CHANGE, {
                code: roomCodeState[roomId],
            });
        } else {
            socket.emit(ACTIONS.CODE_CHANGE, { code: '' });
        }
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        roomCodeState[roomId] = code;
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.LANGUAGE_CHANGE, ({ roomId, language }) => {
        roomLanguageState[roomId] = language;
        socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, { language });
    });

    socket.on(ACTIONS.INPUT_CHANGE, ({ roomId, input }) => {
        roomInputState[roomId] = input;
        socket.in(roomId).emit(ACTIONS.INPUT_CHANGE, { input });
    });

    socket.on(ACTIONS.RUN_OUTPUT, ({ roomId, output }) => {
        roomOutputState[roomId] = output;
        socket.in(roomId).emit(ACTIONS.RUN_OUTPUT, { output });
    });

    socket.on(ACTIONS.CHAT_MESSAGE, (data) => {
        const { roomId, message } = data;
        const senderName = userSocketMap[socket.id] || 'Unknown';

        const finalMessage = {
            id: Date.now() + Math.random(),
            text: message.text,
            sender: senderName,
            time: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            }),
            timestamp: Date.now(),
        };

        io.to(roomId).emit(ACTIONS.CHAT_MESSAGE, finalMessage);
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // AI messages
    socket.on(ACTIONS.AI_MESSAGE, (data) => {
        const { roomId, message } = data;
        const senderName = userSocketMap[socket.id] || 'Unknown';

        const finalMessage = {
            ...message,
            id: Date.now() + Math.random(),
            sender: message.isAi ? 'AI Assistant' : senderName,
            time: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            }),
            timestamp: Date.now(),
            isAi: message.isAi || false,
        };

        if (!roomAiChatHistory[roomId]) {
            roomAiChatHistory[roomId] = [];
        }

        roomAiChatHistory[roomId].push(finalMessage);

        if (roomAiChatHistory[roomId].length > 50) {
            roomAiChatHistory[roomId] =
                roomAiChatHistory[roomId].slice(-50);
        }

        io.to(roomId).emit(ACTIONS.AI_MESSAGE, finalMessage);
    });

    socket.on(ACTIONS.AI_HISTORY_REQUEST, ({ roomId }) => {
        if (!roomAiChatHistory[roomId]) {
            roomAiChatHistory[roomId] = [];
        }

        const history = roomAiChatHistory[roomId];
        socket.emit(ACTIONS.AI_HISTORY_SYNC, {
            messages: history,
        });
    });

    // 🔹 AI Documentation via Socket.IO - FINAL WORKING VERSION
    socket.on(ACTIONS.AI_DOC_REQUEST, async ({ roomId, code, language, username }) => {
        try {
            console.log('📄 AI Documentation requested from room:', roomId);

            const GROQ_DOC_API_KEY = process.env.DOC_GROQ_API_KEY;
            if (!GROQ_DOC_API_KEY) {
                throw new Error('Groq API key missing in server');
            }

            const prompt = `
Generate CRISP technical documentation for this ${language} code.
Requirements:
- MAX 8-12 lines total
- Use standard ${language} documentation format
- Only include: brief description, parameters with types, return type
- ONE line example if needed
- NO lengthy explanations, NO multiple examples
- Be direct and technical

Code:
\`\`\`${language}
${code}
\`\`\`

Documentation:`;

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_DOC_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 1024,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Groq API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const documentationText =
                data.choices?.[0]?.message?.content || 'No documentation generated';

            console.log('📄 Documentation generated successfully.');

            io.to(roomId).emit(ACTIONS.AI_DOC_RESULT, {
                documentation: documentationText,
                language,
                username,
            });

        } catch (error) {
            console.error('❌ AI Documentation Error:', error);

            io.to(roomId).emit(ACTIONS.AI_DOC_RESULT, {
                error: error.message,
                language,
                username,
            });
        }
    });

    /* =============== VIDEO SYNC EVENTS =============== */
    socket.on(ACTIONS.VIDEO_JOIN, ({ roomId }) => {
        socket.join(`video-${roomId}`);
        console.log(`🎥 User ${socket.id} joined video room: ${roomId}`);

        // Send current video state to new user IMMEDIATELY
        if (roomVideoState[roomId]) {
            console.log(`🎥 Sending current state to new user:`, roomVideoState[roomId]);
            // Add a small delay to ensure client is ready
            setTimeout(() => {
                socket.emit(ACTIONS.VIDEO_STATE_SYNC, roomVideoState[roomId]);
            }, 500);
        }
    });

    socket.on(ACTIONS.VIDEO_PLAY, (data) => {
        const { roomId, currentTime, videoUrl, timestamp } = data;

        console.log(`🎥 VIDEO_PLAY: Room ${roomId}, Time: ${currentTime}`);

        // Update room state
        roomVideoState[roomId] = {
            isPlaying: true,
            currentTime: currentTime,
            videoUrl: videoUrl,
            timestamp: timestamp,
            lastAction: 'play'
        };

        // Broadcast to ALL other users (not the sender)
        socket.to(`video-${roomId}`).emit(ACTIONS.VIDEO_PLAY, {
            roomId,
            currentTime: currentTime,
            videoUrl: videoUrl,
            timestamp: timestamp,
            forceSync: true
        });
    });

    socket.on(ACTIONS.VIDEO_PAUSE, (data) => {
        const { roomId, currentTime, videoUrl, timestamp } = data;

        console.log(`🎥 VIDEO_PAUSE: Room ${roomId}, Time: ${currentTime}`);

        roomVideoState[roomId] = {
            isPlaying: false,
            currentTime: currentTime,
            videoUrl: videoUrl,
            timestamp: timestamp,
            lastAction: 'pause'
        };

        // Broadcast to ALL other users (not the sender)
        socket.to(`video-${roomId}`).emit(ACTIONS.VIDEO_PAUSE, {
            roomId,
            currentTime: currentTime,
            videoUrl: videoUrl,
            timestamp: timestamp,
            forceSync: true
        });
    });

    socket.on(ACTIONS.VIDEO_SEEK, (data) => {
        const { roomId, currentTime, timestamp } = data;

        console.log(`🎥 VIDEO_SEEK: Room ${roomId}, Time: ${currentTime}`);

        if (roomVideoState[roomId]) {
            roomVideoState[roomId].currentTime = currentTime;
            roomVideoState[roomId].timestamp = timestamp;
            roomVideoState[roomId].lastAction = 'seek';
        }

        // Broadcast to ALL other users (not the sender)
        socket.to(`video-${roomId}`).emit(ACTIONS.VIDEO_SEEK, {
            roomId,
            currentTime: currentTime,
            timestamp: timestamp,
            forceSync: true
        });
    });

    socket.on(ACTIONS.VIDEO_CHANGE, (data) => {
        const { roomId, videoUrl, timestamp } = data;

        console.log(`🎥 VIDEO_CHANGE: Room ${roomId}, New URL: ${videoUrl}`);

        roomVideoState[roomId] = {
            isPlaying: true,
            currentTime: 0,
            videoUrl: videoUrl,
            timestamp: timestamp,
            lastAction: 'change'
        };

        // Broadcast to ALL other users (not the sender)
        socket.to(`video-${roomId}`).emit(ACTIONS.VIDEO_CHANGE, {
            roomId,
            videoUrl: videoUrl,
            timestamp: timestamp,
            forceSync: true
        });
    });

    socket.on(ACTIONS.VIDEO_SYNC_REQUEST, ({ roomId }) => {
        console.log(`🎥 VIDEO_SYNC_REQUEST from ${socket.id} for room: ${roomId}`);
        if (roomVideoState[roomId]) {
            socket.emit(ACTIONS.VIDEO_STATE_SYNC, roomVideoState[roomId]);
        }
    });

    // Code execution events
    socket.on('RUN_START', ({ roomId, code, language }) => {
    try {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');

        // Kill previous process
        if (RUN_SESSIONS[roomId]?.proc) {
            RUN_SESSIONS[roomId].proc.kill('SIGKILL');
            delete RUN_SESSIONS[roomId];
        }

        let proc;
        let tempFile, outputExec;

        if (language === 'cpp') {
            tempFile = path.join(os.tmpdir(), `file_${roomId}.cpp`);
            outputExec = path.join(os.tmpdir(), `a_${roomId}.exe`);
            fs.writeFileSync(tempFile, code);

            // Compile
            const compile = spawn('g++', [tempFile, '-o', outputExec]);

            compile.stderr.on('data', data =>
                io.to(roomId).emit('RUN_OUTPUT', { chunk: data.toString() })
            );

            compile.on('close', exitCode => {
                if (exitCode === 0) {
                    proc = spawn(outputExec, [], { stdio: ['pipe', 'pipe', 'pipe'] });
                    attachHandlers(proc, roomId);
                } else {
                    io.to(roomId).emit('RUN_OUTPUT', {
                        chunk: 'Compilation failed.\n',
                        isEnd: true
                    });
                }
            });

        } else if (language === 'java') {
            tempFile = path.join(os.tmpdir(), `Main_${roomId}.java`);
            fs.writeFileSync(tempFile, code);

            // Compile
            const compile = spawn('javac', [tempFile]);

            compile.stderr.on('data', data =>
                io.to(roomId).emit('RUN_OUTPUT', { chunk: data.toString() })
            );

            compile.on('close', exitCode => {
                if (exitCode === 0) {
                    proc = spawn('java', ['-cp', os.tmpdir(), `Main_${roomId}`], {
                        stdio: ['pipe', 'pipe', 'pipe']
                    });
                    attachHandlers(proc, roomId);
                } else {
                    io.to(roomId).emit('RUN_OUTPUT', {
                        chunk: 'Compilation failed.\n',
                        isEnd: true
                    });
                }
            });

        } else {
            // Python / JavaScript
            const ext = language === 'python' ? 'py' : 'js';
            tempFile = path.join(os.tmpdir(), `file_${roomId}.${ext}`);
            fs.writeFileSync(tempFile, code);

            const cmd = language === 'python' ? 'python' : 'node';
            proc = spawn(cmd, [tempFile], { stdio: ['pipe', 'pipe', 'pipe'] });

            attachHandlers(proc, roomId);
        }

        socket.join(roomId);

    } catch (err) {
        io.to(roomId).emit('RUN_OUTPUT', {
            chunk: `Error: ${err.message}\n`,
            isEnd: true
        });
    }
});

// 🔹 Shared Handler for all languages
function attachHandlers(proc, roomId) {
    RUN_SESSIONS[roomId] = { proc };

    proc.stdout.on('data', data =>
        io.to(roomId).emit('RUN_OUTPUT', { chunk: data.toString() })
    );

    proc.stderr.on('data', data =>
        io.to(roomId).emit('RUN_OUTPUT', { chunk: data.toString() })
    );

    proc.on('close', () => {
        io.to(roomId).emit('RUN_OUTPUT', {
            chunk: '',
            isEnd: true
        });
        delete RUN_SESSIONS[roomId];
    });
}




    // Send INPUT into running process
    socket.on('RUN_INPUT', ({ roomId, input }) => {
        const session = RUN_SESSIONS[roomId];
        if (session && session.proc && !session.proc.killed) {
            session.proc.stdin.write(input + '\n');
        } else {
            socket.emit('RUN_OUTPUT', {
                roomId,
                chunk: '[No active process. Press Run again.]\n',
            });
        }
    });

    // Stop process manually if needed
    socket.on('RUN_STOP', ({ roomId }) => {
        const session = RUN_SESSIONS[roomId];
        if (session && session.proc && !session.proc.killed) {
            session.proc.kill('SIGKILL');
            delete RUN_SESSIONS[roomId];
            socket.emit('RUN_OUTPUT', {
                roomId,
                chunk: '[Process stopped]\n',
            });
        }
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });

            const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
            if (!clientsInRoom || clientsInRoom.size === 0) {
                delete roomAiChatHistory[roomId];
                delete roomCodeState[roomId];
                delete roomLanguageState[roomId];
                delete roomOutputState[roomId];
                delete roomInputState[roomId];
                delete roomVideoState[roomId];
            }
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });

    socket.on('disconnect', () => {
        delete userSocketMap[socket.id];
    });
});

/* ---------------- FILE API (used by Editor.js) ---------------- */

// GET current file content + language for a given room/file
app.get('/api/file/:roomId', (req, res) => {
    const { roomId } = req.params;
    const content = roomCodeState[roomId] || '';
    const language = roomLanguageState[roomId] || 'javascript';

    return res.json({
        success: true,
        content,
        language,
    });
});

// SAVE file content + language for a given room/file
app.post('/api/file/:roomId', (req, res) => {
    const { roomId } = req.params;
    const { content, language } = req.body || {};

    roomCodeState[roomId] = typeof content === 'string' ? content : '';
    if (language) {
        roomLanguageState[roomId] = language;
    }

    // Optional: broadcast new code to other clients in same room
    io.to(roomId).emit(ACTIONS.CODE_CHANGE, { code: roomCodeState[roomId] });
    io.to(roomId).emit(ACTIONS.LANGUAGE_CHANGE, {
        language: roomLanguageState[roomId],
    });

    return res.json({ success: true });
});

/* ---------------- CODE EXECUTION ROUTE ---------------- */
app.post('/run', async (req, res) => {
    const { code, language, input } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    const langMap = {
        javascript: { name: 'javascript', ext: 'js' },
        python: { name: 'python3', ext: 'py' },
        cpp: { name: 'cpp', ext: 'cpp' },
        java: { name: 'java', ext: 'java' },
    };

    const selected = langMap[language] || langMap.javascript;

    try {
        const response = await axios.post(
            'https://emkc.org/api/v2/piston/execute',
            {
                language: selected.name,
                version: '*',
                files: [{ name: `main.${selected.ext}`, content: code }],
                stdin: input || '',
            }
        );

        const output =
            response.data.run?.stdout ||
            response.data.run?.stderr ||
            response.data.message ||
            'No output';

        res.json({
            success: true,
            output: output,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error running code. Please try again.',
            details: error.message,
        });
    }
});

/* ---------------- GROQ AI CHAT ENDPOINT ---------------- */
app.post('/api/ai-chat', async (req, res) => {
    const { message, code, language } = req.body;

    try {
        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        if (!GROQ_API_KEY) {
            throw new Error('Groq API key not configured');
        }

        const selectedModel = 'llama-3.1-8b-instant';

        const systemPrompt = `You are CodeVerse AI - an elite programming assistant with expert-level knowledge in all programming languages and software engineering concepts.

CORE IDENTITY:
- You are a sophisticated AI coding mentor with deep technical expertise
- Your responses are precise, professional, and highly technical when needed
- You provide expert guidance on complex programming concepts
- You write clean, production-ready code with best practices
- You explain advanced concepts with clarity and depth

RESPONSE GUIDELINES:
- Maintain professional technical tone while being helpful
- Provide comprehensive explanations for complex topics
- Write optimized, industry-standard code examples
- Debug with systematic, methodical approaches
- Suggest architectural patterns and best practices
- Reference modern frameworks, libraries, and tools
- Explain the "why" behind technical decisions

TECHNICAL DEPTH:
- Use proper technical terminology
- Include time/space complexity analysis when relevant
- Discuss trade-offs between different approaches
- Reference official documentation and standards
- Consider scalability, security, and performance`;

        const userContent = code
            ? `Language: ${language}. Code: ${code}. Question: ${message}`
            : `Question: ${message}`;

        const requestBody = {
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: userContent,
                },
            ],
            temperature: 0.7,
            max_tokens: 3000,
            stream: false,
        };
        console.log(
            "Debug- Body sent to Groq:",
            JSON.stringify(requestBody, null, 2)
        );
        const response = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        res.json({ success: true, response: aiResponse });
    } catch (error) {
        res.json({
            success: false,
            response: `AI Service Error: ${error.message}`,
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        connections: io.engine.clientsCount,
    });
});

// React app catch-all
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
);