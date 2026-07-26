import * as THREE from 'three'
import BaseScene from './BaseScene.js'

export default class CyberpunkScene extends BaseScene {
    constructor() {
        super()
        this.buildings = []
        this.neonSigns = []
        this.paintingBoards = []
        this.rain = null
        this.rainVelocities = null
    }

    setup() {
        this.setLighting()
        this.setGround()
        this.setBuildings()
        this.setNeonSigns()
        this.setPaintingBoards()
        this.setRain()
    }

    setLighting() {
        const env = this.experience.world?.environment
        if (!env) return

        env.sunLight.intensity = 0.7
        env.sunLight.color.setHex(0x7777dd)
        env.fillLight.intensity = 0.4
        env.fillLight.color.setHex(0x550088)
        env.ambientLight.intensity = 1.1
        env.ambientLight.color.setHex(0x3a2a4e)

        this.scene.environment = null
        this.scene.background = new THREE.Color('#120a20')
        this.scene.fog = new THREE.Fog('#120a20', 25, 90)
        if (env.environmentMap.updateMaterials) {
            env.environmentMap.updateMaterials()
        }

        if (this.experience.world?.paintings) {
            this.experience.world.paintings.setSpotlightsVisible(true)
        }
    }

    setGround() {
        const groundGeometry = new THREE.PlaneGeometry(60, 60)
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: '#2a2a40',
            roughness: 0.3,
            metalness: 0.7
        })
        const ground = new THREE.Mesh(groundGeometry, groundMaterial)
        ground.rotation.x = -Math.PI * 0.5
        ground.receiveShadow = true
        this.add(ground)

        const gridHelper = new THREE.GridHelper(60, 30, '#ff00ff', '#00ffff')
        gridHelper.position.y = 0.01
        gridHelper.material.opacity = 0.15
        gridHelper.material.transparent = true
        this.add(gridHelper)
    }

    setBuildings() {
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: '#2a2a3e',
            roughness: 0.7,
            metalness: 0.4,
            emissive: '#12121f',
            emissiveIntensity: 0.4
        })

        const neonColors = ['#ff00ff', '#00ffff', '#ff0080', '#8000ff', '#00ff80']

        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2
            const radius = 25 + Math.random() * 10
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius

            const width = 3 + Math.random() * 4
            const height = 8 + Math.random() * 15
            const depth = 3 + Math.random() * 4

            const building = new THREE.Mesh(
                new THREE.BoxGeometry(width, height, depth),
                buildingMaterial
            )
            building.position.set(x, height / 2, z)
            building.castShadow = true
            building.receiveShadow = true
            this.add(building)
            this.buildings.push(building)

            if (Math.random() > 0.4) {
                const neonColor = neonColors[Math.floor(Math.random() * neonColors.length)]
                const strip = new THREE.Mesh(
                    new THREE.BoxGeometry(width + 0.1, 0.15, depth + 0.1),
                    new THREE.MeshStandardMaterial({
                        color: neonColor,
                        emissive: neonColor,
                        emissiveIntensity: 1.5
                    })
                )
                strip.position.set(x, height * (0.3 + Math.random() * 0.5), z)
                this.add(strip)
            }

            if (Math.random() > 0.3) {
                const windowColor = neonColors[Math.floor(Math.random() * neonColors.length)]
                for (let w = 0; w < 3; w++) {
                    const windowMesh = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.8, 1.2),
                        new THREE.MeshStandardMaterial({
                            color: windowColor,
                            emissive: windowColor,
                            emissiveIntensity: 0.8,
                            transparent: true,
                            opacity: 0.7
                        })
                    )
                    const side = Math.random() > 0.5 ? 1 : -1
                    windowMesh.position.set(
                        x + (width / 2 + 0.01) * side,
                        2 + w * 3 + Math.random() * 2,
                        z + (Math.random() - 0.5) * depth * 0.6
                    )
                    windowMesh.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
                    this.add(windowMesh)
                }
            }
        }
    }

    setNeonSigns() {
        const signs = [
            { text: 'NEURO', color: '#ff00ff', pos: [-15, 8, -15] },
            { text: 'GALLERY', color: '#00ffff', pos: [15, 10, -15] },
            { text: 'AI ART', color: '#ff0080', pos: [-15, 12, 15] },
            { text: 'FUTURE', color: '#8000ff', pos: [15, 9, 15] }
        ]

        signs.forEach(({ text, color, pos }) => {
            const canvas = document.createElement('canvas')
            canvas.width = 512
            canvas.height = 128
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.font = 'bold 80px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = color
            ctx.shadowColor = color
            ctx.shadowBlur = 20
            ctx.fillText(text, canvas.width / 2, canvas.height / 2)

            const texture = new THREE.CanvasTexture(canvas)
            const sign = new THREE.Mesh(
                new THREE.PlaneGeometry(6, 1.5),
                new THREE.MeshStandardMaterial({
                    map: texture,
                    emissive: color,
                    emissiveIntensity: 1.2,
                    transparent: true
                })
            )
            sign.position.set(...pos)
            sign.lookAt(0, pos[1], 0)
            this.add(sign)
            this.neonSigns.push(sign)
        })
    }

    setPaintingBoards() {
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: '#0a0a1a',
            roughness: 0.3,
            metalness: 0.9
        })

        const slots = [
            [-8, 0, -8], [0, 0, -10], [8, 0, -8],
            [-8, 0, 8], [0, 0, 10], [8, 0, 8]
        ]

        slots.forEach(([x, y, z], index) => {
            const board = new THREE.Group()

            const pillar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.2, 3, 8),
                frameMaterial
            )
            pillar.position.y = 1.5
            pillar.castShadow = true
            board.add(pillar)

            const frame = new THREE.Mesh(
                new THREE.BoxGeometry(4, 2.8, 0.1),
                frameMaterial
            )
            frame.position.y = 3.2
            frame.castShadow = true
            board.add(frame)

            const screen = new THREE.Mesh(
                new THREE.PlaneGeometry(3.6, 2.4),
                new THREE.MeshStandardMaterial({
                    color: '#ffffff',
                    roughness: 0.2,
                    emissive: '#111111',
                    emissiveIntensity: 0.3,
                    visible: false
                })
            )
            screen.position.set(0, 3.2, 0.06)
            screen.userData.slotIndex = index
            board.add(screen)
            this.paintingSlots.push(screen)

            const borderColor = index % 2 === 0 ? '#00ffff' : '#ff00ff'
            const border = new THREE.Mesh(
                new THREE.BoxGeometry(4.2, 3, 0.05),
                new THREE.MeshStandardMaterial({
                    color: borderColor,
                    emissive: borderColor,
                    emissiveIntensity: 1.0
                })
            )
            border.position.y = 3.2
            board.add(border)

            board.position.set(x, y, z)
            board.lookAt(0, 3.2, 0)

            this.add(board)
            this.paintingBoards.push(board)
        })
    }

    setRain() {
        const rainCount = 2000
        const positions = new Float32Array(rainCount * 3)
        const velocities = new Float32Array(rainCount)

        for (let i = 0; i < rainCount; i++) {
            const i3 = i * 3
            positions[i3] = (Math.random() - 0.5) * 50
            positions[i3 + 1] = Math.random() * 30
            positions[i3 + 2] = (Math.random() - 0.5) * 50
            velocities[i] = 15 + Math.random() * 10
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        const material = new THREE.PointsMaterial({
            color: '#aaccff',
            size: 0.08,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true
        })

        this.rain = new THREE.Points(geometry, material)
        this.rainVelocities = velocities
        this.add(this.rain)
    }

    update() {
        const delta = this.time.delta / 1000

        if (this.rain) {
            const positions = this.rain.geometry.attributes.position.array
            for (let i = 0; i < positions.length / 3; i++) {
                const i3 = i * 3
                positions[i3 + 1] -= this.rainVelocities[i] * delta
                if (positions[i3 + 1] < 0) {
                    positions[i3 + 1] = 30
                    positions[i3] = (Math.random() - 0.5) * 50
                    positions[i3 + 2] = (Math.random() - 0.5) * 50
                }
            }
            this.rain.geometry.attributes.position.needsUpdate = true
        }

        this.neonSigns.forEach((sign, i) => {
            const flicker = Math.sin(this.time.elapsed * 0.01 + i * 2) > -0.9 ? 1 : 0.3
            sign.material.emissiveIntensity = 1.2 * flicker
        })
    }
}
