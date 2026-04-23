import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Base = {
  icon?: keyof typeof Ionicons.glyphMap;
  iconTint?: string;
  title: string;
  subtitle?: string;
  destructive?: boolean;
  trailing?: React.ReactNode;
};

type NavProps = Base & { onPress: () => void; toggle?: never };
type ToggleProps = Base & {
  toggle: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean };
  onPress?: never;
};

export function SettingsRow(props: NavProps | ToggleProps) {
  const tint = props.destructive
    ? colors.danger.strong
    : props.iconTint ?? colors.navy.standard;
  const iconBg = props.destructive ? colors.danger.soft : colors.navy.ghost;

  const content = (
    <>
      {props.icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={props.icon} size={18} color={tint} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={[styles.title, props.destructive && { color: colors.danger.strong }]}>
          {props.title}
        </Text>
        {props.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{props.subtitle}</Text> : null}
      </View>
      {'toggle' in props && props.toggle ? (
        <Switch
          value={props.toggle.value}
          onValueChange={props.toggle.onChange}
          disabled={props.toggle.disabled}
          trackColor={{ false: colors.surface.border, true: colors.navy.standard }}
          thumbColor="#fff"
        />
      ) : (
        <>
          {props.trailing}
          <Ionicons name="chevron-forward" size={18} color={colors.ink.tertiary} />
        </>
      )}
    </>
  );

  if ('toggle' in props && props.toggle) {
    return (
      <View style={styles.row} accessibilityRole="switch" accessibilityLabel={props.title} accessibilityState={{ checked: props.toggle.value }}>
        {content}
      </View>
    );
  }

  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={props.title}>
      {content}
    </Pressable>
  );
}

export function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.caption,
    color: colors.ink.tertiary,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  pressed: { backgroundColor: colors.surface.muted },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { ...typography.bodyStrong, color: colors.ink.primary },
  subtitle: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
});
