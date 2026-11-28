// Paper sticker of a spirit animal (2D, from /js/3d/ww-zoo.js) on a canvas.
export function sticker(animal, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.setAttribute('aria-hidden', 'true');
  const ctx = c.getContext('2d');
  ctx.scale(size / 512, size / 512); // drawAnimal paints a 512×512 sticker
  try {
    window.WWZoo?.drawAnimal(ctx, animal);
  } catch {
    // no sticker, no problem
  }
  return c;
}
