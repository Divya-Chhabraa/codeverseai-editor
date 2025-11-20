const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const server = http.createServer(app);

// ✅ Fixed CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5000', 'https://warm-trifle-d2c345.netlify.app', 'https://codeverse-ai.netlify.app', 'https://codeverseai-editor-production.up.railway.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'build')));

const io = new Server(server, { 
    cors: { 
        origin: ['http://localhost:3000', 'http://localhost:5000', 'https://warm-trifle-d2c345.netlify.app', 'https://codeverse-ai.netlify.app', 'https://codeverseai-editor-production.up.railway.app'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

/* ---------------- SOCKET.IO SETUP ---------------- */
const userSocketMap = {};
const roomAiChatHistory = {};
const roomCodeState = {}; 
const roomLanguageState = {};
const roomOutputState = {}; 
const roomInputState = {};

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

        // 👇 INITIALIZE ALL ROOM STATES IF NOT EXISTS
        if (!roomAiChatHistory[roomId]) {
            roomAiChatHistory[roomId] = [];
        }
        if (!roomCodeState[roomId]) {
            roomCodeState[roomId] = "";
        }
        if (!roomLanguageState[roomId]) {
            roomLanguageState[roomId] = "javascript";
        }
        if (!roomOutputState[roomId]) {
            roomOutputState[roomId] = "";
        }
        if (!roomInputState[roomId]) {
            roomInputState[roomId] = "";
        }

        const clients = getAllConnectedClients(roomId);
        
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });

        // 👇 SEND ALL EXISTING STATE TO NEWLY JOINED USER
        socket.emit(ACTIONS.AI_HISTORY_SYNC, {
            messages: roomAiChatHistory[roomId]
        });

        // 👇 SEND EXISTING CODE IF ROOM ALREADY HAS CONTENT
        if (roomCodeState[roomId] && roomCodeState[roomId].trim()) {
            socket.emit(ACTIONS.CODE_CHANGE, {
                code: roomCodeState[roomId]
            });
        }

        // 👇 SEND EXISTING LANGUAGE
        socket.emit(ACTIONS.LANGUAGE_CHANGE, {
            language: roomLanguageState[roomId]
        });

        // 👇 SEND EXISTING OUTPUT IF ANY
        if (roomOutputState[roomId] && roomOutputState[roomId].trim()) {
            socket.emit(ACTIONS.RUN_OUTPUT, {
                output: roomOutputState[roomId]
            });
        }

        // 👇 SEND EXISTING INPUT IF ANY
        if (roomInputState[roomId] && roomInputState[roomId].trim()) {
            socket.emit(ACTIONS.INPUT_CHANGE, {
                input: roomInputState[roomId]
            });
        }
    });

    // 👇 ADD SYNC CODE REQUEST HANDLER
    socket.on(ACTIONS.SYNC_CODE_REQUEST, ({ roomId }) => {
        if (roomCodeState[roomId] && roomCodeState[roomId].trim()) {
            socket.emit(ACTIONS.CODE_CHANGE, {
                code: roomCodeState[roomId]
            });
        } else {
            socket.emit(ACTIONS.CODE_CHANGE, { code: "" });
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
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
        };

        io.to(roomId).emit(ACTIONS.CHAT_MESSAGE, finalMessage);
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // 👇 FIXED AI MESSAGE HANDLER WITH PROPER HISTORY STORAGE
    socket.on(ACTIONS.AI_MESSAGE, (data) => {
        const { roomId, message } = data;
        const senderName = userSocketMap[socket.id] || 'Unknown';
        
        const finalMessage = {
            ...message,
            id: Date.now() + Math.random(),
            sender: message.isAi ? 'AI Assistant' : senderName,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            isAi: message.isAi || false
        };

        if (!roomAiChatHistory[roomId]) {
            roomAiChatHistory[roomId] = [];
        }
        
        roomAiChatHistory[roomId].push(finalMessage);
        
        // Keep only last 50 messages to prevent memory issues
        if (roomAiChatHistory[roomId].length > 50) {
            roomAiChatHistory[roomId] = roomAiChatHistory[roomId].slice(-50);
        }
        
        io.to(roomId).emit(ACTIONS.AI_MESSAGE, finalMessage);
    });

    // 👇 ENSURE HISTORY IS SENT WHEN REQUESTED
    socket.on(ACTIONS.AI_HISTORY_REQUEST, ({ roomId }) => {
        if (!roomAiChatHistory[roomId]) {
            roomAiChatHistory[roomId] = [];
        }
        
        const history = roomAiChatHistory[roomId];
        socket.emit(ACTIONS.AI_HISTORY_SYNC, {
            messages: history
        });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });

            // 👇 CLEANUP ALL ROOM STATES WHEN LAST USER LEAVES
            const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
            if (!clientsInRoom || clientsInRoom.size === 0) {
                delete roomAiChatHistory[roomId];
                delete roomCodeState[roomId];
                delete roomLanguageState[roomId];
                delete roomOutputState[roomId];
                delete roomInputState[roomId];
            }
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });

    socket.on('disconnect', () => {
        delete userSocketMap[socket.id];
    });
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
        const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: selected.name,
            version: '*',
            files: [{ name: `main.${selected.ext}`, content: code }],
            stdin: input || '',
        });

        const output = response.data.run?.stdout ||
                      response.data.run?.stderr ||
                      response.data.message ||
                      'No output';
        
        res.json({ 
            success: true,
            output: output
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Error running code. Please try again.',
            details: error.message 
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

        const selectedModel = "llama-3.1-8b-instant";
        
        const systemPrompt = `You are a helpful coding assistant. Be natural and match the user's tone.

RULES:
- If user says "hi" or similar: Respond briefly and friendly (1-2 sentences)
- If user asks simple question: Answer directly (2-3 sentences max)
- If user asks for code: Provide code with brief explanation
- Only use code blocks when sharing actual code
- No unsolicited examples or lengthy explanations`;

        const userContent = code ? 
            `Language: ${language}. Code: ${code}. Question: ${message}` :
            `Question: ${message}`;

        const requestBody = {
            model: selectedModel,
            messages: [
                {
                    role: "system", 
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userContent
                }
            ],
            temperature: 0.7,
            max_tokens: 300,
            stream: false
        };
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        res.json({ success: true, response: aiResponse });
        
    } catch (error) {
        res.json({ 
            success: false, 
            response: `AI Service Error: ${error.message}` 
        });
    }
});

// ✅ Add health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        connections: io.engine.clientsCount
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));