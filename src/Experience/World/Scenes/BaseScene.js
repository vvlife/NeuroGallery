import * as THREE from 'three'
import Experience from '../../Experience.js'

export default class BaseScene {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time

        this.group = new THREE.Group()
        this.group.name = this.constructor.name
        this.scene.add(this.group)

        this.paintingSlots = []
        this.disposables = []
    }

    setup() {
        throw new Error('BaseScene: setup() must be implemented')
    }

    getPaintingSlots() {
        return this.paintingSlots
    }

    track(object) {
        this.disposables.push(object)
        return object
    }

    add(mesh) {
        this.group.add(mesh)
        mesh.traverse((child) => {
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
        return mesh
    }

    destroy() {
        this.scene.remove(this.group)

        this.disposables.forEach((item) => {
            if (item && typeof item.dispose === 'function') {
                item.dispose()
            }
        })
        this.disposables = []

        while (this.group.children.length) {
            this.group.remove(this.group.children[0])
        }
    }

    update() {
        // Override in subclass if needed
    }
}
