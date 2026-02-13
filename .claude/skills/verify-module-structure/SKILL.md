---
name: verify-module-structure
description: lib/ 모듈 분리 구조 및 re-export 정합성 검증. 모듈 추가/수정/삭제 후 사용.
---

## Purpose

1. lib/ 디렉토리에 필수 5개 모듈이 존재하는지 확인
2. 각 모듈의 module.exports가 올바른 함수/상수를 내보내는지 검증
3. scripts/notify-stop.js의 re-export가 모든 하위 모듈 export를 포함하는지 확인
4. tests/notify-stop.test.js가 프로덕션 코드를 import하는지 (복제 코드 없는지) 검증
5. 모듈 간 순환 의존성이 없는지 확인

## When to Run

- lib/ 디렉토리의 모듈을 추가, 수정, 삭제한 후
- scripts/notify-stop.js의 module.exports를 변경한 후
- 새 함수/상수를 추가하고 export에 포함해야 할 때
- tests/notify-stop.test.js의 import를 변경한 후

## Related Files

| File | Purpose |
|------|---------|
| `scripts/notify-stop.js` | 엔트리포인트, lib/ 모듈 re-export |
| `lib/config.js` | DEBUG, debug, 상수, loadAdvancedConfig, loadConfig |
| `lib/context.js` | getProjectName, getGitBranch, getTimestamp, formatDuration |
| `lib/transcript.js` | maskSecrets, getLastPrompt |
| `lib/slack.js` | MESSAGES, validateWebhookUrl, escapeMrkdwn, formatSlackBlocks, sendSlack |
| `lib/cooldown.js` | checkCooldown |
| `tests/notify-stop.test.js` | 유닛 테스트 (import 기반) |

## Workflow

### Step 1: 필수 모듈 존재 확인

**도구:** Glob

```bash
# 5개 모듈 파일 확인
ls lib/config.js lib/context.js lib/transcript.js lib/slack.js lib/cooldown.js
```

**PASS:** 5개 파일 모두 존재
**FAIL:** 누락된 파일이 있음 -> 해당 모듈 생성 필요

### Step 2: 각 모듈의 module.exports 검증

**도구:** Grep

각 lib/ 모듈에 `module.exports`가 있는지 확인:

```bash
grep -l "module.exports" lib/config.js lib/context.js lib/transcript.js lib/slack.js lib/cooldown.js
```

**PASS:** 5개 파일 모두 module.exports 포함
**FAIL:** module.exports 누락 -> 해당 모듈에 exports 추가

### Step 3: 엔트리포인트 re-export 정합성

**도구:** Grep, Read

scripts/notify-stop.js의 module.exports에 다음 심볼이 모두 포함되는지 확인:

**함수:** `escapeMrkdwn`, `formatDuration`, `formatSlackBlocks`, `maskSecrets`, `checkCooldown`, `validateWebhookUrl`, `loadConfig`, `loadAdvancedConfig`, `sendSlack`, `getProjectName`, `getGitBranch`, `getTimestamp`, `getLastPrompt`

**상수/객체:** `MESSAGES`, `MAX_TRANSCRIPT_READ_BYTES`, `GIT_TIMEOUT_MS`, `SLACK_API_TIMEOUT_MS`, `MAX_DURATION_MS`, `MAX_SECRET_PATTERN_LENGTH`

```bash
grep -c "escapeMrkdwn\|formatDuration\|formatSlackBlocks\|maskSecrets\|checkCooldown\|validateWebhookUrl\|MESSAGES\|MAX_TRANSCRIPT_READ_BYTES" scripts/notify-stop.js
```

**PASS:** 모든 심볼이 module.exports 블록에 존재
**FAIL:** 누락된 심볼 -> scripts/notify-stop.js의 module.exports에 추가

### Step 4: require.main 가드 확인

**도구:** Grep

```bash
grep "require.main === module" scripts/notify-stop.js
```

**PASS:** `if (require.main === module)` 패턴 존재
**FAIL:** 누락 시 require 시 main()이 자동 실행되어 테스트 시 부작용 발생

### Step 5: 테스트 파일 import 검증

**도구:** Grep

tests/notify-stop.test.js에서 프로덕션 코드를 import하는지 확인:

```bash
grep "require.*notify-stop" tests/notify-stop.test.js
```

**PASS:** `require('../scripts/notify-stop')` 존재
**FAIL:** 직접 import 없음 -> 함수 복제 대신 import로 전환 필요

또한 함수 복제가 없는지 확인:

```bash
grep "function formatDuration\|function maskSecrets\|function validateWebhookUrl\|function checkCooldown" tests/notify-stop.test.js
```

**PASS:** 매칭 결과 없음 (복제 함수 없음)
**FAIL:** 복제 함수 발견 -> 삭제하고 import 사용

### Step 6: 순환 의존성 확인

**도구:** Grep

lib/ 모듈 간 require 경로 확인:

```bash
grep -n "require.*\./" lib/config.js lib/context.js lib/transcript.js lib/slack.js lib/cooldown.js
```

**PASS:** config.js는 다른 lib/ 모듈을 require하지 않고, 나머지 모듈은 config.js만 require
**FAIL:** 순환 의존 패턴 발견 -> config.js를 유일한 공유 모듈로 유지

### Step 7: 테스트 실행

**도구:** Bash

```bash
cd D:/claude/claude-slack-notify && node --test tests/notify-stop.test.js
```

**PASS:** 모든 테스트 통과 (0 fail)
**FAIL:** 실패 테스트 존재 -> 오류 수정

## Output Format

| # | 검사 | 결과 | 비고 |
|---|------|:----:|------|
| 1 | 필수 모듈 존재 | PASS/FAIL | 누락 파일 목록 |
| 2 | module.exports | PASS/FAIL | 누락 파일 목록 |
| 3 | re-export 정합성 | PASS/FAIL | 누락 심볼 목록 |
| 4 | require.main 가드 | PASS/FAIL | |
| 5 | 테스트 import | PASS/FAIL | 복제 함수 발견 시 목록 |
| 6 | 순환 의존성 | PASS/FAIL | 순환 경로 |
| 7 | 테스트 실행 | PASS/FAIL | 실패 테스트 수 |

## Exceptions

1. **lib/config.js에서 fs, path, os require** — 이는 Node.js 내장 모듈이므로 순환 의존이 아님
2. **scripts/notify-stop.js에서 fs require** — stdin 읽기를 위한 직접 의존, lib/ 모듈과 무관
3. **테스트에서 .env regex 직접 정의** — `.env` 파싱 regex는 loadConfig 내부 구현이므로 regex 자체를 테스트하는 것은 허용
