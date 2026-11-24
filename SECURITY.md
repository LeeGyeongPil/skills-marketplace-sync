# 보안 정책 / Security policy

보안 취약점을 발견하셨다면 **공개 이슈 대신** 이 레포의 **Security → Report a vulnerability**(비공개 취약점 신고)로 알려 주세요. 확인 후 답변드리고, 고친 버전을 릴리스하면서 함께 안내합니다.

If you find a security issue, please **do not open a public issue**. Use **Security → Report a vulnerability** in this repository to report it privately. We will reply after checking and announce the fix with a release.

이 도구는 지정한 작업 디렉터리 안의 파일만 읽고 쓰며, 네트워크 호출을 하지 않고 포트도 열지 않습니다(선택 사항인 `claude` CLI 실행 제외). / The tool reads and writes files only inside the given working directory, makes no network calls and opens no ports (except running the optional `claude` CLI).
