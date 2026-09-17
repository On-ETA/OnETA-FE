# FCM 연결

Expo Development Build와 React Native Firebase 26.4의 modular API를 사용합니다.
HTTP v1 발송과 서비스 계정 인증은 백엔드에서 처리합니다. 웹에서는 FCM 모듈을
불러오지 않습니다.

## 연결 위치

| 파일 | 역할 |
| --- | --- |
| `index.js` | 앱 등록 전에 백그라운드 핸들러 등록, iOS headless 시작 시 UI 마운트 방지 |
| `src/service/fcm.ts` | 권한, FCM 토큰 발급/삭제, 수신/갱신/알림 열기 modular API |
| `src/service/fcm.web.ts` | 네이티브 모듈을 참조하지 않는 웹 어댑터 |
| `src/notifications/lifecycle.js` | 시작/로그인/앱 복귀 등록, 재시도, 세션 변경 처리, 구독 해제 |
| `src/api/notifications/fcmApi.ts` | 기존 디바이스 토큰 API에 FCM 토큰 전달 |
| `src/notifications/deviceTokenRegistration.js` | 같은 세션/토큰 등록 중복 방지 |
| `src/notifications/PushNotifications.js` | 조작을 막지 않는 포그라운드 배너 |
| `src/notifications/navigation.js` | 로그인과 네비게이션 준비 후 알림 목록 이동 |
| `src/screens/NotificationsScreen.js` | 수신/복귀/화면 진입 시 갱신, 당겨서 새로고침, FlatList |

## 등록 흐름

1. 앱 첫 렌더 이후 알림 권한을 요청하고 Firebase에서 FCM 토큰을 가져옵니다.
2. 로그인 전에는 토큰만 보관하며 인증 없는 백엔드 등록 요청은 하지 않습니다.
3. 로그인으로 `setAuthTokens`가 호출되면 화면 전환을 기다리게 하지 않고 등록합니다.
4. FCM 토큰이 갱신되면 새 토큰을 전송합니다. 같은 로그인 세션/토큰의 중복 요청은 합칩니다.
5. 실패 시 약 1/2/4초 간격(소량의 랜덤 지연 포함)으로 최대 3회 재시도합니다.
   앱 복귀와 로그인/토큰 변경 이벤트에서도 다시 시도합니다.
6. 로그아웃/계정 변경 시 이전 등록 요청을 취소하고 기존 FCM 토큰을 삭제합니다.
   이전 세션의 인증 재발급 응답이 나중에 도착해도 로그인 상태를 복원하지 않습니다.

FCM 토큰의 영속화는 Firebase SDK가 담당합니다. APNs 토큰이나 Expo Push Token을
FCM 토큰 대신 전송하지 않습니다. 현재 앱의 네이티브 로그인 토큰 저장은 메모리
방식이므로, 프로세스를 다시 실행하면 로그인 후 백엔드 등록이 진행됩니다.
자동 로그인/보안 저장소 도입은 이번 FCM 연결 범위에 포함하지 않습니다.

기존 백엔드 계약:

```http
POST /api/notifications/device-tokens
Authorization: Bearer <앱 로그인 accessToken>
Content-Type: application/json

{"deviceToken":"<Firebase getToken 반환값>"}
```

백엔드는 로그인 사용자와 토큰을 연결하고 중복 등록을 허용하는 upsert 방식으로
처리해야 합니다. 로그아웃 시 사용자/기기 연결 해제와 FCM `UNREGISTERED` 응답의
만료 토큰 정리도 백엔드에서 처리해야 합니다. 현재 저장소에는 토큰 해제 API 계약이
없어 임의의 DELETE 엔드포인트는 추가하지 않았습니다. 오프라인 상태에서는 클라이언트의
토큰 삭제가 즉시 완료되지 않을 수 있어 서버 측 연결 해제가 필요합니다.

## 수신과 화면 반영

- 포그라운드: `onMessage`로 목록 갱신을 알리고, 제목이 있는 메시지는 6초 배너로 표시합니다.
- 백그라운드/종료: `setBackgroundMessageHandler`는 AsyncStorage의
  `oneta.notifications.lastBackgroundReceipt`에 메시지 ID와 수신 시각만 기록합니다.
  UI 조작이나 전체 목록 요청은 하지 않습니다. 이 기록은 진단용이며 목록 데이터는 백엔드가 기준입니다.
- `notification` payload의 백그라운드 시스템 알림 표시는 OS/FCM이 담당합니다.
  별도의 로컬 알림을 만들지 않으므로 중복 표시하지 않습니다.
- data-only 메시지는 수신 처리 대상이지만 시스템 알림을 자동으로 표시하지 않습니다.
- 알림 클릭/배너 클릭은 알림 목록으로 이동합니다. 서버 payload의 임의 경로나 URL을 실행하지 않습니다.
  종료 상태에서 클릭한 경우 네비게이션과 로그인 준비를 기다립니다.
- 목록은 화면이 보일 때 갱신하며, 연속 수신은 300ms로 모아 요청합니다.
  갱신 실패 시 기존 목록을 유지하고, 이전 요청이 최신 결과를 덮어쓰지 못하도록 취소합니다.

## 백엔드 HTTP v1 예시

백엔드가 Google OAuth 액세스 토큰으로
`POST https://fcm.googleapis.com/v1/projects/<PROJECT_ID>/messages:send`를 호출합니다.
앱 로그인 토큰은 이 Google API의 인증 토큰이 아닙니다.

```json
{
  "message": {
    "token": "<등록된 FCM 토큰>",
    "notification": {
      "title": "도착 알림",
      "body": "버스가 곧 도착합니다."
    },
    "data": {
      "notificationId": "123"
    },
    "android": {
      "priority": "HIGH"
    },
    "apns": {
      "headers": {
        "apns-push-type": "alert",
        "apns-priority": "10"
      },
      "payload": {
        "aps": {
          "sound": "default",
          "content-available": 1
        }
      }
    }
  }
}
```

`data` 값은 문자열로 전달합니다. 위 예시는 사용자에게 표시할 알림용입니다.
iOS data-only 백그라운드 메시지는 `notification`을 빼고
`apns-push-type: background`, `apns-priority: 5`, `content-available: 1`을 사용합니다.
OS 절전 정책/백그라운드 새로고침 제한/앱 강제 종료 때문에 즉시 수신을 보장할 수는 없습니다.

## Development Build

Android SDK, JDK, Google Play 서비스가 있는 기기 또는 에뮬레이터가 필요합니다.
AsyncStorage 네이티브 모듈을 추가했으므로 기존 Development Build를 다시 빌드합니다.

```sh
npm install
npm run android
```

이미 새 Development Build가 설치되어 있으면 `npx expo start --dev-client`로 시작합니다.
Expo Go에서는 실행할 수 없습니다. `app.json`과 현재 Android Manifest에
`POST_NOTIFICATIONS` 권한을 반영했습니다.

iOS는 수신 코드, remote-notification 백그라운드 모드, 개발용 APNs entitlement,
RNFirebase 26.4의 기본 SPM 방식에 필요한 dynamic frameworks 설정을 추가했습니다.
실제 빌드에는 다음 프로젝트 정보가 추가로 필요합니다.

- Firebase iOS 앱과 일치하는 `expo.ios.bundleIdentifier`.
- 실제 `GoogleService-Info.plist` 파일과 `expo.ios.googleServicesFile` 경로.
- Firebase 콘솔의 APNs 인증 키 및 Push Notifications가 활성화된 Apple 서명 설정.
- macOS/Xcode 또는 해당 환경의 빌드 서비스. 배포 빌드는 APNs production entitlement/서명을 확인합니다.

설정 파일이 아직 없으므로 iOS 빌드/실제 수신 검증은 완료되지 않았습니다.

## 검증

`npm test`는 토큰 등록, 세션 변경, 재시도, 권한 거부, 구독 해제, 수신 중복,
백그라운드 기록, 웹 분리, 요청 취소를 모의 환경에서 검사합니다.
네이티브 수신까지 검증하려면 다음 순서로 확인합니다.

1. Development Build 실행 후 알림 권한을 허용하고 로그인합니다.
2. 백엔드 로그에서 디바이스 토큰 등록 성공을 확인합니다.
3. 백엔드 FCM 테스트 API로 발송해 앱이 열린 상태의 배너와 목록 갱신을 확인합니다.
4. 앱을 백그라운드로 보낸 후 발송해 시스템 알림과 클릭 시 목록 이동을 확인합니다.
5. 앱을 종료한 후 발송하고 알림을 클릭해 로그인 후 목록 이동을 확인합니다.
6. 권한 거부/설정에서 재허용, 네트워크 복구, 로그아웃 후 다른 계정 로그인을 확인합니다.

참고: [RNFirebase Messaging](https://rnfirebase.io/messaging/usage),
[Expo/RNFirebase 설정](https://rnfirebase.io/),
[FCM HTTP v1 REST](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages).
