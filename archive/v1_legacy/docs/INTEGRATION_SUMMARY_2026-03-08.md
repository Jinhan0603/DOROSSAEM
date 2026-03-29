# Integration Summary (2026-03-08)

## 1) 확인한 입력 소스

- 로컬 엑셀: `DORO 강사정보_최신화.xlsx` (시트: `강사정보`)
- 구글시트: `강사 DB (Test)`  
  `https://docs.google.com/spreadsheets/d/1slxHmxj4ZOi_WvH6TvUcWH9_9WW1tzDILE3i7dJ1ix8`
- 추가 문서:
  - `DORO_Instructor_System_Development_Plan_v1_2.docx`
  - `DORO_Instructor_System_Development_Plan_v1_2.md`
  - `DORO_Development_Log_Template_v1_2.md`

## 2) 접근/판독 결과

- 엑셀 파일 판독 성공
- 구글시트 CSV/전체 XLSX export 판독 성공
- 문서 3개 판독 성공

## 3) 현재 흐름 일치도

### 일치하는 항목

- `Instructor_Master` / `Instructor_Sensitive` 분리 구조
- 배정점수와 승급점수 분리 원칙
- 추천 후 관리자 override + 사유 기록 구조
- 운영 로그/피드백/이의제기/규칙 탭 구조

### 충돌하던 항목 (이번 정리에서 통일)

- 등급 체계  
  - 기존 V2 초안: `G1/G2/G3/G4/MASTER`
  - v1.2 기준: `N/G/A/M`
  - 조치: 문서/스키마/템플릿을 `N/G/A/M` 기준으로 통일

- 점수 축 정의  
  - 기존 V2 초안: `R/T/O/C`
  - v1.2 기준:  
    - 배정: `R/Q/F/P`  
    - 승급: `R/M/F/C/E`
  - 조치: `SCORING_SPEC_V1.md`, `scoring_sheet_template.csv`, `schema/doro_v2_schema.sql` 반영

## 4) 데이터 정규화 결과

`scripts/normalize_instructor_data.py` 실행 결과:

- legacy 행 수: 146
- Master 출력 행: 146
- Sensitive 출력 행: 146
- 기존 구글시트 ID 매칭(이름+전화): 2건
- 신규 생성 ID: 144건

산출 파일:

- `data/normalized/instructor_master_seed.csv`
- `data/normalized/instructor_sensitive_seed.csv`

## 5) 개인정보 처리 주의

원본/정규화 데이터에는 주민번호, 연락처, 계좌번호, 주소가 포함되어 있다.

- 외부 공유본에서는 `Instructor_Sensitive`를 제외
- 분석/테스트는 최소한의 마스킹 데이터 사용 권장
- 접근 권한은 운영 관리자 계정으로 제한

## 6) 문서 기준(권장 Single Source of Truth)

- 기획 기준: `DORO_Instructor_System_Development_Plan_v1_2.docx` (상세본)
- 실행/개발 기준:
  - `docs/V2_PLAN.md`
  - `docs/SCORING_SPEC_V1.md`
  - `schema/doro_v2_schema.sql`
  - `docs/IMPLEMENTATION_CHECKLIST.md`

