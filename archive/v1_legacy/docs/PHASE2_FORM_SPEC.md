# Phase 2 Form Spec

## Required Now

### 1. Teacher / Partner Feedback Form

Target sheet:

- `Teacher_Feedback`

Raw response sheet:

- `RAW_Teacher_Feedback`

Required fields:

- `survey_code`
- `request_id`
- `instructor_id`
- `submitted_at`
- `arrival_on_time`
- `preparedness`
- `level_fit`
- `student_engagement`
- `safety_management`
- `reassign_intent`
- `comment`

Recommended answer type:

- 5-point scale for observation items
- Yes/No for `reassign_intent`
- Short text for `comment`

### 2. Student Micro Feedback Form

Target sheet:

- `Student_Feedback`

Raw response sheet:

- `RAW_Student_Feedback`

Required fields:

- `survey_code`
- `request_id`
- `instructor_id`
- `submitted_at`
- `overall_score`

Recommended answer type:

- 2 questions only
- `DORO 설문 코드`
- `오늘 수업은 어땠나요?`
- no student name collection

### 3. Instructor Reflection Form

Target sheet:

- `Reflection_Log`

Raw response sheet:

- `RAW_Reflection_Log`

Required fields:

- `survey_code`
- `request_id`
- `instructor_id`
- `submitted_at`
- `session_summary`
- `what_went_well`
- `challenge`
- `next_improvement`
- `self_satisfaction`
- `support_flag`
- `support_needed`
- `issue_flag`
- `comment`

Recommended answer type:

- short paragraph
- yes/no for `issue_flag`

Reflection merge rule:

- 기존 `강의 피드백 설문(Test)` 내용을 전부 합치지 않는다
- 운영/점수/지원 판단에 직접 필요한 항목만 남긴다
- 실제 반영 항목은 `session_summary`, `what_went_well`, `challenge`, `next_improvement`, `self_satisfaction`, `support_flag`, `support_needed`, `issue_flag`, `comment`다
- 기존 설문에서 가져오더라도 "다음 운영 판단에 쓰이는가"가 불명확하면 제외한다

## Optional Later

### 4. Incident Report Form

When needed:

- before pilot launch is recommended
- not required for every completed class

Target sheet:

- `Incident_Appeal`

Core fields:

- `request_id`
- `instructor_id`
- `submitted_at`
- `incident_type`
- `severity`
- `description`
- `urgent_replacement_needed`

### 5. Evidence Pack Form

When needed:

- new instructor first 2 classes
- promotion review candidates
- issue cases
- `M` candidate group

Target sheet:

- `Evidence_Pack`

Core fields:

- `request_id`
- `instructor_id`
- `submitted_at`
- `evidence_type`
- `file_link`
- `self_note`

## Completion Rule

One completed class should leave at least these 3 records:

1. `Teacher_Feedback`
2. `Student_Feedback`
3. `Reflection_Log`

All records must connect through:

- `request_id`
- `instructor_id`

## Current Operation Rule

- 이미 만든 Google Form 3개를 유지한다
- Apps Script가 기존 폼 3개를 실제 운영 구조에 맞게 다시 정비한다
- 사람은 `survey_code`만 입력하거나, QR/프리필 링크로 자동 입력된 코드를 그대로 사용한다
- `request_id`, `instructor_id`는 `Assignment_Log`의 `survey_code` 매핑으로 복원한다
- 원본 응답 시트는 보존하고, 메뉴 `8. Phase 2 응답 정규화 및 링크 점검`으로 표준 탭에 적재한다
- 메뉴 `8` 실행 시 `Instructor_Master`의 자격/점수/등급도 함께 갱신한다
- 링크 검증 결과는 `Phase2_Link_Audit`에서 확인한다
