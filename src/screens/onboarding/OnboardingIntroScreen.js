import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import RoutePreview from "./온보딩_1.svg";
import DeparturePreview from "./온보딩_2.svg";
import SchedulePreview from "./온보딩_3.svg";
import { ScreenTransition } from "../../components/ScreenTransition";
import { useAndroidBackPress } from "../../hooks/useAndroidBackPress";
import { colors, layout } from "../../theme";

const pages = [
  {
    title: "첫차 막차 걱정 마세요",
    description: "첫차부터 막차까지, 필요한 시간에\n경로 맞춤 알림을 받아요",
    previewLabel: "첫막차 알림 미리보기. 남은 시간, 출발 예정 시간과 승하차 정류장을 확인하고 출발 전에 알림을 받아요.",
    Preview: RoutePreview,
  },
  {
    title: "버스 출발 시 알려드려요",
    description: "자주 타는 버스가 차고지를 출발하면\n바로 1회 알림을 받아요",
    previewLabel: "차고지 출발 알림 미리보기. 자주 타는 147번 버스의 출발 알림을 설정하고 차고지 출발 시 1회 알림을 받아요.",
    Preview: DeparturePreview,
  },
  {
    title: "늦을까 시계 확인은 그만",
    description: "반복되는 나만의 일정을 등록하면\n출발 적정 시간에 알림을 받아요",
    previewLabel: "내 일정 알림 미리보기. 반복되는 등교와 알바 일정을 등록하고 도착 예정 시간에 맞춰 출발 알림을 설정해요.",
    Preview: SchedulePreview,
    buttonLabel: "온에타 시작하기",
  },
];

export function OnboardingIntroScreen({ step = 0, onNextPress, onBackPress }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const page = pages[step];
  const Preview = page.Preview;

  useAndroidBackPress(() => {
    onBackPress?.();
    return true;
  }, step > 0);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" backgroundColor={colors.white} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.phone}>
        <ScreenTransition transitionKey={step} transitionDepth={step} duration={234}>
          <ScrollView
            key={step}
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { minHeight: height - insets.top - insets.bottom }]}
          >
            <View style={[styles.heading, { paddingTop: Math.min(88, Math.max(32, height * 0.105 - insets.top)) }]}>
              <View style={styles.progress} accessible accessibilityLabel={`온보딩 3단계 중 ${step + 1}단계`}>
                {[0, 1, 2].map(index => <View key={index} style={[styles.dot, index === step && styles.activeDot]} />)}
              </View>
              <Text style={styles.title} accessibilityRole="header">{page.title}</Text>
              <Text style={styles.description}>{page.description}</Text>
            </View>
            <View style={styles.preview} accessible accessibilityRole="image" accessibilityLabel={page.previewLabel}>
              <Preview width="100%" height="100%" preserveAspectRatio="xMidYMin meet" accessible={false} />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onNextPress}
              style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
            >
              <Text style={styles.nextText}>{page.buttonLabel ?? "다음"}</Text>
            </Pressable>
          </ScrollView>
        </ScreenTransition>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.gray03 },
  phone: {
    flex: 1, width: "100%", backgroundColor: colors.white,
    ...Platform.select({ web: { alignSelf: "center", maxWidth: layout.mobileFrameWidth } }),
  },
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: 16, paddingBottom: 42 },
  heading: { alignItems: "center", width: "100%" },
  progress: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 30 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gray05 },
  activeDot: { width: 18, backgroundColor: colors.main },
  title: { fontFamily: "SUIT", fontSize: 24, fontWeight: "700", lineHeight: 34, letterSpacing: -0.6, color: colors.main, textAlign: "center" },
  description: { fontFamily: "SUIT", marginTop: 10, fontSize: 14, fontWeight: "600", lineHeight: 21, color: colors.gray08, textAlign: "center" },
  preview: { flex: 1, width: "100%", minHeight: 240, maxHeight: 440, marginTop: 36 },
  nextButton: { width: "100%", height: 56, borderRadius: 9, backgroundColor: colors.main, alignItems: "center", justifyContent: "center", marginTop: 16 },
  pressed: { opacity: 0.8 },
  nextText: { fontFamily: "SUIT", fontSize: 18, fontWeight: "600", color: colors.white },
});
