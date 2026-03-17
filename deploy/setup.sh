#!/bin/bash
# AWS Lightsail Ubuntu 22.04 초기 세팅 스크립트
# 실행: bash deploy/setup.sh

set -e

echo "=== 1. 시스템 업데이트 ==="
sudo apt-get update && sudo apt-get upgrade -y

echo "=== 2. Node.js 22 설치 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== 3. 빌드 도구 설치 (canvas 컴파일용) ==="
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev pkg-config

echo "=== 4. Redis 설치 ==="
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

echo "=== 5. PostgreSQL 설치 ==="
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

echo "=== 6. Nginx 설치 ==="
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx

echo "=== 7. PM2 설치 ==="
sudo npm install -g pm2 tsx
pm2 startup ubuntu -u ubuntu --hp /home/ubuntu

echo "=== 8. 로그 디렉토리 ==="
mkdir -p /home/ubuntu/logs

echo ""
echo "✅ 기본 설치 완료!"
echo ""
echo "다음 단계:"
echo "  1. git clone https://github.com/jaeyoung-onebird/ntotoon.git ~/ntotoon"
echo "  2. cd ~/ntotoon && cp .env.example .env && nano .env  (환경변수 입력)"
echo "  3. npm install"
echo "  4. npx prisma migrate deploy"
echo "  5. npm run build"
echo "  6. sudo cp deploy/nginx.conf /etc/nginx/sites-available/ntotoon"
echo "  7. sudo ln -s /etc/nginx/sites-available/ntotoon /etc/nginx/sites-enabled/"
echo "  8. sudo certbot --nginx -d YOUR_DOMAIN.com"
echo "  9. pm2 start deploy/ecosystem.config.js"
echo " 10. pm2 save"
