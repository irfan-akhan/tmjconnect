import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

type Props = {
  onPress?: () => void;
  title: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export function Button({ onPress, title, variant = 'primary', loading, disabled, style, testID }: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].base,
        pressed && !isDisabled && variantStyles[variant].pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].textColor} />
      ) : (
        <Text style={[styles.text, { color: variantStyles[variant].textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
  } as ViewStyle,
  text: { ...typography.bodyStrong },
  disabled: { opacity: 0.5 },
});

const variantStyles = {
  // Default CTA — navy is the dominant brand color.
  primary: {
    base: { backgroundColor: colors.navy.standard } as ViewStyle,
    pressed: { backgroundColor: colors.navy.dark } as ViewStyle,
    textColor: '#FFFFFF',
  },
  // Gold accent — reserved for the one most-important CTA on a screen.
  accent: {
    base: { backgroundColor: colors.gold.standard } as ViewStyle,
    pressed: { backgroundColor: colors.gold.hover } as ViewStyle,
    textColor: colors.navy.deep,
  },
  secondary: {
    base: {
      backgroundColor: colors.surface.background,
      borderWidth: 1,
      borderColor: colors.surface.border,
    } as ViewStyle,
    pressed: { backgroundColor: colors.surface.muted } as ViewStyle,
    textColor: colors.ink.primary,
  },
  ghost: {
    base: { backgroundColor: 'transparent' } as ViewStyle,
    pressed: { backgroundColor: colors.navy.ghost } as ViewStyle,
    textColor: colors.navy.standard,
  },
  danger: {
    base: { backgroundColor: colors.danger.base } as ViewStyle,
    pressed: { backgroundColor: colors.danger.strong } as ViewStyle,
    textColor: '#FFFFFF',
  },
} as const;
