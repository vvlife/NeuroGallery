export default [
    // Models
    {
        name: 'bench',
        type: 'gltfModel',
        path: '/models/parametric-bench.glb'
    },
    {
        name: 'ceiling',
        type: 'gltfModel',
        path: '/models/ceiling.glb'
    },
    {
        name: 'pictureFrame',
        type: 'gltfModel',
        path: '/models/picture-frame.glb'
    },
    {
        name: 'easel',
        type: 'gltfModel',
        path: '/models/easel.glb'
    },

    // Floor texture
    {
        name: 'floorTexture',
        type: 'texture',
        path: '/textures/marble.png'
    },

    // Wall texture
    {
        name: 'concreteWall',
        type: 'texture',
        path: '/textures/seamless_concrete_wall.jpeg'
    },

    // Environment textures
    {
        name: 'dayEnvironment',
        type: 'rgbeTexture',
        path: '/hdris/day.hdr'
    },
    {
        name: 'nightEnvironment',
        type: 'rgbeTexture',
        path: '/hdris/night.hdr'
    },

    // Audio
    {
        name: 'ambientMusic',
        type: 'audio',
        path: '/audio/audio.mp3'
    },

    // Animal Crossing scene textures (CC0, Poly Haven)
    {
        name: 'acGrass',
        type: 'texture',
        path: '/textures/animalcrossing/grass_diff.jpg'
    },
    {
        name: 'acSky',
        type: 'rgbeTexture',
        path: '/textures/animalcrossing/sky.hdr'
    },

    // Character clothing / fur textures (CC0, Poly Haven)
    {
        name: 'acPlaid',
        type: 'texture',
        path: '/textures/animalcrossing/fabric_pattern_07.jpg'
    },
    {
        name: 'acDenim',
        type: 'texture',
        path: '/textures/animalcrossing/denim_fabric.jpg'
    },
    {
        name: 'acCotton',
        type: 'texture',
        path: '/textures/animalcrossing/cotton_jersey.jpg'
    },
    {
        name: 'acFur',
        type: 'texture',
        path: '/textures/animalcrossing/curly_teddy.jpg'
    },
]