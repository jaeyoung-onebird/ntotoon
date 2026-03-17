// Lightweight error reporter
// Replace with Sentry SDK when ready: npm install @sentry/nextjs

const SENTRY_DSN = process.env.SENTRY_DSN;

interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: { id: string; email?: string };
}

export function captureException(error: Error | unknown, context?: ErrorContext) {
  const err = error instanceof Error ? error : new Error(String(error));

  // Always log to console
  console.error('[Error]', err.message, context?.tags || '');

  if (!SENTRY_DSN) return;

  // Send to Sentry API directly (no SDK needed)
  const payload = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: 'error',
    logger: 'ntow',
    exception: {
      values: [{
        type: err.name,
        value: err.message,
        stacktrace: err.stack ? {
          frames: err.stack.split('\n').slice(1).map(line => ({
            filename: line.trim(),
          })).reverse(),
        } : undefined,
      }],
    },
    tags: context?.tags || {},
    extra: context?.extra || {},
    user: context?.user,
  };

  // Fire and forget
  fetch(`${SENTRY_DSN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {}); // silently fail
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  console.log(`[${level.toUpperCase()}]`, message);
  // Could send to Sentry as well
}
