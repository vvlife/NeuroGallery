import Experience from '../Experience.js'

export default class Benches {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources

        this.createModelBenches()
    }

    createModelBenches() {
        if (this.resources.items.bench) {
            // Banch 1
            const bench1 = this.resources.items.bench.scene.clone()
            bench1.position.set(-8, 0.4, 0)
            bench1.rotation.y = 1.5
            bench1.scale.setScalar(0.0035)
            bench1.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true
                    child.receiveShadow = true
                    // Ensure proper materials
                    if (child.material) {
                        child.material.needsUpdate = true
                    }
                }
            })
            this.scene.add(bench1)

            // Banch 2
            const bench2 = this.resources.items.bench.scene.clone()
            bench2.position.set(8, 0.4, 0)
            bench2.rotation.y = -1.5
            bench2.scale.setScalar(0.0035)
            bench2.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true
                    child.receiveShadow = true

                    // Ensure proper materials
                    if (child.material) {
                        child.material.needsUpdate = true
                    }
                }
            })
            this.scene.add(bench2)
        }
    }
} 