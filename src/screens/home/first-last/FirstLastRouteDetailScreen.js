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
import WalkAsset from "../../../../assets/images/man.svg";
import BGaIcon from "../../../../assets/bus/b_ga.svg";
import BJiIcon from "../../../../assets/bus/b_ji.svg";
import BGwIcon from "../../../../assets/bus/b_gw.svg";
import BSIcon from "../../../../assets/bus/b_s.svg";
import BOIcon from "../../../../assets/bus/b_o.svg";
import S1Icon from "../../../../assets/subway/s_1.svg";
import S2Icon from "../../../../assets/subway/s_2.svg";
import S3Icon from "../../../../assets/subway/s_3.svg";
import S4Icon from "../../../../assets/subway/s_4.svg";
import S5Icon from "../../../../assets/subway/s_5.svg";
import S6Icon from "../../../../assets/subway/s_6.svg";
import S7Icon from "../../../../assets/subway/s_7.svg";
import S8Icon from "../../../../assets/subway/s_8.svg";
import S9Icon from "../../../../assets/subway/s_9.svg";
import SubwayIcon from "../../../../assets/subway/subway_i.svg";
import {
  getTransitNotification,
  getTransitNotifications,
} from "../../../api/notifications/transit";
import { colors, layout } from "../../../theme";
import { normalizeTimelineSegments } from "../../../utils/routeSegments";
import { getBusIconKey, getSubwayIconKey, getTransitColors } from "../../../utils/transitColors";

const DETAIL_TRANSIT_ICONS = {
  b_ga: BGaIcon,
  b_ji: BJiIcon,
  b_gw: BGwIcon,
  b_s: BSIcon,
  b_o: BOIcon,
  s_1: S1Icon,
  s_2: S2Icon,
  s_3: S3Icon,
  s_4: S4Icon,
  s_5: S5Icon,
  s_6: S6Icon,
  s_7: S7Icon,
  s_8: S8Icon,
  s_9: S9Icon,
};

function DetailTransitIcon({ segment, size = 13 }) {
  const colorsForSegment = getTransitColors(segment);
  const iconKey = colorsForSegment.isSubway
    ? getSubwayIconKey(segment)
    : getBusIconKey(segment);
  const Icon = DETAIL_TRANSIT_ICONS[iconKey];

  return Icon ? <Icon width={size} height={size} /> : <BusIcon size={size} />;
}


export function FirstLastRouteDetailScreen({
  onBackPress,
  notificationId,
  routeSummary,
  route,
  onLoginRequired,
}) {
  const [routeDetail, setRouteDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  /*
   * ?꾨옒 ??諛⑹떇 紐⑤몢 吏??
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
        if (routeSummary?.route || Array.isArray(routeSummary?.segments)) {
          setRouteDetail(createRouteDetailFromSummary(routeSummary));
          return;
        }

        throw new Error("議고쉶??寃쎈줈 id媛 ?놁뒿?덈떎.");
      }

      /*
       * arrival.js??getArrivalNotifications() ?ъ슜
       *
       * ?ш린???대?:
       * - accessToken ?곸슜
       * - 401 / 403 / C007 / C005 泥섎━
       * - ?좏겙 ?щ컻湲?
       * - ?ъ슂泥?
       * - normalizeArrivalNotification()
       *
       * ???섑뻾??
       */
      const selectedNotification = await loadSelectedTransitNotification(
        selectedNotificationId,
      );

      if (!selectedNotification) {
        setRouteDetail(null);
        setErrorMessage("?대떦 寃쎈줈瑜?李얠쓣 ???놁뒿?덈떎.");
        return;
      }

      setRouteDetail(
        createRouteDetail(selectedNotification),
      );
    } catch (error) {
      console.error("泥ル쭑李?寃쎈줈 ?곸꽭 議고쉶 ?ㅽ뙣:", error);

      if (isAuthError(error)) {
        setRouteDetail(null);
        setErrorMessage("?ㅼ떆 濡쒓렇?명빐二쇱꽭??");

        if (typeof onLoginRequired === "function") {
          onLoginRequired();
        }

        return;
      }

      setRouteDetail(null);

      setErrorMessage(
        error?.message ||
          "寃쎈줈 ?뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??",
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedNotificationId, routeSummary, onLoginRequired]);

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
    </ScrollView>
  );
}

function TimelineSummary({ items }) {
  return (
    <View style={styles.timeline}>
      {items.map((item, index) => {
        const isBus = item.type === "bus";
        const transitColors = isBus ? getTransitColors(item) : null;

        return (
          <View
            key={`${item.type}-${index}`}
            style={[
              styles.timelineSegment,
              isBus
                ? styles.timelineBusSegment
                : styles.timelineWalkSegment,
              isBus && { backgroundColor: transitColors.light },
            ]}
          >
            {isBus || index === 0 ? (
              <View
                style={[
                  styles.timelineIcon,
                  isBus &&
                    [styles.timelineBusIcon, { backgroundColor: transitColors.strong }],
                ]}
              >
                {isBus ? (
                  transitColors.isSubway ? (
                    <SubwayIcon width={7} height={8} />
                  ) : (
                    <DetailTransitIcon segment={item} size={12} />
                  )
                ) : (
                  <WalkAsset width={6} height={10} />
                )}
              </View>
            ) : null}

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
          <WalkAsset width={6} height={10} />
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
          <View
            style={[
              styles.busBadge,
              {
                borderWidth: 1,
                borderColor: getTransitColors(step).light,
                backgroundColor: colors.white,
              },
            ]}
          >
            <DetailTransitIcon segment={step} size={13} />

            <Text
              style={[
                styles.busBadgeText,
                {
                  color: getTransitColors(step).light,
                },
              ]}
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
            ?ㅼ떆 ?쒕룄
          </Text>
        </Pressable>
      )}
    </View>
  );
}

async function loadSelectedTransitNotification(notificationId) {
  try {
    return await getTransitNotification({ notificationId });
  } catch (error) {
    if (isAuthError(error)) {
      throw error;
    }
  }

  const notifications = await getTransitNotifications();

  return notifications.find(
    (item) => String(item.notificationId) === String(notificationId),
  );
}

function createRouteDetailFromSummary(summary) {
  const route = summary?.route ?? {
    segments: summary?.segments ?? [],
    totalDurationMinutes: summary?.totalDurationMinutes,
    arrivalTime: summary?.arrivalTime,
  };
  const originName =
    route?.originAddress ??
    route?.origin ??
    summary?.originAddress ??
    "출발지";
  const destinationName =
    route?.destinationAddress ??
    route?.destination ??
    summary?.destinationAddress ??
    "도착지";

  return createRouteDetail({
    notificationId: summary?.notificationId,
    routeName: summary?.routeName ?? "첫막차 경로",
    arrivalTime: summary?.arrivalTime,
    targetArrivalTime: summary?.arrivalTime,
    reminderOffsetMinutes: [summary?.preDepartureAlarmMinutes ?? 10],
    repeatDays: [],
    enabled: true,
    route: {
      route,
      origin: originName,
      destination: destinationName,
      originAddress: route?.originAddress ?? "",
      destinationAddress: route?.destinationAddress ?? "",
    },
  });
}

/*
 * arrival.js??normalizeArrivalNotification() 寃곌낵瑜? * ?곸꽭 ?붾㈃??援ъ“濡?蹂??
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
  const route = details?.route ?? details;
  const segments = normalizeTimelineSegments(route?.segments ?? []);

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
      "?쒓컙 ?뺣낫 ?놁쓬"
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
     * ?꾩옱 ?덉떆 API?먮뒗 timeline / steps媛 ?놁?留?
     * routeDetails???섏쨷??異붽??섎㈃
     * ?붾㈃ ?섏젙 ?놁씠 諛붾줈 ?쒖떆 媛??
     */
    timeline: normalizeTimeline(
      details?.timeline,
      segments,
    ),

    steps: normalizeSteps(
      details?.steps,
      segments,
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
      "routeDetails ?뚯떛 ?ㅽ뙣:",
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

function normalizeTimeline(timeline, segments = []) {
  if (!Array.isArray(timeline)) {
    return segments.map((segment) => ({
      type: segment.transitType === "WALK" ? "walk" : "bus",
      minutes: toNumber(segment.durationMinutes),
      transitName: segment.transitName,
      routeNumber: segment.routeNumber,
      busNumber: segment.busNumber,
      raw: segment.raw,
    }));
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
      transitName: item?.transitName ?? item?.routeNumber ?? item?.busNumber,
      routeNumber: item?.routeNumber,
      busNumber: item?.busNumber,
      raw: item?.raw,
    }))
    .filter(
      (item) => item.minutes >= 0,
    );
}

function normalizeSteps(steps, segments = []) {
  if (!Array.isArray(steps)) {
    return normalizeStepsFromSegments(segments);
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

function normalizeStepsFromSegments(segments = []) {
  return segments
    .map((segment) => {
      if (segment.transitType === "WALK") {
        return {
          type: "walk",
          distanceText:
            segment.distanceText ??
            segment.distance ??
            segment.raw?.distanceText ??
            segment.raw?.distance ??
            "도보 이동",
          minutes: toNumber(segment.durationMinutes),
        };
      }

      const stations = Array.isArray(segment.stations) ? segment.stations : [];
      const boardingStop =
        segment.startStation || stations[0]?.name || "승차 정류장";
      const arrivalStop =
        segment.endStation || stations[stations.length - 1]?.name || "하차 정류장";
      const viaStops = stations
        .slice(1, Math.max(stations.length - 1, 1))
        .map((station) => station.name)
        .filter(Boolean);

      return {
        type: "bus",
        routeNumber: segment.transitName || "버스",
        stopCount: viaStops.length + 1,
        minutes: toNumber(segment.durationMinutes),
        boardingStopName: boardingStop,
        boardingTime: segment.boardingTime ?? segment.startTime ?? "",
        arrivalStopName: arrivalStop,
        arrivalTime: segment.arrivalTime ?? segment.endTime ?? "",
        viaStops,
      };
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
    width: 18,
    height: 18,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
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

