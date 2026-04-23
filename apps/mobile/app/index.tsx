import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../src/theme/tokens';

export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.navy.standard} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.background },
});
