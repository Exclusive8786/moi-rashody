import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const GLYPH =
  "M180-120q-23 0-41.5-18T120-180v-600q0-23 18.5-41.5T180-840h600q24 0 42 18.5t18 41.5v54H538q-58 0-96 38t-38 95v227q0 57 38 95t96 38h302v53q0 24-18 42t-42 18H180Zm358-173q-34 0-54-20t-20-53v-227q0-34 20-53.5t54-19.5h269q34 0 54 19.5t20 53.5v227q0 33-20 53t-54 20H538Zm114-123q25 0 44.5-19.5T716-481q0-25-19.5-44T652-544q-25 0-44.5 19T588-481q0 26 19.5 45.5T652-416Z";

const BRAND = "#2F6BFF";

function iconSvg(size, { glyph = 0.5, rounded = true, circle = false } = {}) {
  const g = size * glyph;
  const s = g / 960;
  const offset = (size - g) / 2;
  const shape = circle
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${BRAND}"/>`
    : `<rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${BRAND}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${shape}
    <g transform="translate(${offset} ${offset}) scale(${s}) translate(0 960)">
      <path d="${GLYPH}" fill="#ffffff"/>
    </g>
  </svg>`;
}

function foregroundSvg(size, glyph = 0.4) {
  const g = size * glyph;
  const s = g / 960;
  const offset = (size - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <g transform="translate(${offset} ${offset}) scale(${s}) translate(0 960)">
      <path d="${GLYPH}" fill="#ffffff"/>
    </g>
  </svg>`;
}

function splashSvg(w, h) {
  const g = Math.min(w, h) * 0.26;
  const s = g / 960;
  const x = (w - g) / 2;
  const y = (h - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${BRAND}"/>
    <g transform="translate(${x} ${y}) scale(${s}) translate(0 960)">
      <path d="${GLYPH}" fill="#ffffff"/>
    </g>
  </svg>`;
}

async function render(svg, out) {
  await fs.promises.mkdir(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(out);
}

const root = path.resolve(import.meta.dirname, "..");
const res = path.join(root, "android/app/src/main/res");
const pub = path.join(root, "public");

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Web / PWA icons
await render(iconSvg(192, { glyph: 0.5 }), path.join(pub, "icon-192.png"));
await render(iconSvg(512, { glyph: 0.5 }), path.join(pub, "icon-512.png"));

// Favicon as inline SVG
await fs.promises.writeFile(path.join(pub, "favicon.svg"), iconSvg(64, { glyph: 0.5 }));

// Android legacy + adaptive icons
for (const [name, factor] of Object.entries(densities)) {
  const legacy = Math.round(48 * factor);
  const adaptive = Math.round(108 * factor);
  const dir = path.join(res, `mipmap-${name}`);
  await render(iconSvg(legacy, { glyph: 0.5 }), path.join(dir, "ic_launcher.png"));
  await render(iconSvg(legacy, { glyph: 0.5, circle: true }), path.join(dir, "ic_launcher_round.png"));
  await render(foregroundSvg(adaptive, 0.4), path.join(dir, "ic_launcher_foreground.png"));
}

// Splash screens keep existing dimensions
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk(res).filter((f) => path.basename(f) === "splash.png")) {
  const { width, height } = await sharp(file).metadata();
  await render(splashSvg(width, height), file);
}

console.log("icons rendered");
