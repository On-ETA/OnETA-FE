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
    return Promise.reject(new Error("네이버 지도는 웹 환경에서만 로드할 수 있습니다."));
  }

  if (globalThis.naver?.maps) {
    return Promise.resolve(globalThis.naver.maps);
  }

  if (!naverMapsScriptPromise) {
    naverMapsScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.async = true;
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(
        clientId,
      )}`;
      script.onload = () => {
        if (globalThis.naver?.maps) {
          resolve(globalThis.naver.maps);
          return;
        }

        reject(new Error("네이버 지도 SDK를 초기화하지 못했습니다."));
      };
      script.onerror = () => {
        reject(new Error("네이버 지도 SDK를 불러오지 못했습니다."));
      };

      document.head.appendChild(script);
    });
  }

  return naverMapsScriptPromise;
}

function WebNaverMapView({ center, clientId, level, style }) {
  const [errorMessage, setErrorMessage] = useState("");
  const mapId = useMemo(() => {
    naverMapIdSeed += 1;
    return `naver-map-${naverMapIdSeed}`;
  }, []);

  useEffect(() => {
    let isActive = true;

    loadNaverMapsScript(clientId)
      .then((maps) => {
        if (!isActive) {
          return;
        }

        const mapElement = document.getElementById(mapId);

        if (!mapElement) {
          return;
        }

        const map = new maps.Map(mapElement, {
          center: new maps.LatLng(center.latitude, center.longitude),
          zoom: level,
          scaleControl: false,
          logoControl: false,
          mapDataControl: false,
        });

        new maps.Marker({
          map,
          position: new maps.LatLng(center.latitude, center.longitude),
        });
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(error?.message ?? "네이버 지도를 불러오지 못했습니다.");
        }
      });

    return () => {
      isActive = false;
    };
  }, [center.latitude, center.longitude, clientId, level, mapId]);

  return (
    <View style={[styles.container, style]}>
      <div id={mapId} style={styles.webMap} />
      {errorMessage ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.fallbackTitle}>지도를 불러오지 못했습니다.</Text>
          <Text style={styles.fallbackText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

function NativeNaverMap({ center, level, style }) {
  const {
    NaverMapMarkerOverlay,
    NaverMapView: NativeNaverMapView,
  } = require("@mj-studio/react-native-naver-map");

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
    >
      <NaverMapMarkerOverlay
        latitude={center.latitude}
        longitude={center.longitude}
      />
    </NativeNaverMapView>
  );
}

export function NaverMapView({
  center = NAVER_MAP_DEFAULT_CENTER,
  clientId = NAVER_MAP_CLIENT_ID,
  level = 15,
  style,
}) {
  if (Platform.OS === "web") {
    return (
      <WebNaverMapView
        center={center}
        clientId={clientId}
        level={level}
        style={style}
      />
    );
  }

  return (
    <NativeNaverMap
      center={center}
      level={level}
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
