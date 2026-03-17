#!/usr/bin/env tsx
// BullMQ Worker Process
// Run with: npx tsx src/lib/queue/pipeline-worker.ts
// Or:       npm run worker

// Load environment variables
import 'dotenv/config';

// This imports the worker which auto-starts listening
console.log('[Worker] Starting pipeline worker...');
import('../src/lib/queue/pipeline-worker').then(() => {
  console.log('[Worker] Pipeline worker ready. Waiting for jobs...');
});

// Keep process alive
process.on('SIGINT', () => {
  console.log('[Worker] Shutting down...');
  process.exit(0);
});
