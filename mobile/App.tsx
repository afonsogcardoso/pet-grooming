import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import ServicesScreen from './src/screens/ServicesScreen';
import ServiceFormScreen from './src/screens/ServiceFormScreen';
import { useAuthStore } from './src/state/authStore';
import { Branding, getBranding } from './src/api/branding';
import { getProfile } from './src/api/profile';
import { clearBrandingCache, readBrandingCache, writeBrandingCache } from './src/theme/brandingCache';

const Stack = createNativeStackNavigator();

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [brandingData, setBrandingData] = useState<Branding | null>(null);
  const [brandingStatus, setBrandingStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const loaderColors = useMemo(() => {
    const primary = brandingData?.brand_primary || '#1e40af';
    const background = brandingData?.brand_background || '#ffffff';
    return { primary, background };
  }, [brandingData]);

  useEffect(() => {
    // Hydrate auth token from SecureStore on app start.
    useAuthStore.getState().hydrate().catch((err) => {
      console.error('Failed to hydrate auth:', err);
    });
  }, []);

  useEffect(() => {
    // Reset branding gating on auth changes and clear cache on logout to avoid mixing tenants.
    if (!hydrated) return;
    setBrandingStatus('idle');
    setBrandingData(null);
    if (!token) {
      clearBrandingCache();
    }
  }, [token, hydrated]);

  useEffect(() => {
    if (!hydrated || !token) return;

    let cancelled = false;
    setBrandingStatus('loading');
    setBrandingData(null);

    (async () => {
      const cached = await readBrandingCache();
      if (cached && !cancelled) {
        queryClient.setQueryData(['branding'], cached);
        setBrandingData(cached);
        setBrandingStatus('ready'); // cached branding is enough to render while we fetch fresh
      }

      try {
        const fresh = await getBranding();
        if (cancelled) return;
        queryClient.setQueryData(['branding'], fresh);
        setBrandingData(fresh);
        setBrandingStatus('ready');
        await writeBrandingCache(fresh);
      } catch (err: any) {
        console.warn('Failed to load branding:', err?.message || err);
        if (!cached && !cancelled) {
          setBrandingStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, queryClient]);

  useEffect(() => {
    if (!hydrated || !token) return;
    queryClient
      .ensureQueryData({ queryKey: ['profile'], queryFn: getProfile, staleTime: 1000 * 60 * 2 })
      .catch((err) => console.warn('Failed to prefetch profile:', err?.message || err));
  }, [hydrated, token, queryClient]);

  if (!hydrated || (token && brandingStatus !== 'ready' && brandingStatus !== 'error')) {
    console.log(!hydrated ? 'App waiting for hydration...' : 'App waiting for branding...');
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: loaderColors.background }}>
        <ActivityIndicator size="large" color={loaderColors.primary} />
      </View>
    );
  }
  
  console.log('App hydrated, token:', token ? 'present' : 'absent');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
                <Stack.Screen name="Services" component={ServicesScreen} options={{ headerShown: false }} />
                <Stack.Screen name="ServiceForm" component={ServiceFormScreen} options={{ headerShown: false }} />
              </>
            ) : (
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            )}
          </Stack.Navigator>
          </NavigationContainer>
          <StatusBar style="light" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
