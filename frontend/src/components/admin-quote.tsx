import { Quotes, Trash } from "phosphor-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { adminAddQuote, adminDeleteQuote, adminListQuotes } from "@/src/api/client";
import { AppButton, Card, ConfirmDialog, TextField } from "@/src/components/ui";
import { useToast } from "@/src/context/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Quote = { id: string; text: string; author: string };

export function AdminQuote() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [todayId, setTodayId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState<Quote | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await adminListQuotes();
      setQuotes(d.quotes || []);
      setTodayId(d.today_id);
    } catch {
      toast("Sözler yüklenemedi", "error");
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!text.trim()) {
      toast("Söz boş olamaz", "error");
      return;
    }
    setSaving(true);
    try {
      await adminAddQuote(text, author);
      setText("");
      setAuthor("");
      toast("Söz eklendi", "success");
      await load();
    } catch (e: any) {
      toast(e?.message || "Kaydedilemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await adminDeleteQuote(target.id);
      toast("Söz silindi", "success");
      await load();
    } catch (e: any) {
      toast(e?.message || "Silinemedi", "error");
    } finally {
      setDeleting(false);
      setTarget(null);
    }
  };

  return (
    <Card testID="admin-quote-card" style={styles.card}>
      <View style={styles.titleRow}>
        <Quotes size={20} color={colors.brandPrimary} weight="fill" />
        <Text style={styles.title}>Ana Ekran Sözleri</Text>
      </View>
      <Text style={styles.hint}>
        Her gün listeden sırayla farklı bir söz gösterilir. Liste boşsa ana ekranda söz alanı görünmez.
      </Text>

      {quotes.length === 0 ? (
        <Text testID="admin-quotes-empty" style={styles.empty}>Henüz söz yok</Text>
      ) : (
        quotes.map((q) => (
          <View key={q.id} testID={`admin-quote-${q.id}`} style={styles.item}>
            <View style={{ flex: 1, gap: 2 }}>
              {q.id === todayId ? <Text style={styles.badge}>Bugün gösterilen</Text> : null}
              <Text style={styles.itemText}>“{q.text}”</Text>
              {q.author ? <Text style={styles.itemAuthor}>— {q.author}</Text> : null}
            </View>
            <Pressable
              testID={`admin-quote-delete-${q.id}`}
              onPress={() => setTarget(q)}
              style={styles.deleteBtn}
              hitSlop={6}
              accessibilityLabel="Sözü sil"
            >
              <Trash size={20} color={colors.error} />
            </Pressable>
          </View>
        ))
      )}

      <TextField
        testID="admin-quote-text"
        label="Yeni söz"
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
      <AppButton testID="admin-quote-save" label="Söz Ekle" onPress={add} loading={saving} />

      <ConfirmDialog
        visible={!!target}
        title="Söz silinsin mi?"
        message={target ? `“${target.text}”` : undefined}
        confirmLabel="Sil"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setTarget(null)}
      />
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  empty: { color: colors.muted, fontSize: 14, textAlign: "center", paddingVertical: spacing.sm },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  badge: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  itemText: { color: colors.onSurface, fontSize: 14, fontStyle: "italic", lineHeight: 20 },
  itemAuthor: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  deleteBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
}));
