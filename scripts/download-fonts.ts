#!/usr/bin/env tsx
// npm install 시 자동 실행 (postinstall)
// NanumSquareRound 폰트를 public/fonts/에 다운로드

import fs from 'fs';
import path from 'path';
import https from 'https';

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

const FONTS = [
  {
    name: 'NanumSquareRoundB.ttf',
    url: 'https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/NanumSquareRoundB.ttf',
  },
  {
    name: 'NanumSquareRoundEB.ttf',
    url: 'https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/NanumSquareRoundEB.ttf',
  },
];

async function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (u: string) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          request(res.headers.location!);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      }).on('error', reject);
    };
    request(url);
  });
}

async function main() {
  fs.mkdirSync(FONT_DIR, { recursive: true });

  for (const font of FONTS) {
    const fontPath = path.join(FONT_DIR, font.name);
    if (fs.existsSync(fontPath) && fs.statSync(fontPath).size > 100000) {
      // 100KB 이상이면 정상 TTF (HTML은 보통 30KB 이하)
      console.log(`[fonts] ${font.name} already exists, skipping`);
      continue;
    }

    console.log(`[fonts] Downloading ${font.name}...`);
    try {
      await download(font.url, fontPath);
      console.log(`[fonts] Download complete: ${font.name}`);
    } catch (err) {
      console.warn(`[fonts] Download failed (speech bubbles will use system font):`, err);
    }
  }
}

main();
