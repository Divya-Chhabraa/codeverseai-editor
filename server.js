const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const server = http.createServer(app);

// ✅ FIXED CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'https://warm-trifle-d2c345.netlify.app', '*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'build')));

// ✅ Add request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`, req.body ? 'with body' : '');
    next();
});

const io = new Server(server, { 
    cors: { 
        origin: ['http://localhost:3000', 'https://warm-trifle-d2c345.netlify.app', '*'],
        methods: ['GET', 'POST']
    },
    // ✅ Add transport fallbacks
    transports: ['websocket', 'polling']
});

/* ---------------- SOCKET.IO SETUP ---------------- */
const userSocketMap = {};

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

        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
        
        console.log(`👤 ${username} joined room: ${roomId}`);
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.LANGUAGE_CHANGE, ({ roomId, language }) => {
        socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, { language });
    });

    socket.on(ACTIONS.INPUT_CHANGE, ({ roomId, input }) => {
        socket.in(roomId).emit(ACTIONS.INPUT_CHANGE, { input });
    });

    socket.on(ACTIONS.RUN_OUTPUT, ({ roomId, output }) => {
        socket.in(roomId).emit(ACTIONS.RUN_OUTPUT, { output });
    });

    socket.on(ACTIONS.CHAT_MESSAGE, (data) => {
        console.log('💬 RAW CHAT DATA:', data);
        
        const { roomId, message } = data;
        const senderName = userSocketMap[socket.id] || 'Unknown';
        
        const finalMessage = {
            id: Date.now() + Math.random(),
            text: message.text,
            sender: senderName,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
        };

        console.log('📤 Broadcasting message:', finalMessage);
        io.to(roomId).emit(ACTIONS.CHAT_MESSAGE, finalMessage);
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });

    socket.on('disconnect', () => {
        console.log('❌ Socket disconnected:', socket.id);
        delete userSocketMap[socket.id];
    });
});

/* ---------------- CODE EXECUTION ROUTE ---------------- */
app.post('/run', async (req, res) => {
    console.log('🚀 /run endpoint hit:', req.body);
    
    const { code, language, input } = req.body;

    // ✅ Add validation
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
        console.log(`🔧 Executing ${language} code...`);
        
        const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: selected.name,
            version: '*',
            files: [{ name: `main.${selected.ext}`, content: code }],
            stdin: input || '',
        });

        console.log('✅ Execution successful:', response.data);

        const output = response.data.run?.stdout ||
                      response.data.run?.stderr ||
                      response.data.message ||
                      'No output';
        
        res.json({ 
            success: true,
            output: output
        });
        
    } catch (error) {
        console.error('❌ Error executing code:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Error running code. Please try again.',
            details: error.message 
        });
    }
});

// ✅ Add health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));