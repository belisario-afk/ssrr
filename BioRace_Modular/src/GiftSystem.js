import * as THREE from 'three';
import * as CANNON from 'cannon';
import { logEvent } from './Utils.js';
import { CONFIG } from './Config.js';

/**
 * GiftSystem - Handles TikTok gift integration and effects
 * 
 * Gift Tiers:
 * - SMALL: Rose, TikTok (1-10 coins) - Minor boost
 * - MEDIUM: Drama Queen, GG (50-100 coins) - Speed boost + effect
 * - LARGE: Galaxy, Universe (500+ coins) - Major effect + permanent upgrade
 */
export class GiftSystem {
    constructor(world, player) {
        this.world = world;
        this.player = player;
        this.giftEffects = [];
        this.giftQueue = [];
        this.particles = [];
        
        // Gift tier definitions
        this.giftTiers = {
            SMALL: { boost: 2, duration: 1, color: 0xff69b4, emoji: '🌹' },
            MEDIUM: { boost: 5, duration: 3, color: 0x00ff88, emoji: '✨' },
            LARGE: { boost: 10, duration: 5, color: 0xffd700, emoji: '🌟' },
            EPIC: { boost: 15, duration: 8, color: 0xff00ff, emoji: '🚀' }
        };
        
        // Map gift names to tiers
        this.giftMapping = {
            // Small gifts
            'rose': 'SMALL',
            'tiktok': 'SMALL',
            'heart': 'SMALL',
            'ice_cream': 'SMALL',
            // Medium gifts
            'drama_queen': 'MEDIUM',
            'gg': 'MEDIUM',
            'doughnut': 'MEDIUM',
            'hand_heart': 'MEDIUM',
            // Large gifts
            'galaxy': 'LARGE',
            'lion': 'LARGE',
            'cap': 'LARGE',
            // Epic gifts
            'universe': 'EPIC',
            'planet': 'EPIC',
            'rocket': 'EPIC'
        };
        
        this.createParticleSystem();
        
        // Listen for keyboard triggers (for testing)
        this.setupTestKeys();
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
        
        // Log the gift
        logEvent(`${tier.emoji} GIFT FROM:\n${senderName}\n${giftName.toUpperCase()} x${count}`);
        
        // Apply boost to player
        this.applyBoostEffect(tier, count);
        
        // Create visual effect
        this.createGiftVisualEffect(tier, senderName);
        
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
    
    applyBoostEffect(tier, count) {
        // Add boost charges based on tier
        const boostCharges = Math.ceil(tier.boost * count * 0.5);
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
    
    createGiftVisualEffect(tier, senderName) {
        // Create a floating gift notification
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = `rgba(0, 0, 0, 0.7)`;
        ctx.roundRect(0, 0, 512, 128, 20);
        ctx.fill();
        
        // Border glow
        ctx.strokeStyle = `#${tier.color.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 4;
        ctx.roundRect(2, 2, 508, 124, 18);
        ctx.stroke();
        
        // Text
        ctx.font = "bold 36px Arial";
        ctx.fillStyle = `#${tier.color.toString(16).padStart(6, '0')}`;
        ctx.textAlign = "center";
        ctx.fillText(`${tier.emoji} ${senderName}`, 256, 50);
        
        ctx.font = "24px Arial";
        ctx.fillStyle = "white";
        ctx.fillText("SENT A GIFT!", 256, 90);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            opacity: 1
        });
        const sprite = new THREE.Sprite(material);
        
        // Position above player
        sprite.position.copy(this.player.mesh.position);
        sprite.position.y += 5;
        sprite.scale.set(10, 2.5, 1);
        
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
