import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import ArrowRightIcon from "../../../../assets/images/R_g.svg";
import SearchIcon from "../../../../assets/images/search.svg";
import ClearIcon from "../../../../assets/images/x.svg";
import { searchAddresses } from "../../../api/address/search";
import { Header } from "../../../components";
import { colors } from "../../../theme";
import { AddressManagementScreen } from "../../AddressManagementScreen";

export function RoutePlaceSetupScreen({
  initialPlaces = {},
  onBackPress,
  onConfirm,
  title = "경로 재설정",
  showPreviousButton = false,
}) {
  const [places, setPlaces] = useState(initialPlaces);
  const [activeField, setActiveField] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("");
  const [validation, setValidation] = useState("");
  const [showAddressManagement, setShowAddressManagement] = useState(false);
  const canContinue = [places.origin, places.destination].every(
    (place) => place?.label && Number.isFinite(place.x) && Number.isFinite(place.y),
  );
  const handleBackPress = () => onBackPress?.(places);

  useEffect(() => {
    setResults([]);
    if (!activeField || !keyword.trim()) {
      setStatus("");
      return;
    }
    const controller = new AbortController();
    let active = true;
    setStatus("검색 중입니다.");
    const timer = setTimeout(async () => {
      try {
        const found = await searchAddresses({ keyword: keyword.trim(), signal: controller.signal });
        if (!active) return;
        setResults(found);
        setStatus(found.length ? "" : "검색 결과가 없습니다.");
      } catch (error) {
        if (active) setStatus(error.message || "주소 검색에 실패했습니다.");
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeField, keyword]);

  const closeSearch = () => {
    setActiveField(null);
    setKeyword("");
  };

  if (showAddressManagement) {
    return (
      <AddressManagementScreen
        onBackPress={() => setShowAddressManagement(false)}
        onAddressSelect={(address) => {
          setPlaces((current) => ({
            ...current,
            [activeField]: {
              ...address,
              label: address.name || address.address,
              x: address.x == null || address.x === "" ? undefined : Number(address.x),
              y: address.y == null || address.y === "" ? undefined : Number(address.y),
            },
          }));
          setValidation("");
          setShowAddressManagement(false);
          closeSearch();
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        type="sub"
        title={activeField ? `${activeField === "origin" ? "출발지" : "도착지"} 검색` : title}
        onBackPress={activeField ? closeSearch : handleBackPress}
        topSpacerStyle={styles.topSpacer}
        headerStyle={styles.header}
        titleStyle={styles.headerTitle}
        showRightPlaceholder={false}
      />
      {activeField ? (
        <>
        <ScrollView style={styles.searchScroller} contentContainerStyle={[styles.content, styles.searchContent]} keyboardShouldPersistTaps="handled">
          <Text style={[styles.heading, styles.searchHeading]}>주소를 검색해주세요</Text>
          <View style={styles.searchBox}>
            <SearchIcon width={20} height={20} />
            <TextInput
            autoFocus
            accessibilityLabel="장소 또는 주소 검색"
            placeholder="장소 또는 주소를 검색하세요"
            placeholderTextColor={colors.gray06}
            value={keyword}
            onChangeText={setKeyword}
            style={styles.searchInput}
          />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
              hitSlop={8}
              onPress={() => setKeyword("")}
              style={styles.clearButton}
            >
              <ClearIcon width={20} height={20} />
            </Pressable>
          </View>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          {results.map((place) => (
            <Pressable key={place.id} accessibilityRole="button" style={styles.result} onPress={() => {
              setPlaces((current) => ({ ...current, [activeField]: { ...place, label: place.name || place.address } }));
              setValidation("");
              closeSearch();
            }}>
              <Text style={styles.placeText}>{place.name}</Text>
              <Text style={styles.resultAddress}>{place.address}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.addressListFooter}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAddressManagement(true)}
            style={styles.addressListBox}
          >
            <Text style={styles.addressListText}>주소 목록에서 불러오기</Text>
          </Pressable>
        </View>
        </>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.heading}>출발지와 도착지를 지정해주세요</Text>
            {[ ["origin", "출발지"], ["destination", "도착지"] ].map(([field, label]) => (
              <View key={field} style={styles.fieldGroup}>
                <Text style={styles.label}>{label}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`${label} 지정`} style={styles.field} onPress={() => setActiveField(field)}>
                  {places[field]?.label ? (
                    <View style={styles.selectedPlaceText}>
                      <Text numberOfLines={1} style={styles.placeText}>
                        {places[field].label}
                      </Text>
                      {places[field].address || places[field].detail ? (
                        <Text style={styles.selectedPlaceAddress}>
                          {places[field].address || places[field].detail}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text numberOfLines={1} style={[styles.placeText, styles.placeholder]}>
                      {`${label}를 지정해주세요`}
                    </Text>
                  )}
                  <ArrowRightIcon width={24} height={24} />
                </Pressable>
              </View>
            ))}
            {validation ? <Text accessibilityRole="alert" style={styles.status}>{validation}</Text> : null}
          </ScrollView>
          <View style={[styles.footer, showPreviousButton && styles.footerWithPrevious]}>
            {showPreviousButton ? (
              <Pressable accessibilityRole="button" style={[styles.nextButton, styles.footerButton, styles.previousButton]} onPress={handleBackPress}>
                <Text style={[styles.nextText, styles.previousText]}>이전</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button"
              disabled={showPreviousButton && !canContinue}
              accessibilityState={{ disabled: showPreviousButton && !canContinue }}
              style={[styles.nextButton, showPreviousButton && styles.footerButton, showPreviousButton && !canContinue && styles.disabledButton]}
              onPress={() => {
              if (!canContinue) {
                setValidation("출발지와 도착지를 검색하여 선택해주세요.");
                return;
              }
              onConfirm(places);
            }}>
              <Text style={[styles.nextText, showPreviousButton && !canContinue && styles.disabledText]}>다음</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FCFDFE" },
  topSpacer: { height: 0 },
  header: {
    display: "flex",
    width: 360,
    maxWidth: "100%",
    height: 54,
    paddingVertical: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "center",
    backgroundColor: "#FCFDFE",
  },
  headerTitle: { fontFamily: "SUIT", fontSize: 18, fontWeight: "600", color: colors.gray08 },
  content: { paddingHorizontal: 12, paddingTop: 24, paddingBottom: 24 },
  heading: { fontFamily: "SUIT", fontSize: 20, fontStyle: "normal", fontWeight: "600", lineHeight: 20, letterSpacing: -0.2, color: colors.gray09, marginBottom: 28 },
  fieldGroup: { gap: 8, marginBottom: 24 },
  label: { fontFamily: "SUIT", fontSize: 14, fontStyle: "normal", fontWeight: "500", lineHeight: 19.6, letterSpacing: -0.14, color: colors.gray08 },
  field: {
    display: "flex",
    alignSelf: "stretch",
    paddingTop: 16,
    paddingRight: 12,
    paddingBottom: 16,
    paddingLeft: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray04,
    backgroundColor: colors.white,
  },
  placeText: { flexShrink: 1, fontFamily: "SUIT", fontSize: 16, fontWeight: "500", lineHeight: 22.4, color: colors.gray08 },
  selectedPlaceText: { flex: 1, minWidth: 0, gap: 4, paddingRight: 12 },
  selectedPlaceAddress: {
    color: colors.gray07,
    textAlign: "left",
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
  },
  placeholder: {
    color: colors.gray06,
    textAlign: "center",
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
  },
  footer: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 18 },
  footerWithPrevious: { flexDirection: "row", gap: 12 },
  footerButton: { flex: 1 },
  previousButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray04 },
  previousText: { color: colors.gray08 },
  disabledButton: { backgroundColor: colors.gray05 },
  disabledText: { color: colors.gray07 },
  nextButton: { height: 56, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.main },
  nextText: { fontFamily: "SUIT", fontSize: 16, fontWeight: "600", color: colors.white },
  searchContent: { width: 360, maxWidth: "100%", alignSelf: "center", alignItems: "flex-start", paddingHorizontal: 16 },
  searchScroller: { flex: 1 },
  addressListFooter: { alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  addressListBox: {
    display: "flex",
    width: 328,
    maxWidth: "100%",
    height: 54,
    padding: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray05,
    backgroundColor: colors.white,
  },
  addressListText: {
    color: colors.gray08,
    textAlign: "center",
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
  },
  searchHeading: { alignSelf: "stretch", textAlign: "left", marginBottom: 16 },
  searchBox: {
    display: "flex",
    width: 328,
    maxWidth: "100%",
    height: 48,
    paddingVertical: 0,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, minWidth: 0, padding: 0, fontFamily: "SUIT", fontSize: 16, fontWeight: "500", color: colors.gray09 },
  clearButton: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  resultAddress: { fontFamily: "SUIT", fontSize: 12, lineHeight: 16.8, color: colors.gray07 },
  result: { alignSelf: "stretch", paddingVertical: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.gray03 },
  status: { marginTop: 16, fontFamily: "SUIT", fontSize: 14, color: colors.gray07 },
});
