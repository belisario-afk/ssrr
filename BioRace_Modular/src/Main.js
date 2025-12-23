import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { CONFIG } from './Config.js';
import { World } from './World.js';
import { Player } from './Player.js';
import { ObstacleManager } from './Obstacles.js';
import { updateUI, updateBoostDisplay } from './Utils.js';
import { GiftSystem } from './GiftSystem.js';
import { SkinManager } from './Skins.js';
import { ParticleEffects } from './ParticleEffects.js';
import { getAudioSystem } from './AudioSystem.js';

class Game {
    constructor() {
        this.world = new World();
        this.clock = new THREE.Clock();
        this.gameStarted = false;
        this.active = true;
        this.remotePlayers = []; // Store viewer players
        
        // Initialize new systems
        this.skinManager = new SkinManager();
        this.skinManager.loadEquipped();
        this.particleEffects = new ParticleEffects(this.world);
        this.audio = getAudioSystem();

        this.setupPostProcessing();
        this.setupMenu();
        this.loop();
    }

    setupMenu() {
        // Handle Color Selection
        this.selectedColor = 0xffffff;
        const swatches = document.querySelectorAll('.swatch');
        swatches.forEach(s => {
            s.addEventListener('click', () => {
                swatches.forEach(sw => sw.classList.remove('selected'));
                s.classList.add('selected');
                this.selectedColor = parseInt(s.dataset.color);
            });
        });

        // Handle Start Button
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('main-menu').style.display = 'none';
            this.startGame();
        });
    }

    startGame() {
        // Initialize Player with Selected Color
        this.player = new Player(this.world, { 
            color: this.selectedColor, 
            isRemote: false 
        });
        
        // Apply skin customizations
        this.skinManager.applySkinToPlayer(this.player);
        
        // Create player trail if skin has trail
        if (this.skinManager.currentSkin.trail !== 'none') {
            const trailData = this.skinManager.getShopItems('TRAILS').find(
                t => t.id === this.skinManager.currentSkin.trail
            );
            if (trailData) {
                this.particleEffects.createTrailSystem(this.player, {
                    color: trailData.particleColor || this.selectedColor,
                    rainbow: trailData.rainbow
                });
            }
        }
        
        this.obstacles = new ObstacleManager(this.world, this.player);
        
        // Initialize Gift System
        this.giftSystem = new GiftSystem(this.world, this.player);
        
        this.gameStarted = true;
        
        // Start background music
        this.audio.startMusic();

        // --- MULTIPLAYER TEST (Simulate Viewers Joining) ---
        // In a real app, this would be triggered by a WebSocket event
        setTimeout(() => this.spawnRemotePlayer("Viewer_1", 0xff0050), 2000);
        setTimeout(() => this.spawnRemotePlayer("Guest_X", 0x0088ff), 5000);
    }

    spawnRemotePlayer(name, color) {
        // Create a new Player instance marked as 'Remote'
        const remote = new Player(this.world, {
            name: name,
            color: color,
            isRemote: true,
            startPos: { x: (Math.random()-0.5)*10, y: (Math.random()-0.5)*10, z: this.player.body.position.z }
        });
        this.remotePlayers.push(remote);
    }

    setupPostProcessing() {
        this.composer = new EffectComposer(this.world.renderer);
        this.composer.addPass(new RenderPass(this.world.scene, this.world.camera));
        
        const bloom = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight), 
            1.2, 0.4, 0.85
        );
        this.composer.addPass(bloom);
        
        window.addEventListener('resize', () => {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    loop() {
        requestAnimationFrame(() => this.loop());

        // Don't update game logic if menu is open
        if(!this.gameStarted) {
            this.composer.render();
            return;
        }

        if(!this.active) return;

        const dt = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // 1. Physics
        this.world.step(dt);

        // 2. Local Player Update
        this.player.update(dt, time);
        
        // 3. Remote Players Update
        this.remotePlayers.forEach(p => p.update(dt, time));

        // 4. Obstacles Update
        this.obstacles.update();
        
        // 5. Gift System Update
        if (this.giftSystem) {
            this.giftSystem.update(dt);
        }
        
        // 6. Particle Effects Update
        this.particleEffects.update(dt);
        
        // 7. Skin Effects Update (aura pulsing, etc.)
        this.skinManager.updateEffects(this.player, time);

        // 8. Camera Follow (Local Player)
        const target = this.player.mesh.position.clone().add(new THREE.Vector3(0, 4, 12));
        this.world.camera.position.lerp(target, 0.1);
        this.world.camera.lookAt(this.player.mesh.position);

        // 9. UI & Win State
        const remaining = updateUI(this.player.body.position.z, CONFIG.COURSE_LENGTH);
        updateBoostDisplay(this.player.boostCharges);
        
        if (remaining <= 30) {
            this.active = false;
            this.audio.playSFX('win');
            this.audio.stopMusic();
            document.getElementById('win-screen').style.display = 'flex';
        }

        this.composer.render();
    }
}

// Start App
new Game();