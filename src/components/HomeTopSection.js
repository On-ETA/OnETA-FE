import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import BellIcon from "../../assets/images/icon_bell.svg";
import BellNoneIcon from "../../assets/images/icon_bell_none.svg";
import BackIcon from "../../assets/images/L.svg";
import MyPageIcon from "../../assets/images/icon_mypage.svg";
import ArrowRightIcon from "../../assets/images/R.svg";
import HomeIcon from "../../assets/images/icon_home.svg";
import { colors, layout, typography } from "../theme";

const homeBackground = colors.gray01;

export function HomeTopSection({
  activeTab = "firstLast",
  addressLabel = "우리집",
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
      <View style={styles.homeTopSection}>
        <View style={[styles.homeHeader, !showTabs && styles.pageHeader]}>
          {showAddress ? (
            <Pressable
              accessibilityRole="button"
              onPress={onAddressPress}
              style={styles.addressButton}
            >
              <HomeIcon height={20} style={styles.addressHomeIcon} width={20} />
              <Text numberOfLines={1} style={styles.addressText}>{addressLabel}</Text>
              <ArrowRightIcon
                height={21}
                style={styles.addressArrowIcon}
                width={21}
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
              <Text numberOfLines={1} style={styles.titleText}>{title}</Text>
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
              <HeaderBellIcon height={25} style={styles.headerIcon} width={25} />
            </Pressable>
            {showMyPageButton ? (
              <Pressable
                accessibilityLabel="마이페이지"
                accessibilityRole="button"
                hitSlop={12}
                onPress={onMyPagePress}
                style={styles.iconButton}
              >
                <MyPageIcon height={25} style={styles.headerIcon} width={25} />
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
  homeTopSection: {
    alignSelf: "stretch",
    flexShrink: 0,
  },
  pageHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray03,
  },
  homeHeader: {
    width: "100%",
    height: layout.headerHeight,
    flexShrink: 0,
    paddingHorizontal: layout.screenMargin,
    gap: layout.headerTitleGap,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: homeBackground,
  },
  addressButton: {
    flexShrink: 1,
    minWidth: 0,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
  },
  addressHomeIcon: {
    marginRight: 4,
  },
  addressText: {
    flexShrink: 1,
    color: colors.gray08,
    fontFamily: "SUIT",
    fontSize: 20,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  titleText: {
    flexShrink: 1,
    ...typography.head01Sb,
    color: colors.gray08,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.headerTitleGap,
  },
  backButton: {
    flexShrink: 0,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  addressArrowIcon: {
    marginLeft: 7,
    opacity: 0.65,
  },
  emptyLeft: {
    width: 1,
    height: 40,
  },
  headerActions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 25,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 25,
    height: 25,
    aspectRatio: 1,
  },
  routeTabs: {
    alignSelf: "stretch",
    marginHorizontal: layout.screenMargin,
    flexShrink: 0,
    height: 45,
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
    borderBottomWidth: 3,
    borderBottomColor: colors.main,
  },
  routeTabText: {
    fontFamily: "Pretendard",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    textAlign: "center",
    color: colors.gray06,
  },
  routeTabTextOn: {
    color: colors.main,
  },
});
