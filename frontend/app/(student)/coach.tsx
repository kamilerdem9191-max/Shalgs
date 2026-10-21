import { useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatCircleText } from "phosphor-react-native";
import { useCallback } from "react";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiGet, apiPost } from "@/src/api/client";
import { Card, EmptyState, LoadingView } from "@/src/components/ui";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { formatDateTime } from "@/src/utils/date";

type Comment = {
  id: string;
  coach_name: string;
  text: string;
  read: boolean;
  created_at: string;
};

export default function StudentCoach() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["comments"],
    queryFn: () => apiGet("/comments"),
  });
  const comments: Comment[] = data?.comments ?? [];

  useFocusEffect(
    useCallback(() => {
      apiPost("/comments/read-all")
        .then(() => qc.invalidateQueries({ queryKey: ["unread-count"] }))
        .catch(() => {});
    }, [qc]),
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Koçum</Text>
      </View>
      {isLoading ? (
        <LoadingView />
      ) : comments.length === 0 ? (
        <EmptyState
          icon={<ChatCircleText size={48} color={colors.muted} />}
          title="Koçundan henüz mesaj yok"
          subtitle="Koçun çalışmalarını inceleyip yorum yazdığında burada göreceksin."
        />
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card
              testID={`comment-${item.id}`}
              style={[styles.commentCard, !item.read && styles.unreadCard]}
            >
              <View style={styles.commentHead}>
                <Text style={styles.coachName}>{item.coach_name ?? "Koç"}</Text>
                {!item.read ? (
                  <View style={styles.unreadDot} testID={`unread-${item.id}`} />
                ) : null}
              </View>
              <Text style={styles.commentText}>{item.text}</Text>
              <Text style={styles.commentDate}>{formatDateTime(item.created_at)}</Text>
            </Card>
          )}
        />
      )}
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
  commentCard: { gap: spacing.sm },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: colors.brandPrimary },
  commentHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  coachName: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  commentText: { color: colors.onSurfaceSecondary, fontSize: 16, lineHeight: 23 },
  commentDate: { color: colors.muted, fontSize: 12 },
}));
