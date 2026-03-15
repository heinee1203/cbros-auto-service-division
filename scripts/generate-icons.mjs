import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "..", "public", "icons");

mkdirSync(outputDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

function createSvg(size) {
  const fontSize = Math.round(size * 0.38);
  const cornerRadius = Math.round(size * 0.18);
  const yOffset = Math.round(size * 0.05);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#1A1A2E"/>
  <text
    x="50%"
    y="50%"
    dy="${yOffset}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="bold"
    font-size="${fontSize}"
    fill="#F59E0B"
    letter-spacing="${Math.round(size * 0.02)}"
  >AS</text>
</svg>`;
}

async function generateIcons() {
  console.log("Generating PWA icons...");

  for (const size of sizes) {
    const svg = createSvg(size);
    const outputPath = join(outputDir, `icon-${size}x${size}.png`);

    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`  Created icon-${size}x${size}.png`);
  }

  console.log("Done! All icons generated.");
}

generateIcons().catch(console.error);
