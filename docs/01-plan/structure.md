# claude-slack-notify Structure Rules

> Module separation criteria and dependency rules

---

## 1. Module Separation Criteria

| Criteria | Rule |
|----------|------|
| Single Responsibility | Each module handles one concern |
| Size | Target: 25-100 lines per module |
| Shared state | Only `lib/config.js` provides shared constants/utilities |
| New module trigger | When a function group serves a distinct domain |

## 2. Current Modules

| Module | Responsibility | Lines | Dependencies |
|--------|---------------|:-----:|-------------|
| `lib/config.js` | Debug, constants, config loading | 91 | (none) |
| `lib/context.js` | Project name, git branch, timestamp, duration | 45 | config |
| `lib/transcript.js` | Secret masking, prompt extraction | 86 | config |
| `lib/slack.js` | i18n messages, URL validation, formatting, sending | 99 | config |
| `lib/cooldown.js` | Rate limiting via file mtime | 25 | config |
| `scripts/notify-stop.js` | Entrypoint, orchestration, re-exports | 109 | all lib/ |

## 3. When to Create a New Module

- A new function group that doesn't fit existing modules
- A module exceeds ~150 lines
- Two or more modules need the same utility (move to `config.js`)

## 4. When NOT to Create a New Module

- Single function that fits in an existing module
- Helper used only within one module (keep it local)
- Test utilities (keep in test file)
