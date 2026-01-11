import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import { getAllServices, Service } from "../api/services";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/common";
import { UndoToast } from "../components/common/UndoToast";
import SwipeableRow from "../components/common/SwipeableRow";
import { deleteService } from "../api/services";
import { useTranslation } from "react-i18next";
import { hapticError, hapticSuccess, hapticWarning } from "../utils/haptics";
import { getCardVariants } from "../theme/uiTokens";
import { useSwipeDeleteIndicator } from "../hooks/useSwipeDeleteIndicator";
import { SearchField } from "../components/common/SearchField";

type Props = NativeStackScreenProps<any>;
type DeletePayload = {
  service: Service;
  index: number;
};
const UNDO_TIMEOUT_MS = 4000;

export default function ServicesScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const undoBottomOffset = Math.max(18, insets.bottom + 16);
  const [undoVisible, setUndoVisible] = useState(false);
  const { deletingId, beginDelete, clearDeletingId } =
    useSwipeDeleteIndicator();
  const pendingDeleteRef = useRef<DeletePayload | null>(null);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", "all"],
    queryFn: getAllServices,
  });

  const restoreService = useCallback(
    (payload: DeletePayload) => {
      queryClient.setQueryData(
        ["services", "all"],
        (old: Service[] | undefined) => {
          if (!old) return old;
          if (old.some((item) => item.id === payload.service.id)) return old;
          const nextItems = [...old];
          const insertIndex = Math.min(
            Math.max(payload.index, 0),
            nextItems.length
          );
          nextItems.splice(insertIndex, 0, payload.service);
          return nextItems;
        }
      );
    },
    [queryClient]
  );

  const deleteServiceMutation = useMutation({
    mutationFn: ({ service }: DeletePayload) => deleteService(service.id),
    onSuccess: () => {
      hapticSuccess();
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ["services", "all"] });
      }
    },
    onError: (err: any, variables) => {
      hapticError();
      if (variables) {
        restoreService(variables);
      }
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ["services", "all"] });
      }
      Alert.alert(
        t("common.error"),
        err?.response?.data?.error || err.message || t("services.deleteError")
      );
    },
  });

  const commitPendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    deleteServiceMutation.mutate(pending);
  }, [clearDeletingId, deleteServiceMutation]);

  const startOptimisticDelete = useCallback(
    (service: Service) => {
      if (pendingDeleteRef.current) {
        commitPendingDelete();
      }

      const cached = queryClient.getQueryData<Service[]>(["services", "all"]);
      const index = cached
        ? cached.findIndex((item) => item.id === service.id)
        : -1;

      queryClient.setQueryData(
        ["services", "all"],
        (old: Service[] | undefined) => {
          if (!old) return old;
          if (!old.some((item) => item.id === service.id)) return old;
          return old.filter((item) => item.id !== service.id);
        }
      );

      pendingDeleteRef.current = { service, index: Math.max(index, 0) };
      setUndoVisible(true);
    },
    [commitPendingDelete, queryClient]
  );

  const handleUndo = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    restoreService(pending);
  }, [clearDeletingId, restoreService]);

  useEffect(() => {
    return () => {
      const pending = pendingDeleteRef.current;
      if (!pending) return;
      pendingDeleteRef.current = null;
      deleteServiceMutation.mutate(pending);
    };
  }, [deleteServiceMutation]);

  const filteredServices = useMemo(() => {
    const data = (services || [])
      .slice()
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const q = searchQuery.toLowerCase().trim();
    return data.filter((service) => {
      if (!q) return true;
      const searchValues = [
        service.name,
        service.description,
        service.category,
        service.subcategory,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());
      return searchValues.some((value) => value.includes(q));
    });
  }, [services, searchQuery]);

  const handleNewService = () =>
    navigation.navigate("ServiceForm", { mode: "create" });
  const handleEditService = (service: Service) =>
    navigation.navigate("ServiceForm", { mode: "edit", serviceId: service.id });

  const renderServiceItem = ({ item }: { item: Service }) => (
    <SwipeableRow
      isDeleting={item.id === deletingId}
      onDelete={() =>
        Alert.alert(
          t("services.deleteTitle"),
          t("services.deletePrompt", { name: item.name }),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("services.deleteAction"),
              style: "destructive",
              onPress: () => {
                hapticWarning();
                beginDelete(item.id, () => startOptimisticDelete(item));
              },
            },
          ]
        )
      }
    >
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={() => handleEditService(item)}
        activeOpacity={0.7}
      >
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.serviceImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.serviceImagePlaceholder}>
            <Text style={styles.serviceImageInitial}>
              {item.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}
        <View style={styles.serviceInfo}>
          <View style={styles.serviceHeader}>
            <Text style={styles.serviceName}>{item.name}</Text>
            {!item.active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>
                  {t("services.inactive")}
                </Text>
              </View>
            )}
          </View>
          {item.description && (
            <Text style={styles.serviceDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          {(item.category || item.subcategory) && (
            <View style={styles.tagRow}>
              {item.category && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.category}</Text>
                </View>
              )}
              {item.subcategory && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.subcategory}</Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.serviceDetails}>
            {item.price != null && (
              <Text style={styles.detailText}>{item.price.toFixed(2)}€</Text>
            )}
            {item.default_duration != null && (
              <Text style={styles.detailText}>
                {item.default_duration}
                {t("common.minutesShort")}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </SwipeableRow>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title={t("services.title")} showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <UndoToast
          visible={undoVisible}
          message={t("services.deleteUndoMessage")}
          actionLabel={t("services.deleteUndoAction")}
          onAction={handleUndo}
          onTimeout={commitPendingDelete}
          onDismiss={commitPendingDelete}
          durationMs={UNDO_TIMEOUT_MS}
          bottomOffset={undoBottomOffset}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("services.title")}
        showBack
        rightElement={
          <TouchableOpacity
            onPress={handleNewService}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>+</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <SearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("services.searchPlaceholder")}
          />
        </View>

        {filteredServices.length === 0 ? (
          <EmptyState
            icon={searchQuery ? "🔍" : "🛎️"}
            title={
              searchQuery
                ? t("services.emptySearchTitle")
                : t("services.emptyTitle")
            }
            description={
              searchQuery
                ? t("services.emptySearchDescription")
                : t("services.emptyDescription")
            }
            actionLabel={!searchQuery ? t("services.addService") : undefined}
            onAction={!searchQuery ? handleNewService : undefined}
          />
        ) : (
          <FlatList
            data={filteredServices}
            keyExtractor={(item) => item.id}
            renderItem={renderServiceItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
      <UndoToast
        visible={undoVisible}
        message={t("services.deleteUndoMessage")}
        actionLabel={t("services.deleteUndoAction")}
        onAction={handleUndo}
        onTimeout={commitPendingDelete}
        onDismiss={commitPendingDelete}
        durationMs={UNDO_TIMEOUT_MS}
        bottomOffset={undoBottomOffset}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  const { listItem } = getCardVariants(colors);
  const placeholderBg =
    colors.primarySoft && colors.primarySoft !== colors.surface
      ? colors.primarySoft
      : colors.primary
      ? `${colors.primary}12`
      : colors.surfaceBorder;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingTop: 12,
    },
    searchContainer: {
      height: 44,
      justifyContent: "center",
      marginBottom: 0,
      paddingHorizontal: 16,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 20,
    },
    itemSeparator: {
      height: 12,
    },
    serviceCard: {
      ...listItem,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 18,
    },
    serviceImage: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.background,
    },
    serviceImagePlaceholder: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: placeholderBg,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    serviceImageInitial: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.primary,
    },
    serviceInfo: {
      flex: 1,
      gap: 6,
    },
    serviceHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    serviceName: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    inactiveBadge: {
      backgroundColor: colors.muted + "20",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    inactiveBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.muted,
    },
    serviceDescription: {
      fontSize: 14,
      color: colors.muted,
      lineHeight: 20,
    },
    serviceDetails: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    tagRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    tagText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    detailText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    actionButtonText: {
      fontSize: 28,
      fontWeight: "300",
      color: "#ffffff",
      lineHeight: 28,
    },
  });
}
