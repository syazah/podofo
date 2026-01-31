import sharp from "sharp";

export const autoRotate = async (imageBuffer: Uint8Array): Promise<Buffer> => {
  return sharp(imageBuffer).rotate().toBuffer();
};

export const enhanceContrast = async (imageBuffer: Buffer): Promise<Buffer> => {
  return sharp(imageBuffer).normalize().toBuffer();
};

export const reduceNoise = async (imageBuffer: Buffer): Promise<Buffer> => {
  return sharp(imageBuffer).median(3).toBuffer();
};

export const preprocessPage = async (rawPngBuffer: Uint8Array): Promise<Buffer> => {
  let buffer = await autoRotate(rawPngBuffer);
  buffer = await reduceNoise(buffer);
  buffer = await enhanceContrast(buffer);
  return buffer;
};
