import * as THREE from 'three'
import {PointerLockControls} from 'three/examples/jsm/controls/PointerLockControls.js'
import Experience from './Experience.js'

export default class Camera {
    constructor() {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.canvas = this.experience.canvas

        // Presentation mode properties
        this.presentationMode = {
            active: false,
            target: null,
            originalPosition: new THREE.Vector3(),
            originalRotation: new THREE.Euler(),
            originalQuaternion: null,
            targetPosition: new THREE.Vector3(),
            targetRotation: new THREE.Euler(),
            animationProgress: 0,
            animationDuration: 1.5, // seconds
            floatAmplitude: 0.02,
            floatSpeed: 1.5,
            timeElapsed: 0,
            paintingCenter: new THREE.Vector3(),
            paintingNormal: new THREE.Vector3(),
            baseDistance: 0
        }

        this.setInstance()
        this.setControls()
    }

    setInstance() {
        this.instance = new THREE.PerspectiveCamera(
            75,
            this.sizes.width / this.sizes.height,
            0.1,
            100
        )
        this.instance.position.set(0, 1.6, 5)
        this.scene.add(this.instance)
    }

    setControls() {
        this.controls = new PointerLockControls(this.instance, this.canvas)

        // Entry screen interaction
        const entryScreen = document.querySelector('.entry-screen')
        const entryButton = document.querySelector('.entry-button')

        if (entryButton) {
            entryButton.addEventListener('click', () => {
                // First hide the entry screen
                if (entryScreen) {
                    entryScreen.style.display = 'none'
                }

                // Then lock the controls
                this.controls.lock()
            })
        }

        // Lock/unlock events
        this.controls.addEventListener('lock', () => {
            if (entryScreen) {
                entryScreen.style.display = 'none'
            }
        })

        this.controls.addEventListener('unlock', () => {
            setTimeout(() => {
                const playerControls = this.experience.playerControls
                if (playerControls && (playerControls.pausedForGUI || playerControls.temporaryPointerLockExit)) {
                    return
                }

                if (entryScreen) {
                    entryScreen.style.display = 'flex'
                }
            }, 10)
        })

        document.addEventListener('pointerlockchange', () => {
            // Pointer lock state changed
        })

        document.addEventListener('pointerlockerror', () => {
            // Pointer lock state error
        })
    }

    // Enter presentation mode for a specific painting
    enterPresentationMode(paintingMesh, paintingData) {
        if (this.presentationMode.active) return

        this.presentationMode.originalPosition.copy(this.instance.position)
        this.presentationMode.originalRotation.copy(this.instance.rotation)
        this.presentationMode.originalQuaternion = this.instance.quaternion.clone()

        const paintingPosition = new THREE.Vector3()
        paintingMesh.parent.getWorldPosition(paintingPosition)

        // Determine painting orientation based on its Z position
        // Back wall paintings (z = -11.8) face towards positive Z (into the room)
        // Front wall paintings (z = 11.8) face towards negative Z (into the room)
        let paintingNormal
        if (paintingPosition.z < 0) {
            // Back wall - painting faces towards positive Z
            paintingNormal = new THREE.Vector3(0, 0, 1)
        } else {
            // Front wall - painting faces towards negative Z
            paintingNormal = new THREE.Vector3(0, 0, -1)
        }

        const cameraDistance = 3.5
        this.presentationMode.targetPosition.copy(paintingPosition)
        this.presentationMode.targetPosition.add(paintingNormal.clone().multiplyScalar(cameraDistance))

        // Position camera slightly lower so painting appears higher on screen
        this.presentationMode.targetPosition.y = paintingPosition.y - 0.4

        this.presentationMode.paintingCenter = paintingPosition.clone()
        this.presentationMode.paintingNormal = paintingNormal.clone()
        this.presentationMode.baseDistance = cameraDistance

        const tempObject = new THREE.Object3D()
        tempObject.position.copy(this.presentationMode.targetPosition)

        // Look slightly below the painting center so painting appears higher on screen
        const lookAtTarget = paintingPosition.clone()
        lookAtTarget.y -= 0.3 // Look 0.3 units below painting center

        tempObject.lookAt(lookAtTarget)
        this.presentationMode.targetRotation.copy(tempObject.rotation)

        this.presentationMode.animationProgress = 0
        this.presentationMode.timeElapsed = 0
        this.presentationMode.target = paintingMesh
        this.presentationMode.active = true

        if (this.experience.playerControls) {
            this.experience.playerControls.temporarilyDisable()
        }

        if (this.experience.presentationUI) {
            this.experience.presentationUI.show(paintingData)
        }
    }

    exitPresentationMode() {
        if (!this.presentationMode.active) return

        this.instance.position.copy(this.presentationMode.originalPosition)
        this.instance.rotation.copy(this.presentationMode.originalRotation)

        if (this.presentationMode.originalQuaternion) {
            this.instance.quaternion.copy(this.presentationMode.originalQuaternion)
        }

        this.presentationMode.active = false
        this.presentationMode.target = null

        if (this.experience.playerControls) {
            this.experience.playerControls.enable()
        }

        if (this.experience.presentationUI) {
            this.experience.presentationUI.hide()
        }
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height
        this.instance.updateProjectionMatrix()
    }

    update() {
        if (this.presentationMode.active) {
            this.updatePresentationMode()
        }
    }

    updatePresentationMode() {
        const deltaTime = this.experience.time.delta / 1000
        this.presentationMode.timeElapsed += deltaTime

        if (this.presentationMode.animationProgress < 1) {
            this.presentationMode.animationProgress += deltaTime / this.presentationMode.animationDuration
            this.presentationMode.animationProgress = Math.min(1, this.presentationMode.animationProgress)

            const t = this.presentationMode.animationProgress
            const easedT = 1 - Math.pow(1 - t, 3)

            // Interpolate position
            this.instance.position.lerpVectors(
                this.presentationMode.originalPosition,
                this.presentationMode.targetPosition,
                easedT
            )

            // During transition, make camera look towards the painting smoothly
            // Instead of interpolating rotations, use lookAt for natural transition
            const lookAtTarget = this.presentationMode.paintingCenter.clone()
            lookAtTarget.y -= 0.3 // Look below painting center for consistency

            // Blend between original forward direction and painting direction
            const originalDirection = new THREE.Vector3()
            const tempQuaternion = new THREE.Quaternion().setFromEuler(this.presentationMode.originalRotation)
            originalDirection.set(0, 0, -1).applyQuaternion(tempQuaternion)

            const targetDirection = lookAtTarget.clone().sub(this.instance.position).normalize()

            // Smooth transition between original looking direction and painting direction
            const blendedDirection = new THREE.Vector3()
            blendedDirection.lerpVectors(originalDirection, targetDirection, easedT)

            const targetLookAt = this.instance.position.clone().add(blendedDirection)
            this.instance.lookAt(targetLookAt)

        } else {
            const time = this.presentationMode.timeElapsed
            const orbitalRadius = 0.4  // Increased for larger orbit
            const orbitalSpeed = 0.3   // Slower and more elegant
            const verticalFloat = 0.1 // More subtle floating

            const orbitalAngle = time * orbitalSpeed
            const orbitalX = Math.cos(orbitalAngle) * orbitalRadius
            const orbitalZ = Math.sin(orbitalAngle) * orbitalRadius
            const verticalOffset = Math.sin(time * 0.6) * verticalFloat

            const paintingRight = new THREE.Vector3()
            const paintingUp = new THREE.Vector3(0, 1, 0)
            paintingRight.crossVectors(this.presentationMode.paintingNormal, paintingUp).normalize()

            const newPosition = this.presentationMode.targetPosition.clone()
            newPosition.add(paintingRight.multiplyScalar(orbitalX))
            newPosition.add(paintingUp.multiplyScalar(verticalOffset))

            const distanceVariation = Math.sin(time * 0.4) * 0.15 // Slightly larger distance variation
            const toCamera = newPosition.clone().sub(this.presentationMode.paintingCenter).normalize()
            newPosition.add(toCamera.multiplyScalar(distanceVariation))

            this.instance.position.copy(newPosition)

            // Look at target slightly below painting center for consistency
            const lookAtTarget = this.presentationMode.paintingCenter.clone()
            lookAtTarget.y -= 0.3 // Same offset as initial positioning
            lookAtTarget.y += Math.sin(time * 0.3) * 0.03 // Subtler vertical look variation

            this.instance.lookAt(lookAtTarget)

            const rollSway = Math.sin(time * 0.2) * 0.01 // More subtle roll
            this.instance.rotation.z += rollSway
        }
    }
} 