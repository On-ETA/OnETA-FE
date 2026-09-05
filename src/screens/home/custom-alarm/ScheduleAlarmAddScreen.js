import React, { useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { Header } from "../../../components";
import { colors, typography } from "../../../theme";

const DEFAULT_TIME = {
  period: "오전",
  hour: "11",
  minute: "30",
};

export function ScheduleAlarmAddScreen({ onBackPress }) {
  const [routeName, setRouteName] = useState("");
  const [arrivalTime, setArrivalTime] = useState(DEFAULT_TIME);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [step, setStep] = useState("form");
  const [routePlaces, setRoutePlaces] = useState({
    origin: "마포구 와우산로 94",
    destination: "우리집",
  });

  const formattedTime = `${arrivalTime.period} ${arrivalTime.hour} : ${arrivalTime.minute}`;

  const handleNextPress = () => {
    // TODO: 다음 단계 API/화면 연결
    // POST /home/custom-alarms/schedule/draft
    // body: { routeName, targetArrivalTime: formattedTime }
    setStep("route");
  };

  const handleBackPress = () => {
    if (step === "alarmFinal") {
      setStep("routeResult");
      return;
    }

    if (step === "routeResult") {
      setStep("route");
      return;
    }

    if (step === "route") {
      setStep("form");
      return;
    }

    onBackPress?.();
  };

  if (step === "route") {
    return (
      <ScheduleRouteMapStep
        onBackPress={handleBackPress}
        onConfirm={(places) => {
          setRoutePlaces(places);
          setStep("routeResult");
        }}
      />
    );
  }

  if (step === "routeResult") {
    return (
      <ScheduleRouteResultStep
        initialDestination={routePlaces.destination}
        initialOrigin={routePlaces.origin}
        onBackPress={handleBackPress}
        onRouteSelect={() => setStep("alarmFinal")}
      />
    );
  }

  if (step === "alarmFinal") {
    return (
      <ScheduleAlarmFinalStep
        onBackPress={handleBackPress}
        onPrevPress={() => setStep("routeResult")}
        onSavePress={onBackPress}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        headerStyle={styles.header}
        onBackPress={handleBackPress}
        title="알림 추가"
        titleStyle={styles.headerTitle}
        type="back"
      />

      <View style={styles.content}>
        <Text style={styles.heading}>매일 이용하는 경로를 등록해주세요</Text>

        <Text style={styles.label}>경로 이름을 입력해주세요 (선택)</Text>
        <TextInput
          onChangeText={setRouteName}
          placeholder="경로 01"
          placeholderTextColor={colors.gray06}
          style={styles.textInput}
          value={routeName}
        />

        <Text style={[styles.label, styles.timeLabel]}>
          몇 시까지 도착하고 싶으신가요?
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsTimePickerVisible(true)}
          style={styles.timeInput}
        >
          <Text style={styles.timeInputText}>{formattedTime}</Text>
          <ChevronDownIcon />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={onBackPress}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelButtonText}>취소</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={handleNextPress}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>다음</Text>
        </Pressable>
      </View>

      <TimePickerSheet
        onClose={() => setIsTimePickerVisible(false)}
        onConfirm={(time) => {
          setArrivalTime(time);
          setIsTimePickerVisible(false);
        }}
        value={arrivalTime}
        visible={isTimePickerVisible}
      />
    </View>
  );
}

function ScheduleRouteMapStep({ onBackPress, onConfirm }) {
  const SHEET_EXPANDED_OFFSET = -120;
  const SHEET_COLLAPSED_OFFSET = 156;
  const [placeKeyword, setPlaceKeyword] = useState("");
  const [origin, setOrigin] = useState("마포구 와우산로 94");
  const [destination, setDestination] = useState("우리집");
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const lastSheetOffset = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 4,
      onPanResponderMove: (_, gestureState) => {
        const nextOffset = Math.min(
          Math.max(
            lastSheetOffset.current + gestureState.dy,
            SHEET_EXPANDED_OFFSET,
          ),
          SHEET_COLLAPSED_OFFSET,
        );
        sheetTranslateY.setValue(nextOffset);
      },
      onPanResponderRelease: (_, gestureState) => {
        const releasedOffset = Math.min(
          Math.max(
            lastSheetOffset.current + gestureState.dy,
            SHEET_EXPANDED_OFFSET,
          ),
          SHEET_COLLAPSED_OFFSET,
        );
        const nextOffset =
          releasedOffset < SHEET_EXPANDED_OFFSET / 2
            ? SHEET_EXPANDED_OFFSET
            : releasedOffset > SHEET_COLLAPSED_OFFSET / 2
              ? SHEET_COLLAPSED_OFFSET
              : 0;
        lastSheetOffset.current = nextOffset;
        Animated.spring(sheetTranslateY, {
          toValue: nextOffset,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <View style={styles.mapScreen}>
      {/* TODO: 네이버 지도 API 연동 시 이 placeholder를 NaverMapView로 교체하세요. */}
      {/* GET /map/search?keyword=, GET /routes?origin=&destination= */}
      <MapPlaceholder />

      <View style={styles.mapHeaderLayer}>
        <Header
          headerStyle={styles.mapHeader}
          onBackPress={onBackPress}
          title="알림 추가"
          titleStyle={styles.headerTitle}
          type="back"
        />
        <View style={styles.placeSearchBox}>
          <SearchIcon />
          <TextInput
            onChangeText={setPlaceKeyword}
            placeholder="장소 검색"
            placeholderTextColor={colors.gray06}
            style={styles.placeSearchInput}
            value={placeKeyword}
          />
        </View>
      </View>

      <Animated.View
        style={[
          styles.routeSheet,
          {
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        <View style={styles.routeSheetHandleArea} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
        </View>
        <Text style={styles.routeFieldLabel}>출발지</Text>
        <View style={styles.routeField}>
          <TextInput
            onChangeText={setOrigin}
            placeholder="출발지 입력"
            placeholderTextColor={colors.gray06}
            style={styles.routeFieldInput}
            value={origin}
          />
        </View>
        <Text style={styles.routeFieldLabel}>도착지</Text>
        <View style={styles.routeField}>
          <TextInput
            onChangeText={setDestination}
            placeholder="도착지 입력"
            placeholderTextColor={colors.gray06}
            style={styles.routeFieldInput}
            value={destination}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onConfirm({ origin, destination })}
          style={styles.mapConfirmButton}
        >
          <Text style={styles.confirmButtonText}>확인</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ScheduleRouteResultStep({
  initialDestination,
  initialOrigin,
  onBackPress,
  onRouteSelect,
}) {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);

  return (
    <View style={styles.resultScreen}>
      {/* TODO: API 연동 시 아래 화면의 더미 경로 데이터를 교체하세요. */}
      {/* GET /home/custom-alarms/schedule/routes?origin=&destination=&arrivalTime= */}
      {/* POST /home/custom-alarms/schedule */}
      <View style={styles.resultHeader}>
        <Pressable
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBackPress}
          style={styles.resultBackButton}
        >
          <HeaderBackIcon />
        </Pressable>
        <View style={styles.routeSummaryPill}>
          <TextInput
            numberOfLines={1}
            onChangeText={setOrigin}
            placeholder="출발지"
            placeholderTextColor={colors.gray06}
            style={styles.routeSummaryInput}
            value={origin}
          />
          <ChevronRightIcon />
          <TextInput
            numberOfLines={1}
            onChangeText={setDestination}
            placeholder="도착지"
            placeholderTextColor={colors.gray06}
            style={styles.routeSummaryInput}
            value={destination}
          />
          <CloseIcon />
        </View>
      </View>

      <View style={styles.resultNotice}>
        <Text style={styles.resultNoticeText}>
          도로 상황에 따라 실제 도착 시간은 달라질 수 있어요.
        </Text>
      </View>

      <View style={styles.routeResultContent}>
        <View style={styles.optionBadges}>
          <View style={styles.optionBadge}>
            <Text style={styles.optionBadgeText}>최적</Text>
          </View>
          <View style={styles.optionBadge}>
            <Text style={styles.optionBadgeText}>최소 시간</Text>
          </View>
        </View>

        <View style={styles.totalTimeRow}>
          <Text style={styles.totalTimeNumber}>21</Text>
          <Text style={styles.totalTimeUnit}>분</Text>
        </View>

        <RouteTimeline />
        <View style={styles.routeDivider} />

        <View style={styles.routeBusInfo}>
          <View style={styles.routeBusBadge}>
            <BusIconPlain />
          </View>
          <Text style={styles.routeBusNumber}>147</Text>
          <Text style={styles.routeBusDirection}>· 강남역 방면</Text>
        </View>

        <View style={styles.routeStops}>
          <StopRow active label="승차" name="홍대정문" />
          <StopRow label="하차" name="도착정류장" />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onRouteSelect}
          style={styles.routeAlarmButton}
        >
          <Text style={styles.routeAlarmButtonText}>이 경로로 알림 설정</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ScheduleAlarmFinalStep({ onBackPress, onPrevPress, onSavePress }) {
  const [selectedDays, setSelectedDays] = useState([]);
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [reminders, setReminders] = useState({
    1: false,
    3: false,
    5: true,
    10: true,
    15: false,
    30: true,
    60: false,
  });
  const days = ["월", "화", "수", "목", "금", "토", "일"];

  const toggleDay = (day) => {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((selectedDay) => selectedDay !== day)
        : [...current, day],
    );
  };

  const toggleReminder = (key) => {
    setReminders((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAlarm = () => {
    // TODO: POST /home/custom-alarms/schedule
    // body: { routeId, selectedDays, reminders }
    onSavePress?.();
  };

  return (
    <View style={styles.finalScreen}>
      <Header
        headerStyle={styles.header}
        onBackPress={onBackPress}
        title="알림 추가"
        titleStyle={styles.headerTitle}
        type="back"
      />

      <View style={styles.finalRouteHeader}>
        <View style={styles.finalBusInfo}>
          <View style={styles.routeBusBadge}>
            <BusIconPlain />
          </View>
          <Text style={styles.routeBusNumber}>147</Text>
          <Text style={styles.routeBusDirection}>· 강남역 방면</Text>
        </View>
        <View style={styles.finalTotalTime}>
          <Text style={styles.finalTotalTimeNumber}>21</Text>
          <Text style={styles.finalTotalTimeUnit}>분</Text>
        </View>
      </View>

      <View style={styles.finalContent}>
        <View style={styles.timeSummaryRow}>
          <View style={styles.timeSummaryBlock}>
            <Text style={styles.finalLabel}>출발 적정 시간</Text>
            <View style={styles.timeCard}>
              <Text style={styles.timeCardText}>오전 11 : 09</Text>
            </View>
          </View>
          <ChevronRightIcon />
          <View style={styles.timeSummaryBlock}>
            <Text style={styles.finalLabel}>도착 예정 시간</Text>
            <View style={styles.timeCard}>
              <Text style={styles.timeCardText}>오전 11 : 30</Text>
            </View>
          </View>
        </View>

        <Pressable accessibilityRole="button" style={styles.resetRouteButton}>
          <Text style={styles.resetRouteButtonText}>경로 및 시간 재설정</Text>
        </Pressable>
      </View>

      <View style={styles.finalDivider} />

      <View style={styles.finalContent}>
        <Text style={styles.questionText}>출발 시간 몇 분 전에 알려드릴까요?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsReminderModalVisible(true)}
          style={styles.reminderSelect}
        >
          <Text style={styles.reminderSelectText}>10분 전 알림</Text>
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

      <View style={styles.finalFooter}>
        <View style={styles.finalInfoBox}>
          <Text style={styles.finalInfoText}>
            11시 30분까지 도착하실 수 있도록,
          </Text>
          <Text style={styles.finalInfoText}>
            출발 적정 시간 10분 전인 10시 59분에 알려드릴게요.
          </Text>
        </View>
        <View style={styles.finalButtonRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onPrevPress}
            style={styles.prevButton}
          >
            <Text style={styles.prevButtonText}>이전</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={saveAlarm}
            style={styles.saveButton}
          >
            <Text style={styles.saveButtonText}>저장</Text>
          </Pressable>
        </View>
      </View>

      <ReminderModal
        onClose={() => setIsReminderModalVisible(false)}
        onToggle={toggleReminder}
        reminders={reminders}
        visible={isReminderModalVisible}
      />
    </View>
  );
}

function ReminderModal({ onClose, onToggle, reminders, visible }) {
  const options = [
    ["1", "1분 전"],
    ["3", "3분 전"],
    ["5", "5분 전"],
    ["10", "10분 전"],
    ["15", "15분 전"],
    ["30", "30분 전"],
    ["60", "1시간 전"],
  ];

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.reminderOverlay}>
        <View style={styles.reminderCard}>
          <View style={styles.reminderHeader}>
            <Text style={styles.reminderTitle}>미리 알림 설정</Text>
            <Pressable
              accessibilityLabel="미리 알림 설정 닫기"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={styles.reminderCloseButton}
            >
              <CloseIcon />
            </Pressable>
          </View>
          <View style={styles.reminderList}>
            {options.map(([key, label]) => (
              <View key={key} style={styles.reminderRow}>
                <Text style={styles.reminderOptionText}>{label}</Text>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: reminders[key] }}
                  onPress={() => onToggle(key)}
                  style={[
                    styles.reminderSwitch,
                    reminders[key] && styles.reminderSwitchOn,
                  ]}
                >
                  <View style={styles.reminderSwitchThumb} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RouteTimeline() {
  return (
    <View style={styles.routeTimeline}>
      <View style={[styles.routeTimelineSegment, styles.routeWalkSegment]}>
        <View style={styles.routeWalkIcon}>
          <WalkIcon />
        </View>
        <View style={styles.routeTimelineTextWrap}>
          <Text style={styles.routeTimelineText}>5분</Text>
        </View>
      </View>
      <View style={[styles.routeTimelineSegment, styles.routeBusSegment]}>
        <View style={styles.routeBusIcon}>
          <BusIconPlain />
        </View>
        <View style={styles.routeTimelineTextWrap}>
          <Text style={styles.routeTimelineTextOn}>4분</Text>
        </View>
      </View>
      <View style={[styles.routeTimelineSegment, styles.routeAfterWalkSegment]}>
        <View style={styles.routeTimelineTextWrap}>
          <Text style={styles.routeTimelineText}>8분</Text>
        </View>
      </View>
    </View>
  );
}

function StopRow({ active = false, label, name }) {
  return (
    <View style={styles.stopRow}>
      <View style={[styles.stopOuter, active && styles.stopOuterActive]}>
        <View style={[styles.stopInner, active && styles.stopInnerActive]} />
      </View>
      <Text style={styles.stopLabel}>{label}</Text>
      <Text style={styles.stopName}>{name}</Text>
    </View>
  );
}

function MapPlaceholder() {
  return (
    <View style={styles.mapPlaceholder}>
      <View style={[styles.mapBlock, styles.mapPark]} />
      <View style={[styles.mapBlock, styles.mapCampus]} />
      <View style={[styles.mapRoad, styles.mapRoadA]} />
      <View style={[styles.mapRoad, styles.mapRoadB]} />
      <View style={[styles.mapRoad, styles.mapRoadC]} />
      <View style={[styles.mapRoad, styles.mapRoadD]} />
      <Text style={[styles.mapLabel, styles.mapLabelTop]}>제이에스갤러리</Text>
      <Text style={[styles.mapLabel, styles.mapLabelSchool]}>서교초등학교</Text>
      <Text style={[styles.mapLabel, styles.mapLabelCampus]}>홍익대학교{"\n"}서울캠퍼스</Text>
      <Text style={[styles.mapLabel, styles.mapLabelPark]}>와우산{"\n"}(101.8m)</Text>
    </View>
  );
}

function TimePickerSheet({ onClose, onConfirm, value, visible }) {
  const [draftTime, setDraftTime] = useState(value);

  const selectTime = (patch) => {
    setDraftTime((current) => ({ ...current, ...patch }));
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetDim} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.pickerRows}>
            <View style={styles.pickerRow}>
              <Text style={styles.pickerMutedText}>오후</Text>
              <Text style={styles.pickerMutedText}>08:00</Text>
            </View>
            <View style={styles.pickerRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => selectTime({ period: "오전" })}
                style={styles.pickerSelectedPeriodCell}
              >
                <Text style={styles.pickerSelectedText}>{draftTime.period}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => selectTime({ hour: "09", minute: "00" })}
                style={styles.pickerSelectedTimeCell}
              >
                <Text style={styles.pickerSelectedText}>09:00</Text>
              </Pressable>
            </View>
            <View style={styles.pickerRow}>
              <Text style={styles.pickerMutedText}>오후</Text>
              <Text style={styles.pickerMutedText}>10:00</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              onConfirm({
                period: draftTime.period,
                hour: "09",
                minute: "00",
              })
            }
            style={styles.confirmButton}
          >
            <Text style={styles.confirmButtonText}>확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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

function HeaderBackIcon() {
  return (
    <Svg height={24} viewBox="0 0 24 24" width={24}>
      <Path
        d="M15 5 8 12l7 7"
        fill="none"
        stroke={colors.gray07}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg height={20} viewBox="0 0 20 20" width={20}>
      <Path
        d="m8 5 5 5-5 5"
        fill="none"
        stroke={colors.gray05}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg height={20} viewBox="0 0 20 20" width={20}>
      <Path
        d="m5.5 5.5 9 9M14.5 5.5l-9 9"
        fill="none"
        stroke={colors.gray05}
        strokeLinecap="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg height={18} viewBox="0 0 18 18" width={18}>
      <Path
        d="M12.1 12.1 15 15M8 13.5A5.5 5.5 0 1 0 8 2.5a5.5 5.5 0 0 0 0 11Z"
        fill="none"
        stroke={colors.gray05}
        strokeLinecap="round"
        strokeWidth={1.6}
      />
    </Svg>
  );
}

function WalkIcon() {
  return (
    <Svg height={11} viewBox="0 0 12 12" width={11}>
      <Path
        d="M6 3.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm-.6.6L3.7 6.1c-.2.2-.2.6.1.8.2.2.6.2.8-.1l.9-1.1.8 1.1-1.3 3c-.1.3 0 .7.3.8.3.1.7 0 .8-.3l1.1-2.5 1.2 1.5c.2.3.6.3.8.1.3-.2.3-.6.1-.8L7.8 6.7 7 4.8l.9.6c.3.2.6.1.8-.1.2-.3.1-.6-.1-.8L7 3.4c-.5-.3-1.1-.1-1.6.7Z"
        fill={colors.white}
      />
    </Svg>
  );
}

function BusIconPlain() {
  return (
    <Svg height={13} viewBox="0 0 16 16" width={13}>
      <Path
        d="M4.2 1.5h7.6c1.1 0 2 .9 2 2v7.4c0 .9-.6 1.7-1.4 1.9v1.1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1H5.5v1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1.1c-.8-.3-1.4-1-1.4-1.9V3.5c0-1.1.9-2 2-2Zm.4 2.2v3.7h6.8V3.7H4.6Zm1 7.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm4.8-1.1a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 0 0-2.2 0Z"
        fill={colors.white}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  mapScreen: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.gray03,
  },
  header: {
    borderBottomColor: colors.gray04,
  },
  mapHeaderLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  mapHeader: {
    borderBottomWidth: 0,
    backgroundColor: "transparent",
  },
  headerTitle: {
    ...typography.head01Sb,
    color: colors.black,
  },
  content: {
    flex: 1,
    paddingTop: 28,
    paddingHorizontal: 20,
  },
  heading: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.gray09,
  },
  label: {
    marginTop: 32,
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    color: colors.gray08,
  },
  timeLabel: {
    marginTop: 32,
  },
  textInput: {
    height: 64,
    marginTop: 12,
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
  timeInput: {
    height: 64,
    marginTop: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  timeInputText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray09,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.white,
  },
  cancelButton: {
    flex: 1,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray05,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  cancelButtonText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  nextButton: {
    flex: 1,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  nextButtonText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.white,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(52, 56, 59, 0.32)",
  },
  sheet: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: colors.white,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 62,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray05,
  },
  pickerRows: {
    marginTop: 28,
    gap: 14,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  pickerMutedText: {
    flex: 1,
    height: 40,
    textAlign: "center",
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 40,
    color: colors.gray05,
  },
  pickerSelectedPeriodCell: {
    flex: 1,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: colors.gray03,
  },
  pickerSelectedTimeCell: {
    flex: 1,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: colors.gray03,
  },
  pickerSelectedText: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.gray09,
  },
  confirmButton: {
    height: 64,
    marginTop: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  confirmButtonText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.white,
  },
  mapPlaceholder: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#E8E2D6",
  },
  mapBlock: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  mapPark: {
    right: -44,
    bottom: 260,
    width: 210,
    height: 190,
    borderRadius: 40,
    backgroundColor: "#CFE7BC",
    transform: [{ rotate: "-16deg" }],
  },
  mapCampus: {
    left: -24,
    bottom: 245,
    width: 220,
    height: 150,
    borderRadius: 28,
    backgroundColor: "#D8E5EF",
    transform: [{ rotate: "-14deg" }],
  },
  mapRoad: {
    position: "absolute",
    height: 22,
    borderRadius: 12,
    backgroundColor: "#F8F8F5",
    borderWidth: 2,
    borderColor: "#D8D1C8",
  },
  mapRoadA: {
    top: 96,
    left: -40,
    width: 520,
    transform: [{ rotate: "-31deg" }],
  },
  mapRoadB: {
    top: 178,
    left: -60,
    width: 560,
    transform: [{ rotate: "23deg" }],
  },
  mapRoadC: {
    top: 286,
    left: -80,
    width: 560,
    transform: [{ rotate: "-22deg" }],
  },
  mapRoadD: {
    top: 392,
    left: -70,
    width: 540,
    transform: [{ rotate: "18deg" }],
  },
  mapLabel: {
    position: "absolute",
    textAlign: "center",
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
    color: "rgba(80, 87, 93, 0.58)",
  },
  mapLabelTop: {
    top: 118,
    left: 186,
  },
  mapLabelSchool: {
    top: 184,
    left: 34,
    color: "rgba(66, 113, 183, 0.7)",
  },
  mapLabelCampus: {
    bottom: 320,
    left: 86,
    color: "rgba(66, 113, 183, 0.78)",
  },
  mapLabelPark: {
    bottom: 350,
    right: 78,
    color: "rgba(48, 126, 54, 0.78)",
  },
  placeSearchBox: {
    height: 46,
    marginTop: 8,
    marginHorizontal: 24,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    backgroundColor: colors.white,
    shadowColor: "#3D445E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  placeSearchInput: {
    flex: 1,
    height: "100%",
    marginLeft: 10,
    paddingVertical: 0,
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray09,
  },
  routeSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "52%",
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: colors.white,
  },
  routeSheetHandleArea: {
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  routeFieldLabel: {
    marginTop: 0,
    marginBottom: 8,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18.2,
    color: colors.gray07,
  },
  routeField: {
    height: 64,
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  routeFieldInput: {
    height: "100%",
    paddingHorizontal: 16,
    paddingVertical: 0,
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray09,
  },
  mapConfirmButton: {
    height: 56,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  resultScreen: {
    flex: 1,
    backgroundColor: colors.gray01,
  },
  resultHeader: {
    height: 80,
    paddingTop: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray01,
  },
  resultBackButton: {
    width: 30,
    height: 44,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  routeSummaryPill: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  routeSummaryInput: {
    flex: 1,
    height: "100%",
    minWidth: 0,
    paddingVertical: 0,
    textAlign: "center",
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray09,
  },
  resultNotice: {
    height: 48,
    paddingHorizontal: 20,
    justifyContent: "center",
    backgroundColor: colors.gray02,
  },
  resultNoticeText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16.8,
    color: colors.gray07,
  },
  routeResultContent: {
    paddingTop: 18,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
  optionBadges: {
    flexDirection: "row",
    gap: 8,
  },
  optionBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#D9E7FF",
  },
  optionBadgeText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16.8,
    color: "#3478F6",
  },
  totalTimeRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  totalTimeNumber: {
    fontFamily: "SUIT",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    color: colors.gray09,
  },
  totalTimeUnit: {
    marginBottom: 3,
    marginLeft: 4,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19.6,
    color: colors.gray09,
  },
  routeTimeline: {
    height: 18,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: colors.gray04,
  },
  routeTimelineSegment: {
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  routeWalkSegment: {
    flex: 1.1,
  },
  routeBusSegment: {
    flex: 1.05,
    borderRadius: 10,
    backgroundColor: colors.main,
  },
  routeAfterWalkSegment: {
    flex: 1.9,
  },
  routeWalkIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.gray06,
  },
  routeBusIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.main,
  },
  routeTimelineTextWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  routeTimelineText: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    color: colors.gray07,
  },
  routeTimelineTextOn: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    color: colors.white,
  },
  routeDivider: {
    height: 1,
    marginTop: 14,
    marginBottom: 14,
    backgroundColor: colors.gray03,
  },
  routeBusInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeBusBadge: {
    width: 22,
    height: 22,
    marginRight: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.main,
  },
  routeBusNumber: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25.2,
    color: colors.gray09,
  },
  routeBusDirection: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray06,
  },
  routeStops: {
    marginTop: 12,
    gap: 11,
  },
  stopRow: {
    height: 23,
    flexDirection: "row",
    alignItems: "center",
  },
  stopOuter: {
    width: 23,
    height: 23,
    marginRight: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.gray04,
  },
  stopOuterActive: {
    backgroundColor: colors.sub,
  },
  stopInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gray06,
  },
  stopInnerActive: {
    backgroundColor: colors.main,
  },
  stopLabel: {
    width: 42,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  stopName: {
    flex: 1,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray08,
  },
  routeAlarmButton: {
    height: 46,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  routeAlarmButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray08,
  },
  finalScreen: {
    flex: 1,
    backgroundColor: colors.gray01,
  },
  finalRouteHeader: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.gray02,
  },
  finalBusInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  finalTotalTime: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  finalTotalTimeNumber: {
    fontFamily: "SUIT",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    color: colors.gray09,
  },
  finalTotalTimeUnit: {
    marginBottom: 2,
    marginLeft: 3,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray09,
  },
  finalContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    backgroundColor: colors.white,
  },
  timeSummaryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  timeSummaryBlock: {
    flex: 1,
  },
  finalLabel: {
    marginBottom: 8,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18.2,
    color: colors.gray07,
  },
  timeCard: {
    height: 64,
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
  resetRouteButton: {
    height: 46,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  resetRouteButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray08,
  },
  finalDivider: {
    height: 16,
    backgroundColor: colors.gray02,
  },
  questionText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray09,
  },
  reminderSelect: {
    height: 64,
    marginTop: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  reminderSelectText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  dayRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  dayButton: {
    flex: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  dayButtonSelected: {
    borderColor: colors.main,
    backgroundColor: colors.sub,
  },
  dayButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  dayButtonTextSelected: {
    color: colors.main,
  },
  finalFooter: {
    marginTop: "auto",
    paddingHorizontal: 20,
    paddingBottom: 28,
    backgroundColor: colors.white,
  },
  finalInfoBox: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: colors.gray02,
  },
  finalInfoText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    color: colors.gray07,
  },
  finalButtonRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 14,
  },
  prevButton: {
    flex: 1,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray05,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  prevButtonText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  saveButton: {
    flex: 1,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  saveButtonText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.white,
  },
  reminderOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    backgroundColor: "rgba(52, 56, 59, 0.32)",
  },
  reminderCard: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 26,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reminderTitle: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.gray07,
  },
  reminderCloseButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderList: {
    marginTop: 22,
    gap: 21,
  },
  reminderRow: {
    minHeight: 35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reminderOptionText: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.gray08,
  },
  reminderSwitch: {
    width: 44,
    height: 26,
    padding: 3,
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.gray05,
  },
  reminderSwitchOn: {
    alignItems: "flex-end",
    backgroundColor: colors.main,
  },
  reminderSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
});
