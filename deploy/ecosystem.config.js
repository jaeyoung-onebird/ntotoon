// PM2 프로세스 설정
// 실행: pm2 start deploy/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'ntotoon',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/ubuntu/ntotoon',
      instances: 1,        // Lightsail 2GB = 1 인스턴스
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      error_file: '/home/ubuntu/logs/ntotoon-error.log',
      out_file: '/home/ubuntu/logs/ntotoon-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'ntotoon-worker',
      script: 'node_modules/.bin/tsx',
      args: 'scripts/worker.ts',
      cwd: '/home/ubuntu/ntotoon',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '800M',
      error_file: '/home/ubuntu/logs/worker-error.log',
      out_file: '/home/ubuntu/logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
