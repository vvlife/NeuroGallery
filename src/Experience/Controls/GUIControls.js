import * as THREE from 'three'
import Experience from '../Experience.js'

export default class GUIControls {
    constructor() {
        this.experience = new Experience()
        this.debug = this.experience.debug

        // Settings object to store all GUI values
        this.settings = {
            // Camera
            camera: {
                fov: 75,
                position: { x: 0, y: 1.6, z: 5 }
            },

            // Lighting
            lighting: {
                sunIntensity: 2.1,
                sunColor: '#ffffff',
                sunTemperature: 5500, // Kelvin
                ambientIntensity: 0.6,
                ambientColor: '#b9d5ff',
                shadowsEnabled: true
            },

            // Environment
            environment: {
                timeOfDay: 'day',
                fogEnabled: false,
                fogDensity: 0.01,
                fogColor: '#87CEEB'
            },

            // Renderer
            renderer: {
                toneMapping: 'ACESFilmicToneMapping',
                toneMappingExposure: 0.75,
                antialias: true
            },

            // Performance
            performance: {
                showFPS: true,
                pixelRatio: Math.min(window.devicePixelRatio, 2),
                shadowMapSize: 2048
            },

            // Audio
            audio: {
                volume: 0.5,
                muted: false
            },

            // Visual Effects
            effects: {
                particlesVisible: true,
                particleCount: 1000, // Match default from Particles.js
                particleSpeed: 5.0,  // Match default speed from Particles.js
                particleEffect: 'glow'
            }
        }

        if (this.debug.active) {
            this.setupGUI()
        }
    }

    setupGUI() {
        // Wait for world to be created with longer delay and better checks
        const checkWorld = () => {
            if (this.experience.world &&
                this.experience.camera &&
                this.experience.renderer &&
                this.experience.world.environment &&
                this.experience.world.particles) {
                this.createAllControls()
            } else {
                setTimeout(checkWorld, 200)
            }
        }
        checkWorld()
    }

    createAllControls() {
        // Camera Controls
        this.createCameraControls()

        // Lighting Controls  
        this.createLightingControls()

        // Environment Controls
        this.createEnvironmentControls()

        // Performance Monitor
        this.createPerformanceMonitor()

        // Player Controls
        this.createPlayerControls()

        // Visual Effects
        this.createVisualEffectsControls()

        // Audio Controls
        this.createAudioControls()

        // Renderer Settings
        this.createRendererControls()
    }

    createCameraControls() {
        const folder = this.debug.ui.addFolder('📷 Camera')

        // FOV Control
        folder.add(this.settings.camera, 'fov', 30, 120, 1)
            .name('Field of View')
            .onChange((value) => {
                this.experience.camera.instance.fov = value
                this.experience.camera.instance.updateProjectionMatrix()
            })

        // Camera Height Control
        folder.add(this.experience.camera.instance.position, 'y', 0.5, 10, 0.1)
            .name('Camera Height')
            .onChange((value) => {
                this.settings.camera.position.y = value
            })

        // Position Reset
        folder.add({
            resetPosition: () => {
                this.experience.camera.instance.position.set(0, 1.6, 5)
                this.settings.camera.position = { x: 0, y: 1.6, z: 5 }
            }
        }, 'resetPosition').name('🏠 Reset Position')

        folder.open()
    }

    createLightingControls() {
        const folder = this.debug.ui.addFolder('💡 Lighting')

        if (!this.experience.world?.environment) {
            return
        }

        const env = this.experience.world.environment

        // Only add controls if lights exist
        if (env.sunLight) {
            // Sun Light
            const sunFolder = folder.addFolder('☀️ Sun Light')
            sunFolder.add(env.sunLight, 'intensity', 0, 10, 0.1)
                .name('Intensity')

            sunFolder.addColor(this.settings.lighting, 'sunColor')
                .name('Color')
                .onChange((value) => {
                    env.sunLight.color.setStyle(value)
                })

            sunFolder.add(this.settings.lighting, 'sunTemperature', 2000, 10000, 100)
                .name('Temperature (K)')
                .onChange((value) => {
                    const color = this.kelvinToRGB(value)
                    env.sunLight.color.setRGB(color.r / 255, color.g / 255, color.b / 255)
                })

            sunFolder.open()
        }

        if (env.ambientLight) {
            // Ambient Light
            const ambientFolder = folder.addFolder('🌍 Ambient Light')
            ambientFolder.add(env.ambientLight, 'intensity', 0, 2, 0.1)
                .name('Intensity')

            ambientFolder.addColor(this.settings.lighting, 'ambientColor')
                .name('Color')
                .onChange((value) => {
                    env.ambientLight.color.setStyle(value)
                })
        }

        // Shadows
        folder.add(this.settings.lighting, 'shadowsEnabled')
            .name('Shadows Enabled')
            .onChange((value) => {
                this.experience.renderer.instance.shadowMap.enabled = value
                if (env.sunLight) env.sunLight.castShadow = value
            })

        folder.open()
    }

    createEnvironmentControls() {
        const folder = this.debug.ui.addFolder('🌍 Environment')

        if (!this.experience.world?.environment) {
            return
        }

        const env = this.experience.world.environment

        // Time of Day
        folder.add(this.settings.environment, 'timeOfDay', ['day', 'night'])
            .name('Time of Day')
            .onChange((value) => {
                if (env.switchTimeOfDay) {
                    env.switchTimeOfDay(value)
                }
            })

        // Fog Controls
        folder.add(this.settings.environment, 'fogEnabled')
            .name('Fog Enabled')
            .onChange((value) => {
                if (value) {
                    this.experience.scene.fog = new THREE.Fog(
                        this.settings.environment.fogColor,
                        10,
                        50
                    )
                } else {
                    this.experience.scene.fog = null
                }
            })

        folder.add(this.settings.environment, 'fogDensity', 0, 0.1, 0.001)
            .name('Fog Density')
            .onChange((value) => {
                if (this.experience.scene.fog) {
                    this.experience.scene.fog.density = value
                }
            })

        folder.addColor(this.settings.environment, 'fogColor')
            .name('Fog Color')
            .onChange((value) => {
                if (this.experience.scene.fog) {
                    this.experience.scene.fog.color.setStyle(value)
                }
            })

        folder.open()
    }

    createPerformanceMonitor() {
        const folder = this.debug.ui.addFolder('⚡ Performance')

        // Performance stats
        const stats = {
            currentFPS: 0
        }

        // Add max FPS setting to performance settings
        this.settings.performance.maxFPS = 60

        // Update function
        const updateStats = () => {
            // FPS from time class
            if (this.experience.time && this.experience.time.delta > 0) {
                stats.currentFPS = Math.round(1000 / this.experience.time.delta)
            }
        }

        setInterval(updateStats, 100)

        // Add FPS display (read-only)
        folder.add(stats, 'currentFPS').name('Current FPS').listen().disable()

        // Add max FPS control
        folder.add(this.settings.performance, 'maxFPS', 30, 144, 1)
            .name('Max FPS')
            .onChange((value) => {
                if (this.experience.time) {
                    this.experience.time.setMaxFPS(value)
                }
            })

        // Performance settings
        folder.add(this.settings.performance, 'pixelRatio', 1, 3, 0.1)
            .name('Pixel Ratio')
            .onChange((value) => {
                this.experience.renderer.instance.setPixelRatio(value)
            })

        folder.add(this.settings.performance, 'shadowMapSize', [512, 1024, 2048, 4096])
            .name('Shadow Quality')
            .onChange((value) => {
                const env = this.experience.world.environment
                if (env?.sunLight?.shadow) {
                    env.sunLight.shadow.mapSize.width = value
                    env.sunLight.shadow.mapSize.height = value
                    env.sunLight.shadow.map?.dispose()
                    env.sunLight.shadow.map = null
                }
            })

        folder.open()
    }

    createPlayerControls() {
        const folder = this.debug.ui.addFolder('🎮 Player')

        if (this.experience.playerControls) {
            const controls = this.experience.playerControls

            folder.add(controls.settings, 'walkSpeed', 1, 15, 0.5)
                .name('Walk Speed')

            folder.add(controls.settings, 'sprintSpeed', 5, 25, 1)
                .name('Sprint Speed')

            folder.add(controls.settings, 'jumpHeight', 0.1, 2, 0.1)
                .name('Jump Height')

            folder.add(controls.settings, 'playerRadius', 0.1, 1, 0.1)
                .name('Collision Radius')

            folder.add({
                unlockMouse: () => {
                    if (this.experience.camera.controls.isLocked) {
                        this.experience.camera.controls.unlock()
                    }
                }
            }, 'unlockMouse').name('🖱️ Unlock Mouse')
        }
    }

    createVisualEffectsControls() {
        const folder = this.debug.ui.addFolder('✨ Visual Effects')

        if (!this.experience.world?.particles) {
            return
        }

        const particles = this.experience.world.particles

        // Sync initial values
        this.settings.effects.particlesVisible = particles.visible
        this.settings.effects.particleCount = particles.particleCount
        this.settings.effects.particleSpeed = particles.speed

        folder.add(this.settings.effects, 'particlesVisible')
            .name('Show Particles')
            .onChange((value) => {
                particles.visible = value
            })

        folder.add(this.settings.effects, 'particleCount', 0, 2000, 50)
            .name('Particle Count')
            .onChange((value) => {
                if (particles.updateCount) {
                    particles.updateCount(value)
                }
            })

        folder.add(this.settings.effects, 'particleSpeed', 0, 10, 0.1)
            .name('Particle Speed')
            .onChange((value) => {
                particles.speed = value
            })

        // Effect presets
        folder.add(this.settings.effects, 'particleEffect', ['glow', 'sparkle', 'subtle', 'default'])
            .name('Effect Type')
            .onChange((value) => {
                if (particles.setEffect) {
                    particles.setEffect(value)
                }
            })

        folder.open()
    }

    createAudioControls() {
        const folder = this.debug.ui.addFolder('🔊 Audio')

        if (!this.experience.world?.environment?.ambientSound) {
            folder.add(this.settings.audio, 'volume', 0, 1, 0.1).name('Volume (Not Available)')
            folder.add(this.settings.audio, 'muted').name('Muted (Not Available)')
            return
        }

        const env = this.experience.world.environment

        folder.add(this.settings.audio, 'volume', 0, 1, 0.1)
            .name('Volume')
            .onChange((value) => {
                if (env.setVolume) {
                    env.setVolume(value)
                }
            })

        folder.add(this.settings.audio, 'muted')
            .name('Muted')
            .onChange((value) => {
                if (value) {
                    if (env.stopAmbientMusic) env.stopAmbientMusic()
                } else {
                    if (env.playAmbientMusic) env.playAmbientMusic()
                }
            })

        if (env.playAmbientMusic && env.stopAmbientMusic) {
            folder.add({ play: () => env.playAmbientMusic() }, 'play').name('▶️ Play')
            folder.add({ stop: () => env.stopAmbientMusic() }, 'stop').name('⏹️ Stop')
        }

        folder.open()
    }

    createRendererControls() {
        const folder = this.debug.ui.addFolder('🎬 Renderer')

        const toneMappingTypes = {
            'No': THREE.NoToneMapping,
            'Linear': THREE.LinearToneMapping,
            'Reinhard': THREE.ReinhardToneMapping,
            'Cineon': THREE.CineonToneMapping,
            'ACESFilmic': THREE.ACESFilmicToneMapping
        }

        folder.add(this.settings.renderer, 'toneMapping', Object.keys(toneMappingTypes))
            .name('Tone Mapping')
            .onChange((value) => {
                this.experience.renderer.instance.toneMapping = toneMappingTypes[value]
            })

        folder.add(this.settings.renderer, 'toneMappingExposure', 0, 3, 0.1)
            .name('Exposure')
            .onChange((value) => {
                this.experience.renderer.instance.toneMappingExposure = value
            })
    }

    kelvinToRGB(kelvin) {
        const temp = kelvin / 100
        let red, green, blue

        if (temp <= 66) {
            red = 255
            green = temp
            green = 99.4708025861 * Math.log(green) - 161.1195681661
            if (temp >= 19) {
                blue = temp - 10
                blue = 138.5177312231 * Math.log(blue) - 305.0447927307
            } else {
                blue = 0
            }
        } else {
            red = temp - 60
            red = 329.698727446 * Math.pow(red, -0.1332047592)
            green = temp - 60
            green = 288.1221695283 * Math.pow(green, -0.0755148492)
            blue = 255
        }

        return {
            r: Math.max(0, Math.min(255, red)),
            g: Math.max(0, Math.min(255, green)),
            b: Math.max(0, Math.min(255, blue))
        }
    }
} 