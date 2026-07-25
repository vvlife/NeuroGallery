import {GUI} from 'lil-gui'

export default class Debug {
    constructor() {
        // Always enable GUI, but allow hiding it
        this.active = true
        this.visible = window.location.hash === '#debug' || window.location.hash === '#gui'

        if (this.active) {
            this.ui = new GUI({
                width: 320,
                title: 'Neuro-Gallery Controls'
            })

            // Hide initially if not in debug mode
            if (!this.visible) {
                this.ui.hide()
            }

            // Add toggle button
            this.addGlobalControls()
        }
    }

    addGlobalControls() {
        // Add show/hide toggle
        const globalSettings = {
            showControls: this.visible,
            fullscreen: false,
            resetAll: () => {
                if (window.experience) {
                    // Reset camera
                    if (window.experience.camera) {
                        window.experience.camera.instance.position.set(0, 1.6, 5)
                        window.experience.camera.instance.fov = 75
                        window.experience.camera.instance.updateProjectionMatrix()
                    }

                    // Reset environment to day
                    if (window.experience.world?.environment) {
                        window.experience.world.environment.switchTimeOfDay('day')
                    }
                }
            }
        }

        const globalFolder = this.ui.addFolder('🎮 Global Controls')
        globalFolder.add(globalSettings, 'showControls').name('Show Controls').onChange((value) => {
            this.visible = value
            if (value) {
                this.ui.show()
            } else {
                this.ui.hide()
            }
        })

        globalFolder.add(globalSettings, 'fullscreen').name('Fullscreen').onChange((value) => {
            if (value) {
                document.documentElement.requestFullscreen()
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen()
                }
            }
        })

        globalFolder.add(globalSettings, 'resetAll').name('🔄 Reset All Settings')
        globalFolder.open()
    }

    show() {
        if (this.ui) {
            this.ui.show()
            this.visible = true
        }
    }

    hide() {
        if (this.ui) {
            this.ui.hide()
            this.visible = false
        }
    }

    toggle() {
        if (this.visible) {
            this.hide()
        } else {
            this.show()
        }
    }
} 