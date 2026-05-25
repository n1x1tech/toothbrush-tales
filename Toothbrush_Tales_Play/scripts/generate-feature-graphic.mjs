/**
 * Generate the Google Play feature graphic (1024x500) from the app icon.
 *
 * Usage: node scripts/generate-feature-graphic.mjs
 *
 * Output: playstore/feature-graphic.png
 *
 * Tweak BACKGROUND, TITLE, TAGLINE, or layout constants below to iterate.
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const W = 1024
const H = 500

const ICON = join(projectRoot, 'public', 'icons', 'icon-512x512.png')
const OUT_DIR = join(projectRoot, 'playstore')
const OUT = join(OUT_DIR, 'feature-graphic.png')

const TITLE = 'Toothbrush Tales'
const TAGLINE = 'A new bedtime story every brush'

// Layout (1024x500, safe zone roughly center 924x400)
const ICON_SIZE = 320
const ICON_X = 60
const ICON_Y = Math.round((H - ICON_SIZE) / 2) // vertically centered
const TEXT_X = 410
const TITLE_Y = 250
const TAGLINE_Y = 308
const TITLE_SIZE = 68
const TAGLINE_SIZE = 28

mkdirSync(OUT_DIR, { recursive: true })

// Background: diagonal gradient using app theme color
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF8A8A"/>
      <stop offset="1" stop-color="#FF5252"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.25" cy="0.5" r="0.6">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</svg>`

// Text overlay
const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <style>
    .title {
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      font-size: ${TITLE_SIZE}px;
      font-weight: 800;
      fill: #FFFFFF;
    }
    .tag {
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      font-size: ${TAGLINE_SIZE}px;
      font-weight: 500;
      fill: #FFFFFF;
      opacity: 0.94;
    }
  </style>
  <text x="${TEXT_X}" y="${TITLE_Y}" class="title">${TITLE}</text>
  <text x="${TEXT_X}" y="${TAGLINE_Y}" class="tag">${TAGLINE}</text>
</svg>`

async function build() {
  const iconBuf = await sharp(ICON)
    .resize(ICON_SIZE, ICON_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  await sharp(Buffer.from(bgSvg))
    .composite([
      { input: iconBuf, top: ICON_Y, left: ICON_X },
      { input: Buffer.from(textSvg), top: 0, left: 0 },
    ])
    .flatten({ background: { r: 255, g: 138, b: 138 } }) // strip alpha; Play rejects PNGs with alpha here
    .png()
    .toFile(OUT)

  console.log(`Wrote ${OUT} (${W}x${H})`)
}

build().catch((err) => {
  console.error(err)
  process.exit(1)
})
