export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    border: '#E0E1E6',
    accent: '#24EFA1',
    steps: '#1F9D55',
    energy: '#E5484D',
    warningBackground: '#FFF4D5',
    warningText: '#6B4E00',
    accentText: '#067A50',
    accentSurface: '#E3FCF2',
    onAccent: '#0B0B0D',
    danger: '#C62A2F',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#B0B4BA',
    background: '#0B0B0D',
    backgroundElement: '#1C1D20',
    border: '#2E3135',
    accent: '#2DF5A2',
    steps: '#3DD68C',
    energy: '#FF6369',
    warningBackground: '#3A2E05',
    warningText: '#FFE08A',
    accentText: '#2DF5A2',
    accentSurface: '#13261E',
    onAccent: '#0B0B0D',
    danger: '#FF6369',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;

export const MaxContentWidth = 640;
