import Experience from '../Experience.js'
import GalleryScene from './Scenes/GalleryScene.js'
import AnimalCrossingScene from './Scenes/AnimalCrossingScene.js'
import SpaceScene from './Scenes/SpaceScene.js'
import CyberpunkScene from './Scenes/CyberpunkScene.js'

export default class SceneManager {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene

        this.scenes = {
            gallery: { name: '🏛️ 经典画廊', class: GalleryScene },
            animalCrossing: { name: '🌿 动森花园', class: AnimalCrossingScene },
            space: { name: '🚀 太空站', class: SpaceScene },
            cyberpunk: { name: '🌃 赛博朋克', class: CyberpunkScene }
        }

        this.currentSceneKey = 'gallery'
        this.currentScene = null
        this.listeners = []
    }

    setup() {
        this.switchScene(this.currentSceneKey)
    }

    switchScene(key) {
        if (!this.scenes[key]) {
            console.warn(`SceneManager: unknown scene "${key}"`)
            return
        }

        if (this.currentScene) {
            this.currentScene.destroy()
            this.currentScene = null
        }

        this.scene.fog = null

        this.currentSceneKey = key
        this.currentScene = new this.scenes[key].class()
        this.currentScene.setup()

        const world = this.experience.world
        if (world?.environment && world.paintings) {
            world.environment.setPaintings(world.paintings)
        }

        this.emit('sceneChanged', key)
    }

    getCurrentScene() {
        return this.currentScene
    }

    getSceneList() {
        return Object.entries(this.scenes).map(([key, value]) => ({
            key,
            name: value.name
        }))
    }

    on(event, callback) {
        this.listeners.push({ event, callback })
    }

    emit(event, data) {
        this.listeners
            .filter(l => l.event === event)
            .forEach(l => l.callback(data))
    }

    update() {
        if (this.currentScene && this.currentScene.update) {
            this.currentScene.update()
        }
    }
}
