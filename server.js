const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const { loadStats, saveStats, updateAdPlay, addUniqueVisitor } = require('./utilities');

let stats = loadStats();
const players = new Map();

app.get('/', (req, res) => {
    res.send('PxPony Chat Backend Running');
});

app.get('/api/stats', (req, res) => {
    res.json({
        totalAdPlays: stats.totalAdPlays,
        adPlays: stats.adPlays,
        uniqueVisitorsCount: stats.uniqueVisitors.length,
        activePlayersCount: players.size
    });
});

app.get('/dashboard', (req, res) => {
    const adRows = Object.entries(stats.adPlays)
        .sort((a, b) => b[1] - a[1])
        .map(([url, count]) => `
            <tr>
                <td><a href="${url}" target="_blank">${url}</a></td>
                <td class="count-cell">${count.toLocaleString()}</td>
            </tr>`)
        .join('');

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PxPony | Ad Analytics</title>
        <style>
            :root {
                --bg: #0f172a;
                --card-bg: #1e293b;
                --accent: #38bdf8;
                --text: #f1f5f9;
                --text-muted: #94a3b8;
                --border: #334155;
            }
            body { 
                font-family: 'Inter', system-ui, -apple-system, sans-serif; 
                padding: 40px 20px; 
                background: var(--bg); 
                color: var(--text);
                margin: 0;
                line-height: 1.5;
            }
            .container { max-width: 1000px; margin: 0 auto; }
            header { margin-bottom: 40px; }
            h1 { font-size: 2.5rem; margin: 0; color: var(--accent); letter-spacing: -1px; }
            .subtitle { color: var(--text-muted); font-size: 1.1rem; }
            
            .stat-grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); 
                gap: 24px; 
                margin-bottom: 40px; 
            }
            .card { 
                background: var(--card-bg); 
                padding: 24px; 
                border-radius: 16px; 
                border: 1px solid var(--border);
                transition: transform 0.2s;
            }
            .card:hover { transform: translateY(-4px); }
            
            .stat-item { display: flex; flex-direction: column; }
            .stat-value { font-size: 2.5rem; font-weight: 800; color: var(--text); line-height: 1; margin-bottom: 8px; }
            .stat-label { color: var(--text-muted); text-transform: uppercase; font-size: 0.8rem; font-weight: 600; letter-spacing: 1px; }
            
            .table-container { 
                background: var(--card-bg); 
                border-radius: 16px; 
                border: 1px solid var(--border);
                overflow: hidden;
            }
            .table-header { padding: 24px; border-bottom: 1px solid var(--border); }
            .table-header h2 { margin: 0; font-size: 1.25rem; }
            
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; padding: 16px 24px; background: rgba(255,255,255,0.02); color: var(--text-muted); font-size: 0.85rem; font-weight: 600; border-bottom: 1px solid var(--border); }
            td { padding: 16px 24px; border-bottom: 1px solid var(--border); color: var(--text); font-size: 0.95rem; }
            tr:last-child td { border-bottom: none; }
            
            a { color: var(--accent); text-decoration: none; transition: opacity 0.2s; }
            a:hover { opacity: 0.8; }
            .count-cell { font-family: monospace; font-size: 1.1rem; color: var(--accent); font-weight: 600; }
            
            .refresh-indicator { 
                display: inline-block; 
                width: 8px; 
                height: 8px; 
                background: #22c55e; 
                border-radius: 50%; 
                margin-right: 8px;
                box-shadow: 0 0 8px #22c55e;
                animation: pulse 2s infinite;
            }
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

            @media (max-width: 640px) {
                h1 { font-size: 1.8rem; }
                body { padding: 20px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>PxPony Analytics</h1>
                <div class="subtitle">
                    <span class="refresh-indicator"></span>
                    Live Advertisement Performance Monitoring
                </div>
            </header>

            <div class="stat-grid">
                <div class="card stat-item">
                    <div class="stat-value">${stats.uniqueVisitors.length.toLocaleString()}</div>
                    <div class="stat-label">Unique Visitors</div>
                </div>
                <div class="card stat-item">
                    <div class="stat-value">${stats.totalAdPlays.toLocaleString()}</div>
                    <div class="stat-label">Total Impressions</div>
                </div>
            </div>

            <div class="table-container">
                <div class="table-header">
                    <h2>Ad Distribution Breakdown</h2>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Destination URL</th>
                            <th>Impressions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${adRows || '<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No impressions recorded yet</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        <script>
            setTimeout(() => window.location.reload(), 30000);
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

// Store connected players with additional metadata

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

    // Track visitor session
    socket.on('visitor-session', ({ visitorId }) => {
        const updatedStats = addUniqueVisitor(stats, visitorId);
        if (updatedStats !== stats) {
            stats = updatedStats;
            saveStats(stats);
            console.log(`New unique visitor: ${visitorId}`);
        }
    });

    // Track ad plays
    socket.on('ad-played', ({ adUrl }) => {
        stats = updateAdPlay(stats, adUrl);
        saveStats(stats);
        console.log(`Ad played: ${adUrl}`);
    });

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

    // Handle image messages with proximity check
    socket.on('image-message', ({ imageData }) => {
        if (players.has(socket.id)) {
            const sender = players.get(socket.id);
            sender.lastActivity = Date.now();
            sender.status = 'active';
            
            const timestamp = Date.now();
            
            const nearbyPlayers = Array.from(players.entries())
                .filter(([id, player]) => {
                    if (id === socket.id) return false;
                    const dx = player.x - sender.x;
                    const dy = player.y - sender.y;
                    return Math.sqrt(dx * dx + dy * dy) <= CHAT_RANGE;
                });

            nearbyPlayers.forEach(([id]) => {
                io.to(id).emit('image-received', {
                    id: socket.id,
                    imageData: imageData,
                    timestamp: timestamp
                });
            });

            socket.emit('image-sent', {
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
