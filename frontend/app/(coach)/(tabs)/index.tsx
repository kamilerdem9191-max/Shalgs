import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Bell, CaretRight, Plus, UserMinus, UserPlus, Users } from "phosphor-react-native";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiGet, apiPost, apiDelete, ApiError } from "@/src/api/client";
import { AppButton, Card, ConfirmDialog, EmptyState, LoadingView, TextField } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { formatDateLong, formatDateTime } from "@/src/utils/date";

type Student = {
  user_id: string;
  name: string;
  grade: number | null;
  week_questions: number;
  days_studied: number;
  last_study: string | null;
};

type CoachNotification = {
  id: string;
  student_name: string;
  subject: string;
  read: boolean;
  created_at: string;
};

export default function CoachStudents() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const sheetRef = useRef<BottomSheetModal>(null);
  const notifSheetRef = useRef<BottomSheetModal>(null);
  const [code, setCode] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Student | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["coach-students"],
    queryFn: () => apiGet("/coach/students"),
  });
  const students: Student[] = data?.students ?? [];

  const { data: notifData } = useQuery({
    queryKey: ["coach-notifications"],
    queryFn: () => apiGet("/coach/notifications"),
    refetchInterval: 30000,
  });
  const notifications: CoachNotification[] = notifData?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const readAllMutation = useMutation({
    mutationFn: () => apiPost("/coach/notifications/read-all", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-notifications"] }),
  });

  const openNotifications = () => {
    notifSheetRef.current?.present();
    if (unreadCount > 0) readAllMutation.mutate();
  };

  const addMutation = useMutation({
    mutationFn: () => apiPost("/connections/request", { student_code: code.trim() }),
    onSuccess: () => {
      toast("İstek gönderildi. Öğrenci onaylayınca eklenecek.", "success");
      setCode("");
      sheetRef.current?.dismiss();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "İstek gönderilemedi", "error"),
  });

  const removeMutation = useMutation({
    mutationFn: (studentId: string) => apiDelete(`/coach/students/${studentId}`),
    onSuccess: () => {
      toast("Öğrenci listenden kaldırıldı", "success");
      setRemoveTarget(null);
      qc.invalidateQueries({ queryKey: ["coach-students"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Öğrenci kaldırılamadı", "error"),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Öğrencilerim</Text>
        <View style={styles.headerActions}>
          <Pressable testID="notifications-button" style={styles.bellBtn} onPress={openNotifications}>
            <Bell size={22} color={colors.onSurface} weight="regular" />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable testID="add-student-button" style={styles.addBtn} onPress={() => sheetRef.current?.present()}>
            <Plus size={22} color={colors.onBrandPrimary} weight="bold" />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <LoadingView />
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color={colors.muted} />}
          title="Henüz öğrencin yok"
          subtitle="Sağ üstteki + ile öğrenci kodunu girerek bağlantı isteği gönder."
          action={
            <AppButton
              testID="add-student-empty-button"
              label="Öğrenci Ekle"
              icon={<UserPlus size={20} color={colors.onBrandPrimary} weight="bold" />}
              onPress={() => sheetRef.current?.present()}
            />
          }
        />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(s) => s.user_id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`student-card-${item.user_id}`}
              onPress={() => router.push(`/(coach)/student/${item.user_id}` as any)}
            >
              <Card style={styles.studentCard}>
                <View style={styles.studentTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{item.name}</Text>
                    <Text style={styles.studentGrade}>{item.grade ? `${item.grade}. Sınıf` : "—"}</Text>
                  </View>
                  <Pressable
                    testID={`remove-student-${item.user_id}`}
                    onPress={() => setRemoveTarget(item)}
                    hitSlop={10}
                    style={styles.removeBtn}
                  >
                    <UserMinus size={20} color={colors.error} weight="bold" />
                  </Pressable>
                  <CaretRight size={20} color={colors.muted} />
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{item.week_questions}</Text>
                    <Text style={styles.statLabel}>Bu hafta soru</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{item.days_studied}</Text>
                    <Text style={styles.statLabel}>Çalışma günü</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValueSmall}>
                      {item.last_study ? formatDateLong(item.last_study) : "—"}
                    </Text>
                    <Text style={styles.statLabel}>Son çalışma</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["50%"]}
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
            <Text style={styles.sheetTitle}>Öğrenci Ekle</Text>
            <Text style={styles.sheetSub}>Öğrencinin sana verdiği kodu gir. Öğrenci isteği onayladığında eklenir.</Text>
            <TextField
              testID="student-code-input"
              label="Öğrenci Kodu"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="OGR-XXXXXX"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <AppButton
              testID="send-request-button"
              label="İstek Gönder"
              onPress={() => {
                if (!code.trim()) {
                  toast("Kod gir", "error");
                  return;
                }
                addMutation.mutate();
              }}
              loading={addMutation.isPending}
            />
          </KeyboardAwareScrollView>
        </BottomSheetView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={notifSheetRef}
        snapPoints={["60%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
      >
        <BottomSheetView style={{ flex: 1, padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
          <Text style={styles.sheetTitle}>Bildirimler 🔔</Text>
          {notifications.length === 0 ? (
            <Text style={[styles.sheetSub, { marginTop: spacing.md }]}>Henüz bildirim yok.</Text>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(n) => n.id}
              contentContainerStyle={{ paddingTop: spacing.md, gap: spacing.sm }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Card style={styles.notifCard}>
                  <Text style={styles.notifText}>
                    <Text style={styles.notifName}>{item.student_name}</Text>
                    {` "${item.subject}" hedefini tamamladı olarak işaretledi.`}
                  </Text>
                  <Text style={styles.notifDate}>{formatDateTime(item.created_at)}</Text>
                </Card>
              )}
            />
          )}
        </BottomSheetView>
      </BottomSheetModal>

      <ConfirmDialog
        visible={!!removeTarget}
        title="Öğrenciyi Kaldır"
        message={`${removeTarget?.name ?? "Bu öğrenci"} listenden kaldırılacak. Öğrencinin verileri silinmez; istersen tekrar ekleyebilirsin.`}
        confirmLabel="Kaldır"
        cancelLabel="Vazgeç"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.user_id)}
        onCancel={() => setRemoveTarget(null)}
      />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "800" },
  notifCard: { gap: 4 },
  notifText: { color: colors.onSurface, fontSize: 14, lineHeight: 20 },
  notifName: { fontWeight: "800", color: colors.brandPrimary },
  notifDate: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  studentCard: { gap: spacing.md },
  studentTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  removeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  studentName: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  studentGrade: { color: colors.muted, fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { color: colors.brandPrimary, fontSize: 20, fontWeight: "800" },
  statValueSmall: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "center" },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sheetSub: { color: colors.muted, fontSize: 14, lineHeight: 20 },
}));
