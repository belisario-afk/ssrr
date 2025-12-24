import * as THREE from 'three';
import * as CANNON from 'cannon';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneWithSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from './Config.js';
import { logEvent } from './Utils.js';
import { getAudioSystem } from './AudioSystem.js';
import { getGameState } from './GameState.js';

/**
 * Character class - Humanoid character with body, arms, legs
 * Phase 1 of major game upgrade
 */

// Skin tone colors for characters
const SKIN_TONES = [
    0xFFDBAC, // Light
    0xF1C27D, // Peach
    0xE0AC69, // Golden
    0xC68642, // Tan
    0x8D5524, // Caramel
    0x6B4423, // Chocolate
    0x4A2912, // Espresso
    0xFFF5E1  // Cream
];

// Shared GLTFLoader instance
let sharedLoader = null;
let cachedCharacterGLTF = null;
let loadingPromise = null;

/**
 * Preload the character model once for all players
 */
function getCharacterModel() {
    if (cachedCharacterGLTF) {
        return Promise.resolve(cachedCharacterGLTF);
    }
    
    if (loadingPromise) {
        return loadingPromise;
    }
    
    if (!sharedLoader) {
        sharedLoader = new GLTFLoader();
    }
    
    loadingPromise = new Promise((resolve, reject) => {
        sharedLoader.load(
            './models/character.glb',
            (gltf) => {
                console.log('✓ Character model loaded and cached');
                cachedCharacterGLTF = gltf;
                resolve(gltf);
            },
            undefined,
            (error) => {
                console.log('Character model not found, using procedural humanoid');
                reject(error);
            }
        );
    });
    
    return loadingPromise;
}

export class Character {
    constructor(world, options = {}) {
        this.world = world;
        this.gameState = getGameState();
        
        // Options
        this.isRemote = options.isRemote || false;
        this.isGifterCompetitor = options.isGifterCompetitor || false;
        this.color = options.color || CONFIG.PLAYER_COLOR;
        this.name = options.name || "Player";
        
        // Assign skin tone
        if (options.skinToneIndex !== undefined) {
            this.skinTone = SKIN_TONES[options.skinToneIndex % SKIN_TONES.length];
        } else if (this.isRemote) {
            this.skinTone = options.color || SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
        } else {
            this.skinTone = this.color;
        }
        
        // Animation
        this.mixer = null;
        this.animationActions = {};
        this.currentAnimation = 'idle';
        this.modelMaterials = [];
        
        // Combat System
        this.health = options.maxHealth || 100;
        this.maxHealth = options.maxHealth || 100;
        this.weapon = null;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.weaponDamage = 10;
        
        // Movement
        this.moveSpeed = CONFIG.SPEED;
        this.jumpForce = 15;
        this.isGrounded = true;
        this.canJump = true;
        
        // Boost System
        this.boostCharges = this.isRemote ? 0 : CONFIG.GAME.startingBoost;
        this.canBoost = true;
        this.boostTimer = 0;
        
        // AI movement for remote players
        this.aiMoveTimer = 0;
        this.aiTargetOffset = { x: 0, y: 0 };
        this.aiDecisionTimer = 0;
        this.aiCurrentDecision = 'forward';
        
        // Status effects
        this.isStunned = false;
        this.hasShield = false;
        this.speedMultiplier = 1.0;
        this.isDead = false;

        // Physics Body - Capsule-like shape for humanoid
        const collisionRadius = CONFIG.CHARACTER_COLLISION_RADIUS || 1.0;
        const shape = new CANNON.Sphere(collisionRadius); // Larger collision for humanoid
        this.body = new CANNON.Body({ 
            mass: 1, 
            shape: shape, 
            linearDamping: 0.9, 
            material: world.defaultMat 
        });
        
        // Set initial position
        if (options.startPos) {
            this.body.position.set(options.startPos.x, options.startPos.y, options.startPos.z);
        }

        this.world.physicsWorld.addBody(this.body);

        // Visual Group
        this.mesh = new THREE.Group();
        
        // Load character model or create procedural humanoid
        this.loadCharacterModel();
        
        // Light attachment (Only for local player)
        if (!this.isRemote) {
            this.light = new THREE.PointLight(0xffffff, 1.5, 60);
            this.mesh.add(this.light);
        }

        // Name Tag
        if (this.isRemote) {
            this.addNameTag();
        }
        
        // Health bar
        this.createHealthBar();

        this.world.scene.add(this.mesh);

        // Controls State
        this.keys = { 
            w: false, a: false, s: false, d: false, 
            space: false, 
            attack: false, // Left mouse or J key
            block: false   // Right mouse or K key
        };
        
        if (!this.isRemote) {
            this.initInput();
        }
    }
    
    /**
     * Load character GLB model or create procedural humanoid
     */
    loadCharacterModel() {
        getCharacterModel()
            .then((gltf) => {
                let model;
                try {
                    model = cloneWithSkeleton(gltf.scene);
                } catch (e) {
                    console.warn('SkeletonUtils clone failed:', e);
                    model = gltf.scene.clone();
                }
                
                model.scale.set(1.0, 1.0, 1.0);
                model.visible = true;
                model.traverse((child) => {
                    child.visible = true;
                    child.frustumCulled = false;
                });
                
                // Apply skin tone
                const skinColor = new THREE.Color(this.skinTone);
                model.traverse((child) => {
                    if (child.isMesh) {
                        if (child.material) {
                            child.material = child.material.clone();
                            this.modelMaterials.push(child.material);
                            if (child.material.color) {
                                child.material.color.lerp(skinColor, 0.7);
                            }
                        }
                    }
                });
                
                if (this.fallbackMesh) {
                    this.mesh.remove(this.fallbackMesh);
                    this.fallbackMesh = null;
                }
                
                this.mesh.add(model);
                this.customModel = model;
                
                // Set up animations
                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(model);
                    gltf.animations.forEach((clip) => {
                        const action = this.mixer.clipAction(clip);
                        this.animationActions[clip.name.toLowerCase()] = action;
                    });
                    // Play idle by default
                    if (this.animationActions['idle']) {
                        this.animationActions['idle'].play();
                    }
                }
            })
            .catch((error) => {
                console.log('Creating procedural humanoid character');
                this.createProceduralCharacter();
            });
    }
    
    /**
     * Create a procedural humanoid character with body, arms, legs
     */
    createProceduralCharacter() {
        const skinColor = new THREE.Color(this.skinTone);
        const clothColor = new THREE.Color(this.color);
        
        const humanoid = new THREE.Group();
        
        // Materials
        const skinMat = new THREE.MeshStandardMaterial({ 
            color: skinColor, 
            roughness: 0.6,
            metalness: 0.1
        });
        const clothMat = new THREE.MeshStandardMaterial({ 
            color: clothColor, 
            roughness: 0.8,
            metalness: 0.0
        });
        this.modelMaterials.push(skinMat, clothMat);
        
        // HEAD
        const headGeom = new THREE.SphereGeometry(0.35, 16, 16);
        const head = new THREE.Mesh(headGeom, skinMat);
        head.position.y = 2.0;
        humanoid.add(head);
        
        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const eyeGeom = new THREE.SphereGeometry(0.06, 8, 8);
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-0.1, 2.05, 0.3);
        humanoid.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(0.1, 2.05, 0.3);
        humanoid.add(rightEye);
        
        // TORSO (Body)
        const torsoGeom = new THREE.BoxGeometry(0.8, 1.0, 0.4);
        const torso = new THREE.Mesh(torsoGeom, clothMat);
        torso.position.y = 1.2;
        humanoid.add(torso);
        
        // HIPS
        const hipsGeom = new THREE.BoxGeometry(0.7, 0.3, 0.35);
        const hips = new THREE.Mesh(hipsGeom, clothMat.clone());
        hips.material.color.setHex(0x333355);
        hips.position.y = 0.55;
        humanoid.add(hips);
        
        // LEFT ARM
        const armGeom = new THREE.CapsuleGeometry(0.12, 0.5, 4, 8);
        
        // Upper arm
        const leftUpperArm = new THREE.Mesh(armGeom, skinMat);
        leftUpperArm.position.set(-0.55, 1.4, 0);
        leftUpperArm.rotation.z = 0.3;
        humanoid.add(leftUpperArm);
        
        // Lower arm
        const leftLowerArm = new THREE.Mesh(armGeom, skinMat);
        leftLowerArm.position.set(-0.65, 0.9, 0);
        leftLowerArm.rotation.z = 0.1;
        humanoid.add(leftLowerArm);
        
        // Hand
        const handGeom = new THREE.SphereGeometry(0.1, 8, 8);
        const leftHand = new THREE.Mesh(handGeom, skinMat);
        leftHand.position.set(-0.7, 0.55, 0);
        humanoid.add(leftHand);
        
        // RIGHT ARM
        const rightUpperArm = new THREE.Mesh(armGeom.clone(), skinMat);
        rightUpperArm.position.set(0.55, 1.4, 0);
        rightUpperArm.rotation.z = -0.3;
        humanoid.add(rightUpperArm);
        
        const rightLowerArm = new THREE.Mesh(armGeom.clone(), skinMat);
        rightLowerArm.position.set(0.65, 0.9, 0);
        rightLowerArm.rotation.z = -0.1;
        humanoid.add(rightLowerArm);
        
        const rightHand = new THREE.Mesh(handGeom.clone(), skinMat);
        rightHand.position.set(0.7, 0.55, 0);
        this.rightHand = rightHand; // Store reference for weapon attachment
        humanoid.add(rightHand);
        
        // LEFT LEG
        const legGeom = new THREE.CapsuleGeometry(0.14, 0.6, 4, 8);
        
        const leftUpperLeg = new THREE.Mesh(legGeom, clothMat.clone());
        leftUpperLeg.material.color.setHex(0x333355);
        leftUpperLeg.position.set(-0.2, 0.15, 0);
        humanoid.add(leftUpperLeg);
        
        const leftLowerLeg = new THREE.Mesh(legGeom, skinMat);
        leftLowerLeg.position.set(-0.2, -0.55, 0);
        humanoid.add(leftLowerLeg);
        
        // Foot
        const footGeom = new THREE.BoxGeometry(0.15, 0.1, 0.3);
        const leftFoot = new THREE.Mesh(footGeom, new THREE.MeshStandardMaterial({ color: 0x222222 }));
        leftFoot.position.set(-0.2, -1.0, 0.05);
        humanoid.add(leftFoot);
        
        // RIGHT LEG
        const rightUpperLeg = new THREE.Mesh(legGeom.clone(), clothMat.clone());
        rightUpperLeg.material.color.setHex(0x333355);
        rightUpperLeg.position.set(0.2, 0.15, 0);
        humanoid.add(rightUpperLeg);
        
        const rightLowerLeg = new THREE.Mesh(legGeom.clone(), skinMat);
        rightLowerLeg.position.set(0.2, -0.55, 0);
        humanoid.add(rightLowerLeg);
        
        const rightFoot = new THREE.Mesh(footGeom.clone(), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        rightFoot.position.set(0.2, -1.0, 0.05);
        humanoid.add(rightFoot);
        
        // Center the humanoid
        humanoid.position.y = 1.0;
        
        this.fallbackMesh = humanoid;
        this.mesh.add(humanoid);
        
        // Store limb references for animation
        this.limbs = {
            head,
            torso,
            leftUpperArm, leftLowerArm, leftHand,
            rightUpperArm, rightLowerArm, rightHand,
            leftUpperLeg, leftLowerLeg, leftFoot,
            rightUpperLeg, rightLowerLeg, rightFoot
        };
    }
    
    /**
     * Create health bar above character
     */
    createHealthBar() {
        const healthBarGroup = new THREE.Group();
        
        // Background
        const bgGeom = new THREE.PlaneGeometry(1.2, 0.15);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.8 });
        const bg = new THREE.Mesh(bgGeom, bgMat);
        healthBarGroup.add(bg);
        
        // Health fill
        const fillGeom = new THREE.PlaneGeometry(1.1, 0.1);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.healthFill = new THREE.Mesh(fillGeom, fillMat);
        this.healthFill.position.z = 0.01;
        healthBarGroup.add(this.healthFill);
        
        healthBarGroup.position.y = 3.0;
        healthBarGroup.rotation.x = 0; // Face camera
        
        this.healthBar = healthBarGroup;
        this.mesh.add(healthBarGroup);
    }
    
    /**
     * Update health bar display
     */
    updateHealthBar() {
        if (this.healthFill) {
            const healthPercent = this.health / this.maxHealth;
            this.healthFill.scale.x = healthPercent;
            this.healthFill.position.x = (1 - healthPercent) * -0.55;
            
            // Color based on health
            if (healthPercent > 0.6) {
                this.healthFill.material.color.setHex(0x00ff00);
            } else if (healthPercent > 0.3) {
                this.healthFill.material.color.setHex(0xffff00);
            } else {
                this.healthFill.material.color.setHex(0xff0000);
            }
        }
        
        // Make health bar face camera
        if (this.healthBar && this.world.camera) {
            this.healthBar.lookAt(this.world.camera.position);
        }
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
        sprite.position.y = 3.5;
        sprite.scale.set(4, 1, 1);
        this.mesh.add(sprite);
    }

    setColor(hexColor) {
        this.color = hexColor;
        this.skinTone = hexColor;
        const colObj = new THREE.Color(hexColor);
        
        this.modelMaterials.forEach((material) => {
            if (material.color) {
                material.color.copy(colObj);
            }
        });
    }

    initInput() {
        window.addEventListener('keydown', (e) => this.onKey(e, true));
        window.addEventListener('keyup', (e) => this.onKey(e, false));
        
        // Mouse for combat
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.keys.attack = true; // Left click
            if (e.button === 2) this.keys.block = true;  // Right click
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.keys.attack = false;
            if (e.button === 2) this.keys.block = false;
        });
    }

    onKey(e, isDown) {
        const k = e.key.toLowerCase();
        if(k === 'w') this.keys.w = isDown;
        if(k === 'a') this.keys.a = isDown;
        if(k === 's') this.keys.s = isDown;
        if(k === 'd') this.keys.d = isDown;
        if(k === ' ') this.keys.space = isDown;
        if(k === 'j') this.keys.attack = isDown; // J for attack
        if(k === 'k') this.keys.block = isDown;  // K for block
    }
    
    /**
     * Equip a weapon
     */
    equipWeapon(weaponType) {
        // Remove existing weapon
        if (this.weapon) {
            this.mesh.remove(this.weapon.mesh);
        }
        
        const weaponGroup = new THREE.Group();
        
        if (weaponType === 'sword') {
            // Create sword
            const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
            const handleMat = new THREE.MeshStandardMaterial({ color: 0x4a2912, roughness: 0.8 });
            
            // Blade
            const bladeGeom = new THREE.BoxGeometry(0.08, 1.2, 0.02);
            const blade = new THREE.Mesh(bladeGeom, bladeMat);
            blade.position.y = 0.6;
            weaponGroup.add(blade);
            
            // Handle
            const handleGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
            const handle = new THREE.Mesh(handleGeom, handleMat);
            weaponGroup.add(handle);
            
            // Guard
            const guardGeom = new THREE.BoxGeometry(0.3, 0.05, 0.05);
            const guard = new THREE.Mesh(guardGeom, bladeMat);
            guard.position.y = 0.15;
            weaponGroup.add(guard);
            
            this.weaponDamage = 25;
            this.weaponRange = 2.5;
            
        } else if (weaponType === 'gun') {
            // Create gun
            const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
            
            // Barrel
            const barrelGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
            const barrel = new THREE.Mesh(barrelGeom, gunMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = 0.25;
            weaponGroup.add(barrel);
            
            // Body
            const bodyGeom = new THREE.BoxGeometry(0.15, 0.2, 0.25);
            const body = new THREE.Mesh(bodyGeom, gunMat);
            weaponGroup.add(body);
            
            // Handle
            const handleGeom = new THREE.BoxGeometry(0.1, 0.25, 0.1);
            const handle = new THREE.Mesh(handleGeom, new THREE.MeshStandardMaterial({ color: 0x4a2912 }));
            handle.position.y = -0.2;
            handle.rotation.x = 0.3;
            weaponGroup.add(handle);
            
            this.weaponDamage = 15;
            this.weaponRange = 50;
        }
        
        weaponGroup.position.set(0.7, 1.5, 0.3);
        
        this.weapon = {
            type: weaponType,
            mesh: weaponGroup,
            damage: this.weaponDamage,
            range: this.weaponRange
        };
        
        this.mesh.add(weaponGroup);
        logEvent(`⚔️ Equipped ${weaponType.toUpperCase()}`);
    }
    
    /**
     * Attack action
     */
    attack() {
        if (this.attackCooldown > 0 || this.isStunned || !this.weapon) return;
        
        this.isAttacking = true;
        this.attackCooldown = 0.5; // Half second cooldown
        
        // Visual: swing weapon
        if (this.weapon.mesh) {
            const originalRotation = this.weapon.mesh.rotation.x;
            this.weapon.mesh.rotation.x = -1.5;
            setTimeout(() => {
                if (this.weapon && this.weapon.mesh) {
                    this.weapon.mesh.rotation.x = originalRotation;
                }
            }, 200);
        }
        
        getAudioSystem().playSFX('hit');
        
        // Return attack info for collision checking
        return {
            position: this.body.position.clone(),
            direction: new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion),
            damage: this.weapon.damage,
            range: this.weapon.range,
            type: this.weapon.type
        };
    }
    
    /**
     * Take damage from attack
     */
    takeDamage(amount, attacker = null) {
        if (this.hasShield || this.isDead) return;
        
        this.health -= amount;
        
        // Knockback
        if (attacker) {
            const knockbackDir = new THREE.Vector3()
                .subVectors(this.body.position, attacker.body.position)
                .normalize();
            this.body.velocity.x += knockbackDir.x * 10;
            this.body.velocity.z += knockbackDir.z * 10;
        }
        
        // Visual feedback
        this.flashRed();
        
        if (this.health <= 0) {
            this.die();
        }
        
        if (!this.isRemote) {
            logEvent(`💥 -${amount} HP!\n${this.health}/${this.maxHealth}`);
            getAudioSystem().playSFX('hit');
        }
    }
    
    /**
     * Flash red when hit
     */
    flashRed() {
        const originalColors = this.modelMaterials.map(m => m.color ? m.color.clone() : null);
        this.modelMaterials.forEach((material) => {
            if (material.color) {
                material.color.setHex(0xff0000);
            }
        });
        setTimeout(() => {
            this.modelMaterials.forEach((material, i) => {
                if (material.color && originalColors[i]) {
                    material.color.copy(originalColors[i]);
                }
            });
        }, 200);
    }
    
    /**
     * Die
     */
    die() {
        this.isDead = true;
        this.body.velocity.set(0, 0, 0);
        
        // Death animation - fall over
        if (this.mesh) {
            this.mesh.rotation.x = Math.PI / 2;
        }
        
        if (!this.isRemote) {
            logEvent(`☠️ YOU DIED!`);
            // Trigger game over through game state
            this.gameState.loseLife();
        }
    }
    
    /**
     * Respawn
     */
    respawn(position) {
        this.isDead = false;
        this.health = this.maxHealth;
        this.body.position.set(position.x, position.y, position.z);
        this.body.velocity.set(0, 0, 0);
        if (this.mesh) {
            this.mesh.rotation.x = 0;
        }
    }
    
    refillBoost() {
        this.boostCharges += 3;
        if(!this.isRemote) {
            logEvent(`ENERGY RESTORED!\nCHARGES: ${this.boostCharges}`);
            getAudioSystem().playSFX('pickup');
        }
    }
    
    stun(duration) {
        this.isStunned = true;
        this.body.velocity.set(0, 0, 0);
        if(!this.isRemote) {
            logEvent(`😵 STUNNED!\n${duration}s`);
            getAudioSystem().playSFX('hit');
        }
        setTimeout(() => {
            this.isStunned = false;
        }, duration * 1000);
    }
    
    resetToCheckpoint(zPosition) {
        this.body.position.z = zPosition;
        this.body.position.x = 0;
        this.body.position.y = 0;
        this.body.velocity.set(0, 0, 0);
        this.boostCharges = 0;
        if(!this.isRemote) {
            logEvent(`☠️ WIPED OUT!\nRESET TO START`);
            getAudioSystem().playSFX('hit');
        }
    }

    update(dt, time) {
        if (this.isDead) return;
        
        if (this.isStunned) {
            this.mesh.position.copy(this.body.position);
            this.mesh.quaternion.copy(this.body.quaternion);
            this.updateHealthBar();
            return;
        }
        
        const speedMult = this.isRemote ? CONFIG.AI.baseSpeed : (this.gameState.getSpeedMultiplier() * this.speedMultiplier);
        
        // Forward propulsion
        this.body.applyForce(new CANNON.Vec3(0, 0, -CONFIG.SPEED * speedMult), this.body.position);

        if (!this.isRemote) {
            // Local controls
            if(this.keys.w) this.body.applyForce(new CANNON.Vec3(0, CONFIG.STEER_FORCE, 0), this.body.position);
            if(this.keys.s) this.body.applyForce(new CANNON.Vec3(0, -CONFIG.STEER_FORCE, 0), this.body.position);
            if(this.keys.a) this.body.applyForce(new CANNON.Vec3(-CONFIG.STEER_FORCE, 0, 0), this.body.position);
            if(this.keys.d) this.body.applyForce(new CANNON.Vec3(CONFIG.STEER_FORCE, 0, 0), this.body.position);
            
            // Boost
            if(this.keys.space && this.canBoost && this.boostCharges > 0) {
                this.body.applyImpulse(new CANNON.Vec3(0, 0, -CONFIG.BOOST_FORCE), this.body.position);
                this.boostCharges--;
                this.canBoost = false;
                this.boostTimer = 0.5;
                logEvent(`BOOSTING! (${this.boostCharges} LEFT)`);
                getAudioSystem().playSFX('boost');
            }
            
            // Attack
            if (this.keys.attack) {
                this.attack();
                this.keys.attack = false; // Prevent holding
            }
        } else {
            // AI behavior
            this.updateAI(dt);
        }

        // Cooldowns
        if(!this.canBoost) {
            this.boostTimer -= dt;
            if(this.boostTimer <= 0) this.canBoost = true;
        }
        
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }
        
        this.isAttacking = false;

        // Constraints
        this.applyConstraints();

        // Sync visuals
        if (this.isRemote) {
            this.mesh.position.lerp(this.body.position, 0.15);
        } else {
            this.mesh.position.copy(this.body.position);
        }
        
        // Face movement direction
        if (this.body.velocity.lengthSquared() > 0.1) {
            const lookTarget = this.mesh.position.clone().add(this.body.velocity);
            this.mesh.lookAt(lookTarget);
        }
        
        // Animation
        if (this.mixer) {
            this.mixer.update(dt);
        }
        
        // Procedural animation for limbs
        this.animateLimbs(time);
        
        // Update health bar
        this.updateHealthBar();
    }
    
    /**
     * Simple procedural limb animation
     */
    animateLimbs(time) {
        if (!this.limbs) return;
        
        const speed = this.body.velocity.length();
        const walkCycle = time * 8;
        
        if (speed > 1) {
            // Walking animation
            const legSwing = Math.sin(walkCycle) * 0.5;
            const armSwing = Math.sin(walkCycle) * 0.3;
            
            if (this.limbs.leftUpperLeg) {
                this.limbs.leftUpperLeg.rotation.x = legSwing;
                this.limbs.rightUpperLeg.rotation.x = -legSwing;
            }
            if (this.limbs.leftUpperArm) {
                this.limbs.leftUpperArm.rotation.x = -armSwing;
                this.limbs.rightUpperArm.rotation.x = armSwing;
            }
        }
    }
    
    updateAI(dt) {
        this.aiMoveTimer -= dt;
        if (this.aiMoveTimer <= 0) {
            this.aiMoveTimer = 0.5 + Math.random() * 1.0;
            this.aiTargetOffset = {
                x: (Math.random() - 0.5) * 8,
                y: (Math.random() - 0.5) * 8
            };
        }
        
        const steerX = this.aiTargetOffset.x - this.body.position.x;
        const steerY = this.aiTargetOffset.y - this.body.position.y;
        
        this.body.applyForce(new CANNON.Vec3(steerX * 0.5, steerY * 0.5, 0), this.body.position);
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
