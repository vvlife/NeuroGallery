import * as THREE from 'three'
import Experience from '../Experience.js'

export default class GalleryRoom {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources

        this.setFloor()
        this.setWalls()
        this.setCeiling()
    }

    setFloor() {
        // Create floor geometry - made slightly larger
        const floorGeometry = new THREE.PlaneGeometry(24, 24)

        // Create floor material with new decorative tile texture or procedural fallback
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: '#f5f5f5',
            roughness: 0.3,
            metalness: 0.1
        })

        // Use new decorative tile texture if available
        if (this.resources.items.floorTexture) {
            floorMaterial.map = this.resources.items.floorTexture
            this.resources.items.floorTexture.wrapS = THREE.RepeatWrapping
            this.resources.items.floorTexture.wrapT = THREE.RepeatWrapping
            this.resources.items.floorTexture.repeat.setScalar(8) // More repetitions for tile effect
        }

        // Create floor mesh
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial)
        this.floor.rotation.x = -Math.PI * 0.5
        this.floor.receiveShadow = true
        this.scene.add(this.floor)
    }

    setWalls() {
        const wallHeight = 7 // Increased from 5 to 7 for a taller room
        const wallThickness = 0.2
        const roomSize = 12 // Increased from 10 to 12

        // Wall material with real concrete texture or procedural fallback
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: '#e0e0e0',
            roughness: 0.8,
            metalness: 0.1
        })

        // Use real concrete texture if available
        if (this.resources.items.concreteWall) {
            wallMaterial.map = this.resources.items.concreteWall
            this.resources.items.concreteWall.wrapS = THREE.RepeatWrapping
            this.resources.items.concreteWall.wrapT = THREE.RepeatWrapping
            this.resources.items.concreteWall.repeat.set(2, 1)
        }

        // Window material - transparent glass
        const windowMaterial = new THREE.MeshPhysicalMaterial({
            color: '#87CEEB',
            metalness: 0,
            roughness: 0,
            transmission: 0.9,
            transparent: true,
            opacity: 0.3,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            ior: 1.5
        })

        // Create walls group
        this.walls = new THREE.Group()

        // Back wall (z = -roomSize) - PAINTINGS WALL
        const backWallGeometry = new THREE.BoxGeometry(roomSize * 2, wallHeight, wallThickness)
        const backWall = new THREE.Mesh(backWallGeometry, wallMaterial)
        backWall.position.set(0, wallHeight / 2, -roomSize)
        backWall.receiveShadow = true
        backWall.castShadow = true
        backWall.userData = { wallType: 'paintings' }
        this.walls.add(backWall)

        // Front wall (z = roomSize) - PAINTINGS WALL
        const frontWallGeometry = new THREE.BoxGeometry(roomSize * 2, wallHeight, wallThickness)
        const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial)
        frontWall.position.set(0, wallHeight / 2, roomSize)
        frontWall.receiveShadow = true
        frontWall.castShadow = true
        frontWall.userData = { wallType: 'paintings' }
        this.walls.add(frontWall)

        // Left wall (x = -roomSize) - WINDOWS WALL
        this.createWindowWall(-roomSize, 0, 0, wallHeight, roomSize, windowMaterial, wallMaterial)

        // Right wall (x = roomSize) - WINDOWS WALL  
        this.createWindowWall(roomSize, 0, 0, wallHeight, roomSize, windowMaterial, wallMaterial)

        this.scene.add(this.walls)
    }

    createWindowWall(x, y, z, wallHeight, roomSize, windowMaterial, wallMaterial) {
        const wallThickness = 0.2
        const windowWidth = roomSize * 1.5
        const windowHeight = wallHeight * 0.8
        const frameThickness = 0.15

        // Window frame material
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: '#404040',
            roughness: 0.3,
            metalness: 0.7
        })

        // Create main wall structure around the window
        const sideWallWidth = (roomSize * 2 - windowWidth) / 2

        // Left side of wall
        if (sideWallWidth > 0) {
            const leftSide = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness, wallHeight, sideWallWidth),
                wallMaterial
            )
            leftSide.position.set(x, wallHeight / 2, z - roomSize + sideWallWidth / 2)
            leftSide.receiveShadow = true
            leftSide.castShadow = true
            this.walls.add(leftSide)

            // Right side of wall
            const rightSide = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness, wallHeight, sideWallWidth),
                wallMaterial
            )
            rightSide.position.set(x, wallHeight / 2, z + roomSize - sideWallWidth / 2)
            rightSide.receiveShadow = true
            rightSide.castShadow = true
            this.walls.add(rightSide)
        }

        // Top part of wall above window
        const topWallHeight = (wallHeight - windowHeight) / 2
        if (topWallHeight > 0) {
            const topWall = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness, topWallHeight, windowWidth),
                wallMaterial
            )
            topWall.position.set(x, wallHeight - topWallHeight / 2, z)
            topWall.receiveShadow = true
            topWall.castShadow = true
            this.walls.add(topWall)
        }

        // Bottom part of wall below window
        if (topWallHeight > 0) {
            const bottomWall = new THREE.Mesh(
                new THREE.BoxGeometry(wallThickness, topWallHeight, windowWidth),
                wallMaterial
            )
            bottomWall.position.set(x, topWallHeight / 2, z)
            bottomWall.receiveShadow = true
            bottomWall.castShadow = true
            this.walls.add(bottomWall)
        }

        // Create 3 window panes instead of 1 large window
        const paneWidth = windowWidth / 3

        for (let i = 0; i < 3; i++) {
            const paneWindow = new THREE.Mesh(
                new THREE.PlaneGeometry(paneWidth, windowHeight),
                windowMaterial
            )

            // Position each pane
            const paneOffsetZ = (i - 1) * paneWidth // -1, 0, 1 * paneWidth
            paneWindow.position.set(
                x > 0 ? x - wallThickness/2 : x + wallThickness/2,
                wallHeight / 2,
                z + paneOffsetZ
            )
            paneWindow.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2
            this.walls.add(paneWindow)
        }

        // Window frame
        const frameGroup = new THREE.Group()

        // Outer vertical frame pieces (left and right edges)
        const leftFrame = new THREE.Mesh(
            new THREE.BoxGeometry(frameThickness, windowHeight + frameThickness, frameThickness),
            frameMaterial
        )
        leftFrame.position.set(x > 0 ? x - wallThickness/2 : x + wallThickness/2, wallHeight / 2, z - windowWidth / 2)
        leftFrame.castShadow = true
        leftFrame.receiveShadow = true
        frameGroup.add(leftFrame)

        const rightFrame = new THREE.Mesh(
            new THREE.BoxGeometry(frameThickness, windowHeight + frameThickness, frameThickness),
            frameMaterial
        )
        rightFrame.position.set(x > 0 ? x - wallThickness/2 : x + wallThickness/2, wallHeight / 2, z + windowWidth / 2)
        rightFrame.castShadow = true
        rightFrame.receiveShadow = true
        frameGroup.add(rightFrame)

        // Divider frames between the 3 sections
        for (let i = 1; i < 3; i++) {
            const dividerZ = z - windowWidth / 2 + (i * paneWidth)
            const dividerFrame = new THREE.Mesh(
                new THREE.BoxGeometry(frameThickness, windowHeight, frameThickness),
                frameMaterial
            )
            dividerFrame.position.set(x > 0 ? x - wallThickness/2 : x + wallThickness/2, wallHeight / 2, dividerZ)
            dividerFrame.castShadow = true
            dividerFrame.receiveShadow = true
            frameGroup.add(dividerFrame)
        }

        // Horizontal frame pieces (top and bottom)
        const topFrame = new THREE.Mesh(
            new THREE.BoxGeometry(frameThickness, frameThickness, windowWidth + frameThickness),
            frameMaterial
        )
        topFrame.position.set(x > 0 ? x - wallThickness/2 : x + wallThickness/2, wallHeight / 2 + windowHeight / 2, z)
        topFrame.castShadow = true
        topFrame.receiveShadow = true
        frameGroup.add(topFrame)

        const bottomFrame = new THREE.Mesh(
            new THREE.BoxGeometry(frameThickness, frameThickness, windowWidth + frameThickness),
            frameMaterial
        )
        bottomFrame.position.set(x > 0 ? x - wallThickness/2 : x + wallThickness/2, wallHeight / 2 - windowHeight / 2, z)
        bottomFrame.castShadow = true
        bottomFrame.receiveShadow = true
        frameGroup.add(bottomFrame)

        this.walls.add(frameGroup)
    }

    setCeiling() {
        // Use the ceiling.glb model as the ceiling
        if (this.resources.items.ceiling) {
            this.ceiling = this.resources.items.ceiling.scene.clone()

            const ceilingHeight = 7
            this.ceiling.scale.setScalar(0.245)

            // Center the ceiling model - calculate bounding box and adjust position
            const box = new THREE.Box3().setFromObject(this.ceiling)
            const center = box.getCenter(new THREE.Vector3())

            // Position the ceiling centered in the room
            this.ceiling.position.set(-center.x, ceilingHeight - center.y, -center.z)

            // Enable shadows for all meshes in the ceiling model
            this.ceiling.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true
                    child.receiveShadow = true

                    // Ensure materials have proper properties
                    if (child.material) {
                        child.material.needsUpdate = true
                    }
                }
            })

            this.scene.add(this.ceiling)
        }
    }
} 