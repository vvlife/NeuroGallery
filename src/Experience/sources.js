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
]