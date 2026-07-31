import * as THREE from 'three'

/**
 * Canvas-generated face textures for the low-poly characters.
 *
 * Sphere UV mapping in three.js: canvas top = sphere top, canvas middle =
 * equator, and the +Z direction (character front) maps to u = 0.25.
 * Faces are drawn BELOW the equator band (theta 95°–115°) so they sit
 * under the hair cap rim instead of being hidden inside it.
 */

const FACE_U = 0.25 // sphere u of the character's face direction

function makeCanvas(size = 512) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    return [canvas, canvas.getContext('2d')]
}

function toTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

/** Chibi player face: dark oval eyes with highlights, blush, tiny smile. */
export function makePlayerFaceTexture(skinColor = '#ffd9b3') {
    const [canvas, ctx] = makeCanvas()
    const S = canvas.width
    const cx = S * FACE_U

    ctx.fillStyle = skinColor
    ctx.fillRect(0, 0, S, S)

    const eyeY = S * 0.535   // theta ≈ 96°, just under the hair rim
    const eyeDX = S * 0.07
    for (const side of [-1, 1]) {
        const x = cx + side * eyeDX
        // Eye white base (soft)
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.beginPath()
        ctx.ellipse(x, eyeY, S * 0.034, S * 0.046, 0, 0, Math.PI * 2)
        ctx.fill()
        // Dark iris
        ctx.fillStyle = '#2b2b2b'
        ctx.beginPath()
        ctx.ellipse(x, eyeY + S * 0.004, S * 0.025, S * 0.038, 0, 0, Math.PI * 2)
        ctx.fill()
        // Highlight
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.ellipse(x - S * 0.009, eyeY - S * 0.013, S * 0.009, S * 0.012, 0, 0, Math.PI * 2)
        ctx.fill()
        // Blush
        ctx.fillStyle = 'rgba(255,150,150,0.45)'
        ctx.beginPath()
        ctx.ellipse(cx + side * S * 0.12, S * 0.575, S * 0.027, S * 0.015, 0, 0, Math.PI * 2)
        ctx.fill()
    }

    // Tiny smile
    ctx.strokeStyle = '#c96f5a'
    ctx.lineWidth = S * 0.008
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, S * 0.585, S * 0.026, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()

    return toTexture(canvas)
}

/** Vivy face: big pink anime eyes, small smile. */
export function makeVivyFaceTexture(skinColor = '#ffe3d0') {
    const [canvas, ctx] = makeCanvas()
    const S = canvas.width
    const cx = S * FACE_U

    ctx.fillStyle = skinColor
    ctx.fillRect(0, 0, S, S)

    const eyeY = S * 0.53
    const eyeDX = S * 0.068
    for (const side of [-1, 1]) {
        const x = cx + side * eyeDX
        // Big pink iris (Vivy's signature)
        ctx.fillStyle = '#c4406a'
        ctx.beginPath()
        ctx.ellipse(x, eyeY, S * 0.03, S * 0.048, 0, 0, Math.PI * 2)
        ctx.fill()
        // Darker pupil
        ctx.fillStyle = '#7e2440'
        ctx.beginPath()
        ctx.ellipse(x, eyeY + S * 0.006, S * 0.015, S * 0.027, 0, 0, Math.PI * 2)
        ctx.fill()
        // Highlight
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.ellipse(x - S * 0.008, eyeY - S * 0.015, S * 0.009, S * 0.013, 0, 0, Math.PI * 2)
        ctx.fill()
        // Lash line
        ctx.strokeStyle = '#4a2530'
        ctx.lineWidth = S * 0.006
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(x, eyeY + S * 0.004, S * 0.031, Math.PI * 1.15, Math.PI * 1.85)
        ctx.stroke()
        // Blush
        ctx.fillStyle = 'rgba(255,150,160,0.4)'
        ctx.beginPath()
        ctx.ellipse(cx + side * S * 0.112, S * 0.575, S * 0.023, S * 0.013, 0, 0, Math.PI * 2)
        ctx.fill()
    }

    // Small smile
    ctx.strokeStyle = '#d4897a'
    ctx.lineWidth = S * 0.007
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, S * 0.578, S * 0.022, Math.PI * 0.2, Math.PI * 0.8)
    ctx.stroke()

    return toTexture(canvas)
}
