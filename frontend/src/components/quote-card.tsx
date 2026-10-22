import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getQuote } from "@/src/api/client";
import { makeStyles, radius, spacing } from "@/src/theme";

type Quote = { text: string; author: string };

/** Today's quote chosen by the principal. Renders nothing when there is none. */
export function QuoteCard() {
  const styles = useStyles();
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    getQuote()
      .then((d) => setQuote(d.quote))
      .catch(() => setQuote(null));
  }, []);

  if (!quote) return null;

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
