import * as THREE from 'three'
import BaseScene from './BaseScene.js'

export default class AnimalCrossingScene extends BaseScene {
    constructor() {
        super()
        this.clouds = []
        this.trees = []
        this.flowers = []
    }

    setup() {
        this.setLighting()
        this.setGround()
        this.setSky()
        this.setTrees()
        this.setFlowers()
        this.setFence()
        this.setPaintingStands()
        this.setClouds()
    }

    setLighting() {
        const env = this.experience.world?.environment
        if (!env) return

        env.sunLight.intensity = 1.4
        env.sunLight.color.setHex(0xffedcc)
        env.sunLight.position.set(5, 15, 5)
        env.fillLight.intensity = 0.5
        env.fillLight.color.setHex(0xcce5ff)
        env.ambientLight.intensity = 1.2
        env.ambientLight.color.setHex(0xfff8e7)

        this.scene.environment = null
        this.scene.background = new THREE.Color('#87CEEB')
        if (env.environmentMap.updateMaterials) {
            env.environmentMap.updateMaterials()
        }

        if (this.experience.world?.paintings) {
            this.experience.world.paintings.setSpotlightsVisible(false)
        }
    }

    setGround() {
        const groundGeometry = new THREE.PlaneGeometry(50, 50, 32, 32)
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: '#7ec850',
            roughness: 0.9,
            metalness: 0.0
        })

        const positions = groundGeometry.attributes.position
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i)
            const y = positions.getY(i)
            positions.setZ(i, Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.15)
        }
        groundGeometry.computeVertexNormals()

        const ground = new THREE.Mesh(groundGeometry, groundMaterial)
        ground.rotation.x = -Math.PI * 0.5
        ground.receiveShadow = true
        this.add(ground)

        const pathGeometry = new THREE.CircleGeometry(6, 32)
        const pathMaterial = new THREE.MeshStandardMaterial({
            color: '#d4a76a',
            roughness: 0.95
        })
        const path = new THREE.Mesh(pathGeometry, pathMaterial)
        path.rotation.x = -Math.PI * 0.5
        path.position.y = 0.01
        path.receiveShadow = true
        this.add(path)
    }

    setSky() {
        const skyGeometry = new THREE.SphereGeometry(80, 32, 32)
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: '#87CEEB',
            side: THREE.BackSide,
            fog: false
        })
        const sky = new THREE.Mesh(skyGeometry, skyMaterial)
        this.add(sky)

        const sunGeometry = new THREE.SphereGeometry(3, 16, 16)
        const sunMaterial = new THREE.MeshBasicMaterial({ color: '#ffeb3b', fog: false })
        const sun = new THREE.Mesh(sunGeometry, sunMaterial)
        sun.position.set(30, 35, 20)
        this.add(sun)
    }

    setClouds() {
        const cloudMaterial = new THREE.MeshStandardMaterial({
            color: '#ffffff',
            roughness: 1,
            transparent: true,
            opacity: 0.9
        })

        for (let i = 0; i < 8; i++) {
            const cloud = new THREE.Group()
            const puffCount = 3 + Math.floor(Math.random() * 3)

            for (let j = 0; j < puffCount; j++) {
                const size = 1.5 + Math.random() * 2
                const puff = new THREE.Mesh(
                    new THREE.SphereGeometry(size, 8, 8),
                    cloudMaterial
                )
                puff.position.set(
                    (Math.random() - 0.5) * 4,
                    (Math.random() - 0.5) * 1,
                    (Math.random() - 0.5) * 2
                )
                cloud.add(puff)
            }

            const angle = (i / 8) * Math.PI * 2
            const radius = 25 + Math.random() * 15
            cloud.position.set(
                Math.cos(angle) * radius,
                12 + Math.random() * 8,
                Math.sin(angle) * radius
            )
            cloud.userData.speed = 0.1 + Math.random() * 0.2
            cloud.userData.angle = angle
            cloud.userData.radius = radius

            this.add(cloud)
            this.clouds.push(cloud)
        }
    }

    setTrees() {
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.9 })
        const leafMaterial = new THREE.MeshStandardMaterial({ color: '#5cb85c', roughness: 0.8 })

        const positions = [
            [-10, -10], [10, -10], [-12, 5], [12, 5],
            [-8, 12], [8, 12], [-15, -2], [15, -2],
            [-5, -15], [5, -15], [0, 18], [-18, 8]
        ]

        positions.forEach(([x, z], index) => {
            const tree = new THREE.Group()

            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.3, 0.4, 2.5, 8),
                trunkMaterial
            )
            trunk.position.y = 1.25
            trunk.castShadow = true
            trunk.receiveShadow = true
            tree.add(trunk)

            const leafCount = 3 + (index % 2)
            for (let i = 0; i < leafCount; i++) {
                const leaf = new THREE.Mesh(
                    new THREE.SphereGeometry(1.2 + Math.random() * 0.5, 8, 8),
                    leafMaterial
                )
                leaf.position.set(
                    (Math.random() - 0.5) * 1.2,
                    2.5 + i * 0.8,
                    (Math.random() - 0.5) * 1.2
                )
                leaf.castShadow = true
                leaf.receiveShadow = true
                tree.add(leaf)
            }

            tree.position.set(x, 0, z)
            tree.rotation.y = Math.random() * Math.PI * 2
            this.add(tree)
            this.trees.push(tree)
        })
    }

    setFlowers() {
        const colors = ['#ff6b9d', '#c44dff', '#4dc9ff', '#ffdf4d', '#ff8c42', '#ffffff']

        for (let i = 0; i < 40; i++) {
            const flower = new THREE.Group()

            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6),
                new THREE.MeshStandardMaterial({ color: '#3d8c40' })
            )
            stem.position.y = 0.2
            flower.add(stem)

            const petalColor = colors[Math.floor(Math.random() * colors.length)]
            const petalMaterial = new THREE.MeshStandardMaterial({ color: petalColor, roughness: 0.7 })
            for (let j = 0; j < 5; j++) {
                const petal = new THREE.Mesh(
                    new THREE.SphereGeometry(0.08, 6, 6),
                    petalMaterial
                )
                const angle = (j / 5) * Math.PI * 2
                petal.position.set(
                    Math.cos(angle) * 0.1,
                    0.4,
                    Math.sin(angle) * 0.1
                )
                petal.scale.set(1.2, 0.6, 1.2)
                flower.add(petal)
            }

            const center = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 6, 6),
                new THREE.MeshStandardMaterial({ color: '#ffdf4d' })
            )
            center.position.y = 0.42
            flower.add(center)

            const angle = Math.random() * Math.PI * 2
            const radius = 7 + Math.random() * 10
            flower.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            )

            this.add(flower)
            this.flowers.push(flower)
        }
    }

    setFence() {
        const fenceMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 })
        const postGeometry = new THREE.BoxGeometry(0.12, 1, 0.12)
        const railGeometry = new THREE.BoxGeometry(2, 0.08, 0.08)

        const radius = 14
        const postCount = 24

        for (let i = 0; i < postCount; i++) {
            const angle = (i / postCount) * Math.PI * 2
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius

            const post = new THREE.Mesh(postGeometry, fenceMaterial)
            post.position.set(x, 0.5, z)
            post.castShadow = true
            post.receiveShadow = true
            this.add(post)
        }

        for (let i = 0; i < postCount; i++) {
            const angle1 = (i / postCount) * Math.PI * 2
            const angle2 = ((i + 1) / postCount) * Math.PI * 2
            const x1 = Math.cos(angle1) * radius
            const z1 = Math.sin(angle1) * radius
            const x2 = Math.cos(angle2) * radius
            const z2 = Math.sin(angle2) * radius

            const rail = new THREE.Mesh(railGeometry, fenceMaterial)
            rail.position.set((x1 + x2) / 2, 0.7, (z1 + z2) / 2)
            rail.lookAt(x2, 0.7, z2)
            rail.castShadow = true
            rail.receiveShadow = true
            this.add(rail)
        }
    }

    setPaintingStands() {
        const woodMaterial = new THREE.MeshStandardMaterial({ color: '#a0683c', roughness: 0.75 })

        const slots = [
            [-6, 0, -6], [0, 0, -8], [6, 0, -6],
            [-6, 0, 6], [0, 0, 8], [6, 0, 6]
        ]

        slots.forEach(([x, y, z], index) => {
            const stand = new THREE.Group()

            // A-frame: two leaning front legs
            for (const side of [-1, 1]) {
                const leg = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8),
                    woodMaterial
                )
                leg.position.set(side * 1.2, 1.2, 0.25)
                leg.rotation.z = -side * 0.22
                leg.rotation.x = 0.12
                leg.castShadow = true
                stand.add(leg)
            }

            // Rear support leg
            const rearLeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8),
                woodMaterial
            )
            rearLeg.position.set(0, 1.1, -0.55)
            rearLeg.rotation.x = -0.35
            rearLeg.castShadow = true
            stand.add(rearLeg)

            // Crossbar the canvas rests on
            const crossbar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8),
                woodMaterial
            )
            crossbar.rotation.z = Math.PI / 2
            crossbar.position.set(0, 0.95, 0.32)
            crossbar.castShadow = true
            stand.add(crossbar)

            // Open wooden frame around the artwork (no solid board, so the
            // double-sided painting stays visible from behind as well)
            const frameZ = 0.22
            const frameParts = [
                { w: 3.4, h: 0.12, px: 0, py: 2.9 },   // top
                { w: 3.4, h: 0.12, px: 0, py: 0.62 },  // bottom
                { w: 0.12, h: 2.4, px: -1.64, py: 1.76 }, // left
                { w: 0.12, h: 2.4, px: 1.64, py: 1.76 }   // right
            ]
            frameParts.forEach(({ w, h, px, py }) => {
                const part = new THREE.Mesh(
                    new THREE.BoxGeometry(w, h, 0.1),
                    woodMaterial
                )
                part.position.set(px, py, frameZ)
                part.castShadow = true
                stand.add(part)
            })

            // Painting slot (double-sided; the artwork group aligns to this)
            const painting = new THREE.Mesh(
                new THREE.PlaneGeometry(3.0, 2.0),
                new THREE.MeshStandardMaterial({
                    color: '#ffffff',
                    roughness: 0.9,
                    side: THREE.DoubleSide
                })
            )
            painting.position.set(0, 1.76, frameZ)
            painting.userData.slotIndex = index
            stand.add(painting)
            this.paintingSlots.push(painting)

            stand.position.set(x, y, z)
            stand.lookAt(0, 1.8, 0)

            this.add(stand)
        })
    }

    update() {
        const delta = this.time.delta / 1000
        this.clouds.forEach((cloud) => {
            cloud.userData.angle += delta * cloud.userData.speed * 0.05
            cloud.position.x = Math.cos(cloud.userData.angle) * cloud.userData.radius
            cloud.position.z = Math.sin(cloud.userData.angle) * cloud.userData.radius
        })

        this.trees.forEach((tree, i) => {
            tree.rotation.z = Math.sin(this.time.elapsed * 0.001 + i) * 0.02
        })
    }
}
