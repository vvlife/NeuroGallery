import './style.css'
import Experience from './Experience/Experience.js'

// Initialize the Experience
const experience = new Experience(document.querySelector('canvas.webgl'))

// Keyboard shortcuts for GUI and other controls
document.addEventListener('keydown', (event) => {
    // Only handle shortcuts when not in an input field
    const tag = event.target.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea') return

    // E opens the intro card for the painting the player is standing in
    // front of. If the card is already open, leave it to PresentationUI's
    // own E handler (opens the repo link) instead of re-opening the card.
    if (event.code === 'KeyE') {
        const world = experience.world
        const ui = experience.presentationUI
        if (world && ui && !ui._repoUrl && world._nearestPainting) {
            event.preventDefault()
            event.stopPropagation()
            world.openNearestPainting()
            return
        }
    }

    // Don't interfere with camera controls when locked
    if (experience.camera?.controls?.isLocked) {
        switch (event.code) {
            case 'KeyG':
                event.preventDefault()
                if (experience.debug) {
                    experience.debug.toggle()
                }
                break
                
            case 'KeyR':
                event.preventDefault()
                if (experience.camera) {
                    experience.camera.instance.position.set(0, 1.6, 5)
                }
                break
                
            case 'KeyF':
                event.preventDefault()
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen()
                        .catch(err => console.warn('Could not enter fullscreen:', err))
                } else {
                    document.exitFullscreen()
                        .catch(err => console.warn('Could not exit fullscreen:', err))
                }
                break
                
            case 'Digit1':
                event.preventDefault()
                if (experience.camera) {
                    experience.camera.instance.position.set(0, 1.6, 5)
                }
                break
                
            case 'Digit2':
                event.preventDefault()
                if (experience.camera) {
                    experience.camera.instance.position.set(0, 1.6, 0)
                }
                break
                
            case 'Digit3':
                event.preventDefault()
                if (experience.camera) {
                    experience.camera.instance.position.set(-8, 1.6, -8)
                }
                break
                
            case 'Digit4':
                event.preventDefault()
                if (experience.camera) {
                    experience.camera.instance.position.set(0, 8, 8)
                }
                break
        }
    } else {
        switch (event.code) {
            case 'KeyG':
                event.preventDefault()
                if (experience.debug) {
                    experience.debug.toggle()
                }
                break
        }
    }
})

// GUI Toggle Button functionality
document.addEventListener('DOMContentLoaded', () => {
    const guiToggleBtn = document.getElementById('guiToggleBtn')

    if (guiToggleBtn) {
        updateToggleButton()

        guiToggleBtn.addEventListener('click', () => {
            if (experience.debug) {
                experience.debug.toggle()
                updateToggleButton()
            }
        })

        function updateToggleButton() {
            if (experience.debug?.visible) {
                guiToggleBtn.classList.remove('pulse')
                guiToggleBtn.title = 'Hide Controls Panel (G)'
            } else {
                guiToggleBtn.classList.add('pulse')
                guiToggleBtn.title = 'Show Controls Panel (G)'
            }
        }

        setInterval(updateToggleButton, 500)
    }

    // Scene Selector
    const sceneToggle = document.getElementById('sceneSelectorToggle')
    const sceneMenu = document.getElementById('sceneSelectorMenu')
    const sceneOptions = document.querySelectorAll('.scene-option')

    if (sceneToggle && sceneMenu) {
        sceneToggle.addEventListener('click', (e) => {
            e.stopPropagation()
            sceneMenu.classList.toggle('open')
        })

        document.addEventListener('click', (e) => {
            if (!sceneMenu.contains(e.target) && e.target !== sceneToggle) {
                sceneMenu.classList.remove('open')
            }
        })

        sceneOptions.forEach((btn) => {
            btn.addEventListener('click', () => {
                const sceneKey = btn.dataset.scene

                sceneOptions.forEach(b => b.classList.remove('active'))
                btn.classList.add('active')
                sceneMenu.classList.remove('open')

                if (experience.world?.sceneManager) {
                    experience.world.sceneManager.switchScene(sceneKey)
                }
            })
        })

        // Support ?scene=xxx URL param to auto-switch scene on load
        const params = new URLSearchParams(window.location.search)
        const urlScene = params.get('scene')
        if (urlScene) {
            const validScenes = ['gallery', 'animalCrossing', 'space', 'cyberpunk']
            if (validScenes.includes(urlScene)) {
                const waitAndSwitch = () => {
                    if (experience.world?.sceneManager) {
                        experience.world.sceneManager.switchScene(urlScene)
                        // Update active button
                        sceneOptions.forEach(b => {
                            b.classList.toggle('active', b.dataset.scene === urlScene)
                        })
                    } else {
                        setTimeout(waitAndSwitch, 200)
                    }
                }
                setTimeout(waitAndSwitch, 300)
            }
        }
    }

    // Curator button — opens the exhibition curator page
    const curatorBtn = document.getElementById('curatorBtn')
    if (curatorBtn) {
        curatorBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            window.open('http://localhost:4000', '_blank')
        })
    }

    // Immersive-mode hint: visible while pointer lock is active (desktop),
    // with a gentle fade after a few seconds so it does not block the view.
    const immersiveHint = document.getElementById('immersiveHint')
    let immersiveHintTimer = null

    if (immersiveHint) {
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement) {
                immersiveHint.classList.add('visible')
                immersiveHint.classList.remove('faded')

                clearTimeout(immersiveHintTimer)
                immersiveHintTimer = setTimeout(() => {
                    immersiveHint.classList.add('faded')
                }, 3000)
            } else {
                immersiveHint.classList.remove('visible')
                immersiveHint.classList.remove('faded')
                clearTimeout(immersiveHintTimer)
            }
        })
    }
})
