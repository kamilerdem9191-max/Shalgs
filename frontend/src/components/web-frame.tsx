import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { useTheme } from "@/src/theme";

/**
 * On web (desktop), constrain the whole app to a centered phone-width column
 * so it looks like a clean mobile app instead of a stretched full-width page.
 * On native it is a transparent pass-through.
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <View style={[styles.outer, { backgroundColor: colors.surfaceTertiary }]}>
      <View
        style={[
          styles.frame,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    // @ts-expect-error web-only shadow for the centered column
    boxShadow: "0 0 24px rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
});
