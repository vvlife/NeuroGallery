/**
 * Quests — island task system with progress panel and bell rewards.
 * Singleton on window.experience.world.quests.
 */

const QUEST_DEFS = [
    {
        id: 'meet-vivy',
        name: '新朋友',
        desc: '和 Vivy 聊聊天 1 次',
        target: 1,
        reward: 200,
        icon: '💬'
    },
    {
        id: 'pick-apples',
        name: '摘果新手',
        desc: '摘下 3 个水果',
        target: 3,
        reward: 150,
        icon: '🍎'
    },
    {
        id: 'first-fish',
        name: '第一次垂钓',
        desc: '钓到 1 条鱼',
        target: 1,
        reward: 200,
        icon: '🎣'
    },
    {
        id: 'first-craft',
        name: '手工达人',
        desc: '在 DIY 台制作 1 件家具',
        target: 1,
        reward: 300,
        icon: '🔨'
    },
    {
        id: 'first-place',
        name: '装点小岛',
        desc: '把 1 件家具摆放到岛上',
        target: 1,
        reward: 250,
        icon: '🪑'
    },
    {
        id: 'collector',
        name: '小小收藏家',
        desc: '背包里同时拥有 5 种不同物品',
        target: 5,
        reward: 400,
        icon: '🎒'
    }
]

const STORAGE_KEY = 'island-quests'

export default class Quests {
    constructor() {
        this.quests = QUEST_DEFS.map(q => ({
            ...q,
            progress: 0,
            done: false
        }))
        this.restore()
        this.createUI()
        this.bindToggle()
    }

    restore() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
            this.quests.forEach(q => {
                if (saved[q.id]) {
                    q.progress = saved[q.id].progress || 0
                    q.done = !!saved[q.id].done
                }
            })
        } catch (e) { /* fresh start */ }
    }

    save() {
        const data = {}
        this.quests.forEach(q => {
            data[q.id] = { progress: q.progress, done: q.done }
        })
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch (e) { /* ignore */ }
    }

    bump(id, amount = 1) {
        const quest = this.quests.find(q => q.id === id)
        if (!quest || quest.done) return

        quest.progress = Math.min(quest.target, quest.progress + amount)
        this.renderPanel()

        if (quest.progress >= quest.target) {
            quest.done = true
            const inv = window.experience?.world?.inventory
            if (inv) inv.addBells(quest.reward)

            const scene = window.experience?.world?.sceneManager?.getCurrentScene?.()
            if (scene?.showGameplayToast) {
                scene.showGameplayToast(`🎉 任务完成【${quest.name}】！奖励 💰+${quest.reward}`)
            }
        }

        this.save()
        this.updateBadge()
    }

    checkCollector() {
        const inv = window.experience?.world?.inventory
        if (!inv) return
        const kinds = Object.keys(inv.items).length
        const quest = this.quests.find(q => q.id === 'collector')
        if (!quest || quest.done) return
        quest.progress = Math.min(quest.target, kinds)
        this.renderPanel()
        if (quest.progress >= quest.target) {
            this.bump('collector', 0) // trigger completion path
            quest.done = true
            if (inv) inv.addBells(quest.reward)
            const scene = window.experience?.world?.sceneManager?.getCurrentScene?.()
            if (scene?.showGameplayToast) {
                scene.showGameplayToast(`🎉 任务完成【${quest.name}】！奖励 💰+${quest.reward}`)
            }
            this.save()
            this.updateBadge()
        }
    }

    // ── Event hooks called by the scene ───────────────────────────────
    onTalkToVivy() { this.bump('meet-vivy') }
    onPickApple() { this.bump('pick-apples') }
    onFish() { this.bump('first-fish') }
    onCraft() { this.bump('first-craft') }
    onPlaceFurniture() { this.bump('first-place') }
    onCollectItem() { this.checkCollector() }
    onBuy() {}
    onSell() {}

    get undoneCount() {
        return this.quests.filter(q => !q.done).length
    }

    // ── Panel UI ──────────────────────────────────────────────────────
    createUI() {
        this.button = document.createElement('button')
        this.button.id = 'questBtn'
        this.button.innerHTML = '📋 任务 <span id="questBadge" style="background:#e8574d;color:#fff;border-radius:10px;padding:1px 7px;font-size:12px;margin-left:4px"></span>'
        this.button.style.cssText = `
            position: fixed; bottom: 24px; left: 130px; z-index: 1000;
            padding: 12px 20px; border: none; border-radius: 24px;
            background: rgba(255,255,255,0.94); color: #4a3b2a;
            font-size: 15px; font-weight: 600; cursor: pointer;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15); backdrop-filter: blur(8px);
            font-family: 'Helvetica Neue', Arial, sans-serif;
            display: none;
        `
        this.button.addEventListener('click', () => this.toggle())
        document.body.appendChild(this.button)

        this.panel = document.createElement('div')
        this.panel.id = 'questPanel'
        this.panel.style.cssText = `
            position: fixed; bottom: 84px; left: 24px; z-index: 1100;
            width: 340px; max-width: calc(100vw - 48px);
            background: #fffdf5; border-radius: 18px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.25);
            padding: 18px; display: none;
            font-family: 'Helvetica Neue', Arial, sans-serif; color: #4a3b2a;
        `
        document.body.appendChild(this.panel)

        document.addEventListener('click', (e) => {
            if (this.panel.style.display === 'none') return
            if (!this.panel.contains(e.target) && e.target !== this.button && !this.button.contains(e.target)) {
                this.panel.style.display = 'none'
            }
        })

        this.updateBadge()
    }

    bindToggle() {
        document.addEventListener('keydown', (e) => {
            const tag = e.target.tagName.toLowerCase()
            if (tag === 'input' || tag === 'textarea') return
            if (e.code === 'KeyJ') this.toggle()
        })
    }

    toggle() {
        const opening = this.panel.style.display === 'none'
        this.panel.style.display = opening ? 'block' : 'none'
        if (opening) this.renderPanel()
    }

    show() {
        if (this.button) this.button.style.display = 'block'
        this.updateBadge()
    }

    hide() {
        if (this.button) this.button.style.display = 'none'
        if (this.panel) this.panel.style.display = 'none'
    }

    updateBadge() {
        const badge = this.button?.querySelector('#questBadge')
        if (badge) badge.textContent = `${this.quests.filter(q => q.done).length}/${this.quests.length}`
    }

    renderPanel() {
        if (!this.panel) return
        const rows = this.quests.map(q => {
            const state = q.done
                ? '<span style="color:#5a8c4a;font-weight:700">✓ 完成</span>'
                : `<span style="color:#8b7355">${q.progress}/${q.target}</span>`
            return `
                <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed #e8dcc8;${q.done ? 'opacity:0.65' : ''}">
                    <span style="font-size:22px">${q.icon}</span>
                    <div style="flex:1">
                        <div style="font-weight:600">${q.name}</div>
                        <div style="font-size:12px;color:#8b7355">${q.desc} · 奖励 💰${q.reward}</div>
                    </div>
                    ${state}
                </div>
            `
        }).join('')

        this.panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <strong style="font-size:17px">📋 小岛任务</strong>
            </div>
            ${rows}
        `
        this.updateBadge()
    }
}
