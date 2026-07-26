import * as THREE from 'three'

import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import World from './World/World.js'
import Resources from './Utils/Resources.js'
import Debug from './Utils/Debug.js'
import PlayerControls from './Controls/PlayerControls.js'
import GUIControls from './Controls/GUIControls.js'
import RaycasterManager from './Utils/RaycasterManager.js'

// UI Components
import LoadingScreen from '../UI/LoadingScreen.js'
import PresentationUI from '../UI/PresentationUI.js'

// Assets sources
import sources from './sources.js'

let instance = null

export default class Experience {
    constructor(_canvas) {
        // Singleton
        if (instance) {
            return instance
        }
        instance = this

        // Global access
        window.experience = this

        // Options
        this.canvas = _canvas

        // Setup
        this.debug = new Debug()
        this.sizes = new Sizes()
        this.time = new Time()
        this.scene = new THREE.Scene()
        this.resources = new Resources(sources)
        this.camera = new Camera()
        this.renderer = new Renderer()
        this.world = new World()
        this.playerControls = new PlayerControls()
        this.guiControls = new GUIControls()
        this.raycasterManager = new RaycasterManager()

        // UI
        this.loadingScreen = new LoadingScreen()
        this.presentationUI = new PresentationUI()

        // Resize event
        this.sizes.on('resize', () => {
            this.resize()
        })

        // Time tick event
        this.time.on('tick', () => {
            this.update()
        })

        // Resources ready
        this.resources.on('ready', () => {
            this.loadingScreen.hide()
            this.world.setup()

            // Check URL params for initial scene
            const urlParams = new URLSearchParams(window.location.search)
            const scene = urlParams.get('scene')
            if (scene && this.world?.sceneManager) {
                console.log('[NeuroGallery] Initial scene from URL:', scene)
                this.world.sceneManager.switchScene(scene)
            }
        })

        // Listen for postMessage from curator page (parent window)
        // Allows the curator to push new painting data into the gallery iframe
        window.addEventListener('message', (event) => {
            this.handlePostMessage(event)
        })
    }

    handlePostMessage(event) {
        const data = event.data
        if (!data || typeof data !== 'object') return

        // Security: only accept specific message types
        if (data.type === 'neurogallery:swapPaintings') {
            // Validate payload
            if (!Array.isArray(data.paintings)) {
                console.warn('[NeuroGallery] swapPaintings: paintings must be an array')
                return
            }
            console.log('[NeuroGallery] Received', data.paintings.length, 'paintings via postMessage')
            this.world.paintings.swapPaintings(data.paintings)
        } else if (data.type === 'neurogallery:switchScene') {
            if (typeof data.scene === 'string' && this.world?.sceneManager) {
                console.log('[NeuroGallery] Switching scene to', data.scene)
                this.world.sceneManager.switchScene(data.scene)
            }
        }
    }

    resize() {
        this.camera.resize()
        this.renderer.resize()
    }

    update() {
        this.camera.update()
        this.playerControls.update()
        this.world.update()
        this.raycasterManager.update()
        this.renderer.update()
    }

    destroy() {
        this.sizes.off('resize')
        this.time.off('tick')

        // Traverse the whole scene
        this.scene.traverse((child) => {
            // Test if it's a mesh
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose()

                // Loop through the material properties
                for (const key in child.material) {
                    const value = child.material[key]

                    // Test if there is a dispose function
                    if (value && typeof value.dispose === 'function') {
                        value.dispose()
                    }
                }
            }
        })

        this.camera.controls.dispose()
        this.renderer.instance.dispose()

        // Clean UI
        if (this.presentationUI) {
            this.presentationUI.destroy()
        }

        if (this.debug.active) {
            this.debug.ui.destroy()
        }
    }
} 