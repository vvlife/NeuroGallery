import * as THREE from 'three'
import BaseScene from './BaseScene.js'
import { createVivy, VIVY_LINES } from '../Vivy.js'

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

        // Gameplay state
        this.apples = []
        this.appleHitSpheres = []
        this.fallingApples = []
        this.growingApples = []
        this.appleCount = 0
        this.flowers = []
        this.flowerHitSpheres = []
        this.flowerCount = 0
        this.growingFlowers = []
        this.fishCount = 0
        this.bellCount = 0          // 铃钱 — the AC currency
        this.butterflies = []
        this.butterflyHitSpheres = []
        this.butterflyCount = 0
        this.digSpots = []
        this.digHitSpheres = []
        this.treeHitCylinders = []
        this.shakingTrees = []
        this.balloonHitSpheres = []
        this.villagerHitSpheres = []
        this.activeBubble = null
        this.fishCount = 0
        this.pondWater = null
        this.fishingState = 'idle' // idle | waiting | biting
        this.fishingBobber = null
        this.caughtFishSprite = null
        this._fishingTimeout = null
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
        this.setClouds()
        this.setBalloons()
        this.setVillagers()      // animal NPCs wandering the plaza
        this.setVivy()           // Vivy, the island's special resident
        this.setButterflies()    // catchable butterflies near the flowers
        this.setDigSpots()       // glowing dig spots (fossils & bells)
        this.setupGameplay()     // apple picking + fishing

        // Third-person island mode: visible character + follow camera
        if (this.experience.world?.player) {
            this.experience.world.player.enter()
        }
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
        // Background is set by setSky() (HDRI) — nothing to do here
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
            color: '#a8e088',
            roughness: 0.9,
            metalness: 0.0
        })

        // Real grass texture (CC0, Poly Haven) tinted toward the AC palette
        const grassTexture = this.resources.items.acGrass
        if (grassTexture) {
            grassTexture.wrapS = THREE.RepeatWrapping
            grassTexture.wrapT = THREE.RepeatWrapping
            grassTexture.repeat.set(10, 10)
            grassTexture.colorSpace = THREE.SRGBColorSpace
            groundMaterial.map = grassTexture
        }

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
        // Real sky HDRI (CC0, Poly Haven) as the backdrop — no fake dome
        const skyTexture = this.resources.items.acSky
        if (skyTexture) {
            skyTexture.mapping = THREE.EquirectangularReflectionMapping
            this.scene.background = skyTexture
        } else {
            const skyGeometry = new THREE.SphereGeometry(90, 32, 32)
            const skyMaterial = new THREE.MeshBasicMaterial({
                color: '#87CEEB',
                side: THREE.BackSide,
                fog: false
            })
            this.add(new THREE.Mesh(skyGeometry, skyMaterial))
        }
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
                leg.position.set(side * 1.2, 1.2, 0.14)
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
            crossbar.position.set(0, 0.9, 0.12)
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
                    side: THREE.DoubleSide,
                    visible: false
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
            // Reachable trees (inside the ±11.5 walkable boundary)
            [-8, -7, 0], [8, -7, 1], [-10, 4, 2], [10, 4, 0],
            [-7, 11, 1], [7, 11, 2],
            // Backdrop trees (outside, for scenery)
            [-14, -12, 2], [14, -12, 1], [-17, -3, 0], [17, -3, 1],
            [-5, -16, 2], [5, -16, 0], [0, 18, 1], [-19, 10, 2],
            [19, 10, 0]
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

            // Fruit dots on the canopy (clickable for picking)
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
                fruit.userData.clickable = true
                fruit.userData.type = 'apple'
                fruit.userData.homePosition = fruit.position.clone()
                fruit.userData.parentTree = tree
                tree.add(fruit)
                this.apples.push(fruit)

                // Invisible fat hit-sphere so the tiny fruit is easy to tap
                const hitSphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.55, 6, 6),
                    new THREE.MeshBasicMaterial({ visible: false })
                )
                hitSphere.position.copy(fruit.position)
                hitSphere.userData.clickable = true
                hitSphere.userData.type = 'apple'
                hitSphere.userData.appleRef = fruit
                tree.add(hitSphere)
                this.appleHitSpheres.push(hitSphere)

                // Keep the hit-sphere glued to its fruit (falling animation)
                fruit.userData.hitSphere = hitSphere
            }

            tree.position.set(x, 0, z)
            tree.rotation.y = Math.random() * Math.PI * 2
            tree.userData.swayOffset = index
            tree.userData.shakeable = true
            tree.userData.shakeCooldownUntil = 0
            this.add(tree)
            this.trees.push(tree)

            // Invisible trunk cylinder for tree-shaking clicks
            const trunkHit = new THREE.Mesh(
                new THREE.CylinderGeometry(0.8, 0.8, 3.2, 6),
                new THREE.MeshBasicMaterial({ visible: false })
            )
            trunkHit.position.set(x, 1.6, z)
            trunkHit.userData.clickable = true
            trunkHit.userData.type = 'tree'
            trunkHit.userData.treeRef = tree
            this.add(trunkHit)
            this.treeHitCylinders.push(trunkHit)
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

            flower.userData.clickable = true
            flower.userData.type = 'flower'
            this.add(flower)
            this.flowers.push(flower)

            // Invisible fat hit-sphere so the tiny flower is easy to tap
            const hitSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.55, 6, 6),
                new THREE.MeshBasicMaterial({ visible: false })
            )
            hitSphere.position.set(flower.position.x, 0.4, flower.position.z)
            hitSphere.userData.clickable = true
            hitSphere.userData.type = 'flower'
            hitSphere.userData.flowerRef = flower
            this.add(hitSphere)
            this.flowerHitSpheres.push(hitSphere)
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
            new THREE.CircleGeometry(2.8, 24),
            new THREE.MeshStandardMaterial({
                color: '#5fbef5',
                roughness: 0.15,
                transparent: true,
                opacity: 0.9
            })
        )
        water.rotation.x = -Math.PI * 0.5
        water.position.y = 0.02
        water.userData.clickable = true
        water.userData.type = 'pond'
        pondGroup.add(water)
        this.pondWater = water

        // Sandy rim
        const rim = new THREE.Mesh(
            new THREE.RingGeometry(2.8, 3.4, 24),
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
            pad.position.set(Math.cos(angle) * 1.4, 0.03, Math.sin(angle) * 1.4)
            pondGroup.add(pad)
        }

        // Inside the player's walkable area (boundaries are ±11.5)
        pondGroup.position.set(-8.5, 0, -7)
        this.add(pondGroup)
    }

    // ── Rolling hills removed: the HDRI sky already carries a horizon ──

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
            balloon.userData.clickable = true
            balloon.userData.type = 'balloon'

            // Invisible hit-sphere covering balloon + present
            const hitSphere = new THREE.Mesh(
                new THREE.SphereGeometry(1.3, 6, 6),
                new THREE.MeshBasicMaterial({ visible: false })
            )
            hitSphere.position.y = -0.9
            hitSphere.userData.clickable = true
            hitSphere.userData.type = 'balloon'
            hitSphere.userData.balloonRef = balloon
            balloon.add(hitSphere)
            this.balloonHitSpheres.push(hitSphere)

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
            villager.userData.species = spec.name
            villager.userData.clickable = true
            villager.userData.type = 'villager'

            // Invisible hit-sphere for tap-to-talk
            const hitSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.8, 6, 6),
                new THREE.MeshBasicMaterial({ visible: false })
            )
            hitSphere.position.y = 1.0
            hitSphere.userData.clickable = true
            hitSphere.userData.type = 'villager'
            hitSphere.userData.villagerRef = villager
            villager.add(hitSphere)
            this.villagerHitSpheres.push(hitSphere)

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

        // Stubby feet (kept for the walking animation)
        const feet = []
        for (const side of [-1, 1]) {
            const foot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), bodyMaterial)
            foot.scale.set(1, 0.6, 1.3)
            foot.position.set(side * 0.18, 0.07, 0.05)
            villager.add(foot)
            feet.push(foot)
        }
        villager.userData.feet = feet

        return villager
    }

    // ── Obstacles for the third-person player collision ──────────────
    getObstacles() {
        const obstacles = [
            { x: 0, z: 0, r: 2.0 },        // fountain
            { x: 4.5, z: 2.5, r: 0.9 },    // notice board
            { x: -8.5, z: -7, r: 3.1 },    // pond
        ]
        // Artwork stands around the plaza
        const stands = [
            [-6, -6], [0, -8], [6, -6],
            [-6, 6], [0, 8], [6, 6]
        ]
        stands.forEach(([x, z]) => obstacles.push({ x, z, r: 1.1 }))
        // Fruit trees
        this.trees.forEach(tree => {
            obstacles.push({ x: tree.position.x, z: tree.position.z, r: 0.55 })
        })
        // Houses
        const houses = [
            [-14, -16], [0, -19], [14, -16], [-20, 6], [20, 6]
        ]
        houses.forEach(([x, z]) => obstacles.push({ x, z, r: 2.6 }))
        return obstacles
    }

    // ── Gameplay: apple picking & fishing ─────────────────────────────
    setupGameplay() {
        // Show the collect HUD while this scene is active
        const hud = document.getElementById('collectHud')
        if (hud) hud.classList.add('visible')
        this.updateCollectHUD()

        // Show the guide card once per session
        if (!this._guideShown) {
            const guide = document.getElementById('acGuide')
            if (guide) {
                guide.classList.add('visible')
                const close = document.getElementById('acGuideClose')
                if (close && !close._bound) {
                    close._bound = true
                    close.addEventListener('click', () => {
                        guide.classList.remove('visible')
                    })
                }
            }
            this._guideShown = true
        }

        this._guideCheckTimer = 0
    }

    // Contextual hint near trees / pond / flowers
    updateActionGuide(delta) {
        this._guideCheckTimer = (this._guideCheckTimer || 0) - delta
        if (this._guideCheckTimer > 0) return
        this._guideCheckTimer = 0.3

        const el = document.getElementById('actionGuide')
        const textEl = document.getElementById('actionGuideText')
        if (!el || !textEl) return

        const camPos = this.experience.world?.getInteractionPosition?.() || this.experience.camera?.instance?.position
        if (!camPos) return

        let hint = null
        const tmp = new THREE.Vector3()

        // Pond (fishing)
        if (this.pondWater) {
            this.pondWater.getWorldPosition(tmp)
            const d = Math.hypot(camPos.x - tmp.x, camPos.z - tmp.z)
            if (d < 4.5) hint = '🎣 点击水面，开始钓鱼'
        }

        // Fruit trees (apple picking)
        if (!hint) {
            for (const sphere of this.appleHitSpheres) {
                if (!sphere.visible) continue
                const fruit = sphere.userData.appleRef
                if (!fruit || fruit.userData.picked || fruit.userData.falling) continue
                sphere.getWorldPosition(tmp)
                const d = camPos.distanceTo(tmp)
                if (d < 3.5) {
                    hint = '🍎 点击树上的果子，把它摘下来'
                    break
                }
            }
        }

        // Vivy nearby
        if (!hint && this.vivy) {
            this.vivy.getWorldPosition(tmp)
            const d = camPos.distanceTo(tmp)
            if (d < 3.5) {
                hint = '💬 点击 Vivy，和她聊聊'
            }
        }

        // Flowers
        if (!hint) {
            for (const flower of this.flowers) {
                if (!flower.visible || flower.userData.picked) continue
                tmp.set(flower.position.x, 0.4, flower.position.z)
                const d = Math.hypot(camPos.x - tmp.x, camPos.z - tmp.z)
                if (d < 2.0) {
                    hint = '🌸 点击这朵花，摘下来'
                    break
                }
            }
        }

        if (hint) {
            if (this._currentGuide !== hint) {
                textEl.textContent = hint
                this._currentGuide = hint
            }
            el.classList.add('visible')
        } else {
            el.classList.remove('visible')
            this._currentGuide = null
        }
    }

    updateCollectHUD() {
        const appleEl = document.getElementById('appleCount')
        const fishEl = document.getElementById('fishCount')
        const flowerEl = document.getElementById('flowerCount')
        const bellEl = document.getElementById('bellCount')
        if (appleEl) appleEl.textContent = this.appleCount
        if (fishEl) fishEl.textContent = this.fishCount
        if (flowerEl) flowerEl.textContent = this.flowerCount
        if (bellEl) bellEl.textContent = this.bellCount
    }

    showGameplayToast(text) {
        const el = document.getElementById('gameplayToast')
        if (!el) return
        el.textContent = text
        el.classList.add('visible')
        clearTimeout(this._toastTimer)
        this._toastTimer = setTimeout(() => el.classList.remove('visible'), 2500)
    }

    pickApple(apple) {
        if (!apple || apple.userData.picked || apple.userData.falling) return
        apple.userData.falling = true
        apple.userData.fallVelocity = 0
        apple.userData.bounces = 0
        this.fallingApples.push(apple)
    }

    onPondClick(point) {
        if (this.fishingState === 'idle') {
            this.startFishing(point)
        } else if (this.fishingState === 'biting') {
            this.reelIn()
        }
        // While waiting, clicking does nothing — patience, like real fishing
    }

    startFishing(point) {
        this.fishingState = 'waiting'

        // Bobber at the clicked spot
        if (!this.fishingBobber) {
            this.fishingBobber = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 10, 10),
                new THREE.MeshStandardMaterial({ color: '#ff4d4d', roughness: 0.4 })
            )
            this.add(this.fishingBobber)
        }
        this.fishingBobber.visible = true
        this.fishingBobber.position.set(point.x, 0.12, point.z)

        this.showGameplayToast('🎣 等待鱼儿上钩…')

        this._fishingTimeout = setTimeout(() => {
            if (this.fishingState !== 'waiting') return
            this.fishingState = 'biting'
            this.showGameplayToast('❗ 有鱼咬钩了！快点击水面收杆！')

            // Fish escapes if you are too slow
            this._fishingTimeout = setTimeout(() => {
                if (this.fishingState === 'biting') {
                    this.fishingState = 'idle'
                    if (this.fishingBobber) this.fishingBobber.visible = false
                    this.showGameplayToast('💨 鱼跑掉了…再试一次')
                }
            }, 5000)
        }, 2000 + Math.random() * 3000)
    }

    reelIn() {
        clearTimeout(this._fishingTimeout)
        this.fishingState = 'idle'
        if (this.fishingBobber) this.fishingBobber.visible = false

        // Random catch — mostly fish, sometimes junk, like AC
        const roll = Math.random()
        let emoji, name
        if (roll < 0.55) { emoji = '🐟'; name = '鲈鱼' }
        else if (roll < 0.8) { emoji = '🐠'; name = '热带鱼' }
        else if (roll < 0.95) { emoji = '🐡'; name = '河豚' }
        else { emoji = '👢'; name = '旧靴子' }

        this.fishCount++
        this.updateCollectHUD()
        this.showGameplayToast(`${emoji} 钓到了一条${name}！`)
        this.showCaughtFish(emoji)
    }

    showCaughtFish(emoji) {
        // Draw the emoji onto a canvas and float it as a sprite
        const canvas = document.createElement('canvas')
        canvas.width = 128
        canvas.height = 128
        const ctx = canvas.getContext('2d')
        ctx.font = '96px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(emoji, 64, 72)

        const texture = new THREE.CanvasTexture(canvas)
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
        const sprite = new THREE.Sprite(material)
        sprite.scale.set(1.2, 1.2, 1)

        const pondPos = new THREE.Vector3(-8.5, 0, -7)
        sprite.position.set(pondPos.x, 1.2, pondPos.z)
        sprite.userData.bornAt = this.time.elapsed
        this.add(sprite)
        this.caughtFishSprite = sprite
    }

    respawnApple(apple) {
        // A new fruit grows back on the same tree after a while
        setTimeout(() => {
            apple.userData.picked = false
            apple.position.copy(apple.userData.homePosition)
            apple.scale.setScalar(0.01)
            apple.visible = true
            if (apple.userData.hitSphere) {
                apple.userData.hitSphere.position.copy(apple.userData.homePosition)
                apple.userData.hitSphere.visible = true
            }
            this.growingApples.push(apple)
        }, 8000 + Math.random() * 7000)
    }

    pickFlower(flower) {
        if (!flower || flower.userData.picked) return
        flower.userData.picked = true
        flower.visible = false

        this.flowerCount++
        this.updateCollectHUD()
        this.showGameplayToast(`🌸 摘到一朵花！(${this.flowerCount})`)
        this.respawnFlower(flower)
    }

    respawnFlower(flower) {
        setTimeout(() => {
            flower.userData.picked = false
            flower.scale.setScalar(0.01)
            flower.visible = true
            // Pop back up with a quick grow animation handled in update()
            this.growingFlowers.push(flower)
        }, 12000 + Math.random() * 8000)
    }

    destroy() {
        // Leave third-person island mode, back to first-person
        if (this.experience.world?.player) {
            this.experience.world.player.exit()
        }

        const hud = document.getElementById('collectHud')
        if (hud) hud.classList.remove('visible')
        const toast = document.getElementById('gameplayToast')
        if (toast) toast.classList.remove('visible')
        const guide = document.getElementById('acGuide')
        if (guide) guide.classList.remove('visible')
        const actionGuide = document.getElementById('actionGuide')
        if (actionGuide) actionGuide.classList.remove('visible')
        clearTimeout(this._fishingTimeout)
        clearTimeout(this._toastTimer)
        super.destroy()
    }

    // ── Butterflies: catchable bugs fluttering over the flowers ──────
    setButterflies() {
        const wingColors = ['#ffd94d', '#ff8cb3', '#8cd9ff', '#c9a5ff', '#ffb24d', '#a5ffc9']

        for (let i = 0; i < 6; i++) {
            const butterfly = new THREE.Group()
            const color = wingColors[i % wingColors.length]

            const body = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.03, 0.12, 4, 6),
                new THREE.MeshStandardMaterial({ color: '#3b2d20', roughness: 0.8 })
            )
            butterfly.add(body)

            const wingMaterial = new THREE.MeshStandardMaterial({
                color,
                roughness: 0.6,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.95
            })
            const wingGeo = new THREE.CircleGeometry(0.16, 8, 0, Math.PI)
            const wingL = new THREE.Mesh(wingGeo, wingMaterial)
            wingL.position.set(-0.03, 0.02, 0)
            const wingR = new THREE.Mesh(wingGeo, wingMaterial)
            wingR.position.set(0.03, 0.02, 0)
            wingR.rotation.y = Math.PI
            butterfly.add(wingL)
            butterfly.add(wingR)
            butterfly.userData.wings = [wingL, wingR]

            const angle = Math.random() * Math.PI * 2
            const radius = 5 + Math.random() * 6
            butterfly.position.set(Math.cos(angle) * radius, 1.2 + Math.random() * 1.2, Math.sin(angle) * radius)
            butterfly.userData.fly = {
                angle: Math.random() * Math.PI * 2,
                radius: 4 + Math.random() * 7,
                height: butterfly.position.y,
                speed: 0.25 + Math.random() * 0.3,
                wobble: Math.random() * Math.PI * 2
            }
            butterfly.userData.clickable = true
            butterfly.userData.type = 'butterfly'

            const hitSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 6, 6),
                new THREE.MeshBasicMaterial({ visible: false })
            )
            hitSphere.userData.clickable = true
            hitSphere.userData.type = 'butterfly'
            hitSphere.userData.butterflyRef = butterfly
            butterfly.add(hitSphere)
            this.butterflyHitSpheres.push(hitSphere)

            this.add(butterfly)
            this.butterflies.push(butterfly)
        }
    }

    catchButterfly(butterfly) {
        if (!butterfly || butterfly.userData.caught) return
        butterfly.userData.caught = true
        butterfly.visible = false

        this.butterflyCount++
        this.addBells(100)
        this.showGameplayToast(`🦋 抓到了一只蝴蝶！(${this.butterflyCount}) 💰+100`)

        setTimeout(() => {
            butterfly.userData.caught = false
            butterfly.visible = true
        }, 12000 + Math.random() * 8000)
    }

    // ── Dig spots: glowing star marks hiding fossils and bells ───────
    setDigSpots() {
        const starTexture = this.makeStarTexture()

        const spots = [
            [5, -10], [-4, 10], [9, 9], [-10, -3]
        ]

        spots.forEach(([x, z]) => {
            const spot = new THREE.Group()

            const star = new THREE.Mesh(
                new THREE.PlaneGeometry(0.6, 0.6),
                new THREE.MeshBasicMaterial({
                    map: starTexture,
                    transparent: true,
                    depthWrite: false
                })
            )
            star.rotation.x = -Math.PI * 0.5
            star.position.y = 0.03
            spot.add(star)
            spot.userData.star = star

            spot.position.set(x, 0, z)
            spot.userData.clickable = true
            spot.userData.type = 'digSpot'
            spot.userData.dug = false

            const hitSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.7, 6, 6),
                new THREE.MeshBasicMaterial({ visible: false })
            )
            hitSphere.position.y = 0.2
            hitSphere.userData.clickable = true
            hitSphere.userData.type = 'digSpot'
            hitSphere.userData.spotRef = spot
            spot.add(hitSphere)
            this.digHitSpheres.push(hitSphere)

            this.add(spot)
            this.digSpots.push(spot)
        })
    }

    makeStarTexture() {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const ctx = canvas.getContext('2d')
        ctx.translate(32, 32)
        ctx.beginPath()
        for (let i = 0; i < 4; i++) {
            ctx.moveTo(0, -26)
            ctx.quadraticCurveTo(4, -4, 26, 0)
            ctx.quadraticCurveTo(4, 4, 0, 26)
            ctx.quadraticCurveTo(-4, 4, -26, 0)
            ctx.quadraticCurveTo(-4, -4, 0, -26)
        }
        ctx.fillStyle = '#fff3b0'
        ctx.shadowColor = '#ffdf4d'
        ctx.shadowBlur = 10
        ctx.fill()
        const texture = new THREE.CanvasTexture(canvas)
        return texture
    }

    digAtSpot(spot) {
        if (!spot || spot.userData.dug) return
        spot.userData.dug = true
        spot.userData.star.visible = false

        const roll = Math.random()
        let toast
        if (roll < 0.4) {
            this.addBells(200)
            toast = '🦴 挖到了一块化石！💰+200'
        } else if (roll < 0.8) {
            this.addBells(300)
            toast = '💰 挖到了一袋铃钱！💰+300'
        } else {
            this.addBells(500)
            toast = '✨ 挖到了稀有矿石！💰+500'
        }
        this.showGameplayToast(toast)

        setTimeout(() => {
            spot.userData.dug = false
            spot.userData.star.visible = true
        }, 30000)
    }

    // ── Tree shaking: bells, bonus fruit, or a wasp nest ─────────────
    shakeTree(tree) {
        if (!tree || !tree.userData.shakeable) return
        const now = this.time.elapsed
        if (now < tree.userData.shakeCooldownUntil) {
            this.showGameplayToast('🌳 这棵树刚摇过，歇一会儿吧')
            return
        }
        tree.userData.shakeCooldownUntil = now + 12000

        // Shake animation state consumed by update()
        this.shakingTrees.push({ tree, until: now + 600 })

        const roll = Math.random()
        if (roll < 0.55) {
            const bells = 100 + Math.floor(Math.random() * 5) * 100
            this.addBells(bells)
            this.showGameplayToast(`💰 掉下来一袋铃钱！💰+${bells}`)
        } else if (roll < 0.8) {
            // Knock a fruit loose for free
            const fruit = this.apples.find(a => a.userData.parentTree === tree && a.visible && !a.userData.picked && !a.userData.falling)
            if (fruit) {
                this.pickApple(fruit)
            } else {
                this.addBells(100)
                this.showGameplayToast('💰 掉下来一袋铃钱！💰+100')
            }
        } else {
            this.showGameplayToast('🐝 不好，摇下了马蜂窝！被蛰了一下！')
            this.stingFlash()
        }
    }

    stingFlash() {
        const flash = document.createElement('div')
        flash.style.cssText = `
            position: fixed; inset: 0; z-index: 1100; pointer-events: none;
            background: radial-gradient(ellipse at center, transparent 40%, rgba(255,60,40,0.45) 100%);
            opacity: 0; transition: opacity 0.25s ease;
        `
        document.body.appendChild(flash)
        requestAnimationFrame(() => { flash.style.opacity = '1' })
        setTimeout(() => {
            flash.style.opacity = '0'
            setTimeout(() => flash.remove(), 400)
        }, 700)
    }

    // ── Balloon popping: shoot down the present ───────────────────────
    popBalloon(balloon) {
        if (!balloon || balloon.userData.popped) return
        balloon.userData.popped = true
        balloon.visible = false

        const roll = Math.random()
        let toast
        if (roll < 0.5) {
            const bells = 200 + Math.floor(Math.random() * 4) * 100
            this.addBells(bells)
            toast = `🎈 礼物掉下来了！是 💰+${bells} 铃钱！`
        } else if (roll < 0.8) {
            this.butterflyCount++
            toast = '🎈 礼物里是一本《昆虫图鉴》！🦋+1'
        } else {
            this.addBells(800)
            toast = '🎈 礼物里竟然有金矿石！💰+800'
        }
        this.showGameplayToast(toast)

        setTimeout(() => {
            balloon.userData.popped = false
            balloon.visible = true
        }, 20000)
    }

    // ── Villager chat: tap to hear what they say ──────────────────────
    talkToVillager(villager) {
        if (!villager) return

        const lines = [
            '今天也是看展的好天气呢！',
            '听说广场的画是 AI 画的，好厉害！',
            '你钓到过旧靴子吗？我钓到过三次……',
            '树上的果子甜得很，摘一个尝尝吧',
            '池塘里的鱼最近可机灵了',
            '气球上的礼物，用弹弓才能打下来哦',
            '我在练习瑜伽，一、二、一、二……',
            '下次一起看星星吧！',
            '这件展品我最喜欢了！'
        ]
        const line = lines[Math.floor(Math.random() * lines.length)]

        // Villager pauses and faces the player while talking
        const camPos = this.experience.camera?.instance?.position
        if (camPos) {
            villager.lookAt(camPos.x, 0, camPos.z)
        }
        villager.userData.walk.pauseUntil = this.time.elapsed + 3000

        this.showSpeechBubble(villager, line)
        this.showGameplayToast(`💬 ${line}`)
    }

    showSpeechBubble(villager, text) {
        if (this.activeBubble) {
            this.activeBubble.parent?.remove(this.activeBubble)
            this.activeBubble.material.map.dispose()
            this.activeBubble.material.dispose()
            this.activeBubble = null
        }

        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 192
        const ctx = canvas.getContext('2d')
        const r = 36
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.beginPath()
        ctx.roundRect(8, 8, 496, 128, r)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(226, 134)
        ctx.lineTo(256, 180)
        ctx.lineTo(286, 134)
        ctx.fill()
        ctx.fillStyle = '#4a3b2a'
        ctx.font = '34px "Helvetica Neue", Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, 256, 72, 460)

        const texture = new THREE.CanvasTexture(canvas)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
        sprite.scale.set(2.6, 1.0, 1)
        sprite.position.set(0, 2.6, 0)
        sprite.renderOrder = 999
        villager.add(sprite)

        this.activeBubble = sprite
        setTimeout(() => {
            if (this.activeBubble === sprite) {
                villager.remove(sprite)
                sprite.material.map.dispose()
                sprite.material.dispose()
                this.activeBubble = null
            }
        }, 3000)
    }

    addBells(amount) {
        this.bellCount += amount
        this.updateCollectHUD()
    }

    // ── Vivy: the island's special resident ──────────────────────────
    setVivy() {
        this.vivy = createVivy()
        this.vivy.position.set(3, 0, -4)

        this.vivy.userData.walk = {
            target: null,
            speed: 0.55,
            pauseUntil: this.time.elapsed + 2000,
            hopPhase: 0,
            homeRadius: 6
        }
        this.vivy.userData.clickable = true
        this.vivy.userData.type = 'vivy'

        const hitSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.9, 6, 6),
            new THREE.MeshBasicMaterial({ visible: false })
        )
        hitSphere.position.y = 1.0
        hitSphere.userData.clickable = true
        hitSphere.userData.type = 'vivy'
        hitSphere.userData.vivyRef = this.vivy
        this.vivy.add(hitSphere)
        this.vivyHitSphere = hitSphere

        this.add(this.vivy)
    }

    talkToVivy() {
        if (!this.vivy) return

        const line = VIVY_LINES[Math.floor(Math.random() * VIVY_LINES.length)]

        // Vivy pauses and faces the player while speaking
        const playerPos = this.experience.world?.getInteractionPosition?.()
        if (playerPos) {
            this.vivy.lookAt(playerPos.x, 0, playerPos.z)
        }
        this.vivy.userData.walk.pauseUntil = this.time.elapsed + 4000

        this.showSpeechBubble(this.vivy, line)
        this.showGameplayToast(`🎤 Vivy：${line}`)

        // Notify quest system if present
        this.experience.world?.quests?.onTalkToVivy?.()
    }

    // ── Per-frame animation ───────────────────────────────────────────
    update() {
        const delta = this.time.delta / 1000
        const now = this.time.elapsed

        this.updateActionGuide(delta)

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

        // Balloons bob and drift (skip popped ones)
        this.balloons.forEach((balloon) => {
            if (balloon.userData.popped) return
            balloon.userData.drift += delta * 0.15
            balloon.position.y = balloon.userData.baseY + Math.sin(now * 0.001 * balloon.userData.speed + balloon.userData.drift) * 0.8
            balloon.position.x += Math.sin(now * 0.0003 + balloon.userData.drift) * delta * 0.5
        })

        // Butterflies flutter in loops, wings flapping
        this.butterflies.forEach((butterfly) => {
            if (butterfly.userData.caught) return
            const fly = butterfly.userData.fly
            fly.angle += delta * fly.speed
            fly.wobble += delta * 3
            butterfly.position.x = Math.cos(fly.angle) * fly.radius
            butterfly.position.z = Math.sin(fly.angle) * fly.radius
            butterfly.position.y = fly.height + Math.sin(fly.wobble) * 0.3
            butterfly.rotation.y = -fly.angle

            const flap = Math.sin(now * 0.02 + fly.wobble) * 0.9
            const [wingL, wingR] = butterfly.userData.wings
            wingL.rotation.y = flap
            wingR.rotation.y = Math.PI - flap
        })

        // Shaking trees wobble hard for a moment
        for (let i = this.shakingTrees.length - 1; i >= 0; i--) {
            const { tree, until } = this.shakingTrees[i]
            if (now > until) {
                tree.rotation.x = 0
                this.shakingTrees.splice(i, 1)
            } else {
                tree.rotation.x = Math.sin(now * 0.08) * 0.06
            }
        }

        // Dig spot stars twinkle
        this.digSpots.forEach((spot, i) => {
            const star = spot.userData.star
            if (!star.visible) return
            const s = 0.9 + Math.sin(now * 0.004 + i * 1.7) * 0.15
            star.scale.setScalar(s)
            star.rotation.z = now * 0.0008 + i
        })

        // Villagers wander: walk → hesitate → pick a new spot
        this.villagers.forEach((villager) => {
            const walk = villager.userData.walk
            const feet = villager.userData.feet

            if (now < walk.pauseUntil) {
                // Idle: subtle breathing sway, feet planted
                villager.rotation.z = Math.sin(now * 0.0015 + walk.hopPhase) * 0.015
                if (feet) {
                    feet[0].position.z = 0.05
                    feet[1].position.z = 0.05
                }
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
                villager.rotation.z = 0
                if (feet) {
                    feet[0].position.z = 0.05
                    feet[1].position.z = 0.05
                }
                return
            }

            toTarget.normalize()
            villager.position.addScaledVector(toTarget, walk.speed * delta)

            // Face the walking direction
            const targetRotation = Math.atan2(toTarget.x, toTarget.z)
            villager.rotation.y += (targetRotation - villager.rotation.y) * Math.min(1, delta * 8)

            // Walk (not hop): gentle body bob + sway, feet stepping alternately
            walk.hopPhase += delta * 9
            villager.position.y = Math.abs(Math.sin(walk.hopPhase)) * 0.025
            villager.rotation.z = Math.sin(walk.hopPhase) * 0.04
            if (feet) {
                feet[0].position.z = 0.05 + Math.sin(walk.hopPhase) * 0.14
                feet[1].position.z = 0.05 - Math.sin(walk.hopPhase) * 0.14
            }
        })

        // Falling apples: gravity, two bounces, then collected
        for (let i = this.fallingApples.length - 1; i >= 0; i--) {
            const apple = this.fallingApples[i]
            apple.userData.fallVelocity -= 9.8 * delta
            apple.position.y += apple.userData.fallVelocity * delta

            // Hit-sphere follows the fruit while it drops
            if (apple.userData.hitSphere) {
                apple.userData.hitSphere.position.copy(apple.position)
            }

            const groundY = 0.14
            if (apple.position.y <= groundY) {
                apple.position.y = groundY
                if (apple.userData.bounces < 2) {
                    apple.userData.fallVelocity = -apple.userData.fallVelocity * 0.35
                    apple.userData.bounces++
                } else {
                    // Collected!
                    apple.userData.falling = false
                    apple.userData.picked = true
                    apple.visible = false
                    if (apple.userData.hitSphere) {
                        apple.userData.hitSphere.visible = false
                    }
                    this.fallingApples.splice(i, 1)
                    this.appleCount++
                    this.updateCollectHUD()
                    this.showGameplayToast(`🍎 摘到一个水果！(${this.appleCount})`)
                    this.respawnApple(apple)
                }
            }
        }

        // Regrowing apples: scale back in over a second
        for (let i = this.growingApples.length - 1; i >= 0; i--) {
            const apple = this.growingApples[i]
            apple.scale.setScalar(Math.min(1, apple.scale.x + delta * 1.2))
            if (apple.scale.x >= 1) {
                this.growingApples.splice(i, 1)
            }
        }

        // Regrowing flowers
        for (let i = this.growingFlowers.length - 1; i >= 0; i--) {
            const flower = this.growingFlowers[i]
            flower.scale.setScalar(Math.min(1, flower.scale.x + delta * 1.5))
            if (flower.scale.x >= 1) {
                this.growingFlowers.splice(i, 1)
            }
        }

        // Vivy strolls gently near the plaza, hair swaying
        if (this.vivy) {
            const walk = this.vivy.userData.walk

            if (now < walk.pauseUntil) {
                // Idle: gentle breathing, hair sway
                this.vivy.position.y = Math.sin(now * 0.0012) * 0.015
            } else {
                if (!walk.target) {
                    const angle = Math.random() * Math.PI * 2
                    const radius = 2 + Math.random() * walk.homeRadius
                    walk.target = new THREE.Vector3(
                        3 + Math.cos(angle) * radius * 0.6,
                        0,
                        -4 + Math.sin(angle) * radius * 0.6
                    )
                }

                const toTarget = walk.target.clone().sub(this.vivy.position)
                toTarget.y = 0
                const distance = toTarget.length()

                if (distance < 0.15) {
                    walk.target = null
                    walk.pauseUntil = now + 3000 + Math.random() * 5000
                } else {
                    toTarget.normalize()
                    this.vivy.position.addScaledVector(toTarget, walk.speed * delta)

                    const targetRotation = Math.atan2(toTarget.x, toTarget.z)
                    let diff = targetRotation - this.vivy.rotation.y
                    while (diff > Math.PI) diff -= Math.PI * 2
                    while (diff < -Math.PI) diff += Math.PI * 2
                    this.vivy.rotation.y += diff * Math.min(1, delta * 6)

                    // Graceful glide: tiny bob, arms sway softly
                    walk.hopPhase += delta * 5
                    this.vivy.position.y = Math.abs(Math.sin(walk.hopPhase)) * 0.02
                    const arms = this.vivy.userData.arms
                    if (arms) {
                        arms[0].rotation.x = Math.sin(walk.hopPhase) * 0.2
                        arms[1].rotation.x = -Math.sin(walk.hopPhase) * 0.2
                    }
                }
            }
        }

        // Fishing bobber: gentle bob; ducks under while biting
        if (this.fishingBobber && this.fishingBobber.visible) {
            if (this.fishingState === 'biting') {
                this.fishingBobber.position.y = 0.02 + Math.sin(now * 0.02) * 0.03
            } else {
                this.fishingBobber.position.y = 0.12 + Math.sin(now * 0.003) * 0.04
            }
        }

        // Caught-fish sprite: floats up, then disappears
        if (this.caughtFishSprite) {
            const age = now - this.caughtFishSprite.userData.bornAt
            this.caughtFishSprite.position.y = 1.2 + age * 0.004
            if (age > 2000) {
                this.group.remove(this.caughtFishSprite)
                this.caughtFishSprite.material.map.dispose()
                this.caughtFishSprite.material.dispose()
                this.caughtFishSprite = null
            }
        }
    }
}
