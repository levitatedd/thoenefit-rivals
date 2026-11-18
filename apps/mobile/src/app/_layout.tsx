import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ActivitySourceProvider } from '@/features/activity';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ActivitySourceProvider>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'ThoeneFit Rivals' }} />
          <Stack.Screen name="about" options={{ title: 'About', presentation: 'modal' }} />
        </Stack>
      </ActivitySourceProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
