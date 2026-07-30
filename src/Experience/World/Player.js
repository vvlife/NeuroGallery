import * as THREE from 'three'
import Experience from '../Experience.js'

/**
 * Third-person player character for the island (Animal Crossing scene).
 *
 * A low-poly chibi character the player can SEE, with WASD movement and a
 * smooth follow camera. Only active inside the Animal Crossing scene —
 * other scenes keep the original first-person controls.
 */
export default class Player {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.camera = this.experience.camera

        this.group = null
        this.position = new THREE.Vector3(0, 0, 6)
        this.facing = 0                 // character facing angle
        this.camYaw = Math.PI           // camera orbit yaw
        this.camPitch = 0.42            // camera orbit pitch
        this.camDist = 5.5
        this.velY = 0
        this.onGround = true

        this.walkSpeed = 4.2
        this.sprintSpeed = 7.0
        this.jumpSpeed = 6.5
        this.gravity = -16
        this.boundary = 11.3

        this.active = false
        this.walkPhase = 0
        this.keys = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false }

        this._boundKeyDown = this.onKeyDown.bind(this)
        this._boundKeyUp = this.onKeyUp.bind(this)
        this._boundMouseMove = this.onMouseMove.bind(this)

        // Touch joystick state
        this.joystick = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 }
        this._touchBound = false

        this.createModel()
        this.createJoystickUI()
    }

    createModel() {
        this.group = new THREE.Group()
        this.group.name = 'player'

        const skinMat = new THREE.MeshStandardMaterial({ color: '#ffd9b3', roughness: 0.8 })
        const shirtMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 })
        const pantsMat = new THREE.MeshStandardMaterial({ color: '#4d94e8', roughness: 0.85 })
        const hairMat = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9 })
        const shoeMat = new THREE.MeshStandardMaterial({ color: '#e8574d', roughness: 0.8 })

        // Body (chibi egg shape)
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), shirtMat)
        body.scale.set(1, 1.2, 0.9)
        body.position.y = 0.62
        body.castShadow = true
        this.group.add(body)

        // Shorts
        const pants = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), pantsMat)
        pants.scale.set(1, 0.75, 0.9)
        pants.position.y = 0.42
        this.group.add(pants)

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 14), skinMat)
        head.position.y = 1.32
        head.castShadow = true
        this.group.add(head)
        this.head = head

        // Hair (cap + back bun)
        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.38, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
            hairMat
        )
        hair.position.y = 1.36
        this.group.add(hair)
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), hairMat)
        bun.position.set(0, 1.62, -0.22)
        this.group.add(bun)

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: '#2b2b2b' })
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat)
            eye.position.set(side * 0.13, 1.34, 0.33)
            this.group.add(eye)
        }
        // Blush
        const blushMat = new THREE.MeshBasicMaterial({ color: '#ffb3b3', transparent: true, opacity: 0.7 })
        for (const side of [-1, 1]) {
            const blush = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), blushMat)
            blush.scale.set(1, 0.5, 0.5)
            blush.position.set(side * 0.22, 1.27, 0.3)
            this.group.add(blush)
        }

        // Arms
        this.arms = []
        for (const side of [-1, 1]) {
            const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 4, 6), shirtMat)
            arm.position.set(side * 0.38, 0.68, 0)
            arm.rotation.z = side * 0.25
            arm.castShadow = true
            this.group.add(arm)
            this.arms.push(arm)
        }

        // Legs
        this.legs = []
        for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.25, 4, 6), pantsMat)
            leg.position.set(side * 0.13, 0.22, 0)
            this.group.add(leg)
            this.legs.push(leg)

            const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), shoeMat)
            shoe.scale.set(1, 0.6, 1.3)
            shoe.position.set(side * 0.13, 0.06, 0.03)
            this.group.add(shoe)
        }

        this.group.position.copy(this.position)
        this.group.visible = false
        this.scene.add(this.group)
    }

    createJoystickUI() {
        // Virtual joystick for touch devices (bottom-left)
        const base = document.createElement('div')
        base.id = 'joystickBase'
        base.style.cssText = `
            position: fixed; bottom: 30px; left: 24px; z-index: 950;
            width: 110px; height: 110px; border-radius: 50%;
            background: rgba(255,255,255,0.18); border: 2px solid rgba(255,255,255,0.4);
            backdrop-filter: blur(6px); display: none; touch-action: none;
        `
        const knob = document.createElement('div')
        knob.id = 'joystickKnob'
        knob.style.cssText = `
            position: absolute; top: 50%; left: 50%; width: 48px; height: 48px;
            border-radius: 50%; background: rgba(255,255,255,0.85);
            transform: translate(-50%, -50%); box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        `
        base.appendChild(knob)
        document.body.appendChild(base)
        this.joystickBase = base
        this.joystickKnob = knob
    }

    enter() {
        if (this.active) return
        this.active = true

        // Show the character, take over from first-person controls
        this.group.visible = true
        if (this.experience.playerControls) {
            this.experience.playerControls.temporarilyDisable()
        }

        // Face the island centre and put the camera behind
        this.position.set(0, 0, 6)
        this.facing = Math.PI
        this.camYaw = Math.PI
        this.group.position.copy(this.position)

        document.addEventListener('keydown', this._boundKeyDown)
        document.addEventListener('keyup', this._boundKeyUp)
        document.addEventListener('mousemove', this._boundMouseMove)
        this.bindTouch()

        // Touch devices: show joystick
        if ('ontouchstart' in window && this.joystickBase) {
            this.joystickBase.style.display = 'block'
        }

        this.snapCamera()
    }

    exit() {
        if (!this.active) return
        this.active = false

        this.group.visible = false
        Object.keys(this.keys).forEach(k => { this.keys[k] = false })

        document.removeEventListener('keydown', this._boundKeyDown)
        document.removeEventListener('keyup', this._boundKeyUp)
        document.removeEventListener('mousemove', this._boundMouseMove)
        this.unbindTouch()
        if (this.joystickBase) this.joystickBase.style.display = 'none'

        if (this.experience.playerControls) {
            this.experience.playerControls.enable()
        }

        // Restore the first-person camera
        const cam = this.camera.instance
        cam.position.set(0, 1.6, 5)
        cam.lookAt(0, 1.6, 0)
    }

    snapCamera() {
        const cam = this.camera.instance
        const offset = new THREE.Vector3(
            Math.sin(this.camYaw) * Math.cos(this.camPitch),
            Math.sin(this.camPitch),
            Math.cos(this.camYaw) * Math.cos(this.camPitch)
        ).multiplyScalar(this.camDist)
        cam.position.copy(this.position).add(offset).add(new THREE.Vector3(0, 0.8, 0))
        cam.lookAt(this.position.x, this.position.y + 1.1, this.position.z)
    }

    onKeyDown(e) {
        if (!this.active) return
        if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea') return
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = true; break
            case 'KeyS': case 'ArrowDown': this.keys.backward = true; break
            case 'KeyA': case 'ArrowLeft': this.keys.left = true; break
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break
            case 'Space': this.keys.jump = true; e.preventDefault(); break
            case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = true; break
        }
    }

    onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = false; break
            case 'KeyS': case 'ArrowDown': this.keys.backward = false; break
            case 'KeyA': case 'ArrowLeft': this.keys.left = false; break
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break
            case 'Space': this.keys.jump = false; break
            case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = false; break
        }
    }

    onMouseMove(e) {
        if (!this.active || !document.pointerLockElement) return
        this.camYaw -= e.movementX * 0.0028
        this.camPitch = Math.max(0.12, Math.min(1.1, this.camPitch + e.movementY * 0.0028))
    }

    bindTouch() {
        if (this._touchBound || !this.joystickBase) return
        this._touchBound = true

        this._onTouchStart = (e) => {
            const t = e.changedTouches[0]
            this.joystick.active = true
            this.joystick.id = t.identifier
            const rect = this.joystickBase.getBoundingClientRect()
            this.joystick.baseX = rect.left + rect.width / 2
            this.joystick.baseY = rect.top + rect.height / 2
        }
        this._onTouchMove = (e) => {
            if (!this.joystick.active) return
            e.preventDefault()
            for (const t of e.changedTouches) {
                if (t.identifier !== this.joystick.id) continue
                const maxR = 42
                let dx = t.clientX - this.joystick.baseX
                let dy = t.clientY - this.joystick.baseY
                const len = Math.hypot(dx, dy)
                if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR }
                this.joystick.dx = dx / maxR
                this.joystick.dy = dy / maxR
                this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
            }
        }
        this._onTouchEnd = (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === this.joystick.id) {
                    this.joystick.active = false
                    this.joystick.dx = 0
                    this.joystick.dy = 0
                    this.joystickKnob.style.transform = 'translate(-50%, -50%)'
                }
            }
        }

        this.joystickBase.addEventListener('touchstart', this._onTouchStart, { passive: true })
        this.joystickBase.addEventListener('touchmove', this._onTouchMove, { passive: false })
        this.joystickBase.addEventListener('touchend', this._onTouchEnd)
        this.joystickBase.addEventListener('touchcancel', this._onTouchEnd)
    }

    unbindTouch() {
        if (!this._touchBound || !this.joystickBase) return
        this._touchBound = false
        this.joystickBase.removeEventListener('touchstart', this._onTouchStart)
        this.joystickBase.removeEventListener('touchmove', this._onTouchMove)
        this.joystickBase.removeEventListener('touchend', this._onTouchEnd)
        this.joystickBase.removeEventListener('touchcancel', this._onTouchEnd)
    }

    update() {
        if (!this.active) return

        const delta = this.experience.time.delta / 1000

        // Input direction (keyboard or joystick), in camera space
        let ix = 0, iz = 0
        if (this.keys.forward) iz -= 1
        if (this.keys.backward) iz += 1
        if (this.keys.left) ix -= 1
        if (this.keys.right) ix += 1
        if (this.joystick.active) {
            ix += this.joystick.dx
            iz += this.joystick.dy
        }

        const moving = Math.hypot(ix, iz) > 0.05

        if (moving) {
            const len = Math.hypot(ix, iz)
            ix /= Math.max(1, len)
            iz /= Math.max(1, len)

            // Rotate input by camera yaw so "forward" is where the camera looks
            const sin = Math.sin(this.camYaw)
            const cos = Math.cos(this.camYaw)
            const dx = (ix * cos - iz * sin)
            const dz = (-ix * sin - iz * cos)

            const speed = this.keys.sprint ? this.sprintSpeed : this.walkSpeed
            this.position.x += dx * speed * delta
            this.position.z += dz * speed * delta

            // Face the movement direction smoothly
            const targetFacing = Math.atan2(dx, dz)
            let diff = targetFacing - this.facing
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            this.facing += diff * Math.min(1, delta * 12)

            this.walkPhase += delta * speed * 2.4
        } else {
            this.walkPhase *= 1 - Math.min(1, delta * 8)
        }

        // Boundary + gravity
        this.position.x = Math.max(-this.boundary, Math.min(this.boundary, this.position.x))
        this.position.z = Math.max(-this.boundary, Math.min(this.boundary, this.position.z))

        // Obstacle collision (fountain, trees, stands, pond, houses...)
        const obstacles = this.experience.world?.sceneManager?.getCurrentScene?.()?.getObstacles?.() || []
        const playerRadius = 0.38
        for (const obs of obstacles) {
            const dx = this.position.x - obs.x
            const dz = this.position.z - obs.z
            const dist = Math.hypot(dx, dz)
            const minDist = obs.r + playerRadius
            if (dist < minDist && dist > 0.001) {
                const push = (minDist - dist)
                this.position.x += (dx / dist) * push
                this.position.z += (dz / dist) * push
            }
        }

        if (this.keys.jump && this.onGround) {
            this.velY = this.jumpSpeed
            this.onGround = false
        }
        this.velY += this.gravity * delta
        this.position.y += this.velY * delta
        if (this.position.y <= 0) {
            this.position.y = 0
            this.velY = 0
            this.onGround = true
        }

        // Apply to model with walk animation
        this.group.position.copy(this.position)
        this.group.rotation.y = this.facing

        const swing = moving ? Math.sin(this.walkPhase) : 0
        if (this.legs) {
            this.legs[0].rotation.x = swing * 0.7
            this.legs[1].rotation.x = -swing * 0.7
        }
        if (this.arms) {
            this.arms[0].rotation.x = -swing * 0.5
            this.arms[1].rotation.x = swing * 0.5
        }
        this.group.position.y = this.position.y + (moving ? Math.abs(Math.sin(this.walkPhase)) * 0.04 : 0)

        // Follow camera with a touch of smoothing
        const cam = this.camera.instance
        const offset = new THREE.Vector3(
            Math.sin(this.camYaw) * Math.cos(this.camPitch),
            Math.sin(this.camPitch),
            Math.cos(this.camYaw) * Math.cos(this.camPitch)
        ).multiplyScalar(this.camDist)
        const targetPos = this.position.clone().add(offset).add(new THREE.Vector3(0, 0.8, 0))
        cam.position.lerp(targetPos, Math.min(1, delta * 7))
        cam.lookAt(this.position.x, this.position.y + 1.1, this.position.z)
    }
}
