import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { login } from '../api/auth';
import { getBranding } from '../api/branding';
import { getProfile } from '../api/profile';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

type FormValues = z.infer<typeof schema>;
type Props = NativeStackScreenProps<any>;

export default function LoginScreen({ navigation }: Props) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [brandingLogoFailed, setBrandingLogoFailed] = useState(false);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
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

  const { mutateAsync, isPending } = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      setApiError(null);
      // First store tokens temporarily to make authenticated requests
      await setTokens({ token: data.token, refreshToken: data.refreshToken });
      
      // Fetch profile to get displayName and avatarUrl
      try {
        const profile = await queryClient.fetchQuery({ queryKey: ['profile'], queryFn: getProfile });
        setUser({ email: profile.email, displayName: profile.displayName, avatarUrl: profile.avatarUrl });
      } catch {
        setUser({ email: data.email });
      }
      
      // Wait for branding before navigating - app will show loading during this
      await queryClient.fetchQuery({ queryKey: ['branding'], queryFn: getBranding }).catch(() => null);
      // Navigation happens automatically when token is set (already set above)
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        'Falha no login. Verifique credenciais.';
      setApiError(message);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await mutateAsync(values);
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.iconCircle}>
          <Image
            source={logoSource}
            style={styles.iconImage}
            onError={() => setBrandingLogoFailed(true)}
          />
        </View>
        <Text style={styles.welcomeText}>Bem-vindo de volta</Text>
        <Text style={styles.subtitle}>Entre para gerir os seus agendamentos</Text>
      </View>

      <View style={styles.formCard}>
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
                  placeholder="Email"
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
                  placeholder="Senha"
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
              <Text style={styles.buttonText}>A carregar...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Entrar →</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Pawmi App</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'space-between',
      paddingVertical: 40,
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
