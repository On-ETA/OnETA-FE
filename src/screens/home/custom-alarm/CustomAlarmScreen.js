import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import MemoIcon from "../../../../public/images/memo.svg";
import PlusIcon from "../../../../public/images/plus.svg";
import { colors, typography } from "../../../theme";

const alarmSections = [
  {
    key: "garage",
    title: "차고지 출발 알림",
  },
  {
    key: "schedule",
    title: "내 일정 알림",
    columns: ["경로명", "도착 예정 시간", "알림"],
  },
];

export function CustomAlarmScreen({ onGarageDepartureAddPress }) {
  return (
    <View style={styles.body}>
      {alarmSections.map((section) => (
        <AlarmSection
          key={section.key}
          onAddPress={
            section.key === "garage" ? onGarageDepartureAddPress : undefined
          }
          section={section}
        />
      ))}
    </View>
  );
}

function AlarmSection({ onAddPress, section }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionActions}>
          <Pressable
            accessibilityLabel={`${section.title} 추가`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onAddPress}
            style={styles.iconButton}
          >
            <PlusIcon height={24} width={24} />
          </Pressable>
          <Pressable
            accessibilityLabel={`${section.title} 편집`}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.iconButton}
          >
            <MemoIcon height={24} width={24} />
          </Pressable>
        </View>
      </View>

      {section.columns ? (
        <View style={styles.tableHeader}>
          {section.columns.map((column, index) => (
            <Text
              key={column}
              style={[
                styles.tableHeaderText,
                index === 0 && styles.routeNameColumn,
                index === 1 && styles.arrivalTimeColumn,
                index === 2 && styles.alarmColumn,
              ]}
            >
              {column}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>
          우측 더하기 버튼으로 알림을 추가해보세요
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: "center",
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  section: {
    width: 328,
    maxWidth: "100%",
    marginBottom: 24,
  },
  sectionHeader: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...typography.body01Sb,
    color: colors.gray09,
  },
  sectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tableHeader: {
    height: 24,
    marginTop: 2,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray02,
    borderRadius: 4,
  },
  tableHeaderText: {
    ...typography.caption02M,
    color: colors.gray06,
    textAlign: "center",
  },
  routeNameColumn: {
    flex: 1,
    textAlign: "left",
  },
  arrivalTimeColumn: {
    flex: 1.2,
  },
  alarmColumn: {
    flex: 0.56,
    textAlign: "right",
  },
  emptyBox: {
    height: 58,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray02,
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
  },
  emptyText: {
    ...typography.caption01M,
    color: colors.gray06,
    textAlign: "center",
  },
});
