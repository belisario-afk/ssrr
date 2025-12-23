import * as THREE from 'three';

/**
 * ParticleEffects - Manages particle systems for visual effects
 */
export class ParticleEffects {
    constructor(world) {
        this.world = world;
        this.particleSystems = [];
        this.trailSystems = new Map(); // Map player -> trail system
    }
    
    /**
     * Create a burst of particles at a position
     */
    createBurst(position, options = {}) {
        const {
            color = 0xffffff,
            count = 50,
            spread = 3,
            speed = 8,
            lifetime = 1.5,
            size = 0.2,
            gravity = -5
        } = options;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = [];
        
        for (let i = 0; i < count; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;
            
            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * spread * speed,
                (Math.random() - 0.5) * spread * speed,
                (Math.random() - 0.5) * spread * speed
            ));
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: color,
            size: size,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const particles = new THREE.Points(geometry, material);
        this.world.scene.add(particles);
        
        const system = {
            mesh: particles,
            velocities: velocities,
            age: 0,
            lifetime: lifetime,
            gravity: gravity,
            initialOpacity: 1
        };
        
        this.particleSystems.push(system);
        
        return system;
    }
    
    /**
     * Create a boost effect for a player
     */
    createBoostEffect(player) {
        const position = player.mesh.position.clone();
        
        // Ring burst
        this.createBurst(position, {
            color: 0x00ffff,
            count: 30,
            spread: 2,
            speed: 15,
            lifetime: 0.8,
            size: 0.3
        });
        
        // Core flash
        this.createFlash(position, 0x00ffff, 0.5);
    }
    
    /**
     * Create a flash effect at a position
     */
    createFlash(position, color = 0xffffff, duration = 0.3) {
        const geometry = new THREE.SphereGeometry(2, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const flash = new THREE.Mesh(geometry, material);
        flash.position.copy(position);
        this.world.scene.add(flash);
        
        const system = {
            mesh: flash,
            age: 0,
            lifetime: duration,
            initialScale: 1,
            isFlash: true
        };
        
        this.particleSystems.push(system);
        
        return system;
    }
    
    /**
     * Create a trail system for a player
     */
    createTrailSystem(player, options = {}) {
        const {
            color = player.color,
            count = 20,
            size = 0.15,
            rainbow = false
        } = options;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        
        const colorObj = new THREE.Color(color);
        
        for (let i = 0; i < count; i++) {
            positions[i * 3] = player.mesh.position.x;
            positions[i * 3 + 1] = player.mesh.position.y;
            positions[i * 3 + 2] = player.mesh.position.z;
            
            if (rainbow) {
                const hue = i / count;
                const c = new THREE.Color().setHSL(hue, 1, 0.5);
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            } else {
                colors[i * 3] = colorObj.r;
                colors[i * 3 + 1] = colorObj.g;
                colors[i * 3 + 2] = colorObj.b;
            }
            
            sizes[i] = size * (1 - i / count);
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            size: size,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const trail = new THREE.Points(geometry, material);
        this.world.scene.add(trail);
        
        const trailData = {
            mesh: trail,
            positions: [],
            maxLength: count,
            rainbow: rainbow
        };
        
        this.trailSystems.set(player, trailData);
        
        return trailData;
    }
    
    /**
     * Update trail for a player
     */
    updateTrail(player) {
        const trail = this.trailSystems.get(player);
        if (!trail) return;
        
        // Add current position to trail
        trail.positions.unshift(player.mesh.position.clone());
        
        // Keep trail at max length
        if (trail.positions.length > trail.maxLength) {
            trail.positions.pop();
        }
        
        // Update geometry
        const positionAttr = trail.mesh.geometry.attributes.position;
        const colorAttr = trail.mesh.geometry.attributes.color;
        
        for (let i = 0; i < trail.maxLength; i++) {
            const pos = trail.positions[i] || trail.positions[trail.positions.length - 1] || player.mesh.position;
            
            positionAttr.array[i * 3] = pos.x;
            positionAttr.array[i * 3 + 1] = pos.y;
            positionAttr.array[i * 3 + 2] = pos.z;
            
            // Rainbow effect updates
            if (trail.rainbow) {
                const hue = ((Date.now() / 1000) + i * 0.1) % 1;
                const c = new THREE.Color().setHSL(hue, 1, 0.5);
                colorAttr.array[i * 3] = c.r;
                colorAttr.array[i * 3 + 1] = c.g;
                colorAttr.array[i * 3 + 2] = c.b;
            }
        }
        
        positionAttr.needsUpdate = true;
        if (trail.rainbow) colorAttr.needsUpdate = true;
    }
    
    /**
     * Create speed lines effect around the camera
     */
    createSpeedLines(camera, intensity = 1) {
        const count = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 6); // 2 points per line
        const colors = new Float32Array(count * 6);
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 5 + Math.random() * 15;
            const length = 2 + Math.random() * 5;
            
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            // Start point
            positions[i * 6] = x;
            positions[i * 6 + 1] = y;
            positions[i * 6 + 2] = -10;
            
            // End point
            positions[i * 6 + 3] = x;
            positions[i * 6 + 4] = y;
            positions[i * 6 + 5] = -10 - length;
            
            // Colors (white, fading)
            const brightness = 0.5 + Math.random() * 0.5;
            colors[i * 6] = brightness;
            colors[i * 6 + 1] = brightness;
            colors[i * 6 + 2] = brightness;
            colors[i * 6 + 3] = brightness * 0.3;
            colors[i * 6 + 4] = brightness * 0.3;
            colors[i * 6 + 5] = brightness * 0.3;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: intensity * 0.5,
            blending: THREE.AdditiveBlending
        });
        
        const lines = new THREE.LineSegments(geometry, material);
        lines.frustumCulled = false;
        
        return lines;
    }
    
    /**
     * Update all particle systems
     */
    update(dt) {
        // Update burst/flash systems
        for (let i = this.particleSystems.length - 1; i >= 0; i--) {
            const system = this.particleSystems[i];
            system.age += dt;
            
            const progress = system.age / system.lifetime;
            
            if (system.isFlash) {
                // Flash effect - expand and fade
                system.mesh.scale.setScalar(1 + progress * 3);
                system.mesh.material.opacity = (1 - progress) * 0.8;
            } else {
                // Particle system - move and fade
                const positions = system.mesh.geometry.attributes.position.array;
                
                for (let j = 0; j < system.velocities.length; j++) {
                    const vel = system.velocities[j];
                    
                    positions[j * 3] += vel.x * dt;
                    positions[j * 3 + 1] += vel.y * dt + system.gravity * dt;
                    positions[j * 3 + 2] += vel.z * dt;
                    
                    // Slow down
                    vel.multiplyScalar(0.98);
                }
                
                system.mesh.geometry.attributes.position.needsUpdate = true;
                system.mesh.material.opacity = (1 - progress) * system.initialOpacity;
            }
            
            // Remove expired systems
            if (progress >= 1) {
                this.world.scene.remove(system.mesh);
                system.mesh.geometry.dispose();
                system.mesh.material.dispose();
                this.particleSystems.splice(i, 1);
            }
        }
        
        // Update trails
        for (const [player, trail] of this.trailSystems) {
            this.updateTrail(player);
        }
    }
    
    /**
     * Remove a player's trail
     */
    removeTrail(player) {
        const trail = this.trailSystems.get(player);
        if (trail) {
            this.world.scene.remove(trail.mesh);
            trail.mesh.geometry.dispose();
            trail.mesh.material.dispose();
            this.trailSystems.delete(player);
        }
    }
    
    /**
     * Cleanup all effects
     */
    dispose() {
        for (const system of this.particleSystems) {
            this.world.scene.remove(system.mesh);
            system.mesh.geometry.dispose();
            system.mesh.material.dispose();
        }
        this.particleSystems = [];
        
        for (const [player, trail] of this.trailSystems) {
            this.world.scene.remove(trail.mesh);
            trail.mesh.geometry.dispose();
            trail.mesh.material.dispose();
        }
        this.trailSystems.clear();
    }
}
