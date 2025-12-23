/**
 * TikTok LIVE Backend Server for Bio-Race
 * 
 * This Node.js server connects to TikTok LIVE using the TikTokLive library
 * and relays events to the game clients via WebSocket.
 * 
 * Deploy to: Digital Ocean (165.22.174.250)
 * 
 * Installation:
 *   npm install
 *   
 * Run:
 *   node server.js
 *   
 * Or with PM2 for production:
 *   pm2 start server.js --name biorace-tiktok
 */

const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    PORT: 3001,
    TIKTOK_USERNAME: process.env.TIKTOK_USERNAME || 'lmohss',
    STATIC_PORT: 80,  // For serving game files
    STATIC_DIR: path.join(__dirname, '..'),  // Serve from BioRace_Modular folder
};

// Create HTTP server for static files
const httpServer = http.createServer((req, res) => {
    let filePath = path.join(CONFIG.STATIC_DIR, req.url === '/' ? 'index.html' : req.url);
    
    const extname = path.extname(filePath);
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.glb': 'model/gltf-binary',
        '.gltf': 'model/gltf+json',
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content, 'utf-8');
        }
    });
});

// WebSocket server for game clients
const wss = new WebSocket.Server({ port: CONFIG.PORT });
console.log(`[Server] WebSocket server started on port ${CONFIG.PORT}`);

// Store connected game clients
const gameClients = new Set();

// TikTok connection
let tiktokConnection = null;
let isConnectedToTikTok = false;

/**
 * Connect to TikTok LIVE
 */
async function connectToTikTok(username = CONFIG.TIKTOK_USERNAME) {
    if (tiktokConnection) {
        tiktokConnection.disconnect();
    }
    
    console.log(`[TikTok] Connecting to @${username}...`);
    
    tiktokConnection = new WebcastPushConnection(username, {
        processInitialData: true,
        enableExtendedGiftInfo: true,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 2000,
        sessionId: undefined,
        clientParams: {
            app_language: 'en-US',
            device_platform: 'web'
        }
    });
    
    // Handle connection
    tiktokConnection.connect().then(state => {
        console.log(`[TikTok] Connected to room: ${state.roomId}`);
        isConnectedToTikTok = true;
        
        // Notify all game clients
        broadcast({
            type: 'connected',
            roomId: state.roomId,
            viewerCount: state.viewerCount,
            roomInfo: {
                title: state.roomInfo?.title,
                owner: state.roomInfo?.owner?.nickname
            }
        });
    }).catch(err => {
        console.error('[TikTok] Connection failed:', err.message);
        isConnectedToTikTok = false;
        
        // Try to reconnect after delay
        setTimeout(() => connectToTikTok(username), 10000);
    });
    
    // Gift event
    tiktokConnection.on('gift', data => {
        console.log(`[TikTok] Gift: ${data.giftName} x${data.repeatCount} from ${data.uniqueId}`);
        
        broadcast({
            type: 'gift',
            giftName: data.giftName,
            giftId: data.giftId,
            senderName: data.nickname || data.uniqueId,
            senderId: data.uniqueId,
            repeatCount: data.repeatCount,
            diamondCount: data.diamondCount,
            timestamp: Date.now()
        });
    });
    
    // Chat event
    tiktokConnection.on('chat', data => {
        console.log(`[TikTok] Chat: ${data.uniqueId}: ${data.comment}`);
        
        broadcast({
            type: 'chat',
            userId: data.uniqueId,
            username: data.nickname || data.uniqueId,
            comment: data.comment,
            timestamp: Date.now()
        });
    });
    
    // Like event
    tiktokConnection.on('like', data => {
        broadcast({
            type: 'like',
            userId: data.uniqueId,
            username: data.nickname || data.uniqueId,
            likeCount: data.likeCount,
            totalLikes: data.totalLikeCount,
            timestamp: Date.now()
        });
    });
    
    // Member join event
    tiktokConnection.on('member', data => {
        console.log(`[TikTok] Viewer joined: ${data.uniqueId}`);
        
        broadcast({
            type: 'join',
            userId: data.uniqueId,
            username: data.nickname || data.uniqueId,
            timestamp: Date.now()
        });
    });
    
    // Room stats update
    tiktokConnection.on('roomUser', data => {
        broadcast({
            type: 'viewer_count',
            count: data.viewerCount
        });
    });
    
    // Disconnection
    tiktokConnection.on('disconnected', () => {
        console.log('[TikTok] Disconnected');
        isConnectedToTikTok = false;
        
        broadcast({
            type: 'disconnected',
            message: 'TikTok LIVE disconnected'
        });
        
        // Attempt reconnect
        setTimeout(() => connectToTikTok(username), 5000);
    });
    
    // Error handling
    tiktokConnection.on('error', err => {
        console.error('[TikTok] Error:', err.message);
        
        broadcast({
            type: 'error',
            message: err.message
        });
    });
}

/**
 * Broadcast message to all connected game clients
 */
function broadcast(data) {
    const message = JSON.stringify(data);
    gameClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Handle game client connections
wss.on('connection', (ws) => {
    console.log('[Server] Game client connected');
    gameClients.add(ws);
    
    // Handle messages from game client
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'join') {
                // Client wants to connect to a TikTok user
                const username = data.tiktokUsername || CONFIG.TIKTOK_USERNAME;
                console.log(`[Server] Client requesting TikTok connection to @${username}`);
                
                if (!isConnectedToTikTok || CONFIG.TIKTOK_USERNAME !== username) {
                    CONFIG.TIKTOK_USERNAME = username;
                    connectToTikTok(username);
                } else {
                    // Already connected, send current status
                    ws.send(JSON.stringify({
                        type: 'connected',
                        message: `Already connected to @${username}`
                    }));
                }
            }
        } catch (err) {
            console.error('[Server] Error parsing message:', err);
        }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
        console.log('[Server] Game client disconnected');
        gameClients.delete(ws);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Bio-Race TikTok Server',
        tiktokConnected: isConnectedToTikTok,
        currentUser: CONFIG.TIKTOK_USERNAME
    }));
});

// Start HTTP server for static files (optional, use nginx in production)
if (process.env.SERVE_STATIC !== 'false') {
    httpServer.listen(CONFIG.STATIC_PORT, () => {
        console.log(`[Server] Static file server started on port ${CONFIG.STATIC_PORT}`);
        console.log(`[Server] Game available at http://165.22.174.250:${CONFIG.STATIC_PORT}`);
    });
}

// Initial TikTok connection
connectToTikTok();

console.log('='.repeat(50));
console.log('Bio-Race TikTok LIVE Server');
console.log('='.repeat(50));
console.log(`TikTok Username: @${CONFIG.TIKTOK_USERNAME}`);
console.log(`WebSocket Port: ${CONFIG.PORT}`);
console.log(`Static Files: ${CONFIG.STATIC_DIR}`);
console.log('='.repeat(50));
