# Android 배포 파일 점검

`.easignore`는 EAS 서버로 업로드할 프로젝트 파일을 정합니다. AAB 내용은
Metro의 의존성 그래프와 Android 빌드가 별도로 결정합니다. Git 제외만으로
앱 패키지 포함 여부가 결정되지는 않습니다.

- `credentials.json`, `credentials/`, 비밀 환경 파일, 개인 서명 키는 Git과 EAS
  프로젝트 업로드에서 제외합니다. 로컬 원본은 삭제하지 않습니다.
- EAS는 서명 자격 증명을 별도로 처리합니다. 현재 `eas.json`은 기본 remote
  자격 증명 설정을 사용합니다. production 서명 키를 변경하거나 새로 만들지 않습니다.
- IDE 설정, 문서, 테스트, 테스트 API 도구, Gradle/Metro 캐시, APK/AAB 결과물도
  EAS 프로젝트 업로드에서 제외합니다. 설치 후 Naver 지도 패치에 필요한
  `scripts/patch-naver-map-loaded.cjs`와 앱이 참조하는 `public/` 자산은 유지합니다.
- Metro와 Android 자산 병합에서도 로컬 자격 증명 파일을 차단합니다.
- Firebase `google-services.json`은 클라이언트 설정이며, 현재 파일에 서비스 계정
  개인 키는 없습니다. Firebase 빌드 설정은 유지합니다.
- 기본 Android `debug.keystore`는 공개된 개발용 키입니다. 개발 빌드를 위해
  유지하지만 스토어 제출용 release 키로 사용해서는 안 됩니다. 로컬 Gradle의
  기존 release 서명 설정은 변경하지 않았습니다.
- AAB의 공개 서명 인증서, 라이선스, 네이티브 심볼, R8 매핑은 정상 메타데이터입니다.

## 재검사

Python 3가 필요합니다. 프로젝트 루트에서:

```sh
npm run audit:aab
# 다른 AAB를 검사할 때
npm run audit:aab -- path/to/app.aab
```

파일 경로, 개인 키/서비스 계정 흔적, 로컬에 있는 실제 서명 키 데이터와
충분히 긴 서명 비밀번호의 포함 여부를 검사합니다. 비밀값은 출력하지 않으며
문제가 발견되면 종료 코드 1을 반환합니다. 짧은 비밀번호는 오탐 방지를 위해
문자열 비교에서 제외하므로, 임의의 모든 비밀값을 탐지하는 도구는 아닙니다.

```sh
npm test
python -m unittest discover -s tests -p test_aab_audit.py
```

참고: [EAS 제외 규칙](https://docs.expo.dev/build-reference/easignore/),
[EAS 서명 자격 증명](https://docs.expo.dev/app-signing/local-credentials/).
