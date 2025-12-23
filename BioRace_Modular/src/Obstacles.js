import * as THREE from 'three';
import * as CANNON from 'cannon';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { logEvent } from './Utils.js';
import { CONFIG } from './Config.js';

export class ObstacleManager {
    constructor(world, player) {
        this.world = world;
        this.player = player;
        this.obstacles = [];
        
        this.mockNames = ["User99", "Mikey_T", "Sarah_x", "BigDave", "Guest_1", "SpeedyBoi", "TikTok_Fan", "UrMom", "NoScope"];
        
        // GLTF Loader for custom models
        this.gltfLoader = new GLTFLoader();
        
        // Cache for loaded models (clone from these)
        this.modelCache = {};
        
        // Model scale configurations for each type
        this.modelScales = {
            'CONDOM': { x: 150, y: 150, z: 150 },
            'CUCUMBER': { x: 143, y: 143, z: 143 },
            'BANANA': { x: 3, y: 3, z: 3 },
            'IUD': { x: 3, y: 3, z: 3 },
            'HAIRBRUSH': { x: 3, y: 3, z: 3 }
        };
        
        // Collision radius for each model type (for better hit detection)
        this.collisionRadii = {
            'CONDOM': 5,
            'CUCUMBER': 4,
            'BANANA': 3,
            'IUD': 3.5,
            'HAIRBRUSH': 3
        };
        
        // Movement behavior for each obstacle type
        // 'straight' = moves toward player along Z axis, player must dodge to walls
        // 'floating' = floats/drifts inside tube
        this.movementTypes = {
            'CONDOM': 'straight',
            'CUCUMBER': 'straight',
            'BANANA': 'straight',
            'IUD': 'floating',
            'HAIRBRUSH': 'floating'
        };
        
        // Speed at which obstacles move toward player (negative Z)
        this.obstacleSpeed = {
            'CONDOM': 15,
            'CUCUMBER': 20,
            'BANANA': 18,
            'IUD': 8,
            'HAIRBRUSH': 10
        };
        
        // Spin speed for each obstacle type
        this.spinSpeed = {
            'CONDOM': 0.5,
            'CUCUMBER': 2,
            'BANANA': 1.5,
            'IUD': 1,
            'HAIRBRUSH': 0.8
        };
        
        // Preload custom models
        this.preloadModels();

        // Listen for Spawn Keys - 5 obstacle types + power-up
        window.addEventListener('keydown', (e) => {
            if(e.key === '1') this.spawn('CONDOM');      // Condom - stuns player
            if(e.key === '2') this.spawn('CUCUMBER');    // Cucumber - damage/setback
            if(e.key === '3') this.spawn('BANANA');      // Banana - minor damage
            if(e.key === '4') this.spawn('IUD');         // IUD - heavy damage
            if(e.key === '5') this.spawn('HAIRBRUSH');   // Hairbrush - stun
            if(e.key === '6') this.spawn('FALLEN');      // Fallen swimmer (no damage)
            if(e.key === '7') this.spawn('PILL');        // Power-up
        });
    }
    
    /**
     * Preload all custom 3D models
     * Models should be placed in /models folder as .glb files
     */
    preloadModels() {
        const modelFiles = {
            'CONDOM': './models/condom.glb',
            'CUCUMBER': './models/cucumber.glb',
            'BANANA': './models/banana.glb',
            'IUD': './models/iud.glb',
            'HAIRBRUSH': './models/hairbrush.glb'
        };
        
        for (const [type, path] of Object.entries(modelFiles)) {
            this.gltfLoader.load(
                path,
                (gltf) => {
                    this.modelCache[type] = gltf.scene;
                    console.log(`✓ Loaded model: ${type}`);
                },
                undefined,
                (error) => {
                    console.log(`Model not found: ${path} - using fallback geometry`);
                }
            );
        }
    }
    
    /**
     * Get a random spawn position INSIDE the tunnel
     * For 'straight' obstacles: spawn in center area so player must dodge to walls
     * For 'floating' obstacles: can spawn anywhere in tube
     * @param {string} movementType - 'straight' or 'floating'
     * @returns {object} {x, y} coordinates within tunnel radius
     */
    getSpawnPositionInTube(movementType = 'floating') {
        if (movementType === 'straight') {
            // Spawn in center area - player must move to walls to dodge
            const maxRadius = CONFIG.TUNNEL_RADIUS * 0.3; // Only center 30%
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * maxRadius;
            return {
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance
            };
        } else {
            // Floating obstacles can spawn anywhere inside tube
            const maxRadius = CONFIG.TUNNEL_RADIUS * 0.7;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * maxRadius;
            return {
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance
            };
        }
    }
    
    /**
     * Get a model from cache or return null if not loaded
     */
    getModel(type) {
        if (this.modelCache[type]) {
            const clone = this.modelCache[type].clone();
            // Ensure materials are cloned properly
            clone.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                }
            });
            return clone;
        }
        return null;
    }

    createNameSprite(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "rgba(0, 0, 0, 0)"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 40px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 4;
        ctx.strokeText(name, 128, 64);
        ctx.fillText(name, 128, 64);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(4, 2, 1);
        return sprite;
    }

    createFallenSpermMesh(color) {
        const group = new THREE.Group();
        const headGeo = new THREE.SphereGeometry(0.45, 16, 16); 
        const headMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8, metalness: 0.0 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.scale.set(1, 1, 1.6);
        group.add(head);

        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.2, -0.3, 0.8),
            new THREE.Vector3(-0.3, 0.2, 1.5),
            new THREE.Vector3(0.1, -0.4, 2.5)
        ]);
        const tailGeo = new THREE.TubeGeometry(curve, 8, 0.1, 8, false);
        const tailMat = new THREE.MeshStandardMaterial({ color: color });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.z = 0.4;
        group.add(tail);
        return group;
    }

    spawn(type) {
        const group = new THREE.Group();
        let body;
        const spawnZ = this.player.body.position.z - 80;
        
        // Get movement type for this obstacle
        const movementType = this.movementTypes[type] || 'floating';
        
        // Get spawn position INSIDE the tube based on movement type
        const spawnPos = this.getSpawnPositionInTube(movementType);
        let randX = spawnPos.x;
        let randY = spawnPos.y;
        
        // Try to use custom model if available
        const customModel = this.getModel(type);
        
        // Get scale for this model type
        const scale = this.modelScales[type] || { x: 2, y: 2, z: 2 };
        
        // Get collision radius for this model type (for better GLB collision)
        const collisionRadius = this.collisionRadii[type] || 2;
        
        // Get speeds for this obstacle type
        const speed = this.obstacleSpeed[type] || 10;
        const spin = this.spinSpeed[type] || 1;

        if (type === 'CONDOM') {
            // CONDOM - Stuns player for 2 seconds
            if (customModel) {
                customModel.scale.set(scale.x, scale.y, scale.z);
                group.add(customModel);
            } else {
                // Fallback - translucent cylinder
                const geo = new THREE.CylinderGeometry(2, 2, 6, 32, 1, true);
                const mat = new THREE.MeshPhysicalMaterial({ 
                    color: 0xffffdd, 
                    transmission: 0.9, 
                    opacity: 0.7, 
                    transparent: true,
                    side: THREE.DoubleSide 
                });
                group.add(new THREE.Mesh(geo, mat));
            }
            // Use sphere collision for better GLB model detection
            const shape = new CANNON.Sphere(collisionRadius);
            body = new CANNON.Body({ mass: 2, shape: shape });
            
            // Collision effect: STUN
            body.addEventListener("collide", (e) => {
                if(e.body === this.player.body && !body.hasHit) {
                    body.hasHit = true;
                    this.player.stun(2); // Stun for 2 seconds
                }
            });
            
            logEvent("⚠️ CONDOM!\nSTUNS ON HIT");

        } else if (type === 'CUCUMBER') {
            // CUCUMBER - Deals damage (setback 50m)
            if (customModel) {
                customModel.scale.set(scale.x, scale.y, scale.z);
                group.add(customModel);
            } else {
                // Fallback - green cylinder
                const geo = new THREE.CylinderGeometry(0.8, 0.8, 5, 16);
                const mat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.6 });
                group.add(new THREE.Mesh(geo, mat));
                // Add bumps
                for(let i = 0; i < 8; i++) {
                    const bump = new THREE.Mesh(
                        new THREE.SphereGeometry(0.15, 8, 8),
                        mat
                    );
                    bump.position.set(
                        Math.cos(i * Math.PI/4) * 0.7,
                        (Math.random() - 0.5) * 4,
                        Math.sin(i * Math.PI/4) * 0.7
                    );
                    group.add(bump);
                }
            }
            // Use sphere collision for better GLB model detection
            const shape = new CANNON.Sphere(collisionRadius);
            body = new CANNON.Body({ mass: 5, shape: shape });
            
            // Collision effect: DAMAGE (setback)
            body.addEventListener("collide", (e) => {
                if(e.body === this.player.body && !body.hasHit) {
                    body.hasHit = true;
                    this.player.takeDamage(50); // Push back 50 meters
                }
            });
            
            logEvent("🥒 CUCUMBER!\nDAMAGE ON HIT");

        } else if (type === 'BANANA') {
            // BANANA - Minor damage (setback 25m)
            if (customModel) {
                customModel.scale.set(scale.x, scale.y, scale.z);
                group.add(customModel);
            } else {
                // Fallback - yellow curved cylinder
                const curve = new THREE.QuadraticBezierCurve3(
                    new THREE.Vector3(0, -2, 0),
                    new THREE.Vector3(1, 0, 0),
                    new THREE.Vector3(0, 2, 0)
                );
                const geo = new THREE.TubeGeometry(curve, 20, 0.5, 8, false);
                const mat = new THREE.MeshStandardMaterial({ color: 0xffe135, roughness: 0.4 });
                group.add(new THREE.Mesh(geo, mat));
            }
            // Use sphere collision for better GLB model detection
            const shape = new CANNON.Sphere(collisionRadius);
            body = new CANNON.Body({ mass: 3, shape: shape });
            
            // Collision effect: MINOR DAMAGE
            body.addEventListener("collide", (e) => {
                if(e.body === this.player.body && !body.hasHit) {
                    body.hasHit = true;
                    this.player.takeDamage(25); // Push back 25 meters
                }
            });
            
            logEvent("🍌 BANANA!\nSLIP DAMAGE");

        } else if (type === 'IUD') {
            // IUD - Heavy damage (setback 75m)
            if (customModel) {
                customModel.scale.set(scale.x, scale.y, scale.z);
                group.add(customModel);
            } else {
                // Fallback - T-shaped copper device
                const cMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.2 });
                const vertical = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4), cMat);
                const horizontal = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3), cMat);
                horizontal.rotation.z = Math.PI/2;
                horizontal.position.y = 1.5;
                group.add(vertical);
                group.add(horizontal);
            }
            // Use sphere collision for better GLB model detection
            const shape = new CANNON.Sphere(collisionRadius);
            body = new CANNON.Body({ mass: 6, shape: shape });
            
            // Collision effect: HEAVY DAMAGE
            body.addEventListener("collide", (e) => {
                if(e.body === this.player.body && !body.hasHit) {
                    body.hasHit = true;
                    this.player.takeDamage(75); // Push back 75 meters
                }
            });
            
            logEvent("⚠️ IUD!\nHEAVY DAMAGE");

        } else if (type === 'HAIRBRUSH') {
            // HAIRBRUSH - Stun (1.5 seconds)
            if (customModel) {
                customModel.scale.set(scale.x, scale.y, scale.z);
                group.add(customModel);
            } else {
                // Fallback - brush shape
                const handleGeo = new THREE.BoxGeometry(0.4, 0.4, 5);
                const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 });
                group.add(new THREE.Mesh(handleGeo, handleMat));
                
                const headGeo = new THREE.BoxGeometry(1.5, 0.5, 2);
                const headMat = new THREE.MeshStandardMaterial({ color: 0x2f1810 });
                const head = new THREE.Mesh(headGeo, headMat);
                head.position.z = -3;
                group.add(head);
                
                // Bristles
                const bristleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
                for(let i = 0; i < 20; i++) {
                    const bristle = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4),
                        bristleMat
                    );
                    bristle.position.set(
                        (Math.random() - 0.5) * 1.2,
                        0.4,
                        -3 + (Math.random() - 0.5) * 1.5
                    );
                    group.add(bristle);
                }
            }
            // Use sphere collision for better GLB model detection
            const shape = new CANNON.Sphere(collisionRadius);
            body = new CANNON.Body({ mass: 4, shape: shape });
            
            // Collision effect: STUN
            body.addEventListener("collide", (e) => {
                if(e.body === this.player.body && !body.hasHit) {
                    body.hasHit = true;
                    this.player.stun(1.5); // Stun for 1.5 seconds
                }
            });
            
            logEvent("🪥 HAIRBRUSH!\nSTUN ON HIT");

        } else if (type === 'FALLEN') {
            const skinTones = [0xffdbac, 0xf1c27d, 0xe0ac69, 0x8d5524, 0xffe0bd, 0xfffff0];
            const randColor = skinTones[Math.floor(Math.random() * skinTones.length)];
            group.add(this.createFallenSpermMesh(randColor));
            const name = this.mockNames[Math.floor(Math.random() * this.mockNames.length)];
            const sprite = this.createNameSprite(name);
            sprite.position.y = 1.8; 
            group.add(sprite);
            const shape = new CANNON.Sphere(0.6);
            body = new CANNON.Body({ mass: 2, shape: shape, linearDamping: 0.8 });
            
            // Fallen swimmers can be on the walls or floating inside
            const isGrounded = Math.random() > 0.4;
            if (isGrounded) {
                // Place near walls but still inside tube
                const angle = Math.random() * Math.PI * 2;
                const radius = CONFIG.TUNNEL_RADIUS * 0.85; // Near edge but inside
                randX = Math.cos(angle) * radius;
                randY = Math.sin(angle) * radius;
                const q = new CANNON.Quaternion();
                q.setFromAxisAngle(new CANNON.Vec3(Math.random(), Math.random(), Math.random()), Math.random() * Math.PI);
                body.quaternion.copy(q);
                body.linearDamping = 0.99;
            } else {
                body.angularVelocity.set(Math.random()*0.5, Math.random()*0.5, Math.random()*0.5);
            }
            logEvent(`💀 RIVAL DOWN:\n${name}`);

        } else if (type === 'PILL') {
            // Power-Up Logic
            const pillGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 32);
            const pillMat = new THREE.MeshPhysicalMaterial({ color: 0x0088ff, roughness: 0.2, clearcoat: 1.0 });
            const pill = new THREE.Mesh(pillGeo, pillMat);
            const cross = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 0.1), new THREE.MeshBasicMaterial({color: 0xffffff}));
            cross.position.y = 0.26;
            cross.rotation.x = Math.PI/2;
            pill.add(cross);
            group.add(pill);

            const shape = new CANNON.Cylinder(1.5, 1.5, 0.5, 16);
            const q = new CANNON.Quaternion();
            q.setFromAxisAngle(new CANNON.Vec3(1,0,0), Math.PI/2);
            body = new CANNON.Body({ mass: 1, shape: shape, angularDamping: 0.5 });
            body.quaternion.copy(q);
            body.angularVelocity.set(0, 2, 0);

            // COLLISION LISTENER FOR PILL
            body.addEventListener("collide", (e) => {
                if(e.body === this.player.body) {
                    body.shouldRemove = true; // Flag for cleanup
                    this.player.refillBoost();
                }
            });

            logEvent("💊 POWER-UP:\nBOOST REFILL");
        }

        body.position.set(randX, randY, spawnZ);
        
        // Set up movement based on type
        if (movementType === 'straight') {
            // Straight obstacles move toward player along Z axis with controlled spin
            body.velocity.set(0, 0, speed); // Move toward player (positive Z)
            body.angularVelocity.set(spin, spin * 0.5, 0); // Controlled spin around X/Y
            body.linearDamping = 0; // No slowdown
            body.angularDamping = 0.1;
        } else if (type !== 'CONDOM' && type !== 'FALLEN' && type !== 'PILL') {
            // Floating obstacles have gentle random movement and spin
            body.angularVelocity.set(
                (Math.random() - 0.5) * spin,
                (Math.random() - 0.5) * spin,
                (Math.random() - 0.5) * spin
            );
            body.linearDamping = 0.95;
        }

        this.world.physicsWorld.addBody(body);
        this.world.scene.add(group);
        this.obstacles.push({ mesh: group, body: body, type: type, movementType: movementType, speed: speed });
    }

    update() {
        const tunnelRadius = CONFIG.TUNNEL_RADIUS * 0.95; // Keep obstacles inside tube
        
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const o = this.obstacles[i];
            
            // Check for collision removal (Pill)
            if (o.body.shouldRemove) {
                this.world.physicsWorld.removeBody(o.body);
                this.world.scene.remove(o.mesh);
                this.obstacles.splice(i, 1);
                continue;
            }
            
            // Keep obstacles inside the tube (constrain X/Y position)
            const pos = o.body.position;
            const distFromCenter = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
            if (distFromCenter > tunnelRadius) {
                // Push back toward center
                const angle = Math.atan2(pos.y, pos.x);
                pos.x = Math.cos(angle) * tunnelRadius;
                pos.y = Math.sin(angle) * tunnelRadius;
                // Bounce velocity inward
                o.body.velocity.x *= -0.5;
                o.body.velocity.y *= -0.5;
            }
            
            // For straight-moving obstacles, maintain constant forward velocity
            if (o.movementType === 'straight') {
                // Keep moving toward player at constant speed
                o.body.velocity.z = o.speed;
                // Constrain X/Y velocity to prevent drifting
                o.body.velocity.x *= 0.9;
                o.body.velocity.y *= 0.9;
            }

            o.mesh.position.copy(o.body.position);
            o.mesh.quaternion.copy(o.body.quaternion);

            // Remove obstacles that have passed the player
            if (o.mesh.position.z > this.player.body.position.z + 50) {
                this.world.physicsWorld.removeBody(o.body);
                this.world.scene.remove(o.mesh);
                this.obstacles.splice(i, 1);
            }
        }
    }
}