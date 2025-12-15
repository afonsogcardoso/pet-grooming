import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { createPet, type Pet } from '../api/customers';
import { ScreenHeader } from '../components/ScreenHeader';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

type Props = NativeStackScreenProps<any, 'PetForm'>;

export default function PetFormScreen({ navigation, route }: Props) {
  const params = route.params as { mode: 'create' | 'edit'; customerId: string; petId?: string; pet?: Pet };
  const { mode, customerId, petId, pet } = params;
  
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [name, setName] = useState(pet?.name || '');
  const [breed, setBreed] = useState(pet?.breed || '');
  const [photoUri, setPhotoUri] = useState<string | null>(pet?.photo_url || null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: { name: string; breed?: string | null }) => createPet(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-pets', customerId] });
      Alert.alert('Sucesso', 'Pet adicionado com sucesso!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao adicionar pet');
    },
  });

  const pickImage = async () => {
    try {
      // Import dinâmico apenas quando necessário
      const ImagePicker = await import('expo-image-picker');
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        // TODO: Upload photo to server when editing
      }
    } catch (error) {
      console.log('Error picking image:', error);
      Alert.alert('Aviso', 'Função de upload de fotos temporariamente indisponível');
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    if (mode === 'create') {
      createMutation.mutate({
        name: name.trim(),
        breed: breed.trim() || null,
      });
    } else {
      // TODO: Implement update mutation
      Alert.alert('Em desenvolvimento', 'Edição de pets será implementada em breve');
    }
  };

  const isLoading = createMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={mode === 'create' ? 'Novo Pet' : 'Editar Pet'} showBack={true} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Photo Picker */}
            <View style={styles.photoSection}>
              <Text style={styles.photoLabel}>Foto do Pet</Text>
              <TouchableOpacity style={styles.photoContainer} onPress={pickImage} activeOpacity={0.7}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderIcon}>📷</Text>
                    <Text style={styles.photoPlaceholderText}>Adicionar Foto</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Input
              label="Nome *"
              placeholder="Nome do pet"
              value={name}
              onChangeText={setName}
              error={errors.name}
              leftIcon="🐾"
            />

            <Input
              label="Raça"
              placeholder="Ex: Golden Retriever, Persa..."
              value={breed}
              onChangeText={setBreed}
              error={errors.breed}
              leftIcon="🏷️"
            />

            <View style={styles.hint}>
              <Text style={styles.hintText}>* Campos obrigatórios</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={mode === 'create' ? 'Adicionar Pet' : 'Salvar Alterações'}
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
    photoSection: {
      marginBottom: 24,
      alignItems: 'center',
    },
    photoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      alignSelf: 'flex-start',
    },
    photoContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      borderStyle: 'dashed',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    photoPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoPlaceholderIcon: {
      fontSize: 36,
      marginBottom: 8,
    },
    photoPlaceholderText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: '500',
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
