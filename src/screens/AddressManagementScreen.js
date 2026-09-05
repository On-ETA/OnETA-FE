import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import ArrowLeftIcon from "../../assets/images/L.svg";
import MemoIcon from "../../public/images/memo.svg";
import PlusIcon from "../../public/images/plus.svg";
import { Header } from "../components";
import { colors, typography } from "../theme";

const MAX_ADDRESS_COUNT = 5;
const DEFAULT_ADDRESS_DETAIL = "마포구 와우산로94 홍익대학교 제2기숙사";

// TODO: API 연동 시 아래 더미 데이터를 교체하세요.
// GET /mypage/addresses
// GET /addresses/search?keyword=
// POST /mypage/addresses
// PATCH /mypage/addresses/{addressId}
// DELETE /mypage/addresses/{addressId}
// PATCH /mypage/addresses/{addressId}/current
const initialAddresses = [
  {
    id: "home",
    name: "우리집",
    detail: DEFAULT_ADDRESS_DETAIL,
    placeName: "홍익대학교 제2기숙사",
    isCurrent: true,
  },
];

const searchResults = [
  {
    id: "hongik-dorm-1",
    name: "홍익대학교 제2기숙사",
    roadAddress: DEFAULT_ADDRESS_DETAIL,
  },
  {
    id: "hongik-dorm-2",
    name: "홍익대학교 제2기숙사",
    roadAddress: DEFAULT_ADDRESS_DETAIL,
  },
];

export function AddressManagementScreen({ onBackPress }) {
  const [screenMode, setScreenMode] = useState("list");
  const [addresses, setAddresses] = useState(initialAddresses);
  const [selectedResult, setSelectedResult] = useState(null);
  const [editingAddress, setEditingAddress] = useState(null);

  const handleBackPress = () => {
    if (screenMode === "detail") {
      setScreenMode("search");
      return;
    }

    if (screenMode === "search" || screenMode === "edit") {
      setScreenMode("list");
      return;
    }

    onBackPress?.();
  };

  const registerAddress = (alias) => {
    if (!selectedResult || addresses.length >= MAX_ADDRESS_COUNT) {
      setScreenMode("list");
      return;
    }

    setAddresses((current) => [
      ...current,
      {
        id: `${selectedResult.id}-${Date.now()}`,
        name: alias || "주소 이름",
        detail: selectedResult.roadAddress,
        placeName: selectedResult.name,
        isCurrent: false,
      },
    ]);
    setScreenMode("list");
  };

  const updateAddress = (alias) => {
    if (!editingAddress) {
      setScreenMode("list");
      return;
    }

    setAddresses((current) =>
      current.map((address) =>
        address.id === editingAddress.id
          ? { ...address, name: alias || address.name }
          : address
      )
    );
    setScreenMode("list");
  };

  const deleteAddress = () => {
    if (!editingAddress) {
      setScreenMode("list");
      return;
    }

    setAddresses((current) => current.filter((item) => item.id !== editingAddress.id));
    setScreenMode("list");
  };

  if (screenMode === "search") {
    return (
      <AddressSearchScreen
        onBackPress={handleBackPress}
        onResultPress={(result) => {
          setSelectedResult(result);
          setScreenMode("detail");
        }}
      />
    );
  }

  if (screenMode === "detail") {
    return (
      <AddressFormScreen
        address={{
          name: selectedResult?.name,
          detail: selectedResult?.roadAddress,
        }}
        buttonLabel="주소 등록"
        initialAlias=""
        onBackPress={handleBackPress}
        onChangeAddress={() => setScreenMode("search")}
        onSubmit={registerAddress}
        title="주소 상세"
      />
    );
  }

  if (screenMode === "edit") {
    return (
      <AddressFormScreen
        address={{
          name: editingAddress?.placeName,
          detail: editingAddress?.detail,
        }}
        buttonLabel="저장"
        initialAlias={editingAddress?.name ?? ""}
        onBackPress={handleBackPress}
        onChangeAddress={() => setScreenMode("search")}
        onDelete={deleteAddress}
        onSubmit={updateAddress}
        title="주소 편집"
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader onBackPress={handleBackPress} title="주소 관리" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {addresses.map((address) => (
          <AddressCard
            address={address}
            key={address.id}
            onEditPress={() => {
              setEditingAddress(address);
              setScreenMode("edit");
            }}
          />
        ))}
        {addresses.length < MAX_ADDRESS_COUNT ? (
          <Pressable
            accessibilityLabel="주소 추가"
            accessibilityRole="button"
            onPress={() => setScreenMode("search")}
            style={styles.addressAddCard}
          >
            <PlusIcon height={30} width={30} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function AddressSearchScreen({ onBackPress, onResultPress }) {
  const [keyword, setKeyword] = useState("와우산로94");

  return (
    <View style={styles.screen}>
      <ScreenHeader onBackPress={onBackPress} title="주소 검색" />
      <View style={styles.searchContent}>
        <Text style={styles.searchTitle}>주소를 검색해주세요</Text>
        <View style={styles.searchInputWrap}>
          <SearchIcon />
          <TextInput
            onChangeText={setKeyword}
            placeholder="주소 검색"
            placeholderTextColor={colors.gray06}
            style={styles.searchInput}
            value={keyword}
          />
          <Pressable
            accessibilityLabel="검색어 지우기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setKeyword("")}
            style={styles.clearButton}
          >
            <CloseIcon />
          </Pressable>
        </View>
        <View style={styles.resultList}>
          {searchResults.map((result) => (
            <Pressable
              accessibilityRole="button"
              key={result.id}
              onPress={() => onResultPress(result)}
              style={styles.resultRow}
            >
              <Text style={styles.resultName}>{result.name}</Text>
              <Text style={styles.resultAddress}>{result.roadAddress}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function AddressFormScreen({
  address,
  buttonLabel,
  initialAlias,
  onBackPress,
  onChangeAddress,
  onDelete,
  onSubmit,
  title,
}) {
  const [alias, setAlias] = useState(initialAlias);
  const selectedAddress = {
    name: address?.name || "홍익대학교 제2기숙사",
    detail: address?.detail || DEFAULT_ADDRESS_DETAIL,
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader onBackPress={onBackPress} title={title} />
      <View style={styles.detailContent}>
        <View style={styles.selectedAddressHeader}>
          <View style={styles.selectedAddressTextGroup}>
            <Text style={styles.selectedAddressName}>{selectedAddress.name}</Text>
            <Text style={styles.selectedAddressDetail}>{selectedAddress.detail}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onChangeAddress} style={styles.changeAddressButton}>
            <Text style={styles.changeAddressButtonText}>변경</Text>
          </Pressable>
        </View>
        <TextInput
          onChangeText={setAlias}
          placeholder="주소 01"
          placeholderTextColor={colors.gray06}
          style={styles.aliasInput}
          value={alias}
        />
      </View>
      <View style={styles.detailFooter}>
        <Pressable accessibilityRole="button" onPress={() => onSubmit(alias.trim())} style={styles.submitButton}>
          <Text style={styles.submitButtonText}>{buttonLabel}</Text>
        </Pressable>
        {onDelete ? (
          <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>주소 삭제</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ScreenHeader({ onBackPress, title }) {
  return (
    <Header
      BackIcon={ArrowLeftIcon}
      backButtonStyle={styles.backButton}
      backIconStyle={styles.backIcon}
      headerStyle={styles.headerBox}
      onBackPress={onBackPress}
      title={title}
      titleStyle={styles.headerTitle}
      type="back"
    />
  );
}

function AddressCard({ address, onEditPress }) {
  return (
    <View style={styles.addressCard}>
      <View style={styles.addressCardTextGroup}>
        <View style={styles.addressCardTitleRow}>
          <MapPinIcon active={address.isCurrent} />
          <Text numberOfLines={1} style={styles.addressCardTitle}>{address.name}</Text>
          {address.isCurrent ? (
            <View style={styles.currentAddressBadge}>
              <Text style={styles.currentAddressBadgeText}>현재 설정된 주소</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.addressCardDetail}>{address.detail}</Text>
      </View>
      <Pressable
        accessibilityLabel={`${address.name} 수정`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onEditPress}
        style={styles.addressEditButton}
      >
        <MemoIcon height={26} style={styles.addressMemoIcon} width={26} />
      </Pressable>
    </View>
  );
}

function MapPinIcon({ active = false }) {
  return (
    <Svg height={24} viewBox="0 0 24 24" width={24}>
      <Path
        d="M12 2.5c-4.15 0-7.5 3.26-7.5 7.28 0 5.5 7.5 11.72 7.5 11.72s7.5-6.22 7.5-11.72C19.5 5.76 16.15 2.5 12 2.5Z"
        fill={active ? colors.gray08 : colors.gray05}
      />
      <Circle cx={12} cy={9.75} fill={colors.white} r={3.1} />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg height={18} viewBox="0 0 18 18" width={18}>
      <Circle cx={8} cy={8} fill="none" r={5.5} stroke={colors.gray05} strokeWidth={1.6} />
      <Line stroke={colors.gray05} strokeLinecap="round" strokeWidth={1.6} x1={12.1} x2={15} y1={12.1} y2={15} />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg height={20} viewBox="0 0 20 20" width={20}>
      <Line stroke={colors.gray05} strokeLinecap="round" strokeWidth={1.8} x1={5} x2={15} y1={5} y2={15} />
      <Line stroke={colors.gray05} strokeLinecap="round" strokeWidth={1.8} x1={15} x2={5} y1={5} y2={15} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.gray01 },
  headerBox: {
    height: 64,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 12,
    borderBottomColor: colors.gray03,
    backgroundColor: colors.gray01,
  },
  headerTitle: { ...typography.head01Sb, color: colors.gray08 },
  backButton: { width: 24, height: 24 },
  backIcon: { width: 24, height: 24, aspectRatio: 1 },
  content: { paddingTop: 32, paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  addressCard: {
    width: "100%",
    minHeight: 76,
    paddingTop: 17,
    paddingRight: 18,
    paddingBottom: 17,
    paddingLeft: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  addressCardTextGroup: { flex: 1, minWidth: 0, paddingRight: 16, gap: 4 },
  addressCardTitleRow: { minHeight: 24, flexDirection: "row", alignItems: "center" },
  addressCardTitle: {
    marginLeft: 5,
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  currentAddressBadge: {
    marginLeft: 10,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 100,
    backgroundColor: colors.sub,
  },
  currentAddressBadgeText: {
    fontFamily: "SUIT",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15.4,
    color: colors.main,
  },
  addressCardDetail: {
    marginLeft: 29,
    fontFamily: "SUIT",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15.4,
    color: colors.gray07,
  },
  addressEditButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  addressMemoIcon: { width: 26, height: 26, aspectRatio: 1 },
  addressAddCard: {
    width: "100%",
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.gray02,
  },
  searchContent: { paddingTop: 29, paddingHorizontal: 24 },
  searchTitle: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25.2,
    color: colors.gray09,
  },
  searchInputWrap: {
    height: 48,
    marginTop: 26,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    marginLeft: 10,
    paddingVertical: 0,
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray09,
  },
  clearButton: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  resultList: { marginTop: 16 },
  resultRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.gray03 },
  resultName: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  resultAddress: {
    marginTop: 6,
    fontFamily: "SUIT",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15.4,
    color: colors.gray07,
  },
  detailContent: { flex: 1, paddingTop: 30, paddingHorizontal: 20 },
  selectedAddressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  selectedAddressTextGroup: { flex: 1, minWidth: 0, paddingRight: 16 },
  selectedAddressName: {
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    color: colors.gray08,
  },
  selectedAddressDetail: {
    marginTop: 5,
    fontFamily: "SUIT",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15.4,
    color: colors.gray07,
  },
  changeAddressButton: {
    height: 34,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray05,
    borderRadius: 17,
    backgroundColor: colors.white,
  },
  changeAddressButtonText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16.8,
    color: colors.gray08,
  },
  aliasInput: {
    height: 68,
    marginTop: 24,
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
  detailFooter: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    gap: 16,
    backgroundColor: colors.gray01,
  },
  submitButton: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  submitButtonText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.white,
  },
  deleteButton: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  deleteButtonText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.point,
  },
});
