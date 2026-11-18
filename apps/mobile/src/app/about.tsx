import Constants from 'expo-constants';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useActivitySource } from '@/features/activity';
import { useTheme } from '@/hooks/use-theme';

export default function AboutScreen() {
  const theme = useTheme();
  const source = useActivitySource();
  const version = Constants.expoConfig?.version ?? 'unknown';
  const build = Constants.expoConfig?.extra?.buildNumber ?? '?';
  const variant = Constants.expoConfig?.extra?.variant ?? 'development';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}>
      <View style={styles.column}>
        <ThemedText type="subtitle">ThoeneFit Rivals</ThemedText>
        <ThemedText themeColor="textSecondary">
          Challenge your friends, whatever watch they wear.
        </ThemedText>

        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <Row label="Version" value={`${version} (build ${build})`} />
          <Row label="Channel" value={String(variant)} />
          <Row label="Data source" value={source.info.label} />
          <Row label="Stage" value="Pre-alpha preview" />
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          This preview does not request health permissions and does not read from Apple Health,
          Health Connect, or any wearable. Competitions, scoring, and leaderboards are not built
          yet.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.three,
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
