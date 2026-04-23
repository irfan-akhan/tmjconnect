import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_CONFIG: Record<string, { label: string; icon: IconName; iconActive: IconName; accent?: boolean }> = {
  dashboard: { label: 'Home', icon: 'home-outline', iconActive: 'home' },
  exercises: { label: 'Exercises', icon: 'fitness-outline', iconActive: 'fitness' },
  symptoms: { label: 'Log', icon: 'add-circle-outline', iconActive: 'add-circle', accent: true },
  reports: { label: 'Reports', icon: 'document-text-outline', iconActive: 'document-text' },
  profile: { label: 'Profile', icon: 'person-outline', iconActive: 'person' },
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.barOuter, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const cfg = TAB_CONFIG[route.name];
          if (!cfg) return null;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const isAccent = !!cfg.accent;

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={cfg.label}
              style={[styles.tab, focused && !isAccent && styles.tabActive]}
            >
              <View style={[
                styles.iconWrap,
                isAccent && styles.iconWrapAccent,
                focused && !isAccent && styles.iconWrapActive,
                focused && isAccent && styles.iconWrapAccentActive,
              ]}>
                <Ionicons
                  name={focused ? cfg.iconActive : cfg.icon}
                  size={isAccent ? 24 : 21}
                  color={isAccent ? '#fff' : focused ? '#fff' : colors.ink.tertiary}
                />
              </View>
              <Text style={[
                styles.label,
                focused && !isAccent && styles.labelActive,
                isAccent && styles.labelAccent,
              ]}>
                {cfg.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.surface.background },
      }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="exercises" />
      <Tabs.Screen name="symptoms" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barOuter: {
    backgroundColor: colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    shadowColor: colors.ink.primary,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  bar: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 3,
    borderRadius: radius.lg,
  },
  tabActive: {
    backgroundColor: colors.navy.ghost,
  },
  iconWrap: {
    width: 42,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.navy.standard,
    shadowColor: colors.navy.dark,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  iconWrapAccent: {
    backgroundColor: colors.gold.standard,
    width: 46,
    height: 38,
    borderRadius: 14,
    marginTop: -8,
    shadowColor: colors.gold.standard,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconWrapAccentActive: {
    backgroundColor: colors.gold.hover,
    shadowOpacity: 0.5,
  },
  label: {
    ...typography.tiny,
    color: colors.ink.tertiary,
  },
  labelActive: {
    color: colors.navy.deep,
    fontWeight: '700',
  },
  labelAccent: {
    color: colors.gold.standard,
    fontWeight: '700',
  },
});
