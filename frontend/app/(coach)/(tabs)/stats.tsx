import { useQuery } from "@tanstack/react-query";
import { ChartBar } from "phosphor-react-native";
import { useState } from "react";
import { Dimensions, RefreshControl, ScrollView, Text, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiGet } from "@/src/api/client";
import { Card, EmptyState, LoadingView } from "@/src/components/ui";
import { makeStyles, spacing, useTheme } from "@/src/theme";

type Student = { user_id: string; name: string; week_questions: number; days_studied: number };

export default function CoachStats() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["coach-students"],
    queryFn: () => apiGet("/coach/students"),
  });
  const students: Student[] = data?.students ?? [];

  const totalQuestions = students.reduce((a, s) => a + s.week_questions, 0);
  const activeStudents = students.filter((s) => s.days_studied > 0).length;
  const chartWidth = Dimensions.get("window").width - spacing.lg * 2 - spacing.lg * 2;

  const barData = students.map((s) => ({
    value: s.week_questions,
    label: (s.name || "").split(" ")[0],
    frontColor: colors.brandPrimary,
  }));
  const maxBar = Math.max(10, ...students.map((s) => s.week_questions));

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>İstatistik</Text>
      </View>
      {isLoading ? (
        <LoadingView />
      ) : students.length === 0 ? (
        <EmptyState
          icon={<ChartBar size={48} color={colors.muted} />}
          title="Veri yok"
          subtitle="Öğrenci ekledikçe burada haftalık özet göreceksin."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.weekLabel}>Bu hafta</Text>
          <View style={styles.metricRow}>
            <Card style={styles.metric}>
              <Text style={styles.metricValue}>{students.length}</Text>
              <Text style={styles.metricLabel}>Öğrenci</Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricValue}>{activeStudents}</Text>
              <Text style={styles.metricLabel}>Aktif öğrenci</Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricValue}>{totalQuestions}</Text>
              <Text style={styles.metricLabel}>Toplam soru</Text>
            </Card>
          </View>

          <Card style={{ gap: spacing.xs }}>
            <Text style={styles.chartTitle}>Öğrenci bazında haftalık soru</Text>
            <View style={{ marginTop: spacing.md, marginLeft: -spacing.sm }}>
              <BarChart
                data={barData}
                barWidth={Math.max(20, (chartWidth - 40) / Math.max(1, students.length) - 12)}
                spacing={16}
                initialSpacing={10}
                roundedTop
                noOfSections={4}
                maxValue={Math.ceil(maxBar / 10) * 10}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
                rulesColor={colors.divider}
                width={chartWidth}
                height={180}
              />
            </View>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800" },
  weekLabel: { color: colors.muted, fontSize: 14, fontWeight: "700", textTransform: "uppercase" },
  metricRow: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, alignItems: "center", paddingVertical: spacing.lg, gap: 2 },
  metricValue: { color: colors.brandPrimary, fontSize: 24, fontWeight: "800" },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", textAlign: "center" },
  chartTitle: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700" },
}));
