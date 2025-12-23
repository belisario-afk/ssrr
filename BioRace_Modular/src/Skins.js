import * as THREE from 'three';

/**
 * Skins - Handles player customization with different skins and accessories
 * 
 * Skin Categories:
 * - BASE: Different sperm cell visual styles
 * - HATS: Accessories worn on the head
 * - TRAILS: Trail effects behind the player
 * - AURAS: Glowing effects around the player
 */
export const SKIN_CATALOG = {
    // Base skins - different cell appearances
    BASE: {
        'default': {
            name: 'Classic Cell',
            description: 'The standard swimmer',
            unlocked: true,
            price: 0,
            headScale: { x: 1, y: 1, z: 1.8 },
            tailLength: 3.5,
            tailWidth: 0.2
        },
        'golden': {
            name: 'Golden Champion',
            description: 'Shine bright like a winner',
            unlocked: false,
            price: 1000,
            headScale: { x: 1.1, y: 1.1, z: 2 },
            tailLength: 4,
            tailWidth: 0.25,
            material: {
                color: 0xffd700,
                metalness: 0.8,
                roughness: 0.2,
                emissiveIntensity: 0.5
            }
        },
        'neon': {
            name: 'Neon Racer',
            description: 'Cyberpunk swimmer',
            unlocked: false,
            price: 500,
            headScale: { x: 1, y: 1, z: 1.6 },
            tailLength: 4.5,
            tailWidth: 0.15,
            material: {
                emissiveIntensity: 1.0,
                roughness: 0.0
            },
            glowIntensity: 2
        },
        'chonky': {
            name: 'Chonky Boi',
            description: 'Extra thicc swimmer',
            unlocked: false,
            price: 750,
            headScale: { x: 1.4, y: 1.4, z: 1.5 },
            tailLength: 2.5,
            tailWidth: 0.4
        },
        'speedy': {
            name: 'Speed Demon',
            description: 'Built for velocity',
            unlocked: false,
            price: 800,
            headScale: { x: 0.8, y: 0.8, z: 2.5 },
            tailLength: 5,
            tailWidth: 0.1,
            speedBonus: 1.1
        },
        'crystal': {
            name: 'Crystal Cell',
            description: 'Made of pure energy',
            unlocked: false,
            price: 1500,
            headScale: { x: 1, y: 1, z: 1.8 },
            tailLength: 3.5,
            tailWidth: 0.2,
            material: {
                transmission: 0.9,
                opacity: 0.8,
                roughness: 0.0
            },
            usePhysicalMaterial: true
        }
    },
    
    // Hat accessories
    HATS: {
        'none': {
            name: 'No Hat',
            description: 'Natural look',
            unlocked: true,
            price: 0
        },
        'crown': {
            name: 'Crown',
            description: 'Royalty status',
            unlocked: false,
            price: 500,
            modelType: 'crown'
        },
        'halo': {
            name: 'Angel Halo',
            description: 'Holy swimmer',
            unlocked: false,
            price: 400,
            modelType: 'halo'
        },
        'devil_horns': {
            name: 'Devil Horns',
            description: 'Little devil',
            unlocked: false,
            price: 400,
            modelType: 'horns'
        },
        'party_hat': {
            name: 'Party Hat',
            description: 'Ready to celebrate',
            unlocked: false,
            price: 300,
            modelType: 'party'
        },
        'top_hat': {
            name: 'Top Hat',
            description: 'Distinguished gentleman',
            unlocked: false,
            price: 600,
            modelType: 'tophat'
        },
        'santa_hat': {
            name: 'Santa Hat',
            description: 'Festive spirit',
            unlocked: false,
            price: 350,
            modelType: 'santa'
        }
    },
    
    // Trail effects
    TRAILS: {
        'none': {
            name: 'No Trail',
            description: 'Keep it clean',
            unlocked: true,
            price: 0
        },
        'sparkle': {
            name: 'Sparkle Trail',
            description: 'Leave sparkles behind',
            unlocked: false,
            price: 300,
            particleColor: 0xffffff,
            particleCount: 20
        },
        'fire': {
            name: 'Fire Trail',
            description: 'Blazing path',
            unlocked: false,
            price: 450,
            particleColor: 0xff4400,
            particleCount: 30
        },
        'rainbow': {
            name: 'Rainbow Trail',
            description: 'Colorful swimmer',
            unlocked: false,
            price: 600,
            rainbow: true,
            particleCount: 25
        },
        'hearts': {
            name: 'Heart Trail',
            description: 'Spread the love',
            unlocked: false,
            price: 350,
            particleColor: 0xff69b4,
            particleCount: 15,
            shape: 'heart'
        },
        'stars': {
            name: 'Star Trail',
            description: 'Stellar swimmer',
            unlocked: false,
            price: 400,
            particleColor: 0xffff00,
            particleCount: 18,
            shape: 'star'
        }
    },
    
    // Aura effects (glowing around player)
    AURAS: {
        'none': {
            name: 'No Aura',
            description: 'No glow',
            unlocked: true,
            price: 0
        },
        'soft_glow': {
            name: 'Soft Glow',
            description: 'Gentle luminescence',
            unlocked: true,
            price: 0,
            intensity: 0.3,
            radius: 3
        },
        'pulse': {
            name: 'Pulsing Aura',
            description: 'Rhythmic energy',
            unlocked: false,
            price: 250,
            intensity: 0.6,
            radius: 4,
            pulse: true
        },
        'electric': {
            name: 'Electric Aura',
            description: 'Shocking presence',
            unlocked: false,
            price: 500,
            intensity: 0.8,
            radius: 5,
            color: 0x00ffff,
            electric: true
        },
        'flames': {
            name: 'Flame Aura',
            description: 'On fire!',
            unlocked: false,
            price: 550,
            intensity: 0.7,
            radius: 4,
            color: 0xff4400,
            flames: true
        }
    }
};

/**
 * SkinManager - Manages player skin selection and application
 */
export class SkinManager {
    constructor() {
        this.currentSkin = {
            base: 'default',
            hat: 'none',
            trail: 'none',
            aura: 'none'
        };
        
        this.unlockedItems = this.loadUnlocked();
        this.currency = this.loadCurrency();
        
        // Trail particle systems
        this.trailParticles = [];
    }
    
    loadUnlocked() {
        try {
            const saved = localStorage.getItem('biorace_unlocked');
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        
        // Default unlocked items
        return {
            BASE: ['default'],
            HATS: ['none'],
            TRAILS: ['none'],
            AURAS: ['none', 'soft_glow']
        };
    }
    
    saveUnlocked() {
        try {
            localStorage.setItem('biorace_unlocked', JSON.stringify(this.unlockedItems));
        } catch (e) {}
    }
    
    loadCurrency() {
        try {
            const saved = localStorage.getItem('biorace_currency');
            if (saved) return parseInt(saved);
        } catch (e) {}
        return 0;
    }
    
    saveCurrency() {
        try {
            localStorage.setItem('biorace_currency', this.currency.toString());
        } catch (e) {}
    }
    
    addCurrency(amount) {
        this.currency += amount;
        this.saveCurrency();
    }
    
    /**
     * Purchase an item
     * @returns {boolean} True if purchase successful
     */
    purchaseItem(category, itemId) {
        const catalog = SKIN_CATALOG[category];
        if (!catalog || !catalog[itemId]) return false;
        
        const item = catalog[itemId];
        
        // Already unlocked
        if (this.unlockedItems[category].includes(itemId)) return true;
        
        // Check price
        if (this.currency < item.price) return false;
        
        // Purchase
        this.currency -= item.price;
        this.unlockedItems[category].push(itemId);
        
        this.saveCurrency();
        this.saveUnlocked();
        
        return true;
    }
    
    /**
     * Equip an item
     */
    equipItem(category, itemId) {
        const catalog = SKIN_CATALOG[category];
        if (!catalog || !catalog[itemId]) return false;
        
        // Must be unlocked
        if (!this.unlockedItems[category].includes(itemId)) return false;
        
        switch(category) {
            case 'BASE': this.currentSkin.base = itemId; break;
            case 'HATS': this.currentSkin.hat = itemId; break;
            case 'TRAILS': this.currentSkin.trail = itemId; break;
            case 'AURAS': this.currentSkin.aura = itemId; break;
        }
        
        return true;
    }
    
    /**
     * Apply current skin to a player mesh
     */
    applySkinToPlayer(player) {
        const baseSkin = SKIN_CATALOG.BASE[this.currentSkin.base];
        const hatData = SKIN_CATALOG.HATS[this.currentSkin.hat];
        const trailData = SKIN_CATALOG.TRAILS[this.currentSkin.trail];
        const auraData = SKIN_CATALOG.AURAS[this.currentSkin.aura];
        
        // Apply base skin modifications
        this.applyBaseSkin(player, baseSkin);
        
        // Apply hat
        if (hatData && hatData.modelType) {
            this.applyHat(player, hatData);
        }
        
        // Apply trail
        if (trailData && trailData.particleCount) {
            this.applyTrail(player, trailData);
        }
        
        // Apply aura
        if (auraData && auraData.intensity) {
            this.applyAura(player, auraData);
        }
    }
    
    applyBaseSkin(player, skin) {
        // Find head mesh
        const head = player.mesh.children.find(c => c.geometry?.type === 'SphereGeometry');
        if (!head) return;
        
        // Apply scale
        if (skin.headScale) {
            head.scale.set(skin.headScale.x, skin.headScale.y, skin.headScale.z);
        }
        
        // Apply material properties
        if (skin.material) {
            Object.assign(head.material, skin.material);
            head.material.needsUpdate = true;
        }
    }
    
    applyHat(player, hat) {
        // Remove existing hat
        const existingHat = player.mesh.children.find(c => c.userData.isHat);
        if (existingHat) {
            player.mesh.remove(existingHat);
        }
        
        let hatMesh;
        
        switch(hat.modelType) {
            case 'crown':
                hatMesh = this.createCrown();
                break;
            case 'halo':
                hatMesh = this.createHalo();
                break;
            case 'horns':
                hatMesh = this.createHorns();
                break;
            case 'party':
                hatMesh = this.createPartyHat();
                break;
            case 'tophat':
                hatMesh = this.createTopHat();
                break;
            case 'santa':
                hatMesh = this.createSantaHat();
                break;
        }
        
        if (hatMesh) {
            hatMesh.userData.isHat = true;
            hatMesh.position.y = 0.6;
            hatMesh.position.z = -0.3;
            player.mesh.add(hatMesh);
        }
    }
    
    createCrown() {
        const group = new THREE.Group();
        
        // Base ring
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.4, 0.08, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.3 })
        );
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        
        // Points
        const pointGeo = new THREE.ConeGeometry(0.1, 0.3, 4);
        const pointMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.3 });
        
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const point = new THREE.Mesh(pointGeo, pointMat);
            point.position.x = Math.cos(angle) * 0.35;
            point.position.z = Math.sin(angle) * 0.35;
            point.position.y = 0.15;
            group.add(point);
        }
        
        return group;
    }
    
    createHalo() {
        const halo = new THREE.Mesh(
            new THREE.TorusGeometry(0.5, 0.05, 8, 32),
            new THREE.MeshStandardMaterial({ 
                color: 0xffff00, 
                emissive: 0xffff00, 
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.8
            })
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 0.3;
        return halo;
    }
    
    createHorns() {
        const group = new THREE.Group();
        const hornGeo = new THREE.ConeGeometry(0.1, 0.4, 8);
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 });
        
        const horn1 = new THREE.Mesh(hornGeo, hornMat);
        horn1.position.x = -0.3;
        horn1.rotation.z = -0.3;
        group.add(horn1);
        
        const horn2 = new THREE.Mesh(hornGeo, hornMat);
        horn2.position.x = 0.3;
        horn2.rotation.z = 0.3;
        group.add(horn2);
        
        return group;
    }
    
    createPartyHat() {
        const hat = new THREE.Mesh(
            new THREE.ConeGeometry(0.3, 0.6, 16),
            new THREE.MeshStandardMaterial({ 
                color: 0xff00ff,
                roughness: 0.5
            })
        );
        
        // Add pompom
        const pompom = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffff00 })
        );
        pompom.position.y = 0.35;
        hat.add(pompom);
        
        return hat;
    }
    
    createTopHat() {
        const group = new THREE.Group();
        
        // Brim
        const brim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
        );
        group.add(brim);
        
        // Top
        const top = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 0.5, 16),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
        );
        top.position.y = 0.25;
        group.add(top);
        
        // Band
        const band = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16),
            new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 })
        );
        band.position.y = 0.08;
        group.add(band);
        
        return group;
    }
    
    createSantaHat() {
        const group = new THREE.Group();
        
        // Main hat cone
        const hat = new THREE.Mesh(
            new THREE.ConeGeometry(0.35, 0.6, 16),
            new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.8 })
        );
        hat.rotation.z = 0.3;
        group.add(hat);
        
        // Fluffy brim
        const brim = new THREE.Mesh(
            new THREE.TorusGeometry(0.35, 0.1, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
        );
        brim.rotation.x = Math.PI / 2;
        brim.position.y = -0.1;
        group.add(brim);
        
        // Pompom
        const pompom = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
        );
        pompom.position.y = 0.35;
        pompom.position.x = 0.2;
        group.add(pompom);
        
        return group;
    }
    
    applyTrail(player, trail) {
        // Trail is handled in update loop
        player.trailData = trail;
    }
    
    applyAura(player, aura) {
        // Remove existing aura
        const existingAura = player.mesh.children.find(c => c.userData.isAura);
        if (existingAura) {
            player.mesh.remove(existingAura);
        }
        
        const auraMesh = new THREE.Mesh(
            new THREE.SphereGeometry(aura.radius || 2, 16, 16),
            new THREE.MeshBasicMaterial({
                color: aura.color || player.color,
                transparent: true,
                opacity: aura.intensity * 0.3,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending
            })
        );
        auraMesh.userData.isAura = true;
        auraMesh.userData.auraData = aura;
        player.mesh.add(auraMesh);
    }
    
    /**
     * Update trail and aura effects (call in game loop)
     */
    updateEffects(player, time) {
        // Update aura pulse
        const auraMesh = player.mesh.children.find(c => c.userData.isAura);
        if (auraMesh && auraMesh.userData.auraData) {
            const aura = auraMesh.userData.auraData;
            if (aura.pulse) {
                auraMesh.material.opacity = aura.intensity * 0.3 * (0.7 + Math.sin(time * 3) * 0.3);
            }
            if (aura.electric) {
                auraMesh.scale.setScalar(1 + Math.random() * 0.1);
            }
        }
    }
    
    /**
     * Get available items for shop display
     */
    getShopItems(category) {
        const catalog = SKIN_CATALOG[category];
        if (!catalog) return [];
        
        return Object.entries(catalog).map(([id, item]) => ({
            id,
            ...item,
            owned: this.unlockedItems[category]?.includes(id) || false,
            equipped: this.isEquipped(category, id)
        }));
    }
    
    isEquipped(category, itemId) {
        switch(category) {
            case 'BASE': return this.currentSkin.base === itemId;
            case 'HATS': return this.currentSkin.hat === itemId;
            case 'TRAILS': return this.currentSkin.trail === itemId;
            case 'AURAS': return this.currentSkin.aura === itemId;
        }
        return false;
    }
    
    /**
     * Save current equipped items
     */
    saveEquipped() {
        try {
            localStorage.setItem('biorace_equipped', JSON.stringify(this.currentSkin));
        } catch (e) {}
    }
    
    /**
     * Load saved equipped items
     */
    loadEquipped() {
        try {
            const saved = localStorage.getItem('biorace_equipped');
            if (saved) {
                this.currentSkin = JSON.parse(saved);
            }
        } catch (e) {}
    }
}
