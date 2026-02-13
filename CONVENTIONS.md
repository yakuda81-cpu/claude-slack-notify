# claude-slack-notify Coding Conventions

> Starter Level - Essential rules only

---

## 1. Core Principles

- **Zero Dependencies**: Node.js built-in modules only (`fs`, `path`, `os`, `https`, `child_process`)
- **CommonJS**: `require()` / `module.exports` (no ESM)
- **No TypeScript**: Plain JavaScript with JSDoc when needed

## 2. Naming

| Target | Convention | Example |
|--------|-----------|---------|
| Functions | camelCase | `getProjectName`, `formatDuration`, `maskSecrets` |
| Constants | UPPER_SNAKE_CASE | `MAX_DURATION_MS`, `GIT_TIMEOUT_MS` |
| Boolean vars | is/has/can prefix | `DEBUG`, `isTTY` (exception: top-level flags) |
| Files | kebab-case | `notify-stop.js`, `notify-stop.test.js` |
| Directories | lowercase | `lib/`, `scripts/`, `tests/`, `hooks/` |
| Config keys | camelCase | `cooldownSeconds`, `promptMaxLength` |
| Env vars | SCREAMING_SNAKE_CASE | `SLACK_WEBHOOK_URL`, `SLACK_NOTIFY_DEBUG` |

## 3. Code Style

- Indentation: **2 spaces**
- Quotes: **single quotes** (`'`)
- Semicolons: **required**
- Trailing commas: **yes** (in exports, arrays, objects)
- Line length: soft limit **120 chars**
- Empty catches: must include `debug()` call or `/* reason */` comment

## 4. Project Structure

```
claude-slack-notify/
├── scripts/           # Entrypoints (CLI execution)
│   └── notify-stop.js # Main entrypoint + re-exports for tests
├── lib/               # Modules (business logic)
│   ├── config.js      # Shared: debug(), constants, config loaders
│   ├── context.js     # Project/git/time context
│   ├── transcript.js  # Transcript parsing, secret masking
│   ├── slack.js       # Slack API: messages, validation, formatting, sending
│   └── cooldown.js    # Rate limiting
├── tests/             # Test files
│   └── notify-stop.test.js
├── hooks/             # Claude Code hook definitions
│   └── hooks.json
├── docs/              # Documentation
│   ├── 01-plan/       # Glossary, schema, conventions
│   └── archive/       # Archived PDCA reports
└── .claude/           # Claude Code skills
    └── skills/
```

## 5. Module Rules

### Dependency Direction
```
lib/config.js     ← leaf node (no lib/ imports)
    ↑
lib/context.js    ← imports config only
lib/transcript.js ← imports config only
lib/slack.js      ← imports config only
lib/cooldown.js   ← imports config only
```

- `lib/config.js` is the **only shared module**
- No circular dependencies between lib/ modules
- lib/ modules may import Node.js built-ins freely

### Export Pattern
- Each lib/ module: `module.exports = { fn1, fn2, ... }`
- `scripts/notify-stop.js`: re-exports all lib/ symbols for test access
- `require.main === module` guard required on entrypoints

### Import Pattern
```javascript
// External (Node.js built-in) - top of file
const fs = require('fs');
const path = require('path');

// Internal (lib/) - after externals
const { debug, GIT_TIMEOUT_MS } = require('./config');
```

## 6. Environment Variables

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `SLACK_WEBHOOK_URL` | Yes | Slack Incoming Webhook URL |
| `SLACK_MENTION_USER_ID` | No | Slack user ID for @mention |
| `SLACK_NOTIFY_DEBUG` | No | Enable debug logging (`1` or `true`) |
| `CLAUDE_PROJECT_DIR` | No | Set by Claude Code automatically |

**Source priority**: env vars > `.env` (project) > `.env` (plugin) > `.env` (cwd)

**Security**: `.env` in `.gitignore`, only `.env.example` in git

## 7. Testing

- Runner: `node --test` (Node.js built-in test runner)
- Assertion: `node:assert` (strict mode)
- Structure: `describe()` / `it()` / `beforeEach()` / `after()`
- Tests import from `scripts/notify-stop.js` (never copy-paste production code)
- Run: `node --test tests/notify-stop.test.js`

### Test Naming
```javascript
describe('functionName', () => {
  it('should <expected behavior> when <condition>', () => { ... });
});

// Edge cases in separate describe block
describe('functionName edge cases', () => { ... });
```

## 8. Security

- **SSRF defense**: `validateWebhookUrl()` - protocol + domain + path triple check
- **ReDoS defense**: `MAX_SECRET_PATTERN_LENGTH` (200 char limit on regex)
- **Input validation**: `mentionId` must match `/^[A-Z0-9]{1,20}$/`
- **Secret masking**: configurable patterns, applied before display
- **No eval/Function**: never use dynamic code execution
