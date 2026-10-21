import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { GraduationCap, GoogleLogo } from "phosphor-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Landing() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { googleLogin } = useAuth();
  const toast = useToast();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await googleLogin();
    } catch {
      toast("Google ile giriş başarısız oldu", "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/school-bg.webp")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
      />
      <LinearGradient
        colors={["rgba(15,23,42,0.25)", "rgba(15,23,42,0.7)", "rgba(15,23,42,0.96)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xl, paddingTop: insets.top }]}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <GraduationCap size={28} color={colors.onBrandPrimary} weight="fill" />
          </View>
        </View>
        <Text style={styles.title}>LGS Koçu</Text>
        <Text style={styles.subtitle}>
          Çalışmanı kaydet, hedeflerini takip et, koçunla birlikte LGS&apos;ye hazırlan.
        </Text>

        <View style={styles.buttons}>
          <AppButton
            testID="student-login-button"
            label="Öğrenci Girişi"
            variant="primary"
            onPress={() => router.push("/(auth)/login?role=student" as any)}
          />
          <AppButton
            testID="coach-login-button"
            label="Koç Girişi"
            variant="secondary"
            onPress={() => router.push("/(auth)/login?role=coach" as any)}
          />
          <AppButton
            testID="parent-login-button"
            label="Veli Girişi"
            variant="outline"
            onPress={() => router.push("/(auth)/login?role=parent" as any)}
          />
          <View style={styles.registerRow}>
            <Pressable
              testID="student-register-button"
              style={styles.registerLink}
              onPress={() => router.push("/(auth)/register?role=student" as any)}
            >
              <Text style={styles.registerText}>Öğrenci Kayıt</Text>
            </Pressable>
            <View style={styles.dot} />
            <Pressable
              testID="coach-register-button"
              style={styles.registerLink}
              onPress={() => router.push("/(auth)/register?role=coach" as any)}
            >
              <Text style={styles.registerText}>Koç Kayıt</Text>
            </Pressable>
            <View style={styles.dot} />
            <Pressable
              testID="parent-register-button"
              style={styles.registerLink}
              onPress={() => router.push("/(auth)/register?role=parent" as any)}
            >
              <Text style={styles.registerText}>Veli Kayıt</Text>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.line} />
          </View>

          <Pressable
            testID="google-login-button"
            style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
            onPress={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <>
                <GoogleLogo size={22} color="#0F172A" weight="bold" />
                <Text style={styles.googleText}>Google ile Giriş Yap</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.brand },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  brandRow: { flexDirection: "row" },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { color: "#FFFFFF", fontSize: 36, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  buttons: { gap: spacing.md, marginTop: spacing.sm },
  registerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, marginTop: spacing.xs },
  registerLink: { paddingVertical: 8, paddingHorizontal: 6 },
  registerText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#94A3B8" },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  line: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.25)" },
  dividerText: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    minHeight: 52,
    paddingVertical: 14,
  },
  googleText: { color: "#0F172A", fontSize: 16, fontWeight: "700" },
}));
