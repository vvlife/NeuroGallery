import * as THREE from 'three'
import Experience from '../Experience.js'

export default class RaycasterManager {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.camera = this.experience.camera
        this.sizes = this.experience.sizes

        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()

        this.setEventListeners()
    }

    setEventListeners() {
        window.addEventListener('click', (event) => {
            this.onClick(event)
        })

        window.addEventListener('mousemove', (event) => {
            this.onMouseMove(event)
        })
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / this.sizes.width) * 2 - 1
        this.mouse.y = -(event.clientY / this.sizes.height) * 2 + 1
    }

    onClick(event) {
        // Don't raycast if clicking on UI elements or if in presentation mode
        if (event.target.closest('.painting-info-panel') ||
            event.target.closest('.lil-gui') ||
            event.target.closest('.entry-screen') ||
            event.target.closest('.presentation-overlay') ||
            event.target.closest('#easel-prompt-overlay') ||
            event.target.closest('.scene-selector') ||
            event.target.closest('.top-toolbar') ||
            event.target.closest('.curator-btn') ||
            event.target.closest('.ac-guide') ||
            (this.camera && this.camera.presentationMode && this.camera.presentationMode.active)) {
            return
        }

        this.mouse.x = (event.clientX / this.sizes.width) * 2 - 1
        this.mouse.y = -(event.clientY / this.sizes.height) * 2 + 1

        this.raycaster.setFromCamera(this.mouse, this.camera.instance)

        // Collect hits from all interactive object groups, then pick the
        // NEAREST one — priority-by-type used to let a far flower block a
        // close pond click ("can't fish / can't pick apples").
        const candidates = []

        if (this.experience.world && this.experience.world.paintings) {
            const hits = this.raycaster.intersectObjects(this.experience.world.paintings.paintingMeshes, true)
            hits.forEach(h => candidates.push({ kind: 'painting', hit: h }))
        }

        if (this.experience.world && this.experience.world.easel) {
            const easelClickables = this.experience.world.easel.getClickableObjects()
            const hits = this.raycaster.intersectObjects(easelClickables, true)
            hits.forEach(h => candidates.push({ kind: 'easel', hit: h }))
        }

        const scene = this.experience.world?.sceneManager?.getCurrentScene()

        if (scene && scene.appleHitSpheres && scene.appleHitSpheres.length > 0) {
            const available = scene.appleHitSpheres.filter(s => {
                const fruit = s.userData.appleRef
                return s.visible && fruit && fruit.visible && !fruit.userData.picked && !fruit.userData.falling
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'apple', hit: h }))
        }

        if (scene && scene.flowerHitSpheres && scene.flowerHitSpheres.length > 0) {
            const available = scene.flowerHitSpheres.filter(s => {
                const flower = s.userData.flowerRef
                return flower && flower.visible && !flower.userData.picked
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'flower', hit: h }))
        }

        if (scene && scene.pondWater) {
            const hits = this.raycaster.intersectObject(scene.pondWater, false)
            hits.forEach(h => candidates.push({ kind: 'pond', hit: h }))
        }

        if (candidates.length === 0) return

        candidates.sort((a, b) => a.hit.distance - b.hit.distance)
        const nearest = candidates[0]

        switch (nearest.kind) {
            case 'painting': {
                const paintingMesh = nearest.hit.object
                const painting = paintingMesh.userData.painting
                if (painting && this.camera) {
                    this.camera.enterPresentationMode(paintingMesh, painting)
                }
                break
            }
            case 'easel': {
                document.dispatchEvent(new CustomEvent('easel-clicked', {
                    detail: {
                        object: nearest.hit.object,
                        intersection: nearest.hit
                    }
                }))
                break
            }
            case 'apple':
                scene.pickApple(nearest.hit.object.userData.appleRef)
                break
            case 'flower':
                scene.pickFlower(nearest.hit.object.userData.flowerRef)
                break
            case 'pond':
                scene.onPondClick(nearest.hit.point)
                break
        }
    }

    update() {
        // Update raycaster for hover effects if needed
        if (this.camera && this.camera.instance) {
            this.raycaster.setFromCamera(this.mouse, this.camera.instance)
        }
    }
} 