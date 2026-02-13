#!/usr/bin/env node

/**
 * Claude Code Stop Hook - Slack Notification
 * Sends a Slack message when Claude Code finishes responding.
 * Zero external dependencies - uses Node.js built-in modules only.
 */

const fs = require('fs');
const { debug, loadAdvancedConfig, loadConfig, MAX_DURATION_MS, MAX_TRANSCRIPT_READ_BYTES, GIT_TIMEOUT_MS, SLACK_API_TIMEOUT_MS, MAX_SECRET_PATTERN_LENGTH } = require('../lib/config');
const { getProjectName, getGitBranch, getTimestamp, formatDuration } = require('../lib/context');
const { maskSecrets, getLastPrompt } = require('../lib/transcript');
const { MESSAGES, validateWebhookUrl, escapeMrkdwn, formatSlackBlocks, sendSlack } = require('../lib/slack');
const { checkCooldown } = require('../lib/cooldown');

// --- Main ---

async function main() {
  try {
    // stdin TTY check
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

    // Cooldown check
    if (!checkCooldown(advConfig.cooldownSeconds)) return;

    const project = getProjectName();
    const branch = getGitBranch();
    const time = getTimestamp();

    // Prompt opt-in (enabled by default)
    let lastPrompt = null;
    if (advConfig.promptEnabled !== false) {
      lastPrompt = getLastPrompt(input, advConfig);
    } else {
      debug('Prompt display disabled by config');
    }

    let duration = null;
    if (lastPrompt?.timestamp) {
      const elapsed = Date.now() - new Date(lastPrompt.timestamp).getTime();
      if (elapsed > 0 && elapsed < MAX_DURATION_MS) duration = formatDuration(elapsed);
    }

    const mention = config.mentionId && /^[A-Z0-9]{1,20}$/.test(config.mentionId)
      ? `<@${config.mentionId}> ` : '';
    const locale = advConfig.locale || 'ko';

    // Block Kit message
    const payload = formatSlackBlocks(mention, project, branch, time, duration, lastPrompt?.prompt, locale);

    try {
      await sendSlack(config.webhookUrl, payload);
      debug('Notification sent successfully');
    } catch (e) {
      debug(`Send failed: ${e.message}`);
    }
  } catch (e) {
    debug(`Unexpected error: ${e.message}`);
  }
}

// --- Exports for testing ---
module.exports = {
  escapeMrkdwn,
  formatDuration,
  formatSlackBlocks,
  maskSecrets,
  checkCooldown,
  validateWebhookUrl,
  loadConfig,
  loadAdvancedConfig,
  sendSlack,
  getProjectName,
  getGitBranch,
  getTimestamp,
  getLastPrompt,
  MESSAGES,
  MAX_TRANSCRIPT_READ_BYTES,
  GIT_TIMEOUT_MS,
  SLACK_API_TIMEOUT_MS,
  MAX_DURATION_MS,
  MAX_SECRET_PATTERN_LENGTH,
};

if (require.main === module) {
  main();
}
