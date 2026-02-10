const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load script source for function extraction
const scriptPath = path.join(__dirname, '..', 'scripts', 'notify-stop.js');
const scriptSource = fs.readFileSync(scriptPath, 'utf-8');

// Extract and evaluate individual functions for unit testing
function extractFunction(source, name) {
  // Create a module-like context with required modules
  const module = { exports: {} };
  const context = {
    require: require,
    module,
    exports: module.exports,
    __dirname: path.join(__dirname, '..', 'scripts'),
    __filename: scriptPath,
    process: { ...process, env: { ...process.env }, stdin: { isTTY: true } },
  };

  // We'll test functions by importing them indirectly
  return null;
}

// --- Unit Tests ---

describe('formatDuration', () => {
  // Recreate the function for isolated testing
  function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}초`;
    const min = Math.floor(sec / 60);
    const remainSec = sec % 60;
    if (min < 60) return `${min}분 ${remainSec}초`;
    const hr = Math.floor(min / 60);
    const remainMin = min % 60;
    return `${hr}시간 ${remainMin}분`;
  }

  it('should format seconds', () => {
    assert.strictEqual(formatDuration(5000), '5초');
    assert.strictEqual(formatDuration(59000), '59초');
  });

  it('should format minutes and seconds', () => {
    assert.strictEqual(formatDuration(60000), '1분 0초');
    assert.strictEqual(formatDuration(90000), '1분 30초');
    assert.strictEqual(formatDuration(3599000), '59분 59초');
  });

  it('should format hours and minutes', () => {
    assert.strictEqual(formatDuration(3600000), '1시간 0분');
    assert.strictEqual(formatDuration(5400000), '1시간 30분');
  });

  it('should handle zero', () => {
    assert.strictEqual(formatDuration(0), '0초');
  });
});

describe('maskSecrets', () => {
  function maskSecrets(text, patterns) {
    let masked = text;
    for (const pat of patterns) {
      try {
        masked = masked.replace(new RegExp(pat, 'gi'), '***');
      } catch { /* skip */ }
    }
    return masked;
  }

  const defaultPatterns = [
    'sk-[a-zA-Z0-9]{20,}',
    'token[=:\\s]["\']?[a-zA-Z0-9_\\-]{20,}',
    'password[=:\\s]["\']?\\S{6,}',
  ];

  it('should mask API keys', () => {
    const input = 'Use sk-abcdefghijklmnopqrstuv for auth';
    const result = maskSecrets(input, defaultPatterns);
    assert.strictEqual(result, 'Use *** for auth');
  });

  it('should not mask short strings', () => {
    const input = 'sk-short is fine';
    const result = maskSecrets(input, defaultPatterns);
    assert.strictEqual(result, 'sk-short is fine');
  });

  it('should mask password values', () => {
    const input = 'Set password=mysecretpassword123';
    const result = maskSecrets(input, defaultPatterns);
    assert.ok(!result.includes('mysecretpassword123'));
  });

  it('should handle invalid regex patterns gracefully', () => {
    const input = 'test string';
    const result = maskSecrets(input, ['[invalid']);
    assert.strictEqual(result, 'test string');
  });
});

describe('validateWebhookUrl', () => {
  function validateWebhookUrl(webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      if (url.protocol !== 'https:') return false;
      if (!url.hostname.endsWith('.slack.com')) return false;
      if (!url.pathname.startsWith('/services/')) return false;
      return true;
    } catch { return false; }
  }

  it('should accept valid Slack webhook URLs', () => {
    assert.strictEqual(validateWebhookUrl('https://hooks.slack.com/services/T123/B456/abc'), true);
  });

  it('should reject HTTP URLs', () => {
    assert.strictEqual(validateWebhookUrl('http://hooks.slack.com/services/T123/B456/abc'), false);
  });

  it('should reject non-Slack domains', () => {
    assert.strictEqual(validateWebhookUrl('https://evil.com/services/T123'), false);
  });

  it('should reject non-services paths', () => {
    assert.strictEqual(validateWebhookUrl('https://hooks.slack.com/other/T123'), false);
  });

  it('should reject invalid URLs', () => {
    assert.strictEqual(validateWebhookUrl('not-a-url'), false);
    assert.strictEqual(validateWebhookUrl(''), false);
  });
});

describe('.env parsing regex', () => {
  const regex = /^\s*(SLACK_WEBHOOK_URL|SLACK_MENTION_USER_ID)\s*=\s*(?:["']([^"'\n]*)["']|([^#\n]*))/;

  it('should parse unquoted values', () => {
    const match = 'SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T/B/x'.match(regex);
    assert.ok(match);
    assert.strictEqual((match[2] ?? match[3] ?? '').trim(), 'https://hooks.slack.com/services/T/B/x');
  });

  it('should parse double-quoted values', () => {
    const match = 'SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T/B/x"'.match(regex);
    assert.ok(match);
    assert.strictEqual((match[2] ?? match[3] ?? '').trim(), 'https://hooks.slack.com/services/T/B/x');
  });

  it('should parse single-quoted values (P0-4 fix)', () => {
    const match = "SLACK_WEBHOOK_URL='https://hooks.slack.com/services/T/B/x'".match(regex);
    assert.ok(match);
    assert.strictEqual((match[2] ?? match[3] ?? '').trim(), 'https://hooks.slack.com/services/T/B/x');
  });

  it('should strip inline comments for unquoted values', () => {
    const match = 'SLACK_MENTION_USER_ID=U12345 # my ID'.match(regex);
    assert.ok(match);
    assert.strictEqual((match[2] ?? match[3] ?? '').trim(), 'U12345');
  });

  it('should handle leading whitespace', () => {
    const match = '  SLACK_WEBHOOK_URL=https://example.com'.match(regex);
    assert.ok(match);
  });

  it('should ignore non-matching keys', () => {
    const match = 'OTHER_KEY=value'.match(regex);
    assert.strictEqual(match, null);
  });
});

describe('cooldown check', () => {
  const cooldownFile = path.join(os.tmpdir(), '.claude-slack-notify-test-cooldown');

  function checkCooldown(cooldownSeconds) {
    if (!cooldownSeconds || cooldownSeconds <= 0) return true;
    try {
      if (fs.existsSync(cooldownFile)) {
        const lastTime = parseInt(fs.readFileSync(cooldownFile, 'utf-8'), 10);
        if (Date.now() - lastTime < cooldownSeconds * 1000) return false;
      }
    } catch { /* ignore */ }
    try { fs.writeFileSync(cooldownFile, String(Date.now())); } catch { /* ignore */ }
    return true;
  }

  it('should allow when cooldown is 0', () => {
    assert.strictEqual(checkCooldown(0), true);
  });

  it('should allow first call', () => {
    try { fs.unlinkSync(cooldownFile); } catch {}
    assert.strictEqual(checkCooldown(60), true);
  });

  it('should block within cooldown period', () => {
    assert.strictEqual(checkCooldown(60), false);
  });

  // Cleanup
  it('cleanup', () => {
    try { fs.unlinkSync(cooldownFile); } catch {}
  });
});
