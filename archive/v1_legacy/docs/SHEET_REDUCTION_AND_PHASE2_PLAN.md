# Sheet Reduction And Phase2 Plan

## 1) 직접 접근 가능 범위

- 이 환경에서는 네 Google 계정의 Apps Script 프로젝트에 직접 배포/수정은 불가
- 대신 실행 가능한 `.gs` 코드를 제공했고, 붙여넣으면 바로 동작

코드 위치:

- `apps_script/DORO_Config.gs`
- `apps_script/DORO_Utils.gs`
- `apps_script/DORO_Main.gs`

## 2) 최소 시트 구조(권장)

유지:

1. Instructor_Master
2. Instructor_Sensitive
3. Class_Request
4. Assignment_Log
5. Incident_Appeal
6. Score_Assignment
7. Score_Promotion
8. Grade_Snapshot
9. Decision_Log
10. Config_Rules
11. 강사 기본 정보 등록 응답 시트

나머지는 삭제 대신 숨김(Archive) 처리.

## 3) 메뉴 기능(코드 반영 후)

- `1. 신규 강사 등록 폼 열기`
  - Config_Rules의 `REGISTRATION_FORM_URL` 사용
- `2. 신규 응답 DB 일괄 적용하기`
  - 응답 시트 -> Master/Sensitive 업서트
  - `DB 적용 여부`를 `O`로 변경
  - 거주지 기반 `이동 가능 범위` 자동 생성
- `3. 데이터 일괄 표준화 및 점검`
  - 기본값 보정(`active`, `N`, `0 / 0`, `0`)
  - 빈 `이동 가능 범위` 자동 채움
- `4. 최소 시트 구조 정리(비핵심 시트 숨김)`
  - 핵심 시트 외 숨김 처리

## 4) Phase2 (수업 종료 기록 구조) 바로가기

지금 당장 필요한 폼:

1. 기관/담임 피드백 폼
2. 학생 마이크로 피드백 폼
3. 강사 회고 폼

지금 당장 없어도 되는 폼:

4. 이슈/사고 신고 폼
5. 증거팩 제출 폼

운영 기준:

- `4. 이슈/사고 신고 폼`은 파일럿 시작 전에는 만드는 것을 권장
- 다만 모든 수업 종료 기록의 필수 조건은 아님
- `5. 증거팩 제출 폼`은 트리거 기반으로만 운영하면 충분
- 즉, 신규 강사 초기 수업 / 승급 심사 / 이슈 발생 / M 후보군일 때만 열면 된다

공통 원칙:

- 모든 폼에 `request_id`, `instructor_id`를 프리필
- 응답은 append-only 원본으로 저장
- 점수 시트는 원본을 집계해 생성(원본 직접 수정 금지)
