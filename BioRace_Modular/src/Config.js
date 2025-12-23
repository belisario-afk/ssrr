import * as THREE from 'three';

export const CONFIG = {
    // World Dimensions
    TUNNEL_RADIUS: 16,
    COURSE_LENGTH: 5000,
    
    // Physics
    SPEED: 25,
    STEER_FORCE: 50,
    BOOST_FORCE: 8,
    
    // Visuals - BRIGHTENED
    FOG_COLOR: 0x330505, 
    FOG_DENSITY: 0.025,
    
    TUNNEL_COLOR: 0x882222,
    TUNNEL_EMISSIVE: 0x441111,
    
    LIGHT_COLOR: 0xffcccc,
    LIGHT_INTENSITY: 0.8,
    
    // Player
    PLAYER_COLOR: 0xffffff,
    PLAYER_EMISSIVE: 0xaaaaaa,
    
    // Game Settings
    GAME: {
        maxLives: 3,
        checkpointInterval: 500, // Every 500m
        difficultyScaling: true,
        startingBoost: 1
    },
    
    // Gift System Configuration
    GIFTS: {
        // Small tier gifts (1-10 coins)
        SMALL: {
            boostCharges: 2,
            speedMultiplier: 1.0,
            duration: 2,
            particleCount: 20,
            spawnObstacle: false,
            spawnCompetitor: false,
            coinValue: 5
        },
        // Medium tier gifts (50-100 coins)
        MEDIUM: {
            boostCharges: 5,
            speedMultiplier: 1.1,
            duration: 4,
            particleCount: 40,
            spawnObstacle: true,  // Spawns random obstacle ahead
            spawnCompetitor: false,
            coinValue: 25
        },
        // Large tier gifts (500+ coins)
        LARGE: {
            boostCharges: 8,
            speedMultiplier: 1.2,
            duration: 6,
            particleCount: 80,
            spawnObstacle: true,
            spawnCompetitor: true,  // Spawns a named competitor!
            coinValue: 100
        },
        // Epic tier gifts (Universe, Planet)
        EPIC: {
            boostCharges: 15,
            speedMultiplier: 1.5,
            duration: 10,
            particleCount: 150,
            spawnObstacle: true,
            spawnCompetitor: true,
            spawnPowerUp: true,  // Spawns a special power-up
            coinValue: 500
        }
    },
    
    // Power-Up Types
    POWERUPS: {
        SHIELD: {
            duration: 5,
            color: 0x00ffff,
            icon: '🛡️',
            description: 'Invincibility'
        },
        SPEED: {
            duration: 4,
            multiplier: 2.0,
            color: 0xffff00,
            icon: '⚡',
            description: 'Speed Boost'
        },
        MAGNET: {
            duration: 8,
            range: 10,
            color: 0xff00ff,
            icon: '🧲',
            description: 'Attract Pills'
        },
        SLOWMO: {
            duration: 3,
            timeScale: 0.5,
            color: 0x0088ff,
            icon: '⏱️',
            description: 'Slow Motion'
        }
    },
    
    // AI Competitor Settings
    AI: {
        baseSpeed: 0.9,  // 90% of player speed
        dodgeChance: 0.7,  // 70% chance to dodge obstacles
        pillAttraction: 0.8,  // 80% chance to go for pills
        catchUpMultiplier: 1.1  // Speed boost when behind
    },
    
    // Audio Settings
    AUDIO: {
        masterVolume: 0.7,
        musicVolume: 0.5,
        sfxVolume: 0.8
    },
    
    // Game Modes
    MODES: {
        SOLO: 'solo',
        MULTIPLAYER: 'multiplayer',
        TIKTOK_LIVE: 'tiktok_live'
    }
};