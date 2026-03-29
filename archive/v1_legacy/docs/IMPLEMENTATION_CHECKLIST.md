# Implementation Checklist

## Phase 0: 구조 단순화

- [x] 강사 DB 목적을 `역할 배치 판단`으로 재정의
- [x] 등급 체계를 `General / Advanced / Master / Penalty`로 재정의
- [x] 복잡한 승급/배정 이중 점수 구조 폐기
- [x] `Activity_Log` 중심 구조 채택

## Phase 1: 시트 구조

- [x] `Instructor_Master` 단순 헤더 설계
- [x] `Instructor_Sensitive` 민감정보 분리 유지
- [x] `Activity_Log` 헤더 설계
- [x] 불필요 보조 시트 정리 기준 확정
- [ ] 실제 구글시트에서 새 헤더 구조로 재정렬 실행

## Phase 2: 입력 구조

- [ ] 신규 강사 등록 폼이 최소 입력만 받도록 정리
- [x] 학생 마이크로 피드백 2문항 구조 유지
- [x] 기관/담임 피드백 구조 유지
- [x] 강사 회고 폼 단순 질문 구조 유지
- [ ] 활동 로그 입력용 폼 초안 만들기

## Phase 3: 자동 반영

- [x] 피드백 3종 -> 표준 시트 정규화
- [x] 테스트 응답 자동 제출 동작
- [x] 피드백 기반 `Instructor_Master` 자동 갱신
- [ ] `Activity_Log` 기반 점수/역할 자동 반영 검증
- [ ] Discord / Notion 입력 연동 경로 확정

## Phase 4: 운영 판단

- [ ] `보조강사 배정`
- [ ] `주강사 배정`
- [ ] `DLS 주강사 배정`
- [ ] `운영인력 배정`
- [ ] `General / Advanced / Master / Penalty` 운영 기준 고정

## Phase 5: 실제 운영

- [ ] 매니저용 표시 탭만 남기고 내부 탭 숨김
- [ ] 월 1회 Master 상위 인재 검토 루틴 정의
- [ ] 패널티 입력/해제 프로세스 정의
