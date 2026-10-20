import { routes } from "./src/navigation/routes";
import { getStateFromPath } from "@react-navigation/native";

export const linking = {
  prefixes: ["oneta://", "exp+oneta://"],
  config: {
    screens: {
      [routes.welcome]: "welcome",
      [routes.login]: "login",
      [routes.oauthCallback]: "oauth/callback",
      [routes.signup]: "signup",
      [routes.termsAgreement]: "signup/consent",
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
      [routes.privacyPolicy]: "privacy",
      [routes.termsOfService]: "home/mypage/terms",
    },
  },
};

export function getPublicRouteFromPath(path) {
  const pathname = path.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "");
  return pathname === "privacy" || pathname === "home/mypage/privacy"
    ? routes.privacyPolicy
    : null;
}

export function createAppLinking(initialRouteName) {
  return {
    ...linking,
    getStateFromPath(path, options) {
      const publicRoute = getPublicRouteFromPath(path);
      if (publicRoute) {
        return { routes: [{ name: publicRoute }] };
      }
      const pathname = path.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "");
      if (!pathname || (pathname === "welcome" && initialRouteName !== routes.welcome)) {
        return { routes: [{ name: initialRouteName }] };
      }
      return getStateFromPath(path, options);
    },
  };
}
