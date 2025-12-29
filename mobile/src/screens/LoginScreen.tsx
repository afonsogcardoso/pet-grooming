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
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { login } from '../api/auth';
import { getBranding } from '../api/branding';
import { getProfile } from '../api/profile';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { resolveSupabaseUrl } from '../config/supabase';

WebBrowser.maybeCompleteAuthSession();

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

type FormValues = z.infer<typeof schema>;
type Props = NativeStackScreenProps<any>;

const OAUTH_REDIRECT_PATH = 'auth/callback';

function parseAuthParams(url: string | undefined | null) {
  if (!url) return {};
  const [base, fragment] = url.split('#');
  const query = base?.split('?')[1];
  const params = new URLSearchParams(query ?? '');
  const fragmentParams = new URLSearchParams(fragment ?? '');
  const values: Record<string, string> = {};
  params.forEach((value, key) => {
    values[key] = value;
  });
  fragmentParams.forEach((value, key) => {
    values[key] = value;
  });
  return values;
}

function isAccountExistsOAuthError(params: Record<string, string>) {
  const haystack = `${params.error ?? ''} ${params.error_code ?? ''} ${params.error_description ?? ''}`.toLowerCase();
  if (!haystack.trim()) return false;
  if (
    haystack.includes('user_already_registered') ||
    haystack.includes('email_already_registered') ||
    haystack.includes('email_exists') ||
    haystack.includes('user_already_exists')
  ) {
    return true;
  }
  return /(email|user|account).*(already|exist|exists|registered)|(already|exist|exists|registered).*(email|user|account)/.test(
    haystack
  );
}

export default function LoginScreen({ navigation }: Props) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [brandingLogoFailed, setBrandingLogoFailed] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
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

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(schema),
  });

  const completeLogin = async ({
    token,
    refreshToken,
    fallbackUser,
  }: {
    token: string;
    refreshToken?: string | null;
    fallbackUser?: {
      email?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      activeRole?: 'consumer' | 'provider' | null;
    };
  }) => {
    setApiError(null);
    await setTokens({ token, refreshToken });

    try {
      const profile = await queryClient.fetchQuery({ queryKey: ['profile'], queryFn: getProfile });
      setUser({
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        firstName: profile.firstName,
        lastName: profile.lastName,
        activeRole: profile.activeRole,
      });
    } catch {
      if (fallbackUser) {
        setUser(fallbackUser);
      }
    }

    await queryClient.fetchQuery({ queryKey: ['branding'], queryFn: getBranding }).catch(() => null);
  };

  const { mutateAsync, isPending } = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      await completeLogin({
        token: data.token,
        refreshToken: data.refreshToken,
        fallbackUser: {
          email: data.email,
          displayName: data.displayName,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        t('login.errorFallback');
      setApiError(message);
    },
  });

  const handleOAuth = async (provider: 'google' | 'apple') => {
    if (isPending || oauthLoading) return;

    const supabaseUrl = resolveSupabaseUrl();
    if (!supabaseUrl) {
      setApiError(t('login.errors.oauthConfig'));
      console.warn('[auth] Missing Supabase URL. Check EXPO_PUBLIC_SUPABASE_URL.');
      return;
    }

    setOauthLoading(provider);
    setApiError(null);

    const providerLabel = t(`login.providers.${provider}`);
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'pawmi',
      path: OAUTH_REDIRECT_PATH,
    });
    const scopeParam = provider === 'apple' ? '&scopes=name%20email' : '';
    const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(
      redirectUri
    )}${scopeParam}`;

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== 'success') {
        if (result.type !== 'cancel' && result.type !== 'dismiss') {
          setApiError(t('login.errors.oauth', { provider: providerLabel }));
        }
        return;
      }

      const params = parseAuthParams(result.url);
      if (params.error) {
        console.warn('[auth] OAuth returned error params', params);
        setApiError(
          isAccountExistsOAuthError(params)
            ? t('login.errors.oauthAccountExists')
            : t('login.errors.oauth', { provider: providerLabel })
        );
        return;
      }

      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;

      if (!accessToken) {
        console.warn('[auth] OAuth missing access token', { params: Object.keys(params) });
        setApiError(t('login.errors.oauth', { provider: providerLabel }));
        return;
      }

      await completeLogin({ token: accessToken, refreshToken: refreshToken ?? null });
    } catch (error: any) {
      console.error('[auth] OAuth error', {
        provider,
        message: error?.message,
        code: error?.code,
        error,
      });
      setApiError(t('login.errors.oauth', { provider: providerLabel }));
    } finally {
      setOauthLoading(null);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    await mutateAsync(values);
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
          <Text style={styles.welcomeText}>{t('login.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.oauthGroup}>
            <TouchableOpacity
              style={[
                styles.oauthButton,
                (isPending || oauthLoading) && styles.buttonDisabled,
              ]}
              onPress={() => handleOAuth('google')}
              disabled={isPending || oauthLoading !== null}
            >
              {oauthLoading === 'google' ? (
                <View style={styles.oauthButtonContent}>
                  <ActivityIndicator color={colors.text} size="small" />
                  <Text style={styles.oauthButtonText}>{t('common.loading')}</Text>
                </View>
              ) : (
                <View style={styles.oauthButtonContent}>
                  <Ionicons name="logo-google" size={18} color={colors.text} />
                  <Text style={styles.oauthButtonText}>{t('login.actions.google')}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.oauthButton,
                (isPending || oauthLoading) && styles.buttonDisabled,
              ]}
              onPress={() => handleOAuth('apple')}
              disabled={isPending || oauthLoading !== null}
            >
              {oauthLoading === 'apple' ? (
                <View style={styles.oauthButtonContent}>
                  <ActivityIndicator color={colors.text} size="small" />
                  <Text style={styles.oauthButtonText}>{t('common.loading')}</Text>
                </View>
              ) : (
                <View style={styles.oauthButtonContent}>
                  <Ionicons name="logo-apple" size={18} color={colors.text} />
                  <Text style={styles.oauthButtonText}>{t('login.actions.apple')}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>{t('login.or')}</Text>
            <View style={styles.separatorLine} />
          </View>

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
                  placeholder={t('common.password')}
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
            <Text style={styles.buttonText}>{t('login.signIn')}</Text>
          )}
        </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>{t('login.noAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>{t('login.createAccount')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Pawmi App</Text>
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
      paddingTop: 60,
      paddingHorizontal: 24,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
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
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.muted,
      textAlign: 'center',
      fontWeight: '500',
    },
    formCard: {
      paddingHorizontal: 24,
      paddingVertical: 8,
    },
    oauthGroup: {
      gap: 12,
      marginBottom: 16,
    },
    oauthButton: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
    },
    oauthButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    oauthButtonText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    separator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    separatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.surfaceBorder,
    },
    separatorText: {
      marginHorizontal: 12,
      color: colors.muted,
      fontWeight: '600',
      fontSize: 12,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    field: {
      marginBottom: 20,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    inputIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    input: {
      flex: 1,
      paddingVertical: 16,
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    inputError: {
      borderColor: colors.danger,
      borderWidth: 2,
    },
    error: {
      color: colors.danger,
      marginTop: 8,
      marginLeft: 16,
      fontSize: 13,
      fontWeight: '600',
    },
    errorCard: {
      backgroundColor: '#fef2f2',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: 'center',
      marginTop: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    buttonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 17,
      letterSpacing: 0.5,
    },
    registerRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    registerText: {
      color: colors.muted,
      fontWeight: '500',
    },
    registerLink: {
      color: colors.primary,
      fontWeight: '700',
    },
    footer: {
      alignItems: 'center',
      paddingBottom: 20,
    },
    footerText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
