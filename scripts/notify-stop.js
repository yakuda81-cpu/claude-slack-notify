#!/usr/bin/env node

/**
 * Claude Code Stop Hook - Slack Notification
 * Sends a Slack message when Claude Code finishes responding.
 * Zero external dependencies - uses Node.js built-in modules only.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// --- Debug Logging (P1-7) ---

const DEBUG = process.env.SLACK_NOTIFY_DEBUG === '1' || process.env.SLACK_NOTIFY_DEBUG === 'true';

function debug(msg) {
  if (DEBUG) process.stderr.write(`[slack-notify] ${msg}\n`);
}

// --- i18n Messages (P3-18) ---

const MESSAGES = {
  ko: { title: 'Claude Code 응답 완료', folder: '프로젝트', time: '시각', prompt: '프롬프트', duration: '소요' },
  en: { title: 'Claude Code Response Complete', folder: 'Project', time: 'Time', prompt: 'Prompt', duration: 'Duration' },
  ja: { title: 'Claude Code 応答完了', folder: 'プロジェクト', time: '時刻', prompt: 'プロンプト', duration: '所要' },
  zh: { title: 'Claude Code 响应完成', folder: '项目', time: '时间', prompt: '提示', duration: '耗时' },
};

// --- Configuration (P2-15) ---

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
      for (const line of envContent.split('\n')) {
        const match = line.match(/^\s*(SLACK_WEBHOOK_URL|SLACK_MENTION_USER_ID)\s*=\s*(?:["']([^"'\n]*)["']|([^#\n]*))/);
        if (match) parsed[match[1]] = (match[2] ?? match[3] ?? '').trim();
      }
      if (parsed.SLACK_WEBHOOK_URL) {
        debug(`Config from ${envPath}`);
        return { webhookUrl: parsed.SLACK_WEBHOOK_URL, mentionId: parsed.SLACK_MENTION_USER_ID };
      }
    } catch { continue; }
  }

  return null;
}

// --- Context ---

function getProjectName() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return path.basename(projectDir);
}

function getGitBranch() {
  try {
    const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd, encoding: 'utf-8', timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],  // P1-10: suppress stderr
    }).trim();
  } catch {
    return null;
  }
}

function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// --- Transcript Parsing (P2-14, P1-9) ---

function maskSecrets(text, patterns) {
  let masked = text;
  for (const pat of patterns) {
    try {
      masked = masked.replace(new RegExp(pat, 'gi'), '***');
    } catch { /* invalid pattern, skip */ }
  }
  return masked;
}

function getLastPrompt(input, config) {
  try {
    const parsed = JSON.parse(input);
    const transcript = parsed.transcript_path;
    if (!transcript || !fs.existsSync(transcript)) {
      debug('No transcript path or file not found');
      return null;
    }

    const stat = fs.statSync(transcript);
    const readSize = Math.min(stat.size, 524288);
    const start = Math.max(0, stat.size - readSize);
    let fd;
    try {
      fd = fs.openSync(transcript, 'r');
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, buf.length, start);
      var content = buf.toString('utf-8');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }

    // Drop first incomplete line (UTF-8 multibyte boundary)
    const lines = (start > 0 ? content.slice(content.indexOf('\n') + 1) : content)
      .split('\n').filter(Boolean);

    debug(`Transcript: ${stat.size} bytes, ${lines.length} lines in window`);

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);

        // Match actual user prompts only (skip tool_result entries)
        if (entry.type === 'user' && entry.message?.role === 'user') {
          let text;

          // P2-14: Handle content arrays (multi-part content)
          if (typeof entry.message.content === 'string') {
            text = entry.message.content;
          } else if (Array.isArray(entry.message.content)) {
            const textPart = entry.message.content.find(p => p.type === 'text');
            if (textPart) {
              text = textPart.text;
            } else {
              continue; // No text content, skip
            }
          } else {
            continue;
          }

          // P1-9: Mask secrets in prompt
          const maxLen = config.promptMaxLength || 80;
          let prompt = text.slice(0, maxLen);
          if (config.secretPatterns?.length) {
            prompt = maskSecrets(prompt, config.secretPatterns);
          }

          debug(`Found prompt: "${prompt.slice(0, 40)}..."`);
          return { prompt, timestamp: entry.timestamp || null };
        }
      } catch { continue; }
    }
    debug('No user prompt found in transcript window');
  } catch (e) { debug(`getLastPrompt error: ${e.message}`); }
  return null;
}

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

// --- Cooldown (P3-17) ---

function checkCooldown(cooldownSeconds) {
  if (!cooldownSeconds || cooldownSeconds <= 0) return true;
  const cooldownFile = path.join(os.tmpdir(), '.claude-slack-notify-last');
  try {
    if (fs.existsSync(cooldownFile)) {
      const lastTime = parseInt(fs.readFileSync(cooldownFile, 'utf-8'), 10);
      if (Date.now() - lastTime < cooldownSeconds * 1000) {
        debug(`Cooldown active (${cooldownSeconds}s), skipping`);
        return false;
      }
    }
  } catch { /* ignore */ }
  try {
    fs.writeFileSync(cooldownFile, String(Date.now()));
  } catch { /* ignore */ }
  return true;
}

// --- Slack API (P2-11: Provider pattern) ---

function validateWebhookUrl(webhookUrl) {
  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== 'https:') return false;
    if (!url.hostname.endsWith('.slack.com')) return false;
    if (!url.pathname.startsWith('/services/')) return false;
    return true;
  } catch { return false; }
}

// P2-12: Message formatting separated
// P3-16: Slack Block Kit
function formatSlackBlocks(mention, project, branch, time, duration, prompt, locale) {
  const msg = MESSAGES[locale] || MESSAGES.ko;
  const blocks = [];

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `✅ ${msg.title}`, emoji: true },
  });

  // Project info
  let infoText = `📁 *${project}*`;
  if (branch) infoText += ` \`${branch}\``;
  infoText += `\n🕐 ${time}`;
  if (duration) infoText += `  ⏱ ${duration}`;

  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: infoText },
  });

  // Prompt
  if (prompt) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `💬 ${prompt}` },
    });
  }

  // Mention text for push notification
  const text = mention ? `${mention}${msg.title}` : msg.title;

  return { text, blocks };
}

function sendSlack(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    if (!validateWebhookUrl(webhookUrl)) {
      return reject(new Error('Invalid Slack webhook URL'));
    }
    const url = new URL(webhookUrl);
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        // P1-6: HTTP status code validation
        if (res.statusCode !== 200) {
          debug(`Slack API error: ${res.statusCode} ${data}`);
          return reject(new Error(`Slack API returned ${res.statusCode}`));
        }
        resolve(data);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// --- Main ---

async function main() {
  // P1-8: stdin TTY check
  let input = '';
  try {
    if (!process.stdin.isTTY) {
      input = fs.readFileSync(0, 'utf-8');
    } else {
      debug('stdin is TTY, skipping read');
    }
  } catch {
    debug('stdin read failed');
  }

  // Prevent recursive hook calls
  try {
    const parsed = JSON.parse(input);
    if (parsed.stop_hook_active) return;
  } catch { /* not JSON, continue */ }

  const advConfig = loadAdvancedConfig();
  const config = loadConfig();
  if (!config) {
    debug('No config found, exiting');
    return;
  }

  // P3-17: Cooldown check
  if (!checkCooldown(advConfig.cooldownSeconds)) return;

  const project = getProjectName();
  const branch = getGitBranch();
  const time = getTimestamp();

  // P1-9: Prompt opt-in (enabled by default)
  let lastPrompt = null;
  if (advConfig.promptEnabled !== false) {
    lastPrompt = getLastPrompt(input, advConfig);
  } else {
    debug('Prompt display disabled by config');
  }

  let duration = null;
  if (lastPrompt?.timestamp) {
    const elapsed = Date.now() - new Date(lastPrompt.timestamp).getTime();
    if (elapsed > 0 && elapsed < 86400000) duration = formatDuration(elapsed);
  }

  const mention = config.mentionId ? `<@${config.mentionId}> ` : '';
  const locale = advConfig.locale || 'ko';

  // P3-16: Block Kit message
  const payload = formatSlackBlocks(mention, project, branch, time, duration, lastPrompt?.prompt, locale);

  try {
    await sendSlack(config.webhookUrl, payload);
    debug('Notification sent successfully');
  } catch (e) {
    debug(`Send failed: ${e.message}`);
  }
}

main();
