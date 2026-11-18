import { Tabs } from 'expo-router/js-tabs';

import { HeaderLink } from '@/components/demo-ui';
import { ActivityIcon, PodiumIcon } from '@/components/tab-icons';
import { useTheme } from '@/hooks/use-theme';

function DemoControlsButton() {
  return <HeaderLink href="/demo" label="Demo" accessibilityLabel="Open demo controls" />;
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accentText,
        tabBarInactiveTintColor: theme.textSecondary,
        headerRight: DemoControlsButton,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <ActivityIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="competitions"
        options={{
          title: 'Competitions',
          tabBarIcon: ({ color }) => <PodiumIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
