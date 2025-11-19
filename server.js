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

// Enhanced CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'https://warm-trifle-d2c345.netlify.app', '*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'build')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`, req.body ? 'with body' : '');
    next();
});

// ✅ FIXED: Enhanced Socket.io configuration
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://warm-trifle-d2c345.netlify.app",
            "*"
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Add fallback
    pingTimeout: 60000,
    pingInterval: 25000
});

// ✅ Add WebSocket connection logging
io.engine.on("connection", (rawSocket) => {
    console.log('🔄 Raw WebSocket connection established');
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
    console.log('🔗 Total connections:', io.engine.clientsCount);

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

    // ... rest of your socket events (same as before)

    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', socket.id, 'Reason:', reason);
        delete userSocketMap[socket.id];
    });
});

/* ---------------- CODE EXECUTION ROUTE ---------------- */
app.post('/run', async (req, res) => {
    console.log('🚀 /run endpoint hit');
    
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
        console.log(`🔧 Executing ${language} code...`);
        
        const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: selected.name,
            version: '*',
            files: [{ name: `main.${selected.ext}`, content: code }],
            stdin: input || '',
        });

        console.log('✅ Execution successful');
        
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
        timestamp: new Date().toISOString(),
        connections: io.engine.clientsCount
    });
});

// ✅ Add WebSocket test endpoint
app.get('/ws-test', (req, res) => {
    res.json({ 
        websocket: 'available',
        message: 'WebSocket server is running'
    });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 WebSocket server available at ws://localhost:${PORT}`);
});