import { act, screen, userEvent, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import TabsLayout from '@/app/(tabs)/_layout';
import CompetitionsScreen from '@/app/(tabs)/competitions';
import TodayScreen from '@/app/(tabs)/index';
import * as RootLayoutModule from '@/app/_layout';
import AboutScreen from '@/app/about';
import PlayerScreen from '@/app/competition/[id]/[participantId]';
import CompetitionScreen from '@/app/competition/[id]/index';
import DemoControlsScreen from '@/app/demo';
import ScoringScreen from '@/app/scoring';

const ROUTES = {
  _layout: RootLayoutModule,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': TodayScreen,
  '(tabs)/competitions': CompetitionsScreen,
  'competition/[id]/index': CompetitionScreen,
  'competition/[id]/[participantId]': PlayerScreen,
  scoring: ScoringScreen,
  demo: DemoControlsScreen,
  about: AboutScreen,
};

function renderApp(initialUrl = '/') {
  return renderRouter(ROUTES, { initialUrl });
}

describe('demo app (real layouts, simulated data, real scoring engine)', () => {
  it('launches on Today with simulated data, goals and competitions, and opens About', async () => {
    await renderApp();

    expect(await screen.findByText('Simulated data')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Steps: [\d,]+ of 8,500 steps goal$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Active energy: [\d,]+ of 450 kcal goal$/)).toBeOnTheScreen();
    expect(screen.getByText(/pts today$/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Step Battle: .* Day 3 of 7$/ })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /^Calorie Clash: Shared 1st of 5/ }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Demo scoring settings in use')).toBeNull();

    await userEvent.press(screen.getByText('About this preview'));
    expect(await screen.findByText('Pre-alpha preview')).toBeOnTheScreen();
    expect(screen).toHavePathname('/about');
  });

  it('shows the Competitions tab with active and finished competitions', async () => {
    await renderApp('/competitions');
    expect(await screen.findByText('ACTIVE')).toBeOnTheScreen();
    expect(screen.getByText('FINISHED')).toBeOnTheScreen();
    expect(screen.getByText(/never added together/)).toBeOnTheScreen();
  });

  it('opens a leaderboard that explains a tie, then your private day-by-day', async () => {
    await renderApp();
    await userEvent.press(await screen.findByRole('button', { name: /^Calorie Clash:/ }));

    expect(screen).toHavePathname('/competition/demo-calorie-clash');
    expect(
      await screen.findByText(/Maya and You share 1st place: exactly 320 points each/),
    ).toBeOnTheScreen();
    expect(screen.getByText(/These results are final/)).toBeOnTheScreen();
    // Points are always whole numbers; a rounded near-tie is explained instead.
    expect(screen.getByText('285')).toBeOnTheScreen();
    expect(screen.queryByText(/\d\.\d/)).toBeNull();
    expect(screen.getByText(/Sam ranks above Jordan: both round to the same/)).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: /^Shared 1st: You, 320 points/ }));
    expect(screen).toHavePathname('/competition/demo-calorie-clash/you');
    expect(await screen.findByText('ONLY YOU CAN SEE THIS')).toBeOnTheScreen();
    expect(screen.getByText(/Manually entered activity is not counted/)).toBeOnTheScreen();
    expect(screen.getByText(/could not identify where this activity came from/)).toBeOnTheScreen();
  });

  it("shows only public information on another player's page", async () => {
    await renderApp('/competition/demo-step-battle/maya');
    expect(
      await screen.findByText(/Their activity history, held records and goal advice are private/),
    ).toBeOnTheScreen();
    expect(screen.queryByText('ONLY YOU CAN SEE THIS')).toBeNull();
    expect(screen.queryByText(/ steps$/)).toBeNull();
  });

  it('explains scoring with your own numbers', async () => {
    await renderApp('/scoring');
    expect(await screen.findByText('At most 200 points a day')).toBeOnTheScreen();
    expect(screen.getByText(/÷ 8,500 goal × 100 = [\d.,]+ pts/)).toBeOnTheScreen();
  });

  it('changes demo-only scoring settings, labels them, and resets to the standard rules', async () => {
    await renderApp('/demo');
    expect(await screen.findByText('DEMO ONLY: not real competition rules')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: 'Increase daily point cap' }));
    await userEvent.press(screen.getByRole('button', { name: 'Decrease points per goal' }));
    expect(screen.getByLabelText('daily point cap: 225')).toBeOnTheScreen();
    expect(screen.getByLabelText('points per goal: 90')).toBeOnTheScreen();

    await act(() => router.push('/scoring'));
    expect(await screen.findByText('At most 225 points a day')).toBeOnTheScreen();
    expect(screen.getByText('Demo scoring settings in use')).toBeOnTheScreen();

    await act(() => router.back());
    await userEvent.press(await screen.findByRole('button', { name: /Reset demo/ }));
    expect(screen.getByLabelText('daily point cap: 200')).toBeOnTheScreen();
    expect(screen.getByLabelText('points per goal: 100')).toBeOnTheScreen();
  });

  it('adjusts a simulated participant goal and re-scores the competition', async () => {
    await renderApp('/demo');
    await userEvent.press(await screen.findByRole('tab', { name: 'Calorie Clash' }));
    const decrease = screen.getByRole('button', { name: "Decrease Maya's Calorie Clash goal" });
    for (let i = 0; i < 5; i++) await userEvent.press(decrease);
    expect(screen.getByLabelText("Maya's Calorie Clash goal: 200")).toBeOnTheScreen();

    await act(() => router.back()); // close Demo controls
    await act(() => router.push('/competition/demo-calorie-clash'));
    expect(await screen.findByRole('button', { name: /^1st: Maya/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^2nd: You/ })).toBeOnTheScreen();
    expect(screen.queryByText(/share 1st place/)).toBeNull();
  });

  it('jumps ahead to final results', async () => {
    await renderApp('/demo');
    await userEvent.press(await screen.findByRole('button', { name: 'Make results final' }));
    expect(screen.getByText(/Step Battle: Final/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Make results final' })).toBeDisabled();

    await act(() => router.back()); // close Demo controls
    await act(() => router.push('/competition/demo-step-battle'));
    const list = await screen.findByText(/These results are final/);
    expect(list).toBeOnTheScreen();
    expect(
      within(screen.getByRole('button', { name: /: Alex,/ })).queryByText(/waiting for sync/),
    ).toBeNull();
  });
});
