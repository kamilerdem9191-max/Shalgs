import { useMemo } from "react";
import { Dimensions, Text, View } from "react-native";
import { BarChart, PieChart } from "react-native-gifted-charts";

import { Card } from "@/src/components/ui";
import { SUBJECT_SHORT, subjectColor } from "@/src/constants/subjects";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export type Stats = {
  total_questions: number;
  total_minutes: number;
  days_studied: number;
  subject_distribution: { subject: string; questions: number }[];
  daily: { label: string; date: string; questions: number }[];
};

function Metric({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <Card style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Card>
  );
}

export function StatsView({ stats, weekly }: { stats: Stats; weekly?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const screenW = Dimensions.get("window").width;

  const barData = useMemo(
    () =>
      stats.daily.map((d) => ({
        value: d.questions,
        label: d.label,
        frontColor: colors.brandPrimary,
      })),
    [stats.daily, colors.brandPrimary],
  );

  const pieData = useMemo(
    () =>
      stats.subject_distribution.map((s) => ({
        value: s.questions,
        color: subjectColor(s.subject),
      })),
    [stats.subject_distribution],
  );

  const maxBar = Math.max(10, ...stats.daily.map((d) => d.questions));
  const hasSubjects = stats.subject_distribution.length > 0;
  const chartWidth = screenW - spacing.lg * 2 - spacing.lg * 2;

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.weekLabel}>{weekly === false ? "Genel" : "Bu hafta"}</Text>
      <View style={styles.metricRow}>
        <Metric value={String(stats.total_questions)} label="Toplam soru" />
        <Metric value={String(stats.days_studied)} label="Çalışma günü" />
        <Metric value={String(stats.total_minutes)} label="Dakika" />
      </View>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Günlük soru dağılımı</Text>
        <View style={{ marginTop: spacing.md, marginLeft: -spacing.sm, paddingBottom: 28 }}>
          <BarChart
            data={barData}
            barWidth={Math.max(14, (chartWidth - 60) / 7 - 10)}
            spacing={10}
            initialSpacing={8}
            roundedTop
            noOfSections={4}
            maxValue={Math.ceil(maxBar / 10) * 10}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={colors.border}
            yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
            rotateLabel
            xAxisLabelsVerticalShift={20}
            xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
            rulesColor={colors.divider}
            width={chartWidth}
            height={160}
          />
        </View>
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Derslere göre dağılım</Text>
        {hasSubjects ? (
          <View style={styles.pieRow}>
            <PieChart
              data={pieData}
              donut
              radius={70}
              innerRadius={44}
              innerCircleColor={colors.surfaceSecondary}
              centerLabelComponent={() => (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.pieCenterValue}>{stats.total_questions}</Text>
                  <Text style={styles.pieCenterLabel}>soru</Text>
                </View>
              )}
            />
            <View style={styles.legend}>
              {stats.subject_distribution.map((s) => (
                <View key={s.subject} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: subjectColor(s.subject) }]} />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {SUBJECT_SHORT[s.subject] ?? s.subject}
                  </Text>
                  <Text style={styles.legendValue}>{s.questions}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyChart}>İstatistik için veri bekleniyor.</Text>
        )}
      </Card>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  weekLabel: { color: colors.muted, fontSize: 14, fontWeight: "700", textTransform: "uppercase" },
  metricRow: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, alignItems: "center", paddingVertical: spacing.lg, gap: 2 },
  metricValue: { color: colors.brandPrimary, fontSize: 24, fontWeight: "800" },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", textAlign: "center" },
  chartCard: { gap: spacing.xs },
  chartTitle: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700" },
  pieRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.md },
  pieCenterValue: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  pieCenterLabel: { color: colors.muted, fontSize: 11 },
  legend: { flex: 1, gap: spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600", flex: 1 },
  legendValue: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  emptyChart: { color: colors.muted, fontSize: 14, textAlign: "center", paddingVertical: spacing.xl },
}));
