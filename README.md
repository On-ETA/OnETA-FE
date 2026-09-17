# Oneta-FE

## 실행 방법

평소에는 아래 명령어로 실행합니다.

```bash
pnpm dev
```

`pnpm`이 설치되어 있지 않다면 먼저 `npm install -g pnpm@10`을 실행합니다.
Windows PowerShell에서 스크립트 실행 정책 오류가 발생하면 설치에는
`npm.cmd install -g pnpm@10`, 실행에는 `pnpm.cmd dev`를 사용합니다.

웹 브라우저로 바로 실행하려면 `pnpm dev --web`을 사용합니다.

안드로이드로 바로 실행하려면 아래 명령어를 사용합니다.

```bash
npm run android
```

Expo 캐시가 꼬였거나 이전 에러가 계속 보이면 캐시를 비우고 다시 실행합니다.

```bash
npx expo start --clear
```

## 설치 주의사항

이 프로젝트는 `package-lock.json`을 사용하는 npm 기준 프로젝트입니다.

의존성을 설치할 때는 `pnpm install` 대신 아래 명령어를 사용합니다.

```bash
npm install
```
