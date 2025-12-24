import * as THREE from 'three';
import * as CANNON from 'cannon';
import { CONFIG } from './Config.js';

/**
 * GutsWorld - 3D intestine/guts environment
 * Phase 2 of major game upgrade
 * Replaces the simple tube with organic, detailed environment
 */

export class GutsWorld {
    constructor() {
        // 1. Three.js Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a0505); // Darker red
        this.scene.fog = new THREE.FogExp2(0x220808, CONFIG.FOG_DENSITY * 0.8);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);

        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        // 4. Physics World
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, -9.8, 0); // Real gravity for combat
        
        // Materials
        this.defaultMat = new CANNON.Material();
        const contactMat = new CANNON.ContactMaterial(this.defaultMat, this.defaultMat, { 
            friction: 0.3, 
            restitution: 0.3 
        });
        this.physicsWorld.addContactMaterial(contactMat);
        
        // Ground plane for walking
        this.groundMat = new CANNON.Material('ground');
        const groundShape = new CANNON.Plane();
        this.groundBody = new CANNON.Body({ mass: 0, material: this.groundMat });
        this.groundBody.addShape(groundShape);
        this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.groundBody.position.y = -CONFIG.TUNNEL_RADIUS + 1;
        this.physicsWorld.addBody(this.groundBody);

        // 5. Lighting
        this.setupLighting();

        // 6. Build Environment
        this.buildGutsEnvironment();
        this.buildGoal();
        
        // Decorations array for updates
        this.decorations = [];
        this.bloodCells = [];

        // Handle Resize
        window.addEventListener('resize', () => this.onResize());
    }
    
    setupLighting() {
        // Ambient - dim red for guts atmosphere
        const ambient = new THREE.AmbientLight(0x441111, 0.4);
        this.scene.add(ambient);
        
        // Main directional light (simulating bio-luminescence)
        const dirLight = new THREE.DirectionalLight(0xff8866, 0.6);
        dirLight.position.set(0, 20, -50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        this.scene.add(dirLight);
        
        // Point lights inside the guts (pulsing effect later)
        this.gutsLights = [];
        for (let i = 0; i < 10; i++) {
            const light = new THREE.PointLight(0xff4422, 0.8, 50);
            light.position.set(
                (Math.random() - 0.5) * CONFIG.TUNNEL_RADIUS,
                (Math.random() - 0.5) * CONFIG.TUNNEL_RADIUS,
                -i * 500
            );
            this.scene.add(light);
            this.gutsLights.push({ light, phase: Math.random() * Math.PI * 2 });
        }
    }

    buildGutsEnvironment() {
        // Create organic, curved intestine tunnel using multiple segments
        const numSegments = 100;
        const segmentLength = CONFIG.COURSE_LENGTH / numSegments;
        
        // Tunnel path with curves and wobbles
        this.tunnelPath = [];
        let currentX = 0;
        let currentY = 0;
        
        for (let i = 0; i <= numSegments; i++) {
            const z = -i * segmentLength;
            // Add organic curves
            currentX += (Math.random() - 0.5) * 10;
            currentY += (Math.random() - 0.5) * 5;
            // Clamp to prevent too wild curves
            currentX = Math.max(-50, Math.min(50, currentX));
            currentY = Math.max(-30, Math.min(30, currentY));
            this.tunnelPath.push(new THREE.Vector3(currentX * 0.3, currentY * 0.3, z));
        }
        
        // Create intestine walls using Catmull-Rom curve
        const curve = new THREE.CatmullRomCurve3(this.tunnelPath);
        
        // Main intestine tube - organic material
        const tubeGeo = new THREE.TubeGeometry(curve, numSegments * 2, CONFIG.TUNNEL_RADIUS, 32, false);
        const tubeMat = new THREE.MeshStandardMaterial({
            color: 0xaa3333,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.BackSide,
            emissive: 0x220000,
            emissiveIntensity: 0.2,
            bumpScale: 0.5
        });
        
        // Add procedural bump texture for organic feel
        this.createOrganicTexture(tubeMat);
        
        const intestine = new THREE.Mesh(tubeGeo, tubeMat);
        this.scene.add(intestine);
        this.intestineMesh = intestine;
        
        // Add villi (finger-like projections inside intestine)
        this.createVilli();
        
        // Add blood vessels running along walls
        this.createBloodVessels(curve);
        
        // Add floating blood cells
        this.createBloodCells();
        
        // Add organic decorations
        this.createOrganicDecorations();
        
        // Create floor for walking (flattened area at bottom)
        this.createWalkableFloor();
    }
    
    /**
     * Create procedural organic texture
     */
    createOrganicTexture(material) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Base color
        ctx.fillStyle = '#993333';
        ctx.fillRect(0, 0, 512, 512);
        
        // Add organic noise pattern
        for (let i = 0; i < 1000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = Math.random() * 30 + 5;
            const alpha = Math.random() * 0.3;
            
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, `rgba(180, 60, 60, ${alpha})`);
            grad.addColorStop(1, 'rgba(150, 50, 50, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        
        // Add vein-like lines
        ctx.strokeStyle = 'rgba(120, 30, 30, 0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            let x = Math.random() * 512;
            let y = Math.random() * 512;
            ctx.moveTo(x, y);
            for (let j = 0; j < 5; j++) {
                x += (Math.random() - 0.5) * 100;
                y += (Math.random() - 0.5) * 100;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(20, 200);
        material.map = texture;
    }
    
    /**
     * Create villi (finger-like projections)
     */
    createVilli() {
        const villiMat = new THREE.MeshStandardMaterial({
            color: 0xcc5555,
            roughness: 0.9,
            metalness: 0
        });
        
        const villiGeom = new THREE.ConeGeometry(0.3, 1.5, 8);
        const villiMesh = new THREE.InstancedMesh(villiGeom, villiMat, 2000);
        
        const dummy = new THREE.Object3D();
        const radius = CONFIG.TUNNEL_RADIUS - 0.5;
        
        for (let i = 0; i < 2000; i++) {
            const angle = Math.random() * Math.PI * 2;
            const z = -Math.random() * CONFIG.COURSE_LENGTH;
            
            // Position on tube wall
            const pathPoint = this.getPathPointAtZ(z);
            dummy.position.set(
                pathPoint.x + Math.cos(angle) * radius,
                pathPoint.y + Math.sin(angle) * radius,
                z
            );
            
            // Point inward
            dummy.lookAt(pathPoint.x, pathPoint.y, z);
            dummy.rotateX(Math.PI / 2);
            
            // Random size variation
            const scale = 0.5 + Math.random() * 0.8;
            dummy.scale.set(scale, scale, scale);
            
            dummy.updateMatrix();
            villiMesh.setMatrixAt(i, dummy.matrix);
        }
        
        this.scene.add(villiMesh);
    }
    
    /**
     * Create blood vessels along walls
     */
    createBloodVessels(mainCurve) {
        const vesselMat = new THREE.MeshStandardMaterial({
            color: 0x880022,
            roughness: 0.6,
            metalness: 0.2,
            emissive: 0x220000,
            emissiveIntensity: 0.3
        });
        
        // Create several blood vessel tubes running along the intestine
        for (let v = 0; v < 8; v++) {
            const angle = (v / 8) * Math.PI * 2;
            const vesselRadius = 0.5 + Math.random() * 0.5;
            
            const vesselPoints = [];
            for (let i = 0; i <= 50; i++) {
                const t = i / 50;
                const point = mainCurve.getPoint(t);
                // Offset from center
                const offset = CONFIG.TUNNEL_RADIUS - 1 - Math.random() * 2;
                vesselPoints.push(new THREE.Vector3(
                    point.x + Math.cos(angle + Math.sin(t * 10) * 0.3) * offset,
                    point.y + Math.sin(angle + Math.sin(t * 10) * 0.3) * offset,
                    point.z
                ));
            }
            
            const vesselCurve = new THREE.CatmullRomCurve3(vesselPoints);
            const vesselGeo = new THREE.TubeGeometry(vesselCurve, 100, vesselRadius, 8, false);
            const vessel = new THREE.Mesh(vesselGeo, vesselMat);
            this.scene.add(vessel);
        }
    }
    
    /**
     * Create floating blood cells
     */
    createBloodCells() {
        // Red blood cells (flat discs)
        const rbcMat = new THREE.MeshStandardMaterial({
            color: 0xcc2222,
            roughness: 0.3,
            metalness: 0.1
        });
        
        const rbcGeom = new THREE.TorusGeometry(0.8, 0.3, 8, 16);
        
        for (let i = 0; i < 200; i++) {
            const rbc = new THREE.Mesh(rbcGeom, rbcMat);
            rbc.position.set(
                (Math.random() - 0.5) * CONFIG.TUNNEL_RADIUS * 1.5,
                (Math.random() - 0.5) * CONFIG.TUNNEL_RADIUS * 1.5,
                -Math.random() * CONFIG.COURSE_LENGTH
            );
            rbc.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            const scale = 0.3 + Math.random() * 0.4;
            rbc.scale.set(scale, scale, scale * 0.3);
            
            this.scene.add(rbc);
            this.bloodCells.push({
                mesh: rbc,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5
                ),
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02
                )
            });
        }
        
        // White blood cells (larger, spherical)
        const wbcMat = new THREE.MeshStandardMaterial({
            color: 0xeeeecc,
            roughness: 0.4,
            metalness: 0.1,
            transparent: true,
            opacity: 0.8
        });
        
        const wbcGeom = new THREE.SphereGeometry(1, 16, 16);
        
        for (let i = 0; i < 30; i++) {
            const wbc = new THREE.Mesh(wbcGeom, wbcMat);
            wbc.position.set(
                (Math.random() - 0.5) * CONFIG.TUNNEL_RADIUS,
                (Math.random() - 0.5) * CONFIG.TUNNEL_RADIUS,
                -Math.random() * CONFIG.COURSE_LENGTH
            );
            const scale = 0.5 + Math.random() * 0.5;
            wbc.scale.set(scale, scale, scale);
            
            this.scene.add(wbc);
            this.bloodCells.push({
                mesh: wbc,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3
                ),
                rotationSpeed: new THREE.Vector3(0, 0, 0)
            });
        }
    }
    
    /**
     * Create organic decorations (mucus, bacteria, etc)
     */
    createOrganicDecorations() {
        // Mucus blobs
        const mucusMat = new THREE.MeshPhysicalMaterial({
            color: 0xaacc88,
            roughness: 0.1,
            metalness: 0,
            transmission: 0.5,
            transparent: true,
            opacity: 0.6
        });
        
        const mucusGeom = new THREE.SphereGeometry(1, 8, 8);
        
        for (let i = 0; i < 50; i++) {
            const mucus = new THREE.Mesh(mucusGeom, mucusMat);
            const angle = Math.random() * Math.PI * 2;
            const radius = CONFIG.TUNNEL_RADIUS - 2;
            const z = -Math.random() * CONFIG.COURSE_LENGTH;
            const pathPoint = this.getPathPointAtZ(z);
            
            mucus.position.set(
                pathPoint.x + Math.cos(angle) * radius,
                pathPoint.y + Math.sin(angle) * radius,
                z
            );
            
            const scaleX = 0.5 + Math.random() * 1.5;
            const scaleY = 0.5 + Math.random() * 1.5;
            const scaleZ = 0.5 + Math.random() * 1.5;
            mucus.scale.set(scaleX, scaleY, scaleZ);
            
            this.scene.add(mucus);
            this.decorations.push(mucus);
        }
    }
    
    /**
     * Create walkable floor at bottom of tube
     */
    createWalkableFloor() {
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x993333,
            roughness: 0.9,
            metalness: 0
        });
        
        // Flat curved floor following the intestine path
        const floorWidth = CONFIG.TUNNEL_RADIUS * 1.5;
        const floorPoints = [];
        
        for (let i = 0; i <= 100; i++) {
            const t = i / 100;
            const z = -t * CONFIG.COURSE_LENGTH;
            const pathPoint = this.getPathPointAtZ(z);
            floorPoints.push(new THREE.Vector3(pathPoint.x, pathPoint.y - CONFIG.TUNNEL_RADIUS + 1, z));
        }
        
        const floorCurve = new THREE.CatmullRomCurve3(floorPoints);
        
        // Create flat ribbon geometry for floor
        const floorShape = new THREE.Shape();
        floorShape.moveTo(-floorWidth/2, 0);
        floorShape.lineTo(floorWidth/2, 0);
        floorShape.lineTo(floorWidth/2, 0.5);
        floorShape.lineTo(-floorWidth/2, 0.5);
        floorShape.closePath();
        
        const extrudeSettings = {
            steps: 500,
            bevelEnabled: false,
            extrudePath: floorCurve
        };
        
        const floorGeo = new THREE.ExtrudeGeometry(floorShape, extrudeSettings);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.receiveShadow = true;
        this.scene.add(floor);
    }
    
    /**
     * Get interpolated path point at a given Z position
     */
    getPathPointAtZ(z) {
        // Find which segment we're in
        const segmentLength = CONFIG.COURSE_LENGTH / (this.tunnelPath.length - 1);
        const index = Math.min(
            Math.floor(-z / segmentLength),
            this.tunnelPath.length - 2
        );
        
        if (index < 0 || index >= this.tunnelPath.length - 1) {
            return new THREE.Vector3(0, 0, z);
        }
        
        const t = (-z % segmentLength) / segmentLength;
        const p1 = this.tunnelPath[index];
        const p2 = this.tunnelPath[index + 1];
        
        return new THREE.Vector3(
            p1.x + (p2.x - p1.x) * t,
            p1.y + (p2.y - p1.y) * t,
            z
        );
    }

    buildGoal() {
        // The egg at the end - now more detailed
        const eggGroup = new THREE.Group();
        
        // Main egg
        const eggGeo = new THREE.SphereGeometry(30, 64, 64);
        const eggMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffdd, 
            emissive: 0x555500, 
            roughness: 0.2, 
            clearcoat: 1.0,
            transmission: 0.3
        });
        const egg = new THREE.Mesh(eggGeo, eggMat);
        eggGroup.add(egg);

        // Outer membrane
        const membrane = new THREE.Mesh(
            new THREE.SphereGeometry(35, 32, 32), 
            new THREE.MeshBasicMaterial({ 
                color: 0xffff00, 
                transparent: true, 
                opacity: 0.1, 
                side: THREE.BackSide 
            })
        );
        eggGroup.add(membrane);
        
        // Corona radiata (cells surrounding egg)
        const coronaMat = new THREE.MeshStandardMaterial({
            color: 0xffddaa,
            roughness: 0.6
        });
        const coronaGeo = new THREE.SphereGeometry(2, 8, 8);
        
        for (let i = 0; i < 100; i++) {
            const cell = new THREE.Mesh(coronaGeo, coronaMat);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const r = 38 + Math.random() * 5;
            cell.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
            const scale = 0.5 + Math.random() * 0.5;
            cell.scale.set(scale, scale, scale);
            eggGroup.add(cell);
        }
        
        eggGroup.position.z = -CONFIG.COURSE_LENGTH;
        this.scene.add(eggGroup);
        this.egg = eggGroup;
    }

    step(dt) {
        this.physicsWorld.step(1/60, dt);
    }

    render(composer) {
        if(composer) composer.render();
        else this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Update animated elements
     */
    update(dt, time) {
        // Pulse guts lights
        this.gutsLights.forEach((lightData) => {
            lightData.light.intensity = 0.5 + Math.sin(time * 2 + lightData.phase) * 0.3;
        });
        
        // Animate blood cells
        this.bloodCells.forEach((cell) => {
            cell.mesh.position.add(cell.velocity);
            cell.mesh.rotation.x += cell.rotationSpeed.x;
            cell.mesh.rotation.y += cell.rotationSpeed.y;
            cell.mesh.rotation.z += cell.rotationSpeed.z;
            
            // Constrain to tunnel
            const dist = Math.sqrt(
                cell.mesh.position.x * cell.mesh.position.x + 
                cell.mesh.position.y * cell.mesh.position.y
            );
            if (dist > CONFIG.TUNNEL_RADIUS - 2) {
                cell.velocity.x *= -1;
                cell.velocity.y *= -1;
            }
        });
    }

    onResize() {
        const isTikTokMode = document.body.classList.contains('tiktok-mode');
        
        if (isTikTokMode) {
            const targetAspect = 9 / 16;
            let width, height;
            
            if (window.innerWidth / window.innerHeight > targetAspect) {
                height = window.innerHeight;
                width = height * targetAspect;
            } else {
                width = window.innerWidth;
                height = width / targetAspect;
            }
            
            this.camera.aspect = targetAspect;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        } else {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
}
