import { useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft, EnvelopeSimple, LockKey } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiPost, ApiError } from "@/src/api/client";
import { AppButton, TextField } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ForgotPassword() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState(emailParam ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    if (!email.trim()) {
      toast("E-posta gir", "error");
      return;
    }
    setLoading(true);
    try {
      await apiPost("/auth/forgot-password", { email: email.trim() });
      toast("Kod e-postana gönderildi", "success");
      setStep("reset");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "İşlem başarısız", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (code.trim().length !== 6) {
      toast("6 haneli kodu gir", "error");
      return;
    }
    if (password.length < 6) {
      toast("Şifre en az 6 karakter olmalı", "error");
      return;
    }
    if (password !== confirm) {
      toast("Şifreler eşleşmiyor", "error");
      return;
    }
    setLoading(true);
    try {
      await apiPost("/auth/reset-password", {
        email: email.trim(),
        code: code.trim(),
        new_password: password,
      });
      toast("Şifren güncellendi 🎉", "success");
      router.replace("/(auth)/landing" as any);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Sıfırlama başarısız", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <CaretLeft size={24} color={colors.onSurface} weight="bold" />
        </Pressable>
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconBadge}>
          {step === "request" ? (
            <EnvelopeSimple size={28} color={colors.brandPrimary} weight="fill" />
          ) : (
            <LockKey size={28} color={colors.brandPrimary} weight="fill" />
          )}
        </View>
        <Text style={styles.title}>Şifremi Unuttum</Text>
        <Text style={styles.subtitle}>
          {step === "request"
            ? "Hesabına ait e-postayı gir, sana 6 haneli bir sıfırlama kodu gönderelim."
            : "E-postana gelen 6 haneli kodu ve yeni şifreni gir."}
        </Text>

        {step === "request" ? (
          <View style={styles.form}>
            <TextField
              testID="forgot-email-input"
              label="E-posta"
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@eposta.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <AppButton testID="send-code-button" label="Kod Gönder" onPress={requestCode} loading={loading} />
            <Text style={styles.hint}>
              Google ile giriş yaptıysan şifre sıfırlamana gerek yok; doğrudan
              &quot;Google ile Giriş Yap&quot; ile devam et.
            </Text>
          </View>
        ) : (
          <View style={styles.form}>
            <TextField
              testID="reset-code-input"
              label="Sıfırlama Kodu"
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="6 haneli kod"
              keyboardType="number-pad"
            />
            <TextField
              testID="new-password-input"
              label="Yeni Şifre"
              value={password}
              onChangeText={setPassword}
              placeholder="En az 6 karakter"
              secureTextEntry
            />
            <TextField
              testID="confirm-password-input"
              label="Yeni Şifre (Tekrar)"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Şifreni tekrar gir"
              secureTextEntry
            />
            <AppButton testID="reset-password-button" label="Şifreyi Sıfırla" onPress={resetPassword} loading={loading} />
            <Pressable testID="resend-code-link" onPress={requestCode} style={styles.resend}>
              <Text style={styles.link}>Kodu tekrar gönder</Text>
            </Pressable>
            <Text style={styles.hint}>
              E-posta birkaç dakika içinde gelmezse spam / gereksiz klasörünü kontrol et.
            </Text>
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.md, height: 48, justifyContent: "center" },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 6, marginBottom: spacing.xl, lineHeight: 21 },
  form: { gap: spacing.lg },
  resend: { alignItems: "center", paddingVertical: spacing.xs },
  link: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: spacing.xs },
}));
