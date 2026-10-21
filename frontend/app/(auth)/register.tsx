import { useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton, TextField } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { ApiError } from "@/src/api/client";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Register() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { register } = useAuth();
  const toast = useToast();

  const roleKey = role === "coach" ? "coach" : role === "parent" ? "parent" : "student";
  const isStudent = roleKey === "student";
  const registerTitle =
    roleKey === "coach" ? "Koç Kayıt" : roleKey === "parent" ? "Veli Kayıt" : "Öğrenci Kayıt";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState<7 | 8 | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password) {
      toast("Tüm alanları doldur", "error");
      return;
    }
    if (password.length < 6) {
      toast("Şifre en az 6 karakter olmalı", "error");
      return;
    }
    if (isStudent && !grade) {
      toast("Sınıfını seç", "error");
      return;
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role: roleKey,
        grade: isStudent ? grade ?? undefined : undefined,
      });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Kayıt başarısız", "error");
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
        <Text style={styles.title}>{registerTitle}</Text>
        <Text style={styles.subtitle}>Yeni bir hesap oluştur.</Text>

        <View style={styles.form}>
          <TextField
            testID="name-input"
            label="Ad Soyad"
            value={name}
            onChangeText={setName}
            placeholder="Adın Soyadın"
            autoCapitalize="words"
          />
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
            placeholder="En az 6 karakter"
            secureTextEntry
          />

          {isStudent ? (
            <View style={styles.gradeWrap}>
              <Text style={styles.label}>Sınıf</Text>
              <View style={styles.gradeRow}>
                {[7, 8].map((g) => {
                  const active = grade === g;
                  return (
                    <Pressable
                      key={g}
                      testID={`grade-${g}-button`}
                      onPress={() => setGrade(g as 7 | 8)}
                      style={[styles.gradeChip, active && styles.gradeChipActive]}
                    >
                      <Text style={[styles.gradeText, active && styles.gradeTextActive]}>
                        {g}. Sınıf
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <AppButton testID="register-submit-button" label="Kayıt Ol" onPress={submit} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Zaten hesabın var mı?</Text>
          <Pressable
            testID="go-login-link"
            onPress={() => router.replace(`/(auth)/login?role=${roleKey}` as any)}
          >
            <Text style={styles.link}>Giriş Yap</Text>
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
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  gradeWrap: {},
  gradeRow: { flexDirection: "row", gap: spacing.md },
  gradeChip: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  gradeChipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  gradeText: { color: colors.onSurfaceTertiary, fontSize: 16, fontWeight: "700" },
  gradeTextActive: { color: colors.onBrandTertiary },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: spacing.xl },
  footerText: { color: colors.muted, fontSize: 14 },
  link: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
}));
