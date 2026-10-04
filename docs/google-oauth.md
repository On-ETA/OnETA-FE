# Google OAuth 코드 교환 연동

## 프론트 흐름

1. 로그인/회원가입 화면의 Google 버튼이 백엔드 `/oauth2/authorization/google?redirect_uri=...`를 브라우저로 엽니다.
2. 앱은 `oneta://oauth/callback`, 웹은 `${window.location.origin}/oauth/callback`으로 돌아옵니다.
3. 콜백 화면이 `POST /api/auth/oauth/google/exchange`에 `{ "code": "..." }`를 전송합니다. 일회용 코드 요청은 자동 재시도하지 않습니다.
4. `data.tempId` 응답이면 약관 화면으로 이동합니다. 기존 약관 API가 tempId, serviceTermsAgreement, personalInfoAgreement를 전송합니다.
5. `data.accessToken` 및 `data.refreshToken` 응답이면 이전 홈 캐시를 비우고 토큰을 저장한 뒤 홈으로 이동합니다.
6. 신규 가입자는 약관 처리 응답의 토큰을 가입 완료 화면에서 홈으로 이동할 때 저장합니다.
7. 코드 만료/교환 실패 메시지는 로그인 화면에 표시됩니다. 새 Google 로그인을 진행해야 합니다.

## 설정 및 확인 사항

- `.env`의 `EXPO_PUBLIC_API_BASE_URL`로 백엔드 주소를 설정합니다. 기본값은 `https://api.on-eta.com`입니다. 변경 후 Expo를 다시 시작하세요.
- 백엔드가 앱의 `oneta://oauth/callback`과 실제 웹 origin의 `/oauth/callback`을 반환 주소로 허용해야 합니다.
- Google Console에는 백엔드의 `/login/oauth2/code/google` 주소를 등록해야 합니다. 프론트 반환 주소와 별개입니다.
- 웹에서는 교환/약관 API에 대한 CORS와 JSON POST 사전 요청(OPTIONS)이 허용되어야 합니다.
- Android Manifest의 oneta 딥링크 및 Expo scheme은 이미 등록되어 있습니다. 실제 설치한 앱으로 확인하세요.
- Android에서 localhost는 PC 백엔드 주소가 아닙니다. 기기에서 접근 가능한 백엔드 주소를 사용하세요. 로컬 HTTP 사용 여부는 해당 앱 빌드의 네트워크 설정도 확인해야 합니다.
- `/api/auth/signup/consent`는 tempId로 가입을 처리할 수 있어야 합니다. 이 저장소의 기존 API 주석에는 principal 누락 시 403이라고 적혀 있으므로 서버가 기존 인증 요구사항을 유지하면 신규 Google 가입이 막힙니다. 제공된 새 계약과 일치하는지 서버 확인이 필요합니다.
- 약관 화면은 notificationAgreement도 전달하지만 기존 consent API 함수는 이를 요청에 포함하지 않습니다. 해당 항목을 서버에 저장해야 한다면 정확한 DTO 필드 계약이 필요합니다.
- 실제 백엔드 설정, Redis 동작, Google 계정 로그인은 자동 테스트로 검증하지 않았습니다.

## 수동 테스트

1. 웹에서 Google 로그인 후 `/oauth/callback?code=...`으로 복귀하고 Network에 교환 POST가 한 번 발생하는지 확인합니다.
2. 신규 계정: tempId 응답 → 약관 화면 → 약관 POST에 같은 tempId → 가입 완료 → 홈 진입을 확인합니다.
3. 기존 계정: 토큰 쌍 응답 → 홈 진입 → 앱 재시작 후 로그인 유지 여부를 확인합니다.
4. 앱이 실행 중인 경우와 종료된 경우 각각 Google 로그인 후 딥링크 복귀를 확인합니다.
5. 만료되었거나 이미 사용한 코드로 교환 시 오류가 표시되고 다시 로그인할 수 있는지 확인합니다.

Swagger 테스트는 백엔드에서 코드 발급/교환이 되는지를 검증합니다. 프론트 콜백, 딥링크, CORS, 약관 처리까지 확인하려면 위 테스트도 필요합니다.
