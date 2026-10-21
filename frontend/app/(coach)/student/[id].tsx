import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CaretLeft,
  ChatCircleText,
  CheckCircle,
  Target,
  TrashSimple,
  UserMinus,
} from "phosphor-react-native";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiDelete, apiGet, apiPost, ApiError } from "@/src/api/client";
import { AppButton, Card, ConfirmDialog, LoadingView, ProgressBar, TextField } from "@/src/components/ui";
import { StatsView, type Stats } from "@/src/components/StatsView";
import { SUBJECTS, subjectColor } from "@/src/constants/subjects";
import { useToast } from "@/src/context/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { formatDateLong } from "@/src/utils/date";

type Goal = {
  id: string;
  subject: string;
  period: "daily" | "weekly";
  target: number;
  current: number;
  completed: boolean;
};
type Record = {
  id: string;
  subject: string;
  questions: number;
  duration_minutes: number | null;
  note: string | null;
  study_date: string;
};

export default function CoachStudentDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const goalSheet = useRef<BottomSheetModal>(null);
  const commentSheet = useRef<BottomSheetModal>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["coach-student", id],
    queryFn: () => apiGet(`/coach/students/${id}`),
    enabled: !!id,
  });

  const student = data?.student;
  const stats: Stats | undefined = data?.stats;
  const goals: Goal[] = data?.goals ?? [];
  const records: Record[] = data?.records ?? [];

  // goal form
  const [gSubject, setGSubject] = useState<string | null>(null);
  const [gPeriod, setGPeriod] = useState<"daily" | "weekly">("daily");
  const [gTarget, setGTarget] = useState("");
  const [comment, setComment] = useState("");
  const [showRemove, setShowRemove] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["coach-student", id] });
    qc.invalidateQueries({ queryKey: ["coach-students"] });
  };

  const goalMutation = useMutation({
    mutationFn: () =>
      apiPost(`/coach/students/${id}/goals`, {
        subject: gSubject,
        period: gPeriod,
        target: parseInt(gTarget || "0", 10) || 0,
      }),
    onSuccess: () => {
      toast("Hedef kaydedildi", "success");
      setGSubject(null);
      setGTarget("");
      goalSheet.current?.dismiss();
      invalidate();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Hedef kaydedilemedi", "error"),
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (goalId: string) => apiDelete(`/goals/${goalId}`),
    onSuccess: () => {
      toast("Hedef silindi", "success");
      invalidate();
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => apiPost(`/coach/students/${id}/comments`, { text: comment.trim() }),
    onSuccess: () => {
      toast("Yorum gönderildi", "success");
      setComment("");
      commentSheet.current?.dismiss();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Yorum gönderilemedi", "error"),
  });

  const removeMutation = useMutation({
    mutationFn: () => apiDelete(`/coach/students/${id}`),
    onSuccess: () => {
      toast("Öğrenci listenden kaldırıldı", "success");
      qc.invalidateQueries({ queryKey: ["coach-students"] });
      router.back();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Öğrenci kaldırılamadı", "error"),
  });

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <CaretLeft size={24} color={colors.onSurface} weight="bold" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {student?.name ?? "Öğrenci"}
          </Text>
          <Text style={styles.subtitle}>{student?.grade ? `${student.grade}. Sınıf` : ""}</Text>
        </View>
        <Pressable
          testID="remove-student-button"
          onPress={() => setShowRemove(true)}
          hitSlop={12}
          style={styles.removeBtn}
        >
          <UserMinus size={22} color={colors.error} weight="bold" />
        </Pressable>
      </View>

      {isLoading || !stats ? (
        <LoadingView />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + 90,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <StatsView stats={stats} />

          {/* Goals */}
          <View style={{ gap: spacing.md }}>
            <View style={styles.sectionHead}>
              <Target size={20} color={colors.brandPrimary} weight="fill" />
              <Text style={styles.sectionTitle}>Hedefler</Text>
            </View>
            {goals.length === 0 ? (
              <Text style={styles.emptyText}>Bu öğrenci için henüz hedef belirlemedin.</Text>
            ) : (
              goals.map((g) => (
                <Card key={g.id} style={styles.goalCard} testID={`goal-${g.subject}`}>
                  <View style={styles.goalTop}>
                    <Text style={styles.goalSubject}>{g.subject}</Text>
                    <View style={styles.goalRight}>
                      <Text style={styles.goalPeriod}>{g.period === "daily" ? "Günlük" : "Haftalık"}</Text>
                      {g.completed ? <CheckCircle size={18} color={colors.success} weight="fill" /> : null}
                      <Pressable
                        testID={`delete-goal-${g.id}`}
                        onPress={() => deleteGoalMutation.mutate(g.id)}
                        hitSlop={8}
                      >
                        <TrashSimple size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                  <ProgressBar
                    progress={g.target > 0 ? g.current / g.target : 0}
                    color={g.completed ? colors.success : subjectColor(g.subject)}
                  />
                  <Text style={styles.goalCount}>
                    {g.current} / {g.target} soru
                  </Text>
                </Card>
              ))
            )}
          </View>

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

      {/* Sticky CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <AppButton
          testID="set-goal-button"
          label="Hedef Belirle"
          variant="outline"
          icon={<Target size={20} color={colors.brandPrimary} weight="bold" />}
          style={{ flex: 1 }}
          onPress={() => goalSheet.current?.present()}
        />
        <AppButton
          testID="write-comment-button"
          label="Yorum Yaz"
          icon={<ChatCircleText size={20} color={colors.onBrandPrimary} weight="bold" />}
          style={{ flex: 1 }}
          onPress={() => commentSheet.current?.present()}
        />
      </View>

      {/* Goal Sheet */}
      <BottomSheetModal
        ref={goalSheet}
        snapPoints={["90%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm }}
            bottomOffset={24}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sheetTitle}>Ders Hedefi Belirle</Text>
            <Text style={styles.fieldLabel}>Ders</Text>
            <View style={styles.subjectGrid}>
              {SUBJECTS.map((s) => {
                const active = gSubject === s;
                return (
                  <Pressable
                    key={s}
                    testID={`goal-subject-${s}`}
                    onPress={() => setGSubject(s)}
                    style={[styles.subjectChip, active && { backgroundColor: subjectColor(s), borderColor: subjectColor(s) }]}
                  >
                    <Text style={[styles.subjectChipText, active && { color: "#FFFFFF" }]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Hedef Türü</Text>
            <View style={styles.periodRow}>
              {(["daily", "weekly"] as const).map((p) => {
                const active = gPeriod === p;
                return (
                  <Pressable
                    key={p}
                    testID={`period-${p}`}
                    onPress={() => setGPeriod(p)}
                    style={[styles.periodChip, active && styles.periodChipActive]}
                  >
                    <Text style={[styles.periodText, active && styles.periodTextActive]}>
                      {p === "daily" ? "Günlük" : "Haftalık"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextField
              testID="goal-target-input"
              label="Hedef soru sayısı"
              value={gTarget}
              onChangeText={(t) => setGTarget(t.replace(/[^0-9]/g, ""))}
              placeholder="50"
              keyboardType="number-pad"
            />

            <AppButton
              testID="save-goal-button"
              label="Hedefi Kaydet"
              onPress={() => {
                if (!gSubject) {
                  toast("Ders seç", "error");
                  return;
                }
                if (!gTarget || parseInt(gTarget, 10) <= 0) {
                  toast("Hedef gir", "error");
                  return;
                }
                goalMutation.mutate();
              }}
              loading={goalMutation.isPending}
            />
          </KeyboardAwareScrollView>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Comment Sheet */}
      <BottomSheetModal
        ref={commentSheet}
        snapPoints={["60%"]}
        enablePanDownToClose
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
            <Text style={styles.sheetTitle}>Yorum Yaz</Text>
            <Text style={styles.sheetSub}>Öğrencine geri bildirim gönder. Öğrenci &quot;Koçum&quot; sayfasında görecek.</Text>
            <TextField
              testID="comment-input"
              value={comment}
              onChangeText={setComment}
              placeholder="Bu hafta düzenli çalışmışsın..."
              multiline
              style={{ minHeight: 120 }}
            />
            <AppButton
              testID="send-comment-button"
              label="Gönder"
              onPress={() => {
                if (!comment.trim()) {
                  toast("Yorum yaz", "error");
                  return;
                }
                commentMutation.mutate();
              }}
              loading={commentMutation.isPending}
            />
          </KeyboardAwareScrollView>
        </BottomSheetView>
      </BottomSheetModal>

      <ConfirmDialog
        visible={showRemove}
        title="Öğrenciyi Kaldır"
        message={`${student?.name ?? "Bu öğrenci"} listenden kaldırılacak. Öğrencinin verileri silinmez; istersen tekrar ekleyebilirsin.`}
        confirmLabel="Kaldır"
        cancelLabel="Vazgeç"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate()}
        onCancel={() => setShowRemove(false)}
      />
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
  removeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 13 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 14 },
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
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sheetSub: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  fieldLabel: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  subjectGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  subjectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  subjectChipText: { color: colors.onSurfaceTertiary, fontSize: 14, fontWeight: "600" },
  periodRow: { flexDirection: "row", gap: spacing.md },
  periodChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  periodChipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  periodText: { color: colors.onSurfaceTertiary, fontSize: 15, fontWeight: "700" },
  periodTextActive: { color: colors.onBrandTertiary },
}));
