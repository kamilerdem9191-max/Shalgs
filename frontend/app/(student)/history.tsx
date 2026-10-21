import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotePencil, PencilSimple, TrashSimple } from "phosphor-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiDelete, apiGet, apiPut, ApiError } from "@/src/api/client";
import { AppButton, Card, EmptyState, LoadingView, TextField } from "@/src/components/ui";
import { SUBJECTS, subjectColor } from "@/src/constants/subjects";
import { useToast } from "@/src/context/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { formatDateLong } from "@/src/utils/date";

type Record = {
  id: string;
  subject: string;
  questions: number;
  duration_minutes: number | null;
  note: string | null;
  study_date: string;
};

const FILTERS = [
  { key: "today", label: "Bugün" },
  { key: "week", label: "Bu hafta" },
  { key: "month", label: "Bu ay" },
  { key: "all", label: "Tümü" },
] as const;

export default function History() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("Tümü");
  const [editing, setEditing] = useState<Record | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["study-records", filter],
    queryFn: () => apiGet(`/study-records?filter=${filter}`),
  });
  const records: Record[] = data?.records ?? [];

  const grouped = useMemo(() => {
    const filtered =
      subjectFilter === "Tümü" ? records : records.filter((r) => r.subject === subjectFilter);
    const map = new Map<string, Record[]>();
    for (const r of filtered) {
      if (!map.has(r.study_date)) map.set(r.study_date, []);
      map.get(r.study_date)!.push(r);
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [records, subjectFilter]);

  const subjectOptions = useMemo(() => ["Tümü", ...SUBJECTS], []);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/study-records/${id}`),
    onSuccess: () => {
      toast("Kayıt silindi", "success");
      qc.invalidateQueries({ queryKey: ["study-records"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: () => toast("Silme başarısız", "error"),
  });

  const openEdit = useCallback((r: Record) => {
    setEditing(r);
    sheetRef.current?.present();
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Çalışmalarım</Text>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item }) => {
            const active = filter === item.key;
            return (
              <Pressable
                testID={`filter-${item.key}`}
                onPress={() => setFilter(item.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
        <FlatList
          horizontal
          data={subjectOptions}
          keyExtractor={(s) => s}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectChipsRow}
          renderItem={({ item }) => {
            const active = subjectFilter === item;
            const accent = item === "Tümü" ? colors.brandPrimary : subjectColor(item);
            return (
              <Pressable
                testID={`subject-filter-${item}`}
                onPress={() => setSubjectFilter(item)}
                style={[
                  styles.subjFilterChip,
                  active && { backgroundColor: accent, borderColor: accent },
                ]}
              >
                <Text style={[styles.subjFilterChipText, active && styles.subjFilterChipTextActive]}>
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {isLoading ? (
        <LoadingView />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<NotePencil size={48} color={colors.muted} />}
          title={subjectFilter === "Tümü" ? "Henüz bir çalışma eklemedin" : `${subjectFilter} kaydı yok`}
          subtitle={
            subjectFilter === "Tümü"
              ? "Ana sayfadan bugünkü çalışmanı kaydet."
              : "Farklı bir ders ya da tarih filtresi dene."
          }
        />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(g) => g.date}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.daySection}>
              <Text style={styles.dayTitle}>{formatDateLong(item.date)}</Text>
              <View style={{ gap: spacing.sm }}>
                {item.items.map((r) => (
                  <Card key={r.id} style={styles.recordCard} testID={`record-${r.id}`}>
                    <View style={[styles.dot, { backgroundColor: subjectColor(r.subject) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordSubject}>{r.subject}</Text>
                      <Text style={styles.recordMeta}>
                        {r.questions > 0 ? `${r.questions} soru` : ""}
                        {r.questions > 0 && r.duration_minutes ? "  •  " : ""}
                        {r.duration_minutes ? `${r.duration_minutes} dk` : ""}
                      </Text>
                      {r.note ? <Text style={styles.recordNote}>{r.note}</Text> : null}
                    </View>
                    <Pressable testID={`edit-${r.id}`} onPress={() => openEdit(r)} hitSlop={8} style={styles.iconBtn}>
                      <PencilSimple size={20} color={colors.muted} />
                    </Pressable>
                    <Pressable
                      testID={`delete-${r.id}`}
                      onPress={() => deleteMutation.mutate(r.id)}
                      hitSlop={8}
                      style={styles.iconBtn}
                    >
                      <TrashSimple size={20} color={colors.error} />
                    </Pressable>
                  </Card>
                ))}
              </View>
            </View>
          )}
        />
      )}

      <EditSheet
        ref={sheetRef}
        record={editing}
        onClose={() => sheetRef.current?.dismiss()}
        onSaved={() => {
          sheetRef.current?.dismiss();
          qc.invalidateQueries({ queryKey: ["study-records"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
          qc.invalidateQueries({ queryKey: ["goals"] });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
import React from "react";

const EditSheet = React.forwardRef<
  BottomSheetModal,
  { record: Record | null; onClose: () => void; onSaved: () => void }
>(({ record, onSaved }, ref) => {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [subject, setSubject] = useState<string>("");
  const [questions, setQuestions] = useState("");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");

  const handleChange = useCallback(() => {
    if (record) {
      setSubject(record.subject);
      setQuestions(record.questions ? String(record.questions) : "");
      setDuration(record.duration_minutes ? String(record.duration_minutes) : "");
      setNote(record.note ?? "");
    }
  }, [record]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut(`/study-records/${record!.id}`, {
        subject,
        questions: parseInt(questions || "0", 10) || 0,
        duration_minutes: duration ? parseInt(duration, 10) : null,
        note: note || null,
      }),
    onSuccess: () => {
      toast("Kayıt güncellendi", "success");
      onSaved();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Güncelleme başarısız", "error"),
  });

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["75%"]}
      onChange={handleChange}
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
          <Text style={styles.sheetTitle}>Kaydı Düzenle</Text>
          <Text style={styles.fieldLabel}>Ders</Text>
          <View style={styles.subjectGrid}>
            {SUBJECTS.map((s) => {
              const active = subject === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSubject(s)}
                  style={[styles.subjectChip, active && { backgroundColor: subjectColor(s), borderColor: subjectColor(s) }]}
                >
                  <Text style={[styles.subjectChipText, active && { color: "#FFFFFF" }]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.row}>
            <TextField
              label="Soru sayısı"
              style={{ flex: 1 }}
              value={questions}
              onChangeText={(t) => setQuestions(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
            />
            <TextField
              label="Süre (dk)"
              style={{ flex: 1 }}
              value={duration}
              onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
            />
          </View>
          <TextField label="Not" value={note} onChangeText={setNote} multiline />
          <AppButton
            testID="update-study-button"
            label="Güncelle"
            onPress={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
          />
        </KeyboardAwareScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
EditSheet.displayName = "EditSheet";

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800", marginBottom: spacing.md },
  chipsRow: { gap: spacing.sm, paddingRight: spacing.lg },
  subjectChipsRow: { gap: spacing.sm, paddingRight: spacing.lg, paddingTop: spacing.sm },
  subjFilterChip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  subjFilterChipText: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  subjFilterChipTextActive: { color: "#FFFFFF" },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandPrimary },
  daySection: { gap: spacing.sm },
  dayTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  recordCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  recordSubject: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700" },
  recordMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  recordNote: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 4, fontStyle: "italic" },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
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
}));
