import * as THREE from 'three'
import BaseScene from './BaseScene.js'

export default class SpaceScene extends BaseScene {
    constructor() {
        super()
        this.stars = null
        this.planets = []
        this.asteroids = []
        this.paintingPods = []
    }

    setup() {
        this.setLighting()
        this.setSpaceBackground()
        this.setStars()
        this.setNebula()
        this.setPlanets()
        this.setAsteroids()
        this.setPaintingPods()
        this.setZeroGravityDust()
    }

    setLighting() {
        const env = this.experience.world?.environment
        if (!env) return

        env.sunLight.intensity = 1.2
        env.sunLight.color.setHex(0xaaaaff)
        env.sunLight.position.set(10, 20, 10)
        env.fillLight.intensity = 0.6
        env.fillLight.color.setHex(0x7070d0)
        env.ambientLight.intensity = 1.0
        env.ambientLight.color.setHex(0x3a3a6e)

        this.scene.environment = null
        this.scene.background = new THREE.Color('#050510')
        if (env.environmentMap.updateMaterials) {
            env.environmentMap.updateMaterials()
        }

        if (this.experience.world?.paintings) {
            this.experience.world.paintings.setSpotlightsVisible(true)
        }
    }

    setSpaceBackground() {
        const floorGeometry = new THREE.PlaneGeometry(60, 60)
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: '#0a0a1a',
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.3
        })
        const floor = new THREE.Mesh(floorGeometry, floorMaterial)
        floor.rotation.x = -Math.PI * 0.5
        floor.receiveShadow = true
        this.add(floor)
    }

    setStars() {
        const starCount = 3000
        const positions = new Float32Array(starCount * 3)
        const colors = new Float32Array(starCount * 3)

        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3
            const radius = 100 + Math.random() * 200
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)

            positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
            positions[i3 + 2] = radius * Math.cos(phi)

            const brightness = 0.5 + Math.random() * 0.5
            const tint = Math.random()
            if (tint > 0.9) {
                colors[i3] = brightness * 0.8
                colors[i3 + 1] = brightness * 0.8
                colors[i3 + 2] = brightness
            } else if (tint > 0.8) {
                colors[i3] = brightness
                colors[i3 + 1] = brightness * 0.8
                colors[i3 + 2] = brightness * 0.6
            } else {
                colors[i3] = brightness
                colors[i3 + 1] = brightness
                colors[i3 + 2] = brightness
            }
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        const material = new THREE.PointsMaterial({
            size: 1.5,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.9
        })

        this.stars = new THREE.Points(geometry, material)
        this.add(this.stars)
    }

    setNebula() {
        const nebulaColors = ['#4a0080', '#800040', '#004080', '#008040']

        for (let i = 0; i < 6; i++) {
            const color = nebulaColors[Math.floor(Math.random() * nebulaColors.length)]
            const nebulaGeometry = new THREE.SphereGeometry(15 + Math.random() * 20, 16, 16)
            const nebulaMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.08,
                side: THREE.BackSide,
                depthWrite: false
            })

            const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial)
            const angle = (i / 6) * Math.PI * 2
            const radius = 60 + Math.random() * 40
            nebula.position.set(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 40,
                Math.sin(angle) * radius
            )
            this.add(nebula)
        }
    }

    setPlanets() {
        const planetGeometry = new THREE.SphereGeometry(8, 32, 32)
        const planetMaterial = new THREE.MeshStandardMaterial({
            color: '#4a90d9',
            roughness: 0.7,
            metalness: 0.2,
            emissive: '#1a3a6a',
            emissiveIntensity: 0.6
        })
        const planet = new THREE.Mesh(planetGeometry, planetMaterial)
        planet.position.set(40, 10, -30)
        this.add(planet)
        this.planets.push(planet)

        const ringGeometry = new THREE.RingGeometry(10, 16, 32)
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: '#c0c0c0',
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        })
        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        ring.position.copy(planet.position)
        ring.rotation.x = Math.PI / 3
        this.add(ring)

        const moonGeometry = new THREE.SphereGeometry(2, 16, 16)
        const moonMaterial = new THREE.MeshStandardMaterial({
            color: '#aaaaaa',
            roughness: 0.9,
            emissive: '#555555',
            emissiveIntensity: 0.5
        })
        const moon = new THREE.Mesh(moonGeometry, moonMaterial)
        moon.position.set(55, 5, -35)
        this.add(moon)
        this.planets.push(moon)

        const marsGeometry = new THREE.SphereGeometry(4, 24, 24)
        const marsMaterial = new THREE.MeshStandardMaterial({
            color: '#d94a4a',
            roughness: 0.8,
            emissive: '#6a1a1a',
            emissiveIntensity: 0.6
        })
        const mars = new THREE.Mesh(marsGeometry, marsMaterial)
        mars.position.set(-50, 20, 40)
        this.add(mars)
        this.planets.push(mars)
    }

    setAsteroids() {
        const asteroidMaterial = new THREE.MeshStandardMaterial({
            color: '#666666',
            roughness: 0.9,
            metalness: 0.1
        })

        for (let i = 0; i < 30; i++) {
            const size = 0.3 + Math.random() * 1.5
            const asteroid = new THREE.Mesh(
                new THREE.DodecahedronGeometry(size, 0),
                asteroidMaterial
            )

            const angle = Math.random() * Math.PI * 2
            const radius = 20 + Math.random() * 30
            asteroid.position.set(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 20,
                Math.sin(angle) * radius
            )
            asteroid.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            )
            asteroid.userData.rotationSpeed = {
                x: (Math.random() - 0.5) * 0.5,
                y: (Math.random() - 0.5) * 0.5,
                z: (Math.random() - 0.5) * 0.5
            }
            asteroid.userData.orbitSpeed = 0.02 + Math.random() * 0.05
            asteroid.userData.orbitAngle = angle
            asteroid.userData.orbitRadius = radius
            asteroid.castShadow = true

            this.add(asteroid)
            this.asteroids.push(asteroid)
        }
    }

    setPaintingPods() {
        const podMaterial = new THREE.MeshStandardMaterial({
            color: '#1a1a2e',
            roughness: 0.3,
            metalness: 0.8
        })
        const glowMaterial = new THREE.MeshStandardMaterial({
            color: '#00d4ff',
            emissive: '#00d4ff',
            emissiveIntensity: 0.5,
            roughness: 0.2
        })

        const slots = [
            [-8, 2, -8], [0, 3, -10], [8, 2, -8],
            [-8, 2, 8], [0, 3, 10], [8, 2, 8]
        ]

        slots.forEach(([x, y, z], index) => {
            const pod = new THREE.Group()

            const platform = new THREE.Mesh(
                new THREE.CylinderGeometry(2.5, 3, 0.3, 6),
                podMaterial
            )
            platform.position.y = -0.15
            platform.castShadow = true
            platform.receiveShadow = true
            pod.add(platform)

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(2.8, 0.08, 8, 32),
                glowMaterial
            )
            ring.rotation.x = Math.PI / 2
            ring.position.y = 0
            pod.add(ring)

            const frame = new THREE.Mesh(
                new THREE.BoxGeometry(3.8, 2.6, 0.1),
                podMaterial
            )
            frame.position.y = 1.6
            frame.castShadow = true
            pod.add(frame)

            const screen = new THREE.Mesh(
                new THREE.PlaneGeometry(3.5, 2.2),
                new THREE.MeshStandardMaterial({
                    color: '#ffffff',
                    roughness: 0.4,
                    emissive: '#222222',
                    emissiveIntensity: 0.2,
                    visible: false
                })
            )
            screen.position.set(0, 1.6, 0.06)
            screen.userData.slotIndex = index
            pod.add(screen)
            this.paintingSlots.push(screen)

            const glow = new THREE.Mesh(
                new THREE.ConeGeometry(1.5, 2, 8, 1, true),
                new THREE.MeshBasicMaterial({
                    color: '#00d4ff',
                    transparent: true,
                    opacity: 0.15,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            )
            glow.position.y = -1
            glow.rotation.x = Math.PI
            pod.add(glow)

            pod.position.set(x, y, z)
            pod.lookAt(0, 2, 0)

            this.add(pod)
            this.paintingPods.push(pod)
        })
    }

    setZeroGravityDust() {
        const dustCount = 500
        const positions = new Float32Array(dustCount * 3)

        for (let i = 0; i < dustCount; i++) {
            const i3 = i * 3
            positions[i3] = (Math.random() - 0.5) * 40
            positions[i3 + 1] = Math.random() * 15
            positions[i3 + 2] = (Math.random() - 0.5) * 40
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        const material = new THREE.PointsMaterial({
            color: '#00d4ff',
            size: 0.05,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true
        })

        this.dust = new THREE.Points(geometry, material)
        this.add(this.dust)
    }

    update() {
        const delta = this.time.delta / 1000

        this.planets.forEach((planet, i) => {
            planet.rotation.y += delta * (0.1 + i * 0.05)
        })

        this.asteroids.forEach((asteroid) => {
            asteroid.userData.orbitAngle += delta * asteroid.userData.orbitSpeed
            asteroid.position.x = Math.cos(asteroid.userData.orbitAngle) * asteroid.userData.orbitRadius
            asteroid.position.z = Math.sin(asteroid.userData.orbitAngle) * asteroid.userData.orbitRadius

            asteroid.rotation.x += delta * asteroid.userData.rotationSpeed.x
            asteroid.rotation.y += delta * asteroid.userData.rotationSpeed.y
            asteroid.rotation.z += delta * asteroid.userData.rotationSpeed.z
        })

        this.paintingPods.forEach((pod, i) => {
            pod.position.y += Math.sin(this.time.elapsed * 0.001 + i) * 0.002
        })

        if (this.stars) {
            this.stars.rotation.y += delta * 0.005
        }
    }
}
