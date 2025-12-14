import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { useAuthStore } from '../state/authStore';
import { getCustomers, getPetsByCustomer, createCustomer, createPet, type Customer, type Pet } from '../api/customers';

type Props = NativeStackScreenProps<any>;

export default function CustomersScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={[styles.container]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Clientes</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Voltar</Text></TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.placeholder}>Em desenvolvimento</Text>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
    },
    back: {
      fontSize: 16,
      color: colors.muted,
      fontWeight: '600',
    },
    section: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    sectionSubtitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: 10,
      marginBottom: 6,
    },
    placeholder: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.muted,
      textAlign: 'center',
      paddingVertical: 24,
    },
  });
}
