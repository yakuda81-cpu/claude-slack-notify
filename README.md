# claude-slack-notify

Claude Code 응답 완료 시 Slack 알림을 받을 수 있는 플러그인입니다.

## 설치

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

> `/path/to/` 부분을 실제 설치 경로로 변경하세요.

## 설정

### 1. Slack App 및 Webhook URL 생성

1. https://api.slack.com/apps 접속 → "Create New App" → "From scratch"
2. 앱 이름 입력 (예: `Claude Notify`), 워크스페이스 선택
3. 좌측 메뉴 → "Incoming Webhooks" → 활성화
4. "Add New Webhook to Workspace" → 알림 받을 채널 선택
5. **Webhook URL** 복사 (형식: `https://hooks.slack.com/services/TXXXX/BXXXX/xxxx`)

### 2. 멘션용 사용자 ID 확인 (모바일 푸시 알림용)

1. Slack에서 본인 프로필 클릭
2. 더보기(⋯) → "멤버 ID 복사"
3. `U`로 시작하는 영숫자 (예: `UXXXXXXXXXX`)

### 3. 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/TXXXX/BXXXX/xxxx
SLACK_MENTION_USER_ID=UXXXXXXXXXX
```

또는 시스템 환경 변수로 설정해도 됩니다.

> 환경 변수가 설정되지 않으면 알림이 자동으로 비활성화됩니다.

### 4. 고급 설정 (선택)

프로젝트 루트 또는 플러그인 디렉토리에 `.claude-notify.json` 파일 생성:

```json
{
  "locale": "ko",
  "promptEnabled": true,
  "promptMaxLength": 80,
  "cooldownSeconds": 0,
  "secretPatterns": ["sk-[a-zA-Z0-9]{20,}"]
}
```

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `locale` | `"ko"` | 알림 메시지 언어: `ko`, `en`, `ja`, `zh` |
| `promptEnabled` | `true` | 알림에 마지막 사용자 프롬프트 표시 |
| `promptMaxLength` | `80` | 프롬프트 최대 표시 글자 수 |
| `cooldownSeconds` | `0` | 알림 최소 간격 (초, 0이면 비활성화) |
| `secretPatterns` | `[...]` | 프롬프트에서 마스킹할 정규식 패턴 (API 키, 토큰 등) |

### 5. 디버그 모드

```bash
SLACK_NOTIFY_DEBUG=1
```

문제 해결을 위해 stderr에 디버그 로그를 출력합니다.

## 동작 방식

```
사용자 프롬프트 입력
    ↓
Claude Code 처리
    ↓
응답 완료 (Stop 이벤트)
    ↓
트랜스크립트에서 마지막 사용자 프롬프트 추출
    ↓
Slack Block Kit 형식으로 알림 전송
```

알림 예시:

```
✅ Claude Code 응답 완료
──────────────────────
📁 my-project  main
🕐 14:32:05  ⏱ 2분 34초
💬 슬랙 알람이 잘 오는지 테스트
```

## 주요 기능

- **Zero Dependencies** — Node.js 내장 모듈만 사용 (`https`, `fs`, `path`, `os`)
- **Slack Block Kit** — 헤더와 섹션이 포함된 리치 포맷 메시지
- **응답 소요 시간** — Claude Code 응답에 걸린 시간 표시
- **프롬프트 표시** — 마지막 사용자 프롬프트 (길이 설정 가능, 시크릿 마스킹 포함)
- **시크릿 마스킹** — API 키, 토큰, 비밀번호 자동 마스킹
- **프로젝트 & 브랜치** — 프로젝트 이름과 현재 git 브랜치 표시
- **@멘션** — Slack 멘션을 통한 모바일 푸시 알림
- **다국어 지원** — 한국어, 영어, 일본어, 중국어
- **쿨다운** — 알림 최소 간격 설정
- **디버그 모드** — 문제 해결용 stderr 로깅
- **SSRF 방어** — Webhook URL 도메인 검증 (`*.slack.com`만 허용)
- **ReDoS 방어** — 시크릿 패턴 길이 제한 (200자)
- **TTY 안전** — 파이프가 아닌 경우 stdin 읽기 건너뜀 (블로킹 방지)
- **HTTP 상태 확인** — Slack API 오류 감지 및 로깅
- **UTF-8 안전** — 대용량 트랜스크립트의 멀티바이트 문자 경계 처리
- **크로스 플랫폼** — Windows, macOS, Linux

## 프로젝트 구조

```
claude-slack-notify/
├── scripts/
│   └── notify-stop.js       # 엔트리포인트 (109줄)
├── lib/
│   ├── config.js             # 디버그, 상수, 설정 로더
│   ├── context.js            # 프로젝트명, git 브랜치, 타임스탬프
│   ├── transcript.js         # 시크릿 마스킹, 프롬프트 추출
│   ├── slack.js              # 메시지 포맷, URL 검증, API 전송
│   └── cooldown.js           # 쿨다운 (파일 mtime 기반)
├── tests/
│   └── notify-stop.test.js   # 41개 테스트
├── hooks/
│   └── hooks.json            # Claude Code hook 정의
├── .env.example              # 환경 변수 템플릿
├── .claude-notify.example.json # 고급 설정 예시
└── CONVENTIONS.md            # 코딩 컨벤션
```

## 테스트

```bash
node --test tests/notify-stop.test.js
```

41개 테스트, 10개 테스트 스위트:

| 스위트 | 테스트 수 | 설명 |
|--------|:---------:|------|
| formatDuration | 4 | 시간 포맷팅 |
| formatDuration edge cases | 2 | 음수, 대용량 입력 |
| maskSecrets | 4 | API 키/토큰/비밀번호 마스킹 |
| maskSecrets edge cases | 2 | 빈 텍스트, 빈 패턴 |
| validateWebhookUrl | 5 | URL 유효성 검증 |
| validateWebhookUrl edge cases | 2 | null, undefined |
| .env parsing regex | 6 | 환경 변수 파싱 |
| escapeMrkdwn | 5 | Slack mrkdwn 이스케이프 |
| formatSlackBlocks | 8 | Block Kit 메시지 생성 |
| cooldown check | 3 | 쿨다운 동작 검증 |

## 라이선스

MIT
