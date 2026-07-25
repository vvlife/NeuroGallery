import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Particles {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.time = this.experience.time

        this.visible = true
        this.speed = 5.0
        this.particleCount = 1000

        this.createParticles()
    }

    createParticles() {
        const count = this.particleCount

        const positions = new Float32Array(count * 3)
        const velocities = new Float32Array(count * 3)
        const colors = new Float32Array(count * 3)
        const sizes = new Float32Array(count)
        const shimmer = new Float32Array(count)

        for (let i = 0; i < count; i++) {
            const i3 = i * 3

            positions[i3] = (Math.random() - 0.5) * 50
            positions[i3 + 1] = Math.random() * 15 + 0.5
            positions[i3 + 2] = (Math.random() - 0.5) * 50

            velocities[i3] = (Math.random() - 0.5) * 0.5
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.3
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.5

            const brightness = 0.7 + Math.random() * 0.3
            const warmth = Math.random() * 0.1
            colors[i3] = brightness + warmth
            colors[i3 + 1] = brightness + warmth/2
            colors[i3 + 2] = brightness

            sizes[i] = 0.02 + Math.random() * 0.03
            shimmer[i] = Math.random() * Math.PI * 2
        }

        if (this.geometry) this.geometry.dispose()
        if (this.material) this.material.dispose()
        if (this.points) this.scene.remove(this.points)

        const canvas = document.createElement('canvas')
        canvas.width = 32
        canvas.height = 32
        const ctx = canvas.getContext('2d')

        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
        gradient.addColorStop(0, 'rgba(255,255,255,1)')
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)')
        gradient.addColorStop(1, 'rgba(255,255,255,0)')

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 32, 32)

        const circleTexture = new THREE.CanvasTexture(canvas)

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

        this.velocities = velocities
        this.shimmerPhases = shimmer
        this.originalColors = colors.slice()
        this.animationTime = 0

        this.material = new THREE.PointsMaterial({
            map: circleTexture,
            size: 0.03,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            alphaTest: 0.01,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })

        this.points = new THREE.Points(this.geometry, this.material)
        this.points.visible = this.visible
        this.points.renderOrder = 999
        this.scene.add(this.points)
    }

    update() {
        if (!this.visible || !this.points || !this.time) return

        const delta = this.time.delta / 1000
        this.animationTime += delta

        const positions = this.geometry.attributes.position.array
        const colors = this.geometry.attributes.color.array
        const originalColors = this.originalColors

        for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3

            positions[i3] += this.velocities[i3] * delta * this.speed
            positions[i3 + 1] += this.velocities[i3 + 1] * delta * this.speed
            positions[i3 + 2] += this.velocities[i3 + 2] * delta * this.speed

            const range = 25

            if (positions[i3] > range) {
                positions[i3] = -range
            } else if (positions[i3] < -range) {
                positions[i3] = range
            }

            if (positions[i3 + 1] > 15) {
                positions[i3 + 1] = 0.5
            } else if (positions[i3 + 1] < 0.5) {
                positions[i3 + 1] = 15
            }

            if (positions[i3 + 2] > range) {
                positions[i3 + 2] = -range
            } else if (positions[i3 + 2] < -range) {
                positions[i3 + 2] = range
            }

            const shimmerValue = Math.sin(this.animationTime * 2 + this.shimmerPhases[i]) * 0.3 + 0.7
            colors[i3] = originalColors[i3] * shimmerValue
            colors[i3 + 1] = originalColors[i3 + 1] * shimmerValue
            colors[i3 + 2] = originalColors[i3 + 2] * shimmerValue
        }

        this.geometry.attributes.position.needsUpdate = true
        this.geometry.attributes.color.needsUpdate = true
    }

    updateCount(newCount) {
        if (newCount === this.particleCount) return

        this.particleCount = Math.max(0, Math.min(2000, newCount))

        if (this.particleCount === 0) {
            if (this.points) {
                this.points.visible = false
            }
        } else {
            this.createParticles()
        }
    }

    set visible(value) {
        this._visible = value
        if (this.points) {
            this.points.visible = value && this.particleCount > 0
        }
    }

    get visible() {
        return this._visible
    }

    setEffect(effectName) {
        if (!this.material) return

        switch (effectName) {
            case 'glow':
                this.material.blending = THREE.AdditiveBlending
                this.material.opacity = 0.8
                break
            case 'sparkle':
                this.material.blending = THREE.AdditiveBlending
                this.material.opacity = 1.0
                this.material.size = 0.05
                break
            case 'subtle':
                this.material.blending = THREE.NormalBlending
                this.material.opacity = 0.4
                this.material.size = 0.02
                break
            default:
                this.material.blending = THREE.AdditiveBlending
                this.material.opacity = 0.8
                this.material.size = 0.03
        }
    }
} 