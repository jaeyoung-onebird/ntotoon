import { createCanvas, registerFont, CanvasRenderingContext2D } from 'canvas';
import sharp from 'sharp';
import type { DialogueData } from '@/types/scene';
import path from 'path';

// 한글 폰트 등록 (postinstall 스크립트로 다운로드된 NotoSansKR 우선)
try {
  registerFont(path.join(process.cwd(), 'public/fonts/NotoSansKR-Bold.otf'), {
    family: 'NotoSansKR',
    weight: 'bold',
  });
} catch {
  console.warn('Korean font not found, using system fallback');
}

const FONT = 'bold 24px "NotoSansKR", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
const NARRATION_FONT = '20px "NotoSansKR", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
const SFX_FONT = 'bold 36px "NotoSansKR", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';

const MAX_LINE_WIDTH = 240;
const PADDING = 16;
const LINE_HEIGHT = 30;
const BUBBLE_RADIUS = 20;

interface BubbleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function addSpeechBubbles(
  imageBuffer: Buffer,
  dialogues: DialogueData[]
): Promise<Buffer> {
  if (!dialogues || dialogues.length === 0) return imageBuffer;

  const metadata = await sharp(imageBuffer).metadata();
  const W = metadata.width!;
  const H = metadata.height!;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const placed: BubbleRect[] = [];

  for (let i = 0; i < dialogues.length; i++) {
    const d = dialogues[i];
    const isNarration = d.type === 'narration';
    const isSfx = d.type === 'sfx';
    const isThought = d.type === 'thought';

    if (isSfx) {
      drawSfx(ctx, d.text, W, H, i);
      continue;
    }

    ctx.font = isNarration ? NARRATION_FONT : FONT;
    const lines = wrapText(ctx, d.text, MAX_LINE_WIDTH);
    const textW = Math.min(MAX_LINE_WIDTH, Math.max(...lines.map(l => ctx.measureText(l).width)));
    const bubbleW = textW + PADDING * 2;
    const bubbleH = lines.length * LINE_HEIGHT + PADDING * 2;

    const pos = findPosition(bubbleW, bubbleH, W, H, placed, i, isNarration, dialogues.length, d.positionX ?? undefined, d.positionY ?? undefined);
    placed.push(pos);

    if (isNarration) {
      drawNarrationBox(ctx, pos, lines);
    } else if (isThought) {
      drawThoughtBubble(ctx, pos, lines);
    } else if (lines.length === 1 && lines[0].length <= 8) {
      // 짧은 대사 → 동그란 말풍선
      drawRoundBubble(ctx, pos, lines);
    } else {
      drawSpeechBubble(ctx, pos, lines, H);
    }
  }

  const overlay = canvas.toBuffer('image/png');
  return sharp(imageBuffer)
    .composite([{ input: overlay, blend: 'over' }])
    .png()
    .toBuffer();
}

function findPosition(
  w: number, h: number,
  imgW: number, imgH: number,
  placed: BubbleRect[],
  index: number,
  isNarration: boolean,
  totalDialogues: number = 1,
  explicitX?: number, // 0-1 비율 (Claude Vision에서 계산된 위치)
  explicitY?: number,
): BubbleRect {
  const margin = 20;

  // Claude Vision이 계산한 위치가 있으면 그걸 우선 사용
  if (explicitX !== undefined && explicitY !== undefined) {
    const x = Math.max(margin, Math.min(explicitX * imgW - w / 2, imgW - w - margin));
    const y = Math.max(margin, Math.min(explicitY * imgH - h / 2, imgH - h - margin));
    return { x, y, w, h };
  }

  if (isNarration) {
    const topNarrations = placed.filter(p => p.y < imgH * 0.2);
    const useBottom = topNarrations.length > 0;
    const x = (imgW - w) / 2;
    let y: number;
    if (useBottom) {
      y = imgH - h - margin - (placed.filter(p => p.y > imgH * 0.7).length * (h + 10));
      y = Math.max(imgH * 0.75, y);
    } else {
      y = margin + topNarrations.length * (h + 10);
      y = Math.min(y, imgH * 0.15);
    }
    return { x, y, w, h };
  }

  let x: number;
  let y = margin + 10;

  if (totalDialogues === 1) {
    x = (imgW - w) / 2;
  } else {
    const isLeft = index % 2 === 0;
    x = isLeft ? margin + 20 : imgW - w - margin - 20;
  }

  for (const p of placed) {
    if (rectsOverlap({ x, y, w, h }, p)) {
      y = p.y + p.h + 12;
    }
  }

  y = Math.min(y, imgH * 0.35 - h);
  y = Math.max(margin, y);
  x = Math.max(margin, Math.min(x, imgW - w - margin));

  return { x, y, w, h };
}

function rectsOverlap(a: BubbleRect, b: BubbleRect): boolean {
  return !(a.x + a.w + 5 < b.x || b.x + b.w + 5 < a.x ||
           a.y + a.h + 5 < b.y || b.y + b.h + 5 < a.y);
}

function drawRoundBubble(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[]) {
  const { x, y, w, h } = pos;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.max(w, h) / 2 + 8;
  const ry = rx;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;

  // 원형 말풍선
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 꼬리 (작은 삼각형)
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + ry - 2);
  ctx.lineTo(cx - 2, cy + ry + 10);
  ctx.lineTo(cx + 5, cy + ry - 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + ry - 2);
  ctx.lineTo(cx - 2, cy + ry + 10);
  ctx.lineTo(cx + 5, cy + ry - 2);
  ctx.stroke();

  // 텍스트
  ctx.font = FONT;
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * LINE_HEIGHT + 8);
  });
  ctx.textAlign = 'left';
}

function drawSpeechBubble(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[], imgH?: number) {
  const { x, y, w, h } = pos;
  const r = BUBBLE_RADIUS;
  // 말풍선이 상단에 있으면 꼬리를 아래로, 하단이면 위로
  const tailDown = imgH ? (y + h / 2) < imgH * 0.6 : true;
  const tailX1 = x + w * 0.4;
  const tailX2 = x + w * 0.45;
  const tailX3 = x + w * 0.55;
  const tailLen = 14;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  if (tailDown) {
    // 꼬리 아래
    ctx.lineTo(tailX3, y + h);
    ctx.lineTo(tailX2, y + h + tailLen);
    ctx.lineTo(tailX1, y + h);
  } else {
    ctx.lineTo(x + r, y + h);
  }
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  if (!tailDown) {
    // 꼬리 위
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(tailX1, y);
    ctx.lineTo(tailX2, y - tailLen);
    ctx.lineTo(tailX3, y);
  } else {
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
  ctx.closePath();

  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = FONT;
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2, y + PADDING + (i + 1) * LINE_HEIGHT - 6);
  });
  ctx.textAlign = 'left';
}

function drawThoughtBubble(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[]) {
  const { x, y, w, h } = pos;
  const r = 24;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 6;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#f8f8ff';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 3; i++) {
    const dotR = 5 - i * 1.5;
    ctx.beginPath();
    ctx.arc(x + w * 0.4 - i * 10, y + h + 8 + i * 10, dotR, 0, Math.PI * 2);
    ctx.fillStyle = '#f8f8ff';
    ctx.fill();
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.font = FONT.replace('bold', 'italic');
  ctx.fillStyle = '#444444';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2, y + PADDING + (i + 1) * LINE_HEIGHT - 6);
  });
  ctx.textAlign = 'left';
}

function drawNarrationBox(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[]) {
  const { x, y, w, h } = pos;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 11);
  ctx.stroke();

  ctx.font = NARRATION_FONT;
  ctx.fillStyle = '#eeeeee';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2, y + PADDING + (i + 1) * (LINE_HEIGHT - 4) - 4);
  });
  ctx.textAlign = 'left';
}

function drawSfx(ctx: CanvasRenderingContext2D, text: string, imgW: number, imgH: number, index: number) {
  const x = imgW * 0.3 + (index * 60) % (imgW * 0.4);
  const y = imgH * 0.4 + (index * 80) % (imgH * 0.3);

  ctx.font = SFX_FONT;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ee2222';
  ctx.fillText(text, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    const chars = [...para];
    let current = '';
    for (const char of chars) {
      const test = current + char;
      if (ctx.measureText(test).width > maxWidth && current.length > 0) {
        lines.push(current);
        current = char;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}
