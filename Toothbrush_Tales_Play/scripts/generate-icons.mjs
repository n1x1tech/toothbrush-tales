/**
 * Generate PWA icons from a source PNG image.
 *
 * Usage: node scripts/generate-icons.mjs [path-to-source-image]
 *
 * Requires: sharp (already a dependency)
 */

import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// Source image — accept CLI arg or default
const sourcePath = process.argv[2] || join(projectRoot, '..', '..', '..', 'Downloads', 'Toothbrush-tales_image.png')
console.log('Source image:', sourcePath)

const sourceBuffer = readFileSync(sourcePath)
const iconsDir = join(projectRoot, 'public', 'icons')

mkdirSync(iconsDir, { recursive: true })

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512]
const splashScreens = [
  { width: 640, height: 1136 },
  { width: 750, height: 1334 },
  { width: 1125, height: 2436 },
  { width: 1170, height: 2532 },
  { width: 1179, height: 2556 },
  { width: 1242, height: 2208 },
  { width: 1284, height: 2778 },
  { width: 1290, height: 2796 },
  { width: 2048, height: 2732 },
]

async function generateIcons() {
  // Generate app icons
  for (const size of iconSizes) {
    await sharp(sourceBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(join(iconsDir, `icon-${size}x${size}.png`))
    console.log(`Generated icon-${size}x${size}.png`)
  }

  // Generate apple-touch-icon (180x180)
  await sharp(sourceBuffer)
    .resize(180, 180, { fit: 'cover' })
    .png()
    .toFile(join(iconsDir, 'apple-touch-icon.png'))
  console.log('Generated apple-touch-icon.png')

  // Generate favicon.png (32x32) in public root
  await sharp(sourceBuffer)
    .resize(32, 32, { fit: 'cover' })
    .png()
    .toFile(join(projectRoot, 'public', 'favicon.png'))
  console.log('Generated favicon.png')

  // Generate splash screens (icon centered on themed background)
  for (const { width, height } of splashScreens) {
    const iconSize = Math.round(Math.min(width, height) * 0.3)
    const resizedIcon = await sharp(sourceBuffer)
      .resize(iconSize, iconSize, { fit: 'cover' })
      .png()
      .toBuffer()

    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 247, g: 255, b: 247, alpha: 1 }, // #F7FFF7
      },
    })
      .composite([
        {
          input: resizedIcon,
          left: Math.round((width - iconSize) / 2),
          top: Math.round((height - iconSize) / 2),
        },
      ])
      .png()
      .toFile(join(iconsDir, `splash-${width}x${height}.png`))
    console.log(`Generated splash-${width}x${height}.png`)
  }

  console.log('\nAll icons generated successfully!')
}

generateIcons().catch(console.error)
