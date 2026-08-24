// The floor plan PNGs are fully opaque, including the near-white space
// outside the building footprint - so simply stacking transparentlandscape.png
// underneath them has no visible effect. To let the landscape show through,
// we key out near-white pixels in the floor plan to transparent, client-side,
// via canvas, only when the landscape toggle is on. Each floor's result is
// cached so the (somewhat expensive, ~13MP) conversion only runs once.

const cache = new Map(); // floorImageUrl -> Promise<objectURL>

// Pixels at or above this brightness (on every channel) are treated as
// "empty floor plan background" and made transparent. Room fills, walls,
// and the hatching pattern are all darker than this, so real content is
// untouched.
const WHITE_THRESHOLD = 235;

export function getTransparentFloorImage(url) {
  if (!cache.has(url)) {
    cache.set(url, makeTransparentImage(url));
  }
  return cache.get(url);
}

function makeTransparentImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] >= WHITE_THRESHOLD && d[i + 1] >= WHITE_THRESHOLD && d[i + 2] >= WHITE_THRESHOLD) {
            d[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
          resolve(URL.createObjectURL(blob));
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}
