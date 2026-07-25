import * as THREE from 'three'
import Experience from '../Experience.js'

export default class PlayerControls {
    constructor() {
        this.experience = new Experience()
        this.camera = this.experience.camera
        this.time = this.experience.time

        // Movement settings
        this.settings = {
            walkSpeed: 5,
            sprintSpeed: 8,
            jumpHeight: 0.3,
            gravity: -15,
            playerHeight: 1.6,
            playerRadius: 0.3
        }

        // Movement state
        this.velocity = new THREE.Vector3()
        this.isOnGround = true
        this.controlsLocked = false
        this.temporarilyDisabled = false
        this.pausedForGUI = false
        this.temporaryPointerLockExit = false
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false
        }

        // Collision boundaries and objects
        this.boundaries = {
            minX: -11.5,
            maxX: 11.5,
            minZ: -11.5,
            maxZ: 11.5,
            floorY: 0
        }

        this.collisionObjects = []

        this.setEventListeners()
        this.setupCollisionObjects()
    }

    setupCollisionObjects() {
        // Wait for world to be created and add collision objects
        setTimeout(() => {
            if (this.experience.world && this.experience.world.benches) {
                this.addBenchCollisions()
            }
        }, 1000)
    }

    addBenchCollisions() {
        // Add bench positions for collision detection
        const benchPositions = [
            { x: -3, z: 2, width: 2, depth: 0.8 },
            { x: 3, z: 2, width: 2, depth: 0.8 }
        ]

        this.collisionObjects = benchPositions.map(bench => ({
            type: 'box',
            position: new THREE.Vector3(bench.x, 0, bench.z),
            size: new THREE.Vector3(bench.width, 1, bench.depth)
        }))
    }

    setEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            this.onKeyDown(event)
        })

        document.addEventListener('keyup', (event) => {
            this.onKeyUp(event)
        })

        // Mouse events for GUI access
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault()
            if (this.controlsLocked && !this.pausedForGUI) {
                this.pauseForGUI()
            }
        })

        document.addEventListener('mousedown', (event) => {
            if (event.button === 2) {
                event.preventDefault()
                if (this.controlsLocked && !this.pausedForGUI) {
                    this.pauseForGUI()
                }
            }
        })

        document.addEventListener('click', (event) => {
            if (this.pausedForGUI && event.button === 0) {
                if (event.target.tagName === 'CANVAS') {
                    this.resumeFromGUI()
                }
            }
        })

        // Wait for camera controls to be available
        const checkControls = () => {
            if (this.camera && this.camera.controls) {
                this.camera.controls.addEventListener('lock', () => {
                    this.controlsLocked = true
                    this.pausedForGUI = false
                    this.temporaryPointerLockExit = false
                    document.body.classList.remove('gui-mode')
                    if (this.experience.world && this.experience.world.environment) {
                        this.experience.world.environment.playAmbientMusic()
                    }
                })

                this.camera.controls.addEventListener('unlock', () => {
                    this.controlsLocked = false
                })
            } else {
                setTimeout(checkControls, 100)
            }
        }

        checkControls()
    }

    pauseForGUI() {
        this.pausedForGUI = true
        document.body.classList.add('gui-mode')
        document.body.style.cursor = 'default'
        this.temporaryPointerLockExit = true

        if (document.pointerLockElement) {
            document.exitPointerLock()
        }

        Object.keys(this.keys).forEach(key => {
            this.keys[key] = false
        })
    }

    resumeFromGUI() {
        this.pausedForGUI = false
        this.temporaryPointerLockExit = false
        document.body.classList.remove('gui-mode')
        document.body.style.cursor = 'none'

        const canvas = this.experience.canvas
        if (canvas) {
            canvas.requestPointerLock()
        }
    }

    onKeyDown(event) {
        if (this.camera && this.camera.presentationMode && this.camera.presentationMode.active) {
            if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
                this.camera.exitPresentationMode()
                return
            }
        }

        // Handle GUI pause state
        if (this.pausedForGUI) {
            switch (event.code) {
                case 'Escape':
                case 'Enter':
                    this.resumeFromGUI()
                    break
            }
            return
        }

        if (!this.controlsLocked || this.temporarilyDisabled) return

        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = true
                break
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = true
                break
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = true
                break
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = true
                break
            case 'Space':
                this.keys.jump = true
                event.preventDefault()
                break
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.sprint = true
                break
            case 'Escape':
                if (this.camera && this.camera.presentationMode && this.camera.presentationMode.active) {
                    this.camera.exitPresentationMode()
                } else if (this.camera && this.camera.controls) {
                    this.camera.controls.unlock()
                }
                break
        }
    }

    onKeyUp(event) {
        // Don't handle key up events when paused for GUI
        if (this.pausedForGUI) return

        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = false
                break
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = false
                break
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = false
                break
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = false
                break
            case 'Space':
                this.keys.jump = false
                break
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.sprint = false
                break
        }
    }

    update() {
        // Don't update movement when paused for GUI
        if (!this.controlsLocked || this.temporarilyDisabled || this.pausedForGUI) return

        const delta = this.time.delta / 1000 // Convert to seconds

        // Get current speed
        const currentSpeed = this.keys.sprint ? this.settings.sprintSpeed : this.settings.walkSpeed

        // Movement vectors
        const moveDirection = new THREE.Vector3()

        if (this.keys.forward) moveDirection.z -= 1
        if (this.keys.backward) moveDirection.z += 1
        if (this.keys.left) moveDirection.x -= 1
        if (this.keys.right) moveDirection.x += 1

        // Normalize and apply speed
        if (moveDirection.length() > 0) {
            moveDirection.normalize()
            moveDirection.multiplyScalar(currentSpeed)
        }

        // Apply movement relative to camera direction
        const cameraDirection = new THREE.Vector3()
        this.camera.instance.getWorldDirection(cameraDirection)
        cameraDirection.y = 0 // Keep movement horizontal
        cameraDirection.normalize()

        const rightVector = new THREE.Vector3()
        rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0))

        const moveVector = new THREE.Vector3()
        moveVector.addScaledVector(cameraDirection, -moveDirection.z)
        moveVector.addScaledVector(rightVector, moveDirection.x)

        // Update horizontal velocity
        this.velocity.x = moveVector.x
        this.velocity.z = moveVector.z

        // Handle jumping and gravity
        if (this.keys.jump && this.isOnGround) {
            this.velocity.y = Math.sqrt(2 * Math.abs(this.settings.gravity) * this.settings.jumpHeight)
            this.isOnGround = false
        }

        // Apply gravity
        this.velocity.y += this.settings.gravity * delta

        // Calculate new position
        const currentPosition = this.camera.instance.position.clone()
        const newPosition = currentPosition.clone()
        newPosition.add(this.velocity.clone().multiplyScalar(delta))

        // Apply collision detection
        const finalPosition = this.applyCollisions(currentPosition, newPosition)

        // Update camera position
        this.camera.instance.position.copy(finalPosition)

        // Check if on ground
        if (finalPosition.y <= this.settings.playerHeight) {
            finalPosition.y = this.settings.playerHeight
            this.camera.instance.position.y = this.settings.playerHeight
            this.velocity.y = 0
            this.isOnGround = true
        }
    }

    applyCollisions(currentPosition, newPosition) {
        // Room boundary collision
        newPosition.x = Math.max(this.boundaries.minX, Math.min(this.boundaries.maxX, newPosition.x))
        newPosition.z = Math.max(this.boundaries.minZ, Math.min(this.boundaries.maxZ, newPosition.z))
        newPosition.y = Math.max(this.settings.playerHeight, newPosition.y)

        // Check collision with objects (benches, etc.)
        for (const object of this.collisionObjects) {
            if (object.type === 'box') {
                if (this.checkBoxCollision(newPosition, object)) {
                    // Calculate push-back direction
                    const pushBack = this.calculatePushBack(currentPosition, newPosition, object)
                    newPosition.add(pushBack)
                }
            }
        }

        return newPosition
    }

    checkBoxCollision(position, box) {
        const playerPos = position.clone()
        const boxPos = box.position
        const boxSize = box.size

        // AABB collision detection with player radius
        const distX = Math.abs(playerPos.x - boxPos.x)
        const distZ = Math.abs(playerPos.z - boxPos.z)

        return distX < (boxSize.x / 2 + this.settings.playerRadius) &&
               distZ < (boxSize.z / 2 + this.settings.playerRadius)
    }

    calculatePushBack(oldPos, newPos, box) {
        const pushBack = new THREE.Vector3()
        const boxPos = box.position
        const boxSize = box.size

        // Calculate which side of the box we're closest to
        const distX = newPos.x - boxPos.x
        const distZ = newPos.z - boxPos.z

        const overlapX = (boxSize.x / 2 + this.settings.playerRadius) - Math.abs(distX)
        const overlapZ = (boxSize.z / 2 + this.settings.playerRadius) - Math.abs(distZ)

        // Push back on the axis with smaller overlap
        if (overlapX < overlapZ) {
            pushBack.x = overlapX * Math.sign(distX)
        } else {
            pushBack.z = overlapZ * Math.sign(distZ)
        }

        return pushBack
    }

    temporarilyDisable() {
        this.temporarilyDisabled = true
        Object.keys(this.keys).forEach(key => {
            this.keys[key] = false
        })
    }

    enable() {
        this.temporarilyDisabled = false
    }
} 