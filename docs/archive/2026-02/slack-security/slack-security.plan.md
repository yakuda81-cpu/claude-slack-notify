# slack-security Planning Document

> **Summary**: claude-slack-notify 플러그인 보안 강화 (보안-가이드.md Section 8 기준)
>
> **Project**: claude-slack-notify
> **Version**: 1.0.0
> **Author**: yakuda81-cpu / Claude Opus 4.6
> **Date**: 2026-02-12
> **Status**: Completed (Post-hoc)

---

## 1. Overview

### 1.1 Purpose

`claude-slack-notify` 플러그인의 보안 취약점을 `보안-가이드.md` Section 8 체크리스트(8.1~8.4) 기준으로 식별하고 수정한다.

### 1.2 Background

- `claude-telegram-notify`와 동일한 코드 베이스에서 파생된 Slack 알림 플러그인
- telegram-notify 보안 검토에서 발견된 6개 패턴이 동일하게 존재
- Zero dependency Node.js 플러그인으로, 외부 라이브러리 취약점은 없으나 코드 수준 보안 이슈 존재

### 1.3 Related Documents

- 검토 기준: `D:\Claude\vive-md\templates\security\보안-가이드.md` Section 8
- 선행 작업: `claude-telegram-notify` 보안 수정 (commit `997bfcd`)
- 선행 작업: `jira-review-poc` 보안 수정 (16개 이슈, PDCA archived)

---

## 2. Scope

### 2.1 In Scope

- [x] M#1: API 응답 본문 debug 로그 노출 방지
- [x] M#2: execSync cwd 경로 검증 추가
- [x] M#3: Slack mrkdwn 인젝션 방어 (escapeMrkdwn 함수)
- [x] L#4: Cooldown TOCTOU 경합 조건 해소
- [x] L#5: `var` → `let` 블록 스코프 안전성
- [x] L#6: 로컬 .env 토큰 관리 권장사항

### 2.2 Out of Scope

- Slack Block Kit 구조 변경
- 새로운 기능 추가 (메시지 포맷, 추가 locale 등)
- CI/CD 파이프라인 구축
- 기존 23개 테스트의 구조 변경

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | debug 로그에서 API 응답 본문 제거 | Medium | Done |
| FR-02 | execSync 전 cwd 경로 존재 여부 검증 | Medium | Done |
| FR-03 | mrkdwn 특수문자(`&`, `<`, `>`) 이스케이프 | Medium | Done |
| FR-04 | Cooldown을 statSync().mtimeMs 방식으로 변경 | Low | Done |
| FR-05 | var → let 변환 | Low | Done |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Security | 보안-가이드.md 8.1~8.4 체크리스트 준수 | 수동 코드 리뷰 |
| Compatibility | 기존 23개 테스트 전량 통과 | `node --test tests/` |
| Zero Dependency | 외부 패키지 없이 Node.js 내장 모듈만 사용 유지 | package.json 미존재 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [x] 6개 보안 이슈 모두 수정
- [x] 기존 23개 단위 테스트 통과
- [x] git commit & push 완료
- [x] 코드 리뷰 (보안-가이드.md 기준) 통과

### 4.2 Quality Criteria

- [x] 기존 테스트 23/23 통과
- [x] CRITICAL/HIGH 이슈 0건
- [x] MEDIUM 이슈 3건 → 0건
- [x] LOW 이슈 3건 → 0건 (L#6은 권장사항)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| escapeMrkdwn이 Slack Block Kit 렌더링에 영향 | Medium | Low | `&`, `<`, `>` 만 이스케이프 (mrkdwn 포맷 문자 유지) |
| statSync cooldown이 기존 동작과 다를 수 있음 | Low | Low | 파일 mtime 기반으로 동일한 시간 비교 로직 유지 |
| .env 로컬 토큰 유출 | High | Low | .gitignore에 .env 포함 확인됨 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`scripts/`, `tests/`, `hooks/`) | CLI plugins, hooks | ✅ |
| **Dynamic** | Feature-based modules, services layer | Web apps with backend | ☐ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems | ☐ |

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Runtime | Node.js built-in only | Node.js | Zero dependency 원칙 유지 |
| HTTP Client | https / fetch / axios | https (built-in) | 외부 의존성 제거 |
| Testing | node:test / Jest / Vitest | node:test | Zero dependency |
| Message Format | Plain text / Block Kit | Block Kit | 풍부한 Slack 메시지 |

### 6.3 Project Structure

```
claude-slack-notify/
├── scripts/notify-stop.js     # Main hook script (376 lines)
├── tests/notify-stop.test.js  # Unit tests (210 lines, 23 tests)
├── hooks/hooks.json           # Claude Code hook config
├── .env.example               # Placeholder config
├── .gitignore                 # .env, node_modules/
└── docs/                      # PDCA documents
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `.gitignore` includes `.env`
- [x] `.env.example` with placeholder values
- [ ] `CLAUDE.md` (없음 - 필요 시 추가)
- [ ] ESLint configuration (없음 - zero dependency 원칙)

### 7.2 Conventions Applied

| Category | Rule | Status |
|----------|------|:------:|
| **Variables** | `let`/`const` only, no `var` | ✅ |
| **Debug logging** | 민감 데이터 제외, 상태코드만 | ✅ |
| **Output escaping** | mrkdwn: `escapeMrkdwn()` 적용 | ✅ |
| **Path validation** | fs.existsSync 선검증 | ✅ |
| **SSRF defense** | URL protocol/domain/path 3중 검증 | ✅ (기존) |

### 7.3 Environment Variables

| Variable | Purpose | Scope | Status |
|----------|---------|-------|:------:|
| `SLACK_WEBHOOK_URL` | Slack webhook endpoint | Runtime | ✅ |
| `SLACK_MENTION_USER_ID` | @ mention target | Runtime | ✅ |
| `SLACK_NOTIFY_DEBUG` | Debug logging toggle | Runtime | ✅ |

---

## 8. Implementation Summary

### 8.1 Commit History

| Commit | Description | Date |
|--------|-------------|------|
| `6352da4` | fix: security hardening (6 issues from security review) | 2026-02-12 |

### 8.2 Files Modified

| File | Changes |
|------|---------|
| `scripts/notify-stop.js` | +18 / -13 (6 fixes) |

---

## 9. Next Steps

1. [x] ~~Write plan document~~ (this document)
2. [ ] Design document (`/pdca design slack-security`) - 생략 가능 (단순 보안 패치)
3. [ ] Gap analysis (`/pdca analyze slack-security`)
4. [ ] Completion report (`/pdca report slack-security`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-12 | Initial draft (post-hoc, implementation complete) | yakuda81-cpu / Claude |
