import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Card,
  Chevron,
  DayBars,
  DemoSettingsBadge,
  HeaderLink,
  Pill,
  listStyles,
} from '@/components/demo-ui';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  YOU,
  dateRangeLabel,
  orderedStandings,
  placeLabel,
  progressLabel,
  useDemo,
  type DemoCompetition,
} from '@/features/demo';
import { toPublicStandings, type PublicStanding } from '@/features/scoring';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, formatPoints, ordinal } from '@/utils/format';

function ScoringButton() {
  return <HeaderLink href="/scoring" label="How it works" accessibilityLabel="How scoring works" />;
}

export default function CompetitionScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { world } = useDemo();
  const competition = world.competitions.find((c) => c.id === id);

  if (!competition) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Competition' }} />
        <ThemedText>This demo competition doesn&apos;t exist.</ThemedText>
      </View>
    );
  }

  // The leaderboard only uses what other players may see (goals and points, no private data).
  const publicById = new Map(
    toPublicStandings(competition.result).map((s) => [s.participantId, s]),
  );
  const rows = orderedStandings(competition).map((s) => publicById.get(s.participantId)!);
  const ties = findTies(rows);
  // Whole points are easier to read; show hundredths when different scores round the same.
  const precise = rows.some((a) =>
    rows.some(
      (b) =>
        a !== b &&
        a.totalPoints !== b.totalPoints &&
        Math.round(a.totalPoints) === Math.round(b.totalPoints),
    ),
  );
  const final = competition.result.phase === 'final';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: competition.name, headerRight: ScoringButton }} />
      <View style={styles.column}>
        <View style={styles.titleRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {dateRangeLabel(competition)} · {competition.competition.timeZone.replace(/_/g, ' ')} ·
            simulated
          </ThemedText>
          <Pill label={progressLabel(competition)} color={final ? 'textSecondary' : 'steps'} />
        </View>
        {world.usesDemoSettings && <DemoSettingsBadge />}

        <Card style={styles.list}>
          {rows.map((row, index) => (
            <LeaderboardRow
              key={row.participantId}
              competition={competition}
              row={row}
              first={index === 0}
              today={world.today}
              precise={precise}
            />
          ))}
        </Card>

        <Legend cap={competition.result.rules.dailyCapPoints} />

        {ties.map((group) => (
          <Card key={group.rank} style={[styles.note, { backgroundColor: theme.accentSurface }]}>
            <ThemedText type="small">
              {group.names.join(' and ')} share {ordinal(group.rank)} place: exactly{' '}
              {formatPoints(group.points, true)} points each. Equal points (to the hundredth) share
              a place and are never broken by a tiebreaker.
            </ThemedText>
          </Card>
        ))}

        <ThemedText type="small" themeColor="textSecondary">
          Points are relative to each person&apos;s own daily goal, so different fitness levels
          compete fairly. Tap a player for their day-by-day.{' '}
          {final
            ? 'These results are final.'
            : 'Scores are provisional until 24 hours after the last day, so late syncs can still count.'}
        </ThemedText>
      </View>
    </ScrollView>
  );
}

function LeaderboardRow({
  competition,
  row,
  first,
  today,
  precise,
}: {
  competition: DemoCompetition;
  row: PublicStanding;
  first: boolean;
  today: string;
  precise: boolean;
}) {
  const theme = useTheme();
  const isYou = row.participantId === YOU;
  const standing = competition.result.standings.find((s) => s.participantId === row.participantId)!;
  const waiting = row.days.filter((d) => d.status === 'pending' && d.date !== today).length;
  const detail = [
    `Goal ${formatNumber(row.dailyGoal)}`,
    waiting > 0 ? `${waiting} day${waiting > 1 ? 's' : ''} waiting for sync` : null,
    row.provisional ? 'provisional' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/competition/[id]/[participantId]',
          params: { id: competition.id, participantId: row.participantId },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`${placeLabel(competition, standing)}: ${row.displayName}, ${formatPoints(row.totalPoints, true)} points. ${detail}`}
      style={[
        styles.row,
        !first && [listStyles.separator, { borderTopColor: theme.border }],
        isYou && { backgroundColor: theme.accentSurface },
      ]}>
      <ThemedText type="subtitle" themeColor={isYou ? 'accentText' : 'text'} style={styles.rank}>
        {row.rank ?? '–'}
      </ThemedText>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{row.displayName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.detail}>
          {detail}
        </ThemedText>
      </View>
      <DayBars days={row.days} cap={competition.result.rules.dailyCapPoints} today={today} />
      <ThemedText type="subtitle" style={styles.points}>
        {formatPoints(row.totalPoints, precise)}
      </ThemedText>
      <Chevron />
    </Pressable>
  );
}

function Legend({ cap }: { cap: number }) {
  const theme = useTheme();
  return (
    <View style={styles.legend}>
      <LegendItem label="Day’s points">
        <View style={[styles.swatch, { backgroundColor: theme.steps }]} />
      </LegendItem>
      <LegendItem label={`Hit ${formatNumber(cap)}-point cap`}>
        <View
          style={[
            styles.swatch,
            { backgroundColor: theme.accent, borderTopWidth: 3, borderTopColor: theme.warningText },
          ]}
        />
      </LegendItem>
      <LegendItem label="Waiting for sync">
        <View style={[styles.swatch, styles.dashed, { borderColor: theme.textSecondary }]} />
      </LegendItem>
    </View>
  );
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.legendItem}>
      {children}
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function findTies(rows: PublicStanding[]) {
  const byRank = new Map<number, PublicStanding[]>();
  for (const row of rows) {
    if (row.rank === null) continue;
    byRank.set(row.rank, [...(byRank.get(row.rank) ?? []), row]);
  }
  return [...byRank.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([rank, group]) => ({
      rank,
      points: group[0].totalPoints,
      names: group.map((g) => g.displayName),
    }));
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.three, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  missing: { flex: 1, padding: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  list: { paddingVertical: 0, paddingHorizontal: 0, gap: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
  rank: { width: 28, textAlign: 'center' },
  detail: { fontSize: 12, lineHeight: 16 },
  points: { minWidth: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 8, height: 14, borderRadius: 2 },
  dashed: { borderWidth: 1, borderStyle: 'dashed' },
  note: { padding: 12 },
});
