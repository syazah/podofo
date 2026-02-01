import sharp from "sharp";

const JPEG_QUALITY = 85;
const MAX_WIDTH = 2000;
const MAX_HEIGHT = 2800;

export class PreprocessService {
  private static instance: PreprocessService;
  private constructor() { }

  public static getInstance() {
    if (!PreprocessService.instance) {
      PreprocessService.instance = new PreprocessService()
    }
    return PreprocessService.instance
  }

  autoRotate = async (imageBuffer: Uint8Array): Promise<Buffer> => {
    return sharp(imageBuffer).rotate().toBuffer();
  };

  enhanceContrast = async (imageBuffer: Buffer): Promise<Buffer> => {
    return sharp(imageBuffer).normalize().toBuffer();
  };

  reduceNoise = async (imageBuffer: Buffer): Promise<Buffer> => {
    return sharp(imageBuffer).median(3).toBuffer();
  };

  compressImage = async (imageBuffer: Buffer): Promise<Buffer> => {
    return sharp(imageBuffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, {
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true
      })
      .toBuffer();
  };

  preprocessImage = async (rawPngBuffer: Uint8Array): Promise<Buffer> => {
    let buffer = await this.autoRotate(rawPngBuffer);
    buffer = await this.reduceNoise(buffer);
    buffer = await this.enhanceContrast(buffer);
    buffer = await this.compressImage(buffer);
    return buffer;
  };

}
