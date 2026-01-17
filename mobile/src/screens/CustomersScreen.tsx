import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import { getCardStyle, getSegmentStyles } from "../theme/uiTokens";
import { getCustomers, type Customer, type Pet } from "../api/customers";
import { ScreenHeader } from "../components/ScreenHeader";
import SwipeableRow from "../components/common/SwipeableRow";
import { deleteCustomer } from "../api/customers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { EmptyState } from "../components/common/EmptyState";
import { UndoToast } from "../components/common/UndoToast";
import { CustomerCard } from "../components/customers/CustomerCard";
import { SearchField } from "../components/common/SearchField";
import { matchesSearchQuery } from "../utils/textHelpers";
import { formatCustomerName } from "../utils/customer";
import { useTranslation } from "react-i18next";
import { hapticError, hapticSuccess, hapticWarning } from "../utils/haptics";
import { useSwipeDeleteIndicator } from "../hooks/useSwipeDeleteIndicator";
import { getPetSpecies } from "../api/petAttributes";

type Props = NativeStackScreenProps<any>;
type DeletePayload = {
  customer: Customer;
  index: number;
};
type PetListItem = Pet & { ownerId: string; ownerName: string };
const UNDO_TIMEOUT_MS = 4000;

export default function CustomersScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"customers" | "pets">("customers");
  const insets = useSafeAreaInsets();
  const undoBottomOffset = Math.max(18, insets.bottom + 16);
  const customersListRef = useRef<FlatList<Customer>>(null);
  const petsListRef = useRef<FlatList<PetListItem>>(null);

  const {
    data: customers = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

  const { data: species = [] } = useQuery({
    queryKey: ["pet-species"],
    queryFn: getPetSpecies,
  });

  const queryClient = useQueryClient();
  const [undoVisible, setUndoVisible] = useState(false);
  const { deletingId, beginDelete, clearDeletingId } =
    useSwipeDeleteIndicator();
  const pendingDeleteRef = useRef<DeletePayload | null>(null);
  const restoreCustomer = useCallback(
    (payload: DeletePayload) => {
      queryClient.setQueryData(["customers"], (old: Customer[] | undefined) => {
        if (!old) return old;
        if (old.some((item) => item.id === payload.customer.id)) return old;
        const nextItems = [...old];
        const insertIndex = Math.min(
          Math.max(payload.index, 0),
          nextItems.length
        );
        nextItems.splice(insertIndex, 0, payload.customer);
        return nextItems;
      });
    },
    [queryClient]
  );

  const deleteMutation = useMutation({
    mutationFn: ({ customer }: DeletePayload) => deleteCustomer(customer.id),
    onSuccess: () => {
      hapticSuccess();
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
    },
    onError: (err: any, variables) => {
      hapticError();
      if (variables) {
        restoreCustomer(variables);
      }
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
      Alert.alert(
        t("common.error"),
        err?.response?.data?.error || err.message || t("customers.deleteError")
      );
    },
  });

  const commitPendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    deleteMutation.mutate(pending);
  }, [clearDeletingId, deleteMutation]);

  const startOptimisticDelete = useCallback(
    (customer: Customer) => {
      if (pendingDeleteRef.current) {
        commitPendingDelete();
      }

      const cached = queryClient.getQueryData<Customer[]>(["customers"]);
      const index = cached
        ? cached.findIndex((item) => item.id === customer.id)
        : -1;

      queryClient.setQueryData(["customers"], (old: Customer[] | undefined) => {
        if (!old) return old;
        if (!old.some((item) => item.id === customer.id)) return old;
        return old.filter((item) => item.id !== customer.id);
      });

      pendingDeleteRef.current = { customer, index: Math.max(index, 0) };
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
    restoreCustomer(pending);
  }, [clearDeletingId, restoreCustomer]);

  useEffect(() => {
    return () => {
      const pending = pendingDeleteRef.current;
      if (!pending) return;
      pendingDeleteRef.current = null;
      deleteMutation.mutate(pending);
    };
  }, [deleteMutation]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    return customers.filter((c) => {
      const nameValue = formatCustomerName(c);
      return (
        (nameValue && matchesSearchQuery(nameValue, searchQuery)) ||
        (c.phone && matchesSearchQuery(c.phone, searchQuery)) ||
        (c.email && matchesSearchQuery(c.email, searchQuery)) ||
        (c.pets &&
          c.pets.some(
            (pet) => pet.name && matchesSearchQuery(pet.name, searchQuery)
          ))
      );
    });
  }, [customers, searchQuery]);

  const speciesNameById = useMemo(() => {
    const map = new Map<string, string>();
    species.forEach((item) => {
      map.set(item.id, item.name);
    });
    return map;
  }, [species]);

  const allPets = useMemo(() => {
    const list: PetListItem[] = [];
    customers.forEach((customer) => {
      const ownerName = formatCustomerName(customer) || t("common.unknown");
      (customer.pets || []).forEach((pet) => {
        list.push({ ...pet, ownerId: customer.id, ownerName });
      });
    });
    const filtered = searchQuery.trim()
      ? list.filter((pet) => {
          return (
            (pet.name && matchesSearchQuery(pet.name, searchQuery)) ||
            (pet.breed && matchesSearchQuery(pet.breed, searchQuery)) ||
            (pet.ownerName && matchesSearchQuery(pet.ownerName, searchQuery))
          );
        })
      : list;

    return filtered.sort((a, b) => {
      const an = (a.name || "").toLowerCase();
      const bn = (b.name || "").toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
  }, [customers, searchQuery, t]);

  useEffect(() => {
    if (activeTab === "customers") {
      customersListRef.current?.scrollToOffset({ offset: 0, animated: false });
    } else {
      petsListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [activeTab]);

  const handleAddCustomer = () => {
    navigation.navigate("CustomerForm", { mode: "create" });
  };

  const handleCustomerPress = (customer: Customer) => {
    navigation.navigate("CustomerDetail", { customerId: customer.id });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("customers.title")}
        showBack={true}
        rightElement={
          <TouchableOpacity
            onPress={handleAddCustomer}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>+</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <SearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("customers.searchPlaceholder")}
          />
        </View>

        <View style={styles.segment}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === "customers" && styles.segmentButtonActive,
            ]}
            onPress={() => setActiveTab("customers")}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === "customers" && styles.segmentTextActive,
              ]}
            >
              {t("customers.tabCustomers")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === "pets" && styles.segmentButtonActive,
            ]}
            onPress={() => setActiveTab("pets")}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === "pets" && styles.segmentTextActive,
              ]}
            >
              {t("customers.tabPets")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lists */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : activeTab === "customers" ? (
          filteredCustomers.length === 0 ? (
            <EmptyState
              icon={searchQuery ? "🔍" : "👥"}
              title={
                searchQuery
                  ? t("customers.emptySearchTitle")
                  : t("customers.emptyTitle")
              }
              description={
                searchQuery
                  ? t("customers.emptySearchDescription")
                  : t("customers.emptyDescription")
              }
              actionLabel={
                !searchQuery ? t("customers.addCustomer") : undefined
              }
              onAction={!searchQuery ? handleAddCustomer : undefined}
            />
          ) : (
            <FlatList
              ref={customersListRef}
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SwipeableRow
                  isDeleting={item.id === deletingId}
                  onDelete={() => {
                    const displayName = formatCustomerName(item);
                    Alert.alert(
                      t("customers.deleteTitle"),
                      t("customers.deletePrompt", { name: displayName }),
                      [
                        { text: t("common.cancel"), style: "cancel" },
                        {
                          text: t("customers.deleteAction"),
                          style: "destructive",
                          onPress: () => {
                            hapticWarning();
                            beginDelete(item.id, () =>
                              startOptimisticDelete(item)
                            );
                          },
                        },
                      ]
                    );
                  }}
                >
                  <CustomerCard
                    customer={item}
                    onPress={() => handleCustomerPress(item)}
                  />
                </SwipeableRow>
              )}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => (
                <View style={styles.itemSeparator} />
              )}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              refreshing={!!isFetching}
              onRefresh={() => refetch()}
            />
          )
        ) : allPets.length === 0 ? (
          <EmptyState
            icon={searchQuery ? "🔍" : "🐾"}
            title={
              searchQuery
                ? t("customers.emptyPetsSearchTitle")
                : t("customers.emptyPetsTitle")
            }
            description={
              searchQuery
                ? t("customers.emptyPetsSearchDescription")
                : t("customers.emptyPetsDescription")
            }
          />
        ) : (
          <FlatList
            ref={petsListRef}
            data={allPets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.petCard}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate("PetForm", {
                    mode: "edit",
                    customerId: item.ownerId,
                    petId: item.id,
                    pet: item,
                  })
                }
              >
                {item.photo_url ? (
                  <Image
                    source={{ uri: item.photo_url }}
                    style={styles.petImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.petPlaceholder}>
                    <Text style={styles.petPlaceholderIcon}>🐾</Text>
                  </View>
                )}
                <View style={styles.petInfo}>
                  <Text style={styles.petName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.petOwner} numberOfLines={1}>
                    {item.ownerName}
                  </Text>
                  <Text style={styles.petMeta} numberOfLines={1}>
                    {`${
                      speciesNameById.get(item.species_id || "") ||
                      t("common.unknown")
                    } | ${item.breed || t("common.noData")}`}
                  </Text>
                  <Text style={styles.petMeta} numberOfLines={1}>
                    {typeof item.weight === "number"
                      ? t("appointmentForm.petWeightInline", {
                          value: item.weight,
                        })
                      : t("appointmentForm.petWeightPlaceholder")}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshing={!!isFetching}
            onRefresh={() => refetch()}
          />
        )}
      </View>
      <UndoToast
        visible={undoVisible}
        message={t("customers.deleteUndoMessage")}
        actionLabel={t("customers.deleteUndoAction")}
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
  const cardBase = getCardStyle(colors);
  const segment = getSegmentStyles(colors);
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
    segment: {
      ...segment.container,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      paddingVertical: 2,
    },
    segmentButton: {
      ...segment.button,
      flex: 1,
      paddingVertical: 12,
    },
    segmentButtonActive: {
      ...segment.buttonActive,
    },
    segmentText: {
      ...segment.text,
      fontWeight: "700",
    },
    segmentTextActive: {
      ...segment.textActive,
    },
    petCard: {
      ...cardBase,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 12,
    },
    petImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.background,
    },
    petPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    petPlaceholderIcon: {
      fontSize: 24,
    },
    petInfo: {
      flex: 1,
      gap: 2,
    },
    petName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    petOwner: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.muted,
    },
    petMeta: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: "400",
    },
  });
}
