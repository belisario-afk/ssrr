# Custom 3D Models for BioRace

Place your `.glb` model files in this folder.

## Obstacle Models

| Model File | Effect | Spawn Key | Damage | Movement |
|------------|--------|-----------|--------|----------|
| `condom.glb` | **STUN** | `1` | Freezes 2 seconds | Straight |
| `cucumber.glb` | **DAMAGE** | `2` | Setback 50m | Straight |
| `banana.glb` | **SLIP** | `3` | Setback 25m | Straight |
| `iud.glb` | **HEAVY DAMAGE** | `4` | Setback 75m | Floating |
| `hairbrush.glb` | **STUN** | `5` | Freezes 1.5 seconds | Floating |

## Movement Types

- **Straight**: Obstacles come directly at the player down the center of the tube. Players must move to the walls to dodge!
- **Floating**: Obstacles drift/float inside the tube with gentle movement and spin.

## Player Model (Optional - Fallback Available)

| Model File | Description |
|------------|-------------|
| `swimmer.glb` | Animated swimmer model for ALL players |

**Optional:** The `swimmer.glb` model enhances all swimmers but has a procedural fallback.

- If `swimmer.glb` exists: All swimmers use the animated GLB model
- If not found: A simple procedural swimmer (head + body + tail) is shown
- All swimmers display different **skin tone tints** (8 colors)
- Animations play automatically if present in the GLB file
- Local player's skin tone is based on their selected color

## Other Spawn Keys

- **Key 6**: Fallen swimmer (no damage, visual obstacle)
- **Key 7**: Power-up Pill (+3 boost charges)

## Model Scales (configured in code)

| Model | Scale (x, y, z) |
|-------|-----------------|
| Condom | 150, 150, 150 |
| Cucumber | 143, 143, 143 |
| Banana | 3, 3, 3 |
| IUD | 3, 3, 3 |
| Hairbrush | 3, 3, 3 |
| Swimmer | 0.5, 0.5, 0.5 |

To adjust scales, edit `modelScales` in `src/Obstacles.js` or swimmer scale in `src/Player.js`.

## Collision Radii (for better hit detection)

| Model | Collision Radius |
|-------|-----------------|
| Condom | 5 |
| Cucumber | 4 |
| Banana | 3 |
| IUD | 3.5 |
| Hairbrush | 3 |

## Collision Effects Summary

- **CONDOM** (Key 1): Stuns the player for 2 seconds (Straight movement)
- **CUCUMBER** (Key 2): Deals damage, pushing back 50 meters (Straight movement)
- **BANANA** (Key 3): Slip damage, pushes back 25 meters (Straight movement)
- **IUD** (Key 4): Heavy damage, pushes back 75 meters (Floating)
- **HAIRBRUSH** (Key 5): Stuns the player for 1.5 seconds (Floating)
- **FALLEN** (Key 6): No damage, visual obstacle
- **PILL** (Key 7): Power-up, gives +3 boost charges

## How to Export GLB from Blender

1. Open your model in Blender
2. Select all objects you want to export
3. Go to **File → Export → glTF 2.0 (.glb/.gltf)**
4. Choose **GLB** format (binary, single file)
5. For animated models, enable **Animations** in export settings
6. Click **Export**

## Model Guidelines

- **Scale**: Keep models around 1-3 units in Blender, code will scale them
- **Origin**: Center your model's origin point for proper rotation
- **Materials**: Use PBR materials (they translate best to Three.js)
- **File Size**: Keep models under 5MB for best web performance
- **Animations**: For swimmer model, include swimming animation in the GLB file

## Spawn Behavior

- **Straight obstacles** (Condom, Cucumber, Banana): Spawn in the center of the tube and come straight at the player. Players must move to the walls to dodge!
- **Floating obstacles** (IUD, Hairbrush): Spawn anywhere inside the tube and float/drift with gentle spinning.
- All obstacles are constrained to stay inside the tube.

## Troubleshooting

- **Model not showing**: Check browser console for loading errors
- **Wrong size**: Adjust scale values in Obstacles.js or Player.js
- **Wrong orientation**: Rotate model in Blender before export
- **Animation not playing**: Ensure animations are included in GLB export
