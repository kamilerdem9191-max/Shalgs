import { Key, MagnifyingGlass } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { adminResetPassword, adminUsers } from "@/src/api/client";
import { Card, ConfirmDialog, TextField } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type AdminUser = {
  user_id: string;
  name?: string;
  email?: string;
  role?: string;
  student_code?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  student: "Öğrenci",
  coach: "Öğretmen",
  parent: "Veli",
};

export function AdminUsers() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ userId: string; password: string } | null>(null);

  useEffect(() => {
    adminUsers()
      .then((d) => setUsers(d.users || []))
      .catch(() => toast("Kullanıcılar yüklenemedi", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.student_code].some((v) => (v || "").toLocaleLowerCase("tr").includes(q))
    );
  }, [users, query]);

  const confirmReset = async () => {
    if (!target) return;
    setResetting(true);
    try {
      const d = await adminResetPassword(target.user_id);
      setResult({ userId: target.user_id, password: d.temporary_password });
      toast("Yeni şifre oluşturuldu", "success");
    } catch (e: any) {
      toast(e?.message || "Şifre sıfırlanamadı", "error");
    } finally {
      setResetting(false);
      setTarget(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Kullanıcılar ve Şifre Sıfırlama</Text>
      <TextField
        testID="admin-user-search"
        placeholder="İsim, e-posta veya öğrenci kodu ara"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} />
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>Kullanıcı bulunamadı</Text>
      ) : (
        filtered.map((u) => (
          <Card key={u.user_id} testID={`admin-user-${u.user_id}`} style={styles.row}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{u.name || "İsimsiz"}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {ROLE_LABELS[u.role || ""] || u.role} · {u.email}
                  {u.student_code ? ` · ${u.student_code}` : ""}
                </Text>
              </View>
              <Pressable
                testID={`admin-reset-${u.user_id}`}
                onPress={() => setTarget(u)}
                style={styles.resetBtn}
                hitSlop={6}
              >
                <Key size={16} color={colors.brandPrimary} weight="bold" />
                <Text style={styles.resetText}>Sıfırla</Text>
              </Pressable>
            </View>
            {result?.userId === u.user_id ? (
              <View testID="admin-temp-password" style={styles.resultBox}>
                <Text style={styles.resultLabel}>Yeni geçici şifre (kullanıcıya iletin):</Text>
                <Text selectable style={styles.resultPw}>{result.password}</Text>
              </View>
            ) : null}
          </Card>
        ))
      )}

      {!loading && query === "" ? (
        <View style={styles.hint}>
          <MagnifyingGlass size={14} color={colors.muted} />
          <Text style={styles.meta}>Toplam {users.length} kullanıcı</Text>
        </View>
      ) : null}

      <ConfirmDialog
        visible={!!target}
        title="Şifre sıfırlansın mı?"
        message={`${target?.name || "Kullanıcı"} için yeni bir geçici şifre oluşturulacak. Eski şifre artık çalışmayacak.`}
        confirmLabel="Sıfırla"
        loading={resetting}
        onConfirm={confirmReset}
        onCancel={() => setTarget(null)}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginTop: spacing.sm },
  empty: { color: colors.muted, fontSize: 14, textAlign: "center", paddingVertical: spacing.lg },
  row: { gap: spacing.sm },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  resetText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
  resultBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    gap: 4,
  },
  resultLabel: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  resultPw: { color: colors.onSurface, fontSize: 22, fontWeight: "800", letterSpacing: 2 },
  hint: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
}));
