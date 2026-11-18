import { render, screen, userEvent } from '@testing-library/react-native';

import TodayScreen from '@/app/index';
import { ActivitySourceProvider, toDateKey, type ActivityDataSource } from '@/features/activity';

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Link: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

function fakeSource(overrides: Partial<ActivityDataSource> = {}): ActivityDataSource {
  const today = toDateKey(new Date());
  return {
    info: { id: 'fake', kind: 'simulated', label: 'Fake data' },
    getDailySummaries: jest.fn(async () => [
      {
        date: '2000-01-01',
        steps: 9876,
        activeEnergyKcal: 543,
        sourceId: 'fake',
        isComplete: true,
      },
      { date: today, steps: 12345, activeEnergyKcal: 678, sourceId: 'fake', isComplete: false },
    ]),
    ...overrides,
  };
}

function renderWithSource(source: ActivityDataSource) {
  return render(
    <ActivitySourceProvider source={source}>
      <TodayScreen />
    </ActivitySourceProvider>,
  );
}

describe('<TodayScreen />', () => {
  it('always shows the simulated data notice', async () => {
    await renderWithSource(fakeSource());
    expect(screen.getByText('Simulated data')).toBeOnTheScreen();
  });

  it("renders today's totals and previous days", async () => {
    await renderWithSource(fakeSource());

    expect(await screen.findByText('Today')).toBeOnTheScreen();
    expect(screen.getByLabelText('Steps: 12,345 steps')).toBeOnTheScreen();
    expect(screen.getByLabelText('Active energy: 678 kcal')).toBeOnTheScreen();
    expect(screen.getByTestId('history-row-2000-01-01')).toBeOnTheScreen();
    expect(screen.getByText('9,876 steps')).toBeOnTheScreen();
  });

  it('shows an error with a retry action when loading fails', async () => {
    const getDailySummaries = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);
    await renderWithSource(fakeSource({ getDailySummaries }));

    expect(await screen.findByText(/Couldn't load activity: boom/)).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No activity recorded yet.')).toBeOnTheScreen();
    expect(getDailySummaries).toHaveBeenCalledTimes(2);
  });
});
