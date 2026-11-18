import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, DemoSettingsBadge, SectionTitle, listStyles } from '@/components/demo-ui';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { fromDateKey } from '@/features/activity';
import { YOU, dayStatusLabel, placeLabel, useDemo } from '@/features/demo';
import { toPublicStandings, type EligibilityDecision, type Standing } from '@/features/scoring';
import { useTheme } from '@/hooks/use-theme';
import { formatDayOfMonth, formatNumber, formatPoints, formatShortDate } from '@/utils/format';

export default function PlayerScreen() {
  const theme = useTheme();
  const { id, participantId } = useLocalSearchParams<{ id: string; participantId: string }>();
  const { world } = useDemo();
  const competition = world.competitions.find((c) => c.id === id);
  const standing = competition?.result.standings.find((s) => s.participantId === participantId);

  if (!competition || !standing) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Player' }} />
        <ThemedText>This player isn&apos;t in the demo competition.</ThemedText>
      </View>
    );
  }

  const isYou = standing.participantId === YOU;
  // Other players only ever see the public view: goals and points, never activity or advice.
  const publicView = toPublicStandings(competition.result).find(
    (s) => s.participantId === participantId,
  )!;
  const unit = competition.unit;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: `${standing.displayName} · ${competition.name}` }} />
      <View style={styles.column}>
        <View style={styles.summary}>
          <View style={styles.flex}>
            <ThemedText type="title">{standing.displayName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {placeLabel(competition, standing)} · goal {formatNumber(publicView.dailyGoal)} {unit}{' '}
              a day
            </ThemedText>
          </View>
          <View style={styles.total}>
            <ThemedText type="title">{formatPoints(publicView.totalPoints)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {publicView.provisional ? 'points so far' : 'final points'}
            </ThemedText>
          </View>
        </View>
        {world.usesDemoSettings && <DemoSettingsBadge />}

        <Card style={styles.list}>
          <View style={styles.dayRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.day}>
              Day
            </ThemedText>
            {isYou && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.activity}>
                {unit === 'steps' ? 'Steps' : 'Active kcal'}
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary" style={styles.status}>
              Status
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.points}>
              Points
            </ThemedText>
          </View>
          {publicView.days.map((day, index) => {
            const full = standing.days[index];
            return (
              <View
                key={day.date}
                testID={`day-row-${day.date}`}
                style={[styles.dayRow, [listStyles.separator, { borderTopColor: theme.border }]]}>
                <ThemedText type="smallBold" style={styles.day}>
                  {formatDayOfMonth(fromDateKey(day.date))}
                </ThemedText>
                {isYou && (
                  <ThemedText type="small" themeColor="steps" style={styles.activity}>
                    {day.status === 'future' ? '–' : formatNumber(full.eligibleActivity)}
                  </ThemedText>
                )}
                <ThemedText
                  type="small"
                  themeColor={day.status === 'pending' ? 'warningText' : 'textSecondary'}
                  style={styles.status}>
                  {dayStatusLabel(day.status, day.date === world.today)}
                  {day.capped ? ' · capped' : ''}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.points}>
                  {day.status === 'future' ? '–' : formatPoints(day.points)}
                </ThemedText>
              </View>
            );
          })}
        </Card>

        {isYou ? (
          <PrivateDetails standing={standing} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            You see {standing.displayName}&apos;s goal and daily points only. Their activity
            history, held records and goal advice are private to them.
          </ThemedText>
        )}
      </View>
    </ScrollView>
  );
}

function PrivateDetails({ standing }: { standing: Standing }) {
  const theme = useTheme();
  return (
    <View style={[styles.private, { borderColor: theme.accentText }]}>
      <SectionTitle>Only you can see this</SectionTitle>
      {standing.fairnessAtStart && (
        <ThemedText type="small">
          <ThemedText type="smallBold">Goal check: </ThemedText>
          {standing.fairnessAtStart.message}
        </ThemedText>
      )}
      {standing.goalSuggestion && (
        <ThemedText type="small">
          <ThemedText type="smallBold">For next time: </ThemedText>
          {standing.goalSuggestion.message}
        </ThemedText>
      )}
      {standing.decisions.map((d) => (
        <DecisionLine key={d.recordId} decision={d} />
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        Other players see your goal, daily points and total, never your activity details, held
        records or goal advice.
      </ThemedText>
    </View>
  );
}

function DecisionLine({ decision }: { decision: EligibilityDecision }) {
  const when = decision.day ? formatShortDate(fromDateKey(decision.day)) : 'Unknown day';
  const what = decision.status === 'held' ? 'On hold' : 'Not counted';
  return (
    <ThemedText type="small">
      <ThemedText type="smallBold">
        {what} ({when}):{' '}
      </ThemedText>
      {decision.explanation}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.three, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  missing: { flex: 1, padding: Spacing.three },
  summary: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  flex: { flex: 1 },
  total: { alignItems: 'flex-end' },
  list: { paddingVertical: 0, gap: 0 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 12 },
  day: { width: 56 },
  activity: { width: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
  status: { flex: 1, paddingLeft: Spacing.two },
  points: { width: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
  private: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
