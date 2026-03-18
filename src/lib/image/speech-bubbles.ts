import { createCanvas, registerFont, CanvasRenderingContext2D } from 'canvas';
import sharp from 'sharp';
import type { DialogueData } from '@/types/scene';
import path from 'path';

// 한글 폰트 등록 - 웹툰용 둥근 폰트
try {
  registerFont(path.join(process.cwd(), 'public/fonts/NanumSquareRoundEB.ttf'), {
    family: 'NanumSquareRound',
    weight: 'bold',
  });
  registerFont(path.join(process.cwd(), 'public/fonts/NanumSquareRoundB.ttf'), {
    family: 'NanumSquareRound',
    weight: 'normal',
  });
} catch {
  console.warn('Korean font not found, using system fallback');
}

const FONT = 'bold 26px NanumSquareRound';
const NARRATION_FONT = '22px NanumSquareRound';
const SFX_FONT = 'bold 40px NanumSquareRound';

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
  // 빈 텍스트, undefined 필터링
  const validDialogues = (dialogues || []).filter(d => d && d.text && d.text.trim().length > 0);
  if (validDialogues.length === 0) return imageBuffer;

  const metadata = await sharp(imageBuffer).metadata();
  const W = metadata.width!;
  const H = metadata.height!;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const placed: BubbleRect[] = [];

  for (let i = 0; i < validDialogues.length; i++) {
    const d = validDialogues[i];
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

    // 대사 내용에 따라 말풍선 스타일 분기
    const text = d.text;
    const isShout = text.includes('!') && (text.match(/!/g) || []).length >= 1 && text.length < 20;
    const isWhisper = text.includes('...') || text.includes('…');
    const isQuestion = text.endsWith('?') && text.length < 25;

    if (isNarration) {
      drawNarrationBox(ctx, pos, lines);
    } else if (isThought) {
      drawThoughtBubble(ctx, pos, lines);
    } else if (isShout) {
      // 소리치는 대사 → 뾰족한 말풍선
      drawShoutBubble(ctx, pos, lines, H);
    } else if (isWhisper) {
      // 속삭이는/망설이는 대사 → 점선 말풍선
      drawWhisperBubble(ctx, pos, lines, H);
    } else if (lines.length === 1 && lines[0].length <= 8) {
      drawRoundBubble(ctx, pos, lines);
    } else {
      drawSpeechBubble(ctx, pos, lines, H);
    }
  }

  const overlay = canvas.toBuffer('image/png');
  return sharp(imageBuffer)
    .composite([{ input: overlay, blend: 'over' }])
    .jpeg({ quality: 100 })
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

  y = Math.min(y, imgH * 0.25 - h); // 상단 25% 이내에 배치 (얼굴 가림 방지)
  y = Math.max(margin, y);
  x = Math.max(margin, Math.min(x, imgW - w - margin));

  return { x, y, w, h };
}

function rectsOverlap(a: BubbleRect, b: BubbleRect): boolean {
  return !(a.x + a.w + 5 < b.x || b.x + b.w + 5 < a.x ||
           a.y + a.h + 5 < b.y || b.y + b.h + 5 < a.y);
}

// 짧은 대사 — 볼록한 둥근 말풍선 + 곡선 꼬리
function drawRoundBubble(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[]) {
  const { x, y, w, h } = pos;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.max(w, h) / 2 + 12;
  const ry = rx * 0.85;

  // 그림자
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // 테두리
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 곡선 꼬리
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy + ry - 4);
  ctx.quadraticCurveTo(cx - 8, cy + ry + 16, cx - 14, cy + ry + 14);
  ctx.quadraticCurveTo(cx - 4, cy + ry + 8, cx + 6, cy + ry - 4);
  ctx.fill();
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // 텍스트
  ctx.font = FONT;
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * LINE_HEIGHT + 8);
  });
  ctx.textAlign = 'left';
}

// 일반 대사 — 부드러운 모서리 + 곡선 꼬리
function drawSpeechBubble(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[], imgH?: number) {
  const { x, y, w, h } = pos;
  const r = 24;
  const tailDown = imgH ? (y + h / 2) < imgH * 0.6 : true;

  // 그림자
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // 테두리
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();

  // 곡선 꼬리 (S자 형태)
  ctx.save();
  const tailBaseX = x + w * 0.35;
  if (tailDown) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(tailBaseX, y + h - 2);
    ctx.quadraticCurveTo(tailBaseX - 6, y + h + 18, tailBaseX - 16, y + h + 20);
    ctx.quadraticCurveTo(tailBaseX + 2, y + h + 12, tailBaseX + 14, y + h - 2);
    ctx.fill();
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(tailBaseX, y + 2);
    ctx.quadraticCurveTo(tailBaseX - 6, y - 18, tailBaseX - 16, y - 20);
    ctx.quadraticCurveTo(tailBaseX + 2, y - 12, tailBaseX + 14, y + 2);
    ctx.fill();
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();

  // 텍스트
  ctx.font = FONT;
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2, y + PADDING + (i + 1) * LINE_HEIGHT - 6);
  });
  ctx.textAlign = 'left';
}

// 생각 말풍선 — 구름 모양 + 동그라미 꼬리
function drawThoughtBubble(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[]) {
  const { x, y, w, h } = pos;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // 구름 형태 (여러 원 합성)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#f0f0ff';
  ctx.beginPath();
  const rx = w / 2 + 10;
  const ry = h / 2 + 6;
  // 메인 타원
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // 구름 볼록한 부분들
  ctx.beginPath();
  ctx.arc(cx - rx * 0.5, cy - ry * 0.6, ry * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + rx * 0.4, cy - ry * 0.5, ry * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - rx * 0.3, cy + ry * 0.5, ry * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 테두리
  ctx.strokeStyle = '#aaaacc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 동그라미 꼬리 (3개)
  for (let i = 0; i < 3; i++) {
    const dotR = 7 - i * 2;
    const dotX = cx - rx * 0.3 - i * 12;
    const dotY = cy + ry + 6 + i * 10;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f0ff';
    ctx.fill();
    ctx.strokeStyle = '#aaaacc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 텍스트 (기울임)
  ctx.font = '24px NanumSquareRound';
  ctx.fillStyle = '#555566';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * LINE_HEIGHT + 8);
  });
  ctx.textAlign = 'left';
}

// 나레이션 — 반투명 다크 바
function drawNarrationBox(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[]) {
  const { x, y, w, h } = pos;

  // 배경 (반투명 다크, 부드러운 모서리)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(20, 20, 30, 0.82)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.restore();

  // 좌측 강조선
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  roundRect(ctx, x + 4, y + 6, 3, h - 12, 2);
  ctx.fill();

  // 텍스트
  ctx.font = NARRATION_FONT;
  ctx.fillStyle = '#f0f0f0';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2 + 4, y + PADDING + (i + 1) * (LINE_HEIGHT - 4) - 4);
  });
  ctx.textAlign = 'left';
}

// 소리치는 대사 — 뾰족뾰족 말풍선
function drawShoutBubble(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[], imgH: number) {
  const { x, y, w, h } = pos;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2 + 14;
  const ry = h / 2 + 10;
  const spikes = 12;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  // 뾰족한 별 모양
  ctx.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const r = i % 2 === 0 ? 1.0 : 0.82;
    ctx.lineTo(cx + Math.cos(angle) * rx * r, cy + Math.sin(angle) * ry * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const r = i % 2 === 0 ? 1.0 : 0.82;
    ctx.lineTo(cx + Math.cos(angle) * rx * r, cy + Math.sin(angle) * ry * r);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.font = 'bold 28px NanumSquareRound';
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * LINE_HEIGHT + 8);
  });
  ctx.textAlign = 'left';
}

// 속삭이는/망설이는 대사 — 점선 테두리 말풍선
function drawWhisperBubble(ctx: CanvasRenderingContext2D, pos: BubbleRect, lines: string[], imgH: number) {
  const { x, y, w, h } = pos;
  const r = 22;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#fafafa';
  ctx.fill();
  ctx.restore();

  // 점선 테두리
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.setLineDash([]);

  // 곡선 꼬리
  const tailDown = imgH ? (y + h / 2) < imgH * 0.6 : true;
  const tailBaseX = x + w * 0.35;
  ctx.fillStyle = '#fafafa';
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  if (tailDown) {
    ctx.beginPath();
    ctx.moveTo(tailBaseX, y + h - 2);
    ctx.quadraticCurveTo(tailBaseX - 4, y + h + 14, tailBaseX - 12, y + h + 16);
    ctx.quadraticCurveTo(tailBaseX + 2, y + h + 8, tailBaseX + 10, y + h - 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.font = '24px NanumSquareRound';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2, y + PADDING + (i + 1) * LINE_HEIGHT - 6);
  });
  ctx.textAlign = 'left';
}

// 효과음 — 굵고 역동적인 외곽선 텍스트
function drawSfx(ctx: CanvasRenderingContext2D, text: string, imgW: number, imgH: number, index: number) {
  const x = imgW * 0.3 + (index * 60) % (imgW * 0.4);
  const y = imgH * 0.4 + (index * 80) % (imgH * 0.3);

  // 약간 기울어진 효과
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.1 + index * 0.05);

  ctx.font = SFX_FONT;
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  // 외곽선 (두꺼운 흰색)
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, 0, 0);
  // 내부 (빨간색)
  ctx.fillStyle = '#ee2222';
  ctx.fillText(text, 0, 0);
  ctx.restore();
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
