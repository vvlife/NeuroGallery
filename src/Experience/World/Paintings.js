import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Paintings {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources

        this.paintingMeshes = []
        this.paintingData = []
        this.spotlights = []
        this.groups = []

        this.loadPaintingData()
    }

    async loadPaintingData() {
        // Support multiple data sources (priority order):
        // 1. ?d=<lzstring_compressed> or #d=<lzstring_compressed> — compressed inline data
        // 2. ?data=<url_encoded_json> or #data=<base64_json> — legacy inline data
        // 3. ?paintings=https://xxx/paintings.json — remote JSON URL
        // 4. Local default file
        const urlParams = new URLSearchParams(window.location.search)
        
        // Try compressed format first (?d= or #d=)
        let compressedData = urlParams.get('d')
        if (!compressedData && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.slice(1))
            compressedData = hashParams.get('d')
        }
        if (compressedData) {
            try {
                // Try LZString decompression first
                let json
                if (typeof LZString !== 'undefined') {
                    json = LZString.decompressFromEncodedURIComponent(compressedData)
                }
                // If LZString failed or not available, try base64
                if (!json) {
                    json = decodeURIComponent(escape(atob(compressedData)))
                }
                this.paintingData = JSON.parse(json)
                this.createPaintingsFromData()
                return
            } catch (e) {
                console.warn('[NeuroGallery] Failed to parse compressed data, trying legacy format:', e)
            }
        }
        
        // Legacy: ?data=<url_encoded_json> or #data=<base64_json>
        let inlineData = urlParams.get('data')
        let dataEncoding = 'url'
        if (!inlineData && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.slice(1))
            inlineData = hashParams.get('data')
            if (inlineData) dataEncoding = 'base64'
        }
        if (inlineData) {
            try {
                let parsed
                if (dataEncoding === 'base64') {
                    const json = decodeURIComponent(escape(atob(inlineData)))
                    parsed = JSON.parse(json)
                } else {
                    parsed = JSON.parse(decodeURIComponent(inlineData))
                }
                this.paintingData = parsed
                this.createPaintingsFromData()
                return
            } catch (e) {
                console.warn('[NeuroGallery] Failed to parse inline data, falling back to default:', e)
            }
        }
        
        const remotePaintings = urlParams.get('paintings')
        const dataUrl = remotePaintings || './textures/paintings/painting_data.json'
        const response = await fetch(dataUrl)
        this.paintingData = await response.json()
        this.createPaintingsFromData()
    }

    /**
     * Replace paintings at runtime with data received via postMessage.
     * Used by the curator page to push a new exhibition into the gallery iframe.
     */
    swapPaintings(paintingData) {
        if (!Array.isArray(paintingData) || paintingData.length === 0) return

        // Remove existing painting groups from the scene
        for (const group of this.groups) {
            if (group.parent) group.parent.remove(group)
            group.traverse((child) => {
                if (child.isMesh) {
                    child.geometry?.dispose()
                    if (child.material) {
                        if (child.material.map) child.material.map.dispose()
                        child.material.dispose()
                    }
                }
            })
        }
        this.groups = []
        this.paintingMeshes = []
        this.spotlights = []

        this.paintingData = paintingData
        this.createPaintingsFromData()

        // Re-attach paintings to the current scene's slots
        const world = this.experience.world
        if (world) {
            world.attachPaintingsToScene()
        }
    }

    createPaintingsFromData() {
        this.paintingData.forEach((painting, index) => {
            const position = Array.isArray(painting.position) ? painting.position : [0, 3.5, 0]
            this.createPainting(painting, position, index)
        })
    }

    createPainting(paintingData, position, index) {
        const group = new THREE.Group()
        group.userData.paintingIndex = index
        group.userData.defaultPosition = [...position]
        group.userData.defaultRotation = this.deriveRotation(position)

        const canvasGeometry = new THREE.PlaneGeometry(3.5, 2.2)

        const canvasMaterial = new THREE.MeshStandardMaterial({
            color: this.getColorFromTitle(paintingData.title),
            roughness: 0.9,
            metalness: 0.0,
            transparent: false,
            side: THREE.DoubleSide,
            envMapIntensity: 0.1,
        })

        const textureLoader = new THREE.TextureLoader()
        // imageFile can be a relative path (textures/paintings/pic.jpg)
        // or a full URL (https://example.com/pic.jpg)
        const imgUrl = paintingData.imageFile.startsWith('http')
            ? paintingData.imageFile
            : `./${paintingData.imageFile}`
        textureLoader.load(
            imgUrl,
            (texture) => {
                canvasMaterial.map = texture
                canvasMaterial.emissiveMap = texture
                canvasMaterial.needsUpdate = true
                canvasMaterial.color.setHex(0xffffff)
            },
            undefined,
            (error) => {}
        )

        const canvas = new THREE.Mesh(canvasGeometry, canvasMaterial)
        canvas.position.z = 0.065
        canvas.userData.painting = paintingData
        canvas.name = `painting-${paintingData.title?.replace(/\s+/g, '-') || 'untitled'}`

        group.add(canvas)
        group.userData.canvas = canvas
        this.paintingMeshes.push(canvas)

        const spotLight = new THREE.SpotLight(0xffffff, 80, 10, Math.PI * 0.23, 0.3, 2)
        spotLight.position.set(0, 3.7, 2)
        spotLight.target = canvas
        spotLight.visible = false
        spotLight.castShadow = true
        spotLight.shadow.mapSize.set(1024, 1024)
        spotLight.shadow.camera.near = 1
        spotLight.shadow.camera.far = 8
        spotLight.shadow.bias = -0.001

        group.add(spotLight)
        this.spotlights.push(spotLight)

        if (this.resources.items.pictureFrame) {
            const frameModel = this.resources.items.pictureFrame.scene.clone()

            frameModel.scale.set(3.0, 2.5, 2.5)
            frameModel.position.set(0, 3.15, 0)
            frameModel.rotation.x = Math.PI / 2
            frameModel.rotation.y = Math.PI / 2
            frameModel.rotation.z = Math.PI / 2

            frameModel.traverse((child) => {
                if (child.isMesh) {
                    child.receiveShadow = true
                    child.castShadow = true
                }
            })

            group.add(frameModel)
            group.userData.frame = frameModel
        }

        group.position.set(...position)
        group.rotation.y = group.userData.defaultRotation

        this.scene.add(group)
        this.groups.push(group)
    }

    deriveRotation(position) {
        const [px, , pz] = position
        if (Math.abs(pz) >= Math.abs(px)) {
            return pz < 0 ? 0 : Math.PI
        } else {
            return px < 0 ? Math.PI * 0.5 : -Math.PI * 0.5
        }
    }

    attachToSlots(slots) {
        if (!slots || slots.length === 0) return

        slots.forEach((slot, index) => {
            const group = this.groups.find(g => g.userData.paintingIndex === index)
            if (!group) return

            const slotWorldPos = new THREE.Vector3()
            const slotWorldQuat = new THREE.Quaternion()
            slot.getWorldPosition(slotWorldPos)
            slot.getWorldQuaternion(slotWorldQuat)

            if (group.parent) {
                group.parent.remove(group)
            }
            this.scene.add(group)

            const forward = new THREE.Vector3(0, 0, 0.07).applyQuaternion(slotWorldQuat)
            group.position.copy(slotWorldPos).add(forward)
            group.quaternion.copy(slotWorldQuat)

            // Scale the artwork to fit inside the scene's display frame —
            // the gallery canvas (3.5x2.2) is larger than some scene slots,
            // which made it clip through the frame bars.
            const slotW = slot.geometry?.parameters?.width || 3.5
            const slotH = slot.geometry?.parameters?.height || 2.2
            const fitScale = Math.min(slotW / 3.5, slotH / 2.2) * 0.96
            group.scale.setScalar(fitScale)

            // Make the artwork self-lit so it stays visible in dark scenes
            const canvas = group.userData.canvas
            if (canvas) {
                canvas.material.emissive.setHex(0xffffff)
                canvas.material.emissiveIntensity = 0.85
                canvas.material.needsUpdate = true
            }

            // Scenes provide their own display stands — hide the gallery frame
            if (group.userData.frame) {
                group.userData.frame.visible = false
            }

            const spotLight = this.spotlights[index]
            if (spotLight) {
                spotLight.visible = false
            }
        })
    }

    resetToDefault() {
        this.groups.forEach((group) => {
            if (group.parent) {
                group.parent.remove(group)
            }
            this.scene.add(group)
            group.position.set(...group.userData.defaultPosition)
            group.rotation.set(0, group.userData.defaultRotation, 0)
            group.scale.setScalar(1)

            const canvas = group.userData.canvas
            if (canvas) {
                canvas.material.emissive.setHex(0x000000)
                canvas.material.emissiveIntensity = 0
                canvas.material.needsUpdate = true
            }

            if (group.userData.frame) {
                group.userData.frame.visible = true
            }
        })
    }

    setSpotlightsVisible(visible) {
        this.spotlights.forEach(light => {
            light.visible = visible
        })
    }

    getColorFromTitle(title) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f39c12', '#9b59b6', '#2ecc71', '#e74c3c', '#f1c40f']
        const hash = title.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0)
            return a & a
        }, 0)
        return colors[Math.abs(hash) % colors.length]
    }
}
