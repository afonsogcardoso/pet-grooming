import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/common';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';

type Props = NativeStackScreenProps<any>;

export default function ConsumerHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const user = useAuthStore((s) => s.user);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const firstName =
    user?.firstName ||
    user?.displayName?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    t('common.user');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('consumerHome.title')} showBack={false} />
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.greeting}>{t('consumerHome.greeting', { name: firstName })}</Text>
          <Text style={styles.subtitle}>{t('consumerHome.subtitle')}</Text>
          <Text style={styles.body}>{t('consumerHome.body')}</Text>
          <Button
            title={t('consumerHome.marketplaceAction')}
            onPress={() => navigation.navigate('Marketplace')}
            style={styles.primaryButton}
          />
          <Button
            title={t('consumerHome.appointmentsAction')}
            onPress={() => navigation.navigate('ConsumerAppointments')}
            variant="outline"
            style={styles.secondaryButton}
          />
          <Button
            title={t('consumerHome.petsAction')}
            onPress={() => navigation.navigate('ConsumerPets')}
            variant="outline"
            style={styles.secondaryButton}
          />
          <Button
            title={t('consumerHome.profileAction')}
            onPress={() => navigation.navigate('Profile')}
            variant="outline"
            style={styles.tertiaryButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 4,
    },
    greeting: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
    },
    body: {
      fontSize: 14,
      color: colors.muted,
      marginBottom: 16,
      lineHeight: 20,
    },
    primaryButton: {
      marginBottom: 10,
    },
    secondaryButton: {
      marginTop: 2,
    },
    tertiaryButton: {
      marginTop: 2,
    },
  });
}
