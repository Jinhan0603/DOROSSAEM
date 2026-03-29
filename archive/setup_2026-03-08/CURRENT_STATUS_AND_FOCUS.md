# Current Status And Focus

## 현재 상태

- `clasp` 설치 완료
- Google 로그인 완료
- 원격 Apps Script 백업 완료
  - `remote_backup/apps_script/DORO_Instructor_DB.js`
  - `remote_backup/apps_script/appsscript.json`
- 로컬 Apps Script 코드 병합 완료
  - `apps_script/DORO_Config.gs`
  - `apps_script/DORO_Main.gs`
  - `apps_script/DORO_Utils.gs`
  - `apps_script/appsscript.json`

## 현재 병목

`clasp push -f`가 아래 이유로 막힘:

- Apps Script API 미활성화

에러 요지:

- `User has not enabled the Apps Script API.`
- 활성화 주소: `https://script.google.com/home/usersettings`

## 지금 사용자가 해야 할 일

1. `https://script.google.com/home/usersettings` 열기
2. `Google Apps Script API` 활성화
3. 1~3분 기다리기
4. 나에게 `API 켰다`고만 말하기

## 그 사이 사용자가 집중할 일

다음 3개 폼에 반드시 남아야 할 기록 항목만 결정하면 된다.

1. 기관/담임 피드백 폼
2. 학생 마이크로 피드백 폼
3. 강사 회고 폼

공통 필수 필드:

- `request_id`
- `instructor_id`
- 제출 시각

## 내가 이어서 할 일

사용자가 API를 켠 뒤:

1. `clasp push -f`
2. Apps Script 반영 확인
3. Phase 2용 폼 구조 코드/질문안 작성

