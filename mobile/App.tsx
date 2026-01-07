import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  View,
  TouchableOpacity,
} from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import AppointmentsScreen from "./src/screens/AppointmentsScreen";
import NewAppointmentScreen from "./src/screens/NewAppointmentScreen";
import AppointmentDetailScreen from "./src/screens/AppointmentDetailScreen";
import CustomersScreen from "./src/screens/CustomersScreen";
import CustomerDetailScreen from "./src/screens/CustomerDetailScreen";
import CustomerFormScreen from "./src/screens/CustomerFormScreen";
import PetFormScreen from "./src/screens/PetFormScreen";
import ServicesScreen from "./src/screens/ServicesScreen";
import ServiceFormScreen from "./src/screens/ServiceFormScreen";
import ConsumerHomeScreen from "./src/screens/ConsumerHomeScreen";
import ConsumerAppointmentsScreen from "./src/screens/ConsumerAppointmentsScreen";
import ConsumerAppointmentDetailScreen from "./src/screens/ConsumerAppointmentDetailScreen";
import ConsumerPetsScreen from "./src/screens/ConsumerPetsScreen";
import ConsumerPetFormScreen from "./src/screens/ConsumerPetFormScreen";
import MarketplaceScreen from "./src/screens/MarketplaceScreen";
import MarketplaceAccountScreen from "./src/screens/MarketplaceAccountScreen";
import MarketplaceRequestScreen from "./src/screens/MarketplaceRequestScreen";
import { useAuthStore } from "./src/state/authStore";
import { useViewModeStore } from "./src/state/viewModeStore";
import { Branding, getBranding } from "./src/api/branding";
import { getProfile } from "./src/api/profile";
import {
  clearBrandingCache,
  readBrandingCache,
  writeBrandingCache,
} from "./src/theme/brandingCache";
import { readProfileCache, writeProfileCache } from "./src/state/profileCache";
import { bootstrapLanguage, setAppLanguage } from "./src/i18n";
import { configureNotificationHandler } from "./src/utils/pushNotifications";
import { useBrandingTheme } from "./src/theme/useBrandingTheme";

const RootStack = createNativeStackNavigator();
const ProviderTab = createBottomTabNavigator();
const ConsumerTab = createBottomTabNavigator();

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
};

configureNotificationHandler();

function parseHex(input?: string | null) {
  if (!input) return null;
  const hex = input.trim().replace("#", "");
  if (![3, 6].includes(hex.length)) return null;
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const int = Number.parseInt(normalized, 16);
  if (Number.isNaN(int)) return null;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return { r, g, b };
}

function normalizeColor(input?: string | null) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const named = NAMED_COLORS[trimmed.toLowerCase()];
  return named || trimmed;
}

function isLightColor(input?: string | null) {
  const normalized = normalizeColor(input);
  if (!normalized) return false;
  const rgb = parseHex(normalized);
  if (!rgb) return normalized.toLowerCase() === "white";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.65;
}

function extractAppointmentId(data: any) {
  if (!data || typeof data !== "object") return null;
  const candidate =
    data.appointmentId || data.appointment_id || data.appointmentID;
  if (!candidate) return null;
  return candidate.toString();
}

function ProviderTabs() {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const TabButton = ({
    children,
    accessibilityState,
    onPress,
    onLongPress,
  }: any) => {
    const focused = accessibilityState?.selected;
    const scale = useRef(new Animated.Value(focused ? 1.05 : 1)).current;

    useEffect(() => {
      Animated.spring(scale, {
        toValue: focused ? 1.05 : 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }, [focused, scale]);

    const handlePressIn = () => {
      Animated.spring(scale, {
        toValue: 1.08,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scale, {
        toValue: focused ? 1.05 : 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View
        style={{ flex: 1, height: "100%", transform: [{ scale }] }}
      >
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          style={[
            {
              flex: 1,
              marginHorizontal: 0,
              paddingVertical: 6,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              height: "100%",
            },
            focused
              ? {
                  backgroundColor: colors.primarySoft,
                  borderWidth: 1,
                  borderColor: colors.primarySoft,
                }
              : null,
          ]}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    Home: "home",
    Appointments: "calendar",
    Customers: "people",
    Services: "cut",
    Profile: "person",
  };

  return (
    <ProviderTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: colors.surfaceBorder,
          height: 58 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 6,
          paddingHorizontal: 0,
          shadowColor: "transparent",
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarIcon: ({ color, size }) => {
          const name = icons[route.name] || "ellipse";
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <ProviderTab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: t("tabs.home") }}
      />
      <ProviderTab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ tabBarLabel: t("tabs.appointments") }}
      />
      <ProviderTab.Screen
        name="Customers"
        component={CustomersScreen}
        options={{ tabBarLabel: t("tabs.customers") }}
      />
      <ProviderTab.Screen
        name="Services"
        component={ServicesScreen}
        options={{ tabBarLabel: t("tabs.services") }}
      />
      <ProviderTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: t("tabs.profile") }}
      />
    </ProviderTab.Navigator>
  );
}

function ConsumerTabs() {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const TabButton = ({
    children,
    accessibilityState,
    onPress,
    onLongPress,
  }: any) => {
    const focused = accessibilityState?.selected;
    const scale = useRef(new Animated.Value(focused ? 1.05 : 1)).current;

    useEffect(() => {
      Animated.spring(scale, {
        toValue: focused ? 1.05 : 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }, [focused, scale]);

    const handlePressIn = () => {
      Animated.spring(scale, {
        toValue: 1.08,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scale, {
        toValue: focused ? 1.05 : 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    };
    return (
      <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          style={[
            {
              flex: 1,
              marginHorizontal: 6,
              paddingVertical: 10,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
            },
            focused
              ? {
                  backgroundColor: colors.primarySoft,
                  borderWidth: 1,
                  borderColor: colors.primarySoft,
                }
              : null,
          ]}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    ConsumerHome: "home",
    Marketplace: "storefront",
    ConsumerAppointments: "calendar",
    ConsumerPets: "paw",
    Profile: "person",
  };

  return (
    <ConsumerTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: colors.surfaceBorder,
          height: 58 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 6,
          paddingHorizontal: 0,
          shadowColor: "transparent",
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: 600,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarIcon: ({ color, size }) => {
          const name = icons[route.name] || "ellipse";
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <ConsumerTab.Screen
        name="ConsumerHome"
        component={ConsumerHomeScreen}
        options={{ tabBarLabel: t("tabs.home") }}
      />
      <ConsumerTab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ tabBarLabel: t("tabs.marketplace") }}
      />
      <ConsumerTab.Screen
        name="ConsumerAppointments"
        component={ConsumerAppointmentsScreen}
        options={{ tabBarLabel: t("tabs.appointments") }}
      />
      <ConsumerTab.Screen
        name="ConsumerPets"
        component={ConsumerPetsScreen}
        options={{ tabBarLabel: t("tabs.pets") }}
      />
      <ConsumerTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: t("tabs.profile") }}
      />
    </ConsumerTab.Navigator>
  );
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const navigationRef = useMemo(() => createNavigationContainerRef(), []);
  const pendingNavigationRef = useRef<{
    route: string;
    params: { id: string };
  } | null>(null);
  const [brandingData, setBrandingData] = useState<Branding | null>(null);
  const [previousBranding, setPreviousBranding] = useState<Branding | null>(
    null
  );
  const [profileData, setProfileData] = useState<{
    email?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    activeRole?: "consumer" | "provider" | null;
    availableRoles?: Array<"consumer" | "provider">;
  } | null>(null);
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const storedActiveRole = useAuthStore((s) => s.user?.activeRole);
  const viewMode = useViewModeStore((s) => s.viewMode);
  const viewModeHydrated = useViewModeStore((s) => s.hydrated);
  const brandingFade = useMemo(() => new Animated.Value(0), []);
  const loaderColors = useMemo(() => {
    const primary = brandingData?.brand_primary || "#1F6FEB";
    const background = brandingData?.brand_background || "#F6F9FF";
    return { primary, background };
  }, [brandingData]);

  const isBrandingEqual = (left?: Branding | null, right?: Branding | null) => {
    const keys: (keyof Branding)[] = [
      "account_name",
      "brand_primary",
      "brand_primary_soft",
      "brand_accent",
      "brand_accent_soft",
      "brand_background",
      "brand_gradient",
      "logo_url",
      "portal_image_url",
      "support_email",
      "support_phone",
    ];
    return keys.every(
      (key) => (left?.[key] ?? null) === (right?.[key] ?? null)
    );
  };

  useEffect(() => {
    // Hydrate auth token from SecureStore on app start.
    useAuthStore
      .getState()
      .hydrate()
      .catch((err) => {
        console.error("Failed to hydrate auth:", err);
      });
  }, []);

  useEffect(() => {
    useViewModeStore
      .getState()
      .hydrate()
      .catch((err) => {
        console.error("Failed to hydrate view mode:", err);
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
        queryClient.setQueryData(["branding"], cached);
        setBrandingData(cached);
      }

      try {
        const fresh = await getBranding();
        if (cancelled) return;
        const shouldAnimate =
          Boolean(brandingData) && !isBrandingEqual(brandingData, fresh);
        if (shouldAnimate) {
          setPreviousBranding(brandingData);
          brandingFade.setValue(1);
        }
        queryClient.setQueryData(["branding"], fresh);
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
        console.warn("Failed to load branding:", err?.message || err);
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
        useAuthStore.getState().setUser({
          email: cached.email,
          displayName: cached.displayName,
          avatarUrl: cached.avatarUrl,
          firstName: cached.firstName,
          lastName: cached.lastName,
          activeRole: cached.activeRole,
        });
        queryClient.setQueryData(["profile"], cached);
        const cachedLocale = (cached as any).locale;
        if (cachedLocale) {
          setAppLanguage(cachedLocale);
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
          firstName: fresh.firstName,
          lastName: fresh.lastName,
          activeRole: fresh.activeRole,
        });
        queryClient.setQueryData(["profile"], fresh);
        await writeProfileCache({
          email: fresh.email,
          displayName: fresh.displayName,
          avatarUrl: fresh.avatarUrl,
          firstName: fresh.firstName,
          lastName: fresh.lastName,
          activeRole: fresh.activeRole,
          availableRoles: fresh.availableRoles,
        });
        const freshLocale = (fresh as any).locale;
        if (freshLocale) {
          setAppLanguage(freshLocale);
        }
      } catch (err: any) {
        console.warn("Failed to load profile:", err?.message || err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, queryClient]);

  const activeRole = storedActiveRole ?? profileData?.activeRole ?? "provider";
  const appMode =
    viewMode ?? (activeRole === "consumer" ? "consumer" : "private");
  const appModeRef = useRef(appMode);
  const tokenRef = useRef(token);

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse | null | undefined) => {
      if (!response) return;
      if (!tokenRef.current) return;
      const data = response.notification?.request?.content?.data;
      const appointmentId = extractAppointmentId(data);
      if (!appointmentId) return;

      const route =
        appModeRef.current === "consumer"
          ? "ConsumerAppointmentDetail"
          : "AppointmentDetail";
      const params = { id: appointmentId };

      if (navigationRef.isReady()) {
        (navigationRef as any).navigate(route, params);
      } else {
        pendingNavigationRef.current = { route, params };
      }
    },
    [navigationRef]
  );

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleNotificationResponse(response);
      })
      .catch(() => null);
    return () => subscription.remove();
  }, [handleNotificationResponse]);

  const showLoader =
    !hydrated ||
    (token && (!brandingData || !profileData || !viewModeHydrated));

  if (showLoader) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: loaderColors.background,
        }}
      >
        <ActivityIndicator size="large" color={loaderColors.primary} />
      </View>
    );
  }

  const overlayBackground = previousBranding?.brand_background || "#F6F9FF";
  const statusBarBackground =
    brandingData?.brand_background || overlayBackground || "#F6F9FF";
  const statusBarStyle = isLightColor(statusBarBackground) ? "dark" : "light";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer
            key={appMode}
            ref={navigationRef}
            onReady={() => {
              const pending = pendingNavigationRef.current;
              if (pending && navigationRef.isReady()) {
                pendingNavigationRef.current = null;
                (navigationRef as any).navigate(pending.route, pending.params);
              }
            }}
          >
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
              {token ? (
                appMode === "consumer" ? (
                  <>
                    <RootStack.Screen
                      name="ConsumerTabs"
                      component={ConsumerTabs}
                    />
                    <RootStack.Screen
                      name="ConsumerAppointmentDetail"
                      component={ConsumerAppointmentDetailScreen}
                    />
                    <RootStack.Screen
                      name="ConsumerPetForm"
                      component={ConsumerPetFormScreen}
                    />
                    <RootStack.Screen
                      name="MarketplaceAccount"
                      component={MarketplaceAccountScreen}
                    />
                    <RootStack.Screen
                      name="MarketplaceRequest"
                      component={MarketplaceRequestScreen}
                    />
                  </>
                ) : (
                  <>
                    <RootStack.Screen
                      name="ProviderTabs"
                      component={ProviderTabs}
                    />
                    <RootStack.Screen
                      name="NewAppointment"
                      component={NewAppointmentScreen}
                    />
                    <RootStack.Screen
                      name="AppointmentDetail"
                      component={AppointmentDetailScreen}
                    />
                    <RootStack.Screen
                      name="CustomerDetail"
                      component={CustomerDetailScreen}
                    />
                    <RootStack.Screen
                      name="CustomerForm"
                      component={CustomerFormScreen}
                    />
                    <RootStack.Screen
                      name="PetForm"
                      component={PetFormScreen}
                    />
                    <RootStack.Screen
                      name="ServiceForm"
                      component={ServiceFormScreen}
                    />
                  </>
                )
              ) : (
                <>
                  <RootStack.Screen name="Login" component={LoginScreen} />
                  <RootStack.Screen
                    name="Register"
                    component={RegisterScreen}
                  />
                </>
              )}
            </RootStack.Navigator>
          </NavigationContainer>
          <StatusBar
            style={statusBarStyle}
            backgroundColor={statusBarBackground}
          />
          {previousBranding ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
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
