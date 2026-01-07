import type { useBrandingTheme } from './useBrandingTheme';

type ThemeColors = ReturnType<typeof useBrandingTheme>['colors'];

export const UI_TOKENS = {
  cardRadius: 16,
  cardPadding: 16,
  cardBorderWidth: 0,
  cardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  inputRadius: 12,
  segment: {
    containerRadius: 16,
    buttonRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
};

export function getCardStyle(colors: ThemeColors) {
  return {
    backgroundColor: `${colors.surface}`,
    borderRadius: UI_TOKENS.cardRadius,
    padding: UI_TOKENS.cardPadding,
    borderWidth: UI_TOKENS.cardBorderWidth,
    borderColor: colors.surfaceBorder,
    ...UI_TOKENS.cardShadow,
  };
}

export function getCardVariants(colors: ThemeColors) {
  const base = getCardStyle(colors);

  const surface = {
    ...base,
    backgroundColor: colors.surface,
  };

  const raised = {
    ...surface,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    shadowOpacity: 0.08,
    elevation: 5,
  };

  const listItem = {
    ...base,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
  };

  return { base, surface, raised, listItem };
}

export function getSegmentStyles(colors: ThemeColors) {
  const { segment } = UI_TOKENS;

  const container = {
    flexDirection: "row",
    gap: segment.gap,
    paddingHorizontal: segment.paddingHorizontal,
    paddingVertical: segment.paddingVertical,
    borderRadius: segment.containerRadius,
    backgroundColor: `${colors.primary}10`,
    alignItems: "center",
    justifyContent: "flex-start",
  };

  const button = {
    minWidth: 0,
    flexShrink: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: segment.buttonRadius,
    alignItems: "center",
    justifyContent: "center",
  };

  const buttonActive = {
    backgroundColor: colors.surface,
    borderColor: colors.primarySoft || colors.primary,
    borderWidth: 1,
  };

  const text = {
    fontWeight: "600",
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    flexShrink: 1,
  };

  const textActive = {
    color: colors.primary,
    fontWeight: "700",
  };

  return { container, button, buttonActive, text, textActive };
}
