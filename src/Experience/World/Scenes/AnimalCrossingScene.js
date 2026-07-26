import * as THREE from 'three'
import BaseScene from './BaseScene.js'

/**
 * Animal Crossing inspired scene.
 *
 * Design notes (from Nintendo's CEDEC 2020 talk on ACNH art direction):
 * - Symbolize everything: keep the defining silhouette, drop the detail
 * - Villagers share one simple rounded outline (egg body, big head)
 *   differentiated only by ears / color, readable from a distance
 * - Warm, bright palette; bouncy, elastic motion
 * - Fill the view with "play points": houses, pond, fruit trees, flowers
 *
 * The artwork easels form the village plaza at the centre.
 */
export default class AnimalCrossingScene extends BaseScene {
    constructor() {
        super()
        this.clouds = []
        this.trees = []
        this.villagers = []
        this.balloons = []
        this.fountainDrops = null
    }

    setup() {
        this.setLighting()
        this.setGround()
        this.setSky()
        this.setPlaza()          // fountain + notice board at the plaza centre
        this.setPaintingStands() // artwork easels around the plaza
        this.setHouses()         // candy-roof houses behind the plaza
        this.setFruitTrees()     // fruit trees with symbolic 3-part canopies
        this.setFlowers()
        this.setFenceSafe()
        this.setPond()
        this.setHills()
        this.setClouds()
        this.setBalloons()
        this.setVillagers()      // animal NPCs wandering the plaza
    }

    // Some forks may not need the fence; keep it as its own step so the
    // scene still builds if it throws.
    setFenceSafe() {
        try {
            this.setFence()
        } catch (e) {
            console.warn('fence skipped', e)
        }
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
        const groundGeometry = new THREE.PlaneGeometry(60, 60, 32, 32)
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

        // Plaza floor: packed-earth circle
        const plazaGeometry = new THREE.CircleGeometry(7, 32)
        const plazaMaterial = new THREE.MeshStandardMaterial({
            color: '#d9b382',
            roughness: 0.95
        })
        const plaza = new THREE.Mesh(plazaGeometry, plazaMaterial)
        plaza.rotation.x = -Math.PI * 0.5
        plaza.position.y = 0.01
        plaza.receiveShadow = true
        this.add(plaza)

        // Dirt paths from the plaza to the houses
        const pathMaterial = new THREE.MeshStandardMaterial({ color: '#cf9f6a', roughness: 0.95 })
        const pathTargets = [[-14, -14], [14, -14], [-18, 6], [18, 6]]
        pathTargets.forEach(([hx, hz]) => {
            const length = Math.hypot(hx, hz) - 7
            const path = new THREE.Mesh(new THREE.PlaneGeometry(1.6, length), pathMaterial)
            path.rotation.x = -Math.PI * 0.5
            path.position.set(hx / 2, 0.015, hz / 2)
            path.rotation.z = Math.atan2(hx, hz)
            path.receiveShadow = true
            this.add(path)
        })
    }

    setSky() {
        const skyGeometry = new THREE.SphereGeometry(90, 32, 32)
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: '#87CEEB',
            side: THREE.BackSide,
            fog: false
        })
        const sky = new THREE.Mesh(skyGeometry, skyMaterial)
        this.add(sky)

        const sun = new THREE.Mesh(
            new THREE.SphereGeometry(3, 16, 16),
            new THREE.MeshBasicMaterial({ color: '#ffeb3b', fog: false })
        )
        sun.position.set(30, 35, 20)
        this.add(sun)
    }

    // ── Plaza: fountain + notice board ────────────────────────────────
    setPlaza() {
        const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.8 })
        const waterMaterial = new THREE.MeshStandardMaterial({
            color: '#5fbef5',
            roughness: 0.2,
            metalness: 0.1,
            transparent: true,
            opacity: 0.85
        })

        // Fountain basin
        const basin = new THREE.Mesh(
            new THREE.CylinderGeometry(1.6, 1.8, 0.5, 16),
            stoneMaterial
        )
        basin.position.set(0, 0.25, 0)
        basin.castShadow = true
        basin.receiveShadow = true
        this.add(basin)

        // Water disc
        const water = new THREE.Mesh(new THREE.CircleGeometry(1.45, 24), waterMaterial)
        water.rotation.x = -Math.PI * 0.5
        water.position.set(0, 0.48, 0)
        this.add(water)

        // Centre pillar + top bowl
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.24, 1.1, 10),
            stoneMaterial
        )
        pillar.position.set(0, 1.0, 0)
        pillar.castShadow = true
        this.add(pillar)

        const bowl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.3, 0.25, 12),
            stoneMaterial
        )
        bowl.position.set(0, 1.6, 0)
        bowl.castShadow = true
        this.add(bowl)

        // Falling water droplets (simple animated points)
        const dropCount = 60
        const dropPositions = new Float32Array(dropCount * 3)
        const dropSpeeds = new Float32Array(dropCount)
        for (let i = 0; i < dropCount; i++) {
            const i3 = i * 3
            const angle = Math.random() * Math.PI * 2
            const r = Math.random() * 0.5
            dropPositions[i3] = Math.cos(angle) * r
            dropPositions[i3 + 1] = 0.6 + Math.random() * 1.1
            dropPositions[i3 + 2] = Math.sin(angle) * r
            dropSpeeds[i] = 1.5 + Math.random()
        }
        const dropGeometry = new THREE.BufferGeometry()
        dropGeometry.setAttribute('position', new THREE.BufferAttribute(dropPositions, 3))
        this.fountainDrops = new THREE.Points(
            dropGeometry,
            new THREE.PointsMaterial({ color: '#bfe8ff', size: 0.06, transparent: true, opacity: 0.9 })
        )
        this.fountainDrops.userData.speeds = dropSpeeds
        this.add(this.fountainDrops)

        // Notice board (the AC plaza staple)
        const woodMaterial = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.85 })
        const boardGroup = new THREE.Group()

        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 8), woodMaterial)
            post.position.set(side * 0.8, 0.95, 0)
            post.castShadow = true
            boardGroup.add(post)
        }
        const boardFace = new THREE.Mesh(
            new THREE.BoxGeometry(1.9, 1.2, 0.08),
            new THREE.MeshStandardMaterial({ color: '#c89b62', roughness: 0.9 })
        )
        boardFace.position.set(0, 1.35, 0)
        boardFace.castShadow = true
        boardGroup.add(boardFace)

        // Paper notes pinned on the board
        const noteColors = ['#ffffff', '#ffe28a', '#ffb3c7', '#b3e5ff']
        noteColors.forEach((c, i) => {
            const note = new THREE.Mesh(
                new THREE.PlaneGeometry(0.35, 0.35),
                new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })
            )
            note.position.set(-0.55 + (i % 2) * 1.1, 1.2 + Math.floor(i / 2) * 0.45, 0.05)
            note.rotation.z = (Math.random() - 0.5) * 0.2
            boardGroup.add(note)
        })

        boardGroup.position.set(4.5, 0, 2.5)
        boardGroup.rotation.y = -Math.PI * 0.25
        this.add(boardGroup)
    }

    // ── Artwork easels around the plaza ───────────────────────────────
    setPaintingStands() {
        const woodMaterial = new THREE.MeshStandardMaterial({ color: '#a0683c', roughness: 0.75 })

        const slots = [
            [-6, 0, -6], [0, 0, -8], [6, 0, -6],
            [-6, 0, 6], [0, 0, 8], [6, 0, 6]
        ]

        slots.forEach(([x, y, z], index) => {
            const stand = new THREE.Group()

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

            const rearLeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8),
                woodMaterial
            )
            rearLeg.position.set(0, 1.1, -0.55)
            rearLeg.rotation.x = -0.35
            rearLeg.castShadow = true
            stand.add(rearLeg)

            const crossbar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8),
                woodMaterial
            )
            crossbar.rotation.z = Math.PI / 2
            crossbar.position.set(0, 0.95, 0.32)
            crossbar.castShadow = true
            stand.add(crossbar)

            const frameZ = 0.22
            const frameParts = [
                { w: 3.4, h: 0.12, px: 0, py: 2.9 },
                { w: 3.4, h: 0.12, px: 0, py: 0.62 },
                { w: 0.12, h: 2.4, px: -1.64, py: 1.76 },
                { w: 0.12, h: 2.4, px: 1.64, py: 1.76 }
            ]
            frameParts.forEach(({ w, h, px, py }) => {
                const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), woodMaterial)
                part.position.set(px, py, frameZ)
                part.castShadow = true
                stand.add(part)
            })

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

    // ── Houses: symbolic round-roof cottages behind the plaza ─────────
    setHouses() {
        const houses = [
            { x: -14, z: -16, roof: '#e8574d', wall: '#fff4e0', turn: 0.35 },
            { x: 0, z: -19, roof: '#4d94e8', wall: '#ffffff', turn: 0 },
            { x: 14, z: -16, roof: '#f5b83d', wall: '#fff4e0', turn: -0.35 },
            { x: -20, z: 6, roof: '#7bc96f', wall: '#fdf0f5', turn: Math.PI * 0.5 },
            { x: 20, z: 6, roof: '#e87ec7', wall: '#fff4e0', turn: -Math.PI * 0.5 }
        ]

        houses.forEach(({ x, z, roof, wall, turn }) => {
            const house = new THREE.Group()

            // Walls
            const walls = new THREE.Mesh(
                new THREE.BoxGeometry(4.2, 2.8, 3.6),
                new THREE.MeshStandardMaterial({ color: wall, roughness: 0.9 })
            )
            walls.position.y = 1.4
            walls.castShadow = true
            walls.receiveShadow = true
            house.add(walls)

            // Round roof (half sphere — the AC silhouette)
            const roofMesh = new THREE.Mesh(
                new THREE.SphereGeometry(2.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
                new THREE.MeshStandardMaterial({ color: roof, roughness: 0.8 })
            )
            roofMesh.scale.set(1, 0.75, 0.85)
            roofMesh.position.y = 2.8
            roofMesh.castShadow = true
            house.add(roofMesh)

            // Door (round-top, darker wood)
            const door = new THREE.Mesh(
                new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16, 1, false, 0, Math.PI),
                new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.85 })
            )
            door.rotation.z = Math.PI / 2
            door.rotation.y = Math.PI / 2
            door.position.set(0, 1.1, 1.83)
            house.add(door)

            const doorLower = new THREE.Mesh(
                new THREE.BoxGeometry(1.1, 1.1, 0.1),
                new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.85 })
            )
            doorLower.position.set(0, 0.55, 1.83)
            house.add(doorLower)

            // Round windows
            for (const side of [-1, 1]) {
                const windowMesh = new THREE.Mesh(
                    new THREE.CircleGeometry(0.4, 16),
                    new THREE.MeshStandardMaterial({ color: '#ffe9a8', roughness: 0.4, emissive: '#ffdf80', emissiveIntensity: 0.25 })
                )
                windowMesh.position.set(side * 1.4, 1.7, 1.81)
                house.add(windowMesh)
            }

            // Chimney
            const chimney = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 1.1, 0.5),
                new THREE.MeshStandardMaterial({ color: '#d9c8b8', roughness: 0.9 })
            )
            chimney.position.set(1.2, 4.0, -0.6)
            chimney.castShadow = true
            house.add(chimney)

            // Little flower patch by the door
            for (let i = 0; i < 3; i++) {
                const flowerHead = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 6, 6),
                    new THREE.MeshStandardMaterial({ color: ['#ff6b9d', '#ffdf4d', '#ffffff'][i], roughness: 0.7 })
                )
                flowerHead.position.set(-1.6 + i * 0.35, 0.35, 2.2)
                house.add(flowerHead)
            }

            house.position.set(x, 0, z)
            house.rotation.y = turn
            this.add(house)
        })
    }

    // ── Fruit trees: round canopy + symbolic fruit dots ───────────────
    setFruitTrees() {
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.9 })
        const leafMaterial = new THREE.MeshStandardMaterial({ color: '#5cb85c', roughness: 0.8 })
        const fruitColors = ['#ff4d4d', '#ffa53d', '#ffb3c7'] // apple / orange / peach

        const spots = [
            [-10, -10, 0], [10, -10, 1], [-12, 5, 2], [12, 5, 0],
            [-8, 12, 1], [8, 12, 2], [-15, -4, 2], [15, -4, 1],
            [-5, -15, 0], [5, -15, 1], [0, 17, 2], [-18, 12, 0],
            [18, 12, 1], [-22, -8, 2], [22, -8, 0]
        ]

        spots.forEach(([x, z, fruitIdx], index) => {
            const tree = new THREE.Group()

            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.28, 0.38, 2.2, 8),
                trunkMaterial
            )
            trunk.position.y = 1.1
            trunk.castShadow = true
            trunk.receiveShadow = true
            tree.add(trunk)

            // Symbolic 3-part canopy (Nintendo's recipe: keep it readable)
            const canopyOffsets = [[0, 3.1, 0], [-0.8, 2.6, 0.2], [0.8, 2.6, -0.2]]
            canopyOffsets.forEach(([ox, oy, oz]) => {
                const leaf = new THREE.Mesh(
                    new THREE.SphereGeometry(1.3, 10, 10),
                    leafMaterial
                )
                leaf.position.set(ox, oy, oz)
                leaf.castShadow = true
                leaf.receiveShadow = true
                tree.add(leaf)
            })

            // Fruit dots on the canopy
            const fruitColor = fruitColors[fruitIdx]
            for (let i = 0; i < 5; i++) {
                const fruit = new THREE.Mesh(
                    new THREE.SphereGeometry(0.14, 6, 6),
                    new THREE.MeshStandardMaterial({ color: fruitColor, roughness: 0.5 })
                )
                const angle = (i / 5) * Math.PI * 2 + index
                fruit.position.set(
                    Math.cos(angle) * 1.1,
                    2.7 + Math.sin(i * 2.3) * 0.5,
                    Math.sin(angle) * 1.1
                )
                tree.add(fruit)
            }

            tree.position.set(x, 0, z)
            tree.rotation.y = Math.random() * Math.PI * 2
            tree.userData.swayOffset = index
            this.add(tree)
            this.trees.push(tree)
        })
    }

    setFlowers() {
        const colors = ['#ff6b9d', '#c44dff', '#4dc9ff', '#ffdf4d', '#ff8c42', '#ffffff']

        for (let i = 0; i < 50; i++) {
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
                const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), petalMaterial)
                const angle = (j / 5) * Math.PI * 2
                petal.position.set(Math.cos(angle) * 0.1, 0.4, Math.sin(angle) * 0.1)
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
            const radius = 8 + Math.random() * 14
            flower.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)

            this.add(flower)
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
            // Leave gaps where the paths exit the plaza
            if (i % 6 === 0) continue
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius

            const post = new THREE.Mesh(postGeometry, fenceMaterial)
            post.position.set(x, 0.5, z)
            post.castShadow = true
            post.receiveShadow = true
            this.add(post)
        }

        for (let i = 0; i < postCount; i++) {
            if (i % 6 === 0 || (i + 1) % 6 === 0) continue
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

    // ── Pond with lily pads ───────────────────────────────────────────
    setPond() {
        const pondGroup = new THREE.Group()

        const water = new THREE.Mesh(
            new THREE.CircleGeometry(3.5, 24),
            new THREE.MeshStandardMaterial({
                color: '#5fbef5',
                roughness: 0.15,
                transparent: true,
                opacity: 0.9
            })
        )
        water.rotation.x = -Math.PI * 0.5
        water.position.y = 0.02
        pondGroup.add(water)

        // Sandy rim
        const rim = new THREE.Mesh(
            new THREE.RingGeometry(3.5, 4.1, 24),
            new THREE.MeshStandardMaterial({ color: '#e0c496', roughness: 0.95 })
        )
        rim.rotation.x = -Math.PI * 0.5
        rim.position.y = 0.015
        pondGroup.add(rim)

        // Lily pads
        for (let i = 0; i < 4; i++) {
            const pad = new THREE.Mesh(
                new THREE.CircleGeometry(0.35, 10, 0.4, Math.PI * 1.7),
                new THREE.MeshStandardMaterial({ color: '#3d8c40', roughness: 0.8, side: THREE.DoubleSide })
            )
            pad.rotation.x = -Math.PI * 0.5
            const angle = (i / 4) * Math.PI * 2
            pad.position.set(Math.cos(angle) * 1.8, 0.03, Math.sin(angle) * 1.8)
            pondGroup.add(pad)
        }

        pondGroup.position.set(-17, 0, -6)
        this.add(pondGroup)
    }

    // ── Rolling hills on the horizon ──────────────────────────────────
    setHills() {
        const hillMaterial = new THREE.MeshStandardMaterial({ color: '#6ab04c', roughness: 1 })
        const hills = [
            { x: -30, z: -30, r: 14 }, { x: 0, z: -38, r: 18 },
            { x: 30, z: -30, r: 14 }, { x: -36, z: 10, r: 12 },
            { x: 36, z: 10, r: 12 }, { x: 0, z: 40, r: 16 }
        ]
        hills.forEach(({ x, z, r }) => {
            const hill = new THREE.Mesh(
                new THREE.SphereGeometry(r, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
                hillMaterial
            )
            hill.scale.y = 0.35
            hill.position.set(x, -0.5, z)
            this.add(hill)
        })
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

    // ── Present balloons drifting overhead ────────────────────────────
    setBalloons() {
        const balloonColors = ['#ff4d4d', '#4d94e8', '#f5b83d', '#7bc96f']

        for (let i = 0; i < 4; i++) {
            const balloon = new THREE.Group()

            const body = new THREE.Mesh(
                new THREE.SphereGeometry(0.7, 12, 12),
                new THREE.MeshStandardMaterial({ color: balloonColors[i], roughness: 0.4 })
            )
            body.scale.y = 1.15
            balloon.add(body)

            const string = new THREE.Mesh(
                new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4),
                new THREE.MeshBasicMaterial({ color: '#666666' })
            )
            string.position.y = -1.05
            balloon.add(string)

            const present = new THREE.Mesh(
                new THREE.BoxGeometry(0.45, 0.4, 0.45),
                new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 })
            )
            present.position.y = -1.95
            balloon.add(present)

            const ribbon = new THREE.Mesh(
                new THREE.BoxGeometry(0.48, 0.08, 0.12),
                new THREE.MeshStandardMaterial({ color: balloonColors[i], roughness: 0.6 })
            )
            ribbon.position.y = -1.95
            balloon.add(ribbon)

            balloon.position.set(
                (Math.random() - 0.5) * 30,
                10 + Math.random() * 6,
                (Math.random() - 0.5) * 30
            )
            balloon.userData.baseY = balloon.position.y
            balloon.userData.drift = Math.random() * Math.PI * 2
            balloon.userData.speed = 0.3 + Math.random() * 0.4

            this.add(balloon)
            this.balloons.push(balloon)
        }
    }

    // ── Villagers: one shared rounded outline, different ears/colors ──
    setVillagers() {
        const species = [
            { name: 'cat', earType: 'cone', color: '#f5b83d', belly: '#fff4e0' },
            { name: 'rabbit', earType: 'long', color: '#ffb3c7', belly: '#ffffff' },
            { name: 'bear', earType: 'round', color: '#a0683c', belly: '#e8d0b0' },
            { name: 'dog', earType: 'flop', color: '#e8e0d0', belly: '#ffffff' },
            { name: 'cat2', earType: 'cone', color: '#7bc96f', belly: '#fff4e0' }
        ]

        species.forEach((spec, index) => {
            const villager = this.createVillager(spec)
            const angle = (index / species.length) * Math.PI * 2
            villager.position.set(Math.cos(angle) * 8, 0, Math.sin(angle) * 8)

            villager.userData.walk = {
                target: null,
                speed: 0.9 + Math.random() * 0.5,
                pauseUntil: this.time.elapsed + Math.random() * 3000,
                hopPhase: Math.random() * Math.PI * 2
            }

            this.add(villager)
            this.villagers.push(villager)
        })
    }

    createVillager(spec) {
        const villager = new THREE.Group()
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.85 })
        const bellyMaterial = new THREE.MeshStandardMaterial({ color: spec.belly, roughness: 0.85 })

        // Egg-shaped body (the shared AC silhouette)
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), bodyMaterial)
        body.scale.set(1, 1.25, 0.95)
        body.position.y = 0.55
        body.castShadow = true
        villager.add(body)

        // Belly patch
        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), bellyMaterial)
        belly.scale.set(0.9, 1.1, 0.55)
        belly.position.set(0, 0.5, 0.22)
        villager.add(belly)

        // Big round head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 14), bodyMaterial)
        head.position.y = 1.35
        head.castShadow = true
        villager.add(head)

        // Ears by species — the only silhouette difference
        if (spec.earType === 'cone') {
            for (const side of [-1, 1]) {
                const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 8), bodyMaterial)
                ear.position.set(side * 0.26, 1.78, 0)
                ear.rotation.z = -side * 0.15
                villager.add(ear)
            }
        } else if (spec.earType === 'long') {
            for (const side of [-1, 1]) {
                const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bodyMaterial)
                ear.scale.set(0.7, 2.4, 0.7)
                ear.position.set(side * 0.2, 1.95, 0)
                ear.rotation.z = -side * 0.12
                villager.add(ear)
            }
        } else if (spec.earType === 'round') {
            for (const side of [-1, 1]) {
                const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), bodyMaterial)
                ear.position.set(side * 0.34, 1.72, 0)
                villager.add(ear)
            }
        } else { // flop ears
            for (const side of [-1, 1]) {
                const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), bodyMaterial)
                ear.scale.set(0.7, 1.8, 0.7)
                ear.position.set(side * 0.42, 1.5, 0)
                ear.rotation.z = side * 0.9
                villager.add(ear)
            }
        }

        // Eyes (plain dots — no highlight, per the AC "less information" rule)
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#2b2b2b' })
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMaterial)
            eye.position.set(side * 0.18, 1.38, 0.43)
            villager.add(eye)
        }

        // Nose / muzzle
        const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), bellyMaterial)
        muzzle.position.set(0, 1.26, 0.44)
        villager.add(muzzle)
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMaterial)
        nose.position.set(0, 1.3, 0.55)
        villager.add(nose)

        // Stubby arms
        for (const side of [-1, 1]) {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.35, 6), bodyMaterial)
            arm.position.set(side * 0.44, 0.62, 0.05)
            arm.rotation.z = side * 0.5
            villager.add(arm)
        }

        // Stubby feet
        for (const side of [-1, 1]) {
            const foot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), bodyMaterial)
            foot.scale.set(1, 0.6, 1.3)
            foot.position.set(side * 0.18, 0.07, 0.05)
            villager.add(foot)
        }

        return villager
    }

    // ── Per-frame animation ───────────────────────────────────────────
    update() {
        const delta = this.time.delta / 1000
        const now = this.time.elapsed

        // Clouds drift
        this.clouds.forEach((cloud) => {
            cloud.userData.angle += delta * cloud.userData.speed * 0.05
            cloud.position.x = Math.cos(cloud.userData.angle) * cloud.userData.radius
            cloud.position.z = Math.sin(cloud.userData.angle) * cloud.userData.radius
        })

        // Gentle tree sway
        this.trees.forEach((tree, i) => {
            tree.rotation.z = Math.sin(now * 0.001 + i) * 0.02
        })

        // Fountain droplets fall and recycle
        if (this.fountainDrops) {
            const positions = this.fountainDrops.geometry.attributes.position.array
            const speeds = this.fountainDrops.userData.speeds
            for (let i = 0; i < speeds.length; i++) {
                const i3 = i * 3
                positions[i3 + 1] -= speeds[i] * delta
                // Slight outward spread as they fall
                positions[i3] *= 1 + delta * 0.6
                positions[i3 + 2] *= 1 + delta * 0.6
                if (positions[i3 + 1] < 0.5) {
                    const angle = Math.random() * Math.PI * 2
                    const r = Math.random() * 0.15
                    positions[i3] = Math.cos(angle) * r
                    positions[i3 + 1] = 1.7
                    positions[i3 + 2] = Math.sin(angle) * r
                }
            }
            this.fountainDrops.geometry.attributes.position.needsUpdate = true
        }

        // Balloons bob and drift
        this.balloons.forEach((balloon) => {
            balloon.userData.drift += delta * 0.15
            balloon.position.y = balloon.userData.baseY + Math.sin(now * 0.001 * balloon.userData.speed + balloon.userData.drift) * 0.8
            balloon.position.x += Math.sin(now * 0.0003 + balloon.userData.drift) * delta * 0.5
        })

        // Villagers wander: walk → hesitate → pick a new spot
        this.villagers.forEach((villager) => {
            const walk = villager.userData.walk

            if (now < walk.pauseUntil) {
                // Idle: tiny breathing bounce
                villager.position.y = Math.abs(Math.sin(now * 0.002 + walk.hopPhase)) * 0.02
                return
            }

            if (!walk.target) {
                const angle = Math.random() * Math.PI * 2
                const radius = 3 + Math.random() * 7
                walk.target = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
            }

            const toTarget = walk.target.clone().sub(villager.position)
            toTarget.y = 0
            const distance = toTarget.length()

            if (distance < 0.2) {
                // Arrived — hesitate before the next decision (AC's "ma")
                walk.target = null
                walk.pauseUntil = now + 1500 + Math.random() * 4000
                villager.position.y = 0
                return
            }

            toTarget.normalize()
            villager.position.addScaledVector(toTarget, walk.speed * delta)

            // Face the walking direction
            const targetRotation = Math.atan2(toTarget.x, toTarget.z)
            villager.rotation.y += (targetRotation - villager.rotation.y) * Math.min(1, delta * 8)

            // Bouncy AC hop-walk
            walk.hopPhase += delta * 10
            villager.position.y = Math.abs(Math.sin(walk.hopPhase)) * 0.09
        })
    }
}
