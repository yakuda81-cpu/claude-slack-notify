const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  formatDuration,
  maskSecrets,
  validateWebhookUrl,
  checkCooldown,
  escapeMrkdwn,
  formatSlackBlocks,
  MESSAGES,
} = require('../scripts/notify-stop');

// --- Unit Tests ---

describe('formatDuration', () => {
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

describe('formatDuration edge cases', () => {
  it('should handle negative input', () => {
    const result = formatDuration(-1000);
    assert.ok(typeof result === 'string');
  });

  it('should handle very large input', () => {
    const result = formatDuration(360000000); // 100 hours
    assert.ok(result.includes('시간'));
  });
});

describe('maskSecrets', () => {
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

describe('maskSecrets edge cases', () => {
  it('should handle empty text', () => {
    assert.strictEqual(maskSecrets('', ['sk-[a-zA-Z0-9]{20,}']), '');
  });

  it('should handle empty patterns array', () => {
    assert.strictEqual(maskSecrets('sk-abcdefghijklmnopqrstuv', []), 'sk-abcdefghijklmnopqrstuv');
  });
});

describe('validateWebhookUrl', () => {
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

describe('validateWebhookUrl edge cases', () => {
  it('should handle null input', () => {
    assert.strictEqual(validateWebhookUrl(null), false);
  });

  it('should handle undefined input', () => {
    assert.strictEqual(validateWebhookUrl(undefined), false);
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

describe('escapeMrkdwn', () => {
  it('should escape ampersand', () => {
    assert.strictEqual(escapeMrkdwn('a & b'), 'a &amp; b');
  });

  it('should escape angle brackets', () => {
    assert.strictEqual(escapeMrkdwn('<script>'), '&lt;script&gt;');
  });

  it('should handle empty string', () => {
    assert.strictEqual(escapeMrkdwn(''), '');
  });

  it('should handle string without special chars', () => {
    assert.strictEqual(escapeMrkdwn('hello world'), 'hello world');
  });

  it('should escape all special chars in combination', () => {
    assert.strictEqual(escapeMrkdwn('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
  });
});

describe('formatSlackBlocks', () => {
  it('should create header with title', () => {
    const result = formatSlackBlocks('', 'my-project', 'main', '14:00:00', '1분 30초', 'test prompt', 'ko');
    assert.strictEqual(result.blocks[0].type, 'header');
    assert.ok(result.blocks[0].text.text.includes('Claude Code 응답 완료'));
  });

  it('should include project info section', () => {
    const result = formatSlackBlocks('', 'my-project', 'main', '14:00:00', null, null, 'ko');
    assert.ok(result.blocks[1].text.text.includes('my-project'));
  });

  it('should include branch when provided', () => {
    const result = formatSlackBlocks('', 'proj', 'feature/test', '14:00', null, null, 'en');
    assert.ok(result.blocks[1].text.text.includes('feature/test'));
  });

  it('should include prompt section when prompt provided', () => {
    const result = formatSlackBlocks('', 'proj', null, '14:00', null, 'hello', 'ko');
    assert.strictEqual(result.blocks.length, 3);
    assert.ok(result.blocks[2].text.text.includes('hello'));
  });

  it('should omit prompt section when no prompt', () => {
    const result = formatSlackBlocks('', 'proj', null, '14:00', null, null, 'ko');
    assert.strictEqual(result.blocks.length, 2);
  });

  it('should include mention in text field', () => {
    const result = formatSlackBlocks('<@U123> ', 'proj', null, '14:00', null, null, 'ko');
    assert.ok(result.text.includes('<@U123>'));
  });

  it('should fallback to ko for unknown locale', () => {
    const result = formatSlackBlocks('', 'proj', null, '14:00', null, null, 'xx');
    assert.ok(result.blocks[0].text.text.includes('Claude Code 응답 완료'));
  });

  it('should escape special mrkdwn chars in project name', () => {
    const result = formatSlackBlocks('', 'proj<test>', 'main', '14:00', null, null, 'ko');
    assert.ok(result.blocks[1].text.text.includes('&lt;test&gt;'));
  });
});

describe('cooldown check (imported)', () => {
  const cooldownFile = path.join(os.tmpdir(), '.claude-slack-notify-last');

  beforeEach(() => { try { fs.unlinkSync(cooldownFile); } catch {} });
  after(() => { try { fs.unlinkSync(cooldownFile); } catch {} });

  it('should allow when cooldown is 0', () => {
    assert.strictEqual(checkCooldown(0), true);
  });

  it('should allow first call', () => {
    assert.strictEqual(checkCooldown(60), true);
  });

  it('should block within cooldown period', () => {
    checkCooldown(60); // first call writes the cooldown file
    assert.strictEqual(checkCooldown(60), false);
  });
});
