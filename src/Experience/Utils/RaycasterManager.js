import * as THREE from 'three'
import Experience from '../Experience.js'

export default class RaycasterManager {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.camera = this.experience.camera
        this.sizes = this.experience.sizes

        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()

        this.crosshair = document.getElementById('crosshair')
        this._hoverTimer = 0

        this.setEventListeners()
    }

    setEventListeners() {
        window.addEventListener('click', (event) => {
            this.onClick(event)
        })

        window.addEventListener('mousemove', (event) => {
            this.onMouseMove(event)
        })

        // Show the crosshair only while the pointer is locked (immersive
        // mode); on touch devices there is no lock and no need for it
        document.addEventListener('pointerlockchange', () => {
            if (this.crosshair) {
                this.crosshair.classList.toggle('visible', !!document.pointerLockElement)
                if (!document.pointerLockElement) {
                    this.crosshair.classList.remove('active')
                }
            }
        })
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / this.sizes.width) * 2 - 1
        this.mouse.y = -(event.clientY / this.sizes.height) * 2 + 1
    }

    // While the pointer is locked the OS stops reporting cursor positions,
    // so clicks must raycast from the screen center (what the player is
    // actually aiming at) instead of the stale pre-lock cursor position.
    getPointerNDC(event) {
        if (document.pointerLockElement) {
            return { x: 0, y: 0 }
        }
        return {
            x: (event.clientX / this.sizes.width) * 2 - 1,
            y: -(event.clientY / this.sizes.height) * 2 + 1
        }
    }

    onClick(event) {
        // Don't raycast if clicking on UI elements or if in presentation mode
        if (event.target.closest('.painting-info-panel') ||
            event.target.closest('.lil-gui') ||
            event.target.closest('.entry-screen') ||
            event.target.closest('.presentation-overlay') ||
            event.target.closest('#easel-prompt-overlay') ||
            event.target.closest('.scene-selector') ||
            event.target.closest('.top-toolbar') ||
            event.target.closest('.curator-btn') ||
            event.target.closest('.ac-guide') ||
            (this.camera && this.camera.presentationMode && this.camera.presentationMode.active)) {
            return
        }

        const ndc = this.getPointerNDC(event)
        this.mouse.x = ndc.x
        this.mouse.y = ndc.y

        this.raycaster.setFromCamera(this.mouse, this.camera.instance)

        const candidates = this.collectCandidates()
        if (candidates.length === 0) return

        candidates.sort((a, b) => a.hit.distance - b.hit.distance)
        const nearest = candidates[0]
        const scene = this.experience.world?.sceneManager?.getCurrentScene()

        switch (nearest.kind) {
            case 'painting': {
                const paintingMesh = nearest.hit.object
                const painting = paintingMesh.userData.painting
                if (painting && this.camera) {
                    this.camera.enterPresentationMode(paintingMesh, painting)
                }
                break
            }
            case 'easel': {
                document.dispatchEvent(new CustomEvent('easel-clicked', {
                    detail: {
                        object: nearest.hit.object,
                        intersection: nearest.hit
                    }
                }))
                break
            }
            case 'apple':
                scene?.pickApple(nearest.hit.object.userData.appleRef)
                break
            case 'flower':
                scene?.pickFlower(nearest.hit.object.userData.flowerRef)
                break
            case 'pond':
                scene?.onPondClick(nearest.hit.point)
                break
            case 'butterfly':
                scene?.catchButterfly(nearest.hit.object.userData.butterflyRef)
                break
            case 'digSpot':
                scene?.digAtSpot(nearest.hit.object.userData.spotRef)
                break
            case 'tree':
                scene?.shakeTree(nearest.hit.object.userData.treeRef)
                break
            case 'balloon':
                scene?.popBalloon(nearest.hit.object.userData.balloonRef)
                break
            case 'villager':
                scene?.talkToVillager(nearest.hit.object.userData.villagerRef)
                break
            case 'vivy':
                scene?.talkToVivy()
                break
            case 'stardust':
                scene?.collectStardust(nearest.hit.object.userData.orbRef)
                break
            case 'asteroid':
                scene?.shatterAsteroid(nearest.hit.object.userData.asteroidRef)
                break
            case 'dataShard':
                scene?.collectShard(nearest.hit.object.userData.shardRef)
                break
            case 'groundItem':
                scene?.pickGroundItem(nearest.hit.object.userData.itemRef)
                break
        }
    }

    // Collect hits from all interactive object groups so the NEAREST one
    // wins — priority-by-type used to let a far flower block a close pond
    // click ("can't fish / can't pick apples").
    collectCandidates() {
        const candidates = []

        if (this.experience.world && this.experience.world.paintings) {
            const hits = this.raycaster.intersectObjects(this.experience.world.paintings.paintingMeshes, true)
            hits.forEach(h => candidates.push({ kind: 'painting', hit: h }))
        }

        if (this.experience.world && this.experience.world.easel) {
            const easelClickables = this.experience.world.easel.getClickableObjects()
            const hits = this.raycaster.intersectObjects(easelClickables, true)
            hits.forEach(h => candidates.push({ kind: 'easel', hit: h }))
        }

        const scene = this.experience.world?.sceneManager?.getCurrentScene()

        if (scene && scene.appleHitSpheres && scene.appleHitSpheres.length > 0) {
            const available = scene.appleHitSpheres.filter(s => {
                const fruit = s.userData.appleRef
                return s.visible && fruit && fruit.visible && !fruit.userData.picked && !fruit.userData.falling
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'apple', hit: h }))
        }

        if (scene && scene.flowerHitSpheres && scene.flowerHitSpheres.length > 0) {
            const available = scene.flowerHitSpheres.filter(s => {
                const flower = s.userData.flowerRef
                return flower && flower.visible && !flower.userData.picked
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'flower', hit: h }))
        }

        if (scene && scene.pondWater) {
            const hits = this.raycaster.intersectObject(scene.pondWater, false)
            hits.forEach(h => candidates.push({ kind: 'pond', hit: h }))
        }

        if (scene && scene.butterflyHitSpheres && scene.butterflyHitSpheres.length > 0) {
            const available = scene.butterflyHitSpheres.filter(s => {
                const b = s.userData.butterflyRef
                return b && b.visible && !b.userData.caught
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'butterfly', hit: h }))
        }

        if (scene && scene.digHitSpheres && scene.digHitSpheres.length > 0) {
            const available = scene.digHitSpheres.filter(s => {
                const spot = s.userData.spotRef
                return spot && !spot.userData.dug
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'digSpot', hit: h }))
        }

        if (scene && scene.treeHitCylinders && scene.treeHitCylinders.length > 0) {
            const hits = this.raycaster.intersectObjects(scene.treeHitCylinders, false)
            hits.forEach(h => candidates.push({ kind: 'tree', hit: h }))
        }

        if (scene && scene.balloonHitSpheres && scene.balloonHitSpheres.length > 0) {
            const available = scene.balloonHitSpheres.filter(s => {
                const b = s.userData.balloonRef
                return b && b.visible && !b.userData.popped
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'balloon', hit: h }))
        }

        if (scene && scene.villagerHitSpheres && scene.villagerHitSpheres.length > 0) {
            const hits = this.raycaster.intersectObjects(scene.villagerHitSpheres, false)
            hits.forEach(h => candidates.push({ kind: 'villager', hit: h }))
        }

        if (scene && scene.vivyHitSphere && scene.vivyHitSphere.visible) {
            const hits = this.raycaster.intersectObject(scene.vivyHitSphere, false)
            hits.forEach(h => candidates.push({ kind: 'vivy', hit: h }))
        }

        if (scene && scene.stardustHitSpheres && scene.stardustHitSpheres.length > 0) {
            const available = scene.stardustHitSpheres.filter(s => {
                const orb = s.userData.orbRef
                return orb && orb.visible
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'stardust', hit: h }))
        }

        if (scene && scene.asteroidHitSpheres && scene.asteroidHitSpheres.length > 0) {
            const available = scene.asteroidHitSpheres.filter(s => {
                const a = s.userData.asteroidRef
                return a && a.visible && !a.userData.shattered
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'asteroid', hit: h }))
        }

        if (scene && scene.shardHitSpheres && scene.shardHitSpheres.length > 0) {
            const available = scene.shardHitSpheres.filter(s => {
                const shard = s.userData.shardRef
                return shard && shard.visible
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'dataShard', hit: h }))
        }

        if (scene && scene.groundHitSpheres && scene.groundHitSpheres.length > 0) {
            const available = scene.groundHitSpheres.filter(s => {
                const item = s.userData.itemRef
                return item && item.visible
            })
            const hits = this.raycaster.intersectObjects(available, false)
            hits.forEach(h => candidates.push({ kind: 'groundItem', hit: h }))
        }

        return candidates
    }

    update() {
        // Update raycaster for hover effects if needed
        if (this.camera && this.camera.instance) {
            this.raycaster.setFromCamera(this.mouse, this.camera.instance)
        }

        // Crosshair hover feedback while pointer-locked (throttled)
        if (!document.pointerLockElement || !this.crosshair || !this.camera?.instance) return

        this._hoverTimer -= this.experience.time.delta / 1000
        if (this._hoverTimer > 0) return
        this._hoverTimer = 0.12

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera.instance)
        const candidates = this.collectCandidates()
        this.crosshair.classList.toggle('active', candidates.length > 0)
    }
}
