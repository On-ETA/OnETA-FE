# 릴리스 최적화 검증 결과

검증일: 2026-11-02. 현재 작업 트리의 Android R8 코드 축소·난독화 및 리소스 축소를 켠 릴리스 빌드를 대상으로 검사했다. 기존 사용자 AVD 대신 별도의 `OnetaReleaseQA` 에뮬레이터를 사용했다.

## 수정 사항

- Expo Location의 옵션 변환 실패는 R8가 런타임에 사용하는 `Record` 인터페이스와 `Field` 어노테이션을 변경하면서 발생했다. `android/app/proguard-rules.pro`와 Expo prebuild 설정의 `extraProguardRules`에 보존 규칙을 반영했다. 실제 최적화된 APK에서 마지막 위치 옵션 및 다른 위치 레코드 변환이 성공하는 것을 확인했다.
- 마지막 위치 캐시 조회가 실패하더라도 현재 위치 조회로 진행하도록 보완했으며, 사용자 화면에는 네이티브 예외 원문 대신 위치 오류 안내가 표시되도록 했다.
- 추가 검사에서 `src/service/fcm.web.ts`의 임시 `Messaging = unknown` 타입으로 발생하는 TypeScript 오류 3건을 발견했다. Firebase 공식 타입을 타입 전용으로 가져오도록 수정했다.
- 최적화된 APK에 직접 연결하는 재사용 가능한 네이티브 회귀 검사 `tests/android/ReleaseProbe.java`, `scripts/run_release_probe.py`를 추가했다. 테스트 APK는 앱과 별도로 빌드되며 제품 소스에 포함되지 않는다.

## 검사 결과

| 검사 | 결과 |
| --- | --- |
| JS/TS 및 설정 파일 Babel 변환 | 121개, 오류 0건 |
| SVG XML 검사 | 76개, 오류 0건 |
| TypeScript `tsc --noEmit` | 오류 0건 |
| Node 자동 테스트 | 230개 통과, 실패·건너뜀 0개 |
| AAB 검사기 Python 테스트 | 3개 통과 |
| Android 릴리스 APK/AAB 빌드 | 성공 |
| Android 릴리스 Lint | 오류 0건, 경고 30건 |
| 웹 프로덕션 export | 성공 |
| AAB 파일·서명 비밀정보 검사 | 1,528개 항목, 탐지 0건 |
| AAB 64비트 네이티브 ELF 정렬 | 42개 라이브러리의 LOAD 세그먼트가 16KB 이상 정렬 |
| 실제 릴리스 네이티브 검사 | 아래 항목 모두 통과 |

자동 테스트에는 캐시 만료·동일 응답 처리·로그아웃/계정 변경·요청 경쟁·수정 중인 입력 보존·로딩 지연·위치 오류 폴백 회귀 검사가 포함된다. 자동 테스트의 서버 응답은 모의 응답이며 실제 서버 연동 성공과 구분해야 한다.

네이티브 검사는 Android 17 / API 37 / x86_64 / 페이지 크기 16,384바이트 에뮬레이터에 실제 R8 릴리스 APK를 설치해 수행했다.

- 런타임 `Field` 어노테이션 25개 유지 확인.
- `LocationLastKnownOptions`, `LocationOptions`, `ReverseGeocodeLocation`, `Region`, 중첩 옵션을 가진 `LocationTaskOptions`의 실제 네이티브 맵 → 레코드 변환 및 값 확인.
- `GeofencingRegionState` 문자열 enum 변환 확인.
- Firebase App 및 Messaging 초기화 확인.
- Manifest 컴포넌트 26개 클래스 로딩 확인.
- 실제 React Native 네이버 지도 wrapper를 화면에 부착하고 네이티브 지도 초기화 확인.

## 에뮬레이터 화면 검사

- 온보딩 3개 페이지와 시작 버튼, SVG 표시 확인.
- 온보딩 완료 후 재실행 시 로그인 화면으로 이동하는 저장 상태 확인.
- 로그인 → 회원가입 → 뒤로가기, 비밀번호 찾기 이동 확인.
- 로그인·회원가입·비밀번호 찾기의 필수 입력 누락 안내 확인.
- 개인정보 처리방침 화면 표시 확인. 명시적 Activity intent를 사용했으므로 외부 브라우저의 OS 딥링크 필터 검증을 의미하지 않는다.
- 로그인 화면 가로·세로 전환 후 필드와 버튼 표시를 UI 트리와 스크린샷으로 확인.
- 마지막 앱 프로세스 로그 검사에서 JS 예외·치명적 예외·네이티브 클래스/메서드 로딩 오류가 탐지되지 않았다. 전체 실행 이력의 모든 오류 부재를 보장하는 검사는 아니다.

## 남아 있는 경고와 검증 한계

Lint 경고 30건의 구성은 `ScopedStorage` 2, `UnusedAttribute` 1, `NewerVersionAvailable` 2, `PrivateResource` 6, `UnusedResources` 7, `IconLauncherShape` 1, `IconLocation` 1, `IconExtension` 10이다. 저장소 권한, 종속 라이브러리 리소스, 사용하지 않는 리소스 및 기본 아이콘 관련 경고가 남아 있다. 이번 검사에서 빌드를 막거나 실행 오류로 재현된 항목은 없었지만 경고가 모두 해소된 상태는 아니다.

오프라인 Expo 의존성 검사에는 `react-native-screens` 4.17.1이 권장 범위 `~4.16.0`과 다르다는 경고가 남는다. 앞선 Android API 경고 대응을 위해 선택한 버전으로 유지했으며, 이번 릴리스의 화면 전환 검사는 통과했다. 향후 Expo SDK 갱신 시 함께 재검토해야 한다.

실제 계정을 이용한 로그인 성공·Google OAuth 복귀·메일 인증·경로 서버 응답·알림 생성/수정/삭제·실제 FCM 수신·백그라운드 알림 전달은 검증하지 않았다. 계정이나 서버 데이터를 변경하거나 메일·푸시를 발송하지 않았다. 물리 기기 GPS, ARM 기기 실행, 구형 Android, iOS도 이번 에뮬레이터 검증 범위에 포함되지 않는다. 따라서 모든 기능의 실서버 통합 동작이 확인됐다는 의미는 아니다.

로컬 APK/AAB는 표준 Android **디버그 키로 서명된 최적화 검사 산출물**이다. Play Store 업로드용 서명이 아니다. 배포 시 기존 EAS 운영 서명으로 AAB를 새로 빌드해야 하며, 이전 AAB에는 새 네이티브 보존 규칙이 소급 적용되지 않는다.

## 재현 명령과 증거

저장소 루트에서 실행:

```powershell
npm test
npx tsc --noEmit --pretty false
python -m unittest discover -s tests -p test_aab_audit.py
npm run audit:aab
npx expo export --platform web --output-dir .expo/release-qa/web-export
```

Android 빌드 및 정적 검사:

```powershell
Push-Location android
.\gradlew.bat :app:assembleRelease :app:lintRelease
Pop-Location
```

네이티브 검사는 JDK, Android SDK platform 36 및 build-tools 36.0.0이 필요하다. 별도의 QA 에뮬레이터에 위에서 만든 APK를 설치하고, **동일 빌드의** `android/app/build/outputs/mapping/release/mapping.txt`가 있는 상태에서 실행한다. 검사 APK도 저장소의 공개 표준 debug.keystore로 서명되므로 같은 키로 서명된 로컬 APK를 대상으로 사용한다. 운영 키를 테스트에 복사할 필요가 없다.

```powershell
adb -s emulator-5580 install -r -g android/app/build/outputs/apk/release/app-release.apk
python scripts/run_release_probe.py --serial emulator-5580
```

검사기는 물리 기기 사용을 방지하기 위해 `emulator-` 시리얼만 허용한다. 실행 전 해당 에뮬레이터가 사용자 데이터가 없는 격리 QA 인스턴스인지 확인한다.

검사 증거는 빌드에서 제외되는 `.expo/`에 보관했다:

- `.expo/full-release-review-tests.log`
- `.expo/full-release-tscheck.log`
- `.expo/full-release-apk-build.log`
- `.expo/full-android-lint.log`
- `.expo/full-web-export.log`
- `.expo/release-qa/probe/result.txt`
- `.expo/release-qa/elf-alignment.json`
- `.expo/release-qa/app-runtime.log`
- `.expo/release-qa/login-landscape.png`, `login-portrait.png`

Lint 상세 결과: `android/app/build/reports/lint-results-release.html` 및 `.xml`.
