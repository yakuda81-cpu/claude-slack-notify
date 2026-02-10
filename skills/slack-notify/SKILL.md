---
name: slack-notify
description: |
  Slack notification for Claude Code.
  Get notified when Claude Code finishes responding.

  Use when user wants to set up, test, or manage Slack notifications.

  Triggers: slack, notification, alert, notify, 슬랙, 알림, 알람, 通知, notificación, Benachrichtigung
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
user-invocable: true
argument-hint: "setup | test | status"
---

# Slack Notify Skill

Claude Code 응답 완료 시 Slack 알림을 보내는 플러그인입니다.

## Arguments

| Argument | Description |
|----------|-------------|
| `setup` | Slack Webhook URL과 멘션 User ID를 설정합니다 |
| `test` | 테스트 알림 메시지를 보냅니다 |
| `status` | 현재 설정 상태를 확인합니다 |

## Action Details

### setup

1. AskUserQuestion으로 Slack Webhook URL 입력 요청
   - Slack App 생성 및 Incoming Webhook 설정 방법 안내
2. AskUserQuestion으로 멘션할 User ID 입력 요청 (선택)
   - 프로필 > 더보기 > 멤버 ID 복사 안내
3. 프로젝트 루트의 `.env` 파일에 저장:
   ```
   SLACK_WEBHOOK_URL=<입력값>
   SLACK_MENTION_USER_ID=<입력값>
   ```
4. 기존 .env가 있으면 해당 키만 추가/업데이트 (다른 내용 보존)
5. 저장 완료 메시지 + 테스트 제안

### test

1. `.env`에서 SLACK_WEBHOOK_URL, SLACK_MENTION_USER_ID 읽기
2. 미설정 시: "먼저 `/slack-notify setup`을 실행하세요" 안내
3. 설정됨: node로 테스트 메시지 전송
4. 결과 확인 후 성공/실패 메시지 표시

### status

1. `.env` 파일에서 SLACK_WEBHOOK_URL, SLACK_MENTION_USER_ID 확인
2. 설정 상태 표시:
   ```
   Slack Notify Status
   ---
   Webhook URL: 설정됨 (hooks.slack.com/...)
   Mention ID:  설정됨 (U0ADZVBU2TU)
   Hook:        Stop 이벤트 등록됨
   ---
   ```
3. 미설정 항목이 있으면 setup 안내

## Notes

- Webhook URL 미설정 시 hook은 조용히 skip됩니다 (에러 없음)
- Node.js 내장 https 모듈만 사용 (외부 의존성 없음)
- 메시지에 프로젝트명, git branch, 타임스탬프, 마지막 프롬프트 포함
- 멘션 설정 시 모바일 푸시 알림 수신 가능
