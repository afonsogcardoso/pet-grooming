import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { createCustomer, updateCustomer, type Customer } from '../api/customers';
import { ScreenHeader } from '../components/ScreenHeader';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

type Props = NativeStackScreenProps<any, 'CustomerForm'>;

export default function CustomerFormScreen({ navigation, route }: Props) {
  const params = route.params as { mode: 'create' | 'edit'; customerId?: string; customer?: Customer };
  const { mode, customerId, customer } = params;
  
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [nif, setNif] = useState(customer?.nif || '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      Alert.alert('Sucesso', 'Cliente criado com sucesso!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao criar cliente');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { phone?: string | null; address?: string | null; nif?: string | null }) =>
      updateCustomer(customerId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-pets', customerId] });
      Alert.alert('Sucesso', 'Cliente atualizado com sucesso!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao atualizar cliente');
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido';
    }

    if (phone && !/^\d{9,}$/.test(phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Telefone inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    if (mode === 'create') {
      createMutation.mutate({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        nif: nif.trim() || null,
      });
    } else {
      updateMutation.mutate({
        phone: phone.trim() || null,
        address: address.trim() || null,
        nif: nif.trim() || null,
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={mode === 'create' ? 'Novo Cliente' : 'Editar Cliente'} showBack={true} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <Input
              label="Nome *"
              placeholder="Nome completo"
              value={name}
              onChangeText={setName}
              error={errors.name}
              leftIcon="👤"
              editable={mode === 'create'}
            />

            <Input
              label="Telefone"
              placeholder="+351 912 345 678"
              value={phone}
              onChangeText={setPhone}
              error={errors.phone}
              leftIcon="📱"
              keyboardType="phone-pad"
            />

            <Input
              label="Email"
              placeholder="exemplo@email.com"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              leftIcon="✉️"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={mode === 'create'}
            />

            <Input
              label="Endereço"
              placeholder="Rua, número, cidade"
              value={address}
              onChangeText={setAddress}
              error={errors.address}
              leftIcon="📍"
              multiline
              numberOfLines={3}
            />

            <Input
              label="NIF"
              placeholder="123456789"
              value={nif}
              onChangeText={setNif}
              error={errors.nif}
              leftIcon="🆔"
              keyboardType="number-pad"
            />

            {mode === 'create' && (
              <View style={styles.hint}>
                <Text style={styles.hintText}>* Campos obrigatórios</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={mode === 'create' ? 'Criar Cliente' : 'Salvar Alterações'}
            onPress={handleSubmit}
            variant="primary"
            size="large"
            loading={isLoading}
            disabled={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    form: {
      paddingTop: 20,
      paddingBottom: 100,
    },
    hint: {
      marginTop: 8,
    },
    hintText: {
      fontSize: 13,
      color: colors.muted,
      fontStyle: 'italic',
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
  });
}
