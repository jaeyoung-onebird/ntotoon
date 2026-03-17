const MAX_LENGTH = 10000;

const BLOCKED_PATTERNS = [
  /^.*ignore previous instructions.*$/gim,
  /^.*you are now.*$/gim,
  /^system:.*$/gim,
  /^assistant:.*$/gim,
];

export function sanitizeUserInput(text: string): string {
  let cleaned = text;

  // Strip lines matching injection patterns
  for (const pattern of BLOCKED_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove XML/HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Collapse multiple blank lines left by removals
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  // Limit length
  if (cleaned.length > MAX_LENGTH) {
    cleaned = cleaned.slice(0, MAX_LENGTH);
  }

  return cleaned;
}
