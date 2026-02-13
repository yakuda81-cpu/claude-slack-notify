# claude-slack-notify Schema

> Data structures, entities, and relationships

---

## 1. Entities

### 1.1 Config (Basic Configuration)

`loadConfig()` return value. Required for operation.

```
Config {
  webhookUrl: string   // Slack Incoming Webhook URL (HTTPS only)
  mentionId?: string   // Slack User ID (e.g., "U0123ABCDEF")
}
```

**Source priority**: `env vars` > `.env (project dir)` > `.env (plugin dir)` > `.env (cwd)`

### 1.2 AdvancedConfig (Advanced Configuration)

`loadAdvancedConfig()` return value. Optional, has defaults.

```
AdvancedConfig {
  locale: string              // default: "ko" | "en" | "ja" | "zh"
  promptEnabled: boolean      // default: true
  promptMaxLength: number     // default: 80
  cooldownSeconds: number     // default: 0 (disabled)
  secretPatterns: string[]    // default: [sk-*, token=*, password=*]
}
```

**Source**: `.claude-notify.json` (project dir or plugin dir)

### 1.3 LastPrompt (Extracted Prompt)

`getLastPrompt()` return value.

```
LastPrompt {
  prompt: string        // masked, truncated to promptMaxLength
  timestamp: string?    // ISO 8601 timestamp from transcript entry
}
```

### 1.4 SlackPayload (Block Kit Message)

`formatSlackBlocks()` return value. Sent to Slack API.

```
SlackPayload {
  text: string          // fallback text (includes mention for push notification)
  blocks: Block[]       // Block Kit blocks array
}

Block = HeaderBlock | SectionBlock

HeaderBlock {
  type: "header"
  text: { type: "plain_text", text: string, emoji: true }
}

SectionBlock {
  type: "section"
  text: { type: "mrkdwn", text: string }
}
```

### 1.5 TranscriptEntry (JSONL Line)

Claude Code transcript format (external, read-only).

```
TranscriptEntry {
  type: "user" | "assistant" | "system"
  timestamp?: string    // ISO 8601
  message: {
    role: "user" | "assistant"
    content: string | ContentPart[]
  }
}

ContentPart {
  type: "text" | "tool_use" | "tool_result"
  text?: string
}
```

## 2. Constants

| Name | Value | Purpose |
|------|-------|---------|
| `MAX_TRANSCRIPT_READ_BYTES` | 524,288 (512KB) | Transcript tail-read limit |
| `MAX_DURATION_MS` | 86,400,000 (24h) | Maximum valid duration |
| `GIT_TIMEOUT_MS` | 3,000 (3s) | Git command timeout |
| `SLACK_API_TIMEOUT_MS` | 8,000 (8s) | Slack HTTP request timeout |
| `MAX_SECRET_PATTERN_LENGTH` | 200 | ReDoS defense - regex length limit |

## 3. Entity Relationships

```
┌──────────────┐     ┌──────────────────┐
│   Config     │     │  AdvancedConfig   │
│  webhookUrl  │     │  locale           │
│  mentionId   │     │  promptEnabled    │
└──────┬───────┘     │  promptMaxLength  │
       │             │  cooldownSeconds  │
       │             │  secretPatterns   │
       │             └────────┬─────────┘
       │                      │
       │    ┌─────────────────┤
       │    │                 │
       │    ▼                 ▼
       │  Cooldown        Transcript
       │  (rate limit)    (JSONL file)
       │                      │
       │                      ▼
       │               ┌──────────────┐
       │               │  LastPrompt   │
       │               │  prompt       │
       │               │  timestamp    │
       │               └──────┬───────┘
       │                      │
       ▼                      ▼
  ┌──────────────────────────────────┐
  │         SlackPayload             │
  │  text (mention + title)          │
  │  blocks[] (header + info + prompt)│
  └──────────────┬───────────────────┘
                 │
                 ▼
          Slack Webhook API
```

## 4. Data Flow

```
stdin (JSON) ──► parse ──► recursive guard
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        loadConfig()   loadAdvancedConfig()  checkCooldown()
              │               │               │
              │               ├── locale      │
              │               ├── secretPatterns
              │               └── promptMaxLength
              │                       │
              │                       ▼
              │               getLastPrompt() ──► maskSecrets()
              │                       │
              ▼                       ▼
        sendSlack() ◄── formatSlackBlocks(mention, project,
                            branch, time, duration, prompt, locale)
```

## 5. Module Dependency

```
lib/config.js          (no lib/ dependencies - leaf node)
    ▲    ▲    ▲    ▲
    │    │    │    │
    │    │    │    └── lib/cooldown.js
    │    │    └─────── lib/transcript.js
    │    └──────────── lib/context.js
    └───────────────── lib/slack.js

scripts/notify-stop.js ──► all 5 lib/ modules (entrypoint)
tests/notify-stop.test.js ──► scripts/notify-stop.js (re-exports)
```

Rule: `lib/config.js` is the only shared dependency. No circular dependencies allowed.
