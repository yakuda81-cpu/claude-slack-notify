const fs = require('fs');
const { debug, MAX_TRANSCRIPT_READ_BYTES, MAX_SECRET_PATTERN_LENGTH } = require('./config');

function maskSecrets(text, patterns) {
  let masked = text;
  for (const pat of patterns) {
    if (pat.length > MAX_SECRET_PATTERN_LENGTH) { debug(`Skipping oversized pattern (${pat.length} chars)`); continue; }
    try {
      masked = masked.replace(new RegExp(pat, 'gi'), '***');
    } catch { debug(`Invalid secret pattern: ${pat}`); }
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
    const readSize = Math.min(stat.size, MAX_TRANSCRIPT_READ_BYTES);
    const start = Math.max(0, stat.size - readSize);
    let content;
    let fd;
    try {
      fd = fs.openSync(transcript, 'r');
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, buf.length, start);
      content = buf.toString('utf-8');
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

          // Handle content arrays (multi-part content)
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

          // Mask secrets in prompt
          const maxLen = config.promptMaxLength || 80;
          let prompt = text.slice(0, maxLen);
          if (config.secretPatterns?.length) {
            prompt = maskSecrets(prompt, config.secretPatterns);
          }

          debug(`Found prompt: "${prompt.slice(0, 40)}..."`);
          return { prompt, timestamp: entry.timestamp || null };
        }
      } catch { debug('Skipping invalid transcript line'); continue; }
    }
    debug('No user prompt found in transcript window');
  } catch (e) { debug(`getLastPrompt error: ${e.message}`); }
  return null;
}

module.exports = {
  maskSecrets,
  getLastPrompt,
};
