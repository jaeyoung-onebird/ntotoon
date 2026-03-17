#!/usr/bin/env tsx
// npm install 시 자동 실행 (postinstall)
// Noto Sans KR 폰트를 public/fonts/에 다운로드

import fs from 'fs';
import path from 'path';
import https from 'https';

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
const FONT_PATH = path.join(FONT_DIR, 'NotoSansKR-Bold.otf');

// Google Fonts GitHub에서 NotoSansKR OTF 다운로드
const FONT_URL = 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf';

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
  if (fs.existsSync(FONT_PATH)) {
    console.log('[fonts] NotoSansKR-Bold.otf already exists, skipping download');
    return;
  }

  fs.mkdirSync(FONT_DIR, { recursive: true });
  console.log('[fonts] Downloading NotoSansKR-Bold.otf (~15MB)...');

  try {
    await download(FONT_URL, FONT_PATH);
    console.log('[fonts] Download complete:', FONT_PATH);
  } catch (err) {
    console.warn('[fonts] Download failed (speech bubbles will use system font):', err);
    // 실패해도 빌드는 계속
  }
}

main();
