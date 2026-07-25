import * as THREE from 'three'
import Experience from '../Experience.js'

export default class Environment {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.debug = this.experience.debug

        this.paintings = null

        this.settings = {
            timeOfDay: 'day',
            sunIntensity: 1.8,
            sunColor: '#ffffff',
            ambientIntensity: 1.0
        }

        this.setSunLight()
        this.setFillLight()
        this.setAmbientLight()
        this.setEnvironmentMap()
        this.setAudioSystem()

    }

    setSunLight() {
        this.sunLight = new THREE.DirectionalLight(this.settings.sunColor, this.settings.sunIntensity * 0.5)
        this.sunLight.castShadow = true
        this.sunLight.shadow.camera.far = 30
        this.sunLight.shadow.camera.left = -18
        this.sunLight.shadow.camera.top = 18
        this.sunLight.shadow.camera.right = 18
        this.sunLight.shadow.camera.bottom = -18
        this.sunLight.shadow.mapSize.width = 2048
        this.sunLight.shadow.mapSize.height = 2048
        this.sunLight.shadow.camera.near = 0.1
        this.sunLight.shadow.normalBias = 0.01
        this.sunLight.shadow.bias = -0.0005

        this.sunLight.position.set(3, 12, 2)
        this.sunLight.target.position.set(0, 0, 0)
        this.scene.add(this.sunLight.target)
        this.scene.add(this.sunLight)
    }

    setFillLight() {
        this.fillLight = new THREE.DirectionalLight('#ffffff', 0.4)
        this.fillLight.castShadow = false
        this.fillLight.position.set(-3, 12, -2)
        this.fillLight.target.position.set(0, 0, 0)
        this.scene.add(this.fillLight.target)
        this.scene.add(this.fillLight)
    }

    setAmbientLight() {
        this.ambientLight = new THREE.AmbientLight('#fff4e6', this.settings.ambientIntensity)
        this.scene.add(this.ambientLight)
    }

    setEnvironmentMap() {
        this.environmentMap = {}
        this.environmentMap.intensity = 1

        if (this.resources.items.dayEnvironment) {
            this.environmentMap.texture = this.resources.items.dayEnvironment
            // Set correct mapping for static background (not moving with camera)
            this.environmentMap.texture.mapping = THREE.EquirectangularRefractionMapping
            this.scene.environment = this.environmentMap.texture
            this.scene.background = this.environmentMap.texture
        }

        this.environmentMap.updateMaterials = () => {
            this.scene.traverse((child) => {
                if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                    if (this.environmentMap.texture) {
                        child.material.envMap = this.environmentMap.texture
                        child.material.envMapIntensity = this.environmentMap.intensity
                    }
                    child.material.needsUpdate = true
                }
            })
        }
    }

    setAudioSystem() {
        this.audioListener = new THREE.AudioListener()
        this.experience.camera.instance.add(this.audioListener)

        this.audioSettings = {
            volume: 0.5,
            muted: false
        }

        if (this.resources.items.ambientMusic) {
            this.ambientSound = new THREE.Audio(this.audioListener)
            this.ambientSound.setBuffer(this.resources.items.ambientMusic)
            this.ambientSound.setLoop(true)
            this.ambientSound.setVolume(this.audioSettings.volume)
        }
    }

    playAmbientMusic() {
        if (this.ambientSound && !this.ambientSound.isPlaying && !this.audioSettings.muted) {
            this.ambientSound.play()
        }
    }

    stopAmbientMusic() {
        if (this.ambientSound && this.ambientSound.isPlaying) {
            this.ambientSound.stop()
        }
    }

    toggleMute() {
        this.audioSettings.muted = !this.audioSettings.muted
        if (this.audioSettings.muted) {
            this.stopAmbientMusic()
        } else {
            this.playAmbientMusic()
        }
    }

    setVolume(volume) {
        this.audioSettings.volume = Math.max(0, Math.min(1, volume))
        if (this.ambientSound) {
            this.ambientSound.setVolume(this.audioSettings.volume)
        }
    }

    setPaintings(paintingsInstance) {
        this.paintings = paintingsInstance
    }

    switchTimeOfDay(timeOfDay) {
        this.settings.timeOfDay = timeOfDay

        if (timeOfDay === 'night') {
            if (this.resources.items.nightEnvironment) {
                this.environmentMap.texture = this.resources.items.nightEnvironment
                // Ensure default mapping for static background
                this.environmentMap.texture.mapping = THREE.EquirectangularRefractionMapping
                this.scene.environment = this.environmentMap.texture
                this.scene.background = this.environmentMap.texture
            } else {
                this.setGradientBackground()
            }
            this.sunLight.intensity = 0.8
            this.sunLight.color.setHex(0x8888ff)
            this.fillLight.intensity = 0.2
            this.fillLight.color.setHex(0x6060a0)
            this.ambientLight.intensity = 0.4
            this.ambientLight.color.setHex(0x6060a0)
        } else {
            if (this.resources.items.dayEnvironment) {
                this.environmentMap.texture = this.resources.items.dayEnvironment
                // Ensure default mapping for static background
                this.environmentMap.texture.mapping = THREE.EquirectangularRefractionMapping
                this.scene.environment = this.environmentMap.texture
                this.scene.background = this.environmentMap.texture
            } else {
                this.setGradientBackground()
            }
            this.sunLight.intensity = this.settings.sunIntensity * 0.5
            this.sunLight.color.setHex(0xffffff)
            this.fillLight.intensity = 0.4
            this.fillLight.color.setHex(0xffffff)
            this.ambientLight.intensity = this.settings.ambientIntensity
            this.ambientLight.color.setHex(0xfff4e6)
        }

        if (this.paintings) {
            this.paintings.setSpotlightsVisible(timeOfDay === 'night')
        }

        this.environmentMap.updateMaterials()
    }

    update() {

    }
} 