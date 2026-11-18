import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Card,
  Chevron,
  DemoSettingsBadge,
  Pill,
  ProgressBar,
  listStyles,
} from '@/components/demo-ui';
import { SimulatedDataBanner } from '@/components/simulated-data-banner';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing, type ThemeColor } from '@/constants/theme';
import { fromDateKey } from '@/features/activity';
import {
  YOU,
  placeLabel,
  progressLabel,
  standingFor,
  useDemo,
  type DemoCompetition,
} from '@/features/demo';
import type { CategoryId } from '@/features/scoring';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, formatPoints, formatShortDate } from '@/utils/format';

export default function TodayScreen() {
  const theme = useTheme();
  const { world, state } = useDemo();
  const [today, ...previous] = world.yourDays;

  const pointsToday = (categoryId: CategoryId) => {
    const competition = world.competitions.find(
      (c) => c.categoryId === categoryId && c.currentDay !== null,
    );
    if (!competition) return null;
    const day = standingFor(competition, YOU).days.find((d) => d.date === world.today);
    return day ? { points: day.points, name: competition.name } : null;
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        <ThemedText themeColor="textSecondary">
          {formatShortDate(fromDateKey(world.today))} · so far
        </ThemedText>
        <SimulatedDataBanner />
        {world.usesDemoSettings && <DemoSettingsBadge />}

        <View style={styles.cards}>
          <GoalCard
            label="Steps"
            unit="steps"
            value={today.steps}
            goal={state.settings.goals['step-battle'][YOU]}
            color="steps"
            today={pointsToday('step-battle')}
          />
          <GoalCard
            label="Active energy"
            unit="kcal"
            value={today.activeEnergyKcal}
            goal={state.settings.goals['calorie-clash'][YOU]}
            color="energy"
            today={pointsToday('calorie-clash')}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle">Your competitions</ThemedText>
          <Card style={styles.list}>
            {world.competitions.map((competition, index) => (
              <CompetitionRow key={competition.id} competition={competition} first={index === 0} />
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle">Previous days</ThemedText>
          <Card style={styles.list}>
            {previous.map((day, index) => (
              <View
                key={day.date}
                testID={`history-row-${day.date}`}
                style={[
                  styles.row,
                  index > 0 && [listStyles.separator, { borderTopColor: theme.border }],
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
          </Card>
        </View>

        <Link href="/about" style={styles.aboutLink}>
          <ThemedText type="small" themeColor="accentText">
            About this preview
          </ThemedText>
        </Link>
      </View>
    </ScrollView>
  );
}

function GoalCard({
  label,
  unit,
  value,
  goal,
  color,
  today,
}: {
  label: string;
  unit: string;
  value: number;
  goal: number;
  color: ThemeColor;
  today: { points: number; name: string } | null;
}) {
  const fraction = value / goal;
  return (
    <Card style={styles.goalCard}>
      <View
        accessible
        accessibilityLabel={`${label}: ${formatNumber(value)} of ${formatNumber(goal)} ${unit} goal`}>
        <ThemedText type="smallBold" themeColor={color}>
          {label}
        </ThemedText>
        <ThemedText type="metric">{formatNumber(value)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          of {formatNumber(goal)} {unit} goal
        </ThemedText>
      </View>
      <ProgressBar fraction={fraction} color={color} />
      {today ? (
        <ThemedText type="smallBold" themeColor="accentText">
          {formatPoints(today.points)} pts today
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(fraction * 100)}% of goal
        </ThemedText>
      )}
    </Card>
  );
}

function CompetitionRow({ competition, first }: { competition: DemoCompetition; first: boolean }) {
  const theme = useTheme();
  const you = standingFor(competition, YOU);
  const live = competition.result.phase !== 'final';
  const summary = `${placeLabel(competition, you)} of ${competition.result.standings.length} · ${formatPoints(you.totalPoints)} pts`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/competition/[id]', params: { id: competition.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${competition.name}: ${summary}. ${progressLabel(competition)}`}
      style={[styles.compRow, !first && [listStyles.separator, { borderTopColor: theme.border }]]}>
      <View style={styles.compText}>
        <ThemedText type="smallBold">{competition.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {summary}
        </ThemedText>
      </View>
      <Pill label={progressLabel(competition)} color={live ? 'steps' : 'textSecondary'} />
      <Chevron />
    </Pressable>
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
  section: {
    gap: Spacing.two,
  },
  cards: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  goalCard: {
    flex: 1,
  },
  list: {
    paddingVertical: 0,
    gap: 0,
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
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
    minHeight: 44,
  },
  compText: {
    flex: 1,
  },
  aboutLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
});
