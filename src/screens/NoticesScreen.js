import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getNotices } from "../api/mypage/notice";
import { AppScreen, Header } from "../components";
import { colors } from "../theme";

export const DEFAULT_NOTICE_ITEMS = [
  {
    id: "notice-2026-04-08-maintenance",
    title: "Oneta 서비스 점검 및 기능 개선 안내",
    dateText: "26.04.08",
    viewCount: 45,
    author: "온에타운영진",
    content: `안녕하세요, Oneta입니다.
보다 안정적인 서비스 제공과 커뮤니티 환경 개선을 위해
아래와 같이 점검을 진행할 예정입니다.
회원 여러분의 너른 양해 부탁드리며, 아래 점검 시간 동안
일부 기능 이용이 제한될 수 있습니다.

🔧 점검 안내
점검 일시: 2025년 7월 31일(목) 오전 4시 ~ 오전 7시
영향 범위: 전체 서비스

🛠 주요 점검 내용
.

📝 유의사항
점검 시간 중 서비스 접속이 일시 중단될 수 있습니다.
앱 사용자는 최신 버전으로 업데이트를 권장드립니다.
이용 중 불편하셨던 사항은 [문의하기] 메뉴를 통해 접수해 주세요.
더 나은 공연 커뮤니티 경험을 위해 앞으로도 Oneta은 꾸준히 개선해 나가겠습니다.

이용해 주셔서 감사합니다.`,
  },
  {
    id: "notice-2026-04-08-update-01",
    title: "어쩌구 버전 업데이트 공지",
    dateText: "26.04.08",
    viewCount: 45,
    author: "온에타운영진",
    content: "업데이트 관련 공지 본문 예시입니다.",
  },
  {
    id: "notice-2026-04-08-update-02",
    title: "어쩌구 버전 업데이트 공지",
    dateText: "26.04.08",
    viewCount: 45,
    author: "온에타운영진",
    content: "업데이트 관련 공지 본문 예시입니다.",
  },
  {
    id: "notice-2026-04-08-update-03",
    title: "어쩌구 버전 업데이트 공지",
    dateText: "26.04.08",
    viewCount: 45,
    author: "온에타운영진",
    content: "업데이트 관련 공지 본문 예시입니다.",
  },
];

/**
 * 공지사항 목록 페이지
 * - notices: API 응답을 화면 모델로 변환해 주입할 수 있도록 분리
 * - onNoticePress: 공지 클릭 시 상세 페이지 라우팅에 사용
 */
export function NoticesScreen({
  notices,
  onBackPress,
  onNoticePress,
}) {
  const [noticeItems, setNoticeItems] = useState(
    notices ?? DEFAULT_NOTICE_ITEMS,
  );

  useEffect(() => {
    let isActive = true;

    if (notices) {
      setNoticeItems(notices);
      return () => {
        isActive = false;
      };
    }

    async function loadNotices() {
      try {
        const data = await getNotices();

        if (isActive) {
          setNoticeItems(data);
        }
      } catch {
        if (isActive) {
          setNoticeItems(DEFAULT_NOTICE_ITEMS);
        }
      }
    }

    loadNotices();

    return () => {
      isActive = false;
    };
  }, [notices]);

  return (
    <AppScreen>
      <View style={styles.container}>
        <Header type="back" title="공지사항" onBackPress={onBackPress} />

        <View style={styles.list}>
          {noticeItems.map((notice) => (
            <Pressable
              key={notice.id}
              onPress={() => onNoticePress?.(notice)}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{notice.title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{notice.dateText}</Text>
                <Text style={styles.metaDivider}>|</Text>
                <Text style={styles.metaText}>조회수 {notice.viewCount}</Text>
                <Text style={styles.metaDivider}>|</Text>
                <Text style={styles.metaText}>{notice.author}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  list: {
    paddingHorizontal: 18,
    paddingTop: 24,
    gap: 12,
  },
  card: {
    alignSelf: "stretch",
    alignItems: "flex-start",
    justifyContent: "center",
    rowGap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray03,
    backgroundColor: "#FCFDFE",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardTitle: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
    color: colors.gray08,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    color: colors.gray06,
    textAlign: "center",
  },
  metaDivider: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    color: colors.gray06,
    textAlign: "center",
  },
});
