import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ActivitySourceProvider } from '@/features/activity';
import { DemoProvider } from '@/features/demo';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  // Modals (demo controls, scoring, about) open over the tabs, even from a deep link.
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ActivitySourceProvider>
        <DemoProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
            <Stack.Screen
              name="competition/[id]/index"
              options={{ title: 'Competition', presentation: 'card' }}
            />
            <Stack.Screen
              name="competition/[id]/[participantId]"
              options={{ title: 'Player', presentation: 'card' }}
            />
            <Stack.Screen
              name="scoring"
              options={{ title: 'How scoring works', presentation: 'modal' }}
            />
            <Stack.Screen name="demo" options={{ title: 'Demo controls', presentation: 'modal' }} />
            <Stack.Screen name="about" options={{ title: 'About', presentation: 'modal' }} />
          </Stack>
        </DemoProvider>
      </ActivitySourceProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
