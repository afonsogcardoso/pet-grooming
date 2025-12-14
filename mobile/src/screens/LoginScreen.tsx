import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { login } from '../api/auth';
import { getBranding } from '../api/branding';
import { useAuthStore } from '../state/authStore';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

type FormValues = z.infer<typeof schema>;
type Props = NativeStackScreenProps<any>;

export default function LoginScreen({ navigation }: Props) {
  const [apiError, setApiError] = useState<string | null>(null);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(schema),
  });

  const { mutateAsync, isPending } = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      setApiError(null);
      await setTokens({ token: data.token, refreshToken: data.refreshToken });
      setUser({ email: data.email });
      // Prefetch branding right after login so telas já carregam com tema.
      queryClient.prefetchQuery({ queryKey: ['branding'], queryFn: getBranding }).catch(() => null);
      navigation.replace('Home');
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
    setUser({ email: values.email });
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entrar</Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              autoCapitalize="none"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              placeholder="seu@email.com"
            />
            {error && <Text style={styles.error}>{error.message}</Text>}
          </View>
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              secureTextEntry
              value={value}
              onChangeText={onChange}
              placeholder="••••••••"
            />
            {error && <Text style={styles.error}>{error.message}</Text>}
          </View>
        )}
      />

      {apiError && <Text style={styles.error}>{apiError}</Text>}

      <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={isPending}>
        {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#94a3b8',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  inputError: {
    borderColor: '#f87171',
  },
  error: {
    color: '#f87171',
    marginTop: 6,
  },
  button: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
});
