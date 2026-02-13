const fs = require('fs');
const path = require('path');
const os = require('os');
const { debug } = require('./config');

function checkCooldown(cooldownSeconds) {
  if (!cooldownSeconds || cooldownSeconds <= 0) return true;
  const cooldownFile = path.join(os.tmpdir(), '.claude-slack-notify-last');
  const now = Date.now();
  try {
    const stat = fs.statSync(cooldownFile);
    if (now - stat.mtimeMs < cooldownSeconds * 1000) {
      debug(`Cooldown active (${cooldownSeconds}s), skipping`);
      return false;
    }
  } catch { debug('Cooldown file read error'); }
  try {
    fs.writeFileSync(cooldownFile, String(now));
  } catch { debug('Cooldown file write error'); }
  return true;
}

module.exports = {
  checkCooldown,
};
