# Custom 3D Models for BioRace

Place your `.glb` model files in this folder.

## Required File Names

| Model File | Effect | Spawn Key | Damage |
|------------|--------|-----------|--------|
| `condom.glb` | **STUN** | `1` | Freezes 2 seconds |
| `cucumber.glb` | **DAMAGE** | `2` | Setback 50m |
| `vibrator.glb` | **WIPEOUT** | `3` | Reset to start |
| `banana.glb` | **SLIP** | `4` | Setback 25m |
| `iud.glb` | **HEAVY DAMAGE** | `5` | Setback 75m |
| `hairbrush.glb` | **STUN** | `6` | Freezes 1.5 seconds |

## Other Spawn Keys

- **Key 7**: Fallen swimmer (no damage, visual obstacle)
- **Key 8**: Power-up Pill (+3 boost charges)

## Model Scales (configured in code)

| Model | Scale (x, y, z) |
|-------|-----------------|
| Condom | 2, 2, 2 |
| Cucumber | 1.5, 1.5, 1.5 |
| Vibrator | 1.5, 1.5, 1.5 |
| Banana | 2, 2, 2 |
| IUD | 3, 3, 3 |
| Hairbrush | 1.5, 1.5, 1.5 |

To adjust scales, edit `modelScales` in `src/Obstacles.js`.

## Collision Effects Summary

- **CONDOM** (Key 1): Stuns the player for 2 seconds
- **CUCUMBER** (Key 2): Deals damage, pushing back 50 meters
- **VIBRATOR** (Key 3): Instant wipeout, resets to start
- **BANANA** (Key 4): Slip damage, pushes back 25 meters
- **IUD** (Key 5): Heavy damage, pushes back 75 meters
- **HAIRBRUSH** (Key 6): Stuns the player for 1.5 seconds
- **FALLEN** (Key 7): No damage, visual obstacle
- **PILL** (Key 8): Power-up, gives +3 boost charges

## How to Export GLB from Blender

1. Open your model in Blender
2. Select all objects you want to export
3. Go to **File → Export → glTF 2.0 (.glb/.gltf)**
4. Choose **GLB** format (binary, single file)
5. Enable **Selected Objects** if you only want certain objects
6. Click **Export**

## Model Guidelines

- **Scale**: Keep models around 1-3 units in Blender, code will scale them
- **Origin**: Center your model's origin point for proper rotation
- **Materials**: Use PBR materials (they translate best to Three.js)
- **File Size**: Keep models under 5MB for best web performance

## Spawn Behavior

All obstacles spawn **inside the tube** (within 70% of tunnel radius) to ensure they're visible and hittable by players.

## Troubleshooting

- **Model not showing**: Check browser console for loading errors
- **Wrong size**: Adjust scale values in `modelScales` object in Obstacles.js
- **Wrong orientation**: Rotate model in Blender before export
- **Collision not working**: Physics shapes are approximate; adjust in spawn function if needed
