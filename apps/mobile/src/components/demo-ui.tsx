import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import type { DailyScore } from '@/features/scoring';
import { useTheme } from '@/hooks/use-theme';

/** Rounded surface used for cards and grouped lists. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>
      {children}
    </View>
  );
}

export function ProgressBar({ fraction, color }: { fraction: number; color: ThemeColor }) {
  const theme = useTheme();
  const width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` as const;
  return (
    <View style={[styles.track, { backgroundColor: theme.border }]}>
      <View style={[styles.fill, { width, backgroundColor: theme[color] }]} />
    </View>
  );
}

export function Pill({ label, color = 'textSecondary' }: { label: string; color?: ThemeColor }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { borderColor: theme[color] }]}>
      <ThemedText type="small" themeColor={color} style={styles.pillText}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Shown wherever demo-only scoring settings affect what is on screen. */
export function DemoSettingsBadge() {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.badge,
        { backgroundColor: theme.warningBackground, borderColor: theme.warningText },
      ]}>
      <ThemedText type="smallBold" themeColor="warningText">
        Demo scoring settings in use
      </ThemedText>
      <ThemedText type="small" themeColor="warningText">
        These results use changed demo settings, not the standard competition rules.
      </ThemedText>
    </View>
  );
}

export function Chevron() {
  return (
    <ThemedText themeColor="textSecondary" style={styles.chevron} accessibilityElementsHidden>
      ›
    </ThemedText>
  );
}

/** A header button that links to another route. */
export function HeaderLink({
  href,
  label,
  accessibilityLabel,
}: {
  href: Href;
  label: string;
  accessibilityLabel: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
        style={styles.headerLink}>
        <ThemedText type="smallBold" themeColor="accentText">
          {label}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

/** One small bar per competition day: points, capped days, pending and future days. */
export function DayBars({
  days,
  cap,
  today,
}: {
  days: Pick<DailyScore, 'date' | 'status' | 'points' | 'capped'>[];
  cap: number;
  today: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={styles.bars}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {days.map((day) => {
        if (day.status === 'future' || day.status === 'withdrawn') {
          return (
            <View
              key={day.date}
              style={[styles.bar, styles.stub, { backgroundColor: theme.border }]}
            />
          );
        }
        if (day.status === 'pending' && day.date !== today && day.points === 0) {
          return (
            <View
              key={day.date}
              testID={`bar-pending-${day.date}`}
              style={[styles.bar, styles.dashed, { borderColor: theme.textSecondary }]}
            />
          );
        }
        const height = Math.max(3, Math.round((Math.min(day.points, cap) / cap) * BAR_HEIGHT));
        return (
          <View
            key={day.date}
            testID={day.capped ? `bar-capped-${day.date}` : undefined}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: day.capped ? theme.accent : theme.steps,
                opacity: day.date === today && day.status === 'pending' ? 0.55 : 1,
                borderTopWidth: day.capped ? 3 : 0,
                borderTopColor: theme.warningText,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const BAR_HEIGHT = 36;

/** − value + control for Demo Scoring Settings. */
export function Stepper({
  label,
  value,
  display,
  changed,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  display: string;
  changed: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.stepper, { borderColor: theme.border }]}
      accessibilityLabel={`${label}: ${display}`}
      accessibilityValue={{ now: value }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        onPress={onDecrease}
        style={[styles.stepButton, { backgroundColor: theme.border }]}>
        <ThemedText type="subtitle">−</ThemedText>
      </Pressable>
      <ThemedText
        type="smallBold"
        themeColor={changed ? 'warningText' : 'text'}
        style={[styles.stepValue, changed && { backgroundColor: theme.warningBackground }]}>
        {display}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        onPress={onIncrease}
        style={[styles.stepButton, { backgroundColor: theme.border }]}>
        <ThemedText type="subtitle">+</ThemedText>
      </Pressable>
    </View>
  );
}

export function ChipButton({
  label,
  onPress,
  color = 'text',
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  color?: ThemeColor;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        disabled && styles.disabled,
      ]}>
      <ThemedText type="small" themeColor={color}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
      {children.toUpperCase()}
    </ThemedText>
  );
}

export const listStyles = StyleSheet.create({
  separator: { borderTopWidth: StyleSheet.hairlineWidth },
});

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  pill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12, lineHeight: 18 },
  badge: { borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', padding: 12, gap: 2 },
  chevron: { fontSize: 24, lineHeight: 28 },
  headerLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: BAR_HEIGHT + 3 },
  bar: { width: 7, borderRadius: 2 },
  stub: { height: 4 },
  dashed: { height: BAR_HEIGHT, borderWidth: 1, borderStyle: 'dashed' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepValue: {
    minWidth: 72,
    textAlign: 'center',
    paddingVertical: 12,
    fontVariant: ['tabular-nums'],
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  sectionTitle: { letterSpacing: 0.5, fontSize: 13 },
});
