const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('PxPony Chat Backend Running');
});

// Store connected players with additional metadata
const players = new Map();

// Constants
const CHAT_RANGE = 300; // Chat visibility range in pixels
const VOICE_RANGE = 600; // Voice range in pixels
const IDLE_TIMEOUT = 600000; // 10 minutes in milliseconds

// Cleanup idle players periodically
setInterval(() => {
    const now = Date.now();
    players.forEach((player, id) => {
        if (now - player.lastActivity > IDLE_TIMEOUT) {
            // Remove players idle for more than 10 minutes
            players.delete(id);
            io.emit('player-left', id);
        }
    });
}, 60000); // Check every minute

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle player join with initial position
    socket.on('player-join', ({ x, y, username, color }) => {
        console.log(`Player ${socket.id} (${username}) joined at position:`, x, y);
        players.set(socket.id, {
            x: parseFloat(x) || 0,
            y: parseFloat(y) || 0,
            username: username,
            color: color,
            lastChat: '',
            lastChatTime: 0,
            lastActivity: Date.now(),
            status: 'active'
        });

        // Send existing players to new player
        const playersArray = Array.from(players.entries()).map(([id, data]) => ({
            id,
            x: data.x,
            y: data.y,
            username: data.username,
            color: data.color,
            lastChat: data.lastChat,
            lastChatTime: data.lastChatTime,
            status: data.status
        }));
        socket.emit('players-sync', playersArray);

        // Broadcast new player to others
        socket.broadcast.emit('player-joined', {
            id: socket.id,
            x: x,
            y: y,
            username: username,
            color: color,
            status: 'active'
        });
    });

    // Handle player movement
    socket.on('player-move', ({ x, y }) => {
        if (players.has(socket.id)) {
            const player = players.get(socket.id);
            player.x = parseFloat(x);
            player.y = parseFloat(y);
            player.lastActivity = Date.now();
            player.status = 'active';
            
            socket.broadcast.emit('player-moved', {
                id: socket.id,
                x: player.x,
                y: player.y,
                status: player.status
            });
        }
    });

    // Handle chat messages with proximity check
    socket.on('chat-message', ({ message }) => {
        if (players.has(socket.id)) {
            const sender = players.get(socket.id);
            sender.lastChat = message;
            sender.lastChatTime = Date.now();
            sender.lastActivity = Date.now();
            sender.status = 'active';
            
            // Calculate which players are within chat range
            const nearbyPlayers = Array.from(players.entries())
                .filter(([id, player]) => {
                    if (id === socket.id) return false; // Skip sender
                    const dx = player.x - sender.x;
                    const dy = player.y - sender.y;
                    return Math.sqrt(dx * dx + dy * dy) <= CHAT_RANGE;
                });

            // Send chat only to nearby players
            nearbyPlayers.forEach(([id]) => {
                io.to(id).emit('chat-received', {
                    id: socket.id,
                    message: message,
                    timestamp: sender.lastChatTime
                });
            });

            // Send confirmation to sender
            socket.emit('chat-sent', {
                success: true,
                nearbyPlayers: nearbyPlayers.length
            });
        }
    });

    // Handle user status updates
    socket.on('status-update', ({ status }) => {
        if (players.has(socket.id)) {
            const player = players.get(socket.id);
            player.status = status;
            player.lastActivity = Date.now();
            
            socket.broadcast.emit('player-status-update', {
                id: socket.id,
                status: status
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (players.has(socket.id)) {
            players.delete(socket.id);
            io.emit('player-left', socket.id);
        }
    });

    // WebRTC signaling — forward to target peer if within range
    socket.on('webrtc-offer', ({ target, offer }) => {
        const sender = players.get(socket.id);
        const receiver = players.get(target);
        if (sender && receiver) {
            const dx = sender.x - receiver.x;
            const dy = sender.y - receiver.y;
            if (Math.sqrt(dx * dx + dy * dy) <= VOICE_RANGE) {
                io.to(target).emit('webrtc-offer', { from: socket.id, offer });
            }
        }
    });

    socket.on('webrtc-answer', ({ target, answer }) => {
        const sender = players.get(socket.id);
        const receiver = players.get(target);
        if (sender && receiver) {
            const dx = sender.x - receiver.x;
            const dy = sender.y - receiver.y;
            if (Math.sqrt(dx * dx + dy * dy) <= VOICE_RANGE) {
                io.to(target).emit('webrtc-answer', { from: socket.id, answer });
            }
        }
    });

    socket.on('webrtc-ice-candidate', ({ target, candidate }) => {
        const sender = players.get(socket.id);
        const receiver = players.get(target);
        if (sender && receiver) {
            const dx = sender.x - receiver.x;
            const dy = sender.y - receiver.y;
            if (Math.sqrt(dx * dx + dy * dy) <= VOICE_RANGE) {
                io.to(target).emit('webrtc-ice-candidate', { from: socket.id, candidate });
            }
        }
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        socket.emit('error', 'An error occurred');
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
