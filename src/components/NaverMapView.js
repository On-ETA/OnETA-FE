import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import {
  NAVER_MAP_CLIENT_ID,
  NAVER_MAP_DEFAULT_CENTER,
} from "../config/naverMap";
import { colors, typography } from "../theme";

let naverMapsScriptPromise = null;
let naverMapIdSeed = 0;

function loadNaverMapsScript(clientId) {
  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("네이버 지도는 웹 환경에서만 로드할 수 있습니다."),
    );
  }

  if (globalThis.naver?.maps) {
    return Promise.resolve(globalThis.naver.maps);
  }

  if (!naverMapsScriptPromise) {
    naverMapsScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.async = true;
      script.src =
        "https://oapi.map.naver.com/openapi/v3/maps.js" +
        `?ncpKeyId=${encodeURIComponent(clientId)}`;

      script.onload = () => {
        if (globalThis.naver?.maps) {
          resolve(globalThis.naver.maps);
          return;
        }

        reject(
          new Error("네이버 지도 SDK를 초기화하지 못했습니다."),
        );
      };

      script.onerror = () => {
        reject(
          new Error("네이버 지도 SDK를 불러오지 못했습니다."),
        );
      };

      document.head.appendChild(script);
    }).catch((error) => {
      naverMapsScriptPromise = null;
      throw error;
    });
  }

  return naverMapsScriptPromise;
}

function normalizeMarkers(
  markers,
  center,
  showCenterMarker,
) {
  const normalizedMarkers = Array.isArray(markers)
    ? markers
        .map((marker) => ({
          latitude: Number(marker?.latitude),
          longitude: Number(marker?.longitude),
        }))
        .filter(
          (marker) =>
            Number.isFinite(marker.latitude) &&
            Number.isFinite(marker.longitude),
        )
    : [];

  if (normalizedMarkers.length > 0) {
    return normalizedMarkers;
  }

  return showCenterMarker ? [center] : [];
}

function WebNaverMapView({
  center,
  clientId,
  level,
  markers,
  onMapPress,
  showCenterMarker,
  style,
}) {
  const [errorMessage, setErrorMessage] = useState("");

  const markerPositions = useMemo(
    () =>
      normalizeMarkers(
        markers,
        center,
        showCenterMarker,
      ),
    [center, markers, showCenterMarker],
  );

  const markerKey = useMemo(
    () =>
      markerPositions
        .map(
          (marker) =>
            `${marker.latitude},${marker.longitude}`,
        )
        .join("|"),
    [markerPositions],
  );

  const mapId = useMemo(() => {
    naverMapIdSeed += 1;

    return `naver-map-${naverMapIdSeed}`;
  }, []);

  useEffect(() => {
    let isActive = true;
    let clickListener = null;

    setErrorMessage("");

    loadNaverMapsScript(clientId)
      .then((maps) => {
        if (!isActive) {
          return;
        }

        const mapElement =
          document.getElementById(mapId);

        if (!mapElement) {
          return;
        }

        mapElement.innerHTML = "";

        const map = new maps.Map(mapElement, {
          center: new maps.LatLng(
            center.latitude,
            center.longitude,
          ),
          zoom: level,
          scaleControl: false,
          logoControl: false,
          mapDataControl: false,
        });

        markerPositions.forEach((marker) => {
          new maps.Marker({
            map,
            position: new maps.LatLng(
              marker.latitude,
              marker.longitude,
            ),
          });
        });

        clickListener = maps.Event.addListener(
          map,
          "click",
          (event) => {
            const coord = event?.coord;

            if (!coord) {
              return;
            }

            const latitude = Number(
              typeof coord.lat === "function"
                ? coord.lat()
                : coord.y,
            );

            const longitude = Number(
              typeof coord.lng === "function"
                ? coord.lng()
                : coord.x,
            );

            if (
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude)
            ) {
              return;
            }

            onMapPress?.({
              latitude,
              longitude,
            });
          },
        );
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error?.message ??
            "네이버 지도를 불러오지 못했습니다.",
        );
      });

    return () => {
      isActive = false;

      if (
        clickListener &&
        globalThis.naver?.maps?.Event
      ) {
        globalThis.naver.maps.Event.removeListener(
          clickListener,
        );
      }
    };
  }, [
    center.latitude,
    center.longitude,
    clientId,
    level,
    mapId,
    markerKey,
    onMapPress,
  ]);

  return (
    <View style={[styles.container, style]}>
      <div
        id={mapId}
        style={styles.webMap}
      />

      {errorMessage ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.fallbackTitle}>
            지도를 불러오지 못했습니다.
          </Text>

          <Text style={styles.fallbackText}>
            {errorMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function NativeNaverMap({
  center,
  level,
  markers,
  onMapPress,
  showCenterMarker,
  style,
}) {
  const {
    NaverMapMarkerOverlay,
    NaverMapView: NativeNaverMapView,
  } = require("@mj-studio/react-native-naver-map");

  const markerPositions = useMemo(
    () =>
      normalizeMarkers(
        markers,
        center,
        showCenterMarker,
      ),
    [markers, center, showCenterMarker],
  );

  const handleTapMap = (event) => {
    /*
     * @mj-studio/react-native-naver-map에서는
     * 일반적으로 latitude / longitude를 전달.
     *
     * 버전 차이를 고려해 coord도 fallback으로 처리.
     */
    const latitude = Number(
      event?.latitude ??
        event?.coord?.latitude ??
        event?.coord?.y,
    );

    const longitude = Number(
      event?.longitude ??
        event?.coord?.longitude ??
        event?.coord?.x,
    );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      console.warn(
        "NaverMap onTapMap 좌표가 올바르지 않습니다.",
        event,
      );

      return;
    }

    onMapPress?.({
      latitude,
      longitude,
    });
  };

  return (
    <NativeNaverMapView
      initialCamera={{
        latitude: center.latitude,
        longitude: center.longitude,
        zoom: level,
      }}
      isShowCompass={false}
      isShowLocationButton={false}
      isShowScaleBar={false}
      isShowZoomControls={false}
      locale="ko"
      style={[styles.container, style]}
      onTapMap={handleTapMap}
    >
      {markerPositions.map((marker, index) => (
        <NaverMapMarkerOverlay
          key={`${marker.latitude}-${marker.longitude}-${index}`}
          latitude={marker.latitude}
          longitude={marker.longitude}
        />
      ))}
    </NativeNaverMapView>
  );
}

export function NaverMapView({
  center,
  clientId = NAVER_MAP_CLIENT_ID,
  level = 15,
  markers,
  onMapPress,
  showCenterMarker = true,
  style,
}) {
  const resolvedCenter =
    center ?? NAVER_MAP_DEFAULT_CENTER;

  if (Platform.OS === "web") {
    return (
      <WebNaverMapView
        center={resolvedCenter}
        clientId={clientId}
        level={level}
        markers={markers}
        onMapPress={onMapPress}
        showCenterMarker={showCenterMarker}
        style={style}
      />
    );
  }

  return (
    <NativeNaverMap
      center={resolvedCenter}
      level={level}
      markers={markers}
      onMapPress={onMapPress}
      showCenterMarker={showCenterMarker}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  webMap: {
    width: "100%",
    height: "100%",
  },

  fallbackTitle: {
    ...typography.body01Sb,
    color: colors.gray09,
    textAlign: "center",
  },

  fallbackText: {
    marginTop: 8,
    ...typography.caption01M,
    color: colors.gray07,
    textAlign: "center",
  },

  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "rgba(255, 255, 255, 0.86)",
  },
});