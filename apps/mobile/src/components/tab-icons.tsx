import { StyleSheet, View, type ColorValue } from 'react-native';

/** Dependency-free tab icons drawn with views (no icon font needed in Expo Go). */

export function ActivityIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.box} accessibilityElementsHidden>
      {[10, 18, 13].map((height, i) => (
        <View key={i} style={[styles.bar, { height, backgroundColor: color }]} />
      ))}
    </View>
  );
}

export function PodiumIcon({ color }: { color: ColorValue }) {
  return (
    <View style={styles.box} accessibilityElementsHidden>
      {[12, 20, 8].map((height, i) => (
        <View key={i} style={[styles.block, { height, backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  bar: { width: 5, borderRadius: 2 },
  block: { width: 7, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});
