import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import BackIcon from "../../../../assets/images/L.svg";
import { getArrivalNotifications } from "../../../api/notifications/arrival";
import { colors, layout } from "../../../theme";

const DAY_LABELS = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};

export function FirstLastRouteDetailScreen({
  onBackPress,
  notificationId,
  route,
  onLoginRequired,
}) {
  const [routeDetail, setRouteDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  /*
   * 아래 두 방식 모두 지원
   *
   * 1.
   * <FirstLastRouteDetailScreen notificationId={4} />
   *
   * 2. React Navigation
   * navigation.navigate("FirstLastRouteDetail", {
   *   notificationId: 4,
   * });
   */
  const selectedNotificationId =
    notificationId ??
    route?.params?.notificationId ??
    route?.params?.id ??
    null;

  const loadRouteDetail = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (
        selectedNotificationId === null ||
        selectedNotificationId === undefined ||
        selectedNotificationId === ""
      ) {
        throw new Error("조회할 경로 id가 없습니다.");
      }

      /*
       * arrival.js의 getArrivalNotifications() 사용
       *
       * 여기서 이미:
       * - accessToken 적용
       * - 401 / 403 / C007 / C005 처리
       * - 토큰 재발급
       * - 재요청
       * - normalizeArrivalNotification()
       *
       * 이 수행됨.
       */
      const notifications = await getArrivalNotifications();

      const selectedNotification = notifications.find(
        (item) =>
          String(item.notificationId) ===
          String(selectedNotificationId),
      );

      if (!selectedNotification) {
        setRouteDetail(null);
        setErrorMessage("해당 경로를 찾을 수 없습니다.");
        return;
      }

      setRouteDetail(
        createRouteDetail(selectedNotification),
      );
    } catch (error) {
      console.error("첫막차 경로 상세 조회 실패:", error);

      if (isAuthError(error)) {
        setRouteDetail(null);
        setErrorMessage("다시 로그인해주세요.");

        if (typeof onLoginRequired === "function") {
          onLoginRequired();
        }

        return;
      }

      setRouteDetail(null);

      setErrorMessage(
        error?.message ||
          "경로 정보를 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedNotificationId, onLoginRequired]);

  useEffect(() => {
    loadRouteDetail();
  }, [loadRouteDetail]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBackPress}
          style={styles.backButton}
        >
          <BackIcon height={24} width={24} />
        </Pressable>

        <Text style={styles.headerTitle}>
          경로 상세
        </Text>
      </View>

      {isLoading ? (
        <LoadingView />
      ) : errorMessage ? (
        <ErrorView
          message={errorMessage}
          onRetry={
            errorMessage === "다시 로그인해주세요."
              ? null
              : loadRouteDetail
          }
        />
      ) : routeDetail ? (
        <RouteDetailContent routeDetail={routeDetail} />
      ) : null}
    </View>
  );
}

function RouteDetailContent({ routeDetail }) {
  const hasTimeline =
    Array.isArray(routeDetail.timeline) &&
    routeDetail.timeline.length > 0;

  const hasSteps =
    Array.isArray(routeDetail.steps) &&
    routeDetail.steps.length > 0;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.routeHeader}>
        <View style={styles.routeTitleRow}>
          <Text
            numberOfLines={1}
            style={styles.routeName}
          >
            {routeDetail.routeName}
          </Text>

          <View
            style={[
              styles.statusBadge,
              !routeDetail.isActive &&
                styles.statusBadgeDisabled,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                !routeDetail.isActive &&
                  styles.statusBadgeTextDisabled,
              ]}
            >
              {routeDetail.isActive
                ? "알림 사용"
                : "알림 꺼짐"}
            </Text>
          </View>
        </View>

        <View style={styles.arrivalBox}>
          <Text style={styles.arrivalLabel}>
            목표 도착
          </Text>

          <Text style={styles.arrivalTime}>
            {routeDetail.targetArrivalTime}
          </Text>
        </View>
      </View>

      {hasTimeline && (
        <TimelineSummary
          items={routeDetail.timeline}
        />
      )}

      <View style={styles.routeArea}>
        <PlaceRow
          place={routeDetail.origin}
          type="origin"
        />

        {hasSteps ? (
          <View style={styles.stepsWrap}>
            {routeDetail.steps.map((step, index) => {
              if (step.type === "walk") {
                return (
                  <WalkStep
                    key={`walk-${index}`}
                    step={step}
                  />
                );
              }

              if (step.type === "bus") {
                return (
                  <BusStep
                    key={`bus-${index}`}
                    step={step}
                  />
                );
              }

              return null;
            })}
          </View>
        ) : (
          <SimpleRouteConnector />
        )}

        <PlaceRow
          place={routeDetail.destination}
          type="destination"
          arrivalTime={
            routeDetail.targetArrivalTime
          }
        />
      </View>

      <View style={styles.divider} />

      <NotificationInfo
        routeDetail={routeDetail}
      />
    </ScrollView>
  );
}

function TimelineSummary({ items }) {
  return (
    <View style={styles.timeline}>
      {items.map((item, index) => {
        const isBus = item.type === "bus";

        return (
          <View
            key={`${item.type}-${index}`}
            style={[
              styles.timelineSegment,
              isBus
                ? styles.timelineBusSegment
                : styles.timelineWalkSegment,
            ]}
          >
            <View
              style={[
                styles.timelineIcon,
                isBus &&
                  styles.timelineBusIcon,
              ]}
            >
              {isBus ? (
                <BusIcon size={12} />
              ) : (
                <WalkIcon size={12} />
              )}
            </View>

            <View
              style={styles.timelineTextWrap}
            >
              <Text
                style={[
                  styles.timelineText,
                  isBus &&
                    styles.timelineTextOn,
                ]}
              >
                {item.minutes}분
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PlaceRow({
  place,
  type,
  arrivalTime,
}) {
  const isDestination =
    type === "destination";

  return (
    <View style={styles.placeRow}>
      <View style={styles.placeMarker}>
        <MapPinIcon
          color={
            isDestination
              ? colors.gray08
              : colors.main
          }
        />
      </View>

      <View style={styles.placeTextGroup}>
        <Text style={styles.placeLabel}>
          {isDestination
            ? "도착"
            : "출발"}
        </Text>

        <Text style={styles.placeName}>
          {place.name}
        </Text>

        {!!place.address && (
          <Text style={styles.placeAddress}>
            {place.address}
          </Text>
        )}
      </View>

      {isDestination &&
        arrivalTime &&
        arrivalTime !== "-" && (
          <Text style={styles.placeTime}>
            {arrivalTime}
          </Text>
        )}
    </View>
  );
}

function SimpleRouteConnector() {
  return (
    <View style={styles.simpleConnector}>
      <View style={styles.simpleConnectorRail}>
        <View style={styles.simpleConnectorLine} />
      </View>

      <View
        style={styles.simpleConnectorContent}
      >
        <View style={styles.moveIcon}>
          <ArrowDownIcon />
        </View>

        <View>
          <Text style={styles.moveTitle}>
            이동
          </Text>

          <Text style={styles.moveDescription}>
            상세 이동 정보가 없습니다.
          </Text>
        </View>
      </View>
    </View>
  );
}

function WalkStep({ step }) {
  return (
    <View style={styles.walkStep}>
      <View style={styles.walkStepInner}>
        <View style={styles.walkStepIcon}>
          <WalkIcon
            color={colors.white}
            size={13}
          />
        </View>

        <Text style={styles.walkText}>
          {step.distanceText ||
            "도보 이동"}
        </Text>

        <View style={styles.dottedLine} />

        <Text style={styles.walkMinutes}>
          {step.minutes ?? 0}분
        </Text>
      </View>
    </View>
  );
}

function BusStep({ step }) {
  const viaStops = Array.isArray(
    step.viaStops,
  )
    ? step.viaStops
    : [];

  return (
    <View style={styles.busStep}>
      <View style={styles.busRail}>
        <View
          style={styles.stopCircleActive}
        >
          <View
            style={styles.stopCircleInner}
          />
        </View>

        <View style={styles.railLine} />

        <View
          style={styles.stopCircleOff}
        >
          <View
            style={
              styles.stopCircleOffInner
            }
          />
        </View>
      </View>

      <View style={styles.busStepContent}>
        <View style={styles.stopHeader}>
          <View
            style={styles.stopTitleGroup}
          >
            <Text style={styles.stopName}>
              {step.boardingStopName ||
                "승차 정류장"}
            </Text>

            <Text style={styles.stopKind}>
              승차
            </Text>
          </View>

          {!!step.boardingTime && (
            <Text style={styles.stopTime}>
              {formatTime(
                step.boardingTime,
              )}
            </Text>
          )}
        </View>

        <View style={styles.busInfoLine}>
          <View style={styles.busBadge}>
            <BusIcon size={13} />

            <Text
              style={styles.busBadgeText}
            >
              {step.routeNumber ||
                "버스"}
            </Text>
          </View>

          {step.stopCount !==
            undefined && (
            <Text
              style={
                styles.busMoveText
              }
            >
              {step.stopCount}개 정류장 이동
            </Text>
          )}

          <View
            style={styles.busDottedLine}
          />

          {step.minutes !== undefined && (
            <Text
              style={styles.busMinutes}
            >
              {step.minutes}분
            </Text>
          )}
        </View>

        {viaStops.length > 0 && (
          <View style={styles.viaStops}>
            {viaStops.map(
              (stop, index) => (
                <Text
                  key={`${stop}-${index}`}
                  style={
                    styles.viaStopText
                  }
                >
                  {stop}
                </Text>
              ),
            )}
          </View>
        )}

        <View style={styles.stopHeader}>
          <View
            style={styles.stopTitleGroup}
          >
            <Text style={styles.stopName}>
              {step.arrivalStopName ||
                "하차 정류장"}
            </Text>

            <Text style={styles.stopKind}>
              하차
            </Text>
          </View>

          {!!step.arrivalTime && (
            <Text style={styles.stopTime}>
              {formatTime(
                step.arrivalTime,
              )}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function NotificationInfo({
  routeDetail,
}) {
  return (
    <View style={styles.infoSection}>
      <Text style={styles.sectionTitle}>
        알림 설정
      </Text>

      <View style={styles.infoCard}>
        <InfoRow
          label="목표 도착 시간"
          value={
            routeDetail.targetArrivalTime
          }
        />

        <View
          style={styles.infoDivider}
        />

        <InfoRow
          label="도착 알림"
          value={`${routeDetail.reminderOffsetMinutes}분 전`}
        />

        <View
          style={styles.infoDivider}
        />

        <View style={styles.daysRow}>
          <Text style={styles.infoLabel}>
            반복 요일
          </Text>

          <View
            style={styles.daysContainer}
          >
            {routeDetail.repeatDays
              .length > 0 ? (
              routeDetail.repeatDays.map(
                (day) => (
                  <View
                    key={day}
                    style={
                      styles.dayBadge
                    }
                  >
                    <Text
                      style={
                        styles.dayBadgeText
                      }
                    >
                      {DAY_LABELS[day] ||
                        day}
                    </Text>
                  </View>
                ),
              )
            ) : (
              <Text
                style={styles.infoValue}
              >
                반복 없음
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function LoadingView() {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator
        size="large"
        color={colors.main}
      />

      <Text style={styles.loadingText}>
        경로 정보를 불러오는 중입니다.
      </Text>
    </View>
  );
}

function ErrorView({
  message,
  onRetry,
}) {
  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>
        {message}
      </Text>

      {onRetry && (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed &&
              styles.retryButtonPressed,
          ]}
        >
          <Text
            style={styles.retryButtonText}
          >
            다시 시도
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/*
 * arrival.js의 normalizeArrivalNotification() 결과를
 * 상세 화면용 구조로 변환
 */
function createRouteDetail(notification) {
  const raw =
    notification?.raw ??
    notification?.payload ??
    {};

  const details =
    notification?.route ??
    parseRouteDetails(
      notification?.routeDetails,
    ) ??
    parseRouteDetails(raw?.routeDetails) ??
    {};

  const origin = normalizePlace({
    place:
      details?.origin ??
      raw?.origin,
    address:
      details?.originAddress ??
      raw?.originAddress,
    fallbackName: "출발지",
  });

  const destination =
    normalizePlace({
      place:
        details?.destination ??
        raw?.destination,
      address:
        details?.destinationAddress ??
        raw?.destinationAddress,
      fallbackName: "도착지",
    });

  const targetArrivalTime =
    notification?.arrivalTime &&
    notification.arrivalTime !==
      "시간 정보 없음"
      ? notification.arrivalTime
      : formatTime(
          notification
            ?.targetArrivalTime ??
            raw?.targetArrivalTime,
        );

  return {
    notificationId:
      notification?.notificationId ??
      raw?.notificationId,

    routeName:
      notification?.routeName ??
      raw?.routeName ??
      "도착 경로",

    isActive:
      notification?.enabled ??
      Boolean(raw?.isActive),

    targetArrivalTime:
      targetArrivalTime || "-",

    reminderOffsetMinutes:
      toNumber(
        notification
          ?.reminderOffsetMinutes ??
          raw?.reminderOffsetMinutes,
      ),

    repeatDays: Array.isArray(
      notification?.repeatDays,
    )
      ? notification.repeatDays
      : Array.isArray(raw?.repeatDays)
        ? raw.repeatDays
        : [],

    origin,
    destination,

    /*
     * 현재 예시 API에는 timeline / steps가 없지만
     * routeDetails에 나중에 추가되면
     * 화면 수정 없이 바로 표시 가능.
     */
    timeline: normalizeTimeline(
      details?.timeline,
    ),

    steps: normalizeSteps(
      details?.steps,
    ),
  };
}

function parseRouteDetails(
  routeDetails,
) {
  if (!routeDetails) {
    return null;
  }

  if (
    typeof routeDetails === "object"
  ) {
    return routeDetails;
  }

  if (
    typeof routeDetails !== "string"
  ) {
    return null;
  }

  try {
    return JSON.parse(routeDetails);
  } catch (error) {
    console.warn(
      "routeDetails 파싱 실패:",
      routeDetails,
      error,
    );

    return null;
  }
}

function normalizePlace({
  place,
  address,
  fallbackName,
}) {
  if (
    typeof place === "string"
  ) {
    return {
      name: place,
      address: address ?? "",
    };
  }

  if (
    place &&
    typeof place === "object"
  ) {
    return {
      name:
        place.name ??
        place.placeName ??
        place.title ??
        place.stationName ??
        place.stopName ??
        fallbackName,

      address:
        place.address ??
        place.roadAddress ??
        place.originAddress ??
        address ??
        "",
    };
  }

  return {
    name: fallbackName,
    address: address ?? "",
  };
}

function normalizeTimeline(timeline) {
  if (!Array.isArray(timeline)) {
    return [];
  }

  return timeline
    .map((item) => ({
      type:
        item?.type === "bus"
          ? "bus"
          : "walk",

      minutes: toNumber(
        item?.minutes,
      ),
    }))
    .filter(
      (item) => item.minutes >= 0,
    );
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .map((step) => {
      if (step?.type === "walk") {
        return {
          type: "walk",
          distanceText:
            step.distanceText ??
            step.distance ??
            "도보 이동",

          minutes: toNumber(
            step.minutes,
          ),
        };
      }

      if (step?.type === "bus") {
        return {
          type: "bus",

          routeNumber:
            step.routeNumber ??
            step.busNumber ??
            step.routeName ??
            "",

          stopCount: toNumber(
            step.stopCount,
          ),

          minutes: toNumber(
            step.minutes,
          ),

          boardingStopName:
            step.boardingStopName ??
            step.startStopName ??
            "",

          boardingTime:
            step.boardingTime ?? "",

          arrivalStopName:
            step.arrivalStopName ??
            step.endStopName ??
            "",

          arrivalTime:
            step.arrivalTime ?? "",

          viaStops: Array.isArray(
            step.viaStops,
          )
            ? step.viaStops
            : [],
        };
      }

      return null;
    })
    .filter(Boolean);
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const parts = value.split(":");

    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }

    return value;
  }

  if (typeof value === "object") {
    const hour = String(
      value.hour ?? 0,
    ).padStart(2, "0");

    const minute = String(
      value.minute ?? 0,
    ).padStart(2, "0");

    return `${hour}:${minute}`;
  }

  return String(value);
}

function toNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function isAuthError(error) {
  return (
    error?.status === 401 ||
    error?.status === 403 ||
    error?.code === "C007" ||
    error?.code === "C005"
  );
}

function WalkIcon({
  color = colors.white,
  size = 12,
}) {
  return (
    <Svg
      height={size}
      viewBox="0 0 12 12"
      width={size}
    >
      <Circle
        cx={6}
        cy={2.2}
        fill={color}
        r={1.4}
      />

      <Path
        d="M5.4 4.1 3.7 6.1c-.2.2-.2.6.1.8.2.2.6.2.8-.1l.9-1.1.8 1.1-1.3 3c-.1.3 0 .7.3.8.3.1.7 0 .8-.3l1.1-2.5 1.2 1.5c.2.3.6.3.8.1.3-.2.3-.6.1-.8L7.8 6.7 7 4.8l.9.6c.3.2.6.1.8-.1.2-.3.1-.6-.1-.8L7 3.4c-.5-.3-1.1-.1-1.6.7Z"
        fill={color}
      />
    </Svg>
  );
}

function BusIcon({ size = 13 }) {
  return (
    <Svg
      height={size}
      viewBox="0 0 16 16"
      width={size}
    >
      <Path
        d="M4.2 1.5h7.6c1.1 0 2 .9 2 2v7.4c0 .9-.6 1.7-1.4 1.9v1.1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1H5.5v1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1.1c-.8-.3-1.4-1-1.4-1.9V3.5c0-1.1.9-2 2-2Zm.4 2.2v3.7h6.8V3.7H4.6Zm1 7.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm4.8-1.1a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 0 0-2.2 0Z"
        fill={colors.white}
      />
    </Svg>
  );
}

function MapPinIcon({ color }) {
  return (
    <Svg
      height={26}
      viewBox="0 0 24 24"
      width={26}
    >
      <Path
        d="M12 2.5c-4.1 0-7.4 3.2-7.4 7.3 0 5.4 7.4 11.7 7.4 11.7s7.4-6.3 7.4-11.7c0-4.1-3.3-7.3-7.4-7.3Z"
        fill={color}
      />

      <Circle
        cx={12}
        cy={9.8}
        fill={colors.white}
        r={3.1}
      />
    </Svg>
  );
}

function ArrowDownIcon() {
  return (
    <Svg
      height={16}
      viewBox="0 0 16 16"
      width={16}
    >
      <Path
        d="M8 2v10M4.5 8.5 8 12l3.5-3.5"
        fill="none"
        stroke={colors.gray06}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
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
    height: layout.headerHeight,
    flexShrink: 0,
    paddingHorizontal: layout.screenMargin,
    gap: layout.headerTitleGap,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.gray03,
    backgroundColor: colors.gray01,
  },

  backButton: {
    width: 24,
    height: 24,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.gray08,
  },

  scrollContent: {
    paddingBottom: 48,
  },

  routeHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
  },

  routeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  routeName: {
    flex: 1,
    marginRight: 12,
    fontFamily: "SUIT",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30,
    color: colors.gray09,
  },

  statusBadge: {
    paddingHorizontal: 10,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.sub,
  },

  statusBadgeDisabled: {
    backgroundColor: colors.gray03,
  },

  statusBadgeText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "700",
    color: colors.main,
  },

  statusBadgeTextDisabled: {
    color: colors.gray06,
  },

  arrivalBox: {
    marginTop: 16,
    paddingHorizontal: 18,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    backgroundColor: colors.gray02,
  },

  arrivalLabel: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray07,
  },

  arrivalTime: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "800",
    color: colors.main,
  },

  timeline: {
    height: 18,
    marginHorizontal: 20,
    marginBottom: 26,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: colors.gray04,
  },

  timelineSegment: {
    height: "100%",
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  timelineWalkSegment: {
    backgroundColor: colors.gray04,
  },

  timelineBusSegment: {
    borderRadius: 10,
    backgroundColor: colors.bus,
  },

  timelineIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.gray06,
  },

  timelineBusIcon: {
    backgroundColor: colors.bus,
  },

  timelineTextWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  timelineText: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    color: colors.gray07,
  },

  timelineTextOn: {
    color: colors.white,
  },

  routeArea: {
    paddingTop: 4,
  },

  placeRow: {
    minHeight: 64,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  placeMarker: {
    width: 26,
    height: 26,
    marginTop: 4,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  placeTextGroup: {
    flex: 1,
    minWidth: 0,
  },

  placeLabel: {
    marginBottom: 2,
    fontFamily: "SUIT",
    fontSize: 11,
    fontWeight: "600",
    color: colors.gray06,
  },

  placeName: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    color: colors.gray09,
  },

  placeAddress: {
    marginTop: 2,
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    color: colors.gray06,
  },

  placeTime: {
    marginLeft: 10,
    marginTop: 18,
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "700",
    color: colors.gray08,
  },

  simpleConnector: {
    minHeight: 90,
    paddingLeft: 28,
    paddingRight: 24,
    flexDirection: "row",
  },

  simpleConnectorRail: {
    width: 24,
    marginRight: 16,
    alignItems: "center",
  },

  simpleConnectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.gray04,
  },

  simpleConnectorContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  moveIcon: {
    width: 30,
    height: 30,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: colors.gray02,
  },

  moveTitle: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    color: colors.gray08,
  },

  moveDescription: {
    marginTop: 3,
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "500",
    color: colors.gray06,
  },

  stepsWrap: {
    marginTop: 14,
    marginBottom: 20,
  },

  walkStep: {
    height: 54,
    paddingLeft: 68,
    paddingRight: 20,
    justifyContent: "center",
  },

  walkStepInner: {
    flexDirection: "row",
    alignItems: "center",
  },

  walkStepIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.gray06,
  },

  walkText: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    color: colors.gray07,
  },

  dottedLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 22,
    borderTopWidth: 2,
    borderStyle: "dotted",
    borderColor: colors.gray05,
  },

  walkMinutes: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    color: colors.gray07,
  },

  busStep: {
    minHeight: 172,
    paddingLeft: 28,
    paddingRight: 20,
    flexDirection: "row",
    backgroundColor: colors.gray02,
  },

  busRail: {
    width: 24,
    marginRight: 16,
    alignItems: "center",
  },

  stopCircleActive: {
    width: 20,
    height: 20,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.sub,
  },

  stopCircleInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.bus,
  },

  railLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.bus,
  },

  stopCircleOff: {
    width: 20,
    height: 20,
    marginBottom: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.gray04,
  },

  stopCircleOffInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray06,
  },

  busStepContent: {
    flex: 1,
    paddingVertical: 20,
  },

  stopHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  stopTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },

  stopName: {
    flexShrink: 1,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "800",
    color: colors.gray09,
  },

  stopKind: {
    marginLeft: 8,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    color: colors.gray07,
  },

  stopTime: {
    marginLeft: 8,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "500",
    color: colors.gray06,
  },

  busInfoLine: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  busBadge: {
    height: 24,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    backgroundColor: colors.bus,
  },

  busBadgeText: {
    marginLeft: 4,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "800",
    color: colors.white,
  },

  busMoveText: {
    marginLeft: 8,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    color: colors.bus,
  },

  busDottedLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 14,
    borderTopWidth: 2,
    borderStyle: "dotted",
    borderColor: "#93E9B7",
  },

  busMinutes: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "800",
    color: colors.bus,
  },

  viaStops: {
    marginTop: 10,
    marginBottom: 18,
    gap: 8,
  },

  viaStopText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray07,
  },

  divider: {
    height: 8,
    marginTop: 28,
    backgroundColor: colors.gray02,
  },

  infoSection: {
    paddingHorizontal: 24,
    paddingTop: 26,
  },

  sectionTitle: {
    marginBottom: 14,
    fontFamily: "SUIT",
    fontSize: 17,
    fontWeight: "800",
    color: colors.gray09,
  },

  infoCard: {
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.gray03,
    borderRadius: 14,
    backgroundColor: colors.white,
  },

  infoRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  infoLabel: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray07,
  },

  infoValue: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    color: colors.gray09,
  },

  infoDivider: {
    height: 1,
    backgroundColor: colors.gray03,
  },

  daysRow: {
    minHeight: 76,
    paddingVertical: 14,
  },

  daysContainer: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  dayBadge: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: colors.sub,
  },

  dayBadgeText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "700",
    color: colors.main,
  },

  centerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 14,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "500",
    color: colors.gray06,
  },

  errorText: {
    textAlign: "center",
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    color: colors.gray07,
  },

  retryButton: {
    height: 44,
    marginTop: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.main,
  },

  retryButtonPressed: {
    opacity: 0.8,
  },

  retryButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
});
