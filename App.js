import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Alert, Platform } from "react-native";
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
import { getAccessToken, setAuthTokens } from "./src/api/auth/tokens";
import { blurActiveElement } from "./src/utils/accessibility";
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

function useAuthenticatedRoute(navigation, route) {
  const accessToken = route?.params?.accessToken;
  const refreshToken = route?.params?.refreshToken;
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    if (accessToken) {
      setAuthTokens({ accessToken, refreshToken });
      setIsReady(true);
      return;
    }

    if (getAccessToken()) {
      setIsReady(true);
      return;
    }

    resetTo(navigation, routes.login);
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

  if (
    code === "C002" &&
    message === GOOGLE_CONFLICT_MESSAGE &&
    hasConflictStatus
  ) {
    return message;
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
      onNextPress={({ email, password, signupTokens }) =>
        navigateTo(navigation, routes.termsAgreement, {
          email,
          password,
          signupTokens,
        })
      }
    />
  );
}

function TermsAgreementRoute({ navigation, route }) {
  const googleConflictMessage = getGoogleSignupConflictMessage(route.params);
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

    Alert.alert("구글 회원가입", googleConflictMessage, [
      {
        text: "확인",
        onPress: () =>
          resetTo(navigation, routes.login, {
            loginError: googleConflictMessage,
          }),
      },
    ]);
  }, [googleConflictMessage, navigation]);

  if (googleConflictMessage) {
    return null;
  }

  return (
    <TermsAgreementScreen
      onBackPress={() => goBackOrReset(navigation, routes.signup)}
      onConfirmPress={() =>
        resetTo(navigation, routes.signupComplete, {
          email: route.params?.email,
          password: route.params?.password,
        })
      }
      signupTokens={signupTokens}
    />
  );
}

function SignupCompleteRoute({ navigation, route }) {
  return (
    <SignupCompleteScreen
      onLoginPress={() =>
        resetTo(navigation, routes.login, {
          email: route.params?.email,
          password: route.params?.password,
          remember: true,
        })
      }
    />
  );
}

function HomeRoute({ navigation, route }) {
  const isReady = useAuthenticatedRoute(navigation, route);

  if (!isReady) {
    return null;
  }

  return (
    <HomeScreen
      initialTab={route.params?.initialTab ?? "home"}
      onOpenAccountInfo={() => navigateTo(navigation, routes.accountInfo)}
      onOpenContact={() => navigateTo(navigation, routes.inquiry)}
      onOpenFaqs={() => navigateTo(navigation, routes.faqs)}
      onOpenNotices={() => navigateTo(navigation, routes.notices)}
      onOpenNotifications={() => navigateTo(navigation, routes.notifications)}
      onOpenPassword={() => navigateTo(navigation, routes.changePassword)}
      onOpenPrivacy={() => navigateTo(navigation, routes.privacyPolicy)}
      onOpenTerms={() => navigateTo(navigation, routes.termsOfService)}
      onLogoutComplete={() => resetTo(navigation, routes.login)}
      onWithdrawComplete={() => resetTo(navigation, routes.login)}
      onTabPress={(tabKey) => {
        if (tabKey === "home") {
          navigateTo(navigation, routes.home);
          return true;
        }

        if (tabKey === "myPage") {
          navigateTo(navigation, routes.myPage);
          return true;
        }

        return false;
      }}
    />
  );
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

  if (!isReady) {
    return null;
  }

  return (
    <HomeScreen
      initialTab="myPage"
      onOpenAccountInfo={() => navigateTo(navigation, routes.accountInfo)}
      onOpenContact={() => navigateTo(navigation, routes.inquiry)}
      onOpenFaqs={() => navigateTo(navigation, routes.faqs)}
      onOpenNotices={() => navigateTo(navigation, routes.notices)}
      onOpenNotifications={() => navigateTo(navigation, routes.notifications)}
      onOpenPassword={() => navigateTo(navigation, routes.changePassword)}
      onOpenPrivacy={() => navigateTo(navigation, routes.privacyPolicy)}
      onOpenTerms={() => navigateTo(navigation, routes.termsOfService)}
      onLogoutComplete={() => resetTo(navigation, routes.login)}
      onWithdrawComplete={() => resetTo(navigation, routes.login)}
      onTabPress={(tabKey) => {
        if (tabKey === "home") {
          navigateTo(navigation, routes.home);
          return true;
        }

        if (tabKey === "myPage") {
          navigateTo(navigation, routes.myPage);
          return true;
        }

        return false;
      }}
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
          initialRouteName={routes.login}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen component={LoginRoute} name={routes.login} />
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
