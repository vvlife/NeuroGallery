import Experience from '../Experience/Experience.js'

export default class FpsCounter {
    constructor() {
        this.experience = new Experience()

        this.fpsCounter = document.querySelector('.fps-counter')
        this.fpsValue = document.querySelector('.fps-value')

        this.frames = 0
        this.lastTime = Date.now()
        this.fps = 0
    }

    update() {
        this.frames++
        const currentTime = Date.now()

        if (currentTime - this.lastTime >= 1000) {
            this.fps = Math.round((this.frames * 1000) / (currentTime - this.lastTime))
            this.frames = 0
            this.lastTime = currentTime

            if (this.fpsValue) {
                this.fpsValue.textContent = this.fps
            }
        }
    }

    show() {
        if (this.fpsCounter) {
            this.fpsCounter.style.display = 'block'
        }
    }

    hide() {
        if (this.fpsCounter) {
            this.fpsCounter.style.display = 'none'
        }
    }
} 