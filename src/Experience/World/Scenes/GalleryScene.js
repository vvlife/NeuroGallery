import * as THREE from 'three'
import Experience from '../../Experience.js'
import GalleryRoom from '../GalleryRoom.js'
import Paintings from '../Paintings.js'
import Benches from '../Benches.js'
import BaseScene from './BaseScene.js'

export default class GalleryScene extends BaseScene {
    constructor() {
        super()
        this.galleryRoom = null
        this.paintings = null
        this.benches = null
    }

    setup() {
        this.galleryRoom = new GalleryRoom()
        this.benches = new Benches()

        // Move generated content into our group so destroy() can clean it up
        this.attachExisting(this.galleryRoom.floor)
        this.attachExisting(this.galleryRoom.walls)
        if (this.galleryRoom.ceiling) this.attachExisting(this.galleryRoom.ceiling)

        this.setupLighting()
    }

    attachExisting(object) {
        if (!object) return
        this.scene.remove(object)
        this.group.add(object)
        this.trackObject(object)
    }

    trackObject(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) this.disposables.push(child.geometry)
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => this.disposables.push(m))
                    } else {
                        this.disposables.push(child.material)
                    }
                }
            }
        })
    }

    setupLighting() {
        const env = this.experience.world?.environment
        if (!env) return

        env.sunLight.intensity = 0.9
        env.sunLight.color.setHex(0xffffff)
        env.fillLight.intensity = 0.4
        env.fillLight.color.setHex(0xffffff)
        env.ambientLight.intensity = 1.0
        env.ambientLight.color.setHex(0xfff4e6)

        if (this.resources.items.dayEnvironment) {
            env.environmentMap.texture = this.resources.items.dayEnvironment
            env.environmentMap.texture.mapping = THREE.EquirectangularRefractionMapping
            this.scene.environment = env.environmentMap.texture
            this.scene.background = env.environmentMap.texture
        } else {
            this.scene.background = new THREE.Color('#87CEEB')
        }

        if (env.environmentMap.updateMaterials) {
            env.environmentMap.updateMaterials()
        }

        if (this.experience.world?.paintings) {
            this.experience.world.paintings.setSpotlightsVisible(false)
        }
    }

    update() {}
}
