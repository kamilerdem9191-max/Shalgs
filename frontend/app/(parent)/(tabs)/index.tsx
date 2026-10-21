import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CaretRight, Plus, UserPlus, UsersThree } from "phosphor-react-native";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiGet, apiPost, ApiError } from "@/src/api/client";
import { AppButton, Card, EmptyState, LoadingView, TextField } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { formatDateLong } from "@/src/utils/date";

type Child = {
  user_id: string;
  name: string;
  grade: number | null;
  week_questions: number;
  days_studied: number;
  last_study: string | null;
};

export default function ParentChildren() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [code, setCode] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["parent-children"],
    queryFn: () => apiGet("/parent/children"),
  });
  const children: Child[] = data?.children ?? [];

  const addMutation = useMutation({
    mutationFn: () => apiPost("/parent/connect", { student_code: code.trim() }),
    onSuccess: (res) => {
      toast(`${res.student_name} eklendi`, "success");
      setCode("");
      sheetRef.current?.dismiss();
      qc.invalidateQueries({ queryKey: ["parent-children"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Bağlanılamadı", "error"),
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
        <Text style={styles.title}>Çocuklarım</Text>
        <Pressable testID="add-child-button" style={styles.addBtn} onPress={() => sheetRef.current?.present()}>
          <Plus size={22} color={colors.onBrandPrimary} weight="bold" />
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingView />
      ) : children.length === 0 ? (
        <EmptyState
          icon={<UsersThree size={48} color={colors.muted} />}
          title="Henüz çocuk eklemedin"
          subtitle="Öğrencinin sana verdiği öğrenci kodunu girerek çalışmalarını takip et."
          action={
            <AppButton
              testID="add-child-empty-button"
              label="Öğrenci Ekle"
              icon={<UserPlus size={20} color={colors.onBrandPrimary} weight="bold" />}
              onPress={() => sheetRef.current?.present()}
            />
          }
        />
      ) : (
        <FlatList
          data={children}
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
              testID={`child-card-${item.user_id}`}
              onPress={() => router.push(`/(parent)/child/${item.user_id}` as any)}
            >
              <Card style={styles.childCard}>
                <View style={styles.childTop}>
                  <View>
                    <Text style={styles.childName}>{item.name}</Text>
                    <Text style={styles.childGrade}>{item.grade ? `${item.grade}. Sınıf` : "—"}</Text>
                  </View>
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
            <Text style={styles.sheetSub}>Çocuğunun öğrenci kodunu gir; çalışmalarını ve koç mesajlarını görüntüleyebilirsin.</Text>
            <TextField
              testID="child-code-input"
              label="Öğrenci Kodu"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="OGR-XXXXXX"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <AppButton
              testID="connect-child-button"
              label="Bağlan"
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  childCard: { gap: spacing.md },
  childTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  childName: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  childGrade: { color: colors.muted, fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { color: colors.brandPrimary, fontSize: 20, fontWeight: "800" },
  statValueSmall: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "center" },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sheetSub: { color: colors.muted, fontSize: 14, lineHeight: 20 },
}));
