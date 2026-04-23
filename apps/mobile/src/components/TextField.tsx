import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  containerStyle?: ViewStyle;
  rightAction?: { label: string; onPress: () => void };
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, containerStyle, rightAction, style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.group, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          error && styles.inputWrapError,
        ]}
      >
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.ink.tertiary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {rightAction ? (
          <Pressable onPress={rightAction.onPress} hitSlop={8} style={styles.rightAction}>
            <Text style={styles.rightActionText}>{rightAction.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  group: { marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.ink.primary, marginBottom: spacing.xs },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputWrapFocused: { borderColor: colors.navy.standard },
  inputWrapError: { borderColor: colors.danger.base },
  input: { flex: 1, ...typography.body, color: colors.ink.primary, paddingVertical: spacing.md },
  rightAction: { paddingHorizontal: spacing.sm },
  rightActionText: { ...typography.label, color: colors.navy.standard },
  errorText: { ...typography.caption, color: colors.danger.strong, marginTop: spacing.xs },
  hintText: { ...typography.caption, color: colors.ink.secondary, marginTop: spacing.xs },
});
