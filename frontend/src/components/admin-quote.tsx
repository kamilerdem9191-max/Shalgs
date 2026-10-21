import { Quotes } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { adminUpdateQuote, getQuote } from "@/src/api/client";
import { AppButton, Card, TextField } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export function AdminQuote() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getQuote()
      .then((q) => {
        setText(q.text);
        setAuthor(q.author || "");
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!text.trim()) {
      toast("Söz boş olamaz", "error");
      return;
    }
    setSaving(true);
    try {
      await adminUpdateQuote(text, author);
      toast("Söz güncellendi", "success");
    } catch (e: any) {
      toast(e?.message || "Kaydedilemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card testID="admin-quote-card" style={styles.card}>
      <View style={styles.titleRow}>
        <Quotes size={20} color={colors.brandPrimary} weight="fill" />
        <Text style={styles.title}>Ana Ekrandaki Söz</Text>
      </View>
      <TextField
        testID="admin-quote-text"
        label="Söz"
        value={text}
        onChangeText={setText}
        placeholder="Öğrencilere göstermek istediğiniz söz"
        multiline
        maxLength={300}
      />
      <TextField
        testID="admin-quote-author"
        label="Söyleyen"
        value={author}
        onChangeText={setAuthor}
        placeholder="Örn: Rüstem AYAR"
        maxLength={80}
      />
      <AppButton testID="admin-quote-save" label="Kaydet" onPress={save} loading={saving} />
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
}));
