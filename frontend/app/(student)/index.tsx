import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Target } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiGet, apiPost, ApiError } from "@/src/api/client";
import { AppButton, Card, ProgressBar, TextField } from "@/src/components/ui";
import { SUBJECTS, subjectColor } from "@/src/constants/subjects";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { todayISO } from "@/src/utils/date";

type Goal = {
  id: string;
  subject: string;
  period: "daily" | "weekly";
  target: number;
  current: number;
  completed: boolean;
  has_coach: boolean;
  student_completed: boolean;
};

type PendingConn = { id: string; coach_name: string };

export default function StudentHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [subject, setSubject] = useState<string | null>(null);
  const [questions, setQuestions] = useState("");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");

  const { data: goalsData } = useQuery({
    queryKey: ["goals"],
    queryFn: () => apiGet("/goals"),
  });
  const goals: Goal[] = goalsData?.goals ?? [];

  const { data: pendingData } = useQuery({
    queryKey: ["pending-connections"],
    queryFn: () => apiGet("/connections/pending"),
  });
  const pending: PendingConn[] = pendingData?.connections ?? [];

  const completeGoalMutation = useMutation({
    mutationFn: (goalId: string) => apiPost(`/goals/${goalId}/complete`, {}),
    onSuccess: () => {
      toast("Koçuna bildirildi 🔔", "success");
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Bir hata oluştu", "error"),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPost("/study-records", {
        subject,
        questions: parseInt(questions || "0", 10) || 0,
        duration_minutes: duration ? parseInt(duration, 10) : null,
        note: note || null,
        study_date: todayISO(),
      }),
    onSuccess: () => {
      toast("Çalışman kaydedildi 🎉", "success");
      setSubject(null);
      setQuestions("");
      setDuration("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["study-records"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Kayıt başarısız", "error"),
  });

  const connMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" }) =>
      apiPost(`/connections/${id}/${action}`),
    onSuccess: (_d, v) => {
      toast(v.action === "accept" ? "Koç bağlantısı kabul edildi" : "İstek reddedildi", "success");
      qc.invalidateQueries({ queryKey: ["pending-connections"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const handleSave = () => {
    if (!subject) {
      toast("Bir ders seç", "error");
      return;
    }
    const q = parseInt(questions || "0", 10) || 0;
    const d = duration ? parseInt(duration, 10) : 0;
    if (q <= 0 && d <= 0) {
      toast("Soru sayısı veya süre gir", "error");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.greetingSmall}>Merhaba,</Text>
        <Text style={styles.greetingName} testID="student-greeting">
          {user?.name ?? "Öğrenci"} 👋
        </Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {pending.map((p) => (
          <Card key={p.id} style={styles.pendingCard} testID={`pending-conn-${p.id}`}>
            <Text style={styles.pendingTitle}>Koç Bağlantı İsteği</Text>
            <Text style={styles.pendingText}>
              <Text style={{ fontWeight: "700" }}>{p.coach_name}</Text> seni öğrencisi olarak eklemek istiyor.
            </Text>
            <View style={styles.pendingActions}>
              <AppButton
                testID={`accept-conn-${p.id}`}
                label="Kabul Et"
                variant="primary"
                style={{ flex: 1 }}
                onPress={() => connMutation.mutate({ id: p.id, action: "accept" })}
              />
              <AppButton
                testID={`reject-conn-${p.id}`}
                label="Reddet"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => connMutation.mutate({ id: p.id, action: "reject" })}
              />
            </View>
          </Card>
        ))}

        {/* Quick entry */}
        <Text style={styles.sectionTitle}>Bugün ne yaptın?</Text>
        <Card style={styles.formCard}>
          <Text style={styles.fieldLabel}>Ders</Text>
          <View style={styles.subjectGrid}>
            {SUBJECTS.map((s) => {
              const active = subject === s;
              return (
                <Pressable
                  key={s}
                  testID={`subject-${s}`}
                  onPress={() => setSubject(s)}
                  style={[
                    styles.subjectChip,
                    active && { backgroundColor: subjectColor(s), borderColor: subjectColor(s) },
                  ]}
                >
                  <Text style={[styles.subjectChipText, active && { color: "#FFFFFF" }]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row}>
            <TextField
              testID="questions-input"
              label="Soru sayısı"
              style={{ flex: 1 }}
              value={questions}
              onChangeText={(t) => setQuestions(t.replace(/[^0-9]/g, ""))}
              placeholder="45"
              keyboardType="number-pad"
            />
            <TextField
              testID="duration-input"
              label="Süre (dk)"
              style={{ flex: 1 }}
              value={duration}
              onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ""))}
              placeholder="50"
              keyboardType="number-pad"
            />
          </View>

          <TextField
            testID="note-input"
            label="Kısa not (isteğe bağlı)"
            value={note}
            onChangeText={setNote}
            placeholder="Örn: Paragraf konusu zor geldi"
            multiline
          />

          <AppButton
            testID="save-study-button"
            label="Kaydet"
            onPress={handleSave}
            loading={saveMutation.isPending}
          />
        </Card>

        {/* Goals */}
        {goals.length > 0 ? (
          <View style={styles.goalsSection}>
            <View style={styles.goalsHeader}>
              <Target size={20} color={colors.brandPrimary} weight="fill" />
              <Text style={styles.sectionTitle}>Hedeflerin</Text>
            </View>
            {goals.map((g) => (
              <Card key={g.id} style={styles.goalCard} testID={`goal-${g.subject}`}>
                <View style={styles.goalTop}>
                  <Text style={styles.goalSubject}>{g.subject}</Text>
                  <View style={styles.goalRight}>
                    <Text style={styles.goalPeriod}>{g.period === "daily" ? "Günlük" : "Haftalık"}</Text>
                    {g.completed ? (
                      <CheckCircle size={20} color={colors.success} weight="fill" />
                    ) : null}
                  </View>
                </View>
                <ProgressBar
                  progress={g.target > 0 ? g.current / g.target : 0}
                  color={g.completed ? colors.success : subjectColor(g.subject)}
                />
                <Text style={styles.goalCount}>
                  {g.current} / {g.target} soru
                </Text>
                {g.has_coach ? (
                  g.student_completed ? (
                    <View style={styles.goalDoneRow}>
                      <CheckCircle size={18} color={colors.success} weight="fill" />
                      <Text style={styles.goalDoneText}>Koçuna tamamlandı olarak bildirildi</Text>
                    </View>
                  ) : (
                    <AppButton
                      label="Tamamlandı olarak işaretle"
                      variant="secondary"
                      onPress={() => completeGoalMutation.mutate(g.id)}
                      loading={completeGoalMutation.isPending && completeGoalMutation.variables === g.id}
                      testID={`complete-goal-${g.subject}`}
                    />
                  )
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}
      </KeyboardAwareScrollView>
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
  greetingSmall: { color: colors.muted, fontSize: 15 },
  greetingName: { color: colors.onSurface, fontSize: 26, fontWeight: "800" },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  formCard: { gap: spacing.md },
  fieldLabel: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  subjectGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  subjectChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  subjectChipText: { color: colors.onSurfaceTertiary, fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", gap: spacing.md },
  goalsSection: { gap: spacing.md, marginTop: spacing.sm },
  goalsHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  goalCard: { gap: spacing.sm },
  goalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalSubject: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700" },
  goalRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  goalPeriod: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  goalCount: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  goalDoneRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  goalDoneText: { color: colors.success, fontSize: 13, fontWeight: "700" },
  pendingCard: { gap: spacing.md, borderColor: colors.brandPrimary, borderWidth: 1.5 },
  pendingTitle: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  pendingText: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 21 },
  pendingActions: { flexDirection: "row", gap: spacing.md },
}));
