import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  AccountInfoScreen,
  ChangePasswordScreen,
  CustomAlarmScreen,
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

const Stack = createNativeStackNavigator();

function resetTo(navigation, name, params) {
  navigation.reset({
    index: 0,
    routes: [{ name, params }],
  });
}

function goBackOrReset(navigation, fallbackRoute = routes.home, params) {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }

  resetTo(navigation, fallbackRoute, params);
}

function LoginRoute({ navigation }) {
  return (
    <LoginScreen
      onFindPasswordPress={() => navigation.navigate(routes.findPassword)}
      onLoginPress={() => resetTo(navigation, routes.home)}
      onSignupPress={() => navigation.navigate(routes.signup)}
    />
  );
}

function SignupRoute({ navigation }) {
  return (
    <SignupScreen
      onBackPress={() => goBackOrReset(navigation, routes.login)}
      onNextPress={({ signupTokens }) =>
        navigation.navigate(routes.termsAgreement, { signupTokens })
      }
    />
  );
}

function TermsAgreementRoute({ navigation, route }) {
  return (
    <TermsAgreementScreen
      onBackPress={() => goBackOrReset(navigation, routes.signup)}
      onConfirmPress={() => resetTo(navigation, routes.home)}
      signupTokens={route.params?.signupTokens}
    />
  );
}

function SignupCompleteRoute({ navigation }) {
  return (
    <SignupCompleteScreen
      onHomePress={() => resetTo(navigation, routes.home)}
      onLoginPress={() => resetTo(navigation, routes.login)}
    />
  );
}

function HomeRoute({ navigation, route }) {
  return (
    <HomeScreen
      initialTab={route.params?.initialTab ?? "home"}
      onOpenAccountInfo={() => navigation.navigate(routes.accountInfo)}
      onOpenContact={() => navigation.navigate(routes.inquiry)}
      onOpenNotices={() => navigation.navigate(routes.notices)}
      onOpenNotifications={() => navigation.navigate(routes.notifications)}
      onOpenPassword={() => navigation.navigate(routes.changePassword)}
      onOpenPrivacy={() => navigation.navigate(routes.privacyPolicy)}
      onOpenTerms={() => navigation.navigate(routes.termsOfService)}
      onWithdrawComplete={() => resetTo(navigation, routes.login)}
      onTabPress={(tabKey) => {
        if (tabKey === "home") {
          navigation.navigate(routes.home);
          return true;
        }

        if (tabKey === "myPage") {
          navigation.navigate(routes.myPage);
          return true;
        }

        return false;
      }}
    />
  );
}

function CustomAlarmRoute({ navigation }) {
  return (
    <CustomAlarmScreen />
  );
}

function MyPageRoute({ navigation }) {
  return (
    <HomeScreen
      initialTab="myPage"
      onOpenAccountInfo={() => navigation.navigate(routes.accountInfo)}
      onOpenContact={() => navigation.navigate(routes.inquiry)}
      onOpenNotices={() => navigation.navigate(routes.notices)}
      onOpenNotifications={() => navigation.navigate(routes.notifications)}
      onOpenPassword={() => navigation.navigate(routes.changePassword)}
      onOpenPrivacy={() => navigation.navigate(routes.privacyPolicy)}
      onOpenTerms={() => navigation.navigate(routes.termsOfService)}
      onWithdrawComplete={() => resetTo(navigation, routes.login)}
      onTabPress={(tabKey) => {
        if (tabKey === "home") {
          navigation.navigate(routes.home);
          return true;
        }

        if (tabKey === "myPage") {
          navigation.navigate(routes.myPage);
          return true;
        }

        return false;
      }}
    />
  );
}

function InquiryRoute({ navigation }) {
  return (
    <InquiryScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
    />
  );
}

function NoticesRoute({ navigation }) {
  return (
    <NoticesScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
      onNoticePress={(notice) =>
        navigation.navigate(routes.noticeDetail, { notice })
      }
    />
  );
}

function NoticeDetailRoute({ navigation, route }) {
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

function NotificationsRoute({ navigation }) {
  return (
    <NotificationsScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
    />
  );
}

function AccountInfoRoute({ navigation }) {
  return (
    <AccountInfoScreen
      onBackPress={() => goBackOrReset(navigation, routes.myPage)}
      onConfirmPress={() => resetTo(navigation, routes.myPage)}
    />
  );
}

function ChangePasswordRoute({ navigation }) {
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
      onConfirmPress={() => resetTo(navigation, routes.home)}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
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
    </SafeAreaProvider>
  );
}
