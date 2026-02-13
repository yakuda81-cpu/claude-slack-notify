const fs = require('fs');
const path = require('path');

// --- Debug Logging ---

const DEBUG = process.env.SLACK_NOTIFY_DEBUG === '1' || process.env.SLACK_NOTIFY_DEBUG === 'true';

function debug(msg) {
  if (DEBUG) process.stderr.write(`[slack-notify] ${msg}\n`);
}

// --- Constants ---

const MAX_TRANSCRIPT_READ_BYTES = 524288;  // 512KB
const MAX_DURATION_MS = 86400000;  // 24 hours
const GIT_TIMEOUT_MS = 3000;
const SLACK_API_TIMEOUT_MS = 8000;
const MAX_SECRET_PATTERN_LENGTH = 200;

// --- Configuration ---

function loadAdvancedConfig() {
  const defaults = {
    locale: 'ko',
    promptEnabled: true,
    promptMaxLength: 80,
    cooldownSeconds: 0,
    secretPatterns: ['sk-[a-zA-Z0-9]{20,}', 'token[=:\\s]["\']?[a-zA-Z0-9_\\-]{20,}', 'password[=:\\s]["\']?\\S{6,}'],
  };

  // Try .claude-notify.json in project dir, then plugin dir
  for (const dir of [process.env.CLAUDE_PROJECT_DIR, path.dirname(__dirname)]) {
    if (!dir) continue;
    const configPath = path.join(dir, '.claude-notify.json');
    if (fs.existsSync(configPath)) {
      try {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        debug(`Config loaded from ${configPath}`);
        return { ...defaults, ...userConfig };
      } catch { debug(`Failed to parse ${configPath}`); }
    }
  }
  return defaults;
}

function loadConfig() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const mentionId = process.env.SLACK_MENTION_USER_ID;
  if (webhookUrl) {
    debug('Config from environment variables');
    return { webhookUrl, mentionId };
  }

  // Try loading from .env files
  const searchDirs = [
    process.env.CLAUDE_PROJECT_DIR,
    path.dirname(__dirname),  // plugin root
    process.cwd(),
  ].filter(Boolean);

  for (const dir of searchDirs) {
    const envPath = path.join(dir, '.env');
    if (!fs.existsSync(envPath)) continue;
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const parsed = {};
      for (const line of envContent.replace(/\r/g, '').split('\n')) {
        const match = line.match(/^\s*(SLACK_WEBHOOK_URL|SLACK_MENTION_USER_ID)\s*=\s*(?:["']([^"'\n]*)["']|([^#\n]*))/);
        if (match) parsed[match[1]] = (match[2] ?? match[3] ?? '').trim();
      }
      if (parsed.SLACK_WEBHOOK_URL) {
        debug(`Config from ${envPath}`);
        return { webhookUrl: parsed.SLACK_WEBHOOK_URL, mentionId: parsed.SLACK_MENTION_USER_ID };
      }
    } catch { debug(`Failed to read ${envPath}`); continue; }
  }

  return null;
}

module.exports = {
  DEBUG,
  debug,
  MAX_TRANSCRIPT_READ_BYTES,
  MAX_DURATION_MS,
  GIT_TIMEOUT_MS,
  SLACK_API_TIMEOUT_MS,
  MAX_SECRET_PATTERN_LENGTH,
  loadAdvancedConfig,
  loadConfig,
};
