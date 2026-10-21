import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft, ChalkboardTeacher, ChatCircleText, CheckCircle, Target } from "phosphor-react-native";
import { ScrollView, Text, View } from "react-native";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiGet } from "@/src/api/client";
import { Card, LoadingView, ProgressBar } from "@/src/components/ui";
import { StatsView, type Stats } from "@/src/components/StatsView";
import { subjectColor } from "@/src/constants/subjects";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { formatDateLong, formatDateTime } from "@/src/utils/date";

type Goal = { id: string; subject: string; period: "daily" | "weekly"; target: number; current: number; completed: boolean };
type Record = { id: string; subject: string; questions: number; duration_minutes: number | null; note: string | null; study_date: string };
type Comment = { id: string; coach_name: string; text: string; created_at: string };

export default function ParentChildDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["parent-child", id],
    queryFn: () => apiGet(`/parent/children/${id}`),
    enabled: !!id,
  });
  const { data: commentsData } = useQuery({
    queryKey: ["parent-child-comments", id],
    queryFn: () => apiGet(`/parent/children/${id}/comments`),
    enabled: !!id,
  });

  const student = data?.student;
  const stats: Stats | undefined = data?.stats;
  const goals: Goal[] = data?.goals ?? [];
  const records: Record[] = data?.records ?? [];
  const coach = data?.coach as { name: string } | null | undefined;
  const comments: Comment[] = commentsData?.comments ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <CaretLeft size={24} color={colors.onSurface} weight="bold" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{student?.name ?? "Öğrenci"}</Text>
          <Text style={styles.subtitle}>{student?.grade ? `${student.grade}. Sınıf` : ""}</Text>
        </View>
      </View>

      {isLoading || !stats ? (
        <LoadingView />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.coachCard}>
            <ChalkboardTeacher size={22} color={colors.brandPrimary} weight="fill" />
            <Text style={styles.coachText}>
              Koç: <Text style={{ fontWeight: "800" }}>{coach ? coach.name : "Henüz koç yok"}</Text>
            </Text>
          </Card>

          <StatsView stats={stats} />

          {/* Coach messages */}
          <View style={{ gap: spacing.md }}>
            <View style={styles.sectionHead}>
              <ChatCircleText size={20} color={colors.brandPrimary} weight="fill" />
              <Text style={styles.sectionTitle}>Koç Mesajları</Text>
            </View>
            {comments.length === 0 ? (
              <Text style={styles.emptyText}>Koçtan henüz mesaj yok.</Text>
            ) : (
              comments.map((c) => (
                <Card key={c.id} style={styles.commentCard} testID={`parent-comment-${c.id}`}>
                  <Text style={styles.coachName}>{c.coach_name ?? "Koç"}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                  <Text style={styles.commentDate}>{formatDateTime(c.created_at)}</Text>
                </Card>
              ))
            )}
          </View>

          {/* Goals */}
          {goals.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <View style={styles.sectionHead}>
                <Target size={20} color={colors.brandPrimary} weight="fill" />
                <Text style={styles.sectionTitle}>Hedefler</Text>
              </View>
              {goals.map((g) => (
                <Card key={g.id} style={styles.goalCard}>
                  <View style={styles.goalTop}>
                    <Text style={styles.goalSubject}>{g.subject}</Text>
                    <View style={styles.goalRight}>
                      <Text style={styles.goalPeriod}>{g.period === "daily" ? "Günlük" : "Haftalık"}</Text>
                      {g.completed ? <CheckCircle size={18} color={colors.success} weight="fill" /> : null}
                    </View>
                  </View>
                  <ProgressBar
                    progress={g.target > 0 ? g.current / g.target : 0}
                    color={g.completed ? colors.success : subjectColor(g.subject)}
                  />
                  <Text style={styles.goalCount}>{g.current} / {g.target} soru</Text>
                </Card>
              ))}
            </View>
          ) : null}

          {/* Recent records */}
          <View style={{ gap: spacing.md }}>
            <Text style={styles.sectionTitle}>Geçmiş Çalışmalar</Text>
            {records.length === 0 ? (
              <Text style={styles.emptyText}>Henüz çalışma kaydı yok.</Text>
            ) : (
              records.slice(0, 40).map((r) => (
                <Card key={r.id} style={styles.recordCard}>
                  <View style={[styles.dot, { backgroundColor: subjectColor(r.subject) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordSubject}>{r.subject}</Text>
                    <Text style={styles.recordMeta}>
                      {formatDateLong(r.study_date)}
                      {r.questions > 0 ? `  •  ${r.questions} soru` : ""}
                      {r.duration_minutes ? `  •  ${r.duration_minutes} dk` : ""}
                    </Text>
                    {r.note ? <Text style={styles.recordNote}>{r.note}</Text> : null}
                  </View>
                </Card>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 13 },
  coachCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  coachText: { color: colors.onSurfaceSecondary, fontSize: 15 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 14 },
  commentCard: { gap: spacing.sm },
  coachName: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
  commentText: { color: colors.onSurfaceSecondary, fontSize: 16, lineHeight: 23 },
  commentDate: { color: colors.muted, fontSize: 12 },
  goalCard: { gap: spacing.sm },
  goalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalSubject: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700" },
  goalRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  goalPeriod: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  goalCount: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  recordCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  recordSubject: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700" },
  recordMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  recordNote: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 4, fontStyle: "italic" },
}));
