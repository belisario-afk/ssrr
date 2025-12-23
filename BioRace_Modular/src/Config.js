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
    
    // Gift System Configuration
    GIFTS: {
        // Small tier gifts (1-10 coins)
        SMALL: {
            boostCharges: 1,
            speedMultiplier: 1.0,
            duration: 2,
            particleCount: 20
        },
        // Medium tier gifts (50-100 coins)
        MEDIUM: {
            boostCharges: 3,
            speedMultiplier: 1.1,
            duration: 4,
            particleCount: 40
        },
        // Large tier gifts (500+ coins)
        LARGE: {
            boostCharges: 5,
            speedMultiplier: 1.2,
            duration: 6,
            particleCount: 80
        },
        // Epic tier gifts (Universe, Planet)
        EPIC: {
            boostCharges: 10,
            speedMultiplier: 1.5,
            duration: 10,
            particleCount: 150
        }
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