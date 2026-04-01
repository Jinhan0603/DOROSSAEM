# DORO 강사관리 시스템 (DOROSSAEM)

> 강사 역량 데이터를 기반으로 강의 배정 → 등급 관리 → 운영 자동화를 단계적으로 달성하는 시스템

### 🔗 [▶ 강사관리 도구 바로가기](https://jinhan0603.github.io/DOROSSAEM/app/index.html)

## 📋 프로젝트 개요

**DORO**의 강사(도로쌤)를 체계적으로 관리하기 위한 시스템입니다.
강사 DB를 구축하고, 활동 로그/역량 데이터를 기반으로 등급을 산정하며, 최종적으로 강의 배정까지 자동화합니다.

## 🏗️ 현재 버전: Ver 2

**Ver 2 핵심**: 복잡한 알고리즘 없이, 강사의 역량 판단에 필요한 **핵심 데이터 시트 4개**만 구축

| Sheet | 목적 |
|-------|------|
| `Instructor_DB` | 관리 시트 — 매니저가 보는 강사 현황 |
| `Instructor_Sensitive` | 보안 시트 — 구글폼 기반 개인정보 |
| `Activity_Log` | 활동 로그 — 강의/기여/감점 기록 |
| `Ability_Log` | 역량 시트 — 전공/프로젝트/교육경험 |

## 📁 폴더 구조

```
DORO 강사관리 시스템 개선/
├── app/                    # HTML/JS 관리 도구
│   ├── index.html          # 메인 대시보드
│   ├── style.css           # 디자인 시스템
│   └── app.js              # CRUD 로직
├── data/                   # JSON 데이터 파일
│   ├── instructor_db.json  # 강사 DB
│   ├── activity_log.json   # 활동 로그
│   └── ability_log.json    # 역량 로그
├── docs/                   # 문서
│   ├── DB_SCHEMA_V2.md     # DB 스키마 정의서
│   ├── SCORING_RULES_V2.md # 점수/등급 규칙
│   └── ROADMAP.md          # 1~4단계 로드맵
├── schema/                 # 스키마 정의
│   └── instructor_db.schema.json
├── reference/              # 원본 기획서
├── archive/                # 구버전 파일 보관
└── README.md
```

## 🚀 사용 방법

### 온라인 (GitHub Pages)
👉 **https://jinhan0603.github.io/DOROSSAEM/app/index.html**

### 로컬 실행
```bash
npx live-server app/
```

### 기능
- 📊 강사 목록 대시보드 (통계, 검색, 필터링)
- ➕ 강사 등록/수정/삭제
- 📈 활동 로그 및 역량 조회
- 🏅 자동 등급 산정 (General → Advanced → Master)
- 📥 데이터 내보내기 (JSON)

## 📐 등급 체계

| 등급 | 조건 | 가능 역할 |
|------|------|----------|
| General | active 상태 | 보조강사 |
| Advanced | 총점 75+ | 주강사 + 보조 |
| Master | 상위 20명 | DLS/캠프/행사 + 주강사 + 보조 |
| Penalty | 패널티 누적 | 배정 불가 |

## 🗺️ 로드맵

| 단계 | 내용 | 기간 |
|------|------|------|
| 1단계 | 기획/설계 — 강사 DB 구축 | 1개월 차 |
| 2단계 | 개발/구축 — 강의 일정 DB + 배정 시스템 | 2개월 차 |
| 3단계 | 시범 운영 — Pilot 배정 테스트 | 3개월 차 |
| 4단계 | 전면 도입 — 전체 적용 | 4개월 차~ |

## 🔒 보안 주의

- `Instructor_Sensitive` 데이터(주민번호, 계좌 등)는 `.gitignore`로 GitHub 업로드 제외
- `data/source/` 폴더의 원본 엑셀 파일도 업로드 제외

## 🛠 기술 스택

- **데이터**: JSON 파일 (로컬)
- **관리 도구**: HTML + CSS + JavaScript (프레임워크 없음)
- **버전 관리**: Git + GitHub
- **개발 환경**: Antigravity / Claude
- **민감정보 수집**: Google Forms

---

**Repository**: https://github.com/Jinhan0603/DOROSSAEM
