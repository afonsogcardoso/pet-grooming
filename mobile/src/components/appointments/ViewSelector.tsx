import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

type ViewMode = 'list' | 'day' | 'week' | 'month';

type ViewSelectorProps = {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
};

export function ViewSelector({ currentView, onViewChange }: ViewSelectorProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();

  const views: Array<{ mode: ViewMode; icon: string; label: string }> = [
    { mode: 'list', icon: '📋', label: t('viewSelector.list') },
    { mode: 'day', icon: '📅', label: t('viewSelector.day') },
    { mode: 'week', icon: '📆', label: t('viewSelector.week') },
    { mode: 'month', icon: '🗓️', label: t('viewSelector.month') },
  ];

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      gap: 4,
      marginHorizontal: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    button: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeButton: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    buttonText: {
      fontSize: 20,
      marginBottom: 2,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
    },
    activeLabel: {
      color: '#fff',
      fontWeight: '700',
    },
  });

  return (
    <View style={styles.container}>
      {views.map((view) => {
        const isActive = currentView === view.mode;
        return (
          <TouchableOpacity
            key={view.mode}
            style={[styles.button, isActive && styles.activeButton]}
            onPress={() => onViewChange(view.mode)}
          >
            <Text style={styles.buttonText}>{view.icon}</Text>
            <Text style={[styles.label, isActive && styles.activeLabel]}>{view.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
