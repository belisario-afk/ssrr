/**
 * TikTokConnector - Connects to TikTok LIVE via TikTokLive library
 * 
 * TikTok Username: lmohss
 * Server: Digital Ocean (165.22.174.250)
 * 
 * This module handles the WebSocket connection to TikTok LIVE events
 * and routes them to the game's gift system.
 */

export class TikTokConnector {
    constructor(giftSystem, obstacleManager) {
        this.giftSystem = giftSystem;
        this.obstacleManager = obstacleManager;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        
        // TikTok username (can be changed via API)
        this.tiktokUsername = 'lmohss';
        
        // WebSocket connection to backend server
        this.ws = null;
        this.serverUrl = this.getServerUrl();
        
        // Event callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onViewerJoin = null;
        this.onViewerCount = null;
        this.onGift = null;
        this.onChat = null;
        this.onLike = null;
        
        // Viewer tracking
        this.viewers = new Map();
        this.viewerCount = 0;
        this.likeCount = 0;
        
        console.log('[TikTok] Connector initialized');
    }
    
    /**
     * Get server URL based on environment
     */
    getServerUrl() {
        // Check if we're on the production server
        const hostname = window.location.hostname;
        
        if (hostname === '165.22.174.250' || hostname.includes('digitalocean')) {
            // Production server - use same host
            return `ws://${hostname}:3001`;
        } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Local development
            return 'ws://localhost:3001';
        } else {
            // Assume production
            return 'ws://165.22.174.250:3001';
        }
    }
    
    /**
     * Connect to the TikTok LIVE backend
     */
    connect(username = null) {
        if (username) {
            this.tiktokUsername = username;
        }
        
        console.log(`[TikTok] Connecting to ${this.serverUrl}...`);
        this.updateStatus('connecting');
        
        try {
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.onopen = () => {
                console.log('[TikTok] WebSocket connected');
                this.connected = true;
                this.reconnectAttempts = 0;
                
                // Send join request with TikTok username
                this.ws.send(JSON.stringify({
                    type: 'join',
                    tiktokUsername: this.tiktokUsername
                }));
                
                this.updateStatus('connected');
                if (this.onConnected) this.onConnected();
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log('[TikTok] WebSocket disconnected');
                this.connected = false;
                this.updateStatus('disconnected');
                if (this.onDisconnected) this.onDisconnected();
                
                // Attempt reconnect
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('[TikTok] WebSocket error:', error);
                this.updateStatus('error');
            };
            
        } catch (error) {
            console.error('[TikTok] Failed to connect:', error);
            this.updateStatus('error');
            this.attemptReconnect();
        }
    }
    
    /**
     * Attempt to reconnect after disconnect
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[TikTok] Max reconnect attempts reached');
            this.updateStatus('failed');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`[TikTok] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
    }
    
    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(data) {
        switch (data.type) {
            case 'connected':
                console.log(`[TikTok] Connected to LIVE: ${data.roomInfo?.title || this.tiktokUsername}`);
                this.viewerCount = data.viewerCount || 0;
                break;
                
            case 'gift':
                this.handleGift(data);
                break;
                
            case 'chat':
                this.handleChat(data);
                break;
                
            case 'like':
                this.handleLike(data);
                break;
                
            case 'join':
                this.handleViewerJoin(data);
                break;
                
            case 'viewer_count':
                this.viewerCount = data.count;
                if (this.onViewerCount) this.onViewerCount(data.count);
                break;
                
            case 'error':
                console.error('[TikTok] Server error:', data.message);
                break;
                
            default:
                console.log('[TikTok] Unknown message type:', data.type);
        }
    }
    
    /**
     * Handle gift events from TikTok
     */
    handleGift(data) {
        const { giftName, giftId, senderName, senderId, repeatCount, diamondCount } = data;
        
        console.log(`[TikTok] Gift received: ${giftName} x${repeatCount} from ${senderName} (${diamondCount} diamonds)`);
        
        // Map TikTok gift to game gift
        const gameGiftName = this.mapTikTokGift(giftName, giftId, diamondCount);
        
        // Trigger the gift in the game
        if (this.giftSystem) {
            this.giftSystem.triggerGift(gameGiftName, senderName, repeatCount);
        }
        
        // Track viewer
        this.trackViewer(senderId, senderName, 'gift');
        
        // Callback
        if (this.onGift) this.onGift(data);
    }
    
    /**
     * Map TikTok gift names/IDs to game gift tiers
     */
    mapTikTokGift(giftName, giftId, diamondCount) {
        // Map by diamond count (most reliable)
        if (diamondCount >= 1000) {
            return 'universe'; // EPIC tier
        } else if (diamondCount >= 500) {
            return 'galaxy'; // LARGE tier
        } else if (diamondCount >= 50) {
            return 'drama_queen'; // MEDIUM tier
        } else {
            return 'rose'; // SMALL tier
        }
    }
    
    /**
     * Handle chat messages
     */
    handleChat(data) {
        const { userId, username, comment } = data;
        
        console.log(`[TikTok] Chat: ${username}: ${comment}`);
        
        // Track viewer
        this.trackViewer(userId, username, 'chat');
        
        // Check for commands
        this.handleChatCommand(username, comment);
        
        // Callback
        if (this.onChat) this.onChat(data);
    }
    
    /**
     * Handle chat commands
     */
    handleChatCommand(username, message) {
        const command = message.toLowerCase().trim();
        
        // Spawn obstacle commands (for fun interactivity)
        if (command === '!banana' || command === '🍌') {
            if (this.obstacleManager) {
                this.obstacleManager.spawn('BANANA');
                console.log(`[TikTok] ${username} spawned a banana!`);
            }
        } else if (command === '!cucumber' || command === '🥒') {
            if (this.obstacleManager) {
                this.obstacleManager.spawn('CUCUMBER');
                console.log(`[TikTok] ${username} spawned a cucumber!`);
            }
        } else if (command === '!help') {
            if (this.obstacleManager) {
                this.obstacleManager.spawn('PILL');
                console.log(`[TikTok] ${username} sent a power-up!`);
            }
        }
    }
    
    /**
     * Handle likes
     */
    handleLike(data) {
        const { userId, username, likeCount, totalLikes } = data;
        
        this.likeCount = totalLikes || this.likeCount + (likeCount || 1);
        
        // Track viewer
        this.trackViewer(userId, username, 'like');
        
        // Every 100 likes, spawn a power-up
        if (this.likeCount > 0 && this.likeCount % 100 === 0) {
            if (this.obstacleManager) {
                this.obstacleManager.spawn('PILL');
                console.log(`[TikTok] ${this.likeCount} likes milestone! Power-up spawned!`);
            }
        }
        
        // Callback
        if (this.onLike) this.onLike(data);
    }
    
    /**
     * Handle viewer joins
     */
    handleViewerJoin(data) {
        const { userId, username } = data;
        
        console.log(`[TikTok] Viewer joined: ${username}`);
        
        // Track viewer
        this.trackViewer(userId, username, 'join');
        
        // Callback
        if (this.onViewerJoin) this.onViewerJoin(data);
    }
    
    /**
     * Track viewer activity
     */
    trackViewer(userId, username, action) {
        if (!this.viewers.has(userId)) {
            this.viewers.set(userId, {
                username,
                firstSeen: Date.now(),
                actions: []
            });
        }
        
        const viewer = this.viewers.get(userId);
        viewer.lastSeen = Date.now();
        viewer.actions.push({ action, time: Date.now() });
        
        // Keep only last 10 actions
        if (viewer.actions.length > 10) {
            viewer.actions.shift();
        }
    }
    
    /**
     * Update connection status in UI
     */
    updateStatus(status) {
        const statusEl = document.querySelector('.lobby-info .status');
        const textEl = document.querySelector('.lobby-info');
        
        if (!statusEl || !textEl) return;
        
        switch (status) {
            case 'connecting':
                statusEl.style.background = '#ffaa00';
                textEl.innerHTML = `<span class="status" style="background:#ffaa00"></span>CONNECTING TO TIKTOK LIVE...<br>Username: @${this.tiktokUsername}`;
                break;
            case 'connected':
                statusEl.style.background = '#00ff88';
                textEl.innerHTML = `<span class="status" style="background:#00ff88"></span>CONNECTED TO @${this.tiktokUsername}<br>GIFTS & INTERACTIONS ACTIVE!`;
                break;
            case 'disconnected':
                statusEl.style.background = '#ff4444';
                textEl.innerHTML = `<span class="status" style="background:#ff4444"></span>DISCONNECTED<br>ATTEMPTING RECONNECT...`;
                break;
            case 'error':
                statusEl.style.background = '#ff0000';
                textEl.innerHTML = `<span class="status" style="background:#ff0000"></span>CONNECTION ERROR<br>Check server status`;
                break;
            case 'failed':
                statusEl.style.background = '#ff0000';
                textEl.innerHTML = `<span class="status" style="background:#ff0000"></span>CONNECTION FAILED<br>Server may be offline`;
                break;
        }
    }
    
    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }
    
    /**
     * Get connection status
     */
    isConnected() {
        return this.connected;
    }
    
    /**
     * Get active viewer count
     */
    getViewerCount() {
        return this.viewerCount;
    }
    
    /**
     * Get top gifters from gift system
     */
    getTopGifters(count = 5) {
        if (this.giftSystem) {
            return this.giftSystem.getTopGifters(count);
        }
        return [];
    }
}
