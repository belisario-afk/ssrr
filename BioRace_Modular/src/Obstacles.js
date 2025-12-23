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
        
        // Preload custom models
        this.preloadModels();

        // Listen for Spawn Keys
        window.addEventListener('keydown', (e) => {
            if(e.key === '1') this.spawn('CONDOM');      // Condom - stuns player
            if(e.key === '2') this.spawn('CUCUMBER');    // Cucumber - damage/setback
            if(e.key === '3') this.spawn('VIBRATOR');    // Vibrator - wipes out (reset)
            if(e.key === '4') this.spawn('FALLEN');      // Fallen swimmer (no damage)
            if(e.key === '5') this.spawn('PILL');        // Power-up
        });
    }
    
    /**
     * Preload all custom 3D models
     * Models should be placed in /models folder as .glb files
     */
    preloadModels() {
        const modelFiles = {
            'CONDOM': './models/condom.glb',       // Condom model - stuns
            'CUCUMBER': './models/cucumber.glb',   // Cucumber model - damage
            'VIBRATOR': './models/vibrator.glb'    // Vibrator model - wipeout
            // Add more mappings as needed
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
        let randX = (Math.random() - 0.5) * 20; 
        let randY = (Math.random() - 0.5) * 20;
        
        // Try to use custom model if available
        const customModel = this.getModel(type);

        if (type === 'CONDOM') {
            // CONDOM - Stuns player for 2 seconds
            if (customModel) {
                customModel.scale.set(3, 3, 3);
                group.add(customModel);
            } else {
                // Fallback - translucent cylinder
                const geo = new THREE.CylinderGeometry(2.5, 2.5, 8, 32, 1, true);
                const mat = new THREE.MeshPhysicalMaterial({ 
                    color: 0xffffdd, 
                    transmission: 0.9, 
                    opacity: 0.7, 
                    transparent: true,
                    side: THREE.DoubleSide 
                });
                group.add(new THREE.Mesh(geo, mat));
            }
            const shape = new CANNON.Cylinder(2.5, 2.5, 8, 16);
            const q = new CANNON.Quaternion();
            q.setFromAxisAngle(new CANNON.Vec3(1,0,0), Math.PI/2);
            body = new CANNON.Body({ mass: 2, shape: shape });
            body.quaternion.copy(q);
            
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
                customModel.scale.set(2, 2, 2);
                group.add(customModel);
            } else {
                // Fallback - green cylinder
                const geo = new THREE.CylinderGeometry(0.8, 0.8, 6, 16);
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
                        (Math.random() - 0.5) * 5,
                        Math.sin(i * Math.PI/4) * 0.7
                    );
                    group.add(bump);
                }
            }
            const shape = new CANNON.Cylinder(0.8, 0.8, 6, 8);
            body = new CANNON.Body({ mass: 5, shape: shape });
            
            // Collision effect: DAMAGE (setback)
            body.addEventListener("collide", (e) => {
                if(e.body === this.player.body && !body.hasHit) {
                    body.hasHit = true;
                    this.player.takeDamage(50); // Push back 50 meters
                }
            });
            
            logEvent("🥒 CUCUMBER!\nDAMAGE ON HIT");

        } else if (type === 'VIBRATOR') {
            // VIBRATOR - Wipes out player (reset to start area)
            if (customModel) {
                customModel.scale.set(2, 2, 2);
                group.add(customModel);
            } else {
                // Fallback - pink/purple capsule with motor
                const bodyGeo = new THREE.CapsuleGeometry(1, 4, 8, 16);
                const bodyMat = new THREE.MeshStandardMaterial({ 
                    color: 0xff69b4, 
                    roughness: 0.3,
                    metalness: 0.5
                });
                const vibratorMesh = new THREE.Mesh(bodyGeo, bodyMat);
                group.add(vibratorMesh);
                // Add base
                const base = new THREE.Mesh(
                    new THREE.CylinderGeometry(1.2, 1.2, 1, 16),
                    new THREE.MeshStandardMaterial({ color: 0x8b008b, metalness: 0.8 })
                );
                base.position.y = -2.5;
                group.add(base);
            }
            const shape = new CANNON.Cylinder(1, 1, 5, 8);
            body = new CANNON.Body({ mass: 8, shape: shape });
            // Make it vibrate/shake
            body.angularVelocity.set(0, 10, 0);
            
            // Collision effect: WIPEOUT (reset)
            body.addEventListener("collide", (e) => {
                if(e.body === this.player.body && !body.hasHit) {
                    body.hasHit = true;
                    this.player.resetToCheckpoint(0); // Reset to start
                }
            });
            
            logEvent("💀 VIBRATOR!\nWIPEOUT ON HIT");

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
            
            const isGrounded = Math.random() > 0.4;
            if (isGrounded) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 14; 
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
        if (type !== 'CONDOM' && type !== 'FALLEN' && type !== 'PILL') {
             body.angularVelocity.set(Math.random()*3, Math.random()*3, Math.random()*3);
        }

        this.world.physicsWorld.addBody(body);
        this.world.scene.add(group);
        this.obstacles.push({ mesh: group, body: body, type: type });
    }

    update() {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const o = this.obstacles[i];
            
            // Check for collision removal (Pill)
            if (o.body.shouldRemove) {
                this.world.physicsWorld.removeBody(o.body);
                this.world.scene.remove(o.mesh);
                this.obstacles.splice(i, 1);
                continue;
            }

            o.mesh.position.copy(o.body.position);
            o.mesh.quaternion.copy(o.body.quaternion);

            if (o.mesh.position.z > this.player.body.position.z + 50) {
                this.world.physicsWorld.removeBody(o.body);
                this.world.scene.remove(o.mesh);
                this.obstacles.splice(i, 1);
            }
        }
    }
}