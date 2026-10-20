import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { deleteUser } from "../api/user";
import { AppScreen, Header, PrimaryButton } from "../components";
import { colors, typography } from "../theme";

export function DeleteAccountScreen({ onCancelPress, onCompletePress }) {
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);
  const deletedRef = useRef(false);

  const handleDelete = async () => {
    if (!confirmed || submittingRef.current || deletedRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      await deleteUser();
      deletedRef.current = true;
      setComplete(true);
    } catch (failure) {
      setError(failure?.message || "계정 삭제에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <Header type="back" title="계정 삭제" onBackPress={submitting ? undefined : complete ? onCompletePress : onCancelPress} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {complete ? "계정 삭제가 완료되었습니다." : "온에타 계정을 삭제하시겠어요?"}
          </Text>
          <Text style={styles.body}>
            {complete
              ? "회원탈퇴가 처리되었으며, 이 기기의 로그인 정보가 삭제되었습니다."
              : "계정을 삭제하면 다시 로그인할 수 없으며, 저장된 경로와 알림을 더 이상 이용할 수 없습니다. 삭제 후에는 계정을 복구할 수 없습니다."}
          </Text>
          {!complete && <>
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>개인정보 처리 안내</Text>
              <Text style={styles.body}>회원정보와 저장된 경로·알림정보는 회원탈퇴에 따라 파기됩니다. 관계 법령에 따라 보관 의무가 있는 정보는 해당 기간 동안 보관될 수 있습니다.</Text>
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed, disabled: submitting }}
              disabled={submitting}
              onPress={() => setConfirmed(value => !value)}
              style={styles.agreement}
            >
              <Text style={[styles.checkbox, confirmed && styles.checked]}>{confirmed ? "✓" : ""}</Text>
              <Text style={styles.agreementText}>삭제 안내를 확인했으며, 계정 삭제에 동의합니다.</Text>
            </Pressable>
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            <PrimaryButton
              disabled={!confirmed || submitting}
              onPress={handleDelete}
              style={[styles.deleteButton, (!confirmed || submitting) && styles.disabled]}
            >{submitting ? "삭제 중…" : "계정 영구 삭제"}</PrimaryButton>
            <Pressable accessibilityRole="button" disabled={submitting} onPress={onCancelPress} style={styles.cancel}>
              <Text style={styles.body}>취소</Text>
            </Pressable>
          </>}
          {complete && <PrimaryButton onPress={onCompletePress}>확인</PrimaryButton>}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, paddingTop: 40, backgroundColor: colors.white },
  card: { gap: 24, width: "100%", maxWidth: 480, alignSelf: "center" },
  title: { ...typography.head01Sb, color: colors.gray08, fontSize: 22, lineHeight: 32 },
  body: { fontFamily: "SUIT", fontSize: 14, lineHeight: 23, color: colors.gray08 },
  notice: { padding: 18, gap: 10, borderRadius: 12, backgroundColor: colors.gray03 },
  noticeTitle: { fontFamily: "SUIT", fontSize: 15, fontWeight: "600", color: colors.gray08 },
  agreement: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  agreementText: { flex: 1, fontFamily: "SUIT", fontSize: 14, lineHeight: 22, color: colors.gray08 },
  checkbox: { width: 24, height: 24, borderRadius: 5, borderWidth: 1, borderColor: colors.gray05, textAlign: "center", lineHeight: 22, color: colors.white },
  checked: { backgroundColor: colors.main, borderColor: colors.main },
  deleteButton: { backgroundColor: "#C83939", borderRadius: 8 },
  disabled: { opacity: 0.4 },
  error: { fontFamily: "SUIT", color: "#C83939", fontSize: 14, lineHeight: 22 },
  cancel: { padding: 12, alignItems: "center" },
});
