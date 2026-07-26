import * as THREE from 'three'
import Experience from '../Experience.js'
import OpenAIService from '../Utils/OpenAIService.js'

export default class Easel {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.camera = this.experience.camera

        this.openAIService = new OpenAIService()
        this.easelGroup = null
        this.canvas = null
        this.isGenerating = false
        this.modalOpen = false
        this.currentSceneKey = 'gallery'

        this.createEasel()

        // Bind the event handler once and store it
        this.boundHandleEaselClick = this.handleEaselClick.bind(this)
        this.setupEventListeners()
    }

    createEasel() {
        this.createGalleryEasel()
    }

    // Shared canvas material: double-sided with the default artwork, so
    // every scene's easel reads from any direction.
    createCanvasMaterial() {
        const canvasMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.DoubleSide
        })

        new THREE.TextureLoader().load(
            '/textures/animalcrossing/easel-default.png',
            (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace
                canvasMaterial.map = tex
                canvasMaterial.emissiveMap = tex
                canvasMaterial.emissive = new THREE.Color(0xffffff)
                canvasMaterial.emissiveIntensity = 0.55
                canvasMaterial.needsUpdate = true
            }
        )

        return canvasMaterial
    }

    // Mirrored back panel behind a scene easel's canvas (shares material)
    addBackCanvas(size, frontZ, rotX = 0) {
        const backCanvas = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            this.canvas.material
        )
        backCanvas.position.set(this.canvas.position.x, this.canvas.position.y, frontZ - 0.06)
        backCanvas.rotation.set(rotX, Math.PI, 0)
        backCanvas.name = 'easel-canvas-back'
        this.easelGroup.add(backCanvas)
        this.backCanvas = backCanvas
    }

    createGalleryEasel() {
        if (!this.resources.items.easel) {
            return
        }

        // Create main group
        this.easelGroup = new THREE.Group()

        // Add the easel model
        const easelModel = this.resources.items.easel.scene.clone()
        easelModel.scale.set(2, 2, 2)
        easelModel.position.set(-1.35, 0, 0)

        // Set up shadows
        easelModel.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true
                child.castShadow = true
                child.userData.clickable = true
                child.userData.type = 'easel'
            }
        })

        this.easelGroup.add(easelModel)

        // Create canvas for generated image
        this.createCanvas()

        // Position easel in center of room
        this.easelGroup.position.set(0, 0, 0)

        this.scene.add(this.easelGroup)
    }

    createCanvas() {
        const canvasGeometry = new THREE.PlaneGeometry(1.4, 1.4)
        const canvasMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.DoubleSide
        })

        // Default artwork so the easel never looks like a blank board;
        // replaced once the visitor generates their own piece.
        const defaultTexture = new THREE.TextureLoader().load(
            '/textures/animalcrossing/easel-default.png',
            (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace
                canvasMaterial.map = tex
                canvasMaterial.emissiveMap = tex
                canvasMaterial.emissive = new THREE.Color(0xffffff)
                canvasMaterial.emissiveIntensity = 0.55
                canvasMaterial.needsUpdate = true
            }
        )

        this.canvas = new THREE.Mesh(canvasGeometry, canvasMaterial)
        this.canvas.position.set(0, 2.3, -1.18)
        this.canvas.rotation.x = -0.28
        this.canvas.userData.clickable = true
        this.canvas.userData.type = 'easel-canvas'
        this.canvas.name = 'easel-canvas'

        this.easelGroup.add(this.canvas)

        // Back panel sharing the same material — pushed slightly past the
        // easel model's own back board so the artwork reads from behind too
        this.backCanvas = new THREE.Mesh(canvasGeometry, canvasMaterial)
        this.backCanvas.position.set(0, 2.3, -1.42)
        this.backCanvas.rotation.set(-0.28, Math.PI, 0)
        this.backCanvas.name = 'easel-canvas-back'

        this.easelGroup.add(this.backCanvas)

        // Invisible, generous hit-box around the whole easel so it is easy to
        // click/tap — the actual easel canvas is small and hard to hit,
        // especially on touch screens.
        const hitboxGeometry = new THREE.BoxGeometry(2.6, 3.2, 2.4)
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false
        })
        this.hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial)
        this.hitbox.position.set(0, 1.6, 0)
        this.hitbox.userData.clickable = true
        this.hitbox.userData.type = 'easel-canvas'
        this.hitbox.name = 'easel-hitbox'

        this.easelGroup.add(this.hitbox)
    }

    // ─── Animal Crossing: wooden stand with a canvas on top ───
    createAnimalCrossingEasel() {
        this.easelGroup = new THREE.Group()

        const woodMaterial = new THREE.MeshStandardMaterial({ color: '#a0703d', roughness: 0.9 })
        const darkWoodMaterial = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.85 })

        // Three legs forming a tripod
        const legPositions = [
            { angle: 0, tilt: 0.15 },
            { angle: Math.PI * 2 / 3, tilt: 0.15 },
            { angle: Math.PI * 4 / 3, tilt: 0.15 }
        ]
        legPositions.forEach(({ angle, tilt }) => {
            const leg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8),
                darkWoodMaterial
            )
            leg.position.set(Math.cos(angle) * 0.45, 1.6, Math.sin(angle) * 0.45)
            leg.rotation.z = Math.cos(angle) * tilt
            leg.rotation.x = Math.sin(angle) * tilt
            leg.castShadow = true
            leg.receiveShadow = true
            leg.userData.clickable = true
            leg.userData.type = 'easel'
            this.easelGroup.add(leg)
        })

        // Crossbar
        const crossbar = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.08, 0.08),
            woodMaterial
        )
        crossbar.position.set(0, 1.2, 0)
        crossbar.castShadow = true
        crossbar.userData.clickable = true
        crossbar.userData.type = 'easel'
        this.easelGroup.add(crossbar)

        // Canvas board (double-sided with default artwork + mirrored back)
        const boardGeometry = new THREE.PlaneGeometry(1.4, 1.4)
        this.canvas = new THREE.Mesh(boardGeometry, this.createCanvasMaterial())
        this.canvas.position.set(0, 2.3, -0.15)
        this.canvas.rotation.x = -0.1
        this.canvas.userData.clickable = true
        this.canvas.userData.type = 'easel-canvas'
        this.canvas.name = 'easel-canvas'
        this.easelGroup.add(this.canvas)
        this.addBackCanvas(1.4, -0.15, -0.1)

        this.easelGroup.position.set(0, 0, 0)
        this.scene.add(this.easelGroup)
    }

    // ─── Space Scene: floating holographic pedestal ───
    createSpaceEasel() {
        this.easelGroup = new THREE.Group()

        const metalMaterial = new THREE.MeshStandardMaterial({
            color: '#2a3a5e',
            roughness: 0.3,
            metalness: 0.9
        })
        const glowMaterial = new THREE.MeshStandardMaterial({
            color: '#00d4ff',
            emissive: '#00d4ff',
            emissiveIntensity: 0.6,
            roughness: 0.2
        })

        // Base disc
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(1.2, 1.5, 0.3, 16),
            metalMaterial
        )
        base.position.y = 0.15
        base.castShadow = true
        base.receiveShadow = true
        base.userData.clickable = true
        base.userData.type = 'easel'
        this.easelGroup.add(base)

        // Glowing ring
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.3, 0.06, 8, 32),
            glowMaterial
        )
        ring.rotation.x = Math.PI / 2
        ring.position.y = 0.3
        this.easelGroup.add(ring)

        // Vertical support beam
        const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8),
            metalMaterial
        )
        beam.position.y = 1.55
        beam.castShadow = true
        beam.userData.clickable = true
        beam.userData.type = 'easel'
        this.easelGroup.add(beam)

        // Holographic screen frame
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 1.4, 0.06),
            metalMaterial
        )
        frame.position.y = 2.5
        frame.castShadow = true
        frame.userData.clickable = true
        frame.userData.type = 'easel'
        this.easelGroup.add(frame)

        // Holographic canvas (double-sided with default artwork + back)
        const canvasGeometry = new THREE.PlaneGeometry(1.2, 1.2)
        const holoMaterial = this.createCanvasMaterial()
        holoMaterial.roughness = 0.2
        holoMaterial.metalness = 0.1
        this.canvas = new THREE.Mesh(canvasGeometry, holoMaterial)
        this.canvas.position.set(0, 2.5, 0.04)
        this.canvas.userData.clickable = true
        this.canvas.userData.type = 'easel-canvas'
        this.canvas.name = 'easel-canvas'
        this.easelGroup.add(this.canvas)
        this.addBackCanvas(1.2, 0.04)

        // Floating particles around pedestal
        const particleCount = 50
        const positions = new Float32Array(particleCount * 3)
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2
            const r = 1.5 + Math.random() * 0.5
            positions[i * 3] = Math.cos(angle) * r
            positions[i * 3 + 1] = 1 + Math.random() * 2
            positions[i * 3 + 2] = Math.sin(angle) * r
        }
        const particleGeo = new THREE.BufferGeometry()
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const particleMat = new THREE.PointsMaterial({
            color: '#00d4ff',
            size: 0.08,
            transparent: true,
            opacity: 0.7
        })
        const particles = new THREE.Points(particleGeo, particleMat)
        particles.name = 'easel-particles'
        this.easelGroup.add(particles)

        this.easelGroup.position.set(0, 0, 0)
        this.scene.add(this.easelGroup)
    }

    // ─── Cyberpunk: neon-edged tech terminal ───
    createCyberpunkEasel() {
        this.easelGroup = new THREE.Group()

        const darkMetalMaterial = new THREE.MeshStandardMaterial({
            color: '#1a1a2e',
            roughness: 0.3,
            metalness: 0.9
        })
        const neonMagenta = new THREE.MeshStandardMaterial({
            color: '#ff00ff',
            emissive: '#ff00ff',
            emissiveIntensity: 1.2,
            roughness: 0.2
        })
        const neonCyan = new THREE.MeshStandardMaterial({
            color: '#00ffff',
            emissive: '#00ffff',
            emissiveIntensity: 1.0,
            roughness: 0.2
        })

        // Base platform
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.3, 1.8),
            darkMetalMaterial
        )
        base.position.y = 0.15
        base.castShadow = true
        base.receiveShadow = true
        base.userData.clickable = true
        base.userData.type = 'easel'
        this.easelGroup.add(base)

        // Neon strips on base
        const baseStripFront = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.03, 0.03),
            neonCyan
        )
        baseStripFront.position.set(0, 0.3, 0.9)
        this.easelGroup.add(baseStripFront)

        const baseStripBack = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.03, 0.03),
            neonMagenta
        )
        baseStripBack.position.set(0, 0.3, -0.9)
        this.easelGroup.add(baseStripBack)

        // Central pillar
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.15, 2.2, 8),
            darkMetalMaterial
        )
        pillar.position.y = 1.4
        pillar.castShadow = true
        pillar.userData.clickable = true
        pillar.userData.type = 'easel'
        this.easelGroup.add(pillar)

        // Screen frame
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 1.6, 0.08),
            darkMetalMaterial
        )
        frame.position.y = 2.6
        frame.castShadow = true
        frame.userData.clickable = true
        frame.userData.type = 'easel'
        this.easelGroup.add(frame)

        // Neon border (magenta on top, cyan on bottom)
        const neonTop = new THREE.Mesh(
            new THREE.BoxGeometry(1.7, 0.06, 0.1),
            neonMagenta
        )
        neonTop.position.set(0, 3.35, 0)
        this.easelGroup.add(neonTop)

        const neonBottom = new THREE.Mesh(
            new THREE.BoxGeometry(1.7, 0.06, 0.1),
            neonCyan
        )
        neonBottom.position.set(0, 1.85, 0)
        this.easelGroup.add(neonBottom)

        const neonLeft = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 1.7, 0.1),
            neonCyan
        )
        neonLeft.position.set(-0.82, 2.6, 0)
        this.easelGroup.add(neonLeft)

        const neonRight = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 1.7, 0.1),
            neonMagenta
        )
        neonRight.position.set(0.82, 2.6, 0)
        this.easelGroup.add(neonRight)

        // Screen / canvas (double-sided with default artwork + back)
        const canvasGeometry = new THREE.PlaneGeometry(1.3, 1.3)
        const screenMaterial = this.createCanvasMaterial()
        screenMaterial.roughness = 0.2
        screenMaterial.metalness = 0.1
        this.canvas = new THREE.Mesh(canvasGeometry, screenMaterial)
        this.canvas.position.set(0, 2.6, 0.05)
        this.canvas.userData.clickable = true
        this.canvas.userData.type = 'easel-canvas'
        this.canvas.name = 'easel-canvas'
        this.easelGroup.add(this.canvas)
        this.addBackCanvas(1.3, 0.05)

        this.easelGroup.position.set(0, 0, 0)
        this.scene.add(this.easelGroup)
    }

    destroyEasel() {
        if (this.easelGroup) {
            // Dispose geometries and materials
            this.easelGroup.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose()
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose())
                        } else {
                            child.material.dispose()
                        }
                    }
                }
                if (child.isPoints) {
                    if (child.geometry) child.geometry.dispose()
                    if (child.material) child.material.dispose()
                }
            })
            this.scene.remove(this.easelGroup)
            this.easelGroup = null
            this.canvas = null
        }
    }

    adaptToScene(sceneKey) {
        if (this.currentSceneKey === sceneKey && this.easelGroup) return

        this.destroyEasel()
        this.currentSceneKey = sceneKey

        switch (sceneKey) {
            case 'gallery':
                this.createGalleryEasel()
                break
            case 'animalCrossing':
                this.createAnimalCrossingEasel()
                break
            case 'space':
                this.createSpaceEasel()
                break
            case 'cyberpunk':
                this.createCyberpunkEasel()
                break
            default:
                this.createGalleryEasel()
        }
    }

    setupEventListeners() {
        // Listen for click events from the camera/controls
        document.removeEventListener('easel-clicked', this.boundHandleEaselClick) // Ensure no duplicates
        document.addEventListener('easel-clicked', this.boundHandleEaselClick)
    }

    destroy() {
        // Clean up event listeners to prevent memory leaks
        document.removeEventListener('easel-clicked', this.boundHandleEaselClick)

        // Add any other cleanup logic here (e.g., removing the easel group from the scene)
        if (this.easelGroup) {
            this.scene.remove(this.easelGroup)
        }
    }

    handleEaselClick() {
        if (this.isGenerating) {
            return
        }

        if (this.modalOpen) {
            return
        }

        this.showPromptDialog()
    }

    showPromptDialog() {
        // Prevent multiple modals
        if (this.modalOpen) return
        this.modalOpen = true

        // Temporarily disable player controls and exit pointer lock
        this.disablePlayerControls()

        // Create modal overlay
        const overlay = document.createElement('div')
        overlay.id = 'easel-prompt-overlay'
        overlay.className = 'easel-modal-overlay'

        // Create prompt dialog
        const dialog = document.createElement('div')
        dialog.className = 'easel-modal-dialog'

        dialog.innerHTML = `
            <button class="easel-modal-close">×</button>
            <h2 class="easel-modal-title">🎨 Generate AI Art</h2>
            <p class="easel-modal-description">
                Enter a prompt to generate an image with DALL-E 3
            </p>
            <textarea 
                id="prompt-input" 
                placeholder="Describe the image you want to generate..."
            ></textarea>
            <div class="easel-modal-buttons">
                <button 
                    id="generate-btn"
                    class="easel-modal-btn easel-modal-btn-primary"
                >
                    Generate Image
                </button>
                <button 
                    id="cancel-btn"
                    class="easel-modal-btn easel-modal-btn-secondary"
                >
                    Cancel
                </button>
            </div>
        `

        overlay.appendChild(dialog)
        document.body.appendChild(overlay)

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('show')
            dialog.classList.add('show')
        })

        // Focus on textarea and handle input styling
        const textarea = dialog.querySelector('#prompt-input')
        setTimeout(() => {
            textarea.focus()
        }, 100)

        // Focus handling (CSS handles styling)
        const closeBtn = dialog.querySelector('.easel-modal-close')

        // Event listeners with proper cleanup
        const closeModal = () => {
            this.closeModal(overlay)
        }

        const generateBtn = dialog.querySelector('#generate-btn')
        const cancelBtn = dialog.querySelector('#cancel-btn')

        const handleGenerate = (e) => {
            e.stopPropagation() // Prevent click-through
            const prompt = textarea.value.trim()
            if (prompt) {
                this.generateImage(prompt)
                this.closeModal(overlay)
            } else {
                textarea.style.borderColor = '#e74c3c'
                textarea.focus()
                setTimeout(() => {
                    textarea.style.borderColor = '#ddd'
                }, 2000)
            }
        }

        generateBtn.addEventListener('click', handleGenerate)
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation() // Prevent click-through
            closeModal()
        })
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation() // Prevent click-through
            closeModal()
        })

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            e.stopPropagation() // Prevent click-through
            if (e.target === overlay) {
                closeModal()
            }
        })

        // Handle keyboard events
        const handleKeyDown = (e) => {
            e.stopPropagation() // Prevent player controls from receiving events

            if (e.key === 'Escape') {
                closeModal()
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleGenerate()
            }
        }

        // Add keyboard listener
        document.addEventListener('keydown', handleKeyDown, true) // Use capture phase

        // Store cleanup function
        overlay.cleanup = () => {
            document.removeEventListener('keydown', handleKeyDown, true)
        }
    }

    closeModal(overlay) {
        if (!overlay || !document.body.contains(overlay)) return

        // Animate out
        overlay.classList.remove('show')
        const dialog = overlay.querySelector('.easel-modal-dialog')
        if (dialog) {
            dialog.classList.remove('show')
        }

        setTimeout(() => {
            if (document.body.contains(overlay)) {
                // Clean up event listeners
                if (overlay.cleanup) {
                    overlay.cleanup()
                }
                document.body.removeChild(overlay)
            }

            // Re-enable player controls and pointer lock
            this.enablePlayerControls()
            this.modalOpen = false
        }, 200)
    }

    disablePlayerControls() {
        // Set flag to prevent entry screen from showing
        if (this.experience.playerControls) {
            this.experience.playerControls.temporaryPointerLockExit = true
        }

        // Exit pointer lock to show cursor
        if (document.pointerLockElement) {
            document.exitPointerLock()
        }

        // Temporarily disable player controls
        if (this.experience.playerControls) {
            this.experience.playerControls.temporarilyDisable()
        }

        // Show cursor
        document.body.style.cursor = 'default'
    }

    enablePlayerControls() {
        // Re-enable player controls
        if (this.experience.playerControls) {
            this.experience.playerControls.enable()
            // Reset the temporary flag
            this.experience.playerControls.temporaryPointerLockExit = false
        }

        // Re-enter pointer lock after a short delay (desktop only — touch
        // devices have no pointer lock and calling it throws)
        setTimeout(() => {
            const canvas = this.experience.canvas
            if (canvas && document.hasFocus() && canvas.requestPointerLock) {
                canvas.requestPointerLock()
            }
        }, 50)
    }

    async generateImage(prompt) {
        this.isGenerating = true
        this.showLoadingIndicator()

        try {
            // Backend proxy returns a blob object URL — safe, no API key in the client.
            const imageUrl = await this.openAIService.generateImage(prompt)

            const textureLoader = new THREE.TextureLoader()
            textureLoader.load(
                imageUrl,
                (texture) => {
                    // Success
                    this.canvas.material.map = texture
                    this.canvas.material.needsUpdate = true

                    this.hideLoadingIndicator()
                    this.showMessage('✅ Image displayed successfully!')

                    this.canvas.userData.generatedPrompt = prompt
                    this.canvas.userData.generatedAt = new Date().toISOString()
                    this.canvas.userData.imageUrl = imageUrl
                },
                undefined,
                (error) => {
                    // Error loading the returned image
                    this.createTextPlaceholder(prompt, 'Failed to load the generated image.')
                }
            )

        } catch (error) {
            this.createTextPlaceholder(prompt, error && error.message ? error.message : 'Could not generate image. Check the backend server and API key.')
        } finally {
            this.isGenerating = false
        }
    }

    createTextPlaceholder(prompt, reason = 'An unknown error occurred.') {
        // Create a canvas with text
        const canvas = document.createElement('canvas')
        canvas.width = 1024
        canvas.height = 1024
        const ctx = canvas.getContext('2d')

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
        gradient.addColorStop(0, '#485563')
        gradient.addColorStop(1, '#29323c')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Border
        ctx.strokeStyle = '#e74c3c'
        ctx.lineWidth = 12
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)

        // Title
        ctx.fillStyle = '#ecf0f1'
        ctx.font = 'bold 52px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('❌ Generation Failed', canvas.width / 2, 150)

        // Icon
        ctx.font = '120px Arial'
        ctx.fillText('🖼️', canvas.width / 2, 300)

        // Reason
        ctx.font = 'bold 32px Arial'
        ctx.fillStyle = '#e74c3c'
        const reasonLines = this.wrapText(ctx, reason, canvas.width - 100)
        reasonLines.slice(0, 3).forEach((line, index) => {
            ctx.fillText(line, canvas.width / 2, 400 + (index * 40))
        })

        // Prompt
        ctx.font = 'italic 28px Arial'
        ctx.fillStyle = '#bdc3c7'
        ctx.fillText('Attempted prompt:', canvas.width / 2, 550)

        const promptLines = this.wrapText(ctx, prompt, canvas.width - 100)
        ctx.font = '28px Arial'
        promptLines.slice(0, 4).forEach((line, index) => {
            ctx.fillText(line, canvas.width / 2, 600 + (index * 38))
        })

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true

        // Apply to material
        this.canvas.material.map = texture
        this.canvas.material.needsUpdate = true

        // Store info
        this.canvas.userData.generatedPrompt = prompt
        this.canvas.userData.generatedAt = new Date().toISOString()
        this.canvas.userData.isPlaceholder = true
        this.canvas.userData.placeholderReason = reason

        this.hideLoadingIndicator()
        this.showMessage(`⚠️ ${reason}`)
    }

    wrapText(context, text, maxWidth) {
        const words = text.split(' ')
        const lines = []
        let currentLine = words[0] || ''

        for (let i = 1; i < words.length; i++) {
            const word = words[i]
            const width = context.measureText(currentLine + ' ' + word).width
            if (width < maxWidth) {
                currentLine += ' ' + word
            } else {
                lines.push(currentLine)
                currentLine = word
            }
        }
        lines.push(currentLine)
        return lines
    }

    showLoadingIndicator() {
        const loader = document.createElement('div')
        loader.id = 'easel-loader'
        loader.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            z-index: 1001;
            font-size: 16px;
            backdrop-filter: blur(10px);
        `
        loader.innerHTML = '🎨 Generating image...'
        document.body.appendChild(loader)
    }

    hideLoadingIndicator() {
        const loader = document.getElementById('easel-loader')
        if (loader) {
            document.body.removeChild(loader)
        }
    }

    showMessage(message) {
        const msg = document.createElement('div')
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            z-index: 1001;
            font-size: 16px;
            backdrop-filter: blur(10px);
        `
        msg.textContent = message
        document.body.appendChild(msg)

        setTimeout(() => {
            if (document.body.contains(msg)) {
                document.body.removeChild(msg)
            }
        }, 3000)
    }

    getClickableObjects() {
        const clickables = []

        if (this.easelGroup) {
            this.easelGroup.traverse((child) => {
                if (child.userData.clickable) {
                    clickables.push(child)
                }
            })
        }

        return clickables
    }
} 