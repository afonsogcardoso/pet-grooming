import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getAllServices, createService, updateService, deleteService, Service } from '../api/services';
import { ScreenHeader } from '../components/ScreenHeader';
import { Input, Button } from '../components/common';

type Props = NativeStackScreenProps<any, 'ServiceForm'>;

export default function ServiceFormScreen({ route, navigation }: Props) {
  const { mode, serviceId } = route.params as { mode: 'create' | 'edit'; serviceId?: string };
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: services = [] } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: getAllServices,
    enabled: mode === 'edit',
  });

  const service = services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (mode === 'edit' && service) {
      setName(service.name || '');
      setDescription(service.description || '');
      setPrice(service.price?.toString() || '');
      setDuration(service.default_duration?.toString() || '');
      setDisplayOrder(service.display_order?.toString() || '0');
      setActive(service.active !== false);
    }
  }, [mode, service]);

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      Alert.alert('Sucesso', 'Serviço criado com sucesso!');
      navigation.goBack();
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível criar o serviço.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Service> }) => updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      Alert.alert('Sucesso', 'Serviço atualizado com sucesso!');
      navigation.goBack();
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível atualizar o serviço.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      Alert.alert('Sucesso', 'Serviço eliminado com sucesso!');
      navigation.goBack();
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível eliminar o serviço.');
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (price && isNaN(Number(price))) {
      newErrors.price = 'Preço inválido';
    }

    if (duration && isNaN(Number(duration))) {
      newErrors.duration = 'Duração inválida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const serviceData = {
      name: name.trim(),
      description: description.trim() || null,
      price: price ? Number(price) : null,
      default_duration: duration ? Number(duration) : null,
      display_order: displayOrder ? Number(displayOrder) : 0,
      active,
    };

    if (mode === 'create') {
      createMutation.mutate(serviceData);
    } else if (serviceId) {
      updateMutation.mutate({ id: serviceId, data: serviceData });
    }
  };

  const handleDelete = () => {
    if (!serviceId) return;

    Alert.alert(
      'Eliminar Serviço',
      'Tem a certeza que deseja eliminar este serviço? Esta ação não pode ser revertida.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(serviceId),
        },
      ]
    );
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={mode === 'create' ? 'Novo Serviço' : 'Editar Serviço'}
        showBackButton
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          <Input
            label="Nome do Serviço *"
            placeholder="Ex: Banho e Tosquia"
            value={name}
            onChangeText={setName}
            error={errors.name}
          />

          <Input
            label="Descrição"
            placeholder="Descrição do serviço"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
          />

          <Input
            label="Preço (€)"
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            error={errors.price}
            keyboardType="decimal-pad"
          />

          <Input
            label="Duração Padrão (minutos)"
            placeholder="60"
            value={duration}
            onChangeText={setDuration}
            error={errors.duration}
            keyboardType="number-pad"
          />

          <Input
            label="Ordem de Exibição"
            placeholder="0"
            value={displayOrder}
            onChangeText={setDisplayOrder}
            keyboardType="number-pad"
            leftIcon="🔢"
          />

          <View style={styles.switchContainer}>
            <View>
              <Text style={styles.switchLabel}>Serviço Ativo</Text>
              <Text style={styles.switchSubtext}>
                Serviços inativos não aparecem na lista de marcações
              </Text>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: colors.surfaceBorder, true: colors.primary + '40' }}
              thumbColor={active ? colors.primary : colors.muted}
            />
          </View>

          <Button
            title={mode === 'create' ? 'Criar Serviço' : 'Guardar Alterações'}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
          />

          {mode === 'edit' && (
            <Button
              title="Eliminar Serviço"
              onPress={handleDelete}
              loading={deleteMutation.isPending}
              disabled={isLoading}
              variant="danger"
              style={{ marginTop: 16 }}
            />
          )}
        </ScrollView>
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
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    switchSubtext: {
      fontSize: 13,
      color: colors.muted,
      maxWidth: 250,
    },
  });
}
