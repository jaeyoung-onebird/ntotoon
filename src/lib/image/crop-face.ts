import sharp from 'sharp';

// Character sheet layout: top row = full body views, bottom row = face expressions
// We crop the first face expression (roughly bottom-left quarter)
export async function cropFaceFromSheet(sheetBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(sheetBuffer).metadata();
  const w = metadata.width!;
  const h = metadata.height!;

  // Crop bottom-left face expression (approximately)
  const faceRegion = {
    left: Math.round(w * 0.05),
    top: Math.round(h * 0.55),
    width: Math.round(w * 0.25),
    height: Math.round(h * 0.4),
  };

  return sharp(sheetBuffer)
    .extract(faceRegion)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toBuffer();
}
