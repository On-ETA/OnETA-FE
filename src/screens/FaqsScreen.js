import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getFaqs } from "../api/mypage/faq";
import { AppScreen, Header } from "../components";
import { colors, typography } from "../theme";

export function FaqsScreen({ faqs, onBackPress }) {
  const [faqItems, setFaqItems] = useState(faqs ?? []);
  const [expandedId, setExpandedId] = useState(null);
  const [isLoading, setIsLoading] = useState(!faqs);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    if (faqs) {
      setFaqItems(faqs);
      setIsLoading(false);
      setErrorMessage("");
      return () => {
        isActive = false;
      };
    }

    async function loadFaqs() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const data = await getFaqs();

        if (isActive) {
          setFaqItems(data);
        }
      } catch (error) {
        if (isActive) {
          setFaqItems([]);
          setErrorMessage(error?.message ?? "FAQ 목록을 불러오지 못했습니다.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadFaqs();

    return () => {
      isActive = false;
    };
  }, [faqs]);

  return (
    <AppScreen>
      <View style={styles.container}>
        <Header type="back" title="FAQ" onBackPress={onBackPress} />

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <StatusBox text="FAQ 목록을 불러오는 중입니다." />
          ) : errorMessage ? (
            <StatusBox text={errorMessage} />
          ) : faqItems.length === 0 ? (
            <StatusBox text="등록된 FAQ가 없습니다." />
          ) : (
            faqItems.map((faq) => {
              const faqKey = faq.id ?? faq.question;
              const expanded = expandedId === faqKey;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={faqKey}
                  onPress={() => setExpandedId(expanded ? null : faqKey)}
                  style={styles.card}
                >
                  <View style={styles.questionRow}>
                    <Text style={styles.questionPrefix}>Q</Text>
                    <Text style={styles.questionText}>{faq.question}</Text>
                  </View>
                  {expanded ? (
                    <View style={styles.answerRow}>
                      <Text style={styles.answerPrefix}>A</Text>
                      <Text style={styles.answerText}>{faq.answer}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function StatusBox({ text }) {
  return (
    <View style={styles.statusBox}>
      <Text style={styles.statusText}>{text}</Text>
    </View>
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
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    alignSelf: "stretch",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray03,
    backgroundColor: "#FCFDFE",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  questionPrefix: {
    ...typography.body02M,
    color: colors.main,
  },
  questionText: {
    flex: 1,
    ...typography.body02M,
    color: colors.gray09,
  },
  answerRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.gray03,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  answerPrefix: {
    ...typography.body02M,
    color: colors.gray07,
  },
  answerText: {
    flex: 1,
    ...typography.body03M,
    color: colors.gray08,
  },
  statusBox: {
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray03,
    backgroundColor: colors.gray02,
  },
  statusText: {
    ...typography.body03M,
    color: colors.gray06,
  },
});
