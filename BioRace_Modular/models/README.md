# Custom 3D Models for BioRace

Place your `.glb` model files in this folder.

## Required File Names

| Model File | Replaces | Spawn Key |
|------------|----------|-----------|
| `banana.glb` | Condom obstacle | `1` |
| `hairbrush.glb` | Toothbrush obstacle | `2` |
| `iud.glb` | IUD obstacle | `3` |

## How to Export GLB from Blender

1. Open your model in Blender
2. Select all objects you want to export
3. Go to **File → Export → glTF 2.0 (.glb/.gltf)**
4. Choose **GLB** format (binary, single file)
5. Enable **Selected Objects** if you only want certain objects
6. Click **Export**

## Model Guidelines

- **Scale**: Models will be scaled in code, but try to keep them around 1-5 units in size
- **Origin**: Center your model's origin point for proper rotation
- **Materials**: Use PBR materials (they translate best to Three.js)
- **File Size**: Keep models under 5MB for best web performance

## Adding New Model Types

To add more custom models, edit `src/Obstacles.js`:

```javascript
// In preloadModels(), add your mapping:
const modelFiles = {
    'CONDOM': './models/banana.glb',
    'IUD': './models/iud.glb',
    'TOOTHBRUSH': './models/hairbrush.glb',
    'YOUR_NEW_TYPE': './models/your_model.glb'  // Add this
};
```

## Troubleshooting

- **Model not showing**: Check browser console for loading errors
- **Wrong size**: Adjust `customModel.scale.set(x, y, z)` in spawn function
- **Wrong orientation**: Rotate model in Blender before export, or add rotation in code
