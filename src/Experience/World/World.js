import * as THREE from 'three'
import Experience from '../Experience.js'
import Environment from './Environment.js'
import Paintings from './Paintings.js'
import Particles from './Particles.js'
import Easel from './Easel.js'
import SceneManager from './SceneManager.js'

export default class World {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
    }

    setup() {
        this.environment = new Environment()
        this.paintings = new Paintings()
        this.particles = new Particles()
        this.easel = new Easel()

        this.sceneManager = new SceneManager()
        this.sceneManager.setup()

        this.waitForPaintings()

        if (this.environment && this.paintings) {
            this.environment.setPaintings(this.paintings)
        }

        this.sceneManager.on('sceneChanged', () => {
            this.attachPaintingsToScene()
        })
    }

    waitForPaintings() {
        const check = () => {
            if (this.paintings && this.paintings.paintingMeshes.length > 0) {
                this.attachPaintingsToScene()
            } else {
                setTimeout(check, 200)
            }
        }
        check()
    }

    attachPaintingsToScene() {
        const scene = this.sceneManager?.getCurrentScene()
        if (!scene || !this.paintings) return

        if (scene.constructor.name === 'GalleryScene') {
            this.paintings.resetToDefault()
        } else {
            const slots = scene.getPaintingSlots()
            if (slots && slots.length > 0) {
                this.paintings.attachToSlots(slots)
            }
        }
    }

    update() {
        if (this.particles) {
            this.particles.update()
        }

        if (this.environment) {
            this.environment.update()
        }

        if (this.sceneManager) {
            this.sceneManager.update()
        }

        this.checkPaintingProximity()
    }

    checkPaintingProximity() {
        const ui = this.experience.presentationUI
        const camera = this.experience.camera
        if (!ui || !camera || !this.paintings) return

        if (camera.presentationMode && camera.presentationMode.active) {
            if (this._nearbyPaintingId) {
                ui.hide()
                this._nearbyPaintingId = null
            }
            return
        }

        const camPos = camera.instance.position
        const tmp = new THREE.Vector3()
        let nearest = null
        let nearestDist = Infinity

        for (const mesh of this.paintings.paintingMeshes) {
            mesh.getWorldPosition(tmp)
            const d = camPos.distanceTo(tmp)
            if (d < nearestDist) {
                nearestDist = d
                nearest = mesh
            }
        }

        const SHOW_AT = 4.5
        const HIDE_AT = 5.5

        if (nearest && nearestDist < SHOW_AT) {
            const data = nearest.userData.painting
            if (this._nearbyPaintingId !== data.id && !ui.isDismissed(data.id)) {
                ui.show(data)
                this._nearbyPaintingId = data.id
            }
        } else if (this._nearbyPaintingId && nearestDist > HIDE_AT) {
            ui.hide()
            ui.clearDismissed()
            this._nearbyPaintingId = null
        }
    }
}
