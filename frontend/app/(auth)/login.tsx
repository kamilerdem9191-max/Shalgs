import { useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft, CheckSquare, Square } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton, TextField } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { ApiError, adminLogin } from "@/src/api/client";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { login } = useAuth();
  const toast = useToast();

  const roleKey = role === "coach" ? "coach" : role === "parent" ? "parent" : "student";
  const loginTitle =
    roleKey === "coach" ? "Koç Girişi" : roleKey === "parent" ? "Veli Girişi" : "Öğrenci Girişi";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      toast("E-posta ve şifre gerekli", "error");
      return;
    }
    // Müdür (admin) girişi — ayrı ekran yok, aynı giriş formundan.
    if (email.trim().toLowerCase() === "admin") {
      setLoading(true);
      try {
        await adminLogin("admin", password);
        router.replace("/(auth)/admin" as any);
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Giriş başarısız", "error");
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password, remember);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Giriş başarısız", "error");
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
        <Text style={styles.title}>{loginTitle}</Text>
        <Text style={styles.subtitle}>Hesabına giriş yaparak devam et.</Text>

        <View style={styles.form}>
          <TextField
            testID="email-input"
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@eposta.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            testID="password-input"
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            placeholder="Şifreniz"
            secureToggle
          />
          <View style={styles.rememberRowWrap}>
            <Pressable
              testID="remember-me-toggle"
              onPress={() => setRemember((v) => !v)}
              style={styles.rememberRow}
              hitSlop={8}
            >
              {remember ? (
                <CheckSquare size={24} color={colors.brandPrimary} weight="fill" />
              ) : (
                <Square size={24} color={colors.muted} />
              )}
              <Text style={styles.rememberText}>Beni Hatırla</Text>
            </Pressable>
            <Pressable
              testID="forgot-password-link"
              onPress={() => router.push(`/(auth)/forgot-password?email=${encodeURIComponent(email.trim())}` as any)}
              hitSlop={8}
            >
              <Text style={styles.link}>Şifremi unuttum?</Text>
            </Pressable>
          </View>
          <AppButton testID="login-submit-button" label="Giriş Yap" onPress={submit} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hesabın yok mu?</Text>
          <Pressable
            testID="go-register-link"
            onPress={() => router.replace(`/(auth)/register?role=${roleKey}` as any)}
          >
            <Text style={styles.link}>Kayıt Ol</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.md, height: 48, justifyContent: "center" },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 6, marginBottom: spacing.xl },
  form: { gap: spacing.lg },
  rememberRowWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: -spacing.xs },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rememberText: { color: colors.onSurfaceTertiary, fontSize: 15, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: spacing.xl },
  footerText: { color: colors.muted, fontSize: 14 },
  link: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
}));
