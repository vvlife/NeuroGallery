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
            (this.camera && this.camera.presentationMode && this.camera.presentationMode.active)) {
            return
        }

        this.mouse.x = (event.clientX / this.sizes.width) * 2 - 1
        this.mouse.y = -(event.clientY / this.sizes.height) * 2 + 1

        this.raycaster.setFromCamera(this.mouse, this.camera.instance)

        let intersectionFound = false

        // Check for painting intersections first
        if (this.experience.world && this.experience.world.paintings) {
            const intersects = this.raycaster.intersectObjects(this.experience.world.paintings.paintingMeshes, true)

            if (intersects.length > 0) {
                const paintingMesh = intersects[0].object
                const painting = paintingMesh.userData.painting

                if (painting && this.camera) {
                    this.camera.enterPresentationMode(paintingMesh, painting)
                    intersectionFound = true
                }
            }
        }

        // Check for easel intersections if no painting was clicked
        if (!intersectionFound && this.experience.world && this.experience.world.easel) {
            const easelClickables = this.experience.world.easel.getClickableObjects()
            const easelIntersects = this.raycaster.intersectObjects(easelClickables, true)

            if (easelIntersects.length > 0) {
                const clickedObject = easelIntersects[0].object

                // Dispatch custom event for easel click
                document.dispatchEvent(new CustomEvent('easel-clicked', {
                    detail: {
                        object: clickedObject,
                        intersection: easelIntersects[0]
                    }
                }))

                intersectionFound = true
            }
        }
    }

    update() {
        // Update raycaster for hover effects if needed
        if (this.camera && this.camera.instance) {
            this.raycaster.setFromCamera(this.mouse, this.camera.instance)
        }
    }
} 