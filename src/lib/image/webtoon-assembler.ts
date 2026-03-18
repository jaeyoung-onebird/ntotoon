import sharp from 'sharp';

const WEBTOON_WIDTH = 1080;
const PANEL_GAP = 30;
const BACKGROUND_COLOR = '#ffffff';

export interface PanelImage {
  buffer: Buffer;
  id: string;
}

export async function assembleWebtoon(panels: PanelImage[]): Promise<Buffer> {
  if (panels.length === 0) throw new Error('No panels to assemble');

  // Resize all panels to consistent width and get their heights
  const resizedPanels: Array<{ buffer: Buffer; height: number; id: string }> = [];
  for (const panel of panels) {
    try {
      const metadata = await sharp(panel.buffer).metadata();
      const w = metadata.width || 1;
      const h = metadata.height || 1;
      if (w < 10 || h < 10) continue; // 손상된 이미지 건너뛰기
      const aspectRatio = h / w;
      const newHeight = Math.round(WEBTOON_WIDTH * aspectRatio);

      const buffer = await sharp(panel.buffer)
        .resize(WEBTOON_WIDTH, newHeight, { fit: 'fill' })
        .png({ compressionLevel: 1 })
        .toBuffer();

      resizedPanels.push({ buffer, height: newHeight, id: panel.id });
    } catch (err) {
      console.warn(`[Assembler] 패널 ${panel.id} 리사이즈 실패, 건너뛰기:`, (err as Error).message);
    }
  }

  if (resizedPanels.length === 0) throw new Error('No valid panels to assemble');

  // Calculate total height
  const totalHeight =
    resizedPanels.reduce((sum, p) => sum + p.height, 0) +
    PANEL_GAP * (resizedPanels.length - 1) +
    PANEL_GAP * 2; // Top and bottom padding

  // Create composite instructions
  let currentY = PANEL_GAP;
  const compositeInputs = resizedPanels.map((panel) => {
    const input = { input: panel.buffer, top: currentY, left: 0 };
    currentY += panel.height + PANEL_GAP;
    return input;
  });

  // Stitch vertically
  return sharp({
    create: {
      width: WEBTOON_WIDTH,
      height: totalHeight,
      channels: 4,
      background: BACKGROUND_COLOR,
    },
  })
    .composite(compositeInputs)
    .jpeg({ quality: 100, progressive: true })
    .toBuffer();
}

export async function createPanelThumbnail(
  panelBuffer: Buffer,
  width = 300
): Promise<Buffer> {
  return sharp(panelBuffer)
    .resize(width, null, { fit: 'inside' })
    .jpeg({ quality: 100 })
    .toBuffer();
}
