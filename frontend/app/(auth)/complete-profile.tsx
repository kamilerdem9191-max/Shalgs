import { GraduationCap, ChalkboardTeacher } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { ApiError } from "@/src/api/client";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function CompleteProfile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { completeProfile, logout } = useAuth();
  const toast = useToast();

  const [role, setRole] = useState<"student" | "coach" | null>(null);
  const [grade, setGrade] = useState<7 | 8 | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!role) {
      toast("Rol seç", "error");
      return;
    }
    if (role === "student" && !grade) {
      toast("Sınıfını seç", "error");
      return;
    }
    setLoading(true);
    try {
      await completeProfile(role, role === "student" ? grade ?? undefined : undefined);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Bir hata oluştu", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.body}>
        <Text style={styles.title}>Hoş geldin!</Text>
        <Text style={styles.subtitle}>Devam etmek için hesap türünü seç.</Text>

        <View style={styles.roleRow}>
          <Pressable
            testID="role-student-card"
            style={[styles.roleCard, role === "student" && styles.roleCardActive]}
            onPress={() => setRole("student")}
          >
            <GraduationCap
              size={34}
              color={role === "student" ? colors.brandPrimary : colors.muted}
              weight="fill"
            />
            <Text style={[styles.roleText, role === "student" && styles.roleTextActive]}>Öğrenci</Text>
          </Pressable>
          <Pressable
            testID="role-coach-card"
            style={[styles.roleCard, role === "coach" && styles.roleCardActive]}
            onPress={() => setRole("coach")}
          >
            <ChalkboardTeacher
              size={34}
              color={role === "coach" ? colors.brandPrimary : colors.muted}
              weight="fill"
            />
            <Text style={[styles.roleText, role === "coach" && styles.roleTextActive]}>Koç</Text>
          </Pressable>
        </View>

        {role === "student" ? (
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
                    <Text style={[styles.gradeText, active && styles.gradeTextActive]}>{g}. Sınıf</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <AppButton testID="complete-profile-button" label="Devam Et" onPress={submit} loading={loading} />
        <Pressable testID="logout-link" onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  body: { flex: 1 },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 6, marginBottom: spacing.xl },
  roleRow: { flexDirection: "row", gap: spacing.md },
  roleCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  roleCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  roleText: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700" },
  roleTextActive: { color: colors.onBrandTertiary },
  gradeWrap: { marginTop: spacing.xl },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
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
  actions: { gap: spacing.md },
  logout: { alignItems: "center", paddingVertical: spacing.sm },
  logoutText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
}));
