const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { debug, GIT_TIMEOUT_MS } = require('./config');

function getProjectName() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return path.basename(projectDir);
}

function getGitBranch() {
  try {
    const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    if (!fs.existsSync(cwd)) return null;
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd, encoding: 'utf-8', timeout: GIT_TIMEOUT_MS,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

module.exports = {
  getProjectName,
  getGitBranch,
  getTimestamp,
  formatDuration,
};
