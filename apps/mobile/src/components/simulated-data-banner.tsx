import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Always shown while the app uses simulated data so it is never mistaken for real health data. */
export function SimulatedDataBanner() {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: theme.warningBackground }]}>
      <ThemedText type="smallBold" themeColor="warningText">
        Simulated data
      </ThemedText>
      <ThemedText type="small" themeColor="warningText">
        These numbers are generated for testing. No health data is read from your phone or watch.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
