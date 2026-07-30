import * as THREE from 'three'
import Experience from '../Experience.js'
import Environment from './Environment.js'
import Paintings from './Paintings.js'
import Particles from './Particles.js'
import Easel from './Easel.js'
import Player from './Player.js'
import Inventory from './Inventory.js'
import Quests from './Quests.js'
import SceneManager from './SceneManager.js'

export default class World {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
    }

    setup() {
        this.environment = new Environment()
        this.paintings = new Paintings()
        this.particles = new Particles()
        this.easel = new Easel()
        this.player = new Player()
        this.inventory = new Inventory()
        this.quests = new Quests()

        this.sceneManager = new SceneManager()
        this.sceneManager.setup()

        this.waitForPaintings()

        if (this.environment && this.paintings) {
            this.environment.setPaintings(this.paintings)
        }

        this.sceneManager.on('sceneChanged', () => {
            this.attachPaintingsToScene()
        })

        // Exhibition progress: view-stamp collection across all scenes
        this.viewedPaintings = new Set()
        this.setupExhibitHUD()

        // Fun facts unlocked by scene gameplay, nudging players back to the art
        this.paintingFacts = [
            '🖼️ 阿波罗11号：宇航员的脚印至今留在月球上 —— 那里没有风',
            '🖼️ 旅行者1号：金唱片里收录了中文普通话问候"太空朋友，你们好！"',
            '🖼️ 哈勃望远镜：它拍的第一张照片是糊的，主镜磨错了 2 微米',
            '🖼️ 国际空间站：宇航员每天能看到 16 次日出',
            '🖼️ 先驱者10号：铝板上刻的是 14 颗脉冲星组成的"宇宙地图"',
            '🖼️ 韦伯望远镜：主镜在太空展开的误差不到一根头发丝'
        ]
        this.unlockedFactIndexes = new Set()
    }

    setupExhibitHUD() {
        const hud = document.getElementById('exhibitHud')
        if (hud) hud.classList.add('visible')
        this.updateExhibitHUD()
    }

    updateExhibitHUD() {
        const el = document.getElementById('exhibitCount')
        if (el) el.textContent = `${this.viewedPaintings.size}/6`
    }

    trackPaintingView(id) {
        if (!id || this.viewedPaintings.has(id)) return
        this.viewedPaintings.add(id)
        this.updateExhibitHUD()

        if (this.viewedPaintings.size >= 6) {
            this.celebrateCompletion()
        }
    }

    // Scene gameplay calls this to unlock a fun fact about the artworks —
    // the reward loops players back to the exhibition itself.
    unlockPaintingFact() {
        const remaining = this.paintingFacts
            .map((_, i) => i)
            .filter(i => !this.unlockedFactIndexes.has(i))
        if (remaining.length === 0) return null

        const idx = remaining[Math.floor(Math.random() * remaining.length)]
        this.unlockedFactIndexes.add(idx)
        return this.paintingFacts[idx]
    }

    celebrateCompletion() {
        const toast = document.createElement('div')
        toast.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 1300; padding: 28px 44px; border-radius: 24px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: #fff; font-size: 22px; font-weight: 600; text-align: center;
            box-shadow: 0 20px 60px rgba(102, 126, 234, 0.5);
            font-family: 'Helvetica Neue', Arial, sans-serif;
            animation: exhibitCelebrate 4s ease forwards;
            pointer-events: none; white-space: nowrap;
        `
        toast.innerHTML = '🎉 恭喜！你打卡了全部 6 幅展品！<br><span style="font-size:14px;opacity:0.85">真正的观展大师</span>'
        document.body.appendChild(toast)

        if (!document.getElementById('exhibit-celebrate-style')) {
            const style = document.createElement('style')
            style.id = 'exhibit-celebrate-style'
            style.textContent = `
                @keyframes exhibitCelebrate {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
                    12% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
                    20% { transform: translate(-50%, -50%) scale(1); }
                    80% { opacity: 1; }
                    100% { opacity: 0; transform: translate(-50%, -60%) scale(1); }
                }
            `
            document.head.appendChild(style)
        }

        setTimeout(() => toast.remove(), 4200)
    }

    waitForPaintings() {
        const check = () => {
            if (this.paintings && this.paintings.paintingMeshes.length > 0) {
                this.attachPaintingsToScene()
            } else {
                setTimeout(check, 200)
            }
        }
        check()
    }

    attachPaintingsToScene() {
        const scene = this.sceneManager?.getCurrentScene()
        if (!scene || !this.paintings) return

        if (scene.constructor.name === 'GalleryScene') {
            this.paintings.resetToDefault()
        } else {
            const slots = scene.getPaintingSlots()
            if (slots && slots.length > 0) {
                this.paintings.attachToSlots(slots)
            }
        }
    }

    update() {
        if (this.particles) {
            this.particles.update()
        }

        if (this.environment) {
            this.environment.update()
        }

        if (this.sceneManager) {
            this.sceneManager.update()
        }

        if (this.player) {
            this.player.update()
        }

        this.checkPaintingProximity()
    }

    // Position used for proximity checks: the visible character when the
    // third-person player is active, otherwise the first-person camera.
    getInteractionPosition() {
        if (this.player && this.player.active) {
            return this.player.position
        }
        return this.experience.camera.instance.position
    }

    // Show a lightweight action hint near a painting (no auto popup).
    // Full intro only opens on click or the E key.
    checkPaintingProximity() {
        const ui = this.experience.presentationUI
        const camera = this.experience.camera
        if (!ui || !camera || !this.paintings) return

        // Don't fight with the click-to-zoom presentation mode
        if (camera.presentationMode && camera.presentationMode.active) {
            this.hidePaintingHint()
            this._hintPaintingId = null
            return
        }

        const camPos = this.getInteractionPosition()
        const tmp = new THREE.Vector3()
        let nearest = null
        let nearestDist = Infinity

        for (const mesh of this.paintings.paintingMeshes) {
            mesh.getWorldPosition(tmp)
            const d = camPos.distanceTo(tmp)
            if (d < nearestDist) {
                nearestDist = d
                nearest = mesh
            }
        }

        const SHOW_AT = 4.5
        const RESET_AT = 6.0

        if (nearest && nearestDist < SHOW_AT) {
            const data = nearest.userData.painting
            this._nearestPainting = nearest

            // Only hint once per painting per visit, and never while a
            // hint is already on screen (walking past two paintings in a
            // row must not fire two hints).
            if (this._hintPaintingId !== data.id && !this._hintVisible) {
                this.showPaintingHint()
                this._hintPaintingId = data.id
            }
        } else {
            this._nearestPainting = null
            // Walked far enough away — the painting may be hinted again later
            if (this._hintPaintingId && nearestDist > RESET_AT) {
                this._hintPaintingId = null
            }
        }
    }

    showPaintingHint() {
        const el = document.getElementById('paintingHint')
        if (!el) return

        this._hintVisible = true
        el.classList.remove('fading')
        el.classList.add('visible')

        clearTimeout(this._hintTimer)
        this._hintTimer = setTimeout(() => {
            this.hidePaintingHint()
        }, 3000)
    }

    hidePaintingHint() {
        const el = document.getElementById('paintingHint')
        if (!el) return

        el.classList.remove('visible')
        el.classList.add('fading')
        this._hintVisible = false
    }

    // Called by the E key (see main.js): open the intro for the painting
    // the player is standing in front of.
    openNearestPainting() {
        if (this._nearestPainting) {
            const data = this._nearestPainting.userData.painting
            this.hidePaintingHint()
            this.experience.presentationUI.show(data)
        }
    }
}
