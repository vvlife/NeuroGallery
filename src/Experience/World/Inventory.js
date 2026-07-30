/**
 * Inventory — items, bells, and the backpack UI.
 *
 * Singleton on window.experience.world.inventory. Every gathering action
 * (picking, fishing, digging, catching) funnels into add(); the DIY bench,
 * shop and quest systems read from it.
 */

const ITEM_DEFS = {
    apple:     { icon: '🍎', name: '水果' },
    flower:    { icon: '🌸', name: '野花' },
    fish:      { icon: '🐟', name: '鱼' },
    butterfly: { icon: '🦋', name: '蝴蝶' },
    fossil:    { icon: '🦴', name: '化石' },
    ore:       { icon: '✨', name: '矿石' },
    wood:      { icon: '🪵', name: '木材' },
    stone:     { icon: '🪨', name: '石头' },
    shell:     { icon: '🐚', name: '贝壳' },
    // DIY furniture
    chair:     { icon: '🪑', name: '木椅', furniture: true },
    table:     { icon: '🛋️', name: '小桌', furniture: true },
    lamp:      { icon: '🏮', name: '纸灯笼', furniture: true },
    planter:   { icon: '🪴', name: '盆栽', furniture: true },
    bench:     { icon: '🪑', name: '长凳', furniture: true },
    sign:      { icon: '🪧', name: '木牌', furniture: true }
}

export default class Inventory {
    constructor() {
        this.items = {}
        this.bells = 0
        this.listeners = []

        this.createUI()
        this.bindToggle()
    }

    add(itemId, count = 1) {
        this.items[itemId] = (this.items[itemId] || 0) + count
        this.emit()
        this.renderGrid()
    }

    remove(itemId, count = 1) {
        if ((this.items[itemId] || 0) < count) return false
        this.items[itemId] -= count
        if (this.items[itemId] <= 0) delete this.items[itemId]
        this.emit()
        this.renderGrid()
        return true
    }

    count(itemId) {
        return this.items[itemId] || 0
    }

    has(requirements) {
        return Object.entries(requirements).every(([id, n]) => this.count(id) >= n)
    }

    consume(requirements) {
        if (!this.has(requirements)) return false
        Object.entries(requirements).forEach(([id, n]) => this.remove(id, n))
        return true
    }

    addBells(amount) {
        this.bells = Math.max(0, this.bells + amount)
        this.emit()
    }

    spendBells(amount) {
        if (this.bells < amount) return false
        this.bells -= amount
        this.emit()
        return true
    }

    onChange(cb) {
        this.listeners.push(cb)
    }

    emit() {
        this.listeners.forEach(cb => cb(this))
    }

    // ── Backpack UI ───────────────────────────────────────────────────
    createUI() {
        // Toggle button (bottom-left, above the exhibit HUD style)
        this.button = document.createElement('button')
        this.button.id = 'inventoryBtn'
        this.button.textContent = '🎒 背包'
        this.button.style.cssText = `
            position: fixed; bottom: 24px; left: 24px; z-index: 1000;
            padding: 12px 20px; border: none; border-radius: 24px;
            background: rgba(255,255,255,0.94); color: #4a3b2a;
            font-size: 15px; font-weight: 600; cursor: pointer;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15); backdrop-filter: blur(8px);
            font-family: 'Helvetica Neue', Arial, sans-serif;
            display: none; transition: transform 0.2s;
        `
        this.button.addEventListener('click', () => this.toggle())
        document.body.appendChild(this.button)

        // Panel
        this.panel = document.createElement('div')
        this.panel.id = 'inventoryPanel'
        this.panel.style.cssText = `
            position: fixed; bottom: 84px; left: 24px; z-index: 1100;
            width: 320px; max-width: calc(100vw - 48px);
            background: #fffdf5; border-radius: 18px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.25);
            padding: 18px; display: none;
            font-family: 'Helvetica Neue', Arial, sans-serif; color: #4a3b2a;
        `
        this.panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <strong style="font-size:17px">🎒 背包</strong>
                <span id="invBells" style="font-weight:700;color:#b8860b">💰 0</span>
            </div>
            <div id="invGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"></div>
            <div id="invEmpty" style="text-align:center;color:#a89880;font-size:13px;padding:18px 0">空空如也，去摘点什么吧</div>
        `
        document.body.appendChild(this.panel)

        // Close when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (this.panel.style.display === 'none') return
            if (!this.panel.contains(e.target) && e.target !== this.button && !this.button.contains(e.target)) {
                this.panel.style.display = 'none'
            }
        })
    }

    bindToggle() {
        document.addEventListener('keydown', (e) => {
            const tag = e.target.tagName.toLowerCase()
            if (tag === 'input' || tag === 'textarea') return
            if (e.code === 'KeyB' || e.code === 'KeyI') {
                this.toggle()
            }
        })
    }

    toggle() {
        const opening = this.panel.style.display === 'none'
        this.panel.style.display = opening ? 'block' : 'none'
        if (opening) this.renderGrid()
    }

    show() {
        if (this.button) this.button.style.display = 'block'
        this.renderGrid()
    }

    hide() {
        if (this.button) this.button.style.display = 'none'
        if (this.panel) this.panel.style.display = 'none'
    }

    renderGrid() {
        const grid = this.panel.querySelector('#invGrid')
        const empty = this.panel.querySelector('#invEmpty')
        const bellsEl = this.panel.querySelector('#invBells')
        if (!grid) return

        bellsEl.textContent = `💰 ${this.bells}`

        const entries = Object.entries(this.items)
        empty.style.display = entries.length === 0 ? 'block' : 'none'

        grid.innerHTML = entries.map(([id, n]) => {
            const def = ITEM_DEFS[id] || { icon: '❔', name: id }
            return `
                <div class="inv-cell" data-item="${id}" title="${def.name}"
                     style="background:#f7f1e3;border-radius:12px;padding:10px 4px;text-align:center;cursor:default;position:relative">
                    <div style="font-size:24px">${def.icon}</div>
                    <div style="font-size:11px;color:#8b7355;margin-top:2px">${def.name}</div>
                    <span style="position:absolute;top:2px;right:6px;font-size:12px;font-weight:700;color:#6b5a3e">×${n}</span>
                </div>
            `
        }).join('')
    }

    static getItemDef(id) {
        return ITEM_DEFS[id] || { icon: '❔', name: id }
    }
}
