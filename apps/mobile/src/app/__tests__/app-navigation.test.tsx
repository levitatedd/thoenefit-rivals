import { screen, userEvent } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import AboutScreen from '@/app/about';
import TodayScreen from '@/app/index';
import RootLayout from '@/app/_layout';

describe('app navigation (real layout, simulated data)', () => {
  it('launches on Today with simulated data and opens About', async () => {
    await renderRouter(
      { _layout: RootLayout, index: TodayScreen, about: AboutScreen },
      { initialUrl: '/' },
    );

    expect(await screen.findByText('Today')).toBeOnTheScreen();
    expect(screen.getByText('Simulated data')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Steps: [\d,]+ steps$/)).toBeOnTheScreen();

    await userEvent.press(screen.getByText('About this preview'));
    expect(await screen.findByText('Pre-alpha preview')).toBeOnTheScreen();
    expect(screen).toHavePathname('/about');
  });
});
