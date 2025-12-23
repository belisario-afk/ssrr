import * as THREE from 'three';
import * as CANNON from 'cannon';
import { logEvent } from './Utils.js';
import { CONFIG } from './Config.js';
import { getGameState } from './GameState.js';

/**
 * GiftSystem - Handles TikTok gift integration and effects
 * 
 * Gift Tiers:
 * - SMALL: Rose, TikTok (1-10 coins) - Minor boost
 * - MEDIUM: Drama Queen, GG (50-100 coins) - Speed boost + obstacle spawn
 * - LARGE: Galaxy (500+ coins) - Major effect + competitor spawn
 * - EPIC: Universe (1000+ coins) - All effects + power-up
 * 
 * TikTok Gifters become COMPETITORS in the race!
 */
export class GiftSystem {
    constructor(world, player, obstacleManager = null) {
        this.world = world;
        this.player = player;
        this.obstacleManager = obstacleManager;
        this.giftEffects = [];
        this.giftQueue = [];
        this.particles = [];
        this.gameState = getGameState();
        
        // Callback for spawning competitors (set from Main.js)
        this.onSpawnCompetitor = null;
        this.onSpawnObstacle = null;
        this.onSpawnPowerUp = null;
        
        // Gift tier definitions with enhanced rewards
        this.giftTiers = {
            SMALL: { 
                boost: 2, 
                duration: 1, 
                color: 0xff69b4, 
                emoji: '🌹',
                effectType: 'boost',
                coinValue: CONFIG.GIFTS.SMALL.coinValue
            },
            MEDIUM: { 
                boost: 5, 
                duration: 3, 
                color: 0x00ff88, 
                emoji: '✨',
                effectType: 'obstacle', // Spawns obstacle ahead
                coinValue: CONFIG.GIFTS.MEDIUM.coinValue
            },
            LARGE: { 
                boost: 10, 
                duration: 5, 
                color: 0xffd700, 
                emoji: '🌟',
                effectType: 'competitor', // Spawns a competitor with gifter's name!
                coinValue: CONFIG.GIFTS.LARGE.coinValue
            },
            EPIC: { 
                boost: 15, 
                duration: 8, 
                color: 0xff00ff, 
                emoji: '🚀',
                effectType: 'all', // Everything! Competitor + obstacles + power-up
                coinValue: CONFIG.GIFTS.EPIC.coinValue
            }
        };
        
        // Map gift names to tiers
        this.giftMapping = {
            // Small gifts (boost only)
            'rose': 'SMALL',
            'tiktok': 'SMALL',
            'heart': 'SMALL',
            'ice_cream': 'SMALL',
            'finger_heart': 'SMALL',
            'like': 'SMALL',
            // Medium gifts (+ obstacle)
            'drama_queen': 'MEDIUM',
            'gg': 'MEDIUM',
            'doughnut': 'MEDIUM',
            'hand_heart': 'MEDIUM',
            'perfume': 'MEDIUM',
            'makeup': 'MEDIUM',
            // Large gifts (+ competitor)
            'galaxy': 'LARGE',
            'lion': 'LARGE',
            'cap': 'LARGE',
            'disco_ball': 'LARGE',
            'sunglasses': 'LARGE',
            // Epic gifts (+ everything!)
            'universe': 'EPIC',
            'planet': 'EPIC',
            'rocket': 'EPIC',
            'whale': 'EPIC',
            'fireworks': 'EPIC'
        };
        
        // Recent gifters leaderboard
        this.gifterLeaderboard = [];
        this.totalGiftValue = 0;
        
        this.createParticleSystem();
        
        // Listen for keyboard triggers (for testing)
        this.setupTestKeys();
    }
    
    /**
     * Set the obstacle manager reference
     */
    setObstacleManager(obstacleManager) {
        this.obstacleManager = obstacleManager;
    }
    
    setupTestKeys() {
        window.addEventListener('keydown', (e) => {
            if (e.key === '9') this.triggerGift('rose', 'TestUser');
            if (e.key === '0') this.triggerGift('universe', 'EpicGifter');
        });
    }
    
    createParticleSystem() {
        // Create reusable particle geometry
        const particleCount = 200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;
            sizes[i] = Math.random() * 0.5 + 0.1;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particleSystem = new THREE.Points(geometry, material);
        this.particleSystem.visible = false;
        this.world.scene.add(this.particleSystem);
    }
    
    /**
     * Trigger a gift effect
     * @param {string} giftName - Name of the gift
     * @param {string} senderName - Name of the sender
     * @param {number} count - Number of gifts (optional)
     */
    triggerGift(giftName, senderName, count = 1) {
        const tierName = this.giftMapping[giftName.toLowerCase()] || 'SMALL';
        const tier = this.giftTiers[tierName];
        const giftConfig = CONFIG.GIFTS[tierName];
        
        // Log the gift with enhanced messaging
        logEvent(`${tier.emoji} GIFT FROM:\n${senderName}\n${giftName.toUpperCase()} x${count}\n+${tier.coinValue * count} COINS`);
        
        // Update gifter leaderboard
        this.updateGifterLeaderboard(senderName, tierName, tier.coinValue * count);
        
        // Record gift in game state
        this.gameState.giftReceived(tier.coinValue * count);
        
        // Apply boost to player
        this.applyBoostEffect(tier, giftConfig, count);
        
        // Create visual effect
        this.createGiftVisualEffect(tier, senderName, tierName);
        
        // Spawn game effects based on tier
        this.spawnGiftEffects(tierName, senderName, count);
        
        // Add to gift queue for tracking
        this.giftQueue.push({
            sender: senderName,
            gift: giftName,
            tier: tierName,
            count: count,
            time: Date.now()
        });
        
        // Keep only last 10 gifts
        if (this.giftQueue.length > 10) {
            this.giftQueue.shift();
        }
    }
    
    /**
     * Spawn game effects based on gift tier
     */
    spawnGiftEffects(tierName, senderName, count) {
        const config = CONFIG.GIFTS[tierName];
        
        // Medium+ gifts spawn obstacles
        if (config.spawnObstacle && this.onSpawnObstacle) {
            // Spawn 1-3 obstacles based on count
            const obstacleCount = Math.min(count, 3);
            for (let i = 0; i < obstacleCount; i++) {
                setTimeout(() => {
                    this.onSpawnObstacle(senderName);
                }, i * 500);
            }
            logEvent(`⚠️ ${senderName} spawned ${obstacleCount} obstacles!`);
        }
        
        // Large+ gifts spawn a competitor with gifter's name!
        if (config.spawnCompetitor && this.onSpawnCompetitor) {
            this.onSpawnCompetitor(senderName, this.getGifterColor(senderName));
            logEvent(`🏊 ${senderName} JOINS THE RACE!`);
        }
        
        // Epic gifts also spawn a power-up
        if (config.spawnPowerUp && this.onSpawnPowerUp) {
            this.onSpawnPowerUp();
            logEvent(`💊 POWER-UP INCOMING!`);
        }
    }
    
    /**
     * Get a unique color for a gifter based on their name
     */
    getGifterColor(name) {
        // Generate a color from the name hash
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Generate bright, saturated colors
        const hue = Math.abs(hash % 360);
        const color = new THREE.Color();
        color.setHSL(hue / 360, 0.9, 0.6);
        return color.getHex();
    }
    
    /**
     * Update gifter leaderboard
     */
    updateGifterLeaderboard(name, tier, value) {
        const existing = this.gifterLeaderboard.find(g => g.name === name);
        if (existing) {
            existing.totalValue += value;
            existing.giftCount++;
            existing.lastGift = Date.now();
        } else {
            this.gifterLeaderboard.push({
                name,
                totalValue: value,
                giftCount: 1,
                lastGift: Date.now(),
                highestTier: tier
            });
        }
        
        // Update highest tier if applicable
        if (existing) {
            const tierOrder = ['SMALL', 'MEDIUM', 'LARGE', 'EPIC'];
            if (tierOrder.indexOf(tier) > tierOrder.indexOf(existing.highestTier)) {
                existing.highestTier = tier;
            }
        }
        
        // Sort by total value
        this.gifterLeaderboard.sort((a, b) => b.totalValue - a.totalValue);
        
        // Keep top 10
        if (this.gifterLeaderboard.length > 10) {
            this.gifterLeaderboard = this.gifterLeaderboard.slice(0, 10);
        }
        
        this.totalGiftValue += value;
    }
    
    /**
     * Get top gifters
     */
    getTopGifters(count = 5) {
        return this.gifterLeaderboard.slice(0, count);
    }
    
    applyBoostEffect(tier, giftConfig, count) {
        // Add boost charges based on tier config
        const boostCharges = giftConfig.boostCharges * count;
        this.player.boostCharges += boostCharges;
        
        // Apply immediate impulse for visual feedback
        if (this.player.body) {
            const impulse = tier.boost * count * 0.3;
            this.player.body.applyImpulse(
                new CANNON.Vec3(0, 0, -impulse), 
                this.player.body.position
            );
        }
    }
    
    createGiftVisualEffect(tier, senderName, tierName) {
        // Create a floating gift notification
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        
        // Background with gradient based on tier
        const gradient = ctx.createLinearGradient(0, 0, 512, 0);
        gradient.addColorStop(0, `rgba(0, 0, 0, 0.8)`);
        gradient.addColorStop(0.5, `rgba(${(tier.color >> 16) & 0xFF}, ${(tier.color >> 8) & 0xFF}, ${tier.color & 0xFF}, 0.3)`);
        gradient.addColorStop(1, `rgba(0, 0, 0, 0.8)`);
        
        ctx.fillStyle = gradient;
        ctx.roundRect(0, 0, 512, 150, 20);
        ctx.fill();
        
        // Border glow
        ctx.strokeStyle = `#${tier.color.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 4;
        ctx.roundRect(2, 2, 508, 146, 18);
        ctx.stroke();
        
        // Tier badge
        ctx.font = "16px Arial";
        ctx.fillStyle = `#${tier.color.toString(16).padStart(6, '0')}`;
        ctx.textAlign = "center";
        ctx.fillText(`[ ${tierName} GIFT ]`, 256, 25);
        
        // Sender name with emoji
        ctx.font = "bold 36px Arial";
        ctx.fillStyle = `#${tier.color.toString(16).padStart(6, '0')}`;
        ctx.fillText(`${tier.emoji} ${senderName}`, 256, 65);
        
        // Effect description
        ctx.font = "20px Arial";
        ctx.fillStyle = "white";
        const effectText = this.getEffectDescription(tierName);
        ctx.fillText(effectText, 256, 100);
        
        // Coin value
        ctx.font = "bold 18px Arial";
        ctx.fillStyle = "#ffd700";
        ctx.fillText(`+${tier.coinValue} 🪙`, 256, 130);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            opacity: 1
        });
        const sprite = new THREE.Sprite(material);
        
        // Position above player
        sprite.position.copy(this.player.mesh.position);
        sprite.position.y += 6;
        sprite.scale.set(12, 3.5, 1);
        
        this.world.scene.add(sprite);
        
        // Create effect object for animation
        const effect = {
            sprite: sprite,
            age: 0,
            maxAge: tier.duration,
            tier: tier
        };
        
        this.giftEffects.push(effect);
        
        // Create particle burst
        this.createParticleBurst(tier.color);
    }
    
    getEffectDescription(tierName) {
        switch(tierName) {
            case 'SMALL': return '⚡ BOOST ADDED!';
            case 'MEDIUM': return '⚠️ OBSTACLE SPAWNED + BOOST!';
            case 'LARGE': return '🏊 NEW COMPETITOR + OBSTACLES!';
            case 'EPIC': return '🎉 ALL EFFECTS + POWER-UP!';
            default: return '⚡ BOOST ADDED!';
        }
    }
    
    createParticleBurst(color) {
        const colorObj = new THREE.Color(color);
        const positions = this.particleSystem.geometry.attributes.position.array;
        const colors = this.particleSystem.geometry.attributes.color.array;
        
        const playerPos = this.player.mesh.position;
        
        for (let i = 0; i < 200; i++) {
            // Spread particles around player
            positions[i * 3] = playerPos.x + (Math.random() - 0.5) * 5;
            positions[i * 3 + 1] = playerPos.y + (Math.random() - 0.5) * 5;
            positions[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 5;
            
            // Set color with some variation
            colors[i * 3] = colorObj.r * (0.8 + Math.random() * 0.2);
            colors[i * 3 + 1] = colorObj.g * (0.8 + Math.random() * 0.2);
            colors[i * 3 + 2] = colorObj.b * (0.8 + Math.random() * 0.2);
        }
        
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.color.needsUpdate = true;
        this.particleSystem.visible = true;
        
        // Store particle data for animation
        this.particles = [];
        for (let i = 0; i < 200; i++) {
            this.particles.push({
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                ),
                index: i
            });
        }
    }
    
    update(dt) {
        // Update gift visual effects
        for (let i = this.giftEffects.length - 1; i >= 0; i--) {
            const effect = this.giftEffects[i];
            effect.age += dt;
            
            // Animate
            effect.sprite.position.y += dt * 2;
            effect.sprite.material.opacity = 1 - (effect.age / effect.maxAge);
            
            // Follow player horizontally
            effect.sprite.position.x = this.player.mesh.position.x;
            effect.sprite.position.z = this.player.mesh.position.z - 5;
            
            // Remove expired effects
            if (effect.age >= effect.maxAge) {
                this.world.scene.remove(effect.sprite);
                effect.sprite.material.map.dispose();
                effect.sprite.material.dispose();
                this.giftEffects.splice(i, 1);
            }
        }
        
        // Update particles
        if (this.particles.length > 0) {
            const positions = this.particleSystem.geometry.attributes.position.array;
            let allDead = true;
            
            for (const particle of this.particles) {
                const idx = particle.index * 3;
                
                // Apply velocity and gravity
                positions[idx] += particle.velocity.x * dt;
                positions[idx + 1] += particle.velocity.y * dt - dt * 5; // Gravity
                positions[idx + 2] += particle.velocity.z * dt;
                
                // Slow down
                particle.velocity.multiplyScalar(0.98);
                
                if (particle.velocity.length() > 0.1) {
                    allDead = false;
                }
            }
            
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
            
            if (allDead) {
                this.particleSystem.visible = false;
                this.particles = [];
            }
        }
    }
    
    /**
     * Get recent gifts for leaderboard
     */
    getRecentGifts() {
        return this.giftQueue.slice(-5).reverse();
    }
    
    /**
     * External API for TikTok integration
     * Call this method when a TikTok gift event is received
     */
    onTikTokGift(data) {
        const { giftName, senderName, repeatCount } = data;
        this.triggerGift(giftName, senderName, repeatCount || 1);
    }
}
