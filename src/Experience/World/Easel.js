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

        this.createEasel()

        // Bind the event handler once and store it
        this.boundHandleEaselClick = this.handleEaselClick.bind(this)
        this.setupEventListeners()
    }

    createEasel() {
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
        const canvasGeometry = new THREE.PlaneGeometry(1.2, 1.2)
        const canvasMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.0
        })

        this.canvas = new THREE.Mesh(canvasGeometry, canvasMaterial)
        this.canvas.position.set(0, 2.3, -1.22)
        this.canvas.rotation.x = -0.28
        this.canvas.userData.clickable = true
        this.canvas.userData.type = 'easel-canvas'
        this.canvas.name = 'easel-canvas'

        this.easelGroup.add(this.canvas)
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

        // Re-enter pointer lock after a short delay
        setTimeout(() => {
            const canvas = this.experience.canvas
            if (canvas && document.hasFocus()) {
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