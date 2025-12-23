import * as THREE from 'three';
import * as CANNON from 'cannon';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneWithSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from './Config.js';
import { logEvent } from './Utils.js';
import { getAudioSystem } from './AudioSystem.js';

// Skin tone colors for swimmers
const SKIN_TONES = [
    0xffdbac, // Light
    0xf1c27d, // Fair
    0xe0ac69, // Medium
    0xc68642, // Tan
    0x8d5524, // Brown
    0x5c3317, // Dark Brown
    0xffe0bd, // Peach
    0xd4a574  // Caramel
];

// Shared GLTFLoader instance for all players
let sharedLoader = null;
let cachedSwimmerGLTF = null;
let loadingPromise = null;

/**
 * Preload the swimmer model once for all players
 */
function getSwimmerModel() {
    if (cachedSwimmerGLTF) {
        return Promise.resolve(cachedSwimmerGLTF);
    }
    
    if (loadingPromise) {
        return loadingPromise;
    }
    
    if (!sharedLoader) {
        sharedLoader = new GLTFLoader();
    }
    
    loadingPromise = new Promise((resolve, reject) => {
        sharedLoader.load(
            './models/swimmer.glb',
            (gltf) => {
                console.log('✓ Swimmer model loaded and cached');
                cachedSwimmerGLTF = gltf;
                resolve(gltf);
            },
            undefined,
            (error) => {
                console.error('Failed to load swimmer.glb:', error);
                reject(error);
            }
        );
    });
    
    return loadingPromise;
}

export class Player {
    constructor(world, options = {}) {
        this.world = world;
        
        // Options
        this.isRemote = options.isRemote || false;
        this.color = options.color || CONFIG.PLAYER_COLOR;
        this.name = options.name || "Player";
        
        // Assign a skin tone - use index if provided, otherwise random for remote players
        if (options.skinToneIndex !== undefined) {
            this.skinTone = SKIN_TONES[options.skinToneIndex % SKIN_TONES.length];
        } else if (this.isRemote) {
            // Random skin tone for AI/remote players
            this.skinTone = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
        } else {
            // Local player uses their selected color as a tint
            this.skinTone = this.color;
        }
        
        // Animation mixer for GLB models
        this.mixer = null;
        this.animationActions = [];
        this.modelMaterials = []; // Store references to model materials for color changes

        // Boost System
        this.boostCharges = 0; // Starts empty!
        this.canBoost = true;
        this.boostTimer = 0;
        
        // AI movement timer for smoother remote player movement
        this.aiMoveTimer = 0;
        this.aiTargetOffset = { x: 0, y: 0 };

        // Physics Body
        const shape = new CANNON.Sphere(0.5);
        this.body = new CANNON.Body({ 
            mass: 1, 
            shape: shape, 
            linearDamping: 0.9, 
            material: world.defaultMat 
        });
        
        // Set initial position if provided
        if (options.startPos) {
            this.body.position.set(options.startPos.x, options.startPos.y, options.startPos.z);
        }

        this.world.physicsWorld.addBody(this.body);

        // Visual Group
        this.mesh = new THREE.Group();
        
        // Load the animated swimmer model (required - no fallback)
        this.loadSwimmerModel();
        
        // Light attachment (Only for local player to save performance)
        if (!this.isRemote) {
            this.light = new THREE.PointLight(0xffffff, 1.5, 60);
            this.mesh.add(this.light);
        }

        // Name Tag for Multiplayer
        if (this.isRemote) {
            this.addNameTag();
        }

        this.world.scene.add(this.mesh);

        // Controls State
        this.keys = { w: false, a: false, s: false, d: false, space: false };
        
        // Only listen to keys if this is the Local Player
        if (!this.isRemote) {
            this.initInput();
        }
    }
    
    /**
     * Load the animated swimmer GLB model
     * Uses shared cached model for performance, falls back to procedural mesh
     */
    loadSwimmerModel() {
        getSwimmerModel()
            .then((gltf) => {
                // Clone the scene for this player instance using SkeletonUtils for proper skinned mesh cloning
                let model;
                try {
                    // Use SkeletonUtils.clone for proper skinned mesh handling
                    model = cloneWithSkeleton(gltf.scene);
                } catch (e) {
                    // Fallback to regular clone if SkeletonUtils fails
                    console.warn('SkeletonUtils clone failed, using regular clone:', e);
                    model = gltf.scene.clone();
                }
                
                // Scale the model appropriately
                model.scale.set(0.5, 0.5, 0.5);
                
                // Ensure the model is visible
                model.visible = true;
                model.traverse((child) => {
                    child.visible = true;
                    child.frustumCulled = false; // Prevent culling issues
                });
                
                // Apply skin tone tint to model materials
                const skinColor = new THREE.Color(this.skinTone);
                model.traverse((child) => {
                    if (child.isMesh) {
                        // Clone material to allow individual coloring per player
                        if (child.material) {
                            child.material = child.material.clone();
                            this.modelMaterials.push(child.material);
                            
                            // Apply skin tone color
                            if (child.material.color) {
                                // Blend the original material color with skin tone
                                child.material.color.lerp(skinColor, 0.7);
                            }
                        }
                    }
                });
                
                // Remove fallback mesh if it exists
                if (this.fallbackMesh) {
                    this.mesh.remove(this.fallbackMesh);
                    this.fallbackMesh = null;
                }
                
                this.mesh.add(model);
                this.customModel = model;
                
                console.log('Swimmer model added to player mesh');
                
                // Set up animations if present (use original gltf animations)
                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(model);
                    gltf.animations.forEach((clip) => {
                        const action = this.mixer.clipAction(clip);
                        action.play();
                        this.animationActions.push(action);
                    });
                    console.log(`Playing ${gltf.animations.length} animation(s)`);
                }
            })
            .catch((error) => {
                console.warn('Swimmer model not available, using fallback procedural mesh:', error);
                this.createFallbackSwimmer();
            });
    }
    
    /**
     * Create a procedural swimmer mesh as fallback when GLB isn't available
     */
    createFallbackSwimmer() {
        // Create a simple swimmer shape (head + body + tail)
        const skinColor = new THREE.Color(this.skinTone);
        
        // Head (sphere)
        const headGeom = new THREE.SphereGeometry(0.4, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ 
            color: skinColor, 
            roughness: 0.6,
            metalness: 0.1
        });
        const head = new THREE.Mesh(headGeom, headMat);
        head.position.z = -0.3;
        this.modelMaterials.push(headMat);
        
        // Body (elongated ellipsoid)
        const bodyGeom = new THREE.SphereGeometry(0.35, 16, 16);
        bodyGeom.scale(1, 1, 2);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: skinColor, 
            roughness: 0.6,
            metalness: 0.1
        });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.z = 0.4;
        this.modelMaterials.push(bodyMat);
        
        // Tail (cone shape)
        const tailGeom = new THREE.ConeGeometry(0.2, 0.8, 8);
        const tailMat = new THREE.MeshStandardMaterial({ 
            color: skinColor.clone().multiplyScalar(0.8), 
            roughness: 0.6,
            metalness: 0.1
        });
        const tail = new THREE.Mesh(tailGeom, tailMat);
        tail.rotation.x = Math.PI / 2;
        tail.position.z = 1.2;
        this.modelMaterials.push(tailMat);
        
        // Group them
        const swimmerGroup = new THREE.Group();
        swimmerGroup.add(head);
        swimmerGroup.add(body);
        swimmerGroup.add(tail);
        
        this.fallbackMesh = swimmerGroup;
        this.mesh.add(swimmerGroup);
    }

    addNameTag() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; 
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = "bold 30px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.strokeText(this.name, 128, 40);
        ctx.fillText(this.name, 128, 40);
        
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(canvas), 
            transparent: true 
        }));
        sprite.position.y = 1.5;
        sprite.scale.set(4, 1, 1);
        this.mesh.add(sprite);
    }

    // Method to update color/skin tone dynamically (for Menu selection)
    setColor(hexColor) {
        this.color = hexColor;
        this.skinTone = hexColor;
        const colObj = new THREE.Color(hexColor);
        
        // Update all model materials with new skin tone
        this.modelMaterials.forEach((material) => {
            if (material.color) {
                material.color.copy(colObj);
            }
        });
    }

    initInput() {
        window.addEventListener('keydown', (e) => this.onKey(e, true));
        window.addEventListener('keyup', (e) => this.onKey(e, false));
    }

    onKey(e, isDown) {
        const k = e.key.toLowerCase();
        if(k === 'w') this.keys.w = isDown;
        if(k === 'a') this.keys.a = isDown;
        if(k === 's') this.keys.s = isDown;
        if(k === 'd') this.keys.d = isDown;
        if(k === ' ') this.keys.space = isDown;
    }

    // Called by ObstacleManager when Pill is hit
    refillBoost() {
        this.boostCharges += 3; // Add 3 boosts
        if(!this.isRemote) {
            logEvent(`ENERGY RESTORED!\nCHARGES: ${this.boostCharges}`);
            getAudioSystem().playSFX('pickup');
        }
    }
    
    /**
     * Take damage - pushes player backward
     * @param {number} amount - Amount of setback in units
     */
    takeDamage(amount) {
        // Push player backwards
        this.body.position.z += amount;
        // Add knockback impulse
        this.body.velocity.z = amount * 2;
        // Visual feedback - flash red on all model materials
        if (this.modelMaterials.length > 0) {
            const originalColors = this.modelMaterials.map(m => m.color ? m.color.clone() : null);
            this.modelMaterials.forEach((material) => {
                if (material.color) {
                    material.color.setHex(0xff0000);
                }
                if (material.emissive) {
                    material.emissive.setHex(0xff0000);
                }
            });
            setTimeout(() => {
                this.modelMaterials.forEach((material, i) => {
                    if (material.color && originalColors[i]) {
                        material.color.copy(originalColors[i]);
                    }
                    if (material.emissive) {
                        material.emissive.setHex(0x000000);
                    }
                });
            }, 200);
        }
        if(!this.isRemote) {
            logEvent(`💥 DAMAGE!\nSET BACK ${amount}m`);
            getAudioSystem().playSFX('hit');
        }
    }
    
    /**
     * Reset player position to a checkpoint
     * @param {number} zPosition - Z position to reset to (positive = back toward start)
     */
    resetToCheckpoint(zPosition) {
        this.body.position.z = zPosition;
        this.body.position.x = 0;
        this.body.position.y = 0;
        this.body.velocity.set(0, 0, 0);
        this.boostCharges = 0; // Lose boost charges
        if(!this.isRemote) {
            logEvent(`☠️ WIPED OUT!\nRESET TO START`);
            getAudioSystem().playSFX('hit');
        }
    }
    
    /**
     * Stun player - stops movement temporarily
     * @param {number} duration - Duration in seconds
     */
    stun(duration) {
        this.isStunned = true;
        this.body.velocity.set(0, 0, 0);
        // Visual effect - spin
        this.body.angularVelocity.set(5, 5, 5);
        if(!this.isRemote) {
            logEvent(`😵 STUNNED!\n${duration}s`);
            getAudioSystem().playSFX('hit');
        }
        setTimeout(() => {
            this.isStunned = false;
            this.body.angularVelocity.set(0, 0, 0);
        }, duration * 1000);
    }

    update(dt, time) {
        // Skip update if stunned
        if (this.isStunned) {
            this.mesh.position.copy(this.body.position);
            this.mesh.quaternion.copy(this.body.quaternion);
            return;
        }
        
        // 1. Propulsion (Base Speed)
        this.body.applyForce(new CANNON.Vec3(0, 0, -CONFIG.SPEED), this.body.position);

        if (!this.isRemote) {
            // 2. Local Steering
            if(this.keys.w) this.body.applyForce(new CANNON.Vec3(0, CONFIG.STEER_FORCE, 0), this.body.position);
            if(this.keys.s) this.body.applyForce(new CANNON.Vec3(0, -CONFIG.STEER_FORCE, 0), this.body.position);
            if(this.keys.a) this.body.applyForce(new CANNON.Vec3(-CONFIG.STEER_FORCE, 0, 0), this.body.position);
            if(this.keys.d) this.body.applyForce(new CANNON.Vec3(CONFIG.STEER_FORCE, 0, 0), this.body.position);
            
            // 3. LIMITED BOOST LOGIC
            if(this.keys.space && this.canBoost) {
                if (this.boostCharges > 0) {
                    this.body.applyImpulse(new CANNON.Vec3(0, 0, -CONFIG.BOOST_FORCE), this.body.position);
                    this.boostCharges--; // Consume charge
                    this.canBoost = false;
                    this.boostTimer = 0.5; // Short cooldown to prevent double-fire
                    logEvent(`BOOSTING! (${this.boostCharges} LEFT)`);
                    
                    // Play boost sound
                    getAudioSystem().playSFX('boost');
                }
            }
        } else {
            // REMOTE / AI BEHAVIOR
            // Smoother AI movement - change direction periodically instead of every frame
            this.aiMoveTimer -= dt;
            if (this.aiMoveTimer <= 0) {
                // Pick a new target offset every 0.5-1.5 seconds
                this.aiMoveTimer = 0.5 + Math.random() * 1.0;
                this.aiTargetOffset = {
                    x: (Math.random() - 0.5) * 8,
                    y: (Math.random() - 0.5) * 8
                };
            }
            
            // Apply smooth steering towards target offset
            const steerX = this.aiTargetOffset.x - this.body.position.x;
            const steerY = this.aiTargetOffset.y - this.body.position.y;
            
            this.body.applyForce(new CANNON.Vec3(
                steerX * 0.5, 
                steerY * 0.5, 
                0
            ), this.body.position);
        }

        // Timer Update
        if(!this.canBoost) {
            this.boostTimer -= dt;
            if(this.boostTimer <= 0) this.canBoost = true;
        }

        // 4. Wall Constraint
        this.applyConstraints();

        // 5. Sync Visuals - use lerp for smoother movement on remote players
        if (this.isRemote) {
            // Smooth interpolation for remote players
            this.mesh.position.lerp(this.body.position, 0.15);
        } else {
            this.mesh.position.copy(this.body.position);
        }
        
        if (this.body.velocity.lengthSquared() > 0.1) {
            const lookTarget = this.mesh.position.clone().add(this.body.velocity);
            this.mesh.lookAt(lookTarget);
        }
        
        // 6. Update animation mixer for GLB model
        if (this.mixer) {
            this.mixer.update(dt);
        }
    }

    applyConstraints() {
        const x = this.body.position.x;
        const y = this.body.position.y;
        const dist = Math.sqrt(x*x + y*y);
        
        if (dist > CONFIG.TUNNEL_RADIUS - 1.0) {
            const overlap = dist - (CONFIG.TUNNEL_RADIUS - 1.0);
            const nx = -x / dist;
            const ny = -y / dist;
            
            this.body.position.x += nx * overlap;
            this.body.position.y += ny * overlap;
            
            const v = this.body.velocity;
            const dot = v.x * nx + v.y * ny;
            if (dot < 0) {
                v.x -= 1.5 * dot * nx;
                v.y -= 1.5 * dot * ny;
            }
        }
    }
}