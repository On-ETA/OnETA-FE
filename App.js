import React from "react";
import { NavigationContainer, useIsFocused } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BackHandler, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  AccountInfoScreen,
  ChangePasswordScreen,
  CustomAlarmScreen,
  FaqsScreen,
  FindEmailPasswordScreen,
  HomeScreen,
  InquiryScreen,
  LoginScreen,
  NoticeDetailScreen,
  NoticesScreen,
  NotificationsScreen,
  PrivacyPolicyScreen,
  SignupCompleteScreen,
  SignupScreen,
  TermsAgreementScreen,
  TermsOfServiceScreen,
} from "./src/screens";
import { linking } from "./linking";
import { routes } from "./src/navigation/routes";
import {
  extractAuthTokens,
  getAccessToken,
  hydrateAuthTokens,
  setAuthTokens,
} from "./src/api/auth/tokens";
import { blurActiveElement } from "./src/utils/accessibility";
import { clearHomeCacheAsync } from "./src/api/homeCache";
import { cancelHomePreload, preloadHomeCache } from "./src/api/homePreload";
import { subscribeAuthRequired } from "./src/api/auth/authEvents";
import { reissueAuthTokens } from "./src/api/auth/reissue";
import { exchangeGoogleAuthCode } from "./src/api/google";
import { PushNotifications } from "./src/notifications/PushNotifications";
import { notificationNavigationRef, flushNotificationNavigation } from "./src/notifications/navigation";

const Stack = createNativeStackNavigator();
const scrollbarStyleId = "oneta-thin-scrollbar";

function GlobalScrollbarStyle() {
  React.useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return undefined;
    }

    if (document.getElementById(scrollbarStyleId)) {
      return undefined;
    }

    const style = document.createElement("style");

    style.id = scrollbarStyleId;
    style.textContent = `
      * {
        scrollbar-width: thin;
        scrollbar-color: #B9C8D0 transparent;
      }

      *::-webkit-scrollbar {
        width: 4px;
        height: 4px;
      }

      *::-webkit-scrollbar-thumb {
        background-color: #B9C8D0;
        border-radius: 999px;
      }

      *::-webkit-scrollbar-track {
        background: transparent;
      }
    `;

    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  return null;
}

function resetTo(navigation, name, params) {
  blurActiveElement();
  navigation.reset({
    index: 0,
    routes: [{ name, params }],
  });
}

function goBackOrReset(navigation, fallbackRoute = routes.home, params) {
  blurActiveElement();

  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }

  resetTo(navigation, fallbackRoute, params);
}

function navigateTo(navigation, name, params) {
  blurActiveElement();
  navigation.navigate(name, params);
}

function useAndroidBackBehavior() {
  React.useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        const navigation = notificationNavigationRef;

        if (!navigation.isReady()) {
          return false;
        }

        const currentRouteName = navigation.getCurrentRoute()?.name;

        if (currentRouteName === routes.home) {
          return false;
        }

        if (navigation.canGoBack()) {
          blurActiveElement();
          navigation.goBack();
          return true;
        }

        if (getAccessToken()) {
          blurActiveElement();
          navigation.reset({
            index: 0,
            routes: [{ name: routes.home }],
          });
          return true;
        }

        return false;
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);
}

function createHomeScreenNavigationProps(navigation) {
  return {
    onOpenAccountInfo: () => navigateTo(navigation, routes.accountInfo),
    onOpenContact: () => navigateTo(navigation, routes.inquiry),
    onOpenFaqs: () => navigateTo(navigation, routes.faqs),
    onOpenNotices: () => navigateTo(navigation, routes.notices),
    onOpenNotifications: () => navigateTo(navigation, routes.notifications),
    onOpenPassword: () => navigateTo(navigation, routes.changePassword),
    onOpenPrivacy: () => navigateTo(navigation, routes.privacyPolicy),
    onOpenTerms: () => navigateTo(navigation, routes.termsOfService),
    onLogoutComplete: () => resetTo(navigation, routes.login),
    onWithdrawComplete: () => resetTo(navigation, routes.login),
    onTabPress: (tabKey) => {
      if (tabKey === "home") {
        navigateTo(navigation, routes.home);
        return true;
      }

      if (tabKey === "myPage") {
        navigateTo(navigation, routes.myPage);
        return true;
      }

      return false;
    },
  };
}

function useAuthenticatedRoute(navigation, route) {
  const accessToken = route?.params?.accessToken;
  const refreshToken = route?.params?.refreshToken;
  const [isReady, setIsReady] = React.useState(false);
  const didPreloadRef = React.useRef(false);

  React.useEffect(() => {
    let isActive = true;

    async function prepareAuthenticatedRoute() {
      try {
        if (accessToken) {
          await cancelHomePreload();
          await clearHomeCacheAsync();
          await setAuthTokens({ accessToken, refreshToken }, { persist: true });

          if (!didPreloadRef.current) {
            didPreloadRef.current = true;
            preloadHomeCache().catch(() => null);
          }

          if (isActive) {
            setIsReady(true);
          }
          return;
        }

        if (getAccessToken()) {
          if (!didPreloadRef.current) {
            didPreloadRef.current = true;
            preloadHomeCache().catch(() => null);
          }

          if (isActive) {
            setIsReady(true);
          }
          return;
        }

        resetTo(navigation, routes.login);
      } catch (error) {
        if (!isActive || error?.name === "AbortError") {
          return;
        }

        resetTo(navigation, routes.login);
      }
    }

    const unsubscribeAuthRequired = subscribeAuthRequired(() => {
      resetTo(navigation, routes.login);
    });

    prepareAuthenticatedRoute();

    return () => {
      isActive = false;
      unsubscribeAuthRequired();
    };
  }, [accessToken, refreshToken, navigation]);

  return isReady;
}

const GOOGLE_CONFLICT_MESSAGE =
  "이미 등록된 이메일입니다. 이메일/비밀번호로 로그인해주세요.";

function getGoogleSignupConflictMessage(params = {}) {
  const status = String(params.status ?? params.statusCode ?? "");
  const code = params.code ?? params.errorCode;
  const message = params.message ?? params.errorMessage;
  const error = params.error ?? params.errorName;
  const hasConflictStatus =
    status === "409" || error === "SC_CONFLICT" || (!status && !error);

  if (code === "C002" && hasConflictStatus) {
    return message || GOOGLE_CONFLICT_MESSAGE;
  }

  return "";
}

function LoginRoute({ navigation, route }) {
  return (
    <LoginScreen
      initialEmail={route.params?.email}
      initialError={route.params?.loginError}
      initialPassword={route.params?.password}
      initialRemember={route.params?.remember}
      onFindPasswordPress={() => navigateTo(navigation, routes.findPassword)}
      onLoginPress={() => resetTo(navigation, routes.home)}
      onSignupPress={() => navigateTo(navigation, routes.signup)}
    />
  );
}

function SignupRoute({ navigation }) {
  return (
    <SignupScreen
      onBackPress={() => goBackOrReset(navigation, routes.login)}
      onNextPress={({ email, password, signupTokens, tempId }) =>
        navigateTo(navigation, routes.termsAgreement, {
          email,
          password,
          signupTokens,
          tempId,
        })
      }
    />
  );
}

function TermsAgreementRoute({ navigation, route }) {
  const googleConflictMessage = getGoogleSignupConflictMessage(route.params);
  const tempId = route.params?.tempId;
  const signupTokens =
    route.params?.signupTokens ??
    (route.params?.accessToken
      ? {
          accessToken: route.params.accessToken,
          refreshToken: route.params.refreshToken,
        }
      : undefined);

  React.useEffect(() => {
    if (!googleConflictMessage) {
      return;
    }

    resetTo(navigation, routes.login, {
      loginError: googleConflictMessage,
    });
  }, [googleConflictMessage, navigation]);

  if (googleConflictMessage) {
    return null;
  }

  return (
    <TermsAgreementScreen
      onBackPress={() => goBackOrReset(navigation, routes.signup)}
      onConfirmPress={(response) => {
        const consentTokens = extractAuthTokens(response);

        resetTo(navigation, routes.signupComplete, {
          email: route.params?.email,
          password: route.params?.password,
          signupTokens: consentTokens.accessToken ? consentTokens : signupTokens,
        });
      }}
      signupTokens={signupTokens}
      tempId={tempId}
    />
  );
}

function SignupCompleteRoute({ navigation, route }) {
  return (
    <SignupCompleteScreen
      onLoginPress={() => {
        if (route.params?.signupTokens?.accessToken) {
          resetTo(navigation, routes.home, route.params.signupTokens);
          return;
        }

        resetTo(navigation, routes.login, {
          email: route.params?.email,
          password: route.params?.password,
          remember: true,
        });
      }}
    />
  );
}

function HomeRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);
  const isFocused = useIsFocused();
  const homeScreenNavigationProps = React.useMemo(
    () => createHomeScreenNavigationProps(navigation),
    [navigation],
  );

  if (!isReady) {
    return null;
  }

  return (
    <HomeScreen
      backHandlingEnabled={isFocused}
      initialTab={route.params?.initialTab ?? "home"}
      {...homeScreenNavigationProps}
    />
  );
}

function OAuthCallbackRoute({ navigation, route }) {
  const handledRef = React.useRef(false);

  React.useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const params = route.params ?? {};

    async function finishGoogleAuth() {
      const callbackError =
        params.error_description ??
        params.errorMessage ??
        params.oauth2_auth_error ??
        (params.error ? "Google 인증이 취소되었거나 실패했습니다." : null) ??
        getGoogleSignupConflictMessage(params);

      if (callbackError) {
        resetTo(navigation, routes.login, { loginError: callbackError });
        return;
      }

      if (!params.code) {
        resetTo(navigation, routes.login, {
          loginError: "Google 로그인 응답을 확인할 수 없습니다. 다시 시도해 주세요.",
        });
        return;
      }

      try {
        const response = await exchangeGoogleAuthCode({ code: params.code });

        const data = response?.data ?? {};
        if (data.tempId !== undefined && data.tempId !== null) {
          resetTo(navigation, routes.termsAgreement, {
            tempId: data.tempId,
            signupTokens: data.signupTokens,
          });
          return;
        }

        const authTokens = extractAuthTokens(response);
        if (!authTokens.accessToken || !authTokens.refreshToken) {
          throw new Error("Google 로그인 응답에 인증 정보가 없습니다.");
        }

        await setAuthTokens(authTokens, { persist: true });
        resetTo(navigation, routes.home);
      } catch (error) {
        resetTo(navigation, routes.login, {
          loginError: error?.message || "Google 로그인에 실패했습니다. 다시 시도해 주세요.",
        });
      }
    }

    finishGoogleAuth();

  }, [navigation, route.params]);

  return null;
}

function CustomAlarmRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);

  if (!isReady) {
    return null;
  }

  return (
    <CustomAlarmScreen />
  );
}

function MyPageRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);
  const isFocused = useIsFocused();
  const homeScreenNavigationProps = React.useMemo(
    () => createHomeScreenNavigationProps(navigation),
    [navigation],
  );

  if (!isReady) {
    return null;
  }

  return (
    <HomeScreen
      backHandlingEnabled={isFocused}
      initialTab="myPage"
      {...homeScreenNavigationProps}
    />
  );
}

function InquiryRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);

  if (!isReady) {
    return null;
  }

  return (
    <InquiryScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
    />
  );
}

function NoticesRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);

  if (!isReady) {
    return null;
  }

  return (
    <NoticesScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
      onNoticePress={(notice) =>
        navigateTo(navigation, routes.noticeDetail, { notice })
      }
    />
  );
}

function FaqsRoute({ navigation }) {
  return (
    <FaqsScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
    />
  );
}

function NoticeDetailRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);

  if (!isReady) {
    return null;
  }

  return (
    <NoticeDetailScreen
      notice={route.params?.notice}
      onBackPress={() => goBackOrReset(navigation, routes.notices)}
    />
  );
}

function PrivacyPolicyRoute({ navigation }) {
  return (
    <PrivacyPolicyScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
    />
  );
}

function TermsOfServiceRoute({ navigation }) {
  return (
    <TermsOfServiceScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
    />
  );
}

function NotificationsRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);

  if (!isReady) {
    return null;
  }

  return (
    <NotificationsScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
    />
  );
}

function AccountInfoRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);

  if (!isReady) {
    return null;
  }

  return (
    <AccountInfoScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
      onConfirmPress={() => resetTo(navigation, routes.myPage)}
    />
  );
}

function ChangePasswordRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);

  if (!isReady) {
    return null;
  }

  return (
    <ChangePasswordScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
      onConfirmPress={() => goBackOrReset(navigation, routes.myPage)}
    />
  );
}

function FindPasswordRoute({ navigation }) {
  return (
    <FindEmailPasswordScreen
      onBackPress={() => goBackOrReset(navigation, routes.login)}
      onConfirmPress={({ authenticated, email, password, remember }) => {
        if (authenticated) {
          resetTo(navigation, routes.home);
          return;
        }

        resetTo(navigation, routes.login, { email, password, remember });
      }}
    />
  );
}

export default function App() {
  const [isAuthHydrated, setIsAuthHydrated] = React.useState(false);
  const [initialRouteName, setInitialRouteName] = React.useState(routes.login);

  useAndroidBackBehavior();

  React.useEffect(() => {
    let isActive = true;

    hydrateAuthTokens()
      .then(async ({ accessToken, refreshToken }) => {
        if (!accessToken && !refreshToken) {
          return null;
        }

        if (!accessToken && refreshToken) {
          try {
            await reissueAuthTokens({ refreshToken });
            return getAccessToken();
          } catch {
            return null;
          }
        }

        return accessToken;
      })
      .then((accessToken) => {
        if (!isActive) {
          return;
        }

        setInitialRouteName(accessToken ? routes.home : routes.login);
      })
      .catch(() => {
        if (isActive) {
          setInitialRouteName(routes.login);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsAuthHydrated(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (!isAuthHydrated) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GlobalScrollbarStyle />
      <NavigationContainer
        linking={linking}
        ref={notificationNavigationRef}
        onReady={flushNotificationNavigation}
        onStateChange={flushNotificationNavigation}
      >
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen component={LoginRoute} name={routes.login} />
          <Stack.Screen component={OAuthCallbackRoute} name={routes.oauthCallback} />
          <Stack.Screen component={SignupRoute} name={routes.signup} />
          <Stack.Screen
            component={TermsAgreementRoute}
            name={routes.termsAgreement}
          />
          <Stack.Screen
            component={SignupCompleteRoute}
            name={routes.signupComplete}
          />
          <Stack.Screen component={HomeRoute} name={routes.home} />
          <Stack.Screen component={CustomAlarmRoute} name={routes.customAlarm} />
          <Stack.Screen component={MyPageRoute} name={routes.myPage} />
          <Stack.Screen component={InquiryRoute} name={routes.inquiry} />
          <Stack.Screen component={NoticesRoute} name={routes.notices} />
          <Stack.Screen component={FaqsRoute} name={routes.faqs} />
          <Stack.Screen
            component={NoticeDetailRoute}
            name={routes.noticeDetail}
          />
          <Stack.Screen
            component={PrivacyPolicyRoute}
            name={routes.privacyPolicy}
          />
          <Stack.Screen
            component={TermsOfServiceRoute}
            name={routes.termsOfService}
          />
          <Stack.Screen
            component={NotificationsRoute}
            name={routes.notifications}
          />
          <Stack.Screen component={AccountInfoRoute} name={routes.accountInfo} />
          <Stack.Screen
            component={ChangePasswordRoute}
            name={routes.changePassword}
          />
          <Stack.Screen component={FindPasswordRoute} name={routes.findPassword} />
        </Stack.Navigator>
      </NavigationContainer>
      <PushNotifications />
    </SafeAreaProvider>
  );
}
