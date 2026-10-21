import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useMutation } from "@tanstack/react-query";
import React, { forwardRef, useCallback, useState } from "react";
import { Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiPost, ApiError } from "@/src/api/client";
import { AppButton, TextField } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export const ChangePasswordSheet = forwardRef<BottomSheetModal>((_props, ref) => {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const mutation = useMutation({
    mutationFn: () =>
      apiPost("/auth/change-password", { current_password: current, new_password: next }),
    onSuccess: () => {
      toast("Şifren güncellendi 🎉", "success");
      reset();
      (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Şifre değiştirilemedi", "error"),
  });

  const submit = () => {
    if (!current) {
      toast("Mevcut şifreni gir", "error");
      return;
    }
    if (next.length < 6) {
      toast("Yeni şifre en az 6 karakter olmalı", "error");
      return;
    }
    if (next !== confirm) {
      toast("Yeni şifreler eşleşmiyor", "error");
      return;
    }
    mutation.mutate();
  };

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["70%"]}
      enablePanDownToClose
      onDismiss={reset}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
      backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Şifre Değiştir</Text>
          <Text style={styles.sub}>Güvenliğin için mevcut şifreni doğrula ve yeni bir şifre belirle.</Text>
          <TextField
            testID="current-password-input"
            label="Mevcut Şifre"
            value={current}
            onChangeText={setCurrent}
            placeholder="Mevcut şifren"
            secureTextEntry
          />
          <TextField
            testID="new-password-input"
            label="Yeni Şifre"
            value={next}
            onChangeText={setNext}
            placeholder="En az 6 karakter"
            secureTextEntry
          />
          <TextField
            testID="confirm-new-password-input"
            label="Yeni Şifre (Tekrar)"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Yeni şifreni tekrar gir"
            secureTextEntry
          />
          <AppButton
            testID="change-password-submit-button"
            label="Şifreyi Güncelle"
            onPress={submit}
            loading={mutation.isPending}
          />
        </KeyboardAwareScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
ChangePasswordSheet.displayName = "ChangePasswordSheet";

const useStyles = makeStyles((colors) => ({
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20 },
}));
