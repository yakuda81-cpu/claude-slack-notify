# claude-slack-notify Glossary

> Project terminology and data structure definitions

---

## 1. Business Terms

| Term | English | Definition | Code Reference |
|------|---------|------------|----------------|
| Stop Hook | Stop Hook | Claude Code 응답 완료 시 실행되는 hook | `hooks/hooks.json` |
| Webhook URL | Webhook URL | Slack Incoming Webhook 엔드포인트 URL | `SLACK_WEBHOOK_URL` |
| Mention ID | Mention ID | Slack 사용자 ID (푸시 알림 대상) | `SLACK_MENTION_USER_ID` |
| Cooldown | Cooldown | 연속 알림 방지를 위한 최소 대기 시간(초) | `cooldownSeconds` |
| Transcript | Transcript | Claude Code 대화 로그 JSONL 파일 | `transcript_path` |
| Last Prompt | Last Prompt | 가장 최근 사용자 프롬프트 (알림에 표시) | `getLastPrompt()` |
| Secret Pattern | Secret Pattern | 마스킹 대상 민감 정보 정규식 패턴 | `secretPatterns` |
| Advanced Config | Advanced Config | `.claude-notify.json` 설정 파일 | `loadAdvancedConfig()` |
| Block Kit | Block Kit | Slack 리치 메시지 포맷 (header, section) | `formatSlackBlocks()` |

## 2. Global Standards

| Term | Definition | Reference |
|------|------------|-----------|
| Slack Incoming Webhook | Slack 앱에서 제공하는 HTTP POST 메시지 전송 API | [Slack API Docs](https://api.slack.com/messaging/webhooks) |
| Block Kit | Slack의 구조화된 메시지 레이아웃 프레임워크 | [Block Kit Builder](https://app.slack.com/block-kit-builder) |
| mrkdwn | Slack 전용 마크다운 문법 (`&`, `<`, `>` 이스케이프 필요) | Slack API |
| JSONL | JSON Lines - 줄 단위 JSON 형식 | [jsonlines.org](https://jsonlines.org) |
| ReDoS | Regular Expression Denial of Service | OWASP |
| SSRF | Server-Side Request Forgery | OWASP |
| TTY | Terminal device (stdin이 터미널인지 판별) | POSIX |

## 3. Mapping Table (Business <-> Code)

| Business Term | Code Variable/Function | Module |
|---------------|----------------------|--------|
| Webhook URL | `config.webhookUrl` | `lib/config.js` |
| Mention ID | `config.mentionId` | `lib/config.js` |
| Cooldown (seconds) | `advConfig.cooldownSeconds` | `lib/cooldown.js` |
| Secret Patterns | `advConfig.secretPatterns` | `lib/transcript.js` |
| Prompt Max Length | `advConfig.promptMaxLength` | `lib/transcript.js` |
| Locale | `advConfig.locale` | `lib/slack.js` |
| Prompt Enabled | `advConfig.promptEnabled` | `scripts/notify-stop.js` |
| Project Name | `getProjectName()` | `lib/context.js` |
| Git Branch | `getGitBranch()` | `lib/context.js` |
| Timestamp | `getTimestamp()` | `lib/context.js` |
| Duration | `formatDuration(ms)` | `lib/context.js` |
| Masked Prompt | `maskSecrets(text, patterns)` | `lib/transcript.js` |
| Slack Payload | `formatSlackBlocks(...)` | `lib/slack.js` |

## 4. Term Usage Rules

1. Code: English (`webhookUrl`, `cooldownSeconds`, `maskSecrets`)
2. UI (Slack messages): locale-dependent (`MESSAGES[locale]`)
3. Config files: camelCase JSON keys (`promptMaxLength`, `secretPatterns`)
4. Environment variables: SCREAMING_SNAKE_CASE (`SLACK_WEBHOOK_URL`)
