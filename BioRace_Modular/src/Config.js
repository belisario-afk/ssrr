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
    // Changed from deep red (0x1a0000) to a lighter organic red/pink
    FOG_COLOR: 0x330505, 
    FOG_DENSITY: 0.025, // Slightly less dense to see further
    
    TUNNEL_COLOR: 0x882222, // Lighter walls
    TUNNEL_EMISSIVE: 0x441111, // More glow
    
    LIGHT_COLOR: 0xffcccc, // Warm light
    LIGHT_INTENSITY: 0.8,
    
    // Player
    PLAYER_COLOR: 0xffffff,
    PLAYER_EMISSIVE: 0xaaaaaa,
};