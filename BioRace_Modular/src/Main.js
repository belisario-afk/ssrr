import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { CONFIG } from './Config.js';
import { World } from './World.js';
import { Player } from './Player.js';
import { ObstacleManager } from './Obstacles.js';
import { updateUI, updateBoostDisplay, logEvent } from './Utils.js';
import { GiftSystem } from './GiftSystem.js';
import { SkinManager } from './Skins.js';
import { ParticleEffects } from './ParticleEffects.js';
import { getAudioSystem } from './AudioSystem.js';
import { getGameState } from './GameState.js';

class Game {
    constructor() {
        this.world = new World();
        this.clock = new THREE.Clock();
        this.gameStarted = false;
        this.active = true;
        this.remotePlayers = []; // Store viewer/gifter players
        this.gifterCompetitors = []; // Smart AI competitors from gifts
        
        // Camera shake state
        this.cameraShake = { intensity: 0, duration: 0 };
        this.originalCameraPosition = new THREE.Vector3();
        
        // Initialize systems
        this.skinManager = new SkinManager();
        this.skinManager.loadEquipped();
        this.particleEffects = new ParticleEffects(this.world);
        this.audio = getAudioSystem();
        this.gameState = getGameState();

        this.setupPostProcessing();
        this.setupMenu();
        this.setupPauseMenu();
        this.setupGameOverScreen();
        this.setupKeyboardShortcuts();
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
    
    setupPauseMenu() {
        // Create pause menu if it doesn't exist
        if (!document.getElementById('pause-menu')) {
            const pauseMenu = document.createElement('div');
            pauseMenu.id = 'pause-menu';
            pauseMenu.innerHTML = `
                <div class="pause-content">
                    <h2>⏸️ PAUSED</h2>
                    <div class="pause-stats">
                        <div>Distance: <span id="pause-distance">0m</span></div>
                        <div>Score: <span id="pause-score">0</span></div>
                        <div>Lives: <span id="pause-lives">3</span></div>
                    </div>
                    <button id="resume-btn">▶️ RESUME</button>
                    <button id="settings-btn-pause">⚙️ SETTINGS</button>
                    <button id="quit-btn">🚪 QUIT TO MENU</button>
                </div>
            `;
            pauseMenu.style.cssText = `
                display: none;
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(10px);
                z-index: 200;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
            `;
            document.body.appendChild(pauseMenu);
            
            // Style the pause content
            const style = document.createElement('style');
            style.textContent = `
                .pause-content { text-align: center; }
                .pause-content h2 { font-size: 48px; margin-bottom: 20px; color: #ffaa00; }
                .pause-stats { margin: 20px 0; font-size: 18px; line-height: 2; }
                .pause-stats span { color: #00ffff; font-weight: bold; }
                #pause-menu button {
                    display: block;
                    width: 200px;
                    margin: 10px auto;
                    padding: 15px 30px;
                    font-size: 16px;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                #resume-btn { background: linear-gradient(45deg, #00ff88, #00cc66); color: #000; }
                #settings-btn-pause { background: linear-gradient(45deg, #0088ff, #0066cc); color: #fff; }
                #quit-btn { background: linear-gradient(45deg, #ff4444, #cc0000); color: #fff; }
                #pause-menu button:hover { transform: scale(1.05); }
                
                /* Lives display */
                .lives-display { display: flex; gap: 5px; justify-content: center; margin: 10px 0; }
                .life-heart { font-size: 24px; transition: all 0.3s; }
                .life-heart.lost { opacity: 0.3; transform: scale(0.8); }
                
                /* Power-up indicators */
                .powerup-bar {
                    position: absolute;
                    top: 150px;
                    left: 30px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .powerup-indicator {
                    display: none;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 15px;
                    background: rgba(0,0,0,0.7);
                    border-radius: 10px;
                    color: white;
                    font-size: 14px;
                }
                .powerup-indicator.active { display: flex; }
                .powerup-icon { font-size: 24px; }
                .powerup-timer { font-weight: bold; }
                
                /* Combo display */
                #combo-display {
                    position: absolute;
                    top: 50%;
                    right: 50px;
                    transform: translateY(-50%);
                    font-size: 36px;
                    font-weight: bold;
                    color: #ffd700;
                    text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                #combo-display.active { opacity: 1; animation: combo-pulse 0.3s ease-out; }
                @keyframes combo-pulse {
                    0% { transform: translateY(-50%) scale(1.5); }
                    100% { transform: translateY(-50%) scale(1); }
                }
                
                /* Leaderboard */
                .race-leaderboard {
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 1px solid rgba(255,255,255,0.2);
                }
                .leaderboard-title { font-size: 11px; letter-spacing: 2px; color: #ffaa00; margin-bottom: 10px; }
                .leaderboard-entry {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 10px;
                    font-size: 12px;
                    color: #888;
                    border-radius: 5px;
                }
                .leaderboard-entry.player { background: rgba(255, 215, 0, 0.2); color: #ffd700; }
                .leaderboard-entry.gifter { color: #ff69b4; }
                .leaderboard-rank { font-weight: bold; width: 25px; }
            `;
            document.head.appendChild(style);
            
            // Event handlers
            document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
            document.getElementById('quit-btn').addEventListener('click', () => location.reload());
        }
    }
    
    setupGameOverScreen() {
        // Create game over screen if it doesn't exist
        if (!document.getElementById('gameover-screen')) {
            const gameoverScreen = document.createElement('div');
            gameoverScreen.id = 'gameover-screen';
            gameoverScreen.innerHTML = `
                <div class="gameover-content">
                    <h2>💀 GAME OVER</h2>
                    <div class="final-stats">
                        <div class="stat-row"><span>Distance:</span> <span id="final-distance">0m</span></div>
                        <div class="stat-row"><span>Score:</span> <span id="final-score">0</span></div>
                        <div class="stat-row"><span>Obstacles Dodged:</span> <span id="final-dodged">0</span></div>
                        <div class="stat-row"><span>Pills Collected:</span> <span id="final-pills">0</span></div>
                        <div class="stat-row"><span>Max Combo:</span> <span id="final-combo">0x</span></div>
                        <div class="stat-row"><span>Time:</span> <span id="final-time">0:00</span></div>
                    </div>
                    <button id="retry-btn">🔄 TRY AGAIN</button>
                </div>
            `;
            gameoverScreen.style.cssText = `
                display: none;
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(50, 0, 0, 0.9);
                backdrop-filter: blur(10px);
                z-index: 200;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
            `;
            document.body.appendChild(gameoverScreen);
            
            // Style
            const style = document.createElement('style');
            style.textContent = `
                .gameover-content { text-align: center; }
                .gameover-content h2 { font-size: 60px; margin-bottom: 30px; color: #ff3333; text-shadow: 0 0 30px #ff0000; }
                .final-stats { margin: 30px 0; }
                .stat-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    font-size: 18px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    min-width: 300px;
                }
                .stat-row span:last-child { color: #00ffff; font-weight: bold; }
                #retry-btn {
                    margin-top: 30px;
                    padding: 20px 50px;
                    font-size: 20px;
                    background: linear-gradient(45deg, #ff0050, #ff0000);
                    border: none;
                    border-radius: 50px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                #retry-btn:hover { transform: scale(1.1); box-shadow: 0 0 30px rgba(255,0,0,0.5); }
            `;
            document.head.appendChild(style);
            
            document.getElementById('retry-btn').addEventListener('click', () => location.reload());
        }
    }
    
    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Escape to pause
            if (e.key === 'Escape' && this.gameStarted && !this.gameState.isGameOver) {
                this.togglePause();
            }
        });
    }
    
    togglePause() {
        if (!this.gameStarted || this.gameState.isGameOver) return;
        
        this.gameState.togglePause();
        const pauseMenu = document.getElementById('pause-menu');
        
        if (this.gameState.isPaused) {
            pauseMenu.style.display = 'flex';
            document.getElementById('pause-distance').textContent = Math.floor(this.gameState.distance) + 'm';
            document.getElementById('pause-score').textContent = this.gameState.score;
            document.getElementById('pause-lives').textContent = this.gameState.lives;
        } else {
            pauseMenu.style.display = 'none';
        }
    }

    startGame() {
        // Reset game state
        this.gameState.reset();
        this.gameState.start();
        
        // Setup game state callbacks
        this.gameState.onLivesChange = (lives) => this.updateLivesDisplay(lives);
        this.gameState.onGameOver = (stats) => this.showGameOver(stats);
        this.gameState.onCheckpoint = (num, dist) => {
            logEvent(`🏁 CHECKPOINT ${num}!\n${dist}m`);
            this.triggerCameraShake(0.3, 0.2);
        };
        this.gameState.onPowerUpChange = (type, active, config) => this.updatePowerUpDisplay(type, active, config);
        
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
        
        // Set remote players reference for obstacle awareness
        this.obstacles.setRemotePlayers(this.remotePlayers);
        this.obstacles.setGifterCompetitors(this.gifterCompetitors);
        
        // Initialize Gift System with obstacle manager reference
        this.giftSystem = new GiftSystem(this.world, this.player, this.obstacles);
        this.giftSystem.setObstacleManager(this.obstacles);
        
        // Set up gift system callbacks for spawning
        this.giftSystem.onSpawnCompetitor = (name, color) => this.spawnGifterCompetitor(name, color);
        this.giftSystem.onSpawnObstacle = (gifterName) => this.obstacles.spawnRandomObstacle(gifterName);
        this.giftSystem.onSpawnPowerUp = () => this.obstacles.spawnPowerUp();
        
        this.gameStarted = true;
        
        // Initialize UI elements
        this.createLivesDisplay();
        this.createPowerUpBar();
        this.createComboDisplay();
        this.createLeaderboard();
        
        // Start background music
        this.audio.startMusic();

        // --- Initial demo competitors ---
        setTimeout(() => this.spawnRemotePlayer("Viewer_1", 0xff0050), 2000);
        setTimeout(() => this.spawnRemotePlayer("Guest_X", 0x0088ff), 5000);
    }
    
    /**
     * Spawn a gifter as a smart AI competitor
     */
    spawnGifterCompetitor(name, color) {
        // Check if this gifter already has a competitor
        const existing = this.gifterCompetitors.find(c => c.name === name);
        if (existing) {
            // Give them a boost instead
            existing.boostCharges += 3;
            logEvent(`⚡ ${name}'s swimmer got a BOOST!`);
            return;
        }
        
        const competitor = new Player(this.world, {
            name: name,
            color: color,
            isRemote: true,
            isGifterCompetitor: true, // Smart AI!
            startPos: { 
                x: (Math.random() - 0.5) * 10, 
                y: (Math.random() - 0.5) * 10, 
                z: this.player.body.position.z - 20 // Start behind player
            }
        });
        
        // Give gifter competitors some boost charges
        competitor.boostCharges = 2;
        
        this.gifterCompetitors.push(competitor);
        this.gameState.addCompetitor(name, true);
        
        // Create a fancy spawn effect
        this.particleEffects.createBurstEffect(competitor.mesh.position, color, 50);
        
        logEvent(`🏊 ${name} ENTERED THE RACE!`);
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
    
    createLivesDisplay() {
        // Add lives display to the HUD
        const hudLeft = document.querySelector('.hud-panel.left');
        if (hudLeft && !document.getElementById('lives-display')) {
            const livesDiv = document.createElement('div');
            livesDiv.id = 'lives-display';
            livesDiv.className = 'lives-display';
            livesDiv.innerHTML = '❤️'.repeat(CONFIG.GAME.maxLives);
            livesDiv.style.cssText = 'margin-top: 15px;';
            
            const label = document.createElement('div');
            label.className = 'label';
            label.textContent = 'LIVES';
            label.style.marginTop = '15px';
            
            hudLeft.appendChild(label);
            hudLeft.appendChild(livesDiv);
        }
    }
    
    updateLivesDisplay(lives) {
        const livesDiv = document.getElementById('lives-display');
        if (livesDiv) {
            let hearts = '';
            for (let i = 0; i < CONFIG.GAME.maxLives; i++) {
                if (i < lives) {
                    hearts += '<span class="life-heart">❤️</span>';
                } else {
                    hearts += '<span class="life-heart lost">🖤</span>';
                }
            }
            livesDiv.innerHTML = hearts;
        }
        
        // Camera shake on life loss
        if (lives < this.gameState.lives) {
            this.triggerCameraShake(0.5, 0.3);
        }
    }
    
    createPowerUpBar() {
        if (!document.getElementById('powerup-bar')) {
            const bar = document.createElement('div');
            bar.id = 'powerup-bar';
            bar.className = 'powerup-bar';
            bar.innerHTML = `
                <div id="powerup-shield" class="powerup-indicator">
                    <span class="powerup-icon">🛡️</span>
                    <span class="powerup-name">SHIELD</span>
                    <span class="powerup-timer">5s</span>
                </div>
                <div id="powerup-speed" class="powerup-indicator">
                    <span class="powerup-icon">⚡</span>
                    <span class="powerup-name">SPEED</span>
                    <span class="powerup-timer">4s</span>
                </div>
                <div id="powerup-magnet" class="powerup-indicator">
                    <span class="powerup-icon">🧲</span>
                    <span class="powerup-name">MAGNET</span>
                    <span class="powerup-timer">8s</span>
                </div>
                <div id="powerup-slowmo" class="powerup-indicator">
                    <span class="powerup-icon">⏱️</span>
                    <span class="powerup-name">SLOW-MO</span>
                    <span class="powerup-timer">3s</span>
                </div>
            `;
            document.getElementById('ui-layer').appendChild(bar);
        }
    }
    
    updatePowerUpDisplay(type, active, config) {
        const elem = document.getElementById(`powerup-${type.toLowerCase()}`);
        if (elem) {
            if (active) {
                elem.classList.add('active');
                elem.style.borderLeft = `3px solid #${config.color.toString(16).padStart(6, '0')}`;
            } else {
                elem.classList.remove('active');
            }
        }
    }
    
    createComboDisplay() {
        if (!document.getElementById('combo-display')) {
            const combo = document.createElement('div');
            combo.id = 'combo-display';
            combo.textContent = 'x0';
            document.getElementById('ui-layer').appendChild(combo);
        }
    }
    
    updateComboDisplay() {
        const comboDiv = document.getElementById('combo-display');
        if (comboDiv && this.gameState.combo > 0) {
            comboDiv.textContent = `x${this.gameState.combo}`;
            comboDiv.classList.add('active');
        } else if (comboDiv) {
            comboDiv.classList.remove('active');
        }
    }
    
    createLeaderboard() {
        const hudRight = document.querySelector('.hud-panel.right');
        if (hudRight && !document.getElementById('race-leaderboard')) {
            const leaderboard = document.createElement('div');
            leaderboard.id = 'race-leaderboard';
            leaderboard.className = 'race-leaderboard';
            leaderboard.innerHTML = `
                <div class="leaderboard-title">🏆 RACE STANDINGS</div>
                <div id="leaderboard-entries"></div>
            `;
            hudRight.appendChild(leaderboard);
        }
    }
    
    updateLeaderboard() {
        const entries = document.getElementById('leaderboard-entries');
        if (!entries) return;
        
        // Collect all racers with their distances
        const racers = [
            { name: 'YOU', distance: this.gameState.distance, isPlayer: true, isGifter: false }
        ];
        
        this.gifterCompetitors.forEach(comp => {
            if (comp.body) {
                racers.push({
                    name: comp.name,
                    distance: Math.abs(comp.body.position.z),
                    isPlayer: false,
                    isGifter: true
                });
            }
        });
        
        // Sort by distance (more negative = further ahead)
        racers.sort((a, b) => b.distance - a.distance);
        
        // Show top 5
        let html = '';
        racers.slice(0, 5).forEach((racer, i) => {
            const classes = [];
            if (racer.isPlayer) classes.push('player');
            if (racer.isGifter) classes.push('gifter');
            
            html += `
                <div class="leaderboard-entry ${classes.join(' ')}">
                    <span class="leaderboard-rank">${i + 1}.</span>
                    <span class="leaderboard-name">${racer.name}</span>
                    <span class="leaderboard-dist">${Math.floor(racer.distance)}m</span>
                </div>
            `;
        });
        
        entries.innerHTML = html;
    }
    
    showGameOver(stats) {
        const gameoverScreen = document.getElementById('gameover-screen');
        if (gameoverScreen) {
            document.getElementById('final-distance').textContent = stats.distance + 'm';
            document.getElementById('final-score').textContent = stats.score;
            document.getElementById('final-dodged').textContent = stats.obstaclesDodged;
            document.getElementById('final-pills').textContent = stats.pillsCollected;
            document.getElementById('final-combo').textContent = stats.maxCombo + 'x';
            
            const mins = Math.floor(stats.time / 60);
            const secs = Math.floor(stats.time % 60);
            document.getElementById('final-time').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            
            gameoverScreen.style.display = 'flex';
        }
        
        this.audio.stopMusic();
        this.audio.playSFX('hit');
    }
    
    triggerCameraShake(intensity, duration) {
        this.cameraShake.intensity = intensity;
        this.cameraShake.duration = duration;
    }
    
    updateCameraShake(dt) {
        if (this.cameraShake.duration > 0) {
            this.cameraShake.duration -= dt;
            
            const shake = this.cameraShake.intensity * (this.cameraShake.duration / 0.3);
            this.world.camera.position.x += (Math.random() - 0.5) * shake;
            this.world.camera.position.y += (Math.random() - 0.5) * shake;
        }
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

        // Handle pause
        if (this.gameState.isPaused) {
            this.composer.render();
            return;
        }

        if(!this.active) return;

        const dt = this.clock.getDelta() * this.gameState.getTimeScale();
        const time = this.clock.getElapsedTime();

        // 1. Physics
        this.world.step(dt);
        
        // 2. Update game state
        this.gameState.update(dt, this.player.body.position.z);

        // 3. Local Player Update
        this.player.update(dt, time);
        
        // 4. Remote Players Update
        this.remotePlayers.forEach(p => p.update(dt, time));
        
        // 5. Gifter Competitors Update (with obstacle awareness)
        this.updateGifterCompetitors(dt, time);

        // 6. Obstacles Update
        this.obstacles.update();
        
        // 7. Gift System Update
        if (this.giftSystem) {
            this.giftSystem.update(dt);
        }
        
        // 8. Particle Effects Update
        this.particleEffects.update(dt);
        
        // 9. Skin Effects Update (aura pulsing, etc.)
        this.skinManager.updateEffects(this.player, time);

        // 10. Camera Follow (Local Player) with shake
        const target = this.player.mesh.position.clone().add(new THREE.Vector3(0, 4, 12));
        this.world.camera.position.lerp(target, 0.1);
        this.world.camera.lookAt(this.player.mesh.position);
        this.updateCameraShake(dt);

        // 11. UI Updates
        const remaining = updateUI(this.player.body.position.z, CONFIG.COURSE_LENGTH);
        updateBoostDisplay(this.player.boostCharges);
        this.updateComboDisplay();
        this.updateLeaderboard();
        this.updatePowerUpTimers();
        
        // 12. Win State
        if (remaining <= 30 && !this.gameState.isWin) {
            this.gameState.win();
            this.active = false;
            this.audio.playSFX('win');
            this.audio.stopMusic();
            document.getElementById('win-screen').style.display = 'flex';
        }

        this.composer.render();
    }
    
    updateGifterCompetitors(dt, time) {
        // Update each gifter competitor with obstacle/pill awareness
        this.gifterCompetitors.forEach(comp => {
            // Find nearest obstacle to this competitor
            const nearestObs = this.obstacles.findNearestObstacle(comp.body.position);
            comp.setNearestObstacle(nearestObs);
            
            // Find nearest pill
            const nearestPill = this.obstacles.findNearestPill(comp.body.position);
            comp.setNearestPill(nearestPill);
            
            // Update the competitor
            comp.update(dt, time);
        });
    }
    
    updatePowerUpTimers() {
        for (const [key, powerUp] of Object.entries(this.gameState.activePowerUps)) {
            const elem = document.getElementById(`powerup-${key}`);
            if (elem && powerUp.active) {
                const timer = elem.querySelector('.powerup-timer');
                if (timer) {
                    timer.textContent = Math.ceil(powerUp.timeLeft) + 's';
                }
            }
        }
    }
}

// Start App
new Game();