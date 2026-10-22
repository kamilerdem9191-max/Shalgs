import { Trash } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";

import { apiDelete } from "@/src/api/client";
import { ConfirmDialog } from "@/src/components/ui";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { makeStyles, spacing, useTheme } from "@/src/theme";

/** "Hesabımı Sil" link + confirm dialog, shown on every profile screen. */
export function DeleteAccountButton() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await apiDelete("/auth/account");
      setOpen(false);
      toast("Hesabın silindi", "success");
      await logout();
    } catch (e: any) {
      toast(e?.message || "Hesap silinemedi, tekrar dene", "error");
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable testID="delete-account-button" onPress={() => setOpen(true)} style={styles.btn}>
        <Trash size={18} color={colors.error} />
        <Text style={styles.text}>Hesabımı Sil</Text>
      </Pressable>
      <ConfirmDialog
        visible={open}
        title="Hesabın kalıcı olarak silinsin mi?"
        message="Hesabın ve tüm verilerin (çalışma kayıtları, hedefler, yorumlar, koç ve veli bağlantıları) kalıcı olarak silinir. Bu işlem geri alınamaz."
        confirmLabel="Hesabımı Sil"
        destructive
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.sm,
  },
  text: { color: colors.error, fontSize: 15, fontWeight: "700" },
}));
