import * as THREE from 'three'

/**
 * Furniture: DIY recipes + procedural low-poly furniture models.
 * Placement persists to localStorage.
 */

export const RECIPES = [
    { id: 'chair',   name: '木椅',   icon: '🪑', cost: { wood: 3 } },
    { id: 'table',   name: '小桌',   icon: '🛋️', cost: { wood: 4, stone: 1 } },
    { id: 'lamp',    name: '纸灯笼', icon: '🏮', cost: { wood: 2, flower: 1 } },
    { id: 'planter', name: '盆栽',   icon: '🪴', cost: { flower: 2, stone: 1 } },
    { id: 'bench',   name: '长凳',   icon: '🪑', cost: { wood: 5, stone: 2 } },
    { id: 'sign',    name: '木牌',   icon: '🪧', cost: { wood: 2 } }
]

export function createFurnitureModel(type) {
    const group = new THREE.Group()
    const woodMat = new THREE.MeshStandardMaterial({ color: '#a0683c', roughness: 0.85 })
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.85 })

    switch (type) {
        case 'chair': {
            const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), woodMat)
            seat.position.y = 0.32
            seat.castShadow = true
            group.add(seat)
            const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), woodMat)
            back.position.set(0, 0.6, -0.22)
            back.castShadow = true
            group.add(back)
            for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 6), darkWoodMat)
                leg.position.set(sx * 0.2, 0.16, sz * 0.2)
                group.add(leg)
            }
            break
        }
        case 'table': {
            const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 14), woodMat)
            top.position.y = 0.55
            top.castShadow = true
            group.add(top)
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.55, 8), darkWoodMat)
            leg.position.y = 0.28
            group.add(leg)
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.05, 10), darkWoodMat)
            base.position.y = 0.03
            group.add(base)
            break
        }
        case 'lamp': {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), darkWoodMat)
            pole.position.y = 0.55
            group.add(pole)
            const shade = new THREE.Mesh(
                new THREE.SphereGeometry(0.22, 12, 10),
                new THREE.MeshStandardMaterial({
                    color: '#ffdf9e', roughness: 0.6,
                    emissive: '#ffb84d', emissiveIntensity: 0.7,
                    transparent: true, opacity: 0.95
                })
            )
            shade.scale.set(1, 1.25, 1)
            shade.position.y = 1.25
            group.add(shade)
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.05, 8), darkWoodMat)
            cap.position.y = 1.52
            group.add(cap)
            break
        }
        case 'planter': {
            const pot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.13, 0.22, 10),
                new THREE.MeshStandardMaterial({ color: '#c47a4d', roughness: 0.9 })
            )
            pot.position.y = 0.11
            pot.castShadow = true
            group.add(pot)
            const plant = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 8, 8),
                new THREE.MeshStandardMaterial({ color: '#5cb85c', roughness: 0.85 })
            )
            plant.position.y = 0.38
            group.add(plant)
            const flowerHead = new THREE.Mesh(
                new THREE.SphereGeometry(0.07, 6, 6),
                new THREE.MeshStandardMaterial({ color: '#ff6b9d', roughness: 0.7 })
            )
            flowerHead.position.set(0.08, 0.52, 0.05)
            group.add(flowerHead)
            break
        }
        case 'bench': {
            const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.4), woodMat)
            seat.position.y = 0.35
            seat.castShadow = true
            group.add(seat)
            for (const sx of [-1, 1]) {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.36), darkWoodMat)
                leg.position.set(sx * 0.58, 0.18, 0)
                group.add(leg)
            }
            break
        }
        case 'sign': {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), darkWoodMat)
            post.position.y = 0.45
            group.add(post)
            const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.05), woodMat)
            board.position.y = 0.85
            board.castShadow = true
            group.add(board)
            break
        }
    }

    group.userData.furnitureType = type
    return group
}

const STORAGE_KEY = 'island-placed-furniture'

export function savePlacements(list) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch (e) {
        console.warn('savePlacements failed', e)
    }
}

export function loadPlacements() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const data = raw ? JSON.parse(raw) : []
        return Array.isArray(data) ? data : []
    } catch (e) {
        return []
    }
}
