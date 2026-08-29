import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import BellIcon from "../../assets/images/icon_bell.svg";
import BellNoneIcon from "../../assets/images/icon_bell_none.svg";
import BackIcon from "../../assets/images/L.svg";
import MyPageIcon from "../../assets/images/icon_mypage.svg";
import ArrowRightIcon from "../../assets/images/R.svg";
import MapIcon from "../../public/images/map.svg";
import { colors, typography } from "../theme";

const homeBackground = colors.gray01;

export function HomeTopSection({
  activeTab = "firstLast",
  notificationCount = 0,
  onAddressPress,
  onBackPress,
  onBellPress,
  onMyPagePress,
  onTabPress,
  showAddress = true,
  showBackButton = false,
  showMyPageButton = false,
  showTabs = true,
  title,
}) {
  const HeaderBellIcon = notificationCount > 0 ? BellIcon : BellNoneIcon;

  return (
    <>
      <View style={styles.topSpacer} />
      <View style={styles.homeTopSection}>
        <View style={styles.homeHeader}>
          {showAddress ? (
            <Pressable
              accessibilityRole="button"
              onPress={onAddressPress}
              style={styles.addressButton}
            >
              <MapIcon height={24} style={styles.addressMapIcon} width={24} />
              <Text style={styles.addressText}>주소 등록하기</Text>
              <ArrowRightIcon
                height={20}
                style={styles.addressArrowIcon}
                width={20}
              />
            </Pressable>
          ) : title ? (
            <View style={styles.titleGroup}>
              {showBackButton ? (
                <Pressable
                  accessibilityLabel="뒤로가기"
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={onBackPress}
                  style={styles.backButton}
                >
                  <BackIcon height={24} style={styles.headerIcon} width={24} />
                </Pressable>
              ) : null}
              <Text style={styles.titleText}>{title}</Text>
            </View>
          ) : (
            <View style={styles.emptyLeft} />
          )}
          <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="알림"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onBellPress}
            style={styles.iconButton}
          >
            <HeaderBellIcon height={24} style={styles.headerIcon} width={24} />
          </Pressable>
          {showMyPageButton ? (
            <Pressable
              accessibilityLabel="마이페이지"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onMyPagePress}
              style={styles.iconButton}
            >
              <MyPageIcon height={24} style={styles.headerIcon} width={24} />
            </Pressable>
          ) : null}
          </View>
        </View>

        {showTabs ? (
          <View style={styles.routeTabs}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === "firstLast" }}
              onPress={() => onTabPress?.("firstLast")}
              style={[
                styles.routeTab,
                activeTab === "firstLast" && styles.routeTabOn,
              ]}
            >
              <Text
                style={[
                  styles.routeTabText,
                  activeTab === "firstLast" && styles.routeTabTextOn,
                ]}
              >
                첫막차
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === "customAlarm" }}
              onPress={() => onTabPress?.("customAlarm")}
              style={[
                styles.routeTab,
                activeTab === "customAlarm" && styles.routeTabOn,
              ]}
            >
              <Text
                style={[
                  styles.routeTabText,
                  activeTab === "customAlarm" && styles.routeTabTextOn,
                ]}
              >
                맞춤 알림
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topSpacer: {
    height: 24,
    backgroundColor: homeBackground,
  },
  homeTopSection: {
    alignSelf: "center",
    width: 360,
    maxWidth: "100%",
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 0,
    paddingLeft: 16,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 16,
  },
  homeHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: homeBackground,
  },
  addressButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
  },
  addressMapIcon: {
    marginRight: 4,
  },
  addressText: {
    ...typography.head01Sb,
    color: colors.gray08,
  },
  titleText: {
    ...typography.head01Sb,
    color: colors.gray08,
  },
  titleGroup: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  addressArrowIcon: {
    marginLeft: 7,
  },
  emptyLeft: {
    width: 1,
    height: 40,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 24,
    height: 24,
    aspectRatio: 1,
  },
  routeTabs: {
    width: "100%",
    height: 43,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.gray04,
  },
  routeTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  routeTabOn: {
    borderBottomWidth: 2,
    borderBottomColor: colors.main,
  },
  routeTabText: {
    fontFamily: "Pretendard",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 22.4,
    textAlign: "center",
    color: colors.gray06,
  },
  routeTabTextOn: {
    color: colors.main,
  },
});
