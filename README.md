# claude-slack-notify

Claude Code 응답 완료 시 Slack 알림을 받을 수 있는 플러그인입니다.
Get Slack notifications when Claude Code finishes responding.

## Install

```bash
git clone https://github.com/yakuda81-cpu/claude-slack-notify.git
```

`~/.claude/settings.json`에 hooks 추가:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"/path/to/claude-slack-notify/scripts/notify-stop.js\"",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

## Setup

### 1. Slack App & Webhook URL

1. https://api.slack.com/apps → "Create New App" → "From scratch"
2. Enter app name (e.g., `Claude Notify`), select workspace
3. Left menu → "Incoming Webhooks" → Enable
4. "Add New Webhook to Workspace" → Select channel
5. Copy **Webhook URL** (e.g., `https://hooks.slack.com/services/T.../B.../xxx`)

### 2. Mention User ID (for mobile push)

1. Click your profile in Slack
2. More(⋯) → "Copy member ID"
3. Alphanumeric starting with `U` (e.g., `U0ABC1234DE`)

### 3. Environment Variables

Add to `.env` file in project root:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx
SLACK_MENTION_USER_ID=U0ABC1234DE
```

Or set as system environment variables.

> Notifications are automatically disabled if not configured.

### 4. Advanced Config (optional)

Create `.claude-notify.json` in project root or plugin directory:

```json
{
  "locale": "ko",
  "promptEnabled": true,
  "promptMaxLength": 80,
  "cooldownSeconds": 0,
  "secretPatterns": ["sk-[a-zA-Z0-9]{20,}"]
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `locale` | `"ko"` | Message language: `ko`, `en`, `ja`, `zh` |
| `promptEnabled` | `true` | Show last user prompt in notification |
| `promptMaxLength` | `80` | Max characters for prompt display |
| `cooldownSeconds` | `0` | Min seconds between notifications (0 = disabled) |
| `secretPatterns` | `[...]` | Regex patterns to mask in prompts (API keys, tokens) |

### 5. Debug Mode

```bash
SLACK_NOTIFY_DEBUG=1
```

Outputs debug logs to stderr for troubleshooting.

## How It Works

```
User prompt input
    ↓
Claude Code processes
    ↓
Response complete (Stop event)
    ↓
Extract last user prompt from transcript
    ↓
📱 Slack notification with Block Kit
```

Notification example:

```
✅ Claude Code 응답 완료
──────────────────────
📁 my-project  main
🕐 14:32:05  ⏱ 2분 34초
💬 슬랙 알람이 잘 오는지 테스트
```

## Features

- **Zero Dependencies** — Node.js built-in modules only (`https`, `fs`, `path`, `os`)
- **Slack Block Kit** — Rich formatted messages with headers and sections
- **Response Duration** — Shows how long Claude Code took to respond
- **Prompt Display** — Last user prompt (configurable length, with secret masking)
- **Secret Masking** — Auto-masks API keys, tokens, passwords in prompts
- **Project & Branch** — Shows project name and current git branch
- **@mention** — Mobile push notification via Slack mention
- **i18n** — Korean, English, Japanese, Chinese message support
- **Cooldown** — Configurable minimum interval between notifications
- **Debug Mode** — stderr logging for troubleshooting
- **SSRF Protection** — Webhook URL domain validation (`*.slack.com` only)
- **TTY Safety** — Skips stdin read when not piped (prevents blocking)
- **HTTP Status Check** — Detects and logs Slack API errors
- **UTF-8 Safe** — Handles multibyte character boundaries in large transcripts
- **Cross-Platform** — Windows, macOS, Linux

## Tests

```bash
node --test tests/
```

## License

MIT
