import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { CaretRight, EnvelopeSimple, LockKey, SignOut, UsersThree, UserCircle } from "phosphor-react-native";
import { useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiGet } from "@/src/api/client";
import { AppButton, Card, LoadingView } from "@/src/components/ui";
import { ChangePasswordSheet } from "@/src/components/ChangePasswordSheet";
import { useAuth } from "@/src/context/auth";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ParentProfile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const pwSheet = useRef<BottomSheetModal>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => apiGet("/profile"),
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Profil</Text>
      </View>
      {isLoading ? (
        <LoadingView />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <UserCircle size={56} color={colors.brandPrimary} weight="fill" />
            </View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.roleTag}>Veli</Text>
          </View>

          <Card style={{ gap: spacing.md }}>
            <Row
              icon={<EnvelopeSimple size={22} color={colors.brandPrimary} />}
              label="E-posta"
              value={user?.email ?? "-"}
            />
            <View style={styles.divider} />
            <Row
              icon={<UsersThree size={22} color={colors.brandPrimary} />}
              label="Takip Edilen Öğrenci"
              value={String(data?.children_count ?? 0)}
            />
          </Card>

          {user?.has_password ? (
            <Pressable testID="change-password-row" onPress={() => pwSheet.current?.present()}>
              <Card style={styles.actionRow}>
                <View style={styles.rowIcon}>
                  <LockKey size={22} color={colors.brandPrimary} />
                </View>
                <Text style={styles.actionText}>Şifre Değiştir</Text>
                <CaretRight size={20} color={colors.muted} />
              </Card>
            </Pressable>
          ) : null}

          <AppButton
            testID="logout-button"
            label="Çıkış Yap"
            variant="outline"
            icon={<SignOut size={20} color={colors.brandPrimary} />}
            onPress={logout}
          />
        </ScrollView>
      )}
      <ChangePasswordSheet ref={pwSheet} />
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
  avatarWrap: { alignItems: "center", gap: 6, paddingVertical: spacing.md },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  roleTag: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  rowValue: { color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.divider },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  actionText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 16, fontWeight: "700" },
}));
