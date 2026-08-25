// Lets the app guess a room's category by sampling the floor plan PNG's
// own baked-in color at a given pixel, and matching it against
// SWATCH_COLORS. Stopgap for hover/tap category detection while the real
// room-polygon data is withheld pending verification (ROOMS_ENABLED in
// mapConfig.js is false - see data/source/README.md for why).
//
// Same load-into-canvas approach as landscapeLayer.js, but reading pixels
// back out instead of rewriting alpha - each floor's ImageData is cached
// so repeated hover/tap sampling is just an array lookup, not a re-decode.

import { SWATCH_COLORS, SWATCH_MATCH_THRESHOLD } from "./mapConfig.js";

const cache = new Map(); // floorImageUrl -> Promise<{ data, width, height }>

export function getFloorPixelData(url) {
  if (!cache.has(url)) {
    cache.set(url, loadPixelData(url));
  }
  return cache.get(url);
}

function loadPixelData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve({ data, width: canvas.width, height: canvas.height });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

// Perceptual color distance - weights R/B by how much they diverge from
// each other (approximating human sensitivity), so it separates gray
// hatching/walls from pastel swatch fills better than plain Euclidean
// distance. See the redmean investigation this was validated against.
function redmean([r1, g1, b1], [r2, g2, b2]) {
  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db
  );
}

// Returns the matched category key, or null if the sampled pixel (or
// coordinates) don't confidently match any swatch color.
export function matchCategoryAt(pixelData, x, y) {
  const { data, width, height } = pixelData;
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return null;

  const i = (py * width + px) * 4;
  if (data[i + 3] === 0) return null; // fully transparent, nothing to match

  const sample = [data[i], data[i + 1], data[i + 2]];

  let best = null;
  let bestDist = Infinity;
  for (const [category, color] of Object.entries(SWATCH_COLORS)) {
    const dist = redmean(sample, color);
    if (dist < bestDist) {
      bestDist = dist;
      best = category;
    }
  }

  return bestDist < SWATCH_MATCH_THRESHOLD ? best : null;
}
