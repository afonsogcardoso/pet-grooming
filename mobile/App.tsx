import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';
import NewAppointmentScreen from './src/screens/NewAppointmentScreen';
import AppointmentDetailScreen from './src/screens/AppointmentDetailScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import CustomerFormScreen from './src/screens/CustomerFormScreen';
import PetFormScreen from './src/screens/PetFormScreen';
import { useAuthStore } from './src/state/authStore';

const Stack = createNativeStackNavigator();

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    // Hydrate auth token from SecureStore on app start.
    useAuthStore.getState().hydrate().catch((err) => {
      console.error('Failed to hydrate auth:', err);
    });
  }, []);

  if (!hydrated) {
    console.log('App waiting for hydration...');
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }
  
  console.log('App hydrated, token:', token ? 'present' : 'absent');

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <Stack.Navigator>
            {token ? (
              <>
                <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Appointments" component={AppointmentsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="NewAppointment" component={NewAppointmentScreen} options={{ headerShown: false }} />
                <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Customers" component={CustomersScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ headerShown: false }} />
                <Stack.Screen name="CustomerForm" component={CustomerFormScreen} options={{ headerShown: false }} />
                <Stack.Screen name="PetForm" component={PetFormScreen} options={{ headerShown: false }} />
              </>
            ) : (
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
