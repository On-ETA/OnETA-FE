import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import MemoIcon from "../../../../public/images/memo.svg";
import PlusIcon from "../../../../public/images/plus.svg";
import BellGreenIcon from "../../../../assets/images/bell_green.svg";
import BellDarkGrayIcon from "../../../../assets/images/bell_dg.svg";
import TrashIcon from "../../../../assets/images/trash.svg";
import {
  deleteDepotNotification,
  getMyDepotNotifications,
  updateDepotNotificationStatus,
} from "../../../api/notifications/depot";
import {
  deleteArrivalNotifications,
  getArrivalNotifications,
  hideArrivalNotificationsLocally,
  updateArrivalNotificationStatus,
} from "../../../api/notifications/arrival";
import { colors, typography } from "../../../theme";
import { blurActiveElement } from "../../../utils/accessibility";
import { FCM_NOTIFICATION_TYPES, subscribeNotifications } from "../../../notifications/events";
import { homeCacheKeys } from "../../../api/homeCache";

// TODO: API 연동 시 아래 더미 데이터를 교체하세요.
// GET /home/custom-alarms
// - garageAlarms: Array<{ id; direction; routeNumber; routeName; enabled }>
// - scheduleAlarms: Array<{ id; routeName; arrivalTime; enabled }>
// DELETE /home/custom-alarms
// - body: { ids: string[] }
// PATCH /home/custom-alarms/{alarmId}/enabled
const initialGarageAlarms = [];

const initialScheduleAlarms = [];

function getArrivalNotificationId(alarm) {
  const id = alarm?.notificationId ?? alarm?.id;

  if (id === undefined || id === null || id === "") {
    return null;
  }

  return String(id).replace(/^arrival-/, "");
}

function getDepotNotificationId(alarm) {
  const id = (
    alarm?.userBusId ??
    alarm?.payload?.userBusId ??
    alarm?.raw?.userBusId ??
    alarm?.notification?.userBusId
  );

  if (id === undefined || id === null || id === "") {
    return null;
  }

  return String(id);
}

function getGarageAlarmUiId(alarm) {
  const id = getDepotNotificationId(alarm) ?? alarm?.id;

  if (id === undefined || id === null || id === "") {
    return null;
  }

  return `garage-${String(id).replace(/^garage-/, "")}`;
}

function getScheduleAlarmUiId(alarm) {
  const id = getArrivalNotificationId(alarm);

  return id ? `schedule-${id}` : null;
}

function getAlarmFallbackKey(prefix, alarm, index) {
  return `${prefix}-${alarm?.routeNumber ?? alarm?.routeName ?? alarm?.title ?? "alarm"}-${index}`;
}

async function deleteScheduleAlarm(alarm, notificationId) {
  const userBusId = getDepotNotificationId(alarm);

  if (userBusId !== undefined && userBusId !== null && userBusId !== "") {
    return deleteDepotNotification({ userBusId });
  }

  try {
    return await deleteArrivalNotifications({ ids: [notificationId] });
  } catch (error) {
    if (error?.status >= 500) {
      hideArrivalNotificationsLocally([notificationId]);
      return { code: "LOCAL_HIDDEN" };
    }

    throw error;
  }
}

export function CustomAlarmScreen({
  onGarageDepartureAddPress,
  onGarageAlarmEditPress,
  refreshKey = 0,
  onScheduleAlarmAddPress,
  onScheduleAlarmEditPress,
}) {
  const [garageAlarms, setGarageAlarms] = useState(initialGarageAlarms);
  const [scheduleAlarms, setScheduleAlarms] = useState(initialScheduleAlarms);
  const [isLoadingGarageAlarms, setIsLoadingGarageAlarms] = useState(false);
  const [garageAlarmError, setGarageAlarmError] = useState("");
  const [isLoadingScheduleAlarms, setIsLoadingScheduleAlarms] = useState(false);
  const [scheduleAlarmError, setScheduleAlarmError] = useState("");
  const [isDeletingAlarms, setIsDeletingAlarms] = useState(false);
  const [updatingScheduleAlarmIds, setUpdatingScheduleAlarmIds] = useState([]);
  const [updatingGarageAlarmIds, setUpdatingGarageAlarmIds] = useState([]);
  const garageRequest = useRef(null);
  const scheduleRequest = useRef(null);

  useEffect(() => subscribeNotifications((message, { results = [] } = {}) => {
    if (message?.data?.type === FCM_NOTIFICATION_TYPES.schedule) {
      const result = results.find(item => item.key === homeCacheKeys.scheduleNotifications);
      if (!result) return;
      scheduleRequest.current?.abort();
      if (result.status === "fulfilled") setScheduleAlarms(result.value);
      setScheduleAlarmError(result.status === "rejected" ? result.error?.message || "? ?? ??? ???? ?????." : "");
      setIsLoadingScheduleAlarms(false);
    } else if (message?.data?.type === FCM_NOTIFICATION_TYPES.depot) {
      const result = results.find(item => item.key === homeCacheKeys.depotNotifications);
      if (!result) return;
      garageRequest.current?.abort();
      if (result.status === "fulfilled") setGarageAlarms(result.value);
      setGarageAlarmError(result.status === "rejected" ? result.error?.message || "??? ??? ???? ?????." : "");
      setIsLoadingGarageAlarms(false);
    }
  }), []);
  const [editingSections, setEditingSections] = useState({
    garage: false,
    schedule: false,
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteTargetIds, setDeleteTargetIds] = useState([]);

  const isDeleteModalVisible = deleteTargetIds.length > 0;
  const isAnyEditing = editingSections.garage || editingSections.schedule;
  const hasEditableAlarms = garageAlarms.length > 0 || scheduleAlarms.length > 0;

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    garageRequest.current = controller;
    async function loadGarageAlarms() {
      setIsLoadingGarageAlarms(true);
      setGarageAlarmError("");
      try {
        const alarms = await getMyDepotNotifications({ signal: controller.signal });
        if (isActive && !controller.signal.aborted) setGarageAlarms(alarms);
      } catch (error) {
        if (isActive && !controller.signal.aborted && error?.name !== "AbortError") {
          setGarageAlarmError(error?.message ?? "??? ?? ??? ???? ?????.");
        }
      } finally {
        if (isActive && !controller.signal.aborted) setIsLoadingGarageAlarms(false);
      }
    }
    loadGarageAlarms();
    return () => { isActive = false; controller.abort(); };
  }, [refreshKey]);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    scheduleRequest.current = controller;
    async function loadScheduleAlarms() {
      setIsLoadingScheduleAlarms(true);
      setScheduleAlarmError("");
      try {
        const alarms = await getArrivalNotifications({ signal: controller.signal });
        if (isActive && !controller.signal.aborted) setScheduleAlarms(alarms);
      } catch (error) {
        if (isActive && !controller.signal.aborted && error?.name !== "AbortError") {
          setScheduleAlarmError(error?.message ?? "? ?? ??? ???? ?????.");
        }
      } finally {
        if (isActive && !controller.signal.aborted) setIsLoadingScheduleAlarms(false);
      }
    }
    loadScheduleAlarms();
    return () => { isActive = false; controller.abort(); };
  }, [refreshKey]);

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
    if (!alarmId) {
      return;
    }

    setSelectedIds((current) =>
      current.includes(alarmId)
        ? current.filter((id) => id !== alarmId)
        : [...current, alarmId],
    );
  };

  const requestSingleDelete = (alarmId) => {
    if (!alarmId) {
      Alert.alert("알림 삭제 실패", "삭제할 알림 id를 찾지 못했습니다.");
      return;
    }

    blurActiveElement();
    setDeleteTargetIds([alarmId]);
  };

  const toggleGarageAlarm = async (alarmId) => {
    const target = garageAlarms.find((alarm) => getGarageAlarmUiId(alarm) === alarmId);
    const userBusId = getDepotNotificationId(target);
    if (!target || !userBusId || updatingGarageAlarmIds.includes(alarmId)) {
      return;
    }
    const active = !target.enabled;
    setUpdatingGarageAlarmIds((ids) => [...ids, alarmId]);
    try {
      await updateDepotNotificationStatus({ userBusId, active });
      setGarageAlarms((current) => current.map((alarm) =>
        getGarageAlarmUiId(alarm) === alarmId ? { ...alarm, enabled: active } : alarm,
      ));
    } catch (error) {
      Alert.alert("알림 상태 변경 실패", error?.message ?? "차고지 출발 알림 상태 변경에 실패했습니다.");
    } finally {
      setUpdatingGarageAlarmIds((ids) => ids.filter((id) => id !== alarmId));
    }
  };

  const toggleScheduleAlarm = async (alarmId) => {
    const targetAlarm = scheduleAlarms.find(
      (alarm) => getScheduleAlarmUiId(alarm) === alarmId,
    );
    const notificationId = getArrivalNotificationId(targetAlarm);

    if (!targetAlarm || !notificationId) {
      Alert.alert("알림 상태 변경 실패", "변경할 알림 id를 찾지 못했습니다.");
      return;
    }

    if (updatingScheduleAlarmIds.includes(alarmId)) {
      return;
    }

    const nextEnabled = !targetAlarm.enabled;

    setUpdatingScheduleAlarmIds((current) => [...current, alarmId]);
    setScheduleAlarms((current) =>
      current.map((alarm) =>
        getScheduleAlarmUiId(alarm) === alarmId
          ? { ...alarm, enabled: nextEnabled }
          : alarm,
      ),
    );

    try {
      await updateArrivalNotificationStatus({
        id: notificationId,
        payload: { isActive: nextEnabled },
      });
    } catch (error) {
      setScheduleAlarms((current) =>
        current.map((alarm) =>
          getScheduleAlarmUiId(alarm) === alarmId
            ? { ...alarm, enabled: targetAlarm.enabled }
            : alarm,
        ),
      );
      Alert.alert(
        "알림 상태 변경 실패",
        error?.message ?? "도착 알림 상태 변경에 실패했습니다.",
      );
    } finally {
      setUpdatingScheduleAlarmIds((current) =>
        current.filter((id) => id !== alarmId),
      );
    }
  };

  const requestSelectedDelete = () => {
    if (selectedIds.length > 0 && !isDeleteModalVisible) {
      blurActiveElement();
      setDeleteTargetIds(selectedIds);
    }
  };

  const closeDeleteModal = () => {
    blurActiveElement();
    setDeleteTargetIds([]);
  };

  const confirmDelete = async () => {
    if (isDeletingAlarms) {
      return;
    }

    const garageTargets = garageAlarms.filter((alarm) =>
      deleteTargetIds.includes(getGarageAlarmUiId(alarm)),
    );
    const scheduleTargets = scheduleAlarms.filter((alarm) =>
      deleteTargetIds.includes(getScheduleAlarmUiId(alarm)),
    );
    const garageTargetIds = garageTargets
      .map(getDepotNotificationId)
      .filter((id) => id !== undefined && id !== null && id !== "");
    const scheduleTargetIds = scheduleTargets
      .map(getArrivalNotificationId)
      .filter((id) => id !== undefined && id !== null && id !== "");

    if (garageTargets.length !== garageTargetIds.length) {
      Alert.alert("알림 삭제 실패", "삭제할 차고지 출발 알림 id를 찾지 못했습니다.");
      return;
    }

    if (scheduleTargets.length !== scheduleTargetIds.length) {
      Alert.alert("알림 삭제 실패", "삭제할 내 일정 알림 id를 찾지 못했습니다.");
      return;
    }

    setIsDeletingAlarms(true);
    setGarageAlarms((current) =>
      current.filter((alarm) => !deleteTargetIds.includes(getGarageAlarmUiId(alarm))),
    );
    setScheduleAlarms((current) =>
      current.filter((alarm) => !deleteTargetIds.includes(getScheduleAlarmUiId(alarm))),
    );
    setSelectedIds((current) =>
      current.filter((alarmId) => !deleteTargetIds.includes(alarmId)),
    );
    setDeleteTargetIds([]);

    try {
      const garageResults = await Promise.allSettled(
        garageTargetIds.map((userBusId) =>
          deleteDepotNotification({ userBusId }),
        ),
      );
      const scheduleResults = await Promise.allSettled(
        scheduleTargets.map((alarm, index) =>
          deleteScheduleAlarm(alarm, scheduleTargetIds[index]),
        ),
      );
      if (
        garageResults.some((result) => result.status === "rejected") ||
        scheduleResults.some((result) => result.status === "rejected")
      ) {
        Alert.alert("알림 삭제 실패", "일부 알림을 삭제하지 못했습니다.");
      }
    } catch (error) {
      Alert.alert(
        "알림 삭제 실패",
        error?.message ?? "알림 삭제에 실패했습니다.",
      );
    } finally {
      setIsDeletingAlarms(false);
    }
  };

  return (
    <View style={styles.body}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        horizontal={false}
        showsVerticalScrollIndicator
        style={styles.scroller}
      >
        <AlarmSectionHeader
          onAddPress={onGarageDepartureAddPress}
          onEditPress={() => toggleEditSection("garage")}
          title="차고지 출발 알림"
        />
        {isLoadingGarageAlarms ? (
          <EmptyAlarmBox />
        ) : garageAlarmError ? (
          <EmptyAlarmBox />
        ) : garageAlarms.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.garageList}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {garageAlarms.map((alarm, index) => {
              const alarmId = getGarageAlarmUiId(alarm);
              const selected = alarmId ? selectedIds.includes(alarmId) : false;

              return (
                <GarageAlarmCard
                  alarm={alarm}
                  editMode={editingSections.garage}
                  key={alarmId ?? getAlarmFallbackKey("garage", alarm, index)}
                  onDeletePress={() => requestSingleDelete(alarmId)}
                  onPress={() => {
                    if (editingSections.garage) {
                      toggleSelect(alarmId);
                      return;
                    }

                    onGarageAlarmEditPress?.(alarm);
                  }}
                  onToggleAlarm={() => toggleGarageAlarm(alarmId)}
                  updating={updatingGarageAlarmIds.includes(alarmId)}
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
        {isLoadingScheduleAlarms ? (
          <EmptyAlarmBox />
        ) : scheduleAlarmError ? (
          <EmptyAlarmBox />
        ) : scheduleAlarms.length > 0 ? (
          <View style={styles.scheduleList}>
            {scheduleAlarms.map((alarm, index) => {
              const alarmId = getScheduleAlarmUiId(alarm);
              const selected = alarmId ? selectedIds.includes(alarmId) : false;

              return (
                <ScheduleAlarmRow
                  alarm={alarm}
                  editMode={editingSections.schedule}
                  key={alarmId ?? getAlarmFallbackKey("schedule", alarm, index)}
                  onDeletePress={() => requestSingleDelete(alarmId)}
                  onPress={() => {
                    if (editingSections.schedule) {
                      toggleSelect(alarmId);
                      return;
                    }

                    onScheduleAlarmEditPress?.(alarm);
                  }}
                  onToggleAlarm={() => toggleScheduleAlarm(alarmId)}
                  selected={selected}
                  updating={alarmId ? updatingScheduleAlarmIds.includes(alarmId) : false}
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
          <TrashIcon height={18} width={18} />
          <Text style={styles.bulkDeleteButtonText}>선택 항목 삭제</Text>
        </Pressable>
      ) : null}

      <DeleteConfirmModal
        onCancel={closeDeleteModal}
        onConfirm={confirmDelete}
        deleting={isDeletingAlarms}
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

function EmptyAlarmBox({ text = "우측 더하기 버튼으로 알림을 추가해보세요" }) {
  return (
    <View style={styles.emptyAlarmBox}>
      <Text style={styles.emptyAlarmText}>{text}</Text>
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
  updating,
}) {
  return (
    <View style={[styles.garageCard, selected && styles.selectedItem]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={styles.garageCardTop}
      >
        <Text
          numberOfLines={1}
          style={styles.garageDirection}
        >
          {alarm.direction}
        </Text>
        <View style={styles.garageRouteRow}>
          <BusIcon />
          <Text
            numberOfLines={1}
            style={styles.garageRouteNumber}
          >
            {alarm.routeNumber}
          </Text>
        </View>
      </Pressable>
      {editMode ? (
        <Pressable
          accessibilityRole="button"
          onPress={onDeletePress}
          style={styles.garageDeleteArea}
        >
          <TrashIcon height={18} width={18} />
          <Text style={styles.deleteText}>삭제</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onToggleAlarm}
          disabled={updating}
          accessibilityState={{ disabled: updating }}
          style={[
            styles.garageAlarmButton,
            alarm.enabled
              ? styles.garageAlarmButtonOn
              : styles.garageAlarmButtonReady,
          ]}
        >
          <View style={styles.garageAlarmIcon}>
            {alarm.enabled ? (
              <BellGreenIcon height={24} width={24} />
            ) : (
              <BellDarkGrayIcon height={24} width={24} />
            )}
          </View>
          <Text
            ellipsizeMode="tail"
            numberOfLines={2}
            style={[
              styles.garageAlarmButtonText,
              alarm.enabled
                ? styles.garageAlarmButtonTextOn
                : styles.garageAlarmButtonTextReady,
            ]}
          >
            {alarm.enabled ? "알림 설정됨" : "알림 해제됨"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ScheduleAlarmRow({
  alarm,
  editMode,
  onDeletePress,
  onPress,
  onToggleAlarm,
  selected,
  updating,
}) {
  return (
    <View style={[styles.scheduleRow, selected && styles.selectedItem]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={styles.scheduleMainArea}
      >
        <Text style={styles.scheduleName}>{alarm.routeName}</Text>
        <Text style={styles.scheduleTime}>{alarm.arrivalTime}</Text>
      </Pressable>
      {editMode ? (
        <Pressable
          accessibilityRole="button"
          onPress={onDeletePress}
          style={styles.scheduleDeleteButton}
        >
          <TrashIcon height={22} width={22} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: alarm.enabled }}
          disabled={updating}
          onPress={onToggleAlarm}
          style={[styles.switchButton, updating && styles.switchButtonDisabled]}
        >
          <Switch enabled={alarm.enabled} />
        </Pressable>
      )}
    </View>
  );
}

function DeleteConfirmModal({ deleting = false, onCancel, onConfirm, visible }) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalOverlay}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>선택한 알림을 삭제할까요?</Text>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={onCancel}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={onConfirm}
              style={[
                styles.confirmButton,
                deleting && styles.confirmButtonDisabled,
              ]}
            >
              <Text style={styles.confirmButtonText}>
                {deleting ? "삭제 중" : "삭제"}
              </Text>
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
  scroller: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: "scroll",
      },
    }),
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
    display: "flex",
    minWidth: 140,
    flexShrink: 0,
    flexDirection: "column",
    alignItems: "flex-start",
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
    display: "flex",
    height: 68,
    padding: 12,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 4,
  },
  garageDirection: {
    ...typography.caption01M,
    color: colors.gray07,
  },
  garageRouteRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  garageRouteNumber: {
    marginLeft: 5,
    fontFamily: "SUIT",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23.8,
    color: colors.gray09,
  },
  garageDeleteArea: {
    alignSelf: "stretch",
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(238, 243, 246, 0.8)",
  },
  garageAlarmButton: {
    display: "flex",
    alignSelf: "stretch",
    height: 52,
    paddingRight: 6,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  garageAlarmIcon: {
    flexShrink: 0,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  garageAlarmButtonOn: {
    backgroundColor: colors.sub,
  },
  garageAlarmButtonReady: {
    backgroundColor: colors.gray04,
  },
  garageAlarmButtonText: {
    maxWidth: 118,
    flexShrink: 1,
    minWidth: 0,
    textAlign: "center",
    fontFamily: "SUIT",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 19.6,
    letterSpacing: -0.14,
  },
  garageAlarmButtonTextOn: {
    color: colors.main,
  },
  garageAlarmButtonTextReady: {
    color: colors.gray07,
  },
  deleteText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  tableHeader: {
    display: "flex",
    height: 28,
    marginTop: 10,
    paddingLeft: 16,
    paddingRight: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray02,
    borderRadius: 4,
  },
  tableHeaderText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    color: colors.gray07,
    textAlign: "center",
  },
  routeNameColumn: {
    flex: 1,
    textAlign: "left",
  },
  arrivalTimeColumn: {
    width: 96,
    marginRight: 0,
    transform: [{ translateX: 3 }],
  },
  alarmColumn: {
    width: 48,
    textAlign: "center",
  },
  scheduleList: {
    marginTop: 12,
    gap: 12,
  },
  scheduleRow: {
    display: "flex",
    width: "100%",
    height: 64,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.gray03,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  scheduleMainArea: {
    flex: 1,
    alignSelf: "stretch",
    paddingLeft: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleName: {
    flex: 1,
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  scheduleTime: {
    width: 96,
    marginRight: 0,
    textAlign: "center",
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  scheduleDeleteButton: {
    width: 48,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(238, 243, 246, 0.8)",
  },
  switchButton: {
    width: 48,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  switchButtonDisabled: {
    opacity: 0.5,
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
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.bus,
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
  confirmButtonDisabled: {
    opacity: 0.72,
  },
  confirmButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.white,
  },
});
