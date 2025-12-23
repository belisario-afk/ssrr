import * as THREE from 'three';
import * as CANNON from 'cannon';
import { CONFIG } from './Config.js';
import { logEvent } from './Utils.js';

export class Player {
    constructor(world, options = {}) {
        this.world = world;
        
        // Options
        this.isRemote = options.isRemote || false;
        this.color = options.color || CONFIG.PLAYER_COLOR;
        this.name = options.name || "Player";

        // Boost System
        this.boostCharges = 0; // Starts empty!
        this.canBoost = true;
        this.boostTimer = 0;

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
        this.createMesh();
        
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

    createMesh() {
        // Head
        const headGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const headMat = new THREE.MeshPhysicalMaterial({ 
            color: this.color, // Use dynamic color
            emissive: this.color,
            emissiveIntensity: 0.2, // Lower intensity for darker colors to show
            roughness: 0.1,
            clearcoat: 1.0
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.scale.set(1, 1, 1.8);
        
        // Store reference to material for dynamic color changing
        this.headMaterial = headMat;
        
        this.mesh.add(head);

        // Tail Shader
        const tailVert = `
            varying vec2 vUv; 
            uniform float uTime; 
            uniform float uSpeed;
            void main() {
                vUv = uv; 
                vec3 p = position;
                float freq = 20.0 + (uSpeed * 8.0);
                float amp = (0.2 + uSpeed * 0.5) * uv.y; 
                p.x += sin(uTime * freq + p.y * 5.0) * amp;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
        `;
        const tailFrag = `
            varying vec2 vUv; 
            uniform vec3 uColor;
            void main() { 
                gl_FragColor = vec4(uColor, 0.9 * (1.0 - vUv.y)); 
            }
        `;
        
        this.tailMat = new THREE.ShaderMaterial({
            uniforms: { 
                uTime: { value: 0 }, 
                uSpeed: { value: 0 },
                uColor: { value: new THREE.Color(this.color) } // Tail matches body
            },
            vertexShader: tailVert,
            fragmentShader: tailFrag,
            transparent: true, 
            side: THREE.DoubleSide
        });

        const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3.5, 1, 32), this.tailMat);
        tail.position.z = 0.8; 
        tail.rotation.x = Math.PI/2; 
        tail.geometry.translate(0, -1.75, 0); 
        this.mesh.add(tail);
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

    // Method to update color dynamically (for Menu selection)
    setColor(hexColor) {
        this.color = hexColor;
        const colObj = new THREE.Color(hexColor);
        if (this.headMaterial) {
            this.headMaterial.color = colObj;
            this.headMaterial.emissive = colObj;
        }
        if (this.tailMat) {
            this.tailMat.uniforms.uColor.value = colObj;
        }
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
        if(!this.isRemote) logEvent(`ENERGY RESTORED!\nCHARGES: ${this.boostCharges}`);
    }

    update(dt, time) {
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
                }
            }
        } else {
            // REMOTE / AI BEHAVIOR
            // Add slight randomness so they don't look like robots
            this.body.applyForce(new CANNON.Vec3(
                (Math.random() - 0.5) * 5, 
                (Math.random() - 0.5) * 5, 
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

        // 5. Sync Visuals
        this.mesh.position.copy(this.body.position);
        
        if (this.body.velocity.lengthSquared() > 0.1) {
            const lookTarget = this.mesh.position.clone().add(this.body.velocity);
            this.mesh.lookAt(lookTarget);
        }

        // 6. Tail Uniforms
        this.tailMat.uniforms.uTime.value = time;
        this.tailMat.uniforms.uSpeed.value = this.body.velocity.length() * 0.05;
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