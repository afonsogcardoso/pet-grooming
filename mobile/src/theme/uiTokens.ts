import type { useBrandingTheme } from './useBrandingTheme';

type ThemeColors = ReturnType<typeof useBrandingTheme>['colors'];

export const UI_TOKENS = {
  cardRadius: 16,
  cardPadding: 16,
  cardBorderWidth: 0,
  cardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  inputRadius: 12,
};

export function getCardStyle(colors: ThemeColors) {
  return {
    backgroundColor: colors.surface,
    borderRadius: UI_TOKENS.cardRadius,
    padding: UI_TOKENS.cardPadding,
    borderWidth: UI_TOKENS.cardBorderWidth,
    borderColor: colors.surfaceBorder,
    ...UI_TOKENS.cardShadow,
  };
}
