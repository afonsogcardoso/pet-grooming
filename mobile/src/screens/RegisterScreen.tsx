import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { signup } from '../api/auth';
import { getBranding } from '../api/branding';
import { getProfile } from '../api/profile';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { PhoneInput } from '../components/common/PhoneInput';

const schema = z.object({
  registerAs: z.enum(['consumer', 'provider']),
  accountName: z.string().min(2).optional().or(z.literal('')),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;
type Props = NativeStackScreenProps<any>;

export default function RegisterScreen({ navigation }: Props) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [brandingLogoFailed, setBrandingLogoFailed] = useState(false);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { colors, branding } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const logoSource = useMemo(() => {
    if (!branding?.logo_url || brandingLogoFailed) {
      return require('../../assets/logo_180x180.png');
    }
    return { uri: branding.logo_url };
  }, [branding?.logo_url, brandingLogoFailed]);

  const { control, handleSubmit, watch, setValue, clearErrors, setError } = useForm<FormValues>({
    defaultValues: {
      registerAs: 'consumer',
      accountName: '',
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      password: '',
    },
    resolver: zodResolver(schema),
  });
  const registerAs = watch('registerAs');
  const isProvider = registerAs === 'provider';

  const { mutateAsync, isPending } = useMutation({
    mutationFn: signup,
    onSuccess: async (data) => {
      setApiError(null);
      if (!data.token) {
        setApiError(data.message || t('register.createdMessage'));
        return;
      }
      await setTokens({ token: data.token, refreshToken: data.refreshToken });
      try {
        const profile = await queryClient.fetchQuery({ queryKey: ['profile'], queryFn: getProfile });
        setUser({
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          firstName: profile.firstName,
          lastName: profile.lastName,
          userType: profile.userType,
        });
      } catch {
        setUser({
          email: data.email,
          displayName: data.displayName,
          firstName: data.firstName,
          lastName: data.lastName,
        });
      }
      await queryClient.fetchQuery({ queryKey: ['branding'], queryFn: getBranding }).catch(() => null);
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        t('register.errorFallback');
      setApiError(message);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (values.registerAs === 'provider' && !values.accountName?.trim()) {
      setError('accountName', { type: 'manual', message: t('register.accountRequired') });
      return;
    }
    await mutateAsync({
      email: values.email.trim(),
      password: values.password,
      accountName: values.registerAs === 'provider' ? values.accountName.trim() : undefined,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone?.trim() || undefined,
      userType: values.registerAs,
    });
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerSection}>
        <View style={styles.iconCircle}>
          <Image
            source={logoSource}
            style={styles.iconImage}
            onError={() => setBrandingLogoFailed(true)}
          />
        </View>
        <Text style={styles.welcomeText}>{t('register.title')}</Text>
        <Text style={styles.subtitle}>
          {isProvider ? t('register.subtitleProvider') : t('register.subtitleConsumer')}
        </Text>
        </View>

        <View style={styles.formCard}>
        <View style={styles.roleSection}>
          <Text style={styles.roleLabel}>{t('register.roleTitle')}</Text>
          <View style={styles.roleGrid}>
            <TouchableOpacity
              style={[
                styles.roleCard,
                registerAs === 'consumer' && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
              ]}
              onPress={() => {
                setValue('registerAs', 'consumer');
                clearErrors('accountName');
              }}
            >
              <Text style={[styles.roleTitle, registerAs === 'consumer' && { color: colors.primary }]}>
                {t('register.roleConsumerTitle')}
              </Text>
              <Text style={styles.roleHint}>{t('register.roleConsumerHint')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleCard,
                registerAs === 'provider' && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
              ]}
              onPress={() => setValue('registerAs', 'provider')}
            >
              <Text style={[styles.roleTitle, registerAs === 'provider' && { color: colors.primary }]}>
                {t('register.roleProviderTitle')}
              </Text>
              <Text style={styles.roleHint}>{t('register.roleProviderHint')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isProvider ? (
          <Controller
            control={control}
            name="accountName"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <View style={styles.field}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>🏷️</Text>
                  <TextInput
                    style={[styles.input, error ? styles.inputError : null]}
                    value={value}
                    onChangeText={onChange}
                    placeholder={t('register.accountPlaceholder')}
                    placeholderTextColor={colors.muted}
                  />
                </View>
                {error && <Text style={styles.error}>{error.message}</Text>}
              </View>
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="firstName"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View style={styles.field}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={[styles.input, error ? styles.inputError : null]}
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('register.firstNamePlaceholder')}
                  placeholderTextColor={colors.muted}
                />
              </View>
              {error && <Text style={styles.error}>{error.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="lastName"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View style={styles.field}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🪪</Text>
                <TextInput
                  style={[styles.input, error ? styles.inputError : null]}
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('register.lastNamePlaceholder')}
                  placeholderTextColor={colors.muted}
                />
              </View>
              {error && <Text style={styles.error}>{error.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View style={styles.field}>
              <PhoneInput
                label={t('common.phone')}
                value={value}
                onChange={onChange}
                placeholder={t('common.phone')}
                disabled={isSubmitting}
              />
              {error && <Text style={styles.error}>{error.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View style={styles.field}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  style={[styles.input, error ? styles.inputError : null]}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('common.email')}
                  placeholderTextColor={colors.muted}
                />
              </View>
              {error && <Text style={styles.error}>{error.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View style={styles.field}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={[styles.input, error ? styles.inputError : null]}
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('register.passwordPlaceholder')}
                  placeholderTextColor={colors.muted}
                />
              </View>
              {error && <Text style={styles.error}>{error.message}</Text>}
            </View>
          )}
        />

        {apiError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{apiError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, isPending && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={isPending}
        >
          {isPending ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}>{t('common.loading')}</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>{t('register.createAccount')}</Text>
          )}
        </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('Login')}>
            <Text style={styles.secondaryText}>{t('register.backToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingVertical: 40,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'space-between',
      paddingBottom: 24,
    },
    headerSection: {
      alignItems: 'center',
      paddingTop: 50,
      paddingHorizontal: 24,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    iconImage: {
      width: '100%',
      height: '100%',
      borderRadius: 40,
      resizeMode: 'cover',
    },
    welcomeText: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: colors.muted,
      textAlign: 'center',
      fontWeight: '500',
    },
    formCard: {
      paddingHorizontal: 24,
      paddingVertical: 8,
    },
    roleSection: {
      marginBottom: 16,
    },
    roleLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    roleGrid: {
      gap: 12,
    },
    roleCard: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 16,
      padding: 14,
      backgroundColor: colors.surface,
    },
    roleTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    roleHint: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    field: {
      marginBottom: 16,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    inputIcon: {
      fontSize: 18,
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    inputError: {
      borderColor: '#F87171',
    },
    error: {
      color: '#F87171',
      marginTop: 6,
      fontSize: 12,
      fontWeight: '600',
    },
    errorCard: {
      backgroundColor: '#FEE2E2',
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      color: '#B91C1C',
      fontWeight: '600',
      fontSize: 13,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 6,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    secondaryButton: {
      marginTop: 12,
      alignItems: 'center',
    },
    secondaryText: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
}
