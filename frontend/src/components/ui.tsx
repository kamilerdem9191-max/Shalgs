import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { Eye, EyeSlash } from "phosphor-react-native";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

export function AppButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === "primary"
      ? colors.brandPrimary
      : variant === "secondary"
        ? colors.brandTertiary
        : "transparent";
  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "secondary"
        ? colors.onBrandTertiary
        : colors.brandPrimary;
  const borderColor = variant === "outline" ? colors.borderStrong : "transparent";

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor, borderWidth: variant === "outline" ? 1.5 : 0 },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// TextField
// ---------------------------------------------------------------------------
export function TextField({
  label,
  error,
  style,
  secureToggle,
  toggleTestID,
  secureTextEntry,
  ...props
}: TextInputProps & {
  label?: string;
  error?: string;
  style?: StyleProp<ViewStyle>;
  secureToggle?: boolean;
  toggleTestID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const isSecure = secureToggle ? !visible : secureTextEntry;
  return (
    <View style={[styles.fieldWrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={colors.muted}
          secureTextEntry={isSecure}
          style={[
            styles.input,
            { flex: 1 },
            secureToggle ? { paddingRight: 48 } : null,
            error ? { borderColor: colors.error } : null,
          ]}
          {...props}
        />
        {secureToggle ? (
          <Pressable
            testID={toggleTestID ?? "password-visibility-toggle"}
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            style={styles.eyeBtn}
          >
            {visible ? (
              <EyeSlash size={22} color={colors.muted} />
            ) : (
              <Eye size={22} color={colors.muted} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------
export function ProgressBar({
  progress,
  color,
  height = 10,
}: {
  progress: number;
  color?: string;
  height?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }]}>
      <View
        style={{
          width: `${pct * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? colors.brandPrimary,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// LoadingView
// ---------------------------------------------------------------------------
export function LoadingView() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
export function EmptyState({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog — cross-platform (works on web too, unlike RN Alert)
// ---------------------------------------------------------------------------
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.dialogOverlay} onPress={onCancel}>
        <Pressable style={styles.dialogCard} onPress={() => {}}>
          <Text style={styles.dialogTitle}>{title}</Text>
          {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
          <View style={styles.dialogActions}>
            <Pressable
              testID="confirm-dialog-cancel"
              onPress={onCancel}
              style={[styles.dialogBtn, { backgroundColor: colors.surfaceTertiary }]}
            >
              <Text style={[styles.dialogBtnText, { color: colors.onSurfaceTertiary }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              testID="confirm-dialog-confirm"
              onPress={onConfirm}
              disabled={loading}
              style={[styles.dialogBtn, { backgroundColor: destructive ? colors.error : colors.brandPrimary }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.onError} />
              ) : (
                <Text style={[styles.dialogBtnText, { color: colors.onError }]}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  button: {
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: "700" },

  fieldWrap: { gap: 6 },
  inputRow: { position: "relative", justifyContent: "center" },
  eyeBtn: { position: "absolute", right: 12, height: 52, width: 32, alignItems: "center", justifyContent: "center" },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.onSurface,
    minHeight: 52,
  },
  errorText: { color: colors.error, fontSize: 12, fontWeight: "500" },

  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  progressTrack: {
    width: "100%",
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing["2xl"], paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "700", textAlign: "center", marginTop: spacing.sm },
  emptySub: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },

  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  dialogTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  dialogMessage: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  dialogActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  dialogBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogBtnText: { fontSize: 15, fontWeight: "700" },
}));
