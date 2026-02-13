const https = require('https');
const { debug, SLACK_API_TIMEOUT_MS } = require('./config');

// --- i18n Messages ---

const MESSAGES = {
  ko: { title: 'Claude Code 응답 완료', folder: '프로젝트', time: '시각', prompt: '프롬프트', duration: '소요' },
  en: { title: 'Claude Code Response Complete', folder: 'Project', time: 'Time', prompt: 'Prompt', duration: 'Duration' },
  ja: { title: 'Claude Code 応答完了', folder: 'プロジェクト', time: '時刻', prompt: 'プロンプト', duration: '所要' },
  zh: { title: 'Claude Code 响应完成', folder: '项目', time: '时间', prompt: '提示', duration: '耗时' },
};

function validateWebhookUrl(webhookUrl) {
  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== 'https:') return false;
    if (!url.hostname.endsWith('.slack.com')) return false;
    if (!url.pathname.startsWith('/services/')) return false;
    return true;
  } catch { return false; }
}

function escapeMrkdwn(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatSlackBlocks(mention, project, branch, time, duration, prompt, locale) {
  const msg = MESSAGES[locale] || MESSAGES.ko;
  const blocks = [];

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `✅ ${msg.title}`, emoji: true },
  });

  // Project info
  let infoText = `📁 *${escapeMrkdwn(project)}*`;
  if (branch) infoText += ` \`${escapeMrkdwn(branch)}\``;
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
      text: { type: 'mrkdwn', text: `💬 ${escapeMrkdwn(prompt)}` },
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
      timeout: SLACK_API_TIMEOUT_MS,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          debug(`Slack API error: ${res.statusCode}`);
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

module.exports = {
  MESSAGES,
  validateWebhookUrl,
  escapeMrkdwn,
  formatSlackBlocks,
  sendSlack,
};
