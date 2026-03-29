# Non-Terminal Flow (Windows)

터미널 대신, 프로젝트 폴더에서 아래 파일을 더블클릭해서 사용하면 된다.

## 실행 순서

1. `run_0_check_env.cmd`
2. `run_1_clasp_login.cmd`
3. `run_2_clasp_pull.cmd`
4. `run_3_clasp_push.cmd`

또는 한 번에 동기화하려면:

- `run_4_clasp_sync.cmd`

권장:

- 먼저 `run_2_clasp_pull.cmd`로 원격 스크립트를 `remote_backup`에 백업
- 그 다음 `run_3_clasp_push.cmd`로 로컬 `apps_script`를 올림

## 로그인 시 localhost 에러가 떠도 정상인 이유

`clasp login --no-localhost` 방식은 브라우저 콜백을 자동으로 받지 않고,
사용자가 URL을 복사해서 터미널 창에 붙여넣는 방식이다.

즉, `localhost:8888` 에러 화면은 정상일 수 있다.

해야 할 일:

1. 브라우저 주소창의 전체 URL 복사
2. `run_1_clasp_login.cmd` 창에 붙여넣고 Enter

## 이번에 꼬였던 원인

이전 `.cmd` 파일에 한글 문장과 특수문자가 섞여 있었고,
Windows CMD가 일부 문장을 명령으로 잘못 해석했다.

현재는 ASCII 기반으로 다시 작성해서 그 문제를 제거했다.

또한 `pull`이 현재 작업 폴더를 덮어쓸 수 있어서,
이제 `run_2_clasp_pull.cmd`는 `remote_backup` 폴더로만 백업한다.
