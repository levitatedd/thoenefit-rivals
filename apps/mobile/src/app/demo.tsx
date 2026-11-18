import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, ChipButton, SectionTitle, Stepper, listStyles } from '@/components/demo-ui';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { fromDateKey } from '@/features/activity';
import {
  DEMO_PLAYERS,
  SETTING_LIMITS,
  YOU,
  defaultSettings,
  progressLabel,
  typicalDay,
  useDemo,
} from '@/features/demo';
import { RULES_V1, type CategoryId } from '@/features/scoring';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, formatShortDate } from '@/utils/format';

const CATEGORY_LABELS: Record<CategoryId, string> = {
  'step-battle': 'Step Battle',
  'calorie-clash': 'Calorie Clash',
};

export default function DemoControlsScreen() {
  const theme = useTheme();
  const { state, world, dispatch, jumpTo, reset } = useDemo();
  const [goalCategory, setGoalCategory] = useState<CategoryId>('step-battle');
  const defaults = defaultSettings();
  const { settings } = state;
  const stepBattle = world.competitions.find((c) => c.categoryId === 'step-battle');

  const add = (categoryId: CategoryId, amount: number) =>
    dispatch({ type: 'add-activity', categoryId, date: world.today, amount });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        <View
          accessibilityRole="alert"
          style={[
            styles.warning,
            { backgroundColor: theme.warningBackground, borderColor: theme.warningText },
          ]}>
          <ThemedText type="smallBold" themeColor="warningText">
            DEMO ONLY: not real competition rules
          </ThemedText>
          <ThemedText type="small" themeColor="warningText">
            These controls change simulated demo competitions so you can explore how scoring affects
            the leaderboard. Real competitions always use the standard rules (
            {RULES_V1.dailyCapPoints}-point daily cap, {RULES_V1.pointsPerGoal} points per goal).
          </ThemedText>
        </View>

        <View style={styles.section}>
          <SectionTitle>Add activity to today (you)</SectionTitle>
          <View style={styles.chips}>
            <ChipButton
              label="+1,000 steps"
              color="steps"
              onPress={() => add('step-battle', 1000)}
            />
            <ChipButton
              label="+5,000 steps"
              color="steps"
              onPress={() => add('step-battle', 5000)}
            />
            <ChipButton label="+50 kcal" color="energy" onPress={() => add('calorie-clash', 50)} />
            <ChipButton
              label="+200 kcal"
              color="energy"
              onPress={() => add('calorie-clash', 200)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle>Jump ahead in time</SectionTitle>
          <View style={styles.chips}>
            <ChipButton label="Next day" onPress={() => jumpTo(world.jumps.nextDay)} />
            <ChipButton
              label="End of Step Battle"
              disabled={world.jumps.endOfStepBattle === null}
              onPress={() => world.jumps.endOfStepBattle && jumpTo(world.jumps.endOfStepBattle)}
            />
            <ChipButton
              label="Make results final"
              disabled={world.jumps.finalStepBattle === null}
              onPress={() => world.jumps.finalStepBattle && jumpTo(world.jumps.finalStepBattle)}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Demo date: {formatShortDate(fromDateKey(world.today))}
            {stepBattle ? ` · Step Battle: ${progressLabel(stepBattle)}` : ''}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <SectionTitle>Demo scoring settings</SectionTitle>
          <Card style={styles.list}>
            <SettingRow label="Daily point cap" hint={`Standard: ${RULES_V1.dailyCapPoints}`}>
              <Stepper
                label="daily point cap"
                value={settings.dailyCapPoints}
                display={formatNumber(settings.dailyCapPoints)}
                changed={settings.dailyCapPoints !== defaults.dailyCapPoints}
                onDecrease={() =>
                  dispatch({
                    type: 'set-cap',
                    value: settings.dailyCapPoints - SETTING_LIMITS.dailyCapPoints.step,
                  })
                }
                onIncrease={() =>
                  dispatch({
                    type: 'set-cap',
                    value: settings.dailyCapPoints + SETTING_LIMITS.dailyCapPoints.step,
                  })
                }
              />
            </SettingRow>
            <SettingRow
              label="Points per goal"
              hint={`Points at 100% of goal · standard: ${RULES_V1.pointsPerGoal}`}
              separated>
              <Stepper
                label="points per goal"
                value={settings.pointsPerGoal}
                display={formatNumber(settings.pointsPerGoal)}
                changed={settings.pointsPerGoal !== defaults.pointsPerGoal}
                onDecrease={() =>
                  dispatch({
                    type: 'set-points-per-goal',
                    value: settings.pointsPerGoal - SETTING_LIMITS.pointsPerGoal.step,
                  })
                }
                onIncrease={() =>
                  dispatch({
                    type: 'set-points-per-goal',
                    value: settings.pointsPerGoal + SETTING_LIMITS.pointsPerGoal.step,
                  })
                }
              />
            </SettingRow>
          </Card>
          <ThemedText type="small" themeColor="warningText">
            Highlighted values differ from the standard rules. Screens using changed settings show a
            &ldquo;Demo scoring settings in use&rdquo; notice.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <SectionTitle>Daily goals</SectionTitle>
          <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
            {(Object.keys(CATEGORY_LABELS) as CategoryId[]).map((categoryId) => {
              const selected = goalCategory === categoryId;
              return (
                <Pressable
                  key={categoryId}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setGoalCategory(categoryId)}
                  style={[styles.segmentButton, selected && { backgroundColor: theme.border }]}>
                  <ThemedText type={selected ? 'smallBold' : 'small'}>
                    {CATEGORY_LABELS[categoryId]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <Card style={styles.list}>
            {DEMO_PLAYERS.map((player, index) => {
              const limits = SETTING_LIMITS.goals[goalCategory];
              const value = settings.goals[goalCategory][player.id];
              const unit = goalCategory === 'step-battle' ? 'steps' : 'kcal';
              return (
                <SettingRow
                  key={player.id}
                  label={player.displayName}
                  hint={`usually ~${formatNumber(typicalDay(player, goalCategory))} ${unit}`}
                  separated={index > 0}>
                  <Stepper
                    label={`${player.id === YOU ? 'your' : `${player.displayName}'s`} ${CATEGORY_LABELS[goalCategory]} goal`}
                    value={value}
                    display={formatNumber(value)}
                    changed={value !== defaults.goals[goalCategory][player.id]}
                    onDecrease={() =>
                      dispatch({
                        type: 'set-goal',
                        categoryId: goalCategory,
                        playerId: player.id,
                        value: value - limits.step,
                      })
                    }
                    onIncrease={() =>
                      dispatch({
                        type: 'set-goal',
                        categoryId: goalCategory,
                        playerId: player.id,
                        value: value + limits.step,
                      })
                    }
                  />
                </SettingRow>
              );
            })}
          </Card>
          <ThemedText type="small" themeColor="textSecondary">
            Changes re-score the demo competitions from their first day so you can compare. In real
            competitions, goals lock when the competition starts.
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <ChipButton
            label="Shuffle simulated activity"
            onPress={() => dispatch({ type: 'shuffle' })}
          />
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            style={[styles.reset, { borderColor: theme.danger }]}>
            <ThemedText type="smallBold" themeColor="danger">
              Reset demo (restore standard settings)
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function SettingRow({
  label,
  hint,
  separated = false,
  children,
}: {
  label: string;
  hint: string;
  separated?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.settingRow,
        separated && [listStyles.separator, { borderTopColor: theme.border }],
      ]}>
      <View style={styles.flex}>
        <ThemedText>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.three, alignItems: 'center', paddingBottom: Spacing.five },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.four },
  warning: { borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', padding: 12, gap: 2 },
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  list: { paddingVertical: 0, gap: 0 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    minHeight: 60,
  },
  flex: { flex: 1 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: Spacing.three },
  reset: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
