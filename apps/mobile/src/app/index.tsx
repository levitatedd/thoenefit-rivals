import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MetricCard } from '@/components/metric-card';
import { SimulatedDataBanner } from '@/components/simulated-data-banner';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { fromDateKey, useRecentActivity, type DailyActivitySummary } from '@/features/activity';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, formatShortDate } from '@/utils/format';

const HISTORY_DAYS = 7;

export default function TodayScreen() {
  const theme = useTheme();
  const { state, reload } = useRecentActivity(HISTORY_DAYS);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        <SimulatedDataBanner />

        {state.status === 'loading' && (
          <ActivityIndicator accessibilityLabel="Loading activity" style={styles.loading} />
        )}

        {state.status === 'error' && (
          <View style={styles.section}>
            <ThemedText>Couldn&apos;t load activity: {state.error.message}</ThemedText>
            <Pressable accessibilityRole="button" onPress={reload}>
              <ThemedText themeColor="accent">Try again</ThemedText>
            </Pressable>
          </View>
        )}

        {state.status === 'ready' && <ActivityOverview days={state.days} />}

        <Link href="/about" style={styles.aboutLink}>
          <ThemedText type="small" themeColor="accent">
            About this preview
          </ThemedText>
        </Link>
      </View>
    </ScrollView>
  );
}

function ActivityOverview({ days }: { days: DailyActivitySummary[] }) {
  const theme = useTheme();
  const today = days.at(-1);
  const history = days.slice(0, -1).reverse();

  if (!today) {
    return <ThemedText>No activity recorded yet.</ThemedText>;
  }

  return (
    <>
      <View style={styles.section}>
        <ThemedText type="title">Today</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatShortDate(fromDateKey(today.date))} · so far
        </ThemedText>
        <View style={styles.cards}>
          <MetricCard label="Steps" value={today.steps} unit="steps" color="steps" />
          <MetricCard
            label="Active energy"
            value={today.activeEnergyKcal}
            unit="kcal"
            color="energy"
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="subtitle">Previous days</ThemedText>
        <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
          {history.map((day, index) => (
            <View
              key={day.date}
              testID={`history-row-${day.date}`}
              style={[
                styles.row,
                index > 0 && {
                  borderTopColor: theme.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <ThemedText style={styles.rowDate}>
                {formatShortDate(fromDateKey(day.date))}
              </ThemedText>
              <ThemedText type="small" themeColor="steps" style={styles.rowValue}>
                {formatNumber(day.steps)} steps
              </ThemedText>
              <ThemedText type="small" themeColor="energy" style={styles.rowValue}>
                {formatNumber(day.activeEnergyKcal)} kcal
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    </>
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
    gap: Spacing.four,
  },
  loading: {
    marginVertical: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  cards: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  list: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  rowDate: {
    flex: 1,
  },
  rowValue: {
    minWidth: 90,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  aboutLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
});
