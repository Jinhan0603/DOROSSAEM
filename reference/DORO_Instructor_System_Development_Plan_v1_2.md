# DORO 강사 시스템 개발 계획서 v1.0

Google Sheets · Apps Script · Google Forms 기반 MVP 구축용 / 2026-03-08

## 1. 프로젝트 개요
- 목적 1: 휴먼 에러와 비효율적인 수기 관리에서 벗어나 데이터 기반의 강사 등급제와 자동 배정 알고리즘을 도입한다.
- 목적 2: 우수한 공대생·교대생이 DORO 활동을 통해 운영 경험과 커리어 자산을 남기게 만든다.
- 운영모델: DORO는 자체 교보재를 기반으로 외부 현장에 강사를 파견하는 운영 플랫폼이다.

## 2. 고정 원칙
1. 등급은 N / G / A / M으로 고정한다.
2. 등급과 상태를 분리한다.
3. 배정점수와 승급점수를 분리한다.
4. 기관 피드백은 관찰형 문항으로 수집한다.
5. 승급에는 증거팩 리뷰가 들어간다.
6. 원본 기록은 Sheets/Forms에 남기고, Discord/Gmail은 알림용으로만 쓴다.

## 3. 권장 시트 탭
- Instructor_Master
- Instructor_Sensitive
- Qualification
- Availability
- Class_Request
- Application_Log
- Assignment_Log
- Ops_Log
- Teacher_Feedback
- Student_Feedback
- Reflection_Log
- Evidence_Pack
- Contribution_Log
- Incident_Appeal
- Score_Assignment
- Score_Promotion
- Grade_Snapshot
- Decision_Log
- Checkin_Queue
- Config_Rules

## 4. 권장 폼
- 담임/기관 피드백 폼
- 학생 마이크로 피드백 폼
- 강사 회고 폼
- 이슈/사고 신고 폼
- 증거팩 제출 폼

## 5. Apps Script 파일 구조
- ConfigService.gs
- IdService.gs
- FormHandler.gs
- ScoreService.gs
- AssignmentService.gs
- NotificationService.gs
- CheckinService.gs
- AppealService.gs
- SnapshotService.gs
- Utils.gs

## 6. 점수 구조
- 배정점수: 운영 신뢰도 40 / 자격 25 / 현장 피드백 20 / 프로세스 준수 15
- 승급점수: 운영 신뢰도 30 / 콘텐츠·역할 숙련 25 / 현장 피드백 15 / 기여도 20 / 증거팩 10

## 7. 추천 흐름
1. Class_Request 등록
2. 지원자 수집
3. 시간/지역/자격 필터링
4. 추천점수 계산
5. 관리자 승인 및 override 기록
6. 알림 발송

## 8. 개발 로드맵
0단계 기준 고정 → 1단계 데이터 구조 → 2단계 폼 구축 → 3단계 로그 자동화 → 4단계 점수 엔진 → 5단계 추천보드 → 6단계 소통 기능 → 7단계 파일럿

## 9. 개발일지 템플릿
- 날짜 / 버전 / 작성자
- 오늘의 목표
- 작업한 영역
- 구현한 내용
- 수정한 파일 또는 탭
- 테스트 시나리오와 결과
- 발견한 이슈
- 오늘의 의사결정과 이유
- 미해결 과제
- 다음 작업