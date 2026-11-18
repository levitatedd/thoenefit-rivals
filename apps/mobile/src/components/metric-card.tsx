import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber } from '@/utils/format';

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  color: ThemeColor;
}

export function MetricCard({ label, value, unit, color }: MetricCardProps) {
  const theme = useTheme();
  const formatted = formatNumber(value);
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${formatted} ${unit}`}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" themeColor={color}>
        {label}
      </ThemedText>
      <ThemedText type="metric">{formatted}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {unit}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
