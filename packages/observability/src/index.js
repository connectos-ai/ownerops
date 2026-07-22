const REDACTED = '[REDACTED]';
const MAX_STRING_LENGTH = 500;

const SENSITIVE_KEY_PATTERN = /(?:authorization|cookie|secret|token|password|credential|api[_-]?key|signing[_-]?secret|refresh[_-]?token|access[_-]?token|database[_-]?url|prompt|email[_-]?body|slack[_-]?message|message[_-]?body|raw[_-]?body|body|attachment)/i;

const SECRET_VALUE_PATTERNS = [
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bya29\.[A-Za-z0-9_-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi,
  /\bBasic\s+[A-Za-z0-9+/=]{8,}\b/gi,
  /\bpostgres(?:ql)?:\/\/[^\s"']+/gi
];

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function redactString(value) {
  const input = String(value);
  let output = input.replace(EMAIL_PATTERN, REDACTED);
  for (const pattern of SECRET_VALUE_PATTERNS) {
    output = output.replace(pattern, REDACTED);
  }
  if (output.length > MAX_STRING_LENGTH) {
    return `${output.slice(0, MAX_STRING_LENGTH)}...`;
  }
  return output;
}

export function redactLogValue(value, options = {}) {
  const seen = options.seen || new WeakSet();

  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, { seen }));
  }
  if (typeof value !== 'object') return REDACTED;
  if (seen.has(value)) return '[Circular]';

  seen.add(value);
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = REDACTED;
      continue;
    }
    output[key] = redactLogValue(entry, { seen });
  }
  return output;
}

export function createSafeLogEvent(event = {}) {
  const safe = redactLogValue(event);
  return {
    requestId: safe.requestId || null,
    workspaceId: safe.workspaceId || null,
    eventType: safe.eventType || safe.type || 'ownerops.event',
    handler: safe.handler || null,
    durationMs: Number.isFinite(safe.durationMs) ? safe.durationMs : null,
    success: typeof safe.success === 'boolean' ? safe.success : null,
    errorClass: safe.errorClass || null,
    retryCount: Number.isFinite(safe.retryCount) ? safe.retryCount : 0,
    data: safe.data || {}
  };
}

export { REDACTED };
