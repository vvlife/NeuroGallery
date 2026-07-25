export default class PaintingInfo {
    constructor() {
        this.panel = document.querySelector('.painting-info-panel')
        this.title = document.querySelector('.painting-info-title')
        this.model = document.querySelector('.painting-info-model')
        this.prompt = document.querySelector('.painting-info-prompt')
        this.closeButton = document.querySelector('.painting-info-close')

        this.closeButton?.addEventListener('click', () => {
            this.hide()
        })

        // Close on outside click
        this.panel?.addEventListener('click', (event) => {
            if (event.target === this.panel) {
                this.hide()
            }
        })

        // Close on escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isVisible()) {
                this.hide()
            }
        })
    }

    show(paintingData) {
        if (!this.panel) return

        // Update content
        if (this.title) this.title.textContent = paintingData.title || 'Untitled'
        if (this.model) this.model.textContent = `AI Model: ${paintingData.aiModel || 'Unknown'}`
        if (this.prompt) this.prompt.textContent = `Prompt: "${paintingData.prompt || 'No prompt available'}"`

        // Show panel
        this.panel.style.display = 'flex'
        setTimeout(() => {
            this.panel.style.opacity = '1'
        }, 10)
    }

    hide() {
        if (!this.panel) return

        this.panel.style.opacity = '0'
        setTimeout(() => {
            this.panel.style.display = 'none'
        }, 300)
    }

    isVisible() {
        return this.panel && window.getComputedStyle(this.panel).display !== 'none'
    }
} 