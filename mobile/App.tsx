import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, View } from 'react-native';
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
import { readProfileCache, writeProfileCache } from './src/state/profileCache';
import { bootstrapLanguage, setAppLanguage } from './src/i18n';

const Stack = createNativeStackNavigator();

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [brandingData, setBrandingData] = useState<Branding | null>(null);
  const [previousBranding, setPreviousBranding] = useState<Branding | null>(null);
  const [profileData, setProfileData] = useState<{ email?: string | null; displayName?: string | null; avatarUrl?: string | null } | null>(null);
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const brandingFade = useMemo(() => new Animated.Value(0), []);
  const loaderColors = useMemo(() => {
    const primary = brandingData?.brand_primary || '#F47C1C';
    const background = brandingData?.brand_background || '#FFF7EE';
    return { primary, background };
  }, [brandingData]);

  const isBrandingEqual = (left?: Branding | null, right?: Branding | null) => {
    const keys: (keyof Branding)[] = [
      'account_name',
      'brand_primary',
      'brand_primary_soft',
      'brand_accent',
      'brand_accent_soft',
      'brand_background',
      'brand_gradient',
      'logo_url',
      'portal_image_url',
      'support_email',
      'support_phone',
    ];
    return keys.every((key) => (left?.[key] ?? null) === (right?.[key] ?? null));
  };

  useEffect(() => {
    // Hydrate auth token from SecureStore on app start.
    useAuthStore.getState().hydrate().catch((err) => {
      console.error('Failed to hydrate auth:', err);
    });
  }, []);

  useEffect(() => {
    bootstrapLanguage().catch(() => null);
  }, []);

  useEffect(() => {
    // Reset branding gating on auth changes and clear cache on logout to avoid mixing tenants.
    if (!hydrated) return;
    setBrandingData(null);
    setProfileData(null);
    if (!token) {
      clearBrandingCache();
    }
  }, [token, hydrated]);

  useEffect(() => {
    if (!hydrated || !token) return;

    let cancelled = false;
    setBrandingData(null);

    (async () => {
      const cached = await readBrandingCache();
      if (cached && !cancelled) {
        queryClient.setQueryData(['branding'], cached);
        setBrandingData(cached);
      }

      try {
        const fresh = await getBranding();
        if (cancelled) return;
        const shouldAnimate = Boolean(brandingData) && !isBrandingEqual(brandingData, fresh);
        if (shouldAnimate) {
          setPreviousBranding(brandingData);
          brandingFade.setValue(1);
        }
        queryClient.setQueryData(['branding'], fresh);
        setBrandingData(fresh);
        await writeBrandingCache(fresh);
        if (shouldAnimate) {
          Animated.timing(brandingFade, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }).start(() => {
            setPreviousBranding(null);
          });
        }
      } catch (err: any) {
        console.warn('Failed to load branding:', err?.message || err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, queryClient]);

  useEffect(() => {
    if (!hydrated || !token) return;

    let cancelled = false;
    setProfileData(null);

    (async () => {
      const cached = await readProfileCache();
      if (cached && !cancelled) {
        setProfileData(cached);
        useAuthStore.getState().setUser(cached);
        queryClient.setQueryData(['profile'], cached);
        if (cached.locale) {
          setAppLanguage(cached.locale);
        }
      }

      try {
        const fresh = await getProfile();
        if (cancelled) return;
        setProfileData(fresh);
        useAuthStore.getState().setUser({
          email: fresh.email,
          displayName: fresh.displayName,
          avatarUrl: fresh.avatarUrl,
        });
        queryClient.setQueryData(['profile'], fresh);
        await writeProfileCache({
          email: fresh.email,
          displayName: fresh.displayName,
          avatarUrl: fresh.avatarUrl,
        });
        if (fresh.locale) {
          setAppLanguage(fresh.locale);
        }
      } catch (err: any) {
        console.warn('Failed to load profile:', err?.message || err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, queryClient]);

  const showLoader = !hydrated || (token && (!brandingData || !profileData));

  if (showLoader) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: loaderColors.background }}>
        <ActivityIndicator size="large" color={loaderColors.primary} />
      </View>
    );
  }

  const overlayBackground = previousBranding?.brand_background || '#FFF7EE';

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
          {previousBranding ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: overlayBackground,
                opacity: brandingFade,
              }}
            />
          ) : null}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
