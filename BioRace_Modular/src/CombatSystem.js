import * as THREE from 'three';
import * as CANNON from 'cannon';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './Config.js';
import { logEvent } from './Utils.js';
import { getAudioSystem } from './AudioSystem.js';

/**
 * CombatSystem - Handles weapons, attacks, and combat mechanics
 * Phase 3 of major game upgrade
 */

// Weapon configurations
const WEAPONS = {
    SWORD: {
        name: 'Sword',
        damage: 25,
        range: 3,
        cooldown: 0.5,
        knockback: 5,
        type: 'melee',
        icon: '⚔️',
        model: './models/sword.glb'
    },
    DAGGER: {
        name: 'Dagger',
        damage: 15,
        range: 2,
        cooldown: 0.25,
        knockback: 2,
        type: 'melee',
        icon: '🗡️',
        model: './models/dagger.glb'
    },
    AXE: {
        name: 'Battle Axe',
        damage: 40,
        range: 3.5,
        cooldown: 1.0,
        knockback: 10,
        type: 'melee',
        icon: '🪓',
        model: './models/axe.glb'
    },
    GUN: {
        name: 'Pistol',
        damage: 20,
        range: 50,
        cooldown: 0.3,
        knockback: 3,
        type: 'ranged',
        projectileSpeed: 100,
        icon: '🔫',
        model: './models/gun.glb'
    },
    SHOTGUN: {
        name: 'Shotgun',
        damage: 35,
        range: 20,
        cooldown: 0.8,
        knockback: 8,
        type: 'ranged',
        projectileSpeed: 80,
        spread: 5, // Number of pellets
        icon: '🔫',
        model: './models/shotgun.glb'
    },
    LASER: {
        name: 'Laser Gun',
        damage: 15,
        range: 100,
        cooldown: 0.1,
        knockback: 1,
        type: 'hitscan', // Instant hit
        icon: '⚡',
        model: './models/laser.glb'
    }
};

export class CombatSystem {
    constructor(world, player) {
        this.world = world;
        this.player = player;
        this.projectiles = [];
        this.hitEffects = [];
        this.enemies = [];
        
        // GLTF Loader for weapon models
        this.gltfLoader = new GLTFLoader();
        this.weaponCache = {};
        
        // Preload weapon models
        this.preloadWeaponModels();
        
        // Combat stats
        this.totalDamageDealt = 0;
        this.enemiesDefeated = 0;
        
        // Audio
        this.audio = getAudioSystem();
    }
    
    /**
     * Preload weapon models
     */
    preloadWeaponModels() {
        for (const [key, weapon] of Object.entries(WEAPONS)) {
            this.gltfLoader.load(
                weapon.model,
                (gltf) => {
                    this.weaponCache[key] = gltf.scene;
                    console.log(`✓ Loaded weapon: ${weapon.name}`);
                },
                undefined,
                (error) => {
                    console.log(`Weapon model not found: ${weapon.model} - using procedural`);
                }
            );
        }
    }
    
    /**
     * Create a weapon mesh (from GLB or procedural)
     */
    createWeaponMesh(weaponType) {
        const config = WEAPONS[weaponType];
        if (!config) return null;
        
        // Try cached model first
        if (this.weaponCache[weaponType]) {
            const model = this.weaponCache[weaponType].clone();
            model.scale.set(0.5, 0.5, 0.5);
            return model;
        }
        
        // Create procedural weapon
        const weaponGroup = new THREE.Group();
        
        switch(weaponType) {
            case 'SWORD':
                this.createProceduralSword(weaponGroup);
                break;
            case 'DAGGER':
                this.createProceduralDagger(weaponGroup);
                break;
            case 'AXE':
                this.createProceduralAxe(weaponGroup);
                break;
            case 'GUN':
                this.createProceduralGun(weaponGroup);
                break;
            case 'SHOTGUN':
                this.createProceduralShotgun(weaponGroup);
                break;
            case 'LASER':
                this.createProceduralLaser(weaponGroup);
                break;
        }
        
        return weaponGroup;
    }
    
    createProceduralSword(group) {
        const bladeMat = new THREE.MeshStandardMaterial({ 
            color: 0xcccccc, 
            metalness: 0.9, 
            roughness: 0.2 
        });
        const handleMat = new THREE.MeshStandardMaterial({ 
            color: 0x4a2912, 
            roughness: 0.8 
        });
        
        // Blade
        const bladeGeom = new THREE.BoxGeometry(0.08, 1.2, 0.02);
        const blade = new THREE.Mesh(bladeGeom, bladeMat);
        blade.position.y = 0.6;
        group.add(blade);
        
        // Blade tip
        const tipGeom = new THREE.ConeGeometry(0.04, 0.3, 4);
        const tip = new THREE.Mesh(tipGeom, bladeMat);
        tip.position.y = 1.35;
        group.add(tip);
        
        // Handle
        const handleGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
        const handle = new THREE.Mesh(handleGeom, handleMat);
        group.add(handle);
        
        // Guard
        const guardGeom = new THREE.BoxGeometry(0.3, 0.05, 0.05);
        const guard = new THREE.Mesh(guardGeom, bladeMat);
        guard.position.y = 0.15;
        group.add(guard);
        
        // Pommel
        const pommelGeom = new THREE.SphereGeometry(0.06, 8, 8);
        const pommel = new THREE.Mesh(pommelGeom, bladeMat);
        pommel.position.y = -0.18;
        group.add(pommel);
    }
    
    createProceduralDagger(group) {
        const bladeMat = new THREE.MeshStandardMaterial({ 
            color: 0xaaaaaa, 
            metalness: 0.9, 
            roughness: 0.2 
        });
        const handleMat = new THREE.MeshStandardMaterial({ 
            color: 0x222222, 
            roughness: 0.6 
        });
        
        // Short blade
        const bladeGeom = new THREE.BoxGeometry(0.05, 0.5, 0.015);
        const blade = new THREE.Mesh(bladeGeom, bladeMat);
        blade.position.y = 0.3;
        group.add(blade);
        
        // Tip
        const tipGeom = new THREE.ConeGeometry(0.025, 0.15, 4);
        const tip = new THREE.Mesh(tipGeom, bladeMat);
        tip.position.y = 0.625;
        group.add(tip);
        
        // Handle
        const handleGeom = new THREE.CylinderGeometry(0.03, 0.035, 0.2, 8);
        const handle = new THREE.Mesh(handleGeom, handleMat);
        group.add(handle);
    }
    
    createProceduralAxe(group) {
        const metalMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            metalness: 0.8, 
            roughness: 0.3 
        });
        const woodMat = new THREE.MeshStandardMaterial({ 
            color: 0x5c3a21, 
            roughness: 0.9 
        });
        
        // Handle (long pole)
        const handleGeom = new THREE.CylinderGeometry(0.04, 0.05, 1.5, 8);
        const handle = new THREE.Mesh(handleGeom, woodMat);
        group.add(handle);
        
        // Axe head
        const headGeom = new THREE.BoxGeometry(0.4, 0.3, 0.08);
        const head = new THREE.Mesh(headGeom, metalMat);
        head.position.set(0.15, 0.6, 0);
        group.add(head);
        
        // Blade edge (curved)
        const edgeShape = new THREE.Shape();
        edgeShape.moveTo(0, -0.15);
        edgeShape.quadraticCurveTo(0.15, 0, 0, 0.15);
        edgeShape.lineTo(0, -0.15);
        
        const edgeGeom = new THREE.ExtrudeGeometry(edgeShape, { depth: 0.02, bevelEnabled: false });
        const edge = new THREE.Mesh(edgeGeom, metalMat);
        edge.position.set(0.35, 0.6, -0.01);
        group.add(edge);
    }
    
    createProceduralGun(group) {
        const gunMat = new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            metalness: 0.7, 
            roughness: 0.3 
        });
        const gripMat = new THREE.MeshStandardMaterial({ 
            color: 0x4a2912, 
            roughness: 0.9 
        });
        
        // Barrel
        const barrelGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
        const barrel = new THREE.Mesh(barrelGeom, gunMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.2;
        group.add(barrel);
        
        // Body
        const bodyGeom = new THREE.BoxGeometry(0.12, 0.15, 0.25);
        const body = new THREE.Mesh(bodyGeom, gunMat);
        group.add(body);
        
        // Grip
        const gripGeom = new THREE.BoxGeometry(0.08, 0.2, 0.1);
        const grip = new THREE.Mesh(gripGeom, gripMat);
        grip.position.y = -0.15;
        grip.rotation.x = 0.3;
        group.add(grip);
        
        // Trigger guard
        const guardGeom = new THREE.TorusGeometry(0.04, 0.01, 8, 8, Math.PI);
        const guard = new THREE.Mesh(guardGeom, gunMat);
        guard.position.set(0, -0.05, 0.02);
        guard.rotation.x = Math.PI / 2;
        group.add(guard);
    }
    
    createProceduralShotgun(group) {
        const metalMat = new THREE.MeshStandardMaterial({ 
            color: 0x444444, 
            metalness: 0.6, 
            roughness: 0.4 
        });
        const woodMat = new THREE.MeshStandardMaterial({ 
            color: 0x5c3a21, 
            roughness: 0.9 
        });
        
        // Double barrels
        const barrelGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8);
        const barrel1 = new THREE.Mesh(barrelGeom, metalMat);
        barrel1.rotation.x = Math.PI / 2;
        barrel1.position.set(-0.03, 0.05, 0.4);
        group.add(barrel1);
        
        const barrel2 = new THREE.Mesh(barrelGeom.clone(), metalMat);
        barrel2.rotation.x = Math.PI / 2;
        barrel2.position.set(0.03, 0.05, 0.4);
        group.add(barrel2);
        
        // Stock
        const stockGeom = new THREE.BoxGeometry(0.1, 0.15, 0.5);
        const stock = new THREE.Mesh(stockGeom, woodMat);
        stock.position.z = -0.25;
        group.add(stock);
        
        // Grip
        const gripGeom = new THREE.BoxGeometry(0.08, 0.2, 0.1);
        const grip = new THREE.Mesh(gripGeom, woodMat);
        grip.position.y = -0.1;
        grip.rotation.x = 0.4;
        group.add(grip);
    }
    
    createProceduralLaser(group) {
        const metalMat = new THREE.MeshStandardMaterial({ 
            color: 0x555555, 
            metalness: 0.8, 
            roughness: 0.2 
        });
        const glowMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x00ffff, 
            emissiveIntensity: 0.5 
        });
        
        // Main body
        const bodyGeom = new THREE.CylinderGeometry(0.05, 0.06, 0.4, 8);
        const body = new THREE.Mesh(bodyGeom, metalMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);
        
        // Energy cell
        const cellGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
        const cell = new THREE.Mesh(cellGeom, glowMat);
        cell.position.y = -0.08;
        group.add(cell);
        
        // Barrel tip (glowing)
        const tipGeom = new THREE.ConeGeometry(0.04, 0.1, 8);
        const tip = new THREE.Mesh(tipGeom, glowMat);
        tip.rotation.x = -Math.PI / 2;
        tip.position.z = 0.25;
        group.add(tip);
    }
    
    /**
     * Equip a weapon to a character
     */
    equipWeapon(character, weaponType) {
        const config = WEAPONS[weaponType];
        if (!config) {
            console.error(`Unknown weapon type: ${weaponType}`);
            return;
        }
        
        // Remove existing weapon
        if (character.weapon && character.weapon.mesh) {
            character.mesh.remove(character.weapon.mesh);
        }
        
        const weaponMesh = this.createWeaponMesh(weaponType);
        
        // Position at character's hand
        weaponMesh.position.set(0.7, 1.5, 0.3);
        
        character.weapon = {
            type: weaponType,
            config: config,
            mesh: weaponMesh,
            cooldownTimer: 0
        };
        
        character.mesh.add(weaponMesh);
        
        logEvent(`${config.icon} Equipped ${config.name}`);
    }
    
    /**
     * Perform attack with equipped weapon
     */
    attack(character, targets = []) {
        if (!character.weapon) return null;
        if (character.weapon.cooldownTimer > 0) return null;
        
        const weapon = character.weapon;
        const config = weapon.config;
        
        // Set cooldown
        weapon.cooldownTimer = config.cooldown;
        
        // Play attack animation
        this.playAttackAnimation(character, weapon);
        
        // Handle different weapon types
        let hitResults = [];
        
        switch(config.type) {
            case 'melee':
                hitResults = this.performMeleeAttack(character, config, targets);
                break;
            case 'ranged':
                this.spawnProjectile(character, config);
                break;
            case 'hitscan':
                hitResults = this.performHitscanAttack(character, config, targets);
                break;
        }
        
        return hitResults;
    }
    
    /**
     * Play attack animation
     */
    playAttackAnimation(character, weapon) {
        if (!weapon.mesh) return;
        
        const config = weapon.config;
        
        if (config.type === 'melee') {
            // Swing animation
            const originalRotation = weapon.mesh.rotation.x;
            weapon.mesh.rotation.x = -1.5;
            
            setTimeout(() => {
                if (weapon.mesh) {
                    weapon.mesh.rotation.x = originalRotation;
                }
            }, 200);
        } else {
            // Recoil animation for guns
            const originalZ = weapon.mesh.position.z;
            weapon.mesh.position.z -= 0.1;
            
            setTimeout(() => {
                if (weapon.mesh) {
                    weapon.mesh.position.z = originalZ;
                }
            }, 100);
            
            // Muzzle flash
            this.createMuzzleFlash(weapon.mesh);
        }
        
        this.audio.playSFX('hit');
    }
    
    /**
     * Create muzzle flash effect
     */
    createMuzzleFlash(weaponMesh) {
        const flashGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ 
            color: 0xffff00, 
            transparent: true, 
            opacity: 0.8 
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.z = 0.5;
        weaponMesh.add(flash);
        
        // Remove after brief moment
        setTimeout(() => {
            weaponMesh.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
        }, 50);
    }
    
    /**
     * Perform melee attack
     */
    performMeleeAttack(character, config, targets) {
        const hitResults = [];
        const attackPos = character.body.position.clone();
        const attackDir = new THREE.Vector3(0, 0, -1).applyQuaternion(character.mesh.quaternion);
        
        for (const target of targets) {
            if (target === character) continue;
            if (target.isDead) continue;
            
            const toTarget = new THREE.Vector3().subVectors(
                target.body.position, 
                attackPos
            );
            const distance = toTarget.length();
            
            // Check range
            if (distance > config.range) continue;
            
            // Check angle (frontal arc)
            toTarget.normalize();
            const dot = attackDir.dot(toTarget);
            if (dot < 0.5) continue; // ~60 degree arc
            
            // Hit!
            const damage = config.damage;
            target.takeDamage(damage, character);
            
            hitResults.push({
                target: target,
                damage: damage,
                position: target.body.position.clone()
            });
            
            // Apply knockback
            const knockbackDir = toTarget.multiplyScalar(config.knockback);
            target.body.velocity.x += knockbackDir.x;
            target.body.velocity.z += knockbackDir.z;
            
            // Hit effect
            this.createHitEffect(target.body.position.clone());
            
            this.totalDamageDealt += damage;
        }
        
        return hitResults;
    }
    
    /**
     * Spawn a projectile
     */
    spawnProjectile(character, config) {
        const startPos = character.body.position.clone();
        startPos.y += 1.5; // Adjust to weapon height
        
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(character.mesh.quaternion);
        
        // For shotgun, spawn multiple pellets
        const numProjectiles = config.spread || 1;
        
        for (let i = 0; i < numProjectiles; i++) {
            const projectileDir = direction.clone();
            
            // Add spread for shotgun
            if (config.spread) {
                projectileDir.x += (Math.random() - 0.5) * 0.2;
                projectileDir.y += (Math.random() - 0.5) * 0.2;
                projectileDir.normalize();
            }
            
            const projectile = this.createProjectile(startPos.clone(), projectileDir, config, character);
            this.projectiles.push(projectile);
        }
    }
    
    /**
     * Create a projectile
     */
    createProjectile(position, direction, config, owner) {
        const bulletGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const bulletMat = new THREE.MeshBasicMaterial({ 
            color: config.type === 'laser' ? 0x00ffff : 0xffff00 
        });
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.copy(position);
        this.world.scene.add(bullet);
        
        // Trail effect
        const trailGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
        const trailMat = new THREE.MeshBasicMaterial({ 
            color: 0xffaa00, 
            transparent: true, 
            opacity: 0.5 
        });
        const trail = new THREE.Mesh(trailGeo, trailMat);
        trail.rotation.x = Math.PI / 2;
        trail.position.z = 0.25;
        bullet.add(trail);
        
        return {
            mesh: bullet,
            velocity: direction.multiplyScalar(config.projectileSpeed || 50),
            damage: config.damage,
            knockback: config.knockback,
            owner: owner,
            lifetime: config.range / (config.projectileSpeed || 50),
            age: 0
        };
    }
    
    /**
     * Perform hitscan attack (instant hit)
     */
    performHitscanAttack(character, config, targets) {
        const hitResults = [];
        const startPos = character.body.position.clone();
        startPos.y += 1.5;
        
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(character.mesh.quaternion);
        
        // Create laser beam visual
        this.createLaserBeam(startPos, direction, config.range);
        
        // Find first target in line
        let closestHit = null;
        let closestDist = config.range;
        
        for (const target of targets) {
            if (target === character) continue;
            if (target.isDead) continue;
            
            const toTarget = new THREE.Vector3().subVectors(
                target.body.position, 
                startPos
            );
            
            // Project onto direction
            const projection = direction.clone().multiplyScalar(toTarget.dot(direction));
            const perpDist = toTarget.clone().sub(projection).length();
            
            // Check if close enough to ray
            if (perpDist < 1.0) { // Hit radius
                const dist = projection.length();
                if (dist < closestDist && dist > 0) {
                    closestDist = dist;
                    closestHit = target;
                }
            }
        }
        
        if (closestHit) {
            closestHit.takeDamage(config.damage, character);
            
            hitResults.push({
                target: closestHit,
                damage: config.damage,
                position: closestHit.body.position.clone()
            });
            
            this.createHitEffect(closestHit.body.position.clone());
            this.totalDamageDealt += config.damage;
        }
        
        return hitResults;
    }
    
    /**
     * Create laser beam visual
     */
    createLaserBeam(startPos, direction, length) {
        const beamGeo = new THREE.CylinderGeometry(0.02, 0.02, length, 8);
        const beamMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.8 
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        
        // Position at midpoint
        const midpoint = startPos.clone().add(direction.clone().multiplyScalar(length / 2));
        beam.position.copy(midpoint);
        
        // Align with direction
        beam.lookAt(startPos.clone().add(direction));
        beam.rotateX(Math.PI / 2);
        
        this.world.scene.add(beam);
        
        // Fade out
        setTimeout(() => {
            this.world.scene.remove(beam);
            beam.geometry.dispose();
            beam.material.dispose();
        }, 100);
    }
    
    /**
     * Create hit effect at position
     */
    createHitEffect(position) {
        // Particles
        const particleCount = 10;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.SphereGeometry(0.05, 4, 4);
            const mat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
            const particle = new THREE.Mesh(geo, mat);
            
            particle.position.copy(position);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 5,
                (Math.random() - 0.5) * 10
            );
            
            this.world.scene.add(particle);
            particles.push({ mesh: particle, age: 0 });
        }
        
        this.hitEffects.push(...particles);
    }
    
    /**
     * Update combat system
     */
    update(dt, targets = []) {
        // Update weapon cooldowns
        if (this.player.weapon) {
            this.player.weapon.cooldownTimer -= dt;
            if (this.player.weapon.cooldownTimer < 0) {
                this.player.weapon.cooldownTimer = 0;
            }
        }
        
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            
            // Move
            proj.mesh.position.add(proj.velocity.clone().multiplyScalar(dt));
            proj.age += dt;
            
            // Check lifetime
            if (proj.age > proj.lifetime) {
                this.world.scene.remove(proj.mesh);
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Check collisions with targets
            for (const target of targets) {
                if (target === proj.owner) continue;
                if (target.isDead) continue;
                
                const dist = proj.mesh.position.distanceTo(target.body.position);
                if (dist < 1.5) {
                    // Hit!
                    target.takeDamage(proj.damage, proj.owner);
                    
                    // Knockback
                    const knockDir = proj.velocity.clone().normalize().multiplyScalar(proj.knockback);
                    target.body.velocity.x += knockDir.x;
                    target.body.velocity.z += knockDir.z;
                    
                    this.createHitEffect(proj.mesh.position.clone());
                    this.totalDamageDealt += proj.damage;
                    
                    // Remove projectile
                    this.world.scene.remove(proj.mesh);
                    this.projectiles.splice(i, 1);
                    break;
                }
            }
        }
        
        // Update hit effects
        for (let i = this.hitEffects.length - 1; i >= 0; i--) {
            const effect = this.hitEffects[i];
            effect.age += dt;
            
            if (effect.mesh.velocity) {
                effect.mesh.position.add(effect.mesh.velocity.clone().multiplyScalar(dt));
                effect.mesh.velocity.y -= 20 * dt; // Gravity
            }
            
            // Fade out
            if (effect.mesh.material.opacity !== undefined) {
                effect.mesh.material.opacity = Math.max(0, 1 - effect.age * 2);
            }
            
            if (effect.age > 0.5) {
                this.world.scene.remove(effect.mesh);
                effect.mesh.geometry.dispose();
                effect.mesh.material.dispose();
                this.hitEffects.splice(i, 1);
            }
        }
    }
    
    /**
     * Get available weapons
     */
    static getWeaponTypes() {
        return Object.keys(WEAPONS);
    }
    
    /**
     * Get weapon config
     */
    static getWeaponConfig(type) {
        return WEAPONS[type];
    }
}
