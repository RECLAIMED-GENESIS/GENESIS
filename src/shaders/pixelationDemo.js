import * as THREE from 'three'
import { PixelationEffect } from './PixelationPass.js'
import { PortalPixelFade } from './PortalPixelFade.js'

/**
 * Task 2 + Task 3 - standalone pixelation test.
 *
 * Builds a BASIC Level-1-like scene (floor, walls, a "player" box, a few
 * "enemy" boxes and a portal) and renders it through the pixelation
 * post-process. As the player walks toward the portal the world smoothly
 * fades from pixel art to clear. Does NOT depend on the real Level 1 / main.js.
 *
 * Run with:  npm run dev   then open  /pixelation-demo.html
 */
export function startPixelationDemo(container = document.body) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x111111)

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, 6, 12)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  // --- Lights ---
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(5, 10, 5)
  scene.add(dirLight)

  // --- Floor ---
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x224422 })
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  // --- Arena walls ---
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x335566,
    transparent: true,
    opacity: 0.4
  })
  const walls = [
    { pos: [0, 2.5, -10], size: [20, 5, 0.5] },
    { pos: [0, 2.5, 10], size: [20, 5, 0.5] },
    { pos: [-10, 2.5, 0], size: [0.5, 5, 20] },
    { pos: [10, 2.5, 0], size: [0.5, 5, 20] }
  ]
  walls.forEach(({ pos, size }) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...size), wallMat)
    wall.position.set(...pos)
    scene.add(wall)
  })

  // --- "Player" box ---
  const player = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x00ffff })
  )
  player.position.y = 0.5
  scene.add(player)

  // --- A few "enemy" boxes that drift around ---
  const enemies = []
  const enemyColors = [0xff0000, 0xff6600, 0x990000, 0xffcc00]
  for (let i = 0; i < 4; i++) {
    const e = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: enemyColors[i] })
    )
    e.position.set((i - 1.5) * 3, 0.5, -3)
    e.userData.phase = i
    scene.add(e)
    enemies.push(e)
  }

  // --- Portal (the player approaches this to fade the pixelation) ---
  const portal = new THREE.Mesh(
    new THREE.TorusGeometry(2, 0.3, 16, 64),
    new THREE.MeshStandardMaterial({
      color: 0x9900ff,
      emissive: 0x9900ff,
      emissiveIntensity: 0.8
    })
  )
  portal.position.set(0, 2, -9)
  scene.add(portal)

  // --- Post-processing: pixelate the whole scene ---
  const fx = new PixelationEffect(scene, camera, renderer, 8)

  // Task 3 - smoothly fade pixel art -> clear as the player nears the portal.
  const portalFade = new PortalPixelFade(fx, {
    basePixelSize: 8,
    minPixelSize: 1,
    fadeStart: 12,
    fadeEnd: 3,
    smoothing: 4
  })

  // --- Live controls ---
  const slider = document.getElementById('pixelSize')
  const readout = document.getElementById('pixelSizeValue')
  if (slider) {
    slider.addEventListener('input', () => {
      const value = Number(slider.value)
      portalFade.setBasePixelSize(value)
      if (readout) readout.textContent = String(value)
    })
  }

  const activateBtn = document.getElementById('activatePortal')
  if (activateBtn) {
    activateBtn.addEventListener('click', () => portalFade.activate())
  }

  const fadeReadout = document.getElementById('fadeValue')

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    fx.setSize(window.innerWidth, window.innerHeight)
  })

  const clock = new THREE.Clock()
  let elapsed = 0

  function animate() {
    requestAnimationFrame(animate)
    const delta = clock.getDelta()
    elapsed += delta
    const t = elapsed

    // Walk the player toward the portal and back so the fade is visible.
    player.position.z = Math.sin(t * 0.5) * 7 - 1 // ~ +6 (far) .. -8 (at portal)
    player.position.x = Math.sin(t) * 2
    player.rotation.y = t

    enemies.forEach((e) => {
      e.position.z = Math.sin(t + e.userData.phase) * 4
      e.rotation.y += 0.02
    })

    portal.rotation.z += 0.01

    // Drive the pixel-art -> clear transition from the player/portal gap.
    const fade = portalFade.update(player.position, portal.position, delta)
    if (fadeReadout) fadeReadout.textContent = Math.round(fade * 100) + '%'

    // Render the scene through the pixelation post-process.
    fx.render()
  }

  animate()

  return { scene, camera, renderer, fx, portalFade }
}

// Auto-start when this module is loaded by the demo page.
startPixelationDemo()
