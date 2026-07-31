import * as THREE from 'three'
import BaseScene from './BaseScene.js'
import { createVivy, VIVY_LINES } from '../Vivy.js'
import { RECIPES, createFurnitureModel, savePlacements, loadPlacements } from '../Furniture.js'

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

        // New coastal zones (cabin pier / swing / dock)
        this.miscHitSpheres = []
        this.swing = null              // { group, seat, boost, sitting }
        this.boat = null               // { group, riding, t, from, path }
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
        this.setGroundItems()    // scattered wood / stone / shells
        this.setDIYBench()       // furniture crafting bench
        this.setShop()           // Nook's stall
        this.setSeaAndCliffs()   // ocean around the island + edge cliffs
        this.setEastCabin()      // beach cabin + wooden pier (east)
        this.setWestSwing()      // cherry-tree swing + ice-cream cart + flower field (west)
        this.setSouthDock()      // vending machine + ferry shelter + water bus (south)
        this.restorePlacedFurniture()
        this.setDayNight()       // day/night cycle
        this.setSeasons()        // spring/winter switch
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
        // Sandy zones need flat ground — damp the grass waves to zero there.
        // Plane +y maps to world −z after the rotation below.
        const flatZones = [[22, 0, 8], [-21.5, 1, 8], [3, 23, 8]]
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i)
            const y = positions.getY(i)
            let wave = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.15
            for (const [cx, cz, r] of flatZones) {
                const dist = Math.hypot(x - cx, y + cz)
                if (dist < r) {
                    const blend = Math.min(1, Math.max(0, (dist - (r - 2.5)) / 2.5))
                    wave *= blend
                }
            }
            positions.setZ(i, wave)
        }
        groundGeometry.computeVertexNormals()

        const ground = new THREE.Mesh(groundGeometry, groundMaterial)
        ground.rotation.x = -Math.PI * 0.5
        ground.receiveShadow = true
        this.add(ground)
        this.groundMesh = ground
        this.groundMaterial = groundMaterial

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
        this.leafMaterial = leafMaterial
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
        const colors = ['#ff6b9d', '#c9665cdff', '#4dc9ff', '#ffdf4d', '#ff8c42', '#ffffff']

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

        // Fur texture (CC0, Poly Haven) as bump + roughness so each species
        // keeps its color but gains a plush surface instead of flat plastic.
        const furTex = this.resources.items.acFur || null
        if (furTex) {
            furTex.wrapS = THREE.RepeatWrapping
            furTex.wrapT = THREE.RepeatWrapping
            furTex.repeat.set(2, 2)
        }
        const furMaps = furTex ? { bumpMap: furTex, bumpScale: 0.6, roughnessMap: furTex } : {}

        const bodyMaterial = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.95, ...furMaps })
        const bellyMaterial = new THREE.MeshStandardMaterial({ color: spec.belly, roughness: 0.95, ...furMaps })

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
        // Coastal zone structures
        obstacles.push(
            { x: 24.5, z: -1, r: 2.5 },    // beach cabin
            { x: -23, z: -1, r: 0.9 },     // swing cherry tree
            { x: -17.5, z: 4, r: 1.2 },    // ice-cream cart
            { x: 1.5, z: 23.5, r: 0.9 },   // vending machine
            { x: 5.4, z: 26.3, r: 1.1 },   // ferry shelter
        )
        return obstacles
    }

    // ── Ground items: wood / stone / shells scattered for crafting ───
    setGroundItems() {
        this.groundItems = []
        this.groundHitSpheres = []

        const defs = [
            { type: 'wood', icon: '🪵', count: 6, make: () => {
                const m = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.05, 0.06, 0.5, 6),
                    new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.9 })
                )
                m.rotation.z = Math.PI / 2
                m.rotation.y = Math.random() * Math.PI
                m.position.y = 0.06
                return m
            }},
            { type: 'stone', icon: '🪨', count: 5, make: () => {
                const m = new THREE.Mesh(
                    new THREE.DodecahedronGeometry(0.14, 0),
                    new THREE.MeshStandardMaterial({ color: '#9a9a9a', roughness: 0.95 })
                )
                m.position.y = 0.12
                return m
            }},
            { type: 'shell', icon: '🐚', count: 4, make: () => {
                const m = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI),
                    new THREE.MeshStandardMaterial({ color: '#fff0e0', roughness: 0.6 })
                )
                m.rotation.x = -Math.PI * 0.4
                m.position.y = 0.05
                return m
            }}
        ]

        defs.forEach((def) => {
            for (let i = 0; i < def.count; i++) {
                const mesh = def.make()
                const angle = Math.random() * Math.PI * 2
                const radius = 3.5 + Math.random() * 7
                const group = new THREE.Group()
                group.add(mesh)
                group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
                group.userData.itemType = def.type
                group.userData.icon = def.icon

                const hitSphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.55, 6, 6),
                    new THREE.MeshBasicMaterial({ visible: false })
                )
                hitSphere.position.y = 0.2
                hitSphere.userData.clickable = true
                hitSphere.userData.type = 'groundItem'
                hitSphere.userData.itemRef = group
                group.add(hitSphere)
                this.groundHitSpheres.push(hitSphere)

                this.add(group)
                this.groundItems.push(group)
            }
        })
    }

    pickGroundItem(item) {
        if (!item || !item.visible) return
        item.visible = false

        const type = item.userData.itemType
        const icon = item.userData.icon
        this.gain(type)
        this.showGameplayToast(`${icon} 拾取了材料！(${type === 'wood' ? '木材' : type === 'stone' ? '石头' : '贝壳'})`)

        setTimeout(() => {
            item.visible = true
        }, 18000)
    }

    // ── DIY bench: craft furniture from gathered materials ───────────
    setDIYBench() {
        const woodMat = new THREE.MeshStandardMaterial({ color: '#a0683c', roughness: 0.85 })
        const benchGroup = new THREE.Group()

        const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.8), woodMat)
        top.position.y = 0.75
        top.castShadow = true
        benchGroup.add(top)

        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), woodMat)
            leg.position.set(sx * 0.7, 0.38, sz * 0.3)
            benchGroup.add(leg)
        }

        // A little hammer and saw on top (symbolic, AC-style)
        const hammerHead = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.08, 0.08),
            new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.5, metalness: 0.6 })
        )
        hammerHead.position.set(-0.4, 0.83, 0)
        benchGroup.add(hammerHead)
        const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), woodMat)
        hammerHandle.rotation.z = Math.PI / 2.5
        hammerHandle.position.set(-0.28, 0.83, 0.05)
        benchGroup.add(hammerHandle)

        const pegboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), woodMat)
        pegboard.position.set(0, 1.35, -0.35)
        benchGroup.add(pegboard)

        benchGroup.position.set(6.5, 0, 4)
        benchGroup.rotation.y = -Math.PI * 0.3
        benchGroup.userData.clickable = true
        benchGroup.userData.type = 'diyBench'

        const hitSphere = new THREE.Mesh(
            new THREE.SphereGeometry(1.3, 6, 6),
            new THREE.MeshBasicMaterial({ visible: false })
        )
        hitSphere.position.y = 0.8
        hitSphere.userData.clickable = true
        hitSphere.userData.type = 'diyBench'
        benchGroup.add(hitSphere)
        this.diyBenchHitSphere = hitSphere

        this.add(benchGroup)
        this.diyBench = benchGroup
    }

    openDIY() {
        if (document.getElementById('diyModal')) return

        const inv = this.experience.world?.inventory
        const modal = document.createElement('div')
        modal.id = 'diyModal'
        modal.style.cssText = `
            position: fixed; inset: 0; z-index: 1200;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
        `

        const card = document.createElement('div')
        card.style.cssText = `
            width: 420px; max-width: calc(100vw - 40px); max-height: 80vh; overflow-y: auto;
            background: #fffdf8; border-radius: 20px; padding: 24px;
            font-family: 'Helvetica Neue', Arial, sans-serif; color: #3f3a32;
        `

        const renderRows = () => {
            return RECIPES.map((r) => {
                const costText = Object.entries(r.cost)
                    .map(([id, n]) => {
                        const have = inv?.count(id) || 0
                        const ok = have >= n
                        return `<span style="color:${ok ? '#5f9276' : '#c9665c'}">${n}${({ wood: '🪵', stone: '🪨', flower: '🌸' })[id] || id}<small>(${have})</small></span>`
                    })
                    .join(' + ')
                const canCraft = inv?.has(r.cost)
                return `
                    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px dashed #e5dfd2">
                        <div style="font-size:30px">${r.icon}</div>
                        <div style="flex:1">
                            <div style="font-weight:600">${r.name}</div>
                            <div style="font-size:13px">${costText}</div>
                        </div>
                        <button data-recipe="${r.id}" ${canCraft ? '' : 'disabled'}
                            style="padding:8px 16px;border:none;border-radius:14px;cursor:${canCraft ? 'pointer' : 'not-allowed'};
                                   background:${canCraft ? '#6d9c8b' : '#d8d0c0'};color:#fff;font-weight:600">
                            制作
                        </button>
                    </div>
                `
            }).join('')
        }

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <h3 style="margin:0;font-size:19px">🔨 DIY 工作台</h3>
                <button id="diyClose" style="width:32px;height:32px;border:none;border-radius:50%;background:#f1ede2;font-size:18px;cursor:pointer">×</button>
            </div>
            <div id="diyRows">${renderRows()}</div>
        `
        modal.appendChild(card)
        document.body.appendChild(modal)

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.id === 'diyClose') {
                modal.remove()
                return
            }
            const btn = e.target.closest('[data-recipe]')
            if (btn && !btn.disabled) {
                this.craft(btn.dataset.recipe)
                card.querySelector('#diyRows').innerHTML = renderRows()
            }
        })
    }

    craft(recipeId) {
        const recipe = RECIPES.find(r => r.id === recipeId)
        const inv = this.experience.world?.inventory
        if (!recipe || !inv) return

        if (!inv.consume(recipe.cost)) {
            this.showGameplayToast('🪵 材料不够，先去收集吧')
            return
        }

        inv.add(recipe.id, 1)
        this.showGameplayToast(`${recipe.icon} 做好了【${recipe.name}】！已放入背包`)
        this.experience.world?.quests?.onCraft?.(recipe.id)
    }

    // ── Furniture placement ───────────────────────────────────────────
    startPlacing(furnitureId) {
        const world = this.experience.world
        world.placingFurniture = furnitureId
        this.showGameplayToast(`📍 点击地面，摆放【${RECIPES.find(r => r.id === furnitureId)?.name || '家具'}】（点背包取消）`)
    }

    confirmPlacement(point) {
        const world = this.experience.world
        const type = world.placingFurniture
        if (!type) return

        if (!world.inventory.remove(type, 1)) {
            world.placingFurniture = null
            return
        }

        const rotY = Math.random() * Math.PI * 2
        this.placeFurnitureModel(type, point.x, point.z, rotY)
        this.savePlacements()
        world.placingFurniture = null
        this.showGameplayToast(`✅ 摆好了！`)
        this.experience.world?.quests?.onPlaceFurniture?.(type)
    }

    placeFurnitureModel(type, x, z, rotY = 0) {
        const model = createFurnitureModel(type)
        model.position.set(x, 0, z)
        model.rotation.y = rotY
        this.add(model)

        this.placedFurniture = this.placedFurniture || []
        this.placedFurniture.push({ type, x, z, rotY })
        return model
    }

    savePlacements() {
        savePlacements(this.placedFurniture || [])
    }

    restorePlacedFurniture() {
        this.placedFurniture = []
        const saved = loadPlacements()
        saved.forEach(({ type, x, z, rotY }) => {
            const model = createFurnitureModel(type)
            model.position.set(x, 0, z)
            model.rotation.y = rotY || 0
            this.add(model)
            this.placedFurniture.push({ type, x, z, rotY: rotY || 0 })
        })
    }

    // ── Shop: Nook's stall — buy materials, sell your gatherings ─────
    setShop() {
        const stall = new THREE.Group()
        const woodMat = new THREE.MeshStandardMaterial({ color: '#a0683c', roughness: 0.85 })

        // Counter
        const counter = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.7), woodMat)
        counter.position.y = 0.4
        counter.castShadow = true
        stall.add(counter)

        // Awning (striped, candy style)
        const awningColors = ['#e8574d', '#ffffff']
        for (let i = 0; i < 5; i++) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.05, 1.2),
                new THREE.MeshStandardMaterial({ color: awningColors[i % 2], roughness: 0.8 })
            )
            stripe.position.set(-0.8 + i * 0.4, 1.7, 0)
            stripe.rotation.z = -0.1
            stall.add(stripe)
        }
        for (const side of [-1, 1]) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6), woodMat)
            pole.position.set(side * 0.85, 0.85, 0.4)
            stall.add(pole)
        }

        // Goods on the counter
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.35), woodMat)
        crate.position.set(-0.4, 0.95, 0)
        stall.add(crate)
        const fruitPile = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshStandardMaterial({ color: '#ff4d4d', roughness: 0.6 })
        )
        fruitPile.position.set(-0.4, 1.12, 0)
        stall.add(fruitPile)

        stall.position.set(-5.5, 0, 6.5)
        stall.rotation.y = Math.PI * 0.2
        stall.userData.clickable = true
        stall.userData.type = 'shop'

        const hitSphere = new THREE.Mesh(
            new THREE.SphereGeometry(1.4, 6, 6),
            new THREE.MeshBasicMaterial({ visible: false })
        )
        hitSphere.position.y = 0.9
        hitSphere.userData.clickable = true
        hitSphere.userData.type = 'shop'
        stall.add(hitSphere)
        this.shopHitSphere = hitSphere

        this.add(stall)
        this.shop = stall
    }

    openShop() {
        if (document.getElementById('shopModal')) return

        const BUY_LIST = [
            { id: 'wood', name: '木材', icon: '🪵', price: 50 },
            { id: 'stone', name: '石头', icon: '🪨', price: 50 },
            { id: 'flower', name: '花苗', icon: '🌸', price: 30 },
            { id: 'apple', name: '水果', icon: '🍎', price: 40 }
        ]
        const SELL_PRICES = {
            apple: 20, flower: 15, fish: 80, butterfly: 60,
            fossil: 150, ore: 300, shell: 25
        }

        const inv = this.experience.world?.inventory
        const modal = document.createElement('div')
        modal.id = 'shopModal'
        modal.style.cssText = `
            position: fixed; inset: 0; z-index: 1200;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
        `

        const card = document.createElement('div')
        card.style.cssText = `
            width: 460px; max-width: calc(100vw - 40px); max-height: 82vh; overflow-y: auto;
            background: #fffdf8; border-radius: 20px; padding: 24px;
            font-family: 'Helvetica Neue', Arial, sans-serif; color: #3f3a32;
        `

        const render = () => {
            const bells = inv?.bells || 0
            const buyRows = BUY_LIST.map(item => {
                const afford = bells >= item.price
                return `
                    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed #e5dfd2">
                        <span style="font-size:24px">${item.icon}</span>
                        <span style="flex:1">${item.name}</span>
                        <span style="color:#b08d4a;font-weight:600">💰${item.price}</span>
                        <button data-buy="${item.id}" ${afford ? '' : 'disabled'}
                            style="padding:6px 14px;border:none;border-radius:12px;cursor:${afford ? 'pointer' : 'not-allowed'};
                                   background:${afford ? '#6d9c8b' : '#d8d0c0'};color:#fff;font-weight:600">买</button>
                    </div>
                `
            }).join('')

            const sellable = Object.entries(inv?.items || {}).filter(([id]) => SELL_PRICES[id])
            const sellRows = sellable.length === 0
                ? '<div style="text-align:center;color:#a39c8e;font-size:13px;padding:14px 0">背包里没有可以卖的东西</div>'
                : sellable.map(([id, n]) => {
                    const def = { apple: '🍎', flower: '🌸', fish: '🐟', butterfly: '🦋', fossil: '🦴', ore: '✨', shell: '🐚' }[id] || '❔'
                    const names = { apple: '水果', flower: '野花', fish: '鱼', butterfly: '蝴蝶', fossil: '化石', ore: '矿石', shell: '贝壳' }
                    return `
                        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed #e5dfd2">
                            <span style="font-size:24px">${def}</span>
                            <span style="flex:1">${names[id] || id} ×${n}</span>
                            <span style="color:#b08d4a;font-weight:600">💰${SELL_PRICES[id]}/个</span>
                            <button data-sell="${id}"
                                style="padding:6px 14px;border:none;border-radius:12px;cursor:pointer;
                                       background:#c9665c;color:#fff;font-weight:600">卖 1 个</button>
                        </div>
                    `
                }).join('')

            return `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <h3 style="margin:0;font-size:19px">🏪 狸克商店</h3>
                    <span style="font-weight:700;color:#b08d4a">💰 ${bells}</span>
                    <button id="shopClose" style="width:32px;height:32px;border:none;border-radius:50%;background:#f1ede2;font-size:18px;cursor:pointer">×</button>
                </div>
                <div style="font-weight:700;margin:14px 0 4px;color:#5f9276">🛒 购买</div>
                ${buyRows}
                <div style="font-weight:700;margin:16px 0 4px;color:#b08d4a">💰 出售</div>
                ${sellRows}
            `
        }

        card.innerHTML = render()
        modal.appendChild(card)
        document.body.appendChild(modal)

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.id === 'shopClose') {
                modal.remove()
                return
            }
            const buyBtn = e.target.closest('[data-buy]')
            if (buyBtn && !buyBtn.disabled) {
                const item = BUY_LIST.find(i => i.id === buyBtn.dataset.buy)
                if (item && inv?.spendBells(item.price)) {
                    inv.add(item.id, 1)
                    this.showGameplayToast(`${item.icon} 买到了【${item.name}】！`)
                    this.experience.world?.quests?.onBuy?.(item.id)
                }
            }
            const sellBtn = e.target.closest('[data-sell]')
            if (sellBtn) {
                const id = sellBtn.dataset.sell
                if (inv?.remove(id, 1)) {
                    inv.addBells(SELL_PRICES[id])
                    this.showGameplayToast(`💰 卖出了 1 个，+${SELL_PRICES[id]} 铃钱`)
                    this.experience.world?.quests?.onSell?.(id)
                }
            }
            if (buyBtn || sellBtn) {
                card.innerHTML = render()
            }
        })
    }

    // ── Sea + island edge cliffs ──────────────────────────────────────
    setSeaAndCliffs() {
        // Ocean plane below the island
        const sea = new THREE.Mesh(
            new THREE.PlaneGeometry(220, 220),
            new THREE.MeshStandardMaterial({ color: '#35b6c9', roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.96 })
        )
        sea.rotation.x = -Math.PI / 2
        sea.position.y = -0.32
        this.add(sea)
        this.sea = sea

        // Foam ring hugging the island edge
        const foam = new THREE.Mesh(
            new THREE.RingGeometry(30.2, 31.8, 64),
            new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
        )
        foam.rotation.x = -Math.PI / 2
        foam.position.y = -0.28
        this.add(foam)
        this.seaFoam = foam

        // Cliff walls around the island slab (notched where pier & dock cross)
        const cliffMat = new THREE.MeshStandardMaterial({ color: '#caa06b', roughness: 0.95 })
        const mkWall = (w, h, d, x, y, z) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cliffMat)
            m.position.set(x, y, z)
            this.add(m)
        }
        mkWall(0.7, 1.6, 60, -29.95, -0.5, 0)            // west
        mkWall(60, 1.6, 0.7, 0, -0.5, -29.95)            // north
        mkWall(0.7, 1.6, 28.2, 29.95, -0.5, -15.9)       // east, north of pier notch
        mkWall(0.7, 1.6, 28.2, 29.95, -0.5, 15.9)        // east, south of pier notch
        mkWall(31.2, 1.6, 0.7, -14.4, -0.5, 29.95)       // south, west of dock notch
        mkWall(24.8, 1.6, 0.7, 17.6, -0.5, 29.95)        // south, east of dock notch
    }

    addSandPatch(cx, cz, r) {
        const sand = new THREE.Mesh(
            new THREE.CircleGeometry(r, 40),
            new THREE.MeshStandardMaterial({ color: '#f2d9a0', roughness: 0.95 })
        )
        sand.rotation.x = -Math.PI / 2
        sand.position.set(cx, 0.045, cz)
        sand.receiveShadow = true
        this.add(sand)

        const rim = new THREE.Mesh(
            new THREE.RingGeometry(r - 0.6, r, 40),
            new THREE.MeshStandardMaterial({ color: '#e4c48c', roughness: 0.95 })
        )
        rim.rotation.x = -Math.PI / 2
        rim.position.set(cx, 0.04, cz)
        this.add(rim)
    }

    addCherryTree(x, z, s = 1) {
        const g = new THREE.Group()
        const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a3b3b', roughness: 0.9 })
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.3 * s, 2.4 * s, 8), trunkMat)
        trunk.position.y = 1.2 * s
        trunk.castShadow = true
        g.add(trunk)

        const canopyMat = new THREE.MeshStandardMaterial({ color: '#f2a0c4', roughness: 0.85 })
        const canopyDark = new THREE.MeshStandardMaterial({ color: '#e88ab2', roughness: 0.85 })
        const blobs = [
            [0, 2.9, 0, 1.5], [0.9, 2.5, 0.4, 1.0], [-0.9, 2.5, -0.3, 1.05], [0.2, 2.4, -0.8, 0.9]
        ]
        blobs.forEach(([bx, by, bz, br], i) => {
            const blob = new THREE.Mesh(new THREE.SphereGeometry(br * s, 12, 10), i % 2 ? canopyDark : canopyMat)
            blob.scale.set(1, 0.75, 1)
            blob.position.set(bx * s, by * s, bz * s)
            blob.castShadow = true
            g.add(blob)
        })

        // Hanging wisteria-style flower strings
        const stringMat = new THREE.MeshStandardMaterial({ color: '#c98ad6', roughness: 0.8 })
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2
            const sx = Math.cos(angle) * 1.1 * s
            const sz = Math.sin(angle) * 1.1 * s
            for (let j = 0; j < 3; j++) {
                const bead = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 6, 6), stringMat)
                bead.scale.set(1, 1.6, 1)
                bead.position.set(sx, (2.3 - j * 0.22) * s, sz)
                g.add(bead)
            }
        }

        g.position.set(x, 0, z)
        this.add(g)
        return g
    }

    addPine(x, z, s = 1) {
        const g = new THREE.Group()
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.8 * s, 6),
            new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.9 })
        )
        trunk.position.y = 0.4 * s
        g.add(trunk)
        const leafMat = new THREE.MeshStandardMaterial({ color: '#3e8e5a', roughness: 0.9 })
        for (let i = 0; i < 3; i++) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry((0.9 - i * 0.22) * s, 0.9 * s, 8), leafMat)
            cone.position.y = (1.0 + i * 0.55) * s
            cone.castShadow = true
            g.add(cone)
        }
        g.position.set(x, 0, z)
        this.add(g)
        this.trees.push(g) // sway + collision come for free
        return g
    }

    addPierLamps(xs, zs, positions) {
        const postMat = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9 })
        const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffe9a8' })
        positions.forEach(([px, pz]) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 6), postMat)
            post.position.set(px, 0.45, pz)
            this.add(post)
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bulbMat)
            bulb.position.set(px, 0.95, pz)
            this.add(bulb)
        })
    }

    addDeckPlanks(cx, cz, w, d) {
        const deckMat = new THREE.MeshStandardMaterial({ color: '#c98d54', roughness: 0.9 })
        const gapMat = new THREE.MeshStandardMaterial({ color: '#a06a3c', roughness: 0.9 })
        const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), deckMat)
        deck.position.set(cx, 0.0, cz)
        deck.receiveShadow = true
        this.add(deck)
        // Slat grooves
        const alongX = w > d
        const span = alongX ? w : d
        const count = Math.floor(span / 0.55)
        for (let i = 1; i < count; i++) {
            const off = -span / 2 + i * (span / count)
            const groove = new THREE.Mesh(
                new THREE.BoxGeometry(alongX ? 0.04 : w, 0.065, alongX ? d : 0.04),
                gapMat
            )
            groove.position.set(cx + (alongX ? off : 0), 0.001, cz + (alongX ? 0 : off))
            this.add(groove)
        }
    }

    makeSignTexture(text) {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 160
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fffdf8'
        ctx.fillRect(0, 0, 256, 160)
        ctx.strokeStyle = '#6d9c8b'
        ctx.lineWidth = 10
        ctx.strokeRect(8, 8, 240, 144)
        ctx.fillStyle = '#3f3a32'
        ctx.font = 'bold 52px "Helvetica Neue", Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, 128, 84)
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        return texture
    }

    // ── East zone: beach cabin + pier ─────────────────────────────────
    setEastCabin() {
        this.addSandPatch(22, 0, 6.8)

        const woodMat = new THREE.MeshStandardMaterial({ color: '#8a5a34', roughness: 0.85 })
        const darkWood = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.9 })
        const glassMat = new THREE.MeshStandardMaterial({ color: '#bfe8f0', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35 })
        const cabin = new THREE.Group()

        // Stilts
        for (const [sx, sz] of [[-1.4, -1.1], [0, -1.1], [1.4, -1.1], [-1.4, 1.1], [0, 1.1], [1.4, 1.1]]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.8, 8), darkWood)
            post.position.set(sx, 0.9, sz)
            cabin.add(post)
        }
        // Platform
        const platform = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 2.8), woodMat)
        platform.position.y = 1.8
        platform.castShadow = true
        cabin.add(platform)
        // Glass walls + frames
        const wallSpecs = [
            [3.4, 1.4, 0.06, 0, 2.55, -1.4],   // back
            [0.06, 1.4, 2.8, -1.7, 2.55, 0],   // left
            [0.06, 1.4, 2.8, 1.7, 2.55, 0]     // right
        ]
        wallSpecs.forEach(([w, h, d, x, y, z]) => {
            const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat)
            glass.position.set(x, y, z)
            cabin.add(glass)
            const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.08, d + 0.06), darkWood)
            frame.position.set(x, y + h / 2, z)
            cabin.add(frame)
        })
        // Front railing (open side faces the island, -x)
        for (let i = 0; i < 4; i++) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), darkWood)
            rail.position.set(-1.65, 2.1, -1.2 + i * 0.8)
            cabin.add(rail)
        }
        const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.6), darkWood)
        railTop.position.set(-1.65, 2.36, 0)
        cabin.add(railTop)
        // Interior: table + stool + bed
        const table = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), woodMat)
        table.position.set(0.6, 2.25, -0.6)
        cabin.add(table)
        const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), darkWood)
        tableLeg.position.set(0.6, 2.05, -0.6)
        cabin.add(tableLeg)
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.3, 8), woodMat)
        stool.position.set(0.6, 2.0, 0.1)
        cabin.add(stool)
        const bed = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 1.6), new THREE.MeshStandardMaterial({ color: '#f4e8d8', roughness: 0.9 }))
        bed.position.set(1.0, 2.0, 0.6)
        cabin.add(bed)
        // Roof with overhang + vines
        const roof = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 3.4), darkWood)
        roof.position.y = 3.35
        roof.castShadow = true
        cabin.add(roof)
        const vineMat = new THREE.MeshStandardMaterial({ color: '#5a9e4a', roughness: 0.9 })
        for (let i = 0; i < 7; i++) {
            const vine = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), vineMat)
            vine.scale.set(1.4, 0.7, 1.4)
            vine.position.set(-1.8 + i * 0.6, 3.45, (i % 2 ? 1.5 : -1.5))
            cabin.add(vine)
        }
        // Stairs down to the sand
        for (let i = 0; i < 4; i++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.4), woodMat)
            step.position.set(-2.1 - i * 0.42, 1.45 - i * 0.42, 0)
            cabin.add(step)
        }

        cabin.position.set(24.5, 0, -1)
        this.add(cabin)
        this.cabin = cabin

        // Cherry trees + rocks around the sand
        this.addCherryTree(18.5, -4.5, 0.85)
        this.addCherryTree(20, 4.5, 0.75)
        const rockMat = new THREE.MeshStandardMaterial({ color: '#b8a898', roughness: 0.95 })
        for (const [rx, rz, rs] of [[26.5, 3.5, 0.4], [17, 2, 0.3], [25, -5, 0.35]]) {
            const rock = new THREE.Mesh(new THREE.SphereGeometry(rs, 7, 6), rockMat)
            rock.scale.set(1.3, 0.7, 1)
            rock.position.set(rx, rs * 0.4, rz)
            this.add(rock)
        }

        // Wooden pier heading east into the sea
        this.addDeckPlanks(30.9, 0, 5.2, 2.6)
        this.addPierLamps(null, null, [[29.2, -1.15], [31.4, -1.15], [33.2, -1.15], [29.2, 1.15], [31.4, 1.15], [33.2, 1.15]])
    }

    // ── West zone: cherry-tree swing + ice-cream cart + flower field ──
    setWestSwing() {
        this.addSandPatch(-21.5, 1, 6.8)

        // Big cherry tree with a branch reaching east
        const tree = this.addCherryTree(-23, -1, 1.5)
        const branchMat = new THREE.MeshStandardMaterial({ color: '#7a3b3b', roughness: 0.9 })
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 2.2, 6), branchMat)
        branch.rotation.z = Math.PI / 2.4
        branch.position.set(1.2, 2.9, 0)
        tree.add(branch)

        // Swing hanging from the branch end
        const swingGroup = new THREE.Group()
        const ropeMat = new THREE.MeshStandardMaterial({ color: '#d8cbb0', roughness: 0.9 })
        for (const side of [-1, 1]) {
            const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 4), ropeMat)
            rope.position.set(side * 0.22, -0.75, 0)
            swingGroup.add(rope)
        }
        const seat = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.05, 0.24),
            new THREE.MeshStandardMaterial({ color: '#a0683c', roughness: 0.85 })
        )
        seat.position.set(0, -1.5, 0)
        seat.castShadow = true
        swingGroup.add(seat)
        swingGroup.position.set(-21.6, 2.9, -1)
        this.add(swingGroup)

        const swingHit = new THREE.Mesh(
            new THREE.SphereGeometry(0.9, 6, 6),
            new THREE.MeshBasicMaterial({ visible: false })
        )
        swingHit.position.set(0, -1.4, 0)
        swingHit.userData.clickable = true
        swingHit.userData.type = 'swing'
        swingGroup.add(swingHit)
        this.miscHitSpheres.push(swingHit)
        this.swing = { group: swingGroup, seat, boost: 0, sitting: false }

        // Flower field — dense, decorative (non-interactive)
        const stemMat = new THREE.MeshStandardMaterial({ color: '#4d8a4a', roughness: 0.9 })
        const headColors = ['#f4a7c3', '#b48ad6', '#ffffff', '#f7d154', '#f2a0c4']
        const headMats = headColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }))
        for (let i = 0; i < 70; i++) {
            const fx = -26.5 + Math.random() * 10
            const fz = -4.5 + Math.random() * 11
            if (Math.hypot(fx - (-23), fz - (-1)) < 1.8) continue      // tree
            if (Math.hypot(fx - (-17.5), fz - 4) < 1.8) continue       // cart
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), stemMat)
            stem.position.set(fx, 0.19, fz)
            this.add(stem)
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 6), headMats[i % headMats.length])
            head.position.set(fx, 0.36, fz)
            this.add(head)
        }

        // Ice-cream cart
        const cart = new THREE.Group()
        const creamMat = new THREE.MeshStandardMaterial({ color: '#fff3e0', roughness: 0.85 })
        const pinkMat = new THREE.MeshStandardMaterial({ color: '#f7c8d8', roughness: 0.85 })
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.75), creamMat)
        body.position.y = 0.58
        body.castShadow = true
        cart.add(body)
        const counter = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.85), pinkMat)
        counter.position.y = 1.03
        cart.add(counter)
        for (const side of [-1, 1]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9 }))
            wheel.rotation.x = Math.PI / 2
            wheel.position.set(side * 0.5, 0.22, 0.42)
            cart.add(wheel)
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), new THREE.MeshStandardMaterial({ color: '#a0683c', roughness: 0.85 }))
            post.position.set(side * 0.62, 1.45, -0.3)
            cart.add(post)
        }
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 1.05), pinkMat)
        canopy.position.y = 1.9
        cart.add(canopy)
        // Flower garland along the canopy edge
        const garlandColors = ['#f4a7c3', '#ffffff', '#f7d154']
        for (let i = 0; i < 7; i++) {
            const g = new THREE.Mesh(
                new THREE.SphereGeometry(0.07, 6, 6),
                new THREE.MeshStandardMaterial({ color: garlandColors[i % 3], roughness: 0.8 })
            )
            g.position.set(-0.7 + i * 0.235, 1.84, 0.52)
            cart.add(g)
        }
        // Two cones on the counter
        for (const [cx, scoop] of [[-0.35, '#f4a7c3'], [0.15, '#fffdf8']]) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), new THREE.MeshStandardMaterial({ color: '#d9a45c', roughness: 0.9 }))
            cone.position.set(cx, 1.14, 0)
            cart.add(cone)
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), new THREE.MeshStandardMaterial({ color: scoop, roughness: 0.7 }))
            ball.position.set(cx, 1.26, 0)
            cart.add(ball)
        }
        cart.position.set(-17.5, 0, 4)
        cart.rotation.y = -Math.PI / 2
        this.add(cart)

        const cartHit = new THREE.Mesh(
            new THREE.SphereGeometry(1.2, 6, 6),
            new THREE.MeshBasicMaterial({ visible: false })
        )
        cartHit.position.y = 0.9
        cartHit.userData.clickable = true
        cartHit.userData.type = 'iceCreamCart'
        cart.add(cartHit)
        this.miscHitSpheres.push(cartHit)
    }

    // ── South zone: vending machine + ferry shelter + water bus ───────
    setSouthDock() {
        this.addSandPatch(3, 23, 6.8)

        this.addPine(-1.5, 20.5, 1)
        this.addPine(7, 22, 0.85)

        // Vending machine (faces the plaza, −z)
        const vm = new THREE.Group()
        const vmBody = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.9, 0.7), new THREE.MeshStandardMaterial({ color: '#d43a2f', roughness: 0.6 }))
        vmBody.position.y = 0.95
        vmBody.castShadow = true
        vm.add(vmBody)
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.45, 0.05), new THREE.MeshStandardMaterial({ color: '#7a1f18', roughness: 0.5 }))
        panel.position.set(0, 1.0, -0.34)
        vm.add(panel)
        const canColors = ['#ffdd55', '#88ccff', '#ff8888', '#aaddaa']
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 4; col++) {
                const can = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8),
                    new THREE.MeshStandardMaterial({ color: canColors[col], roughness: 0.4, metalness: 0.3 })
                )
                can.position.set(-0.24 + col * 0.16, 1.35 - row * 0.35, -0.38)
                vm.add(can)
            }
        }
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.03), new THREE.MeshStandardMaterial({ color: '#222222' }))
        slot.position.set(0.28, 0.55, -0.36)
        vm.add(slot)
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.72), new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: 0.7 }))
        stripe.position.y = 1.72
        vm.add(stripe)
        vm.position.set(1.5, 0, 23.5)
        this.add(vm)

        const vmHit = new THREE.Mesh(
            new THREE.SphereGeometry(0.95, 6, 6),
            new THREE.MeshBasicMaterial({ visible: false })
        )
        vmHit.position.y = 1.0
        vmHit.userData.clickable = true
        vmHit.userData.type = 'vendingMachine'
        vm.add(vmHit)
        this.miscHitSpheres.push(vmHit)

        // Ferry shelter with a sign
        const shelter = new THREE.Group()
        const postMat = new THREE.MeshStandardMaterial({ color: '#4a3a28', roughness: 0.9 })
        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.1, 8), postMat)
            post.position.set(side * 0.95, 1.05, 0.4)
            shelter.add(post)
        }
        const roof = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 1.5), new THREE.MeshStandardMaterial({ color: '#3f5a50', roughness: 0.85 }))
        roof.position.set(0, 2.15, 0.15)
        roof.rotation.x = 0.06
        roof.castShadow = true
        shelter.add(roof)
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(0.9, 0.56),
            new THREE.MeshBasicMaterial({ map: this.makeSignTexture('渡船口'), side: THREE.DoubleSide })
        )
        sign.position.set(0, 1.65, 0.38)
        sign.rotation.y = Math.PI
        shelter.add(sign)
        const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: '#a0683c', roughness: 0.85 }))
        benchSeat.position.set(0, 0.5, 0.35)
        shelter.add(benchSeat)
        shelter.position.set(5.4, 0, 26.3)
        this.add(shelter)

        // Dock deck heading south into the sea
        this.addDeckPlanks(3.2, 31.2, 2.6, 5.2)
        this.addPierLamps(null, null, [[1.9, 29.5], [1.9, 31.7], [1.9, 33.5], [4.5, 29.5], [4.5, 31.7], [4.5, 33.5]])

        // Water bus
        const boat = new THREE.Group()
        const hullMat = new THREE.MeshStandardMaterial({ color: '#2f4f4a', roughness: 0.7 })
        const hull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.4), hullMat)
        hull.castShadow = true
        boat.add(hull)
        const boatStripe = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.1, 3.44), new THREE.MeshStandardMaterial({ color: '#e8c84d', roughness: 0.6 }))
        boatStripe.position.y = 0.2
        boat.add(boatStripe)
        const cabinBox = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.85, 1.7), new THREE.MeshStandardMaterial({ color: '#f2ead8', roughness: 0.85 }))
        cabinBox.position.set(0, 0.72, -0.35)
        cabinBox.castShadow = true
        boat.add(cabinBox)
        for (const side of [-1, 1]) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 1.2), new THREE.MeshStandardMaterial({ color: '#33454d', roughness: 0.3 }))
            win.position.set(side * 0.63, 0.8, -0.35)
            boat.add(win)
        }
        const boatRoof = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 2.0), hullMat)
        boatRoof.position.set(0, 1.18, -0.35)
        boat.add(boatRoof)
        const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 8), new THREE.MeshStandardMaterial({ color: '#444444', roughness: 0.7 }))
        chimney.position.set(0, 1.35, -0.9)
        boat.add(chimney)

        const boatHit = new THREE.Mesh(
            new THREE.SphereGeometry(1.7, 6, 6),
            new THREE.MeshBasicMaterial({ visible: false })
        )
        boatHit.position.y = 0.5
        boatHit.userData.clickable = true
        boatHit.userData.type = 'waterBus'
        boat.add(boatHit)
        this.miscHitSpheres.push(boatHit)

        boat.position.set(3.2, -0.05, 35.9)
        this.add(boat)
        this.boat = { group: boat, riding: false, t: 0 }
    }

    // ── New-zone interactions ─────────────────────────────────────────
    onSwingClick() {
        const player = this.experience.world?.player
        if (!player || !this.swing) return
        if (!this.swing.sitting) {
            this.swing.sitting = true
            this.swing.boost = 1
            player.frozen = true
            player.facing = Math.PI / 2
            this.showGameplayToast('🌸 荡起秋千啦～再点一次秋千跳下来')
        } else {
            this.swing.sitting = false
            player.frozen = false
            player.position.set(-20.2, 0, 0.5)
            player.velY = 0
            this.showGameplayToast('🌸 从秋千上跳下来了')
        }
    }

    onIceCreamClick() {
        const inv = this.experience.world?.inventory
        if (!inv) return
        if (inv.spendBells(50)) {
            this.showGameplayToast('🍦 买到了草莓冰淇淋！-50 铃钱，好甜～')
            this.experience.world?.quests?.onBuy?.('icecream')
        } else {
            this.showGameplayToast('🍦 草莓冰淇淋 50 铃钱一个，钱不够哦')
        }
    }

    onVendingClick() {
        const inv = this.experience.world?.inventory
        if (!inv) return
        if (inv.spendBells(30)) {
            this.showGameplayToast('🥤 咕咚咕咚…买了瓶汽水！-30 铃钱')
            this.experience.world?.quests?.onBuy?.('soda')
        } else {
            this.showGameplayToast('🥤 汽水 30 铃钱一瓶，钱不够哦')
        }
    }

    onBoatClick() {
        const player = this.experience.world?.player
        if (!player || !this.boat || this.boat.riding) return
        this.boat.riding = true
        this.boat.t = 0
        player.frozen = true
        player.position.set(3.2, 0.35, 35.2)
        this.showGameplayToast('🚤 水上巴士出发！绕小岛一圈～')
    }

    updateNewZones(delta, now) {
        const player = this.experience.world?.player

        // Swing sway + seated player follows the seat
        if (this.swing) {
            this.swing.boost *= 1 - Math.min(1, delta * 0.35)
            const amp = this.swing.sitting ? 0.5 : 0.06 + this.swing.boost * 0.3
            this.swing.group.rotation.x = Math.sin(now * 0.0013) * amp
            if (this.swing.sitting && player) {
                const v = new THREE.Vector3()
                this.swing.seat.getWorldPosition(v)
                player.position.set(v.x, v.y - 0.02, v.z)
            }
        }

        // Water bus idle bob / ride loop
        if (this.boat) {
            const b = this.boat
            if (b.riding && player) {
                b.t += delta
                const path = [[3.2, 35.9], [12, 40], [22, 36], [14, 31.8], [3.2, 35.9]]
                const total = 16
                if (b.t >= total) {
                    b.riding = false
                    player.frozen = false
                    player.position.set(3.2, 0, 32.6)
                    player.velY = 0
                    b.group.position.set(3.2, -0.05, 35.9)
                    b.group.rotation.set(0, 0, 0)
                    this.showGameplayToast('🚤 回到码头啦，欢迎下次乘坐！')
                } else {
                    const seg = (b.t / total) * (path.length - 1)
                    const i = Math.min(path.length - 2, Math.floor(seg))
                    const f = seg - i
                    const sf = f * f * (3 - 2 * f)
                    const x = path[i][0] + (path[i + 1][0] - path[i][0]) * sf
                    const z = path[i][1] + (path[i + 1][1] - path[i][1]) * sf
                    const hx = path[i + 1][0] - path[i][0]
                    const hz = path[i + 1][1] - path[i][1]
                    b.group.position.set(x, -0.05 + Math.sin(now * 0.002) * 0.04, z)
                    if (Math.hypot(hx, hz) > 0.01) b.group.rotation.y = Math.atan2(hx, hz)
                    player.position.set(x, 0.35, z)
                    player.facing = b.group.rotation.y
                }
            } else {
                b.group.position.y = -0.05 + Math.sin(now * 0.0015) * 0.05
                b.group.rotation.z = Math.sin(now * 0.001) * 0.02
            }
        }

        // Foam ring gentle pulse
        if (this.seaFoam) {
            const s = 1 + Math.sin(now * 0.0008) * 0.012
            this.seaFoam.scale.set(s, s, 1)
        }
    }

    // Walkable area: island slab + east pier + south dock corridors
    isWalkable(x, z) {
        if (Math.abs(x) <= 29 && Math.abs(z) <= 29) return true
        if (x >= 28.5 && x <= 33.6 && Math.abs(z) <= 1.5) return true    // east pier
        if (x >= 1.6 && x <= 4.8 && z >= 28.5 && z <= 33.8) return true  // south dock
        return false
    }

    // ── Seasons: spring / winter switch ───────────────────────────────
    setSeasons() {
        this.season = 'spring'

        // Season toggle button next to the clock
        this.seasonBtn = document.createElement('button')
        this.seasonBtn.id = 'seasonBtn'
        this.seasonBtn.className = 'season-btn'
        this.seasonBtn.textContent = '🌸 春'
        this.seasonBtn.style.cssText = `
            position: fixed; top: 20px; left: calc(50% + 90px); z-index: 950;
            padding: 8px 16px; border: none; border-radius: 20px;
            background: rgba(255,255,255,0.92); color: #3f3a32;
            font-size: 14px; font-weight: 600; cursor: pointer;
            backdrop-filter: blur(8px); box-shadow: 0 4px 14px rgba(0,0,0,0.12);
            font-family: 'Helvetica Neue', Arial, sans-serif;
        `
        this.seasonBtn.addEventListener('click', () => {
            this.applySeason(this.season === 'spring' ? 'winter' : 'spring')
        })
        document.body.appendChild(this.seasonBtn)

        // Snowfall particles (hidden in spring)
        const snowCount = 1200
        const positions = new Float32Array(snowCount * 3)
        this.snowVelocities = new Float32Array(snowCount)
        for (let i = 0; i < snowCount; i++) {
            const i3 = i * 3
            positions[i3] = (Math.random() - 0.5) * 40
            positions[i3 + 1] = Math.random() * 18
            positions[i3 + 2] = (Math.random() - 0.5) * 40
            this.snowVelocities[i] = 1 + Math.random() * 1.5
        }
        const snowGeo = new THREE.BufferGeometry()
        snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        this.snow = new THREE.Points(
            snowGeo,
            new THREE.PointsMaterial({ color: '#ffffff', size: 0.1, transparent: true, opacity: 0.9, sizeAttenuation: true })
        )
        this.snow.visible = false
        this.add(this.snow)
    }

    applySeason(season) {
        this.season = season
        const isWinter = season === 'winter'

        // Ground: green lawn vs snow field
        if (this.groundMaterial) {
            this.groundMaterial.color.set(isWinter ? '#eef4f8' : '#a8e088')
            if (this.groundMaterial.map) {
                this.groundMaterial.map = isWinter ? null : this.groundMaterial.map
                this.groundMaterial.needsUpdate = true
            }
        }

        // Canopies: green vs snow-capped
        if (this.leafMaterial) {
            this.leafMaterial.color.set(isWinter ? '#e8f0f5' : '#5cb85c')
        }

        // Flowers hide in winter
        this.flowers.forEach(f => { f.visible = isWinter ? false : !f.userData.picked })

        // Snowfall
        if (this.snow) this.snow.visible = isWinter

        // Pond freezes over
        if (this.pondWater) {
            this.pondWater.material.color.set(isWinter ? '#cfe8f5' : '#5fbef5')
            this.pondWater.material.roughness = isWinter ? 0.6 : 0.15
        }

        if (this.seasonBtn) {
            this.seasonBtn.textContent = isWinter ? '❄️ 冬' : '🌸 春'
        }

        this.showGameplayToast(isWinter ? '❄️ 冬天来了，小岛下雪了' : '🌸 春天来了，万物复苏')
    }

    updateSeason(delta) {
        if (this.season !== 'winter' || !this.snow || !this.snow.visible) return

        const positions = this.snow.geometry.attributes.position.array
        for (let i = 0; i < positions.length / 3; i++) {
            const i3 = i * 3
            positions[i3 + 1] -= this.snowVelocities[i] * delta
            positions[i3] += Math.sin(this.time.elapsed * 0.001 + i) * delta * 0.3
            if (positions[i3 + 1] < 0) {
                positions[i3 + 1] = 18
                positions[i3] = (Math.random() - 0.5) * 40
                positions[i3 + 2] = (Math.random() - 0.5) * 40
            }
        }
        this.snow.geometry.attributes.position.needsUpdate = true
    }

    // ── Day/night cycle: smooth lighting, night sky dome, clock UI ───
    setDayNight() {
        this.dayTime = 0.35            // 0..1; 0.25 dawn, 0.5 noon, 0.75 dusk
        this.dayLength = 240           // seconds per full day

        // Night veil: a big translucent dome that darkens the sky at night
        this.nightVeil = new THREE.Mesh(
            new THREE.SphereGeometry(85, 24, 16),
            new THREE.MeshBasicMaterial({
                color: '#0a1030',
                side: THREE.BackSide,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                fog: false
            })
        )
        this.nightVeil.renderOrder = -1
        this.add(this.nightVeil)

        // Night stars
        const starCount = 800
        const positions = new Float32Array(starCount * 3)
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3
            const radius = 70 + Math.random() * 10
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
            positions[i3 + 1] = Math.abs(radius * Math.cos(phi)) * 0.9 + 5
            positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
        }
        const starGeo = new THREE.BufferGeometry()
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        this.nightStars = new THREE.Points(
            starGeo,
            new THREE.PointsMaterial({ color: '#ffffff', size: 0.25, transparent: true, opacity: 0, sizeAttenuation: true })
        )
        this.add(this.nightStars)

        // Moon
        this.moon = new THREE.Mesh(
            new THREE.SphereGeometry(2.5, 16, 16),
            new THREE.MeshBasicMaterial({ color: '#f5f3ce', fog: false, transparent: true, opacity: 0 })
        )
        this.moon.position.set(-30, 30, -20)
        this.add(this.moon)

        // Clock UI
        this.clockEl = document.createElement('div')
        this.clockEl.id = 'dayNightClock'
        this.clockEl.className = 'day-night-clock'
        this.clockEl.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            z-index: 900; padding: 8px 18px; border-radius: 20px;
            background: rgba(255,255,255,0.88); color: #3f3a32;
            font-size: 14px; font-weight: 600; backdrop-filter: blur(8px);
            font-family: 'Helvetica Neue', Arial, sans-serif;
            box-shadow: 0 4px 14px rgba(0,0,0,0.12); pointer-events: none;
        `
        document.body.appendChild(this.clockEl)
    }

    // Lighting keyframes: [time, sunI, sunColor, fillI, ambI, ambColor, veil, stars]
    getDayNightState(t) {
        const keys = [
            { t: 0.00, sun: 0.22, sunC: 0x8fa8ff, fill: 0.10, amb: 0.38, ambC: 0x2a3a6e, veil: 0.72, stars: 1 },
            { t: 0.20, sun: 0.22, sunC: 0x8fa8ff, fill: 0.10, amb: 0.38, ambC: 0x2a3a6e, veil: 0.72, stars: 1 },
            { t: 0.28, sun: 0.80, sunC: 0xffc890, fill: 0.30, amb: 0.75, ambC: 0xffd9b0, veil: 0.15, stars: 0 },
            { t: 0.40, sun: 1.40, sunC: 0xffedcc, fill: 0.50, amb: 1.20, ambC: 0xfff8e7, veil: 0.00, stars: 0 },
            { t: 0.65, sun: 1.40, sunC: 0xffedcc, fill: 0.50, amb: 1.20, ambC: 0xfff8e7, veil: 0.00, stars: 0 },
            { t: 0.76, sun: 0.75, sunC: 0xff9a5c, fill: 0.30, amb: 0.65, ambC: 0xff9a6a, veil: 0.22, stars: 0.1 },
            { t: 0.86, sun: 0.22, sunC: 0x8fa8ff, fill: 0.10, amb: 0.38, ambC: 0x2a3a6e, veil: 0.72, stars: 1 },
            { t: 1.00, sun: 0.22, sunC: 0x8fa8ff, fill: 0.10, amb: 0.38, ambC: 0x2a3a6e, veil: 0.72, stars: 1 }
        ]

        let a = keys[0], b = keys[keys.length - 1]
        for (let i = 0; i < keys.length - 1; i++) {
            if (t >= keys[i].t && t <= keys[i + 1].t) {
                a = keys[i]
                b = keys[i + 1]
                break
            }
        }
        const f = (t - a.t) / Math.max(0.0001, b.t - a.t)

        const lerpColor = (c1, c2) => {
            const col1 = new THREE.Color(c1), col2 = new THREE.Color(c2)
            return col1.lerp(col2, f)
        }

        return {
            sunI: a.sun + (b.sun - a.sun) * f,
            sunC: lerpColor(a.sunC, b.sunC),
            fillI: a.fill + (b.fill - a.fill) * f,
            ambI: a.amb + (b.amb - a.amb) * f,
            ambC: lerpColor(a.ambC, b.ambC),
            veil: a.veil + (b.veil - a.veil) * f,
            stars: a.stars + (b.stars - a.stars) * f
        }
    }

    updateDayNight(delta) {
        this.dayTime = (this.dayTime + delta / this.dayLength) % 1

        const state = this.getDayNightState(this.dayTime)
        const env = this.experience.world?.environment
        if (env) {
            env.sunLight.intensity = state.sunI
            env.sunLight.color.copy(state.sunC)
            // Sun swings across the sky
            const sunAngle = (this.dayTime - 0.25) * Math.PI * 2
            env.sunLight.position.set(Math.cos(sunAngle) * 12, Math.max(2, Math.sin(sunAngle) * 14), 5)
            env.fillLight.intensity = state.fillI
            env.ambientLight.intensity = state.ambI
            env.ambientLight.color.copy(state.ambC)
        }

        if (this.nightVeil) this.nightVeil.material.opacity = state.veil
        if (this.nightStars) this.nightStars.material.opacity = state.stars * 0.9
        if (this.moon) this.moon.material.opacity = state.stars

        // Clock UI: t=0 → 00:00, t=0.25 → 06:00, t=0.5 → 12:00, t=0.75 → 18:00
        if (this.clockEl) {
            const totalMinutes = this.dayTime * 24 * 60
            const hours = Math.floor(totalMinutes / 60)
            const minutes = Math.floor(totalMinutes % 60)
            const icon = hours >= 6 && hours < 17 ? '☀️' : hours >= 17 && hours < 19.5 ? '🌇' : '🌙'
            this.clockEl.textContent = `${icon} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        }
    }

    destroyDayNight() {
        if (this.clockEl) {
            this.clockEl.remove()
            this.clockEl = null
        }
        if (this.seasonBtn) {
            this.seasonBtn.remove()
            this.seasonBtn = null
        }
    }

    // ── Island map UI ────────────────────────────────────────────────
    createMapUI() {
        if (this.mapBtn) return

        const btn = document.createElement('button')
        btn.id = 'mapBtn'
        btn.textContent = '🗺️ 地图'
        btn.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 1000;
            padding: 12px 20px; border: none; border-radius: 24px;
            background: rgba(255,255,255,0.94); color: #3f3a32;
            font-size: 15px; font-weight: 600; cursor: pointer;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12); backdrop-filter: blur(8px);
            font-family: 'Helvetica Neue', Arial, sans-serif;
            transition: transform 0.2s;
        `
        btn.addEventListener('click', () => this.toggleMap())
        document.body.appendChild(btn)
        this.mapBtn = btn
    }

    removeMapUI() {
        if (this.mapBtn) {
            this.mapBtn.remove()
            this.mapBtn = null
        }
        if (this.mapModal) {
            this.mapModal.remove()
            this.mapModal = null
        }
    }


    toggleMap() {
        if (this.mapModal) {
            this.mapModal.remove()
            this.mapModal = null
            return
        }

        const modal = document.createElement('div')
        modal.id = 'islandMapModal'
        modal.style.cssText = `
            position: fixed; inset: 0; z-index: 1200;
            display: flex; align-items: center; justify-content: center;
            background: rgba(63,58,50,0.35); backdrop-filter: blur(4px);
        `

        const isMobile = window.innerWidth < 768
        const canvasSize = isMobile ? 320 : 420
        const card = document.createElement('div')
        card.style.cssText = `
            position: relative; width: ${canvasSize + 40}px; max-width: calc(100vw - 32px);
            background: #fffdf8; border-radius: 20px; padding: 22px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.25);
            font-family: 'Helvetica Neue', Arial, sans-serif; color: #3f3a32;
        `

        const canvas = document.createElement('canvas')
        canvas.id = 'islandMapCanvas'
        canvas.width = canvasSize
        canvas.height = canvasSize
        canvas.style.cssText = `
            width: ${canvasSize}px; height: ${canvasSize}px; max-width: 100%;
            background: #f0ede3; border-radius: 14px; display: block;
        `

        const legend = document.createElement('div')
        legend.style.cssText = `
            margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px 18px;
            font-size: 13px; color: #8a8378; justify-content: center;
        `
        legend.innerHTML = `
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#6d9c8b;margin-right:4px"></span>商店/DIY</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#8a6db8;margin-right:4px"></span>小屋/秋千/码头</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#5aa4c9;margin-right:4px"></span>喷泉/池塘</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#c9665c;margin-right:4px"></span>我的位置</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#b08d4a;margin-right:4px"></span>画架</span>
        `

        const close = document.createElement('button')
        close.textContent = '×'
        close.style.cssText = `
            position: absolute; top: 12px; right: 12px; width: 34px; height: 34px;
            border: none; border-radius: 50%; background: #f1ede2; color: #8a8378;
            font-size: 20px; cursor: pointer; line-height: 1;
        `
        close.addEventListener('click', () => {
            modal.remove()
            this.mapModal = null
        })

        card.appendChild(close)
        card.appendChild(canvas)
        card.appendChild(legend)
        modal.appendChild(card)
        document.body.appendChild(modal)
        this.mapModal = modal

        this.renderMap(canvas)
    }

    renderMap(canvas) {
        const ctx = canvas.getContext('2d')
        const S = canvas.width
        const pad = 22
        const mapS = S - pad * 2
        const half = mapS / 2
        const cx = pad + half
        const cy = pad + half
        const worldR = 34
        const scale = half / worldR

        const worldToMap = (x, z) => ({ x: cx + x * scale, y: cy + z * scale })

        // Sea background
        ctx.fillStyle = '#bfe6ee'
        ctx.fillRect(0, 0, S, S)

        // Grass / island base (island slab is ±29)
        const islR = 29 * scale
        ctx.fillStyle = '#e8f0d8'
        ctx.beginPath()
        ctx.roundRect(cx - islR, cy - islR, islR * 2, islR * 2, 14)
        ctx.fill()

        // Sand patches for the three coastal zones
        ctx.fillStyle = '#f2d9a0'
        for (const [sx, sz, sr] of [[22, 0, 6.8], [-21.5, 1, 6.8], [3, 23, 6.8]]) {
            const p = worldToMap(sx, sz)
            ctx.beginPath()
            ctx.arc(p.x, p.y, sr * scale, 0, Math.PI * 2)
            ctx.fill()
        }
        // Pier & dock decks
        ctx.fillStyle = '#c98d54'
        const pier = worldToMap(30.9, 0)
        ctx.fillRect(pier.x - 2.6 * scale, pier.y - 1.3 * scale, 5.2 * scale, 2.6 * scale)
        const dock = worldToMap(3.2, 31.2)
        ctx.fillRect(dock.x - 1.3 * scale, dock.y - 2.6 * scale, 2.6 * scale, 5.2 * scale)

        // Paths (sand)
        ctx.strokeStyle = '#eaddc5'
        ctx.lineWidth = 10
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(...Object.values(worldToMap(0, -11)))
        ctx.lineTo(...Object.values(worldToMap(0, 11)))
        ctx.moveTo(...Object.values(worldToMap(-11, 0)))
        ctx.lineTo(...Object.values(worldToMap(11, 0)))
        ctx.stroke()
        // Pond
        const pond = worldToMap(-8.5, -7)
        ctx.fillStyle = '#a8d8e8'
        ctx.beginPath()
        ctx.ellipse(pond.x, pond.y, 3.1 * scale, 2.4 * scale, 0, 0, Math.PI * 2)
        ctx.fill()

        // Helper for markers
        const marker = (x, z, color, label, icon = '') => {
            const p = worldToMap(x, z)
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#fffdf8'
            ctx.lineWidth = 2
            ctx.stroke()
            if (label) {
                ctx.fillStyle = '#3f3a32'
                ctx.font = '11px "Helvetica Neue", Arial, sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText(icon + label, p.x, p.y + 17)
            }
        }

        // Facilities
        marker(0, 0, '#5aa4c9', '喷泉', '⛲')
        marker(4.5, 2.5, '#8a8378', '布告板', '📋')
        marker(-5.5, 6.5, '#6d9c8b', '商店', '🏪')
        marker(6.5, 4, '#6d9c8b', 'DIY', '🔨')

        // Coastal zones
        marker(24.5, -1, '#8a6db8', '小屋', '🏡')
        marker(-22, 0, '#8a6db8', '秋千', '🌸')
        marker(3.2, 31.5, '#8a6db8', '码头', '🚤')
        marker(1.5, 23.5, '#8a6db8', '', '🥤')
        marker(-17.5, 4, '#8a6db8', '', '🍦')

        // Easels / painting stands
        const stands = [[-6, -6], [0, -8], [6, -6], [-6, 6], [0, 8], [6, 6]]
        stands.forEach(([x, z]) => marker(x, z, '#b08d4a', '', '🎨'))

        // Fruit trees
        this.trees?.forEach(tree => {
            const p = worldToMap(tree.position.x, tree.position.z)
            ctx.fillStyle = '#8bc46c'
            ctx.beginPath()
            ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
            ctx.fill()
        })

        // Houses
        this.houses?.forEach(h => {
            const p = worldToMap(h.position.x, h.position.z)
            ctx.fillStyle = '#f4c89c'
            ctx.beginPath()
            ctx.roundRect(p.x - 8, p.y - 6, 16, 12, 3)
            ctx.fill()
            ctx.fillStyle = '#e07a8a'
            ctx.beginPath()
            ctx.arc(p.x, p.y - 6, 8, Math.PI, 0)
            ctx.fill()
        })

        // Player
        const player = this.experience.world?.player
        if (player?.active) {
            const p = worldToMap(player.position.x, player.position.z)
            ctx.fillStyle = '#c9665c'
            ctx.beginPath()
            ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#fffdf8'
            ctx.lineWidth = 3
            ctx.stroke()
            ctx.fillStyle = '#fff'
            ctx.font = 'bold 10px "Helvetica Neue", Arial, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('我', p.x, p.y + 1)
        }
    }

    // ── Gameplay: apple picking & fishing ─────────────────────────────
    setupGameplay() {
        // Show the collect HUD while this scene is active
        const hud = document.getElementById('collectHud')
        if (hud) hud.classList.add('visible')
        this.updateCollectHUD()

        // Backpack button
        if (this.experience.world?.inventory) {
            this.experience.world.inventory.show()
        }

        // Quest button
        if (this.experience.world?.quests) {
            this.experience.world.quests.show()
        }

        // Map button
        this.createMapUI()

        // Show the guide card once per session
        if (!this._guideShown) {
            const guide = document.getElementById('acGuide')
            if (guide) {
                guide.style.display = 'flex'
                requestAnimationFrame(() => guide.classList.add('visible'))
                const close = document.getElementById('acGuideClose')
                if (close && !close._bound) {
                    close._bound = true
                    close.addEventListener('click', () => {
                        guide.classList.remove('visible')
                        // Remove from hit-testing right away — the CSS
                        // visibility transition otherwise keeps swallowing
                        // clicks for another ~350ms
                        guide.style.display = 'none'
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
        this.gain('fish')
        this.experience.world?.quests?.onFish?.()
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
        this.gain('flower')
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

        this.destroyDayNight()

        // Hide backpack
        if (this.experience.world?.inventory) {
            this.experience.world.inventory.hide()
        }

        // Hide quest panel
        if (this.experience.world?.quests) {
            this.experience.world.quests.hide()
        }

        // Remove map UI
        this.removeMapUI()

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
        this.gain('butterfly')
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
            this.gain('fossil')
            toast = '🦴 挖到了一块化石！💰+200'
        } else if (roll < 0.8) {
            this.addBells(300)
            toast = '💰 挖到了一袋铃钱！💰+300'
        } else {
            this.addBells(500)
            this.gain('ore')
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
        ctx.fillStyle = '#3f3a32'
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
        if (this.experience.world?.inventory) {
            this.experience.world.inventory.addBells(amount)
        }
        this.updateCollectHUD()
    }

    gain(itemId, count = 1) {
        if (this.experience.world?.inventory) {
            this.experience.world.inventory.add(itemId, count)
        }
    }

    // ── Vivy: the island's special resident ──────────────────────────
    setVivy() {
        this.vivy = createVivy({ dressTexture: this.resources.items.acCotton || null })
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
        this.updateDayNight(delta)
        this.updateSeason(delta)
        this.updateNewZones(delta, now)

        // Refresh map if open (player marker moves)
        if (this.mapModal) {
            const canvas = this.mapModal.querySelector('#islandMapCanvas')
            if (canvas) this.renderMap(canvas)
        }

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
                    this.gain('apple')
                    this.experience.world?.quests?.onPickApple?.()
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
