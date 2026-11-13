import { encodePng, type RgbaImage } from './image';

export interface AtlasFrame {
  readonly name: string;
  readonly image: RgbaImage;
}

const ATLAS_WIDTH = 512;
const PADDING = 2;

/**
 * Range les frames en étagères et produit l'atlas PNG + son JSON au format Phaser
 * (« JSON Hash »). Les frames gardent leur nom (unit/<type>/<anim>/<direction>/<index>…).
 */
export async function packAtlas(
  frames: readonly AtlasFrame[],
  imageName: string,
): Promise<{ png: Buffer; json: unknown }> {
  const sorted = [...frames].sort(
    (a, b) => b.image.height - a.image.height || a.name.localeCompare(b.name),
  );
  const placements: { frame: AtlasFrame; x: number; y: number }[] = [];
  let x = PADDING;
  let y = PADDING;
  let shelf = 0;
  for (const frame of sorted) {
    if (x + frame.image.width + PADDING > ATLAS_WIDTH) {
      x = PADDING;
      y += shelf + PADDING;
      shelf = 0;
    }
    placements.push({ frame, x, y });
    x += frame.image.width + PADDING;
    shelf = Math.max(shelf, frame.image.height);
  }
  const height = y + shelf + PADDING;
  const data = new Uint8ClampedArray(ATLAS_WIDTH * height * 4);
  for (const { frame, x: fx, y: fy } of placements) {
    const { image } = frame;
    for (let row = 0; row < image.height; row++) {
      const start = row * image.width * 4;
      data.set(
        image.data.subarray(start, start + image.width * 4),
        ((fy + row) * ATLAS_WIDTH + fx) * 4,
      );
    }
  }

  const json = {
    frames: Object.fromEntries(
      placements
        .sort((a, b) => a.frame.name.localeCompare(b.frame.name))
        .map(({ frame, x: fx, y: fy }) => [
          frame.name,
          {
            frame: { x: fx, y: fy, w: frame.image.width, h: frame.image.height },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: frame.image.width, h: frame.image.height },
            sourceSize: { w: frame.image.width, h: frame.image.height },
          },
        ]),
    ),
    meta: {
      app: '@antiqua/asset-pipeline',
      image: imageName,
      format: 'RGBA8888',
      size: { w: ATLAS_WIDTH, h: height },
      scale: '1',
    },
  };
  return { png: await encodePng({ width: ATLAS_WIDTH, height, data }), json };
}
