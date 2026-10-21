import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getQuote } from "@/src/api/client";
import { makeStyles, radius, spacing } from "@/src/theme";

export const DEFAULT_QUOTE = {
  text: "Hayatımızın bir döneminde fedakarlık yapmazsak, hayat boyu fedakarlık yapmak zorunda kalabiliriz.",
  author: "Rüstem AYAR",
};

export function QuoteCard() {
  const styles = useStyles();
  const [quote, setQuote] = useState(DEFAULT_QUOTE);

  useEffect(() => {
    getQuote().then(setQuote).catch(() => {});
  }, []);

  return (
    <View style={styles.box} testID="student-quote">
      <Text style={styles.text}>“{quote.text}”</Text>
      {quote.author ? <Text style={styles.author}>— {quote.author}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  box: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandPrimary,
    gap: 6,
  },
  text: { color: colors.onSurface, fontSize: 15, fontStyle: "italic", lineHeight: 22 },
  author: { color: colors.muted, fontSize: 13, fontWeight: "700", textAlign: "right" },
}));
