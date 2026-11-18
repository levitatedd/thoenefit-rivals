import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, DemoSettingsBadge } from '@/components/demo-ui';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { YOU, demoRules, standingFor, useDemo } from '@/features/demo';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, formatPoints } from '@/utils/format';

export default function ScoringScreen() {
  const theme = useTheme();
  const { world, state } = useDemo();
  const rules = demoRules(state);
  const cap = formatNumber(rules.dailyCapPoints);
  const perGoal = formatNumber(rules.pointsPerGoal);

  // A worked example with your own Step Battle numbers: today, or the latest day with activity.
  const stepBattle = world.competitions.find((c) => c.categoryId === 'step-battle');
  const you = stepBattle && standingFor(stepBattle, YOU);
  const exampleDay =
    you?.days.find((d) => d.date === world.today && d.eligibleActivity > 0) ??
    [...(you?.days ?? [])].reverse().find((d) => d.eligibleActivity > 0);
  const goal = you?.goal.dailyGoal ?? state.settings.goals['step-battle'][YOU];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}>
      <View style={styles.column}>
        {world.usesDemoSettings && <DemoSettingsBadge />}
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {exampleDay?.date === world.today ? 'Your Step Battle points today' : 'Example'}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="accentText" style={styles.formula}>
            {exampleDay
              ? `${formatNumber(exampleDay.eligibleActivity)} ÷ ${formatNumber(goal)} goal × ${perGoal} = ${formatPoints(exampleDay.points)} pts${exampleDay.capped ? ' (capped)' : ''}`
              : `steps ÷ your goal × ${perGoal} = points`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Reaching your own daily goal earns {perGoal} points. Everyone is measured against their
            own goal, so a light walker can compete with an athlete.
          </ThemedText>
        </Card>

        <Item title={`At most ${cap} points a day`}>
          A huge day helps, but can&apos;t win the whole competition on its own: once you reach{' '}
          {cap} points, extra activity that day doesn&apos;t add more.
        </Item>
        <Item title="Every day adds up">
          Your total is the sum of each day&apos;s points. One great day can make up for one missed
          day, but consistency wins.
        </Item>
        <Item title="Missing data isn't zero">
          If a phone hasn&apos;t synced yet, that day shows &ldquo;Waiting for sync&rdquo; instead
          of counting as zero.
        </Item>
        <Item title="Final 24 hours after the end">
          Activity that syncs late still counts during that window. After that, results never
          change.
        </Item>
        <Item title="Ties are shared">
          Exactly equal points (to the hundredth) share a place: 1st, 1st, 3rd. There is no
          tiebreaker.
        </Item>
        <Item title="What doesn't count">
          Manually typed-in activity, the same activity recorded twice, and activity from an unknown
          source (held until it can be checked).
        </Item>
        <Item title="Separate competitions">
          Step Battle scores steps and Calorie Clash scores active calories. They are never added
          together.
        </Item>
      </View>
    </ScrollView>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.item}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.three, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  formula: { fontSize: 16, fontVariant: ['tabular-nums'] },
  item: { gap: Spacing.half },
});
