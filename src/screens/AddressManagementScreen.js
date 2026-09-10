import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import ArrowLeftIcon from "../../assets/images/L.svg";
import MapIcon from "../../public/images/map.svg";
import MemoIcon from "../../public/images/memo.svg";
import PlusIcon from "../../public/images/plus.svg";
import {
  createAddress,
  getAddresses,
  normalizeAddress,
  setCurrentAddress,
} from "../api/addresses";
import { Header } from "../components";
import { colors, typography } from "../theme";

const MAX_ADDRESS_COUNT = 5;

export function AddressManagementScreen({ onBackPress }) {
  const [addresses, setAddresses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasCurrentAddress = addresses.some((address) => address.isCurrent);

  useEffect(() => {
    let isActive = true;

    async function loadAddresses() {
      try {
        const nextAddresses = await getAddresses();

        if (isActive) {
          setAddresses(nextAddresses);
        }
      } catch {
        if (isActive) {
          setAddresses([]);
        }
      }
    }

    loadAddresses();

    return () => {
      isActive = false;
    };
  }, []);

  const addAddress = async () => {
    if (isSubmitting || addresses.length >= MAX_ADDRESS_COUNT) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createAddress({
        payload: {
          name: "주소 이름",
          address: "마포구 와우산로94 홍익대학교 제2기숙사",
        },
      });
      const createdAddress = response?.data
        ? normalizeAddress(response.data)
        : {
            id: `${Date.now()}-${addresses.length}`,
            name: "주소 이름",
            detail: "마포구 와우산로94 홍익대학교 제2기숙사",
          };

      setAddresses((current) =>
        current.length >= MAX_ADDRESS_COUNT
          ? current
          : [...current, createdAddress],
      );
    } catch (error) {
      Alert.alert(
        "주소 등록 실패",
        error?.message ?? "주소 등록에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetCurrentAddress = async (address) => {
    const addressId = address.addressId ?? address.id;

    if (!addressId) {
      return;
    }

    try {
      await setCurrentAddress({ addressId });
      setAddresses((current) =>
        current.map((item) => ({
          ...item,
          isCurrent: (item.addressId ?? item.id) === addressId,
        })),
      );
    } catch (error) {
      Alert.alert(
        "현재 주소 설정 실패",
        error?.message ?? "현재 주소 설정에 실패했습니다.",
      );
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        type="back"
        title="주소 관리"
        BackIcon={ArrowLeftIcon}
        backButtonStyle={styles.backButton}
        backIconStyle={styles.backIcon}
        headerStyle={styles.headerBox}
        titleStyle={styles.headerTitle}
        onBackPress={onBackPress}
      />

      <View style={styles.content}>
        {addresses.map((address, index) => (
          <View key={address.id} style={styles.addressCard}>
            <View style={styles.addressCardTextGroup}>
              <View style={styles.addressCardTitleRow}>
                <MapIcon height={20} width={20} />
                <Text style={styles.addressCardTitle}>{address.name}</Text>
                {address.isCurrent || (!hasCurrentAddress && index === 0) ? (
                  <View style={styles.currentAddressBadge}>
                    <Text style={styles.currentAddressBadgeText}>
                      현재 설정된 주소
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.addressCardDetail}>{address.detail}</Text>
            </View>

            <Pressable
              accessibilityLabel={`${address.name} 수정`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => handleSetCurrentAddress(address)}
              style={styles.addressEditButton}
            >
              <MemoIcon height={24} style={styles.addressMemoIcon} width={24} />
            </Pressable>
          </View>
        ))}

        {addresses.length < MAX_ADDRESS_COUNT ? (
          <Pressable
            accessibilityLabel="주소 추가"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={addAddress}
            style={[styles.addressAddCard, isSubmitting && styles.disabledCard]}
          >
            <PlusIcon height={30} width={30} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  headerBox: {
    display: "flex",
    height: 54,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 12,
    alignSelf: "stretch",
    borderBottomColor: colors.gray03,
  },
  headerTitle: {
    ...typography.head01Sb,
    marginLeft: 0,
    color: colors.black,
  },
  backButton: {
    width: 24,
    height: 24,
  },
  backIcon: {
    width: 24,
    height: 24,
    aspectRatio: 1,
  },
  content: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  addressCard: {
    display: "flex",
    width: 328,
    height: 76,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  addressCardTextGroup: {
    flex: 1,
    height: "100%",
    minWidth: 0,
    paddingRight: 12,
    justifyContent: "space-between",
  },
  addressCardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  addressCardTitle: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
    color: colors.gray08,
  },
  currentAddressBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 100,
    backgroundColor: colors.sub,
  },
  currentAddressBadgeText: {
    fontFamily: "Pretendard",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 16.8,
    color: colors.main,
    ...Platform.select({
      web: {
        fontFeatureSettings: "'ss05' on",
      },
    }),
  },
  addressCardDetail: {
    marginLeft: 0,
    alignSelf: "flex-start",
    fontFamily: "SUIT",
    fontSize: 11,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 15.4,
    letterSpacing: -0.11,
    textAlign: "center",
    color: colors.gray07,
  },
  addressEditButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  addressMemoIcon: {
    width: 24,
    height: 24,
    flexShrink: 0,
    aspectRatio: 1,
  },
  addressAddCard: {
    display: "flex",
    width: 328,
    height: 76,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.gray02,
  },
  disabledCard: {
    opacity: 0.7,
  },
});
