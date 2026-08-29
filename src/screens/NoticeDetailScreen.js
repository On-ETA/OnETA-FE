import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { getNoticeById } from "../api/mypage/id";
import { AppScreen, Header } from "../components";
import { colors } from "../theme";
import { DEFAULT_NOTICE_ITEMS } from "./NoticesScreen";

const FALLBACK_NOTICE = DEFAULT_NOTICE_ITEMS[0];

/**
 * 공지 상세 페이지
 * - notice: 목록에서 선택된 공지 객체
 * - 본문 렌더링은 서버에서 내려주는 markdown/html 포맷으로 교체 가능
 */
export function NoticeDetailScreen({ notice = FALLBACK_NOTICE, onBackPress }) {
  const [noticeDetail, setNoticeDetail] = useState(notice ?? FALLBACK_NOTICE);

  useEffect(() => {
    let isActive = true;

    if (!notice?.id) {
      setNoticeDetail(FALLBACK_NOTICE);
      return () => {
        isActive = false;
      };
    }

    setNoticeDetail(notice);

    async function loadNoticeDetail() {
      try {
        const data = await getNoticeById({ id: notice.id });

        if (isActive) {
          setNoticeDetail(data);
        }
      } catch {
        if (isActive) {
          setNoticeDetail(notice);
        }
      }
    }

    loadNoticeDetail();

    return () => {
      isActive = false;
    };
  }, [notice]);

  return (
    <AppScreen>
      <View style={styles.container}>
        <Header type="back" title="공지사항" onBackPress={onBackPress} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{noticeDetail.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{noticeDetail.dateText}</Text>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={styles.metaText}>조회수 {noticeDetail.viewCount}</Text>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={styles.metaText}>{noticeDetail.author}</Text>
          </View>

          <Text style={styles.body}>{noticeDetail.content}</Text>
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
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
    color: colors.gray08,
  },
  metaRow: {
    marginTop: 8,
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
  body: {
    marginTop: 28,
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    color: colors.gray08,
  },
});
