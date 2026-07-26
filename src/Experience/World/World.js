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

    // Show a lightweight action hint near a painting (no auto popup).
    // Full intro only opens on click or the E key.
    checkPaintingProximity() {
        const ui = this.experience.presentationUI
        const camera = this.experience.camera
        if (!ui || !camera || !this.paintings) return

        // Don't fight with the click-to-zoom presentation mode
        if (camera.presentationMode && camera.presentationMode.active) {
            this.hidePaintingHint()
            this._hintPaintingId = null
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
        const RESET_AT = 6.0

        if (nearest && nearestDist < SHOW_AT) {
            const data = nearest.userData.painting
            this._nearestPainting = nearest

            // Only hint once per painting per visit, and never while a
            // hint is already on screen (walking past two paintings in a
            // row must not fire two hints).
            if (this._hintPaintingId !== data.id && !this._hintVisible) {
                this.showPaintingHint()
                this._hintPaintingId = data.id
            }
        } else {
            this._nearestPainting = null
            // Walked far enough away — the painting may be hinted again later
            if (this._hintPaintingId && nearestDist > RESET_AT) {
                this._hintPaintingId = null
            }
        }
    }

    showPaintingHint() {
        const el = document.getElementById('paintingHint')
        if (!el) return

        this._hintVisible = true
        el.classList.remove('fading')
        el.classList.add('visible')

        clearTimeout(this._hintTimer)
        this._hintTimer = setTimeout(() => {
            this.hidePaintingHint()
        }, 3000)
    }

    hidePaintingHint() {
        const el = document.getElementById('paintingHint')
        if (!el) return

        el.classList.remove('visible')
        el.classList.add('fading')
        this._hintVisible = false
    }

    // Called by the E key (see main.js): open the intro for the painting
    // the player is standing in front of.
    openNearestPainting() {
        if (this._nearestPainting) {
            const data = this._nearestPainting.userData.painting
            this.hidePaintingHint()
            this.experience.presentationUI.show(data)
        }
    }
}
