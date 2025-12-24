import { CONFIG } from './Config.js';

/**
 * GameState - Manages game state including lives, score, checkpoints, and pause
 */
export class GameState {
    constructor() {
        // Core game state
        this.lives = CONFIG.GAME.maxLives;
        this.score = 0;
        this.distance = 0;
        this.obstaclesDodged = 0;
        this.pillsCollected = 0;
        this.giftsReceived = 0;
        
        // Checkpoints
        this.lastCheckpoint = 0;
        this.checkpointsReached = 0;
        
        // Game status
        this.isPaused = false;
        this.isGameOver = false;
        this.isWin = false;
        
        // Time tracking
        this.startTime = 0;
        this.elapsedTime = 0;
        this.pausedTime = 0;
        
        // Difficulty scaling
        this.difficultyLevel = 1;
        this.obstacleSpeedMultiplier = 1.0;
        this.spawnRateMultiplier = 1.0;
        
        // Power-up state
        this.activePowerUps = {
            shield: { active: false, timeLeft: 0 },
            speed: { active: false, timeLeft: 0, multiplier: 1 },
            magnet: { active: false, timeLeft: 0 },
            slowmo: { active: false, timeLeft: 0, timeScale: 1 }
        };
        
        // Leaderboard
        this.competitors = []; // { name, distance, isGifter }
        
        // Combo system
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;
        
        // Callbacks for UI updates
        this.onLivesChange = null;
        this.onScoreChange = null;
        this.onCheckpoint = null;
        this.onGameOver = null;
        this.onWin = null;
        this.onPowerUpChange = null;
    }
    
    /**
     * Start the game
     */
    start() {
        this.startTime = Date.now();
        this.lives = CONFIG.GAME.maxLives;
        this.score = 0;
        this.distance = 0;
        this.isGameOver = false;
        this.isWin = false;
        this.isPaused = false;
        this.difficultyLevel = 1;
    }
    
    /**
     * Update game state each frame
     */
    update(dt, playerZ) {
        if (this.isPaused || this.isGameOver) return;
        
        // Update distance
        this.distance = Math.abs(playerZ);
        
        // Check for checkpoint
        const nextCheckpoint = (this.checkpointsReached + 1) * CONFIG.GAME.checkpointInterval;
        if (this.distance >= nextCheckpoint) {
            this.checkpointsReached++;
            this.lastCheckpoint = -nextCheckpoint; // Negative because player moves in -Z
            if (this.onCheckpoint) {
                this.onCheckpoint(this.checkpointsReached, nextCheckpoint);
            }
            // Bonus score for checkpoint
            this.addScore(100 * this.checkpointsReached);
        }
        
        // Update elapsed time
        this.elapsedTime = (Date.now() - this.startTime - this.pausedTime) / 1000;
        
        // Update difficulty scaling
        if (CONFIG.GAME.difficultyScaling) {
            this.difficultyLevel = 1 + Math.floor(this.distance / 1000) * 0.2;
            this.obstacleSpeedMultiplier = 1 + this.difficultyLevel * 0.1;
            this.spawnRateMultiplier = 1 + this.difficultyLevel * 0.15;
        }
        
        // Update power-ups
        this.updatePowerUps(dt);
        
        // Update combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }
        
        // Update score based on distance
        this.score = Math.floor(this.distance) + (this.obstaclesDodged * 10) + (this.pillsCollected * 25);
        
        // Check win condition
        if (this.distance >= CONFIG.COURSE_LENGTH) {
            this.win();
        }
    }
    
    /**
     * Update active power-ups
     */
    updatePowerUps(dt) {
        for (const [key, powerUp] of Object.entries(this.activePowerUps)) {
            if (powerUp.active) {
                powerUp.timeLeft -= dt;
                if (powerUp.timeLeft <= 0) {
                    this.deactivatePowerUp(key);
                }
            }
        }
    }
    
    /**
     * Activate a power-up
     */
    activatePowerUp(type) {
        const config = CONFIG.POWERUPS[type.toUpperCase()];
        if (!config) return;
        
        const powerUp = this.activePowerUps[type.toLowerCase()];
        if (powerUp) {
            powerUp.active = true;
            powerUp.timeLeft = config.duration;
            if (config.multiplier) powerUp.multiplier = config.multiplier;
            if (config.timeScale) powerUp.timeScale = config.timeScale;
            
            if (this.onPowerUpChange) {
                this.onPowerUpChange(type, true, config);
            }
        }
    }
    
    /**
     * Deactivate a power-up
     */
    deactivatePowerUp(type) {
        const powerUp = this.activePowerUps[type.toLowerCase()];
        if (powerUp) {
            powerUp.active = false;
            powerUp.timeLeft = 0;
            if (powerUp.multiplier) powerUp.multiplier = 1;
            if (powerUp.timeScale) powerUp.timeScale = 1;
            
            if (this.onPowerUpChange) {
                this.onPowerUpChange(type, false, null);
            }
        }
    }
    
    /**
     * Check if shield is active
     */
    hasShield() {
        return this.activePowerUps.shield.active;
    }
    
    /**
     * Get speed multiplier from power-ups
     */
    getSpeedMultiplier() {
        if (this.activePowerUps.speed.active) {
            return this.activePowerUps.speed.multiplier;
        }
        return 1;
    }
    
    /**
     * Get time scale (for slow motion)
     */
    getTimeScale() {
        if (this.activePowerUps.slowmo.active) {
            return this.activePowerUps.slowmo.timeScale;
        }
        return 1;
    }
    
    /**
     * Check if magnet is active
     */
    hasMagnet() {
        return this.activePowerUps.magnet.active;
    }
    
    /**
     * Lose a life
     */
    loseLife() {
        if (this.hasShield()) {
            // Shield absorbs the hit
            this.deactivatePowerUp('shield');
            return false;
        }
        
        this.lives--;
        this.combo = 0;
        
        if (this.onLivesChange) {
            this.onLivesChange(this.lives);
        }
        
        if (this.lives <= 0) {
            this.gameOver();
            return true;
        }
        
        return false;
    }
    
    /**
     * Add score
     */
    addScore(points) {
        const comboMultiplier = 1 + (this.combo * 0.1);
        this.score += Math.floor(points * comboMultiplier);
        
        if (this.onScoreChange) {
            this.onScoreChange(this.score);
        }
    }
    
    /**
     * Increment combo for dodging obstacles
     */
    incrementCombo() {
        this.combo++;
        this.comboTimer = 3; // 3 seconds to maintain combo
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
    }
    
    /**
     * Record obstacle dodged
     */
    obstacleDodged() {
        this.obstaclesDodged++;
        this.incrementCombo();
        this.addScore(10);
    }
    
    /**
     * Record pill collected
     */
    pillCollected() {
        this.pillsCollected++;
        this.addScore(25);
    }
    
    /**
     * Record gift received
     */
    giftReceived(tierValue) {
        this.giftsReceived++;
        this.addScore(tierValue);
    }
    
    /**
     * Add competitor to leaderboard
     */
    addCompetitor(name, isGifter = false) {
        this.competitors.push({
            name,
            distance: this.distance - 50, // Start slightly behind
            isGifter,
            eliminated: false
        });
    }
    
    /**
     * Update competitor positions
     */
    updateCompetitors(playerDistance) {
        this.competitors.forEach(comp => {
            if (!comp.eliminated) {
                // Competitors try to keep up with player
                const catchUp = comp.distance < playerDistance ? CONFIG.AI.catchUpMultiplier : 1;
                comp.distance += CONFIG.SPEED * CONFIG.AI.baseSpeed * catchUp * 0.016; // Assuming 60fps
            }
        });
        
        // Sort by distance
        this.competitors.sort((a, b) => b.distance - a.distance);
    }
    
    /**
     * Eliminate a competitor (hit by obstacle)
     */
    eliminateCompetitor(name) {
        const comp = this.competitors.find(c => c.name === name);
        if (comp) {
            comp.eliminated = true;
        }
    }
    
    /**
     * Get player rank
     */
    getPlayerRank() {
        const activeComps = this.competitors.filter(c => !c.eliminated);
        let rank = 1;
        activeComps.forEach(comp => {
            if (comp.distance > this.distance) rank++;
        });
        return rank;
    }
    
    /**
     * Pause the game
     */
    pause() {
        if (!this.isGameOver && !this.isWin) {
            this.isPaused = true;
            this.pauseStartTime = Date.now();
        }
    }
    
    /**
     * Resume the game
     */
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.pausedTime += Date.now() - this.pauseStartTime;
        }
    }
    
    /**
     * Toggle pause
     */
    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }
    
    /**
     * Game over
     */
    gameOver() {
        this.isGameOver = true;
        if (this.onGameOver) {
            this.onGameOver(this.getFinalStats());
        }
    }
    
    /**
     * Win the game
     */
    win() {
        this.isWin = true;
        // Bonus for remaining lives
        this.score += this.lives * 500;
        // Bonus for time
        const timeBonus = Math.max(0, 1000 - Math.floor(this.elapsedTime));
        this.score += timeBonus;
        
        if (this.onWin) {
            this.onWin(this.getFinalStats());
        }
    }
    
    /**
     * Get final game stats
     */
    getFinalStats() {
        return {
            score: this.score,
            distance: Math.floor(this.distance),
            time: this.elapsedTime,
            obstaclesDodged: this.obstaclesDodged,
            pillsCollected: this.pillsCollected,
            giftsReceived: this.giftsReceived,
            maxCombo: this.maxCombo,
            checkpointsReached: this.checkpointsReached,
            rank: this.getPlayerRank(),
            totalCompetitors: this.competitors.length + 1
        };
    }
    
    /**
     * Reset game state
     */
    reset() {
        this.lives = CONFIG.GAME.maxLives;
        this.score = 0;
        this.distance = 0;
        this.obstaclesDodged = 0;
        this.pillsCollected = 0;
        this.giftsReceived = 0;
        this.lastCheckpoint = 0;
        this.checkpointsReached = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.isWin = false;
        this.startTime = 0;
        this.elapsedTime = 0;
        this.pausedTime = 0;
        this.difficultyLevel = 1;
        this.combo = 0;
        this.maxCombo = 0;
        this.competitors = [];
        
        // Reset power-ups
        for (const key of Object.keys(this.activePowerUps)) {
            this.deactivatePowerUp(key);
        }
    }
}

// Singleton instance
let gameStateInstance = null;

export function getGameState() {
    if (!gameStateInstance) {
        gameStateInstance = new GameState();
    }
    return gameStateInstance;
}
