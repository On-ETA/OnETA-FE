import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Header } from "../../../components";
import { colors, typography } from "../../../theme";

const days = ["월", "화", "수", "목", "금", "토", "일"];

// TODO: API 연동 시 아래 화면의 더미 경로/알림 데이터를 교체하세요.
// GET /home/custom-alarms/{alarmId}
// PATCH /home/custom-alarms/{alarmId}

export function ScheduleAlarmEditScreen({ alarm, onBackPress, onSavePress }) {
  const [routeName, setRouteName] = useState(alarm?.routeName ?? "출근길");
  const [selectedDays, setSelectedDays] = useState(["화", "목", "금"]);

  const toggleDay = (day) => {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((selectedDay) => selectedDay !== day)
        : [...current, day],
    );
  };

  const handleSave = () => {
    // TODO: PATCH /home/custom-alarms/{alarmId}
    // body: { routeName, selectedDays, reminderMinutes: 10 }
    onSavePress?.();
  };

  return (
    <View style={styles.screen}>
      <Header
        headerStyle={styles.header}
        onBackPress={onBackPress}
        title="알림 편집"
        titleStyle={styles.headerTitle}
        type="back"
      />
      <View style={styles.routeHeader}>
        <View style={styles.busInfo}>
          <BusIcon />
          <Text style={styles.busNumber}>147</Text>
          <Text style={styles.busDirection}>· 강남역 방면</Text>
        </View>
        <View style={styles.totalTime}>
          <Text style={styles.totalTimeNumber}>21</Text>
          <Text style={styles.totalTimeUnit}>분</Text>
        </View>
      </View>

      <View style={styles.timeSection}>
        <View style={styles.timeSummaryRow}>
          <View style={styles.timeSummaryBlock}>
            <Text style={styles.fieldLabel}>출발 적정 시간</Text>
            <View style={styles.timeCard}>
              <Text style={styles.timeCardText}>오전 11 : 09</Text>
            </View>
          </View>
          <ChevronRightIcon />
          <View style={styles.timeSummaryBlock}>
            <Text style={styles.fieldLabel}>도착 예정 시간</Text>
            <View style={styles.timeCard}>
              <Text style={styles.timeCardText}>오전 11 : 30</Text>
            </View>
          </View>
        </View>
        <Pressable accessibilityRole="button" style={styles.resetButton}>
          <Text style={styles.resetButtonText}>경로 및 시간 재설정</Text>
        </Pressable>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>경로 이름</Text>
        <TextInput
          onChangeText={setRouteName}
          placeholder="경로 이름"
          placeholderTextColor={colors.gray06}
          style={styles.nameInput}
          value={routeName}
        />

        <Text style={styles.sectionLabel}>출발 알림</Text>
        <Pressable accessibilityRole="button" style={styles.reminderSelect}>
          <Text style={styles.reminderText}>10분 전 알림</Text>
          <ChevronDownIcon />
        </Pressable>

        <View style={styles.dayRow}>
          {days.map((day) => {
            const selected = selectedDays.includes(day);

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={day}
                onPress={() => toggleDay(day)}
                style={[styles.dayButton, selected && styles.dayButtonSelected]}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    selected && styles.dayButtonTextSelected,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>11시 30분까지 도착하실 수 있도록,</Text>
          <Text style={styles.infoText}>
            출발 적정 시간 10분 전인 10시 59분에 알려드릴게요.
          </Text>
        </View>
        <View style={styles.footerButtons}>
          <Pressable accessibilityRole="button" onPress={onBackPress} style={styles.cancelButton}>
            <Text style={styles.cancelText}>취소</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>저장</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function GarageDepartureAlarmEditScreen({
  alarm,
  onBackPress,
  onChangeBusPress,
  onSavePress,
}) {
  const [selectedDirectionId, setSelectedDirectionId] = useState(
    alarm?.directionId ?? "mangwon",
  );
  const directions = alarm?.directions ?? [
    {
      id: "sinchon",
      title: "신촌역 방면",
      description: "망원유수지 정류장에서 출고 시 1회 알림",
    },
    {
      id: "mangwon",
      title: "망원유수지 방면",
      description: "신촌역 정류장에서 출고 시 1회 알림",
    },
  ];

  const handleSave = () => {
    // TODO: PATCH /home/custom-alarms/{alarmId}
    // body: { directionId: selectedDirectionId }
    onSavePress?.();
  };

  return (
    <View style={styles.screen}>
      <Header
        headerStyle={styles.header}
        onBackPress={onBackPress}
        title="알림 편집"
        titleStyle={styles.headerTitle}
        type="back"
      />

      <View style={styles.garageContent}>
        <View style={styles.garageBusHeader}>
          <View style={styles.garageBusTitleRow}>
            <BusIcon />
            <View>
              <Text style={styles.garageBusName}>147번</Text>
              <Text style={styles.garageBusDescription}>
                배차 간격 15분 · 망원유수지 - 신촌역
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onChangeBusPress}
            style={styles.changeButton}
          >
            <Text style={styles.changeButtonText}>변경</Text>
          </Pressable>
        </View>

        <View style={styles.directionList}>
          {directions.map((direction) => {
            const selected = selectedDirectionId === direction.id;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={direction.id}
                onPress={() => setSelectedDirectionId(direction.id)}
                style={[styles.directionCard, selected && styles.directionCardSelected]}
              >
                <Text style={styles.directionTitle}>{direction.title}</Text>
                <Text style={styles.directionDescription}>{direction.description}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.garageFooter}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>버스가 차고지에서 출발할 때 알려드릴게요.</Text>
          <Text style={styles.infoText}>
            알림은 1회 발송 후 자동으로 꺼지니 필요할 때 다시 켜주세요.
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={handleSave} style={styles.fullSaveButton}>
          <Text style={styles.saveText}>저장</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BusIcon() {
  return (
    <View style={styles.busIconCircle}>
      <Svg height={14} viewBox="0 0 16 16" width={14}>
        <Path
          d="M4.2 1.5h7.6c1.1 0 2 .9 2 2v7.4c0 .9-.6 1.7-1.4 1.9v1.1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1H5.5v1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1.1c-.8-.3-1.4-1-1.4-1.9V3.5c0-1.1.9-2 2-2Zm.4 2.2v3.7h6.8V3.7H4.6Zm1 7.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm4.8-1.1a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 0 0-2.2 0Z"
          fill={colors.white}
        />
      </Svg>
    </View>
  );
}

function ChevronRightIcon() {
  return (
    <Svg height={24} viewBox="0 0 24 24" width={24}>
      <Path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke={colors.gray05}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg height={20} viewBox="0 0 20 20" width={20}>
      <Path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke={colors.gray06}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.gray01,
  },
  header: {
    borderBottomColor: colors.gray04,
  },
  headerTitle: {
    ...typography.head01Sb,
    color: colors.black,
  },
  routeHeader: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.gray02,
  },
  busInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  busIconCircle: {
    width: 22,
    height: 22,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.main,
  },
  busNumber: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25.2,
    color: colors.gray09,
  },
  busDirection: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18.2,
    color: colors.gray06,
  },
  totalTime: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  totalTimeNumber: {
    fontFamily: "SUIT",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    color: colors.gray09,
  },
  totalTimeUnit: {
    marginBottom: 2,
    marginLeft: 3,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray09,
  },
  timeSection: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.gray02,
  },
  timeSummaryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  timeSummaryBlock: {
    flex: 1,
  },
  fieldLabel: {
    marginBottom: 8,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18.2,
    color: colors.gray07,
  },
  timeCard: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  timeCardText: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25.2,
    color: colors.gray07,
  },
  resetButton: {
    height: 42,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  resetButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray08,
  },
  formSection: {
    paddingTop: 28,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
  sectionLabel: {
    marginBottom: 12,
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    color: colors.gray09,
  },
  nameInput: {
    height: 54,
    marginBottom: 28,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray09,
  },
  reminderSelect: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  reminderText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  dayRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  dayButton: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  dayButtonSelected: {
    borderColor: colors.main,
    backgroundColor: colors.main,
  },
  dayButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  dayButtonTextSelected: {
    color: colors.white,
  },
  footer: {
    marginTop: "auto",
    paddingHorizontal: 20,
    paddingBottom: 28,
    backgroundColor: colors.white,
  },
  infoBox: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: colors.gray02,
  },
  infoText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    color: colors.gray07,
  },
  footerButtons: {
    marginTop: 14,
    flexDirection: "row",
    gap: 14,
  },
  cancelButton: {
    flex: 1,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray05,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  cancelText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  saveButton: {
    flex: 1,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  saveText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.white,
  },
  garageContent: {
    flex: 1,
    paddingTop: 28,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
  garageBusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  garageBusTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  garageBusName: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25.2,
    color: colors.gray09,
  },
  garageBusDescription: {
    marginTop: 2,
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16.8,
    color: colors.gray07,
  },
  changeButton: {
    height: 34,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray05,
    borderRadius: 17,
    backgroundColor: colors.white,
  },
  changeButtonText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16.8,
    color: colors.gray08,
  },
  directionList: {
    marginTop: 24,
    gap: 12,
  },
  directionCard: {
    minHeight: 86,
    paddingVertical: 20,
    paddingHorizontal: 22,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  directionCardSelected: {
    borderColor: colors.main,
    backgroundColor: colors.sub,
  },
  directionTitle: {
    fontFamily: "SUIT",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23.8,
    color: colors.gray08,
  },
  directionDescription: {
    marginTop: 8,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18.2,
    color: colors.gray06,
  },
  garageFooter: {
    paddingHorizontal: 20,
    paddingBottom: 56,
    backgroundColor: colors.white,
  },
  fullSaveButton: {
    height: 54,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
});
