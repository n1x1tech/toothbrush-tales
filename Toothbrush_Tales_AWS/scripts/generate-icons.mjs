import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputSvg = path.join(__dirname, '../public/favicon.svg');
const outputDir = path.join(__dirname, '../public/icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Icon sizes needed for PWA
const iconSizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

// iOS splash screen sizes
const splashSizes = [
  { width: 640, height: 1136, name: 'splash-640x1136.png' },
  { width: 750, height: 1334, name: 'splash-750x1334.png' },
  { width: 1242, height: 2208, name: 'splash-1242x2208.png' },
  { width: 1125, height: 2436, name: 'splash-1125x2436.png' },
  { width: 1170, height: 2532, name: 'splash-1170x2532.png' },
  { width: 1284, height: 2778, name: 'splash-1284x2778.png' },
  { width: 1179, height: 2556, name: 'splash-1179x2556.png' },
  { width: 1290, height: 2796, name: 'splash-1290x2796.png' },
  { width: 2048, height: 2732, name: 'splash-2048x2732.png' },
];

async function generateIcons() {
  console.log('Generating PWA icons...');

  // Read SVG file
  const svgBuffer = fs.readFileSync(inputSvg);

  // Generate app icons
  for (const { size, name } of iconSizes) {
    const outputPath = path.join(outputDir, name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created: ${name}`);
  }

  // Generate splash screens with centered icon on background
  console.log('\nGenerating iOS splash screens...');

  for (const { width, height, name } of splashSizes) {
    const iconSize = Math.min(width, height) * 0.4; // Icon takes 40% of smallest dimension
    const iconBuffer = await sharp(svgBuffer)
      .resize(Math.round(iconSize), Math.round(iconSize))
      .png()
      .toBuffer();

    const outputPath = path.join(outputDir, name);
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 107, b: 107, alpha: 1 }, // #FF6B6B
      },
    })
      .composite([
        {
          input: iconBuffer,
          gravity: 'center',
        },
      ])
      .png()
      .toFile(outputPath);
    console.log(`Created: ${name}`);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
