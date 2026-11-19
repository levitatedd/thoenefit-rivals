import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, DemoSettingsBadge, Pill, SectionTitle } from '@/components/demo-ui';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  GOAL_MODE_LABELS,
  YOU,
  dateRangeLabel,
  orderedStandings,
  placeLabel,
  progressLabel,
  standingFor,
  tiedWith,
  useDemo,
  type DemoCompetition,
} from '@/features/demo';
import { useTheme } from '@/hooks/use-theme';
import { formatPoints } from '@/utils/format';

export default function CompetitionsScreen() {
  const theme = useTheme();
  const { world } = useDemo();
  const active = world.competitions.filter((c) => c.result.phase !== 'final');
  const finished = world.competitions.filter((c) => c.result.phase === 'final');

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        <View style={[styles.banner, { backgroundColor: theme.warningBackground }]}>
          <ThemedText type="small" themeColor="warningText">
            Demo competitions with simulated friends. No real people or health data.
          </ThemedText>
        </View>
        {world.usesDemoSettings && <DemoSettingsBadge />}

        {active.length > 0 && <SectionTitle>Active</SectionTitle>}
        {active.map((c) => (
          <CompetitionCard key={c.id} competition={c} />
        ))}
        {finished.length > 0 && <SectionTitle>Finished</SectionTitle>}
        {finished.map((c) => (
          <CompetitionCard key={c.id} competition={c} />
        ))}

        <ThemedText type="small" themeColor="textSecondary">
          Step Battle and Calorie Clash are always separate competitions: steps and calories are
          never added together.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

function CompetitionCard({ competition }: { competition: DemoCompetition }) {
  const you = standingFor(competition, YOU);
  const leader = orderedStandings(competition)[0];
  const youLead = you.rank === 1;
  const ties = tiedWith(competition, you);
  const final = competition.result.phase === 'final';
  const leaderLabel = youLead
    ? ties.length > 0
      ? `tied with ${ties.map((t) => t.displayName).join(', ')}`
      : `${final ? 'won' : 'leading'} by ${formatPoints(you.totalPoints - (orderedStandings(competition)[1]?.totalPoints ?? 0))}`
    : `leading · ${formatPoints(leader.totalPoints)}`;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/competition/[id]', params: { id: competition.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${competition.name}, ${progressLabel(competition)}. You: ${placeLabel(competition, you)}, ${formatPoints(you.totalPoints)} points.`}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText type="subtitle">{competition.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {competition.categoryId === 'step-battle' ? 'Steps' : 'Active kcal'} ·{' '}
              {dateRangeLabel(competition)}
            </ThemedText>
            <ThemedText type="small" themeColor="accentText">
              {GOAL_MODE_LABELS[competition.result.goalMode]}
            </ThemedText>
          </View>
          <Pill label={progressLabel(competition)} color={final ? 'textSecondary' : 'steps'} />
        </View>
        <View style={styles.stats}>
          <Stat value={placeLabel(competition, you)} label="your place" />
          <Stat value={formatPoints(you.totalPoints)} label="your points" />
          <Stat value={youLead ? 'You' : leader.displayName} label={leaderLabel} />
        </View>
        {!final && (
          <ThemedText type="small" themeColor="textSecondary">
            Scores are provisional until the competition is final.
          </ThemedText>
        )}
      </Card>
    </Pressable>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.three, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  banner: { borderRadius: Spacing.three, padding: Spacing.three },
  card: { gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  headerText: { flex: 1 },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1 },
});
