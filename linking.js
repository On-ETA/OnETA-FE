import { routes } from "./src/navigation/routes";

export const linking = {
  prefixes: [],
  config: {
    screens: {
      [routes.login]: "",
      [routes.signup]: "signup",
      [routes.termsAgreement]: "signup/terms",
      [routes.signupComplete]: "signup/complete",
      [routes.findPassword]: "find-password",
      [routes.home]: "home",
      [routes.customAlarm]: "home/custom-alarm",
      [routes.myPage]: "home/mypage",
      [routes.accountInfo]: "home/mypage/account-info",
      [routes.changePassword]: "home/mypage/change-password",
      [routes.inquiry]: "home/mypage/inquiry",
      [routes.notices]: "home/mypage/notices",
      [routes.noticeDetail]: "home/mypage/notices/detail",
      [routes.faqs]: "home/mypage/faqs",
      [routes.notifications]: "home/mypage/notifications",
      [routes.privacyPolicy]: "home/mypage/privacy",
      [routes.termsOfService]: "home/mypage/terms",
    },
  },
};
