import * as THREE from 'three';
import * as CANNON from 'cannon';
import { CONFIG } from './Config.js';

export class World {
    constructor() {
        // 1. Three.js Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.FOG_COLOR);
        this.scene.fog = new THREE.FogExp2(CONFIG.FOG_COLOR, CONFIG.FOG_DENSITY);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);

        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(this.renderer.domElement);

        // 4. Physics World
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, 0, 0);
        
        // Materials
        this.defaultMat = new CANNON.Material();
        const contactMat = new CANNON.ContactMaterial(this.defaultMat, this.defaultMat, { 
            friction: 0.1, 
            restitution: 0.5 
        });
        this.physicsWorld.addContactMaterial(contactMat);

        // 5. Lighting (Brightened)
        const ambient = new THREE.AmbientLight(CONFIG.LIGHT_COLOR, CONFIG.LIGHT_INTENSITY);
        this.scene.add(ambient);

        // Directional light for depth
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        // 6. Build Environment
        this.buildTunnel();
        this.buildGoal();

        // Handle Resize
        window.addEventListener('resize', () => this.onResize());
    }

    buildTunnel() {
        // Main Tube
        const geo = new THREE.CylinderGeometry(CONFIG.TUNNEL_RADIUS, CONFIG.TUNNEL_RADIUS, 12000, 48, 200, true);
        const mat = new THREE.MeshStandardMaterial({ 
            color: CONFIG.TUNNEL_COLOR, 
            side: THREE.BackSide, 
            roughness: 0.5,
            emissive: CONFIG.TUNNEL_EMISSIVE,
            emissiveIntensity: 0.3 // Increased glow
        });
        const tunnel = new THREE.Mesh(geo, mat);
        tunnel.rotation.x = Math.PI / 2;
        this.scene.add(tunnel);

        // Ribs/Veins
        const ribGeo = new THREE.TorusGeometry(CONFIG.TUNNEL_RADIUS - 0.5, 0.3, 16, 48);
        const ribMat = new THREE.MeshStandardMaterial({ color: 0xaa4444, roughness: 0.3 });
        const ribMesh = new THREE.InstancedMesh(ribGeo, ribMat, 200);
        
        const dummy = new THREE.Object3D();
        for(let i=0; i<200; i++) {
            dummy.position.set(0, 0, -i * 60);
            dummy.rotation.x = 0; 
            dummy.updateMatrix();
            ribMesh.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(ribMesh);
    }

    buildGoal() {
        const geo = new THREE.SphereGeometry(30, 64, 64);
        const mat = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffdd, 
            emissive: 0x555500, 
            roughness: 0.2, 
            clearcoat: 1.0 
        });
        const egg = new THREE.Mesh(geo, mat);
        egg.position.z = -CONFIG.COURSE_LENGTH;
        this.scene.add(egg);

        // Halo
        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(40, 32, 32), 
            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.15, side: THREE.BackSide })
        );
        egg.add(halo);
    }

    step(dt) {
        this.physicsWorld.step(1/60, dt);
    }

    render(composer) {
        if(composer) composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}