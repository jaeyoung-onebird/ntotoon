# 엔투툰 배포 가이드 (AWS Lightsail + S3)

## 아키텍처

```
사용자 → Nginx (SSL) → Next.js 앱 (PM2)
                              ↓
                    PostgreSQL / Redis
                              ↓
              Claude API + Gemini API (AI 생성)
                              ↓
                         AWS S3 (이미지 저장)
```

---

## 1. AWS 사전 준비

### Lightsail 인스턴스
- OS: Ubuntu 22.04 LTS
- 플랜: **2GB RAM / 2vCPU ($10/월)** 이상
- 리전: ap-northeast-2 (서울)
- 방화벽: 포트 80, 443 열기

### S3 버킷
- 리전: ap-northeast-2
- 버킷 이름: `ntotoon-images` (원하는 이름)
- 퍼블릭 액세스 차단 ON (서명된 URL 사용)

### IAM 사용자 (S3 전용)
- 정책: AmazonS3FullAccess (또는 버킷 한정)
- Access Key / Secret Key 발급 → .env에 입력

---

## 2. 서버 초기 세팅 (최초 1회)

```bash
# 서버 접속
ssh ubuntu@YOUR_LIGHTSAIL_IP

# 레포 클론
git clone https://github.com/jaeyoung-onebird/ntotoon.git ~/ntotoon

# 자동 설치 (Node.js, PostgreSQL, Redis, Nginx, PM2)
bash ~/ntotoon/deploy/setup.sh
```

---

## 3. 환경변수 설정

```bash
cd ~/ntotoon
cp .env.example .env
nano .env
```

```env
# Auth
NEXTAUTH_SECRET="랜덤 문자열 (openssl rand -base64 32)"
NEXTAUTH_URL="https://yourdomain.com"

# Database (서버 내부 PostgreSQL)
DATABASE_URL="postgresql://ntotoon:PASSWORD@localhost:5432/ntotoon"

# Redis (서버 내부)
REDIS_URL="redis://localhost:6379"

# AI API
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_API_KEY="AIza..."

# AWS S3
AWS_REGION="ap-northeast-2"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET_NAME="ntotoon-images"

# 토스페이먼츠 (실제 결제 시)
NEXT_PUBLIC_TOSS_CLIENT_KEY="live_ck_..."
TOSS_SECRET_KEY="live_sk_..."

# BullMQ 워커 분리
USE_QUEUE=true

# Sentry (선택)
# SENTRY_DSN="https://..."
```

---

## 4. DB 생성

```bash
sudo -u postgres psql
```
```sql
CREATE USER ntotoon WITH PASSWORD 'YOUR_PASSWORD';
CREATE DATABASE ntotoon OWNER ntotoon;
\q
```

---

## 5. 빌드 & 실행

```bash
cd ~/ntotoon
npm install           # 폰트 자동 다운로드 포함
npx prisma migrate deploy
npm run build

# Nginx 설정
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ntotoon
sudo ln -s /etc/nginx/sites-available/ntotoon /etc/nginx/sites-enabled/
# nginx.conf 안에 YOUR_DOMAIN.com → 실제 도메인으로 교체
sudo nano /etc/nginx/sites-available/ntotoon
sudo nginx -t && sudo systemctl reload nginx

# SSL 발급
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 앱 시작
pm2 start deploy/ecosystem.config.js
pm2 save
```

---

## 6. 관리자 계정 설정

DB에서 직접 role 변경:
```bash
sudo -u postgres psql ntotoon
```
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';
\q
```
→ `/admin` 접속 가능

---

## 7. 이후 코드 업데이트

```bash
bash ~/ntotoon/deploy/deploy.sh
```

---

## 8. 유용한 명령어

```bash
# 앱 상태 확인
pm2 status

# 로그 확인
pm2 logs ntotoon
pm2 logs ntotoon-worker

# 재시작
pm2 restart ntotoon

# Nginx 로그
sudo tail -f /var/log/nginx/error.log
```

---

## 비용 예상 (월)

| 항목 | 비용 |
|------|------|
| Lightsail 2GB | $10 |
| S3 (이미지 저장 10GB) | ~$0.23 |
| S3 전송 (GET 요청) | ~$1 |
| **합계** | **~$11/월** |

> AI API 비용 별도: Gemini ~$0.07/에피소드, Claude ~$0.05/에피소드
