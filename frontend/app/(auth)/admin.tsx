import { useRouter } from "expo-router";
import { ChartPieSlice, SignOut, Student, Target } from "phosphor-react-native";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { adminLogout, adminStats } from "@/src/api/client";
import { AdminUsers } from "@/src/components/admin-users";
import { AppButton, Card, LoadingView } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Stats = {
  total_students: number;
  students_with_goals: number;
  not_fulfilling_count: number;
  not_fulfilling_ratio: number;
};

export default function AdminPanel() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminStats();
      setStats(data);
    } catch {
      toast("Oturum sona erdi, tekrar giriş yapın", "error");
      await adminLogout();
      router.replace("/(auth)/landing" as any);
    }
  }, [router, toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const logout = async () => {
    await adminLogout();
    router.replace("/(auth)/landing" as any);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingView />
      </View>
    );
  }

  const ratio = stats?.not_fulfilling_ratio ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Müdür Paneli</Text>
          <Text style={styles.subtitle}>Okul geneli özet</Text>
        </View>
        <AppButton
          testID="admin-logout"
          label="Çıkış"
          variant="outline"
          icon={<SignOut size={18} color={colors.brandPrimary} weight="bold" />}
          onPress={logout}
          style={styles.logoutBtn}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
        }
      >
        <Card testID="stat-total-students" style={styles.statCard}>
          <View style={[styles.iconBadge, { backgroundColor: colors.brandTertiary }]}>
            <Student size={26} color={colors.onBrandTertiary} weight="fill" />
          </View>
          <View style={styles.statBody}>
            <Text style={styles.statLabel}>Tüm Öğrenciler</Text>
            <Text style={styles.statValue}>{stats?.total_students ?? 0}</Text>
          </View>
        </Card>

        <Card testID="stat-not-fulfilling" style={styles.statCard}>
          <View style={[styles.iconBadge, { backgroundColor: colors.surfaceTertiary }]}>
            <ChartPieSlice size={26} color={colors.warning} weight="fill" />
          </View>
          <View style={styles.statBody}>
            <Text style={styles.statLabel}>Hedefini Gerçekleştirmeyen Öğrenci Oranı</Text>
            <Text style={[styles.statValue, { color: colors.warning }]}>%{ratio}</Text>
            <View style={styles.ratioTrack}>
              <View style={[styles.ratioFill, { width: `${ratio}%` }]} />
            </View>
            <View style={styles.metaRow}>
              <Target size={15} color={colors.muted} weight="bold" />
              <Text style={styles.metaText}>
                {stats?.not_fulfilling_count ?? 0} / {stats?.students_with_goals ?? 0} hedefli öğrenci
              </Text>
            </View>
          </View>
        </Card>

        <AdminUsers />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 2 },
  logoutBtn: { minHeight: 44, paddingVertical: 10, paddingHorizontal: spacing.md },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.lg },
  statCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statBody: { flex: 1, gap: 4 },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  statValue: { color: colors.onSurface, fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  ratioTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
    marginTop: 8,
  },
  ratioFill: { height: 10, borderRadius: 5, backgroundColor: colors.warning },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  metaText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
}));
