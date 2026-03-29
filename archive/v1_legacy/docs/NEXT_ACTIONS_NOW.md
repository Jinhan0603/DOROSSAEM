# Next Actions Now

## What Changed

- `DORO 학생 마이크로 피드백 (Test)`는 2문항만 남긴다.
  - `DORO 설문 코드를 입력해 주세요`
  - `오늘 수업은 어땠나요?`
- `DOROSSAEM 회고 (Test)`는 기존 `강의 피드백 설문(Test)`에서 운영 판단에 실제로 필요한 항목만 추려 다시 만든다.
- `survey_code`를 기준으로 `request_id`, `instructor_id`를 `Assignment_Log`에서 복원한다.
- 테스트 응답 3건은 Apps Script가 자동 제출하고, 그 결과를 `Instructor_Master`에 반영한다.

## Execute Now

1. `강사 DB (Test)` 시트를 새로고침한다.
2. 메뉴 `🚀 DORO 통합 관리 > 5. Phase 2 폼 재정비`를 실행한다.
3. 메뉴 `🚀 DORO 통합 관리 > 9. 테스트 응답 자동 제출 + Master 반영`을 실행한다.

## Expected Result

- 구글 폼 3개 질문이 현재 운영 기준으로 바뀐다.
- `RAW_Teacher_Feedback`, `RAW_Student_Feedback`, `RAW_Reflection_Log`에 원본 응답이 생긴다.
- `Teacher_Feedback`, `Student_Feedback`, `Reflection_Log`에 표준화된 행이 생긴다.
- `Assignment_Log`에 테스트 배정 1건과 `survey_code`가 생긴다.
- `Instructor_Master`에서 해당 강사의 아래 값이 갱신된다.
  - `보조강사 자격 (assistant_cert)`
  - `주강사 자격 (lead_cert)`
  - `승급용 점수 (관찰 루브릭)`
  - `배정용 점수 (우선순위)`
  - `등급 (Grade)`

## If Something Looks Wrong

- 폼 질문이 안 바뀌면 메뉴 `5`가 아직 실행되지 않은 상태다.
- 응답 시트가 비어 있으면 메뉴 `9`가 아직 실행되지 않았거나 실행 중 오류가 난 상태다.
- `Instructor_Master`가 안 바뀌면 `Teacher_Feedback`, `Student_Feedback`, `Reflection_Log`에 테스트 행이 들어왔는지 먼저 확인한다.
- 실제 운영 중에는 메뉴 `8`만 실행해도 `Instructor_Master`가 함께 갱신된다.
