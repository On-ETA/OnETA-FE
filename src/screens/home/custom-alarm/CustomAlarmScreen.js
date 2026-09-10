import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import MemoIcon from "../../../../public/images/memo.svg";
import PlusIcon from "../../../../public/images/plus.svg";
import { colors, typography } from "../../../theme";

// TODO: API 연동 시 아래 더미 데이터를 교체하세요.
// GET /home/custom-alarms
// - garageAlarms: Array<{ id; direction; routeNumber; routeName; enabled }>
// - scheduleAlarms: Array<{ id; routeName; arrivalTime; enabled }>
// DELETE /home/custom-alarms
// - body: { ids: string[] }
// PATCH /home/custom-alarms/{alarmId}/enabled
const initialGarageAlarms = [];

const initialScheduleAlarms = [];

export function CustomAlarmScreen({
  onGarageDepartureAddPress,
  onGarageAlarmEditPress,
  onScheduleAlarmAddPress,
  onScheduleAlarmEditPress,
}) {
  const [garageAlarms, setGarageAlarms] = useState(initialGarageAlarms);
  const [scheduleAlarms, setScheduleAlarms] = useState(initialScheduleAlarms);
  const [editingSections, setEditingSections] = useState({
    garage: false,
    schedule: false,
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteTargetIds, setDeleteTargetIds] = useState([]);

  const isDeleteModalVisible = deleteTargetIds.length > 0;
  const isAnyEditing = editingSections.garage || editingSections.schedule;
  const hasEditableAlarms = garageAlarms.length > 0 || scheduleAlarms.length > 0;

  const toggleEditSection = (sectionKey) => {
    setEditingSections((current) => {
      const next = { ...current, [sectionKey]: !current[sectionKey] };
      if (!next.garage && !next.schedule) {
        setSelectedIds([]);
      }
      return next;
    });
  };

  const toggleSelect = (alarmId) => {
    setSelectedIds((current) =>
      current.includes(alarmId)
        ? current.filter((id) => id !== alarmId)
        : [...current, alarmId],
    );
  };

  const requestSingleDelete = (alarmId) => {
    setDeleteTargetIds([alarmId]);
  };

  const toggleGarageAlarm = (alarmId) => {
    setGarageAlarms((current) =>
      current.map((alarm) =>
        alarm.id === alarmId ? { ...alarm, enabled: !alarm.enabled } : alarm,
      ),
    );
  };

  const toggleScheduleAlarm = (alarmId) => {
    setScheduleAlarms((current) =>
      current.map((alarm) =>
        alarm.id === alarmId ? { ...alarm, enabled: !alarm.enabled } : alarm,
      ),
    );
  };

  const requestSelectedDelete = () => {
    if (selectedIds.length > 0 && !isDeleteModalVisible) {
      setDeleteTargetIds(selectedIds);
    }
  };

  const closeDeleteModal = () => {
    setDeleteTargetIds([]);
  };

  const confirmDelete = () => {
    setGarageAlarms((current) =>
      current.filter((alarm) => !deleteTargetIds.includes(alarm.id)),
    );
    setScheduleAlarms((current) =>
      current.filter((alarm) => !deleteTargetIds.includes(alarm.id)),
    );
    setSelectedIds((current) =>
      current.filter((alarmId) => !deleteTargetIds.includes(alarmId)),
    );
    setDeleteTargetIds([]);
  };

  return (
    <View style={styles.body}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        horizontal={false}
        showsVerticalScrollIndicator={false}
      >
        <AlarmSectionHeader
          onAddPress={onGarageDepartureAddPress}
          onEditPress={() => toggleEditSection("garage")}
          title="차고지 출발 알림"
        />
        {garageAlarms.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.garageList}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {garageAlarms.map((alarm) => {
              const selected = selectedIds.includes(alarm.id);

              return (
                <GarageAlarmCard
                  alarm={alarm}
                  editMode={editingSections.garage}
                  key={alarm.id}
                  onDeletePress={() => requestSingleDelete(alarm.id)}
                  onPress={() => {
                    if (editingSections.garage) {
                      toggleSelect(alarm.id);
                      return;
                    }

                    onGarageAlarmEditPress?.(alarm);
                  }}
                  onToggleAlarm={() => toggleGarageAlarm(alarm.id)}
                  selected={selected}
                />
              );
            })}
          </ScrollView>
        ) : (
          <EmptyAlarmBox />
        )}

        <AlarmSectionHeader
          onAddPress={onScheduleAlarmAddPress}
          onEditPress={() => toggleEditSection("schedule")}
          title="내 일정 알림"
        />
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.routeNameColumn]}>경로명</Text>
          <Text style={[styles.tableHeaderText, styles.arrivalTimeColumn]}>
            도착 예정 시간
          </Text>
          <Text style={[styles.tableHeaderText, styles.alarmColumn]}>알림</Text>
        </View>
        {scheduleAlarms.length > 0 ? (
          <View style={styles.scheduleList}>
            {scheduleAlarms.map((alarm) => {
              const selected = selectedIds.includes(alarm.id);

              return (
                <ScheduleAlarmRow
                  alarm={alarm}
                  editMode={editingSections.schedule}
                  key={alarm.id}
                  onDeletePress={() => requestSingleDelete(alarm.id)}
                  onPress={() => {
                    if (editingSections.schedule) {
                      toggleSelect(alarm.id);
                      return;
                    }

                    onScheduleAlarmEditPress?.(alarm);
                  }}
                  onToggleAlarm={() => toggleScheduleAlarm(alarm.id)}
                  selected={selected}
                />
              );
            })}
          </View>
        ) : (
          <EmptyAlarmBox />
        )}
      </ScrollView>

      {isAnyEditing && hasEditableAlarms ? (
        <Pressable
          accessibilityRole="button"
          disabled={selectedIds.length === 0 || isDeleteModalVisible}
          onPress={requestSelectedDelete}
          style={[
            styles.bulkDeleteButton,
            selectedIds.length === 0 && styles.bulkDeleteButtonDisabled,
          ]}
        >
          <TrashIcon color={colors.white} size={18} />
          <Text style={styles.bulkDeleteButtonText}>선택 항목 삭제</Text>
        </Pressable>
      ) : null}

      <DeleteConfirmModal
        onCancel={closeDeleteModal}
        onConfirm={confirmDelete}
        visible={isDeleteModalVisible}
      />
    </View>
  );
}

function AlarmSectionHeader({ onAddPress, onEditPress, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionActions}>
        {onAddPress ? (
          <Pressable
            accessibilityLabel={`${title} 추가`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onAddPress}
            style={styles.iconButton}
          >
            <PlusIcon height={24} width={24} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={`${title} 편집`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onEditPress}
          style={styles.iconButton}
        >
          <MemoIcon height={24} width={24} />
        </Pressable>
      </View>
    </View>
  );
}

function EmptyAlarmBox() {
  return (
    <View style={styles.emptyAlarmBox}>
      <Text style={styles.emptyAlarmText}>
        우측 더하기 버튼으로 알림을 추가해보세요
      </Text>
    </View>
  );
}

function GarageAlarmCard({
  alarm,
  editMode,
  onDeletePress,
  onPress,
  onToggleAlarm,
  selected,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.garageCard, selected && styles.selectedItem]}
    >
      <View style={styles.garageCardTop}>
        <Text style={styles.garageDirection}>{alarm.direction}</Text>
        <View style={styles.garageRouteRow}>
          <BusIcon />
          <Text style={styles.garageRouteNumber}>{alarm.routeNumber}</Text>
        </View>
      </View>
      {editMode ? (
        <Pressable
          accessibilityRole="button"
          onPress={onDeletePress}
          style={styles.garageDeleteArea}
        >
          <TrashIcon color={colors.gray07} size={18} />
          <Text style={styles.deleteText}>삭제</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onToggleAlarm}
          style={[
            styles.garageAlarmButton,
            alarm.enabled
              ? styles.garageAlarmButtonOn
              : styles.garageAlarmButtonReady,
          ]}
        >
          <BellGlyph color={alarm.enabled ? colors.main : colors.white} />
          <Text
            style={[
              styles.garageAlarmButtonText,
              alarm.enabled
                ? styles.garageAlarmButtonTextOn
                : styles.garageAlarmButtonTextReady,
            ]}
          >
            {alarm.enabled ? "알림 설정됨" : "출발 알림"}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function ScheduleAlarmRow({
  alarm,
  editMode,
  onDeletePress,
  onPress,
  onToggleAlarm,
  selected,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.scheduleRow, selected && styles.selectedItem]}
    >
      <Text style={styles.scheduleName}>{alarm.routeName}</Text>
      <Text style={styles.scheduleTime}>{alarm.arrivalTime}</Text>
      {editMode ? (
        <Pressable
          accessibilityRole="button"
          onPress={onDeletePress}
          style={styles.scheduleDeleteButton}
        >
          <TrashIcon color={colors.gray07} size={22} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: alarm.enabled }}
          onPress={onToggleAlarm}
          style={styles.switchButton}
        >
          <Switch enabled={alarm.enabled} />
        </Pressable>
      )}
    </Pressable>
  );
}

function DeleteConfirmModal({ onCancel, onConfirm, visible }) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalOverlay}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>선택한 알림을 삭제할까요?</Text>
          <View style={styles.confirmActions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={styles.confirmButton}>
              <Text style={styles.confirmButtonText}>삭제</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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

function TrashIcon({ color = colors.gray07, size = 20 }) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M9 4.5h6l.7 1.4H20v2H4v-2h4.3L9 4.5Zm-2.8 5h11.6l-.8 9.2c-.1 1.1-1 1.8-2 1.8H9c-1 0-1.9-.8-2-1.8l-.8-9.2Zm3.5 2.1v6h1.7v-6H9.7Zm3.9 0v6h1.7v-6h-1.7Z"
        fill={color}
      />
    </Svg>
  );
}

function BellGlyph({ color = colors.white }) {
  return (
    <Svg height={16} viewBox="0 0 16 16" width={16}>
      <Path
        d="M8 14.2c1 0 1.8-.6 2.1-1.5H5.9c.3.9 1.1 1.5 2.1 1.5Zm5-3.8-.9-1.1V6.7c0-2-1.2-3.6-3-4.2V2c0-.6-.5-1.1-1.1-1.1S6.9 1.4 6.9 2v.5c-1.8.5-3 2.2-3 4.2v2.6L3 10.4c-.5.6-.1 1.5.7 1.5h8.6c.8 0 1.2-.9.7-1.5Z"
        fill={color}
      />
    </Svg>
  );
}

function Switch({ enabled }) {
  return (
    <View style={[styles.switchTrack, enabled && styles.switchTrackOn]}>
      <View style={[styles.switchThumb, enabled && styles.switchThumbOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: colors.gray01,
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 116,
  },
  sectionHeader: {
    width: "100%",
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
  garageList: {
    paddingTop: 8,
    paddingBottom: 28,
    gap: 8,
  },
  emptyAlarmBox: {
    height: 88,
    marginTop: 8,
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.gray02,
  },
  emptyAlarmText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray06,
  },
  garageCard: {
    width: 174,
    height: 120,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  selectedItem: {
    borderColor: colors.main,
    backgroundColor: colors.sub,
  },
  garageCardTop: {
    flex: 1,
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  garageDirection: {
    ...typography.caption01M,
    color: colors.gray07,
  },
  garageRouteRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  garageRouteNumber: {
    marginLeft: 5,
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.gray09,
  },
  garageDeleteArea: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(238, 243, 246, 0.8)",
  },
  garageAlarmButton: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  garageAlarmButtonOn: {
    backgroundColor: colors.sub,
  },
  garageAlarmButtonReady: {
    backgroundColor: colors.main,
  },
  garageAlarmButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
  },
  garageAlarmButtonTextOn: {
    color: colors.main,
  },
  garageAlarmButtonTextReady: {
    color: colors.white,
  },
  deleteText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  tableHeader: {
    height: 28,
    marginTop: 10,
    paddingHorizontal: 20,
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
    flex: 1.35,
  },
  alarmColumn: {
    flex: 0.54,
    textAlign: "right",
  },
  scheduleList: {
    marginTop: 8,
    gap: 8,
  },
  scheduleRow: {
    minHeight: 64,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  scheduleName: {
    flex: 1,
    paddingLeft: 20,
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  scheduleTime: {
    flex: 1.35,
    textAlign: "center",
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  scheduleDeleteButton: {
    width: 80,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(238, 243, 246, 0.8)",
  },
  switchButton: {
    width: 80,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  switchTrack: {
    width: 44,
    height: 26,
    padding: 3,
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.gray05,
  },
  switchTrackOn: {
    alignItems: "flex-end",
    backgroundColor: colors.main,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  switchThumbOn: {
    backgroundColor: colors.white,
  },
  busIconCircle: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.main,
  },
  bulkDeleteButton: {
    position: "absolute",
    right: 16,
    bottom: 18,
    height: 54,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    backgroundColor: colors.gray08,
    shadowColor: "#34383B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  bulkDeleteButtonDisabled: {
    opacity: 0.78,
  },
  bulkDeleteButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(52, 56, 59, 0.32)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 328,
    paddingTop: 30,
    paddingHorizontal: 28,
    paddingBottom: 22,
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  confirmTitle: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray09,
  },
  confirmActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    width: 86,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: colors.gray03,
  },
  cancelButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  confirmButton: {
    width: 86,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: colors.point,
  },
  confirmButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.white,
  },
});
