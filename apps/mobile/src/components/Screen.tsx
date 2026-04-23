import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  keyboardAvoiding?: boolean;
};

export function Screen({ children, scroll = false, padded = true, style, keyboardAvoiding = true }: Props) {
  const inner = (
    <View style={[styles.inner, padded && styles.padded, style]}>{children}</View>
  );
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, padded && styles.padded, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    inner
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  flex: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
});
