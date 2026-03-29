# CLASP Setup Guide

## 1) 답변

로컬 1회 로그인은 맞다.  
VSCode 터미널(권장: PowerShell)에서 진행하면 된다.

## 2) 준비

프로젝트 루트에 `.clasp.json`은 이미 생성되어 있다.

- scriptId: `1lLzMjQk_gT-JnyMYaGBi5a0SOrrm5nmn1ZkUuvus8BBDPqKI197pBoEq`
- rootDir: `apps_script`

## 3) 실행 순서

프로젝트 폴더로 이동:

```powershell
cd "C:\Users\User\OneDrive\문서\Jindex\DORO 강사관리 시스템 개선"
```

Node/클래스프 확인:

```powershell
node -v
npm -v
clasp --version
```

`clasp`가 없으면 설치:

```powershell
npm i -g @google/clasp
```

구글 로그인 1회:

```powershell
clasp login --no-localhost
```

브라우저에 뜨는 URL에서 승인 후, 인증 코드를 터미널에 붙여넣는다.

## 4) 동기화

원격 스크립트 백업(권장, 최초 1회):

```powershell
clasp pull
```

로컬 `apps_script/*.gs`를 원격에 반영:

```powershell
clasp push
```

배포 확인:

```powershell
clasp status
```

## 5) 자주 쓰는 명령

```powershell
clasp pull
clasp push
clasp open
clasp deployments
```

## 6) 문제 해결

`node`가 인식 안 되면:

1. Node.js LTS 재설치
2. 터미널 재시작
3. 다시 `node -v` 확인

PowerShell 대신 CMD로 실행해도 된다.

