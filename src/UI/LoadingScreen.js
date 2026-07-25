import Experience from '../Experience/Experience.js'

export default class LoadingScreen {
    constructor() {
        this.experience = new Experience()
        this.resources = this.experience.resources

        this.loadingScreen = document.querySelector('.loading-screen')
        this.loadingBar = document.querySelector('.loading-bar')
        this.loadingText = document.querySelector('.loading-text')
        this.loadingProgress = document.querySelector('.loading-progress')

        this.updateProgress(0)

        this.resources.on('progress', (progressRatio) => {
            this.updateProgress(progressRatio)
        })

        this.resources.on('ready', () => {
            // Ensure 100% is shown before hiding
            this.updateProgress(1)
            setTimeout(() => {
                this.hide()
            }, 200)
        })
    }

    updateProgress(progressRatio) {
        const percentage = Math.round(progressRatio * 100)

        if (this.loadingBar) {
            this.loadingBar.style.width = `${percentage}%`
        }

        if (this.loadingProgress) {
            this.loadingProgress.textContent = `${percentage}%`
        }

        if (this.loadingText) {
            if (percentage === 100) {
                this.loadingText.textContent = 'Ready!'
            } else if (percentage === 0) {
                this.loadingText.textContent = 'Initializing...'
            } else {
                this.loadingText.textContent = 'Loading Assets...'
            }
        }
    }

    hide() {
        if (this.loadingScreen) {
            this.loadingScreen.style.opacity = '0'
            setTimeout(() => {
                this.loadingScreen.style.display = 'none'
            }, 500)
        }
    }

    show() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'flex'
            this.loadingScreen.style.opacity = '1'
        }
    }
} 