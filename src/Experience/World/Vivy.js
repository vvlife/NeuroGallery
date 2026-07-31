import * as THREE from 'three'
import { makeVivyFaceTexture } from './CharacterTextures.js'

/**
 * Vivy — the island's special resident, from *Vivy: Fluorite Eye's Song*.
 * Teal long hair, white dress, an AI songstress living among the animals.
 * `options.dressTexture` — optional CC0 fabric texture for the dress.
 */
export function createVivy(options = {}) {
    const vivy = new THREE.Group()
    vivy.name = 'vivy'

    const dressTex = options.dressTexture || null
    if (dressTex) {
        dressTex.wrapS = THREE.RepeatWrapping
        dressTex.wrapT = THREE.RepeatWrapping
        dressTex.repeat.set(3, 3)
        dressTex.colorSpace = THREE.SRGBColorSpace
    }

    const skinMat = new THREE.MeshStandardMaterial({ color: '#ffe3d0', roughness: 0.75 })
    const dressMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: dressTex,
        roughness: 0.95
    })
    const hairMat = new THREE.MeshStandardMaterial({ color: '#3fd4c1', roughness: 0.7 })
    const hairDarkMat = new THREE.MeshStandardMaterial({ color: '#2ba89a', roughness: 0.7 })

    // Dress (flowing cone)
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 14), dressMat)
    dress.position.y = 0.55
    dress.castShadow = true
    vivy.add(dress)

    // Torso
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), dressMat)
    torso.scale.set(1, 1.1, 0.85)
    torso.position.y = 1.05
    vivy.add(torso)

    // Head — canvas face texture (pink anime eyes / blush / smile)
    const faceMat = new THREE.MeshStandardMaterial({
        map: makeVivyFaceTexture('#ffe3d0'),
        roughness: 0.75
    })
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), faceMat)
    head.position.y = 1.52
    head.castShadow = true
    vivy.add(head)

    // Long teal hair: back curtain + side strands + ahoge
    const hairBack = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 10, 1, true), hairMat)
    hairBack.position.set(0, 1.15, -0.14)
    hairBack.rotation.x = 0.12
    vivy.add(hairBack)

    const hairTop = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
        hairMat
    )
    hairTop.position.y = 1.56
    vivy.add(hairTop)

    for (const side of [-1, 1]) {
        const strand = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.55, 4, 6), hairDarkMat)
        strand.position.set(side * 0.28, 1.25, 0.08)
        strand.rotation.z = side * 0.1
        vivy.add(strand)
    }

    // Ahoge (the signature cowlick)
    const ahoge = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.3, 6), hairMat)
    ahoge.position.set(0.05, 1.92, 0)
    ahoge.rotation.z = -0.25
    vivy.add(ahoge)

    // Arms
    const arms = []
    for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.35, 4, 6), skinMat)
        arm.position.set(side * 0.3, 1.0, 0.02)
        arm.rotation.z = side * 0.35
        vivy.add(arm)
        arms.push(arm)
    }
    vivy.userData.arms = arms

    // Feet peeking from the dress
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.8 })
    for (const side of [-1, 1]) {
        const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), shoeMat)
        shoe.scale.set(1, 0.5, 1.4)
        shoe.position.set(side * 0.12, 0.04, 0.1)
        vivy.add(shoe)
    }

    return vivy
}

export const VIVY_LINES = [
    '我会用歌声，为大家带来幸福。',
    '这是我的使命。',
    '你在听吗？风的声音，像一首歌。',
    '岛上的生活，和舞台上很不一样呢。',
    '要一起走走吗？',
    '这首曲子，是想送给你的。',
    'AI 也可以有心吗？……我觉得，是有的。',
    '今天的云，形状真好看。',
    '蝴蝶停在花上的时候，世界都安静了。',
    '如果我唱歌的话，你会来听吗？',
    '这些小动物居民，都很温柔呢。',
    '夜晚看星星的时候，我会想起很多事。'
]
