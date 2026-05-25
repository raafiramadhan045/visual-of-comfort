/**
 * Download canvas content with the orange background (#f05423) made transparent.
 * This captures only the particles/visuals without the background color.
 */
export function downloadTransparentPng(
  canvas: HTMLCanvasElement,
  filename?: string,
): void {
  // Create offscreen canvas matching source dimensions
  const offscreen = document.createElement('canvas');
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const ctx = offscreen.getContext('2d')!;

  // Copy the main canvas
  ctx.drawImage(canvas, 0, 0);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data = imageData.data;

  // Background color: #f05423 = RGB(240, 84, 35)
  const bgR = 240;
  const bgG = 84;
  const bgB = 35;
  const tolerance = 35; // Allow for antialiasing variations

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Check if this pixel is close to the orange background
    const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
    if (dist <= tolerance * 3) {
      // Make it transparent
      data[i + 3] = 0;
    }
    // Otherwise keep the pixel as-is (white particles, colored image particles, etc.)
  }

  // Put modified data back
  ctx.putImageData(imageData, 0, 0);

  // Download
  const link = document.createElement('a');
  link.download = filename || 'voc-transparent.png';
  link.href = offscreen.toDataURL('image/png');
  link.click();
}
