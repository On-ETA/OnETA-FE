import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import BackIconDefault from "../../assets/images/L.svg";
import BellIcon from "../../assets/images/icon_bell.svg";
import BellNoneIcon from "../../assets/images/icon_bell_none.svg";
import OnetaLogo from "../../assets/images/on-eta_logo.png";
import { colors, typography } from "../theme";

const MAIN_BACKGROUND = "#FCFDFE";
const SUB_BACKGROUND = colors.white;

export function Header({
  type = "main",
  title,
  notificationCount = 0,
  BackIcon,
  backIconStyle,
  backButtonStyle,
  headerStyle,
  rightAccessory,
  titleStyle,
  topSpacerStyle,
  showRightPlaceholder = true,
  onBellPress,
  onBackPress,
}) {
  const HeaderBellIcon = notificationCount > 0 ? BellIcon : BellNoneIcon;
  const isMain = type === "main";

  return (
    <>
      <View
        style={[
          styles.topSpacer,
          isMain ? styles.mainBg : styles.subBg,
          topSpacerStyle,
        ]}
      />
      <View
        style={[
          styles.header,
          isMain ? styles.mainHeader : styles.backHeader,
          isMain ? styles.mainBg : styles.subBg,
          headerStyle,
        ]}
      >
        {isMain ? (
          <>
            <Image
              accessibilityLabel="온에타"
              resizeMode="contain"
              source={OnetaLogo}
              style={styles.logo}
            />
            <Pressable
              accessibilityLabel="알림"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onBellPress}
              style={[styles.iconButton, styles.mainIconButton]}
            >
              <HeaderBellIcon height={31} width={36} />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityLabel="뒤로가기"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onBackPress}
              style={[styles.iconButton, styles.backIconButton, backButtonStyle]}
            >
              {BackIcon ? (
                <BackIcon
                  height={24}
                  style={[styles.backIcon, backIconStyle]}
                  width={24}
                />
              ) : (
                <BackIconDefault
                  height={24}
                  style={[styles.backIcon, backIconStyle]}
                  width={24}
                />
              )}
            </Pressable>
            <Text numberOfLines={1} style={[styles.title, titleStyle]}>
              {title}
            </Text>
            {rightAccessory ? (
              <View style={[styles.iconButton, styles.backIconButton]}>
                {rightAccessory}
              </View>
            ) : showRightPlaceholder ? (
              <View style={[styles.iconButton, styles.backIconButton]} />
            ) : null}
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topSpacer: {
    height: 24,
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  mainHeader: {
    height: 70,
    paddingHorizontal: 22,
    justifyContent: "space-between",
    borderBottomColor: colors.gray04,
  },
  backHeader: {
    height: 54,
    paddingHorizontal: 16,
    justifyContent: "flex-start",
    gap: 12,
    borderBottomColor: colors.gray03,
  },
  mainBg: {
    backgroundColor: MAIN_BACKGROUND,
  },
  subBg: {
    backgroundColor: SUB_BACKGROUND,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  mainIconButton: {
    width: 40,
    height: 40,
  },
  logo: {
    width: 102,
    height: 39,
  },
  backIconButton: {
    width: 24,
    height: 24,
  },
  backIcon: {
    width: 24,
    height: 24,
    aspectRatio: 1,
  },
  title: {
    flex: 1,
    marginLeft: 0,
    ...typography.head01Sb,
    color: colors.black,
  },
});
