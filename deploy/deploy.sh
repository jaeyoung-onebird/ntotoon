#!/bin/bash
# 코드 업데이트 배포 스크립트 (서버에서 실행)
# 실행: bash deploy/deploy.sh

set -e
APP_DIR="/home/ubuntu/ntotoon"

echo "=== 배포 시작 ==="

cd $APP_DIR

echo "--- git pull ---"
git pull origin main

echo "--- npm install ---"
npm install --production=false

echo "--- prisma migrate ---"
npx prisma migrate deploy

echo "--- next build ---"
npm run build

echo "--- pm2 reload ---"
pm2 reload ntotoon --update-env
pm2 reload ntotoon-worker --update-env

echo ""
echo "✅ 배포 완료!"
pm2 status
