import EventEmitter from './EventEmitter.js'

export default class Time extends EventEmitter {
    constructor() {
        super()

        // Setup
        this.start = Date.now()
        this.current = this.start
        this.elapsed = 0
        this.delta = 16

        // FPS limiting
        this.maxFPS = 60
        this.minFrameTime = 1000 / this.maxFPS
        this.lastFrameTime = this.start

        window.requestAnimationFrame(() => {
            this.tick()
        })
    }

    setMaxFPS(fps) {
        this.maxFPS = fps
        this.minFrameTime = 1000 / fps
    }

    tick() {
        const currentTime = Date.now()
        
        // Check if enough time has passed for the next frame
        if (currentTime - this.lastFrameTime < this.minFrameTime) {
            // Skip this frame, but still request the next one
            window.requestAnimationFrame(() => {
                this.tick()
            })
            return
        }

        this.delta = currentTime - this.current
        this.current = currentTime
        this.elapsed = this.current - this.start
        this.lastFrameTime = currentTime

        this.trigger('tick')

        window.requestAnimationFrame(() => {
            this.tick()
        })
    }
} 