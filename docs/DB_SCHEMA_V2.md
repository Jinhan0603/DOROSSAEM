# DORO 강사 DB 스키마 Ver 2

> Ver 1의 복잡한 알고리즘/등급 상승 로직을 제외하고, **강사의 역량 판단에 필요한 핵심 시트 4개만** 구축합니다.

---

## 1. 관리 Sheet: `Instructor_DB`

매니저가 보고 판단하는 메인 시트입니다.

| 속성 | 설명 | 값 예시 | 데이터 출처 |
|------|------|---------|-------------|
| `instructor_id` | 고유ID | `26-RPWR` | `Instructor_Sensitive` 연결 |
| `name` | 이름 | 김도로 | `Instructor_Sensitive` 연결 |
| `first_cohort` | 최초 기수 | 1기 | `Instructor_Sensitive` 연결 |
| `active_status` | 이번 기수 활동 여부 | `active` / `inactive` | 매니저 직접 입력 |
| `total_score` | 총점 | 76 | `Activity_Log` + `Ability_Log` 자동 집계 |
| `tier` | 등급 | A | 총점 기반 자동 산출 |
| `activity_region` | 활동 지역 | [안산 거점] 안산, 시흥, 수원 | `Instructor_Sensitive` 연결 |
| `activity_time` | 활동 시간 | 오전-월,화,목 / 오후-화,수,목,금,토 | `Instructor_Sensitive` 연결 |
| `specialty` | 전문성 | 아두이노, CAD, Python, ROS | `Instructor_Sensitive` 연결 |
| `penalty_count` | 패널티 상태 | 0 | `Activity_Log` 감점 로그 기반 |
| `last_updated` | 최근 업데이트 | 2026-03-08T20:17:30 | `Activity_Log` 최신 기록 기준 |

### 총점 계산
```
총점 = 강의 활동 점수 + 내부 기여 점수 + 추천/수상 점수 - 패널티 점수
```

### 등급 체계

| 등급 | 조건 | 권한 |
|------|------|------|
| **General** | `active_status = active` | 보조강사 중심 |
| **Advanced** | `total_score >= 75` | 일반 수업 주강사 + 보조강사 |
| **Master** | 상위 20명 (매월 갱신) | DLS 주강사 + 캠프/행사/부스 운영 + 일반 주강사 + 보조 |
| **Penalty** | 패널티 누적 | 배정 불가 |

---

## 2. 보안 Sheet: `Instructor_Sensitive`

구글폼 기반으로 수집되는 민감 개인정보 시트입니다.

| 속성 | 값 예시 | 비고 |
|------|---------|------|
| `name` | 김도로 | |
| `gender` | 여 | |
| `first_cohort` | 3 | 최초 합격 기수 |
| `university` | 한양대학교 ERICA | |
| `department` | 기계공학과 | |
| `current_residence` | 안산 | |
| `registered_address` | 경기도 안산시 상록구 4동 | 주민등록번호 상 거주지 |
| `phone` | 010-1234-1234 | |
| `rrn` | 002154-115577 | 주민등록번호 |
| `id_card_file` | 김도로.jpg | 신분증 사본 |
| `email` | kimdoro@gmail.com | |
| `bank_name` | 도로은행 | |
| `bank_account` | 00-02323-123213 | |
| `bankbook_file` | 김도로 통장사본.png | 통장사본 |
| `profile_photo` | 김도로.png | 강사 프로필 사진 |
| `available_time` | 오전-월,화,목 / 오후-화,수,목,금,토 | 활동 가능시간 |
| `career_history` | [강의/교육] 23.03~23.08 / ... | 강의/개발 경력 |
| `instructor_id` | 26-RPWR | 구글폼 등록시 자동 생성 |

> **구글폼 URL**: https://docs.google.com/forms/d/1y35fmTCKS1GAk7Yu9w0m4769XFiocNIU4ogIFdcPeHU/edit

---

## 3. 활동 로그 Sheet: `Activity_Log`

모든 강의/기여/패널티 활동을 append-only로 쌓는 이력 시트입니다.

| 컬럼 | 의미 |
|------|------|
| `timestamp` | 입력 시각 |
| `instructor_id` | 강사 ID |
| `activity_type` | 활동 종류 |
| `activity_value` | 횟수/점수/시간 |
| `point` | 반영 점수 |
| `note` | 비고 |
| `source` | `form` / `discord` / `notion` / `manager` |

### 활동 유형 및 배점

#### 강의 활동
| activity_type | point |
|---------------|-------|
| OT 참여 | +1 |
| 강의 콘텐츠 교육 참여 | +1 |
| 일반 강의 참여 | +1 |
| DLS 참여 | +3 |
| DOROLAND 참여 | +3 |
| 캠프/대회 참여 | +2 |
| 운영인력 참여 | +4 |

#### 내부 기여 로그
| activity_type | point |
|---------------|-------|
| 교안 제작 알바 | +2 |
| 교구재 제작 알바 | +2 |
| OT에서 강의 | +2 |
| 교육 영상 제작 | +3 |
| 포장 알바 | +0.1 |

#### 인정/추천 로그
| activity_type | point |
|---------------|-------|
| 마스터 추천 | +1 |
| 타인 추천 (만족도 조사 언급) | +1 |
| 월간 우수 도로쌤 선정 | +10 |

#### 감점 로그
| activity_type | point | 비고 |
|---------------|-------|------|
| 30분 전 지각 | -50 | 패널티 1회. 2회 이상 시 Out |
| 강의시간보다 늦은 도착 | **Out** | 즉시 퇴출 |
| 당일 강의 미참여 | **Out** | 즉시 퇴출 |

### 예시 데이터

| timestamp | instructor_id | activity_type | activity_value | point | note | source |
|-----------|---------------|---------------|----------------|-------|------|--------|
| 2026-03-08 15:17:30 | 26-RPWR | OT 참여 | 1회 | 1 | 인재육성재단 OT | form |
| 2026-03-08 18:17:30 | 26-RPWR | 교육 영상 제작 | 3편 | 9 | X-arm 영상 3편 | discord |

---

## 4. 역량 Sheet: `Ability_Log`

강사의 역량 지표를 기록하는 시트입니다. 구글폼 기반으로 입력됩니다.

| 컬럼 | 의미 |
|------|------|
| `timestamp` | 입력 시각 |
| `instructor_id` | 강사 ID |
| `ability_type` | 역량 종류 |
| `ability_value` | 역량 값 |
| `point` | 반영 점수 |
| `note` | 비고 |
| `source` | `form` |

### 역량 유형 및 배점

| ability_type | ability_value | point |
|-------------|---------------|-------|
| **major_track** | `engineering_major` | +2 |
| | `education_major` | +2 |
| | `science_design_related` | +1 |
| | `other_major` | 0 |
| **project_track** | `no_related_project` | 0 |
| | `related_course_project` | +1 |
| | `related_team_project` | +2 |
| | `related_project_lead` | +3 |
| **teaching_track** | `no_teaching` | 0 |
| | `teaching_volunteer` | +1 |
| | `paid_teaching_or_tutoring` | +2 |
| **skill_track** | `no_core_skill` | 0 |
| | `has_core_skill` | +1 |
| **credential_track** | `no_credential` | 0 |
| | `has_related_credential_or_research` | +1 |
| **leadership_track** | `no_leadership` | 0 |
| | `team_lead_or_ops_lead` | +1 |

### 예시 데이터

| timestamp | instructor_id | ability_type | ability_value | point | note | source |
|-----------|---------------|-------------|---------------|-------|------|--------|
| 2026-03-08 15:17:30 | 26-RPWR | major_track | engineering_major | 2 | 로봇공학과 | form |
| 2026-03-08 18:17:30 | 26-RPWR | project_track | related_project_lead | 3 | 파이썬 객체인식 AI 졸업작품 팀장 | form |

---

## Sheet 간 연결 관계

```
Instructor_Sensitive (구글폼 입력)
        │
        ├─── instructor_id, name, first_cohort ──→  Instructor_DB (관리 시트)
        │
Activity_Log (활동 기록)
        │
        ├─── 총점 집계 ──→  Instructor_DB.total_score
        ├─── 패널티 집계 ──→  Instructor_DB.penalty_count
        └─── 최신 기록 ──→  Instructor_DB.last_updated
        │
Ability_Log (역량 기록)
        │
        └─── 역량 점수 ──→  Instructor_DB.total_score (합산)
```
