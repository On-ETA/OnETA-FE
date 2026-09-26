import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Alert,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import RouteBackIcon from "../../../../assets/images/L.svg";
import RouteArrowIcon from "../../../../assets/images/R_g.svg";
import RouteClearIcon from "../../../../assets/images/x.svg";
import BigBusAsset from "../../../../assets/images/bigbus.svg";
import StopLineAsset from "../../../../assets/images/line.svg";

import { searchAddresses } from "../../../api/address/search";
import { createArrivalNotification } from "../../../api/notifications/arrival";
import { searchTransitRoutes } from "../../../api/transit/routes";
import { Header } from "../../../components";
import { NaverMapView } from "../../../components/NaverMapView";
import { RouteTimeline } from "../../../components/RouteTimeline";
import { AddressManagementScreen } from "../../AddressManagementScreen";
import { colors, layout, typography } from "../../../theme";
import { blurActiveElement } from "../../../utils/accessibility";

const DEFAULT_TIME = {
  period: "오전",
  hour: "11",
  minute: "30",
};

const TIME_PICKER_ITEM_HEIGHT = 58;
const TIME_PICKER_VISIBLE_ITEMS = 3;

const PERIOD_OPTIONS = ["오전", "오후"];

const HOUR_OPTIONS = Array.from(
  { length: 12 },
  (_, index) =>
    String(index + 1).padStart(2, "0"),
);

const MINUTE_OPTIONS = Array.from(
  { length: 60 },
  (_, index) =>
    String(index).padStart(2, "0"),
);

function getPrimaryTransitSegment(route) {
  return route?.segments?.find(
    (segment) =>
      segment.transitType !== "WALK",
  );
}

function createRoutePlace(place) {
  if (
    typeof place === "object" &&
    place !== null
  ) {
    const label =
      place.label ||
      place.name ||
      place.placeName ||
      place.address ||
      "";

    return {
      ...place,

      label,

      address:
        place.address ||
        place.detail ||
        place.roadAddress ||
        label,
    };
  }

  return {
    label: place || "",
    name: place || "",
    address: place || "",
    x: undefined,
    y: undefined,
  };
}

function createRoutePlaceFromSearchResult(
  result,
) {
  return createRoutePlace({
    label:
      result?.name ||
      result?.address ||
      result?.roadAddress ||
      "",

    name: result?.name,

    address:
      result?.address ||
      result?.roadAddress ||
      "",

    x: result?.x,
    y: result?.y,

    raw:
      result?.raw ??
      result,
  });
}

function getRoutePlaceText(place) {
  return createRoutePlace(place).label;
}

function getRoutePlaceAddress(place) {
  const routePlace =
    createRoutePlace(place);

  return (
    routePlace.address ||
    routePlace.label
  );
}

function getMapCenterFromPlaces(origin, destination, activePlaceType) {
  const activePlace = activePlaceType === "destination" ? destination : origin;
  const fallbackPlace = activePlaceType === "destination" ? origin : destination;

  return getMapCenterFromPlace(activePlace) ?? getMapCenterFromPlace(fallbackPlace);
}

function getMapCenterFromPlace(place) {
  const routePlace = createRoutePlace(place);
  const latitude = Number(routePlace.y ?? routePlace.latitude ?? routePlace.lat);
  const longitude = Number(
    routePlace.x ?? routePlace.longitude ?? routePlace.lng ?? routePlace.lon,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function getSegmentStopName(
  segment,
  edge,
) {
  if (!segment) {
    return "";
  }

  if (edge === "start") {
    return (
      segment.startStation ||
      segment.stations?.[0]?.name ||
      ""
    );
  }

  return (
    segment.endStation ||
    segment.stations?.[
      segment.stations.length - 1
    ]?.name ||
    ""
  );
}

function toTargetArrivalTime(time) {
  const hourNumber =
    Number(time.hour);

  const minuteNumber =
    Number(time.minute);

  const normalizedHour =
    time.period === "오후" &&
    hourNumber < 12
      ? hourNumber + 12
      : time.period === "오전" &&
          hourNumber === 12
        ? 0
        : hourNumber;

  return `${String(
    normalizedHour,
  ).padStart(2, "0")}:${String(
    minuteNumber,
  ).padStart(2, "0")}:00`;
}

function mapDayToApiValue(day) {
  const dayMap = {
    월: "MON",
    화: "TUE",
    수: "WED",
    목: "THU",
    금: "FRI",
    토: "SAT",
    일: "SUN",
  };

  return dayMap[day];
}

function pickReminderOffsets(
  reminders,
) {
  return Object.entries(reminders)
    .filter(([, selected]) => selected)
    .map(([minute]) => Number(minute))
    .sort((a, b) => a - b);
}

export function ScheduleAlarmAddScreen({
  initialStep = "form",
  mapTitle = "?뚮┝ 異붽?",
  onBackPress,
  onRouteConfigured,
}) {
  const [routeName, setRouteName] =
    useState("");

  const [
    arrivalTime,
    setArrivalTime,
  ] = useState(DEFAULT_TIME);

  const [
    isTimePickerVisible,
    setIsTimePickerVisible,
  ] = useState(false);

  const [step, setStep] =
    useState(initialStep);

  const [
    selectedRoute,
    setSelectedRoute,
  ] = useState(null);

  const [
    routePlaces,
    setRoutePlaces,
  ] = useState({
    origin: createRoutePlace(""),
    destination: createRoutePlace(""),
  });

  const [
    activePlaceType,
    setActivePlaceType,
  ] = useState("origin");

  const formattedTime =
    `${arrivalTime.period} ${arrivalTime.hour} : ${arrivalTime.minute}`;

  const handleNextPress = () => {
    setStep("routeSetup");
  };

  const handleBackPress = () => {
    if (step === "alarmFinal") {
      setStep("routeResult");
      return;
    }

    if (step === "routeResult") {
      setStep("routeSetup");
      return;
    }

    if (step === "route") {
      if (initialStep === "route") {
        onBackPress?.();
        return;
      }

      setStep("routeSetup");
      return;
    }

    if (step === "addressList") {
      setStep("route");
      return;
    }

    if (step === "routeSetup") {
      setStep("form");
      return;
    }

    onBackPress?.();
  };

  if (step === "route") {
    return (
      <ScheduleRouteMapStep
        activePlaceType={activePlaceType}
        headerTitle={initialStep === "route" ? "경로 재설정" : mapTitle}
        initialDestination={routePlaces.destination}
        initialOrigin={routePlaces.origin}
        onBackPress={handleBackPress}
        onPlaceSelect={(type, place) => {
          setRoutePlaces((current) => ({
            ...current,
            [type]: place,
          }));
          setStep("routeSetup");
        }}
        onAddressListPress={() =>
          setStep("addressList")
        }
        selectionMode
      />
    );
  }

  if (step === "addressList") {
    return (
      <AddressManagementScreen
        onBackPress={handleBackPress}
        onAddressSelect={(address) => {
          setRoutePlaces((current) => ({
            ...current,
            [activePlaceType]:
              createRoutePlace({
                label:
                  address.name ||
                  address.placeName ||
                  address.address ||
                  address.detail,
                name:
                  address.name ||
                  address.placeName,
                address:
                  address.address ||
                  address.detail,
                x: address.x,
                y: address.y,
                raw: address,
              }),
          }));
          setStep("routeSetup");
        }}
      />
    );
  }

  if (step === "routeSetup") {
    return (
      <ScheduleRouteSetupStep
        onBackPress={handleBackPress}
        onNextPress={() =>
          setStep("routeResult")
        }
        onPlacePress={(type) => {
          setActivePlaceType(type);
          setStep("route");
        }}
        places={routePlaces}
      />
    );
  }

  if (step === "routeResult") {
    return (
      <ScheduleRouteResultStep
        initialDestination={
          routePlaces.destination
        }
        initialOrigin={
          routePlaces.origin
        }
        onBackPress={
          handleBackPress
        }
        onRouteSelect={(
          route,
          places,
        ) => {
          if (onRouteConfigured) {
            onRouteConfigured(
              route,
              places,
            );

            return;
          }

          setSelectedRoute(route);
          setStep("alarmFinal");
        }}
      />
    );
  }

  if (step === "alarmFinal") {
    return (
      <ScheduleAlarmFinalStep
        arrivalTime={
          arrivalTime
        }
        onBackPress={
          handleBackPress
        }
        onPrevPress={() =>
          setStep("routeResult")
        }
        onSavePress={
          onBackPress
        }
        route={
          selectedRoute
        }
        routeName={
          routeName
        }
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        headerStyle={
          styles.header
        }
        onBackPress={
          handleBackPress
        }
        title="?뚮┝ 異붽?"
        titleStyle={
          styles.headerTitle
        }
        type="back"
      />

      <View style={styles.content}>
        <Text style={styles.heading}>
          留ㅼ씪 ?댁슜?섎뒗 寃쎈줈瑜?
          ?깅줉?댁＜?몄슂
        </Text>

        <Text style={styles.label}>
          寃쎈줈 ?대쫫???낅젰?댁＜?몄슂
          (?좏깮)
        </Text>

        <TextInput
          onChangeText={
            setRouteName
          }
          placeholder="寃쎈줈 01"
          placeholderTextColor={
            colors.gray06
          }
          style={
            styles.textInput
          }
          value={routeName}
        />

        <Text
          style={[
            styles.label,
            styles.timeLabel,
          ]}
        >
          紐??쒓퉴吏 ?꾩갑?섍퀬
          ?띠쑝?좉???
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            blurActiveElement();

            setIsTimePickerVisible(
              true,
            );
          }}
          style={
            styles.timeInput
          }
        >
          <Text
            style={
              styles.timeInputText
            }
          >
            {formattedTime}
          </Text>

          <ChevronDownIcon />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={onBackPress}
          style={
            styles.cancelButton
          }
        >
          <Text
            style={
              styles.cancelButtonText
            }
          >
            痍⑥냼
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={
            handleNextPress
          }
          style={
            styles.nextButton
          }
        >
          <Text
            style={
              styles.nextButtonText
            }
          >
            ?ㅼ쓬
          </Text>
        </Pressable>
      </View>

      <TimePickerSheet
        onClose={() => {
          blurActiveElement();

          setIsTimePickerVisible(
            false,
          );
        }}
        onConfirm={(time) => {
          blurActiveElement();

          setArrivalTime(time);

          setIsTimePickerVisible(
            false,
          );
        }}
        value={arrivalTime}
        visible={
          isTimePickerVisible
        }
      />
    </View>
  );
}

function ScheduleRouteSetupStep({
  onBackPress,
  onNextPress,
  onPlacePress,
  places,
}) {
  const originText =
    getRoutePlaceText(places.origin);

  const destinationText =
    getRoutePlaceText(places.destination);

  const canGoNext =
    Boolean(originText) &&
    Boolean(destinationText);

  return (
    <View style={styles.screen}>
      <Header
        headerStyle={
          styles.header
        }
        onBackPress={
          onBackPress
        }
        title="?뚮┝ 異붽?"
        titleStyle={
          styles.headerTitle
        }
        type="back"
      />

      <View
        style={
          styles.routeSetupContent
        }
      >
        <Text
          style={
            styles.routeSetupHeading
          }
        >
          출발지와 도착지를 지정해주세요.
        </Text>

        <PlaceSelectField
          label="출발지"
          onPress={() =>
            onPlacePress("origin")
          }
          place={places.origin}
          placeholder="출발지를 지정해주세요."
        />

        <PlaceSelectField
          label="도착지"
          onPress={() =>
            onPlacePress("destination")
          }
          place={places.destination}
          placeholder="도착지를 지정해주세요."
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={onBackPress}
          style={
            styles.cancelButton
          }
        >
          <Text
            style={
              styles.cancelButtonText
            }
          >
            ?댁쟾
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={!canGoNext}
          onPress={onNextPress}
          style={[
            styles.nextButton,
            !canGoNext &&
              styles.nextButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.nextButtonText,
              !canGoNext &&
                styles.nextButtonTextDisabled,
            ]}
          >
            ?ㅼ쓬
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PlaceSelectField({
  label,
  onPress,
  placeholder,
  place,
}) {
  const value =
    getRoutePlaceText(place);

  const address =
    value
      ? getRoutePlaceAddress(place)
      : "";

  const hasDetail =
    Boolean(address) &&
    address !== value;

  return (
    <View
      style={
        styles.placeSelectGroup
      }
    >
      <Text
        style={
          styles.placeSelectLabel
        }
      >
        {label}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={
          styles.placeSelectButton
        }
      >
        <View
          style={
            styles.placeSelectTextGroup
          }
        >
          <Text
            numberOfLines={1}
            style={[
              styles.placeSelectText,
              value &&
                styles.placeSelectTextFilled,
            ]}
          >
            {value || placeholder}
          </Text>

          {hasDetail ? (
            <Text
              numberOfLines={1}
              style={
                styles.placeSelectDetail
              }
            >
              {address}
            </Text>
          ) : null}
        </View>

        <ChevronRightIcon />
      </Pressable>
    </View>
  );
}

export function ScheduleRouteMapStep({
  headerTitle = "寃쎈줈 ?ㅼ젙",
  activePlaceType: initialActivePlaceType = "origin",
  initialDestination,
  initialOrigin,
  isLoadingCurrentAddress,
  currentAddressError,
  onBackPress,
  onConfirm,
  onAddressListPress,
  onPlaceSelect,
  selectionMode = false,
}) {
  const { height } =
    useWindowDimensions();

  const SHEET_COLLAPSED_VISIBLE_HEIGHT =
    36;

  const sheetHeight =
    Math.round(
      (height * 3) / 8,
    );

  const SHEET_EXPANDED_OFFSET = 0;

  const SHEET_COLLAPSED_OFFSET =
    Math.max(
      sheetHeight -
        SHEET_COLLAPSED_VISIBLE_HEIGHT,
      0,
    );

  const [
    placeKeyword,
    setPlaceKeyword,
  ] = useState("");

  const placeSearchInputRef =
    useRef(null);

  /*
   * 遺紐⑥뿉??媛?몄삩 ?꾩옱 二쇱냼瑜?
   * 珥덇린媛믪쑝濡??ъ슜
   */
  const [
    origin,
    setOrigin,
  ] = useState(() =>
    createRoutePlace(
      initialOrigin,
    ),
  );

  const [
    destination,
    setDestination,
  ] = useState(() =>
    createRoutePlace(
      initialDestination,
    ),
  );

  /*
   * 二쇱냼 API媛 鍮꾨룞湲곕줈 ?꾨즺?섍린 ?뚮Ц??
   * initialOrigin / initialDestination
   * 蹂寃???state ?숆린??
   */
  const hasEditedOrigin =
    useRef(false);

  const hasEditedDestination =
    useRef(false);

  useEffect(() => {
    if (
      hasEditedOrigin.current
    ) {
      return;
    }

    setOrigin(
      createRoutePlace(
        initialOrigin,
      ),
    );
  }, [initialOrigin]);

  useEffect(() => {
    if (
      hasEditedDestination.current
    ) {
      return;
    }

    setDestination(
      createRoutePlace(
        initialDestination,
      ),
    );
  }, [initialDestination]);

  const [
    activePlaceType,
    setActivePlaceType,
  ] = useState(initialActivePlaceType);

  const [
    placeResults,
    setPlaceResults,
  ] = useState([]);

  const [
    isSearchingPlaces,
    setIsSearchingPlaces,
  ] = useState(false);

  const [
    placeSearchError,
    setPlaceSearchError,
  ] = useState("");

  const trimmedPlaceKeyword =
    placeKeyword.trim();

  const hasPlaceKeyword =
    trimmedPlaceKeyword.length >
    0;

  const focusPlaceSearch = (
    type,
  ) => {
    setActivePlaceType(type);
    setPlaceKeyword("");
    setPlaceResults([]);
    setPlaceSearchError("");

    requestAnimationFrame(() => {
      placeSearchInputRef.current?.focus?.();
    });
  };

  const sheetTranslateY =
    useRef(
      new Animated.Value(
        SHEET_EXPANDED_OFFSET,
      ),
    ).current;

  const lastSheetOffset =
    useRef(
      SHEET_EXPANDED_OFFSET,
    );

  const panResponder =
    useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder:
          (
            _,
            gestureState,
          ) =>
            Math.abs(
              gestureState.dy,
            ) > 4,

        onPanResponderMove: (
          _,
          gestureState,
        ) => {
          const nextOffset =
            Math.min(
              Math.max(
                lastSheetOffset.current +
                  gestureState.dy,

                SHEET_EXPANDED_OFFSET,
              ),

              SHEET_COLLAPSED_OFFSET,
            );

          sheetTranslateY.setValue(
            nextOffset,
          );
        },

        onPanResponderRelease: (
          _,
          gestureState,
        ) => {
          const releasedOffset =
            Math.min(
              Math.max(
                lastSheetOffset.current +
                  gestureState.dy,

                SHEET_EXPANDED_OFFSET,
              ),

              SHEET_COLLAPSED_OFFSET,
            );

          const snapMiddle =
            (SHEET_EXPANDED_OFFSET +
              SHEET_COLLAPSED_OFFSET) /
            2;

          const nextOffset =
            releasedOffset <
            snapMiddle
              ? SHEET_EXPANDED_OFFSET
              : SHEET_COLLAPSED_OFFSET;

          lastSheetOffset.current =
            nextOffset;

          Animated.spring(
            sheetTranslateY,
            {
              toValue:
                nextOffset,

              useNativeDriver:
                false,
            },
          ).start();
        },

        onPanResponderTerminate: (
          _,
          gestureState,
        ) => {
          const releasedOffset =
            Math.min(
              Math.max(
                lastSheetOffset.current +
                  gestureState.dy,

                SHEET_EXPANDED_OFFSET,
              ),

              SHEET_COLLAPSED_OFFSET,
            );

          const snapMiddle =
            (SHEET_EXPANDED_OFFSET +
              SHEET_COLLAPSED_OFFSET) /
            2;

          const nextOffset =
            releasedOffset <
            snapMiddle
              ? SHEET_EXPANDED_OFFSET
              : SHEET_COLLAPSED_OFFSET;

          lastSheetOffset.current =
            nextOffset;

          Animated.spring(
            sheetTranslateY,
            {
              toValue:
                nextOffset,

              useNativeDriver:
                false,
            },
          ).start();
        },
      }),
    ).current;

  /*
   * ?μ냼 寃??
   */
  useEffect(() => {
    if (
      !hasPlaceKeyword
    ) {
      setPlaceResults([]);
      setPlaceSearchError("");
      setIsSearchingPlaces(
        false,
      );

      return undefined;
    }

    let isActive = true;

    const controller =
      new AbortController();

    const debounceId =
      setTimeout(
        async () => {
          setIsSearchingPlaces(
            true,
          );

          setPlaceSearchError("");

          try {
            const nextResults =
              await searchAddresses({
                keyword:
                  trimmedPlaceKeyword,

                signal:
                  controller.signal,
              });

            if (isActive) {
              setPlaceResults(
                Array.isArray(
                  nextResults,
                )
                  ? nextResults
                  : [],
              );
            }
          } catch (error) {
            if (
              isActive &&
              error?.name !==
                "AbortError"
            ) {
              setPlaceResults(
                [],
              );

              setPlaceSearchError(
                error?.message ??
                  "?μ냼 寃?됱뿉 ?ㅽ뙣?덉뒿?덈떎.",
              );
            }
          } finally {
            if (isActive) {
              setIsSearchingPlaces(
                false,
              );
            }
          }
        },
        300,
      );

    return () => {
      isActive = false;

      clearTimeout(
        debounceId,
      );

      controller.abort();
    };
  }, [
    hasPlaceKeyword,
    trimmedPlaceKeyword,
  ]);

  const updateTypedPlace = (
    type,
    value,
  ) => {
    const nextPlace =
      createRoutePlace(value);

    if (type === "origin") {
      hasEditedOrigin.current =
        true;

      setOrigin(nextPlace);

      return;
    }

    hasEditedDestination.current =
      true;

    setDestination(nextPlace);
  };

  const selectPlaceResult = (
    result,
  ) => {
    const nextPlace =
      createRoutePlaceFromSearchResult(
        result,
      );

    if (selectionMode) {
      onPlaceSelect?.(
        activePlaceType,
        nextPlace,
      );
      return;
    }

    if (
      activePlaceType ===
      "origin"
    ) {
      hasEditedOrigin.current =
        true;

      setOrigin(nextPlace);

      setActivePlaceType(
        "destination",
      );
    } else {
      hasEditedDestination.current =
        true;

      setDestination(
        nextPlace,
      );
    }

    setPlaceKeyword("");
    setPlaceResults([]);
    setPlaceSearchError("");
  };

  const mapCenter = getMapCenterFromPlaces(
    origin,
    destination,
    activePlaceType,
  );

  return (
    <View
      style={
        styles.mapScreen
      }
    >
      <NaverMapView center={mapCenter ?? undefined} />

      <View
        style={
          styles.mapHeaderLayer
        }
      >
        <Header
          headerStyle={
            styles.mapHeader
          }
          onBackPress={
            onBackPress
          }
          title={
            selectionMode
              ? ""
              : headerTitle
          }
          titleStyle={
            styles.headerTitle
          }
          type="back"
        />

        <View
          style={
            styles.placeSearchBox
          }
        >
          <SearchIcon />

          <TextInput
            onChangeText={
              setPlaceKeyword
            }
            placeholder={
              activePlaceType ===
              "origin"
                ? "출발지 장소명 또는 건물명으로 검색"
                : "도착지 장소명 또는 건물명으로 검색"
            }
            placeholderTextColor={
              colors.gray06
            }
            style={
              styles.placeSearchInput
            }
            value={
              placeKeyword
            }
          />
        </View>

        {hasPlaceKeyword ? (
          <View
            style={
              styles.placeResultPanel
            }
          >
            {isSearchingPlaces ? (
              <Text
                style={
                  styles.placeResultStatus
                }
              >
                ?μ냼瑜?寃?됲븯??
                以묒엯?덈떎.
              </Text>
            ) : placeSearchError ? (
              <Text
                style={
                  styles.placeResultStatus
                }
              >
                {
                  placeSearchError
                }
              </Text>
            ) : placeResults.length ===
              0 ? (
              <Text
                style={
                  styles.placeResultStatus
                }
              >
                寃??寃곌낵媛
                ?놁뒿?덈떎.
              </Text>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={
                  false
                }
                style={
                  styles.placeResultList
                }
              >
                {placeResults.map(
                  (result) => (
                    <Pressable
                      accessibilityRole="button"
                      key={
                        result.id ??
                        `${result.name}-${result.address}-${result.roadAddress}`
                      }
                      onPress={() =>
                        selectPlaceResult(
                          result,
                        )
                      }
                      style={
                        styles.placeResultRow
                      }
                    >
                      <Text
                        numberOfLines={
                          1
                        }
                        style={
                          styles.placeResultName
                        }
                      >
                        {
                          result.name
                        }
                      </Text>

                      <Text
                        numberOfLines={
                          1
                        }
                        style={
                          styles.placeResultAddress
                        }
                      >
                        {result.roadAddress ||
                          result.address}
                      </Text>
                    </Pressable>
                  ),
                )}
              </ScrollView>
            )}
          </View>
        ) : null}
      </View>

      {!selectionMode ? (
      <Animated.View
        style={[
          styles.routeSheet,

          {
            height:
              sheetHeight,
          },

          {
            transform: [
              {
                translateY:
                  sheetTranslateY,
              },
            ],
          },
        ]}
      >
        <View
          style={
            styles.routeSheetHandleArea
          }
          {...panResponder.panHandlers}
        >
          <View
            style={
              styles.sheetHandle
            }
          />
        </View>

        <View
          style={
            styles.routeSheetContent
          }
        >
          <Text
            style={
              styles.routeFieldLabel
            }
          >
            異쒕컻吏
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setActivePlaceType(
                "origin",
              )
            }
            style={[
              styles.routeField,

              activePlaceType ===
                "origin" &&
                styles.routeFieldActive,
            ]}
          >
            <TextInput
              onChangeText={(
                value,
              ) =>
                updateTypedPlace(
                  "origin",
                  value,
                )
              }
              onFocus={() =>
                setActivePlaceType(
                  "origin",
                )
              }
              placeholder={
                isLoadingCurrentAddress
                  ? "?꾩옱 二쇱냼 遺덈윭?ㅻ뒗 以?.."
                  : currentAddressError
                    ? "異쒕컻吏 ?낅젰"
                    : "異쒕컻吏 ?낅젰"
              }
              placeholderTextColor={
                colors.gray06
              }
              style={
                styles.routeFieldInput
              }
              value={
                getRoutePlaceText(
                  origin,
                )
              }
            />
          </Pressable>

          <Text
            style={
              styles.routeFieldLabel
            }
          >
            ?꾩갑吏
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setActivePlaceType(
                "destination",
              )
            }
            style={[
              styles.routeField,

              activePlaceType ===
                "destination" &&
                styles.routeFieldActive,
            ]}
          >
            <TextInput
              onChangeText={(
                value,
              ) =>
                updateTypedPlace(
                  "destination",
                  value,
                )
              }
              onFocus={() =>
                setActivePlaceType(
                  "destination",
                )
              }
              placeholder={
                isLoadingCurrentAddress
                  ? "?꾩옱 二쇱냼 遺덈윭?ㅻ뒗 以?.."
                  : "?꾩갑吏 ?낅젰"
              }
              placeholderTextColor={
                colors.gray06
              }
              style={
                styles.routeFieldInput
              }
              value={
                getRoutePlaceText(
                  destination,
                )
              }
            />
          </Pressable>

          {currentAddressError &&
          !getRoutePlaceText(
            origin,
          ) ? (
            <Text
              style={
                styles.currentAddressError
              }
            >
              {
                currentAddressError
              }
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            onConfirm({
              origin,
              destination,
            })
          }
          style={
            styles.mapConfirmButton
          }
        >
          <Text
            style={
              styles.mapConfirmButtonText
            }
          >
            ?뺤씤
          </Text>
        </Pressable>
      </Animated.View>
      ) : (
        <View
          style={
            styles.mapAddressListFooter
          }
        >
          <Pressable
            accessibilityRole="button"
            onPress={onAddressListPress}
            style={
              styles.mapAddressListButton
            }
          >
            <Text
              style={
                styles.mapAddressListButtonText
              }
            >
              二쇱냼 紐⑸줉?먯꽌 遺덈윭?ㅺ린
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function ScheduleRouteResultStep({
  actionLabel = "??寃쎈줈濡??뚮┝ ?ㅼ젙",
  initialDestination,
  initialOrigin,
  onBackPress,
  onRouteSelect,
}) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatClockTime = (timestamp) => {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };
  const [
    origin,
    setOrigin,
  ] = useState(
    createRoutePlace(
      initialOrigin,
    ),
  );

  const [
    destination,
    setDestination,
  ] = useState(
    createRoutePlace(
      initialDestination,
    ),
  );

  const [routes, setRoutes] =
    useState([]);
  const minimumDuration = Math.min(...routes.map((route) =>
    route.realTimeDurationMinutes ?? route.totalDurationMinutes ?? Infinity,
  ));

  const [
    isLoadingRoutes,
    setIsLoadingRoutes,
  ] = useState(false);

  const [
    routeError,
    setRouteError,
  ] = useState("");

  useEffect(() => {
    let isActive = true;

    const controller =
      new AbortController();

    async function loadTransitRoutes() {
      setIsLoadingRoutes(true);
      setRouteError("");

      try {
        const nextRoutes =
        await searchTransitRoutes({
          originX: origin.x,
          originY: origin.y,

          originAddress:
            getRoutePlaceAddress(origin),

          destX: destination.x,
          destY: destination.y,

          destAddress:
            getRoutePlaceAddress(destination),

          signal: controller.signal,
        });

        if (isActive) {
          setRoutes(
            Array.isArray(
              nextRoutes,
            )
              ? nextRoutes
              : [],
          );
        }
      } catch (error) {
        if (
          isActive &&
          error?.name !==
            "AbortError"
        ) {
          setRoutes([]);

          setRouteError(
            error?.message ??
              "?以묎탳??寃쎈줈 寃?됱뿉 ?ㅽ뙣?덉뒿?덈떎.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingRoutes(
            false,
          );
        }
      }
    }

    loadTransitRoutes();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    destination,
    origin,
  ]);

  const updateOriginText = (
    value,
  ) => {
    setOrigin(
      createRoutePlace(
        value,
      ),
    );
  };

  const updateDestinationText = (
    value,
  ) => {
    setDestination(
      createRoutePlace(
        value,
      ),
    );
  };

  return (
    <View
      style={
        styles.resultScreen
      }
    >
      <View
        style={
          styles.resultHeader
        }
      >
        <Pressable
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
          hitSlop={12}
          onPress={
            onBackPress
          }
          style={
            styles.resultBackButton
          }
        >
          <RouteBackIcon width={24} height={24} />
        </Pressable>

        <View
          style={
            styles.routeSummaryPill
          }
        >
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={
              styles.routeSummaryInput
            }
          >
            {getRoutePlaceText(
              origin,
            ) || "異쒕컻吏"}
          </Text>

          <RouteArrowIcon width={20} height={20} />

          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={
              styles.routeSummaryInput
            }
          >
            {getRoutePlaceText(
              destination,
            ) || "?꾩갑吏"}
          </Text>

          <RouteClearIcon width={20} height={20} />
        </View>
      </View>

      <View
        style={
          styles.resultNotice
        }
      >
        <Text
          style={
            styles.resultNoticeText
          }
        >
          ?꾨줈 ?곹솴???곕씪 ?ㅼ젣
          ?꾩갑 ?쒓컙? ?щ씪吏???
          ?덉뼱??
        </Text>
      </View>

      <ScrollView style={styles.routeResultContent} contentContainerStyle={styles.routeResultList}>
        {isLoadingRoutes ? (
          <View
            style={
              styles.routeStatusBox
            }
          >
            <Text
              style={
                styles.routeStatusText
              }
            >
              寃쎈줈瑜?寃?됲븯??
              以묒엯?덈떎.
            </Text>
          </View>
        ) : routeError ||
          routes.length === 0 ? (
          <View
            style={
              styles.routeStatusBox
            }
          >
            <Text
              style={
                styles.routeStatusText
              }
            >
              {routeError ||
                "寃?됰맂 寃쎈줈媛 ?놁뒿?덈떎."}
            </Text>
          </View>
        ) : (
          routes.map((selectedRoute, routeIndex) => {
            const primarySegment = getPrimaryTransitSegment(selectedRoute);
            const displayDuration = selectedRoute.realTimeDurationMinutes ?? selectedRoute.totalDurationMinutes ?? 0;
            return (
          <View key={selectedRoute.id ?? `route-${routeIndex}`} style={styles.routeResultCard}>
            {routeIndex === 0 || displayDuration === minimumDuration ? (
              <View style={styles.optionBadges}>
                {routeIndex === 0 ? (
                  <View style={styles.optionBadge}>
                    <Text style={styles.optionBadgeText}>理쒖쟻</Text>
                  </View>
                ) : null}
                {displayDuration === minimumDuration ? (
                  <View style={styles.optionBadge}>
                    <Text style={styles.optionBadgeText}>理쒖냼 ?쒓컙</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View
              style={
                styles.totalTimeRow
              }
            >
              <View style={styles.routeClockRow}>
                <Text accessibilityLabel={`?꾩옱 ?쒓컖 ${formatClockTime(currentTime)}`} style={styles.routeDepartureTime}>
                  {formatClockTime(currentTime)}
                </Text>
                <RouteArrowIcon width={20} height={20} />
                <Text accessibilityLabel={`?덉긽 ?꾩갑 ?쒓컖 ${formatClockTime(currentTime + displayDuration * 60000)}`} style={styles.routeArrivalTime}>
                  {formatClockTime(currentTime + displayDuration * 60000)}
                </Text>
              </View>
              <View style={styles.routeDurationRow}>
              <Text
                style={
                  styles.totalTimeNumber
                }
              >
                {
                  displayDuration
                }
              </Text>

              <Text
                style={
                  styles.totalTimeUnit
                }
              >
                遺?
              </Text>
              </View>
            </View>

            <RouteTimeline
              style={styles.routeTimeline}
              segments={
                selectedRoute.segments ??
                []
              }
            />

            <View
              style={
                styles.routeDivider
              }
            />

            <View
              style={
                styles.routeBusInfo
              }
            >
              <View
                style={
                  styles.routeBusBadge
                }
              >
                <BigBusAsset width={9} height={10} />
              </View>

              <Text
                style={
                  styles.routeBusNumber
                }
              >
                {primarySegment?.transitName ||
                  "대중교통"}
              </Text>

              <Text
                style={
                  styles.routeBusDirection
                }
              >
                {primarySegment?.endStation
                  ? ` 쨌 ${primarySegment.endStation} 諛⑸㈃`
                  : ""}
              </Text>
            </View>

            <View
              style={
                styles.routeStops
              }
            >
              <StopLineAsset width={1} height={34} style={styles.resultStopLine} />
              <StopRow
                active
                label="?뱀감"
                name={
                  getSegmentStopName(
                    primarySegment,
                    "start",
                  ) ||
                  getRoutePlaceText(
                    origin,
                  )
                }
              />

              <StopRow
                label="?섏감"
                name={
                  getSegmentStopName(
                    primarySegment,
                    "end",
                  ) ||
                  getRoutePlaceText(
                    destination,
                  )
                }
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                onRouteSelect?.(
                  selectedRoute,

                  {
                    departureTimestamp: currentTime,
                    origin:
                      getRoutePlaceText(
                        origin,
                      ),

                    destination:
                      getRoutePlaceText(
                        destination,
                      ),

                    originPlace:
                      origin,

                    destinationPlace:
                      destination,
                  },
                )
              }
              style={
                styles.routeAlarmButton
              }
            >
              <Text
                style={
                  styles.routeAlarmButtonText
                }
              >
                {actionLabel}
              </Text>
            </Pressable>
          </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function ScheduleAlarmFinalStep({
  arrivalTime,
  onBackPress,
  onPrevPress,
  onSavePress,
  route,
  routeName,
}) {
  const [
    selectedDays,
    setSelectedDays,
  ] = useState([]);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    isReminderModalVisible,
    setIsReminderModalVisible,
  ] = useState(false);

  const [
    reminders,
    setReminders,
  ] = useState({
    1: false,
    3: false,
    5: true,
    10: true,
    15: false,
    30: true,
    60: false,
  });

  const days = [
    "월",
    "화",
    "수",
    "목",
    "금",
    "토",
    "일",
  ];

  const primarySegment =
    getPrimaryTransitSegment(
      route,
    );

  const selectedReminderOffsets =
    pickReminderOffsets(
      reminders,
    );

  const selectedRouteName =
    routeName.trim() ||
    [
      route?.originAddress,
      route?.destinationAddress,
    ]
      .filter(Boolean)
      .join("-") ||
    "경로1";

  const targetArrivalTime =
    toTargetArrivalTime(
      arrivalTime,
    );
  
  const formattedArrivalTime =
    `${arrivalTime.period} ${arrivalTime.hour} : ${arrivalTime.minute}`;

  const displayDuration =
    route?.realTimeDurationMinutes ??
    route?.totalDurationMinutes ??
    0;
  const getFormattedStartTime = (
    arrivalTime,
    durationMinutes,
  ) => {
    let hour = Number(arrivalTime.hour);
    const minute = Number(arrivalTime.minute);

    // 12?쒓컙????24?쒓컙??
    if (arrivalTime.period === "?ㅽ썑" && hour !== 12) {
      hour += 12;
    }

    if (arrivalTime.period === "?ㅼ쟾" && hour === 12) {
      hour = 0;
    }

    let totalMinutes =
      hour * 60 +
      minute -
      Number(durationMinutes || 0);

    // ?먯젙???섏뼱 ?꾨궇濡?媛??寃쎌슦
    totalMinutes =
      ((totalMinutes % 1440) + 1440) % 1440;

    const startHour24 =
      Math.floor(totalMinutes / 60);

    const startMinute =
      totalMinutes % 60;

    const period =
      startHour24 >= 12
        ? "?ㅽ썑"
        : "?ㅼ쟾";

    let startHour12 =
      startHour24 % 12;

    if (startHour12 === 0) {
      startHour12 = 12;
    }

    return `${period} ${String(startHour12).padStart(
      2,
      "0",
    )} : ${String(startMinute).padStart(2, "0")}`;
  };

  const formattedStartTime =
    getFormattedStartTime(
      arrivalTime,
      displayDuration,
    );

  const reminderSummaryText =
    selectedReminderOffsets.length >
    0
      ? `${selectedReminderOffsets.join(
          ", ",
        )}遺????뚮┝`
      : "?뚮┝ ?쒓컙 ?좏깮";

  const finalInfoText =
    `${formattedArrivalTime}源뚯? ?꾩갑?섏떎 ???덈룄濡?`;

  const finalInfoSubText =
    `異쒕컻 ?곸젙 ?쒓컙 ${selectedReminderOffsets.join(
      ", ",
    )}遺??꾩뿉 ?뚮┝???뚮젮?쒕┫寃뚯슂.`;
  const toggleDay = (day) => {
    setSelectedDays(
      (current) =>
        current.includes(day)
          ? current.filter(
              (
                selectedDay,
              ) =>
                selectedDay !==
                day,
            )
          : [
              ...current,
              day,
            ],
    );
  };

  const toggleReminder = (
    key,
  ) => {
    setReminders(
      (current) => ({
        ...current,

        [key]:
          !current[key],
      }),
    );
  };

  const saveAlarm =
    async () => {
      if (isSubmitting) {
        return;
      }

      if (!route) {
        Alert.alert(
          "?뚮┝ ?깅줉 ?ㅽ뙣",
          "?깅줉??寃쎈줈 ?뺣낫瑜?李얠? 紐삵뻽?듬땲??",
        );

        return;
      }

      if (
        selectedReminderOffsets.length ===
        0
      ) {
        Alert.alert(
          "?뚮┝ ?깅줉 ?ㅽ뙣",
          "異쒕컻 ???뚮┝ ?쒓컙???좏깮?댁＜?몄슂.",
        );

        return;
      }

      setIsSubmitting(true);

      try {
        await createArrivalNotification(
          {
            payload: {
              routeName:
                selectedRouteName,

              scheduleType:
                "NORMAL",

              targetArrivalTime,

              reminderOffsetMinutes:
                selectedReminderOffsets,

              repeatDays:
                selectedDays
                  .map(
                    mapDayToApiValue,
                  )
                  .filter(Boolean),

              routeDetails:
                JSON.stringify(
                  route.raw ??
                    route,
                ),
            },
          },
        );

        onSavePress?.();
      } catch (error) {
        Alert.alert(
          "?뚮┝ ?깅줉 ?ㅽ뙣",

          error?.message ??
            "???쇱젙 ?뚮┝ ?깅줉???ㅽ뙣?덉뒿?덈떎.",
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  return (
    <View
      style={
        styles.finalScreen
      }
    >
      <Header
        headerStyle={
          styles.header
        }
        onBackPress={
          onBackPress
        }
        title="?뚮┝ 異붽?"
        titleStyle={
          styles.headerTitle
        }
        type="back"
      />

      <View
        style={
          styles.finalRouteHeader
        }
      >
        <View
          style={
            styles.finalBusInfo
          }
        >
          <View
            style={
              styles.routeBusBadge
            }
          >
            <BusIconPlain />
          </View>

          <Text
            style={
              styles.routeBusNumber
            }
          >
            {primarySegment?.transitName ||
              "대중교통"}
          </Text>

          <Text
            style={
              styles.routeBusDirection
            }
          >
            {primarySegment?.endStation
              ? `쨌 ${primarySegment.endStation} 諛⑸㈃`
              : ""}
          </Text>
        </View>

        <View
          style={
            styles.finalTotalTime
          }
        >
          <Text
            style={
              styles.finalTotalTimeNumber
            }
          >
            {displayDuration}
          </Text>

          <Text
            style={
              styles.finalTotalTimeUnit
            }
          >
            분
          </Text>
        </View>
      </View>

      <View
        style={
          styles.finalContent
        }
      >
        <View
          style={
            styles.timeSummaryRow
          }
        >
          <View
            style={
              styles.timeSummaryBlock
            }
          >
            <Text
              style={
                styles.finalLabel
              }
            >
              출발 적정 시간
            </Text>

            <View
              style={
                styles.timeCard
              }
            >
              <Text
                style={
                  styles.timeCardText
                }
              >
                {
                  formattedStartTime
                }
              </Text>
            </View>
          </View>

          <ChevronRightIcon />

          <View
            style={
              styles.timeSummaryBlock
            }
          >
            <Text
              style={
                styles.finalLabel
              }
            >
              도착 예정 시간
            </Text>

            <View
              style={
                styles.timeCard
              }
            >
              <Text
                style={
                  styles.timeCardText
                }
              >
                {
                  formattedArrivalTime
                }
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          style={
            styles.resetRouteButton
          }
        >
          <Text
            style={
              styles.resetRouteButtonText
            }
          >
            경로 및 시간 재설정
          </Text>
        </Pressable>
      </View>

      <View
        style={
          styles.finalDivider
        }
      />

      <View
        style={
          styles.finalContent
        }
      >
        <Text
          style={
            styles.questionText
          }
        >
          출발 시간 몇 분 전에 알려드릴까요?
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            blurActiveElement();

            setIsReminderModalVisible(
              true,
            );
          }}
          style={
            styles.reminderSelect
          }
        >
          <Text
            style={
              styles.reminderSelectText
            }
          >
            {reminderSummaryText}
          </Text>

          <ChevronDownIcon />
        </Pressable>

        <View
          style={
            styles.dayRow
          }
        >
          {days.map(
            (day) => {
              const selected =
                selectedDays.includes(
                  day,
                );

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    selected,
                  }}
                  key={day}
                  onPress={() =>
                    toggleDay(
                      day,
                    )
                  }
                  style={[
                    styles.dayButton,

                    selected &&
                      styles.dayButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayButtonText,

                      selected &&
                        styles.dayButtonTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
      </View>

      <View
        style={
          styles.finalFooter
        }
      >
        <View
          style={
            styles.finalInfoBox
          }
        >
          <Text
            style={
              styles.finalInfoText
            }
          >
            {finalInfoText}
          </Text>

          <Text
            style={
              styles.finalInfoText
            }
          >
            {finalInfoSubText}
          </Text>
        </View>

        <View
          style={
            styles.finalButtonRow
          }
        >
          <Pressable
            accessibilityRole="button"
            onPress={
              onPrevPress
            }
            style={
              styles.prevButton
            }
          >
            <Text
              style={
                styles.prevButtonText
              }
            >
              이전
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={
              isSubmitting
            }
            onPress={
              saveAlarm
            }
            style={[
              styles.saveButton,

              isSubmitting &&
                styles.saveButtonDisabled,
            ]}
          >
            <Text
              style={
                styles.saveButtonText
              }
            >
              {isSubmitting
                ? "저장 중"
                : "저장"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ReminderModal
        onClose={() => {
          blurActiveElement();

          setIsReminderModalVisible(
            false,
          );
        }}
        onToggle={
          toggleReminder
        }
        reminders={
          reminders
        }
        visible={
          isReminderModalVisible
        }
      />
    </View>
  );
}

function ReminderModal({
  onClose,
  onToggle,
  reminders,
  visible,
}) {
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
    <Modal
      animationType="fade"
      onRequestClose={
        onClose
      }
      transparent
      visible={visible}
    >
      <View
        style={
          styles.reminderOverlay
        }
      >
        <View
          style={
            styles.reminderCard
          }
        >
          <View
            style={
              styles.reminderHeader
            }
          >
            <Text
              style={
                styles.reminderTitle
              }
            >
              誘몃━ ?뚮┝ ?ㅼ젙
            </Text>

            <Pressable
              accessibilityLabel="誘몃━ ?뚮┝ ?ㅼ젙 ?リ린"
              accessibilityRole="button"
              hitSlop={10}
              onPress={
                onClose
              }
              style={
                styles.reminderCloseButton
              }
            >
              <CloseIcon />
            </Pressable>
          </View>

          <View
            style={
              styles.reminderList
            }
          >
            {options.map(
              ([
                key,
                label,
              ]) => (
                <View
                  key={key}
                  style={
                    styles.reminderRow
                  }
                >
                  <Text
                    style={
                      styles.reminderOptionText
                    }
                  >
                    {label}
                  </Text>

                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{
                      checked:
                        reminders[
                          key
                        ],
                    }}
                    onPress={() =>
                      onToggle(
                        key,
                      )
                    }
                    style={[
                      styles.reminderSwitch,

                      reminders[
                        key
                      ] &&
                        styles.reminderSwitchOn,
                    ]}
                  >
                    <View
                      style={
                        styles.reminderSwitchThumb
                      }
                    />
                  </Pressable>
                </View>
              ),
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StopRow({
  active = false,
  label,
  name,
}) {
  return (
    <View
      style={styles.stopRow}
    >
      <View
        style={[
          styles.stopOuter,

          active &&
            styles.stopOuterActive,
        ]}
      >
        <View
          style={[
            styles.stopInner,

            active &&
              styles.stopInnerActive,
          ]}
        >
          <View style={styles.stopCenter} />
        </View>
      </View>

      <Text
        style={
          styles.stopLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.stopName
        }
      >
        {name}
      </Text>
    </View>
  );
}

function TimePickerSheet({
  onClose,
  onConfirm,
  value,
  visible,
}) {
  const [
    draftTime,
    setDraftTime,
  ] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraftTime(value);
    }
  }, [value, visible]);

  const selectTime = (
    patch,
  ) => {
    setDraftTime(
      (current) => ({
        ...current,
        ...patch,
      }),
    );
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={
        onClose
      }
      transparent
      visible={visible}
    >
      <View
        style={
          styles.sheetOverlay
        }
      >
        <Pressable
          style={
            styles.sheetDim
          }
          onPress={
            onClose
          }
        />

        <View
          style={styles.sheet}
        >
          <View
            style={
              styles.sheetHandle
            }
          />

          <View
            style={
              styles.pickerRows
            }
          >
            <WheelPickerColumn
              accessibilityLabel="?ㅼ쟾 ?ㅽ썑 ?좏깮"
              onChange={(
                period,
              ) =>
                selectTime({
                  period,
                })
              }
              options={
                PERIOD_OPTIONS
              }
              value={
                draftTime.period
              }
              visible={visible}
            />

            <WheelPickerColumn
              accessibilityLabel="???좏깮"
              onChange={(
                hour,
              ) =>
                selectTime({
                  hour,
                })
              }
              options={
                HOUR_OPTIONS
              }
              value={
                draftTime.hour
              }
              visible={visible}
            />

            <Text
              style={
                styles.pickerSeparator
              }
            >
              :
            </Text>

            <WheelPickerColumn
              accessibilityLabel="遺??좏깮"
              onChange={(
                minute,
              ) =>
                selectTime({
                  minute,
                })
              }
              options={
                MINUTE_OPTIONS
              }
              value={
                draftTime.minute
              }
              visible={visible}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              onConfirm(
                draftTime,
              )
            }
            style={
              styles.confirmButton
            }
          >
            <Text
              style={
                styles.confirmButtonText
              }
            >
              ?뺤씤
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function WheelPickerColumn({
  accessibilityLabel,
  onChange,
  options,
  value,
  visible,
}) {
  const scrollRef =
    useRef(null);

  const selectedIndex =
    Math.max(
      options.indexOf(value),
      0,
    );

  const scrollToIndex = (
    index,
    animated = true,
  ) => {
    scrollRef.current?.scrollTo(
      {
        animated,

        y:
          index *
          TIME_PICKER_ITEM_HEIGHT,
      },
    );
  };

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const scrollTimer =
      setTimeout(() => {
        scrollToIndex(
          selectedIndex,
          false,
        );
      }, 0);

    return () => {
      clearTimeout(
        scrollTimer,
      );
    };
  }, [
    selectedIndex,
    visible,
  ]);

  const handleScrollEnd = (
    event,
  ) => {
    const offsetY =
      event.nativeEvent
        .contentOffset?.y ??
      0;

    const nextIndex =
      Math.min(
        Math.max(
          Math.round(
            offsetY /
              TIME_PICKER_ITEM_HEIGHT,
          ),
          0,
        ),

        options.length - 1,
      );

    const nextValue =
      options[nextIndex];

    scrollToIndex(
      nextIndex,
    );

    if (
      nextValue !== value
    ) {
      onChange(nextValue);
    }
  };

  return (
    <View
      style={
        styles.pickerColumn
      }
    >
      <ScrollView
        accessibilityLabel={
          accessibilityLabel
        }
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={
          handleScrollEnd
        }
        onScrollEndDrag={
          handleScrollEnd
        }
        ref={
          scrollRef
        }
        showsVerticalScrollIndicator={
          false
        }
        snapToInterval={
          TIME_PICKER_ITEM_HEIGHT
        }
        style={
          styles.pickerScroll
        }
      >
        <View
          style={
            styles.pickerColumnSpacer
          }
        />

        {options.map(
          (option) => {
            const selected =
              option === value;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  selected,
                }}
                key={
                  option
                }
                onPress={() => {
                  onChange(
                    option,
                  );

                  scrollToIndex(
                    options.indexOf(
                      option,
                    ),
                  );
                }}
                style={
                  styles.pickerOption
                }
              >
                <View
                  style={[
                    styles.pickerOptionInner,

                    selected &&
                      styles.pickerOptionInnerSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,

                      selected &&
                        styles.pickerOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </View>
              </Pressable>
            );
          },
        )}

        <View
          style={
            styles.pickerColumnSpacer
          }
        />
      </ScrollView>
    </View>
  );
}

function ChevronDownIcon() {
  return (
    <Svg
      height={20}
      viewBox="0 0 20 20"
      width={20}
    >
      <Path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke={
          colors.gray06
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function HeaderBackIcon() {
  return (
    <Svg
      height={24}
      viewBox="0 0 24 24"
      width={24}
    >
      <Path
        d="M15 5 8 12l7 7"
        fill="none"
        stroke={
          colors.gray07
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg
      height={20}
      viewBox="0 0 20 20"
      width={20}
    >
      <Path
        d="m8 5 5 5-5 5"
        fill="none"
        stroke={
          colors.gray05
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg
      height={20}
      viewBox="0 0 20 20"
      width={20}
    >
      <Path
        d="m5.5 5.5 9 9M14.5 5.5l-9 9"
        fill="none"
        stroke={
          colors.gray05
        }
        strokeLinecap="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg
      height={18}
      viewBox="0 0 18 18"
      width={18}
    >
      <Path
        d="M12.1 12.1 15 15M8 13.5A5.5 5.5 0 1 0 8 2.5a5.5 5.5 0 0 0 0 11Z"
        fill="none"
        stroke={
          colors.gray05
        }
        strokeLinecap="round"
        strokeWidth={1.6}
      />
    </Svg>
  );
}

function WalkIcon() {
  return (
    <Svg
      height={11}
      viewBox="0 0 12 12"
      width={11}
    >
      <Path
        d="M6 3.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm-.6.6L3.7 6.1c-.2.2-.2.6.1.8.2.2.6.2.8-.1l.9-1.1.8 1.1-1.3 3c-.1.3 0 .7.3.8.3.1.7 0 .8-.3l1.1-2.5 1.2 1.5c.2.3.6.3.8.1.3-.2.3-.6.1-.8L7.8 6.7 7 4.8l.9.6c.3.2.6.1.8-.1.2-.3.1-.6-.1-.8L7 3.4c-.5-.3-1.1-.1-1.6.7Z"
        fill={
          colors.white
        }
      />
    </Svg>
  );
}

function BusIconPlain() {
  return (
    <Svg
      height={13}
      viewBox="0 0 16 16"
      width={13}
    >
      <Path
        d="M4.2 1.5h7.6c1.1 0 2 .9 2 2v7.4c0 .9-.6 1.7-1.4 1.9v1.1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1H5.5v1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1.1c-.8-.3-1.4-1-1.4-1.9V3.5c0-1.1.9-2 2-2Zm.4 2.2v3.7h6.8V3.7H4.6Zm1 7.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm4.8-1.1a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 0 0-2.2 0Z"
        fill={
          colors.white
        }
      />
    </Svg>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        colors.white,
    },

    mapScreen: {
      flex: 1,
      overflow: "hidden",
      backgroundColor:
        colors.gray03,
    },

    header: {
      borderBottomColor:
        colors.gray04,
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
      backgroundColor:
        "transparent",
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

    routeSetupContent: {
      flex: 1,
      paddingTop: 28,
      paddingHorizontal: 20,
      backgroundColor:
        colors.white,
    },

    heading: {
      fontFamily: "SUIT",
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 28,
      color: colors.gray09,
    },

    routeSetupHeading: {
      fontFamily: "SUIT",
      fontSize: 18,
      fontStyle: "normal",
      fontWeight: "700",
      lineHeight: 25.2,
      letterSpacing: -0.18,
      color: colors.gray09,
    },

    placeSelectGroup: {
      marginTop: 24,
    },

    placeSelectLabel: {
      marginBottom: 8,
      fontFamily: "SUIT",
      fontSize: 14,
      fontStyle: "normal",
      fontWeight: "600",
      lineHeight: 19.6,
      letterSpacing: -0.14,
      color: colors.gray08,
    },

    placeSelectButton: {
      display: "flex",
      minHeight: 72,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 10,
      alignSelf: "stretch",
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
    },

    placeSelectTextGroup: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },

    placeSelectText: {
      fontFamily: "SUIT",
      fontSize: 14,
      fontStyle: "normal",
      fontWeight: "600",
      lineHeight: 19.6,
      letterSpacing: -0.14,
      color: colors.gray06,
    },

    placeSelectTextFilled: {
      color: colors.gray09,
    },

    placeSelectDetail: {
      fontFamily: "SUIT",
      fontSize: 11,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 15.4,
      letterSpacing: -0.11,
      color: colors.gray06,
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
      display: "flex",
      width: 328,
      height: 54,
      marginTop: 12,
      padding: 16,
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
      fontFamily: "SUIT",
      fontSize: 16,
      fontWeight: "700",
      color: colors.gray09,
    },

    timeInput: {
      display: "flex",
      width: 328,
      height: 54,
      marginTop: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 10,
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
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
      backgroundColor:
        colors.white,
    },

    cancelButton: {
      flex: 1,
      flexBasis: 0,
      flexGrow: 1,
      flexShrink: 0,
      display: "flex",
      height: 54,
      padding: 10,
      alignItems: "center",
      justifyContent:
        "center",
      gap: 10,
      borderWidth: 1,
      borderColor:
        colors.gray05,
      borderRadius: 8,
      backgroundColor:
        colors.white,
    },

    cancelButtonText: {
      fontFamily: "SUIT",
      fontSize: 16,
      fontStyle: "normal",
      fontWeight: "600",
      lineHeight: 22.4,
      letterSpacing: -0.16,
      textAlign: "center",
      color: colors.gray08,
    },

    nextButton: {
      flex: 1,
      flexBasis: 0,
      flexGrow: 1,
      flexShrink: 0,
      display: "flex",
      height: 54,
      padding: 10,
      alignItems: "center",
      justifyContent:
        "center",
      gap: 10,
      borderRadius: 8,
      backgroundColor:
        colors.main,
    },

    nextButtonText: {
      fontFamily: "SUIT",
      fontSize: 16,
      fontStyle: "normal",
      fontWeight: "600",
      lineHeight: 22.4,
      letterSpacing: -0.16,
      textAlign: "center",
      color: colors.white,
    },

    nextButtonDisabled: {
      backgroundColor:
        colors.gray04,
    },

    nextButtonTextDisabled: {
      color: colors.gray06,
    },

    sheetOverlay: {
      flex: 1,
      justifyContent:
        "flex-end",
    },

    sheetDim: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        "rgba(52, 56, 59, 0.32)",
    },

    sheet: {
      paddingTop: 18,
      paddingHorizontal: 20,
      paddingBottom: 28,
      borderTopLeftRadius:
        16,
      borderTopRightRadius:
        16,
      backgroundColor:
        colors.white,
    },

    sheetHandle: {
      alignSelf: "center",
      width: 62,
      height: 4,
      borderRadius: 2,
      backgroundColor:
        colors.gray05,
    },

    pickerRows: {
      marginTop: 28,

      height:
        TIME_PICKER_ITEM_HEIGHT *
        TIME_PICKER_VISIBLE_ITEMS,

      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    pickerColumn: {
      flex: 1,

      height:
        TIME_PICKER_ITEM_HEIGHT *
        TIME_PICKER_VISIBLE_ITEMS,
    },

    pickerScroll: {
      height:
        TIME_PICKER_ITEM_HEIGHT *
        TIME_PICKER_VISIBLE_ITEMS,
    },

    pickerColumnSpacer: {
      height:
        TIME_PICKER_ITEM_HEIGHT,
    },

    pickerOption: {
      height:
        TIME_PICKER_ITEM_HEIGHT,

      alignItems: "center",

      justifyContent:
        "center",
    },

    pickerOptionInner: {
      width: "100%",
      display: "flex",
      height: 48,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent:
        "center",
    },

    pickerOptionInnerSelected: {
      borderRadius: 4,
      backgroundColor:
        colors.gray03,
    },

    pickerOptionText: {
      fontFamily: "SUIT",
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 28,
      color: colors.gray05,
    },

    pickerOptionTextSelected: {
      color: colors.gray09,
    },

    pickerSeparator: {
      width: 12,
      textAlign: "center",
      fontFamily: "SUIT",
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 28,
      color: colors.gray09,
    },

    confirmButton: {
      display: "flex",
      height: 54,
      marginTop: 30,
      padding: 10,
      alignItems: "center",
      justifyContent:
        "center",
      gap: 10,
      alignSelf: "stretch",
      borderRadius: 8,
      backgroundColor:
        colors.main,
    },

    confirmButtonText: {
      fontFamily: "SUIT",
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 22.4,
      color: colors.white,
    },

    placeSearchBox: {
      height: 46,
      marginTop: 8,
      marginHorizontal: 24,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 4,
      backgroundColor:
        colors.white,
      shadowColor:
        "#3D445E",

      shadowOffset: {
        width: 0,
        height: 2,
      },

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

    placeResultPanel: {
      maxHeight: 214,
      marginTop: 8,
      marginHorizontal: 24,
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor:
        colors.white,
      shadowColor:
        "#3D445E",

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 3,
    },

    placeResultList: {
      maxHeight: 214,
    },

    placeResultRow: {
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 10,
      justifyContent:
        "center",
      borderBottomWidth: 1,
      borderBottomColor:
        colors.gray03,
    },

    placeResultName: {
      fontFamily: "SUIT",
      fontSize: 15,
      fontWeight: "800",
      lineHeight: 21,
      color: colors.gray09,
    },

    placeResultAddress: {
      marginTop: 3,
      fontFamily: "SUIT",
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 16.8,
      color: colors.gray07,
    },

    placeResultStatus: {
      paddingHorizontal: 16,
      paddingVertical: 18,
      fontFamily: "SUIT",
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 19.6,
      color: colors.gray07,
    },

    mapAddressListFooter: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 20,
      paddingBottom: 16,
    },

    mapAddressListButton: {
      height: 54,
      padding: 10,
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
    },

    mapAddressListButtonText: {
      fontFamily: "SUIT",
      fontSize: 14,
      fontStyle: "normal",
      fontWeight: "700",
      lineHeight: 19.6,
      letterSpacing: -0.14,
      color: colors.gray08,
      textAlign: "center",
    },

    routeSheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,

      paddingHorizontal: 20,
      paddingBottom: 16,

      borderTopLeftRadius:
        16,

      borderTopRightRadius:
        16,

      backgroundColor:
        colors.white,

      overflow: "hidden",
    },

    routeSheetHandleArea: {
      height: 36,

      alignItems: "center",

      justifyContent:
        "center",
    },

    routeSheetContent: {
      flex: 1,
      minHeight: 0,
    },

    routeFieldLabel: {
      marginTop: 0,
      marginBottom: 4,
      fontFamily: "SUIT",
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15.4,
      color: colors.gray07,
    },

    routeField: {
      height: 46,
      marginBottom: 8,
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
    },

    routeFieldActive: {
      borderColor:
        colors.main,
    },

    routeFieldInput: {
      height: "100%",
      paddingHorizontal: 14,
      paddingVertical: 0,
      fontFamily: "SUIT",
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 19.6,
      color: colors.gray09,
    },

    /*
     * ?꾩옱 二쇱냼 API ?ㅻ쪟 ?쒖떆
     */
    currentAddressError: {
      marginTop: 0,
      marginBottom: 6,
      fontFamily: "SUIT",
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 15.4,
      color: "#D14343",
    },

    mapConfirmButton: {
      height: 46,
      marginTop: 8,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 8,
      backgroundColor:
        colors.main,
    },

    mapConfirmButtonText: {
      fontFamily: "SUIT",
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 19.6,
      color: colors.white,
    },

    resultScreen: {
      flex: 1,
      backgroundColor:
        colors.gray01,
    },

    resultHeader: {
      display: "flex",
      height: layout.headerHeight,
      flexShrink: 0,
      paddingVertical: 0,
      paddingHorizontal: layout.screenMargin,
      flexDirection: "row",
      alignItems: "center",
      gap: layout.headerTitleGap,
      alignSelf: "stretch",
      backgroundColor:
        colors.gray01,
    },

    resultBackButton: {
      width: 24,
      height: 24,
      flexShrink: 0,
      alignItems: "center",
      justifyContent:
        "center",
    },

    routeSummaryPill: {
      display: "flex",
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      flexBasis: 0,
      height: 48,
      paddingHorizontal: 16,
      paddingVertical: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
    },

    routeSummaryInput: {
      flex: 1,
      flexShrink: 1,
      height: 24,
      minWidth: 0,
      paddingVertical: 0,
      overflow: "hidden",
      textAlign: "center",
      fontFamily: "SUIT",
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22.4,
      color: colors.gray09,
    },

    resultNotice: {
      display: "flex",
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      alignSelf: "stretch",
      borderRadius: 4,
      backgroundColor:
        colors.gray02,
    },

    resultNoticeText: {
      flexShrink: 1,
      fontFamily: "SUIT",
      fontSize: 12,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 19.2,
      letterSpacing: -0.12,
      color: colors.gray07,
    },

    routeResultContent: {
      flex: 1,
      paddingTop: 18,
      paddingHorizontal: 20,
      backgroundColor:
        colors.white,
    },
    routeResultList: { paddingBottom: 24, gap: 16 },
    routeResultCard: { paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.gray04 },
    resultStopLine: { position: "absolute", left: 11, top: 11.5 },

    routeStatusBox: {
      minHeight: 180,
      alignItems: "center",
      justifyContent:
        "center",
    },

    routeStatusText: {
      textAlign: "center",
      fontFamily: "SUIT",
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 21,
      color: colors.gray06,
    },

    optionBadges: {
      flexDirection: "row",
      gap: 8,
    },

    optionBadge: {
      display: "flex",
      height: 20,
      paddingVertical: 2,
      paddingHorizontal: 8,
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
      borderRadius: 100,
      backgroundColor: "#D4E2FF",
    },

    optionBadgeText: {
      fontFamily: "Pretendard",
      fontSize: 12,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 16.8,
      color: "#2E6AE2",
      ...Platform.select({ web: { fontFeatureSettings: '"ss05" on' } }),
    },

    totalTimeRow: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    routeClockRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
    routeDepartureTime: { fontFamily: "SUIT", fontSize: 24, fontStyle: "normal", fontWeight: "700", lineHeight: 24, letterSpacing: -0.24, textAlign: "center", color: colors.gray09 },
    routeArrivalTime: { fontFamily: "SUIT", fontSize: 24, fontStyle: "normal", fontWeight: "500", lineHeight: 24, letterSpacing: -0.24, textAlign: "center", color: colors.gray09 },
    routeDurationRow: { flexDirection: "row", alignItems: "flex-end", flexShrink: 0 },

    totalTimeNumber: {
      fontFamily: "SUIT",
      fontSize: 24,
      fontStyle: "normal",
      fontWeight: "700",
      lineHeight: 24,
      letterSpacing: -0.24,
      color: colors.gray09,
    },

    totalTimeUnit: {
      marginLeft: 4,
      fontFamily: "SUIT",
      fontSize: 16,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 22.4,
      letterSpacing: -0.16,
      color: colors.gray08,
    },

    routeTimeline: {
      height: 16,
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      borderRadius: 10,
      backgroundColor:
        colors.gray04,
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
      backgroundColor:
        colors.bus,
    },

    routeWalkIcon: {
      width: 18,
      height: 18,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 9,
      backgroundColor:
        colors.gray06,
    },

    routeBusIcon: {
      width: 18,
      height: 18,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 9,
      backgroundColor:
        colors.bus,
    },

    routeTimelineTextWrap: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent:
        "center",
    },

    routeTimelineText: {
      fontFamily: "SUIT",
      fontSize: 12,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 19.2,
      letterSpacing: -0.12,
      textAlign: "center",
      color: colors.gray07,
    },

    routeTimelineTextOn: {
      fontFamily: "SUIT",
      fontSize: 12,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 19.2,
      letterSpacing: -0.12,
      textAlign: "center",
      color: colors.white,
    },

    routeDivider: {
      height: 1,
      marginTop: 14,
      marginBottom: 14,
      backgroundColor:
        colors.gray03,
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
      justifyContent:
        "center",
      borderRadius: 11,
      backgroundColor:
        colors.bus,
    },

    routeBusNumber: {
      fontFamily: "SUIT",
      fontSize: 18,
      fontStyle: "normal",
      fontWeight: "600",
      lineHeight: 18,
      letterSpacing: -0.18,
      color: colors.gray09,
    },

    routeBusDirection: {
      fontFamily: "SUIT",
      fontSize: 13,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 18.2,
      letterSpacing: -0.13,
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
      justifyContent:
        "center",
      borderRadius: 12,
      backgroundColor:
        colors.gray04,
    },

    stopOuterActive: {
      backgroundColor:
        colors.sub,
    },

    stopInner: {
      width: 16,
      height: 16,
      borderRadius: 100,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.gray06,
    },

    stopInnerActive: {
      backgroundColor:
        colors.main,
    },
    stopCenter: {
      display: "flex",
      width: 6,
      height: 6,
      flexDirection: "column",
      alignItems: "flex-start",
      flexShrink: 0,
      borderRadius: 100,
      backgroundColor: colors.white,
    },

    stopLabel: {
      width: 42,
      fontFamily: "SUIT",
      fontSize: 14,
      fontStyle: "normal",
      fontWeight: "600",
      lineHeight: 19.6,
      letterSpacing: -0.14,
      color: colors.gray07,
    },

    stopName: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      overflow: "hidden",
      fontFamily: "SUIT",
      fontSize: 14,
      fontStyle: "normal",
      fontWeight: "600",
      lineHeight: 19.6,
      letterSpacing: -0.14,
      color: colors.gray08,
    },

    routeAlarmButton: {
      flexDirection: "row",
      gap: 8,
      height: 46,
      marginTop: 22,
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
    },

    routeAlarmButtonText: {
      fontFamily: "SUIT",
      fontSize: 14,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 19.6,
      letterSpacing: -0.14,
      textAlign: "center",
      color: colors.gray08,
    },

    finalScreen: {
      flex: 1,
      backgroundColor:
        colors.gray01,
    },

    finalRouteHeader: {
      minHeight: 64,
      paddingHorizontal: 20,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      backgroundColor:
        colors.gray02,
    },

    finalBusInfo: {
      flexDirection: "row",
      alignItems: "center",
    },

    finalTotalTime: {
      flexDirection: "row",
      alignItems:
        "flex-end",
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
      paddingBottom: 22,
      backgroundColor:
        colors.white,
    },

    timeSummaryRow: {
      flexDirection: "row",
      alignItems:
        "flex-end",
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
      height: 54,
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
    },

    timeCardText: {
      fontFamily: "SUIT",
      fontSize: 16,
      fontWeight: "600",
      lineHeight: 22.4,
      color: colors.gray07,
    },

    resetRouteButton: {
      height: 46,
      marginTop: 16,
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
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
      backgroundColor:
        colors.gray02,
    },

    questionText: {
      fontFamily: "SUIT",
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22.4,
      color: colors.gray09,
    },

    reminderSelect: {
      height: 54,
      marginTop: 16,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
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
      justifyContent:
        "space-between",
      gap: 8,
    },

    dayButton: {
      flex: 1,
      height: 46,
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        colors.gray04,
      borderRadius: 8,
      backgroundColor:
        colors.white,
    },

    dayButtonSelected: {
      borderColor:
        colors.main,
      backgroundColor:
        colors.sub,
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
      gap: 16,
      backgroundColor:
        colors.white,
    },

    finalInfoBox: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 4,
      backgroundColor:
        colors.gray02,
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
      height: 54,
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        colors.gray05,
      borderRadius: 8,
      backgroundColor:
        colors.white,
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
      height: 54,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 8,
      backgroundColor:
        colors.main,
    },

    saveButtonDisabled: {
      backgroundColor:
        colors.gray05,
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
      justifyContent:
        "center",
      backgroundColor:
        "rgba(52, 56, 59, 0.32)",
    },

    reminderCard: {
      paddingTop: 24,
      paddingHorizontal: 24,
      paddingBottom: 26,
      borderRadius: 16,
      backgroundColor:
        colors.white,
    },

    reminderHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
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
      justifyContent:
        "center",
    },

    reminderList: {
      marginTop: 22,
      gap: 21,
    },

    reminderRow: {
      minHeight: 35,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
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
      justifyContent:
        "center",
      borderRadius: 13,
      backgroundColor:
        colors.gray05,
    },

    reminderSwitchOn: {
      alignItems:
        "flex-end",
      backgroundColor:
        colors.main,
    },

    reminderSwitchThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor:
        colors.white,
    },
  });
