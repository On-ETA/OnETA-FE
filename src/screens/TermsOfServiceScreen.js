import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen, Header } from "../components";
import { colors } from "../theme";

const TERMS_OF_SERVICE_TEXT = `제1조 (목적)
본 약관은 StageMate에서 제공하는 연극·뮤지컬 커뮤니티 서비스의 이용 조건 및 회원과 운영자의 권리·의무를 규정함을 목적으로 합니다.

제2조 (회원의 권리와 의무)
1. 이용자는 다음 행위를 해서는 안 됩니다.
공연 관련 허위 정보 게시, 반복적 도배, 타인 비방
상업성 광고, 외설 또는 혐오 콘텐츠 업로드
저작권을 침해하는 영상·이미지 게시
비공개 공연 정보 유출 등 불법적 행위
2. 위반 시 조치
운영자는 게시물 삭제, 경고, 일정 기간 이용 제한, 영구 탈퇴 등의 조치를 취할 수 있습니다.

제3조 (저작권 및 게시물 이용)
작성자는 게시물에 대한 저작권을 가지며, StageMate는 해당 콘텐츠를 서비스 운영·홍보 목적으로 사용할 수 있습니다.
단, 사전 동의 없이 외부 플랫폼에 배포하거나 판매하지 않습니다.

제4조 (회원 탈퇴 및 자격 정지)
회원은 언제든지 탈퇴를 요청할 수 있으며, StageMate는 7일 이내 처리합니다.
다음의 경우 운영자는 사전 통지 후 회원 자격을 제한하거나 해지할 수 있습니다:
명백한 약관 위반, 반복적인 비방 행위, 저작권 침해, 사칭 등`;

export function TermsOfServiceScreen({ onBackPress }) {
  return (
    <AppScreen>
      <View style={styles.container}>
        <Header type="back" title="이용약관" onBackPress={onBackPress} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          <Text style={styles.body}>{TERMS_OF_SERVICE_TEXT}</Text>
        </ScrollView>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingTop: 24,
    paddingRight: 16,
    paddingBottom: 40,
    paddingLeft: 16,
  },
  body: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    color: colors.gray08,
  },
});
