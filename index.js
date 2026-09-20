const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')
c.imageSmoothingEnabled = false
const dpr = window.devicePixelRatio || 1

canvas.width = 1024 * dpr
canvas.height = 576 * dpr

// Viewport size in logical pixels
const VIEWPORT_W = 1024
const VIEWPORT_H = 576

// All five map layers — order matters (ground first, gate on top)
const layersData = {
  l_Ground: l_Ground,
  l_Walls:  l_Walls,
  l_Objects: l_Objects,
  l_Gate:   l_Gate,
}

// Single tileset image for all layers
// 88 tiles wide x 48 tiles tall, 16x16 per tile
const TILESET_URL = './maptiles_cleaned_full_sheet.png'
const TILE_SIZE   = 16

const tilesets = {
  l_Ground:  { imageUrl: TILESET_URL, tileSize: TILE_SIZE },
  l_Walls:   { imageUrl: TILESET_URL, tileSize: TILE_SIZE },
  l_Objects: { imageUrl: TILESET_URL, tileSize: TILE_SIZE },
  l_Gate:    { imageUrl: TILESET_URL, tileSize: TILE_SIZE },
}

// Build collision blocks and platforms from collisions.js
// 0 = open, 1 = solid block, 2 = platform (land on top), 3 = platform flush with floor
const collisionBlocks = []
const platforms = []
const blockSize = TILE_SIZE

collisions.forEach((row, y) => {
  row.forEach((symbol, x) => {
    if (symbol === 1) {
      collisionBlocks.push(
        new CollisionBlock({
          x: x * blockSize,
          y: y * blockSize,
          size: blockSize,
        })
      )
    } else if (symbol === 2) {
      platforms.push(
        new Platform({
          x: x * blockSize,
          y: y * blockSize,
          width: blockSize,
          height: 4,
        })
      )
    } else if (symbol === 3) {
      platforms.push(
        new Platform({
          x: x * blockSize,
          y: y * blockSize + 12,
          width: blockSize,
          height: 4,
        })
      )
    }
  })
})

// Map pixel dimensions derived from first layer
const firstLayer    = l_Ground
const mapWidthPx    = firstLayer[0].length * blockSize   // 160 * 16 = 2560
const mapHeightPx   = firstLayer.length    * blockSize   // 60  * 16 = 960

// Camera — follows player, clamped to map bounds
const camera = {
  x: 0,
  y: 0,
  update(playerX, playerY) {
    // Center camera on player
    this.x = playerX - VIEWPORT_W / 2
    this.y = playerY - VIEWPORT_H / 2
    // Clamp so camera never shows outside the map
    this.x = Math.max(0, Math.min(this.x, mapWidthPx  - VIEWPORT_W))
    this.y = Math.max(0, Math.min(this.y, mapHeightPx - VIEWPORT_H))
  }
}

// Tileset image cache
const tilesetImages = {}

// Render a single layer onto a context, offset by camera
const renderLayer = (tilesData, tilesetImage, tileSize, context, camX, camY) => {
  const tilesPerRow = Math.ceil(tilesetImage.width / tileSize)

  // Only render tiles visible in the viewport (plus 1 tile buffer each side)
  const startCol = Math.max(0,    Math.floor(camX / tileSize) - 1)
  const endCol   = Math.min(tilesData[0].length - 1, Math.ceil((camX + VIEWPORT_W)  / tileSize) + 1)
  const startRow = Math.max(0,    Math.floor(camY / tileSize) - 1)
  const endRow   = Math.min(tilesData.length - 1,    Math.ceil((camY + VIEWPORT_H) / tileSize) + 1)

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const symbol = tilesData[row][col]
      if (!symbol || symbol === 0) continue

      const tileIndex = symbol - 1
      const srcX = (tileIndex % tilesPerRow) * tileSize
      const srcY = Math.floor(tileIndex / tilesPerRow) * tileSize

      // World position minus camera offset
      const drawX = col * tileSize - camX
      const drawY = row * tileSize - camY

      context.drawImage(
        tilesetImage,
        srcX, srcY, tileSize, tileSize,
        drawX, drawY, tileSize, tileSize
      )
    }
  }
}

// Load all tileset images once
const loadAllTilesets = async () => {
  const imageUrl = TILESET_URL
  const img = await loadImage(imageUrl)
  // All layers share the same image
  for (const key of Object.keys(tilesets)) {
    tilesetImages[key] = img
  }
}

// Player spawns in Zone 1 open area
// collisions.js: Zone 1 floor at row 45, open space starts row 5
// Spawn player standing on the floor, col 5, just above floor row 44
const player = new Player({
  x: 5 * blockSize + blockSize / 2,
  y: 44 * blockSize - blockSize,
  size: blockSize,
  velocity: { x: 0, y: 0 },
})

const keys = {
  w: { pressed: false },
  a: { pressed: false },
  d: { pressed: false },
}

let lastTime = performance.now()

function animate() {
  const currentTime = performance.now()
  const deltaTime   = (currentTime - lastTime) / 1000
  lastTime = currentTime

  // Update player
  player.handleInput(keys)
  player.update(deltaTime, collisionBlocks)

  // Update camera to follow player
  camera.update(player.x, player.y)

  // Render
  c.save()
  c.scale(dpr, dpr)
  c.clearRect(0, 0, VIEWPORT_W, VIEWPORT_H)

  // Draw all layers in order with camera offset
  for (const [layerName, tilesData] of Object.entries(layersData)) {
    const tilesetImage = tilesetImages[layerName]
    if (!tilesetImage) continue
    renderLayer(tilesData, tilesetImage, TILE_SIZE, c, camera.x, camera.y)
  }

  // Draw player offset by camera
  const playerDrawX = player.x - camera.x
  const playerDrawY = player.y - camera.y
  c.fillStyle = 'rgba(255, 0, 0, 0.8)'
  c.fillRect(playerDrawX, playerDrawY, player.width, player.height)

  c.restore()

  requestAnimationFrame(animate)
}

const startRendering = async () => {
  try {
    await loadAllTilesets()
    animate()
  } catch (error) {
    console.error('Error during rendering:', error)
  }
}

startRendering()
