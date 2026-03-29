# DORO 강사관리 시스템 변경 이력

## [2026-03-29] Ver 2 프로젝트 재구성

### 변경 사항
- **프로젝트 전면 재구성**: Apps Script 기반 → HTML/JS 기반
- **DB 구조 Ver 2 적용**: 4개 핵심 시트 (Instructor_DB, Instructor_Sensitive, Activity_Log, Ability_Log)
- **관리 도구 구축**: 다크 모드 대시보드 (검색, 필터, 등급별 뷰, CRUD)
- **JSON 기반 데이터**: JSON 파일로 데이터 관리 (AI 도구에서 직접 수정 가능)
- **문서 최신화**: DB_SCHEMA_V2.md, SCORING_RULES_V2.md, ROADMAP.md
- **기존 파일 보관**: `archive/v1_legacy/` 디렉토리로 이동

### 기술 변경
- Google Apps Script → 순수 HTML/CSS/JavaScript
- Google Sheets → JSON 파일
- clasp 의존성 제거
- GitHub 연동 설정

### 다음 단계
- 1단계 완료 후: 강의 일정 DB + 강사 신청/배정 현황 시스템 구축 (2단계)
