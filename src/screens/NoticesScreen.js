import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getNotices } from "../api/mypage/notice";
import { AppScreen, Header } from "../components";
import { colors } from "../theme";

export const DEFAULT_NOTICE_ITEMS = [];

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
  const [isLoading, setIsLoading] = useState(!notices);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    if (notices) {
      setNoticeItems(notices);
      setIsLoading(false);
      setErrorMessage("");
      return () => {
        isActive = false;
      };
    }

    async function loadNotices() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const data = await getNotices();

        if (isActive) {
          setNoticeItems(data);
        }
      } catch (error) {
        if (isActive) {
          setNoticeItems(DEFAULT_NOTICE_ITEMS);
          setErrorMessage(
            error?.message ?? "공지사항 목록을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
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
          {isLoading ? (
            <Text style={styles.stateText}>공지사항을 불러오는 중입니다.</Text>
          ) : errorMessage ? (
            <Text style={styles.stateText}>{errorMessage}</Text>
          ) : noticeItems.length === 0 ? (
            <Text style={styles.stateText}>등록된 공지사항이 없습니다.</Text>
          ) : (
            noticeItems.map((notice) => (
              <Pressable
                accessibilityRole="button"
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
            ))
          )}
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
  stateText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: -0.14,
    color: colors.gray06,
    textAlign: "center",
  },
});
