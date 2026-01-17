import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../components/ScreenHeader";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import { getCardStyle, getSegmentStyles } from "../theme/uiTokens";
import { getDateLocale } from "../i18n";
import { getBillingAnalytics } from "../api/analytics";

type RangeKey = "7d" | "30d" | "90d";
type ChartMode = "bookings" | "revenue";
type SeriesPoint = { key: string; label: string; value: number };

function getRange(key: RangeKey) {
  const toDate = new Date();
  toDate.setHours(0, 0, 0, 0);
  const fromDate = new Date(toDate);
  const daysBack = key === "7d" ? 6 : key === "30d" ? 29 : 89;
  fromDate.setDate(toDate.getDate() - daysBack);
  return {
    from: fromDate.toLocaleDateString("sv-SE"),
    to: toDate.toLocaleDateString("sv-SE"),
  };
}

function formatDayLabel(dayKey: string, locale: string) {
  try {
    return new Date(dayKey + "T00:00:00").toLocaleDateString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dayKey;
  }
}

function formatCurrency(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return `€${rounded.toFixed(2)}`;
}

function MiniBarChart({
  data,
  color,
  labelColor,
  valueFormatter,
}: {
  data: SeriesPoint[];
  color: string;
  labelColor: string;
  valueFormatter?: (value: number) => string;
}) {
  const max = useMemo(
    () => data.reduce((acc, item) => Math.max(acc, item.value), 0),
    [data]
  );
  if (!data.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.chartRow}>
        {data.map((item) => {
          const height = max > 0 ? Math.max(12, (item.value / max) * 120) : 12;
          return (
            <View key={item.key} style={styles.chartBarWrapper}>
              <Text
                style={[styles.chartValue, { color: labelColor }]}
                numberOfLines={1}
              >
                {valueFormatter ? valueFormatter(item.value) : item.value}
              </Text>
              <View
                style={[styles.chartBar, { height, backgroundColor: color }]}
              />
              <Text
                style={[styles.chartLabel, { color: labelColor }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  colors,
}: {
  title: string;
  value: string;
  subtitle?: string;
  colors: ReturnType<typeof useBrandingTheme>["colors"];
}) {
  const baseCard = useMemo(() => getCardStyle(colors), [colors]);
  return (
    <View style={[baseCard, styles.metricCard]}>
      <Text style={[styles.metricTitle, { color: colors.muted }]}>{title}</Text>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      {subtitle ? (
        <Text style={[styles.metricSubtitle, { color: colors.muted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function ListRow({
  title,
  meta,
  value,
  colors,
}: {
  title: string;
  meta?: string;
  value?: string;
  colors: ReturnType<typeof useBrandingTheme>["colors"];
}) {
  return (
    <View style={styles.listRow}>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.listTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            style={[styles.listMeta, { color: colors.muted }]}
            numberOfLines={1}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.listValue, { color: colors.text }]}>{value}</Text>
      ) : null}
    </View>
  );
}

export default function BillingScreen() {
  const { colors } = useBrandingTheme();
  const stylesWithTheme = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<RangeKey>("30d");
  const [chartMode, setChartMode] = useState<ChartMode>("bookings");

  const rangeParams = useMemo(() => getRange(range), [range]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["billing-analytics", rangeParams.from, rangeParams.to],
    queryFn: () => getBillingAnalytics(rangeParams),
  });

  const bookingsSeries: SeriesPoint[] = useMemo(() => {
    return (data?.daily || []).map((entry) => ({
      key: entry.day,
      label: formatDayLabel(entry.day, dateLocale),
      value: entry.bookings || 0,
    }));
  }, [data?.daily, dateLocale]);

  const revenueSeries: SeriesPoint[] = useMemo(() => {
    return (data?.daily || []).map((entry) => ({
      key: entry.day,
      label: formatDayLabel(entry.day, dateLocale),
      value: entry.revenue_completed || 0,
    }));
  }, [data?.daily, dateLocale]);

  const cancelRate = useMemo(() => {
    const total = data?.summary?.bookings || 0;
    const cancelled = data?.summary?.cancelled || 0;
    return total > 0 ? Math.round((cancelled / total) * 100) : 0;
  }, [data?.summary]);

  const insights = useMemo(() => {
    const items: string[] = [];
    if (bookingsSeries.length) {
      const busiest = bookingsSeries.reduce((prev, cur) =>
        cur.value > prev.value ? cur : prev
      );
      items.push(
        t("billing.insights.busiestDay", {
          day: busiest.label,
          value: busiest.value,
        })
      );
    }
    if (data?.topServices?.length) {
      const best = data.topServices[0];
      items.push(
        t("billing.insights.topService", {
          service: best.service_name || t("common.unknown"),
          value: best.bookings || best.revenue || 0,
        })
      );
    }
    items.push(
      t("billing.insights.cancelRate", {
        value: `${cancelRate}%`,
      })
    );
    return items;
  }, [bookingsSeries, data?.topServices, cancelRate, t]);

  const rangeSelectorStyles = useMemo(() => getSegmentStyles(colors), [colors]);

  const renderRangeSelector = () => (
    <View
      style={[rangeSelectorStyles.container, stylesWithTheme.segmentWrapper]}
    >
      {(["7d", "30d", "90d"] as RangeKey[]).map((key) => (
        <TouchableOpacity
          key={key}
          style={[
            rangeSelectorStyles.button,
            key === range ? rangeSelectorStyles.buttonActive : null,
          ]}
          onPress={() => setRange(key)}
          activeOpacity={0.85}
        >
          <Text
            style={[
              rangeSelectorStyles.text,
              key === range ? rangeSelectorStyles.textActive : null,
            ]}
          >
            {t(`billing.range.${key}` as const)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderChartSelector = () => (
    <View
      style={[rangeSelectorStyles.container, stylesWithTheme.segmentWrapper]}
    >
      {(["bookings", "revenue"] as ChartMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[
            rangeSelectorStyles.button,
            mode === chartMode ? rangeSelectorStyles.buttonActive : null,
          ]}
          onPress={() => setChartMode(mode)}
          activeOpacity={0.85}
        >
          <Text
            style={[
              rangeSelectorStyles.text,
              mode === chartMode ? rangeSelectorStyles.textActive : null,
            ]}
          >
            {mode === "bookings"
              ? t("billing.chart.bookings")
              : t("billing.chart.revenue")}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const summary = data?.summary;
  const topServices = data?.topServices || [];
  const topCustomers = data?.topCustomers || [];

  return (
    <SafeAreaView
      style={[
        stylesWithTheme.container,
        { paddingBottom: Math.max(insets.bottom, 16) },
      ]}
      edges={["top", "left", "right"]}
    >
      <ScreenHeader title={t("billing.title")} />
      <ScrollView
        contentContainerStyle={[
          stylesWithTheme.content,
          { flexGrow: 1, paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={stylesWithTheme.headerRow}>
          <Text style={[stylesWithTheme.title, { color: colors.text }]}>
            {t("billing.subtitle")}
          </Text>
          <TouchableOpacity onPress={() => refetch()} activeOpacity={0.8}>
            <Ionicons name="refresh" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {renderRangeSelector()}

        {isLoading || isRefetching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={stylesWithTheme.metricsGrid}>
              <MetricCard
                title={t("billing.kpi.bookings")}
                value={`${summary?.bookings ?? 0}`}
                subtitle={t("billing.kpi.completedLabel", {
                  value: summary?.completed ?? 0,
                })}
                colors={colors}
              />
              <MetricCard
                title={t("billing.kpi.revenue")}
                value={formatCurrency(summary?.revenue ?? 0)}
                subtitle={t("billing.kpi.revenueHint")}
                colors={colors}
              />
              <MetricCard
                title={t("billing.kpi.avgTicket")}
                value={
                  summary?.avgTicket && summary.avgTicket > 0
                    ? formatCurrency(summary.avgTicket)
                    : "—"
                }
                subtitle={t("billing.kpi.avgTicketHint")}
                colors={colors}
              />
              <MetricCard
                title={t("billing.kpi.returning")}
                value={`${Math.round(summary?.returningRate || 0)}%`}
                subtitle={t("billing.kpi.returningHint")}
                colors={colors}
              />
            </View>

            <View style={[getCardStyle(colors), stylesWithTheme.sectionCard]}>
              <View style={stylesWithTheme.sectionHeader}>
                <Text
                  style={[stylesWithTheme.sectionTitle, { color: colors.text }]}
                >
                  {t("billing.chart.title")}
                </Text>
                {renderChartSelector()}
              </View>
              {chartMode === "bookings" ? (
                bookingsSeries.length ? (
                  <MiniBarChart
                    data={bookingsSeries}
                    color={colors.primary}
                    labelColor={colors.muted}
                    valueFormatter={(value) => `${value}`}
                  />
                ) : (
                  <Text
                    style={[stylesWithTheme.emptyText, { color: colors.muted }]}
                  >
                    {t("billing.chart.empty")}
                  </Text>
                )
              ) : revenueSeries.length ? (
                <MiniBarChart
                  data={revenueSeries}
                  color={colors.accent}
                  labelColor={colors.muted}
                  valueFormatter={(value) => formatCurrency(value)}
                />
              ) : (
                <Text
                  style={[stylesWithTheme.emptyText, { color: colors.muted }]}
                >
                  {t("billing.chart.empty")}
                </Text>
              )}
            </View>

            <View style={stylesWithTheme.splitRow}>
              <View
                style={[getCardStyle(colors), stylesWithTheme.sectionCardHalf]}
              >
                <View style={stylesWithTheme.sectionHeader}>
                  <Text
                    style={[
                      stylesWithTheme.sectionTitle,
                      { color: colors.text },
                    ]}
                  >
                    {t("billing.services.title")}
                  </Text>
                </View>
                {topServices.length ? (
                  topServices.slice(0, 3).map((service) => (
                    <ListRow
                      key={service.service_id || service.service_name}
                      title={service.service_name || t("common.unknown")}
                      meta={t("billing.services.meta", {
                        count: service.bookings || 0,
                      })}
                      value={formatCurrency(service.revenue || 0)}
                      colors={colors}
                    />
                  ))
                ) : (
                  <Text
                    style={[stylesWithTheme.emptyText, { color: colors.muted }]}
                  >
                    {t("billing.services.empty")}
                  </Text>
                )}
              </View>

              <View
                style={[getCardStyle(colors), stylesWithTheme.sectionCardHalf]}
              >
                <View style={stylesWithTheme.sectionHeader}>
                  <Text
                    style={[
                      stylesWithTheme.sectionTitle,
                      { color: colors.text },
                    ]}
                  >
                    {t("billing.customers.title")}
                  </Text>
                </View>
                {topCustomers.length ? (
                  topCustomers.map((customer) => (
                    <ListRow
                      key={customer.customer_id || customer.name}
                      title={customer.name || t("common.unknown")}
                      meta={t("billing.customers.meta", {
                        count: customer.visits || 0,
                      })}
                      value={
                        customer.revenue != null
                          ? formatCurrency(customer.revenue)
                          : undefined
                      }
                      colors={colors}
                    />
                  ))
                ) : (
                  <Text
                    style={[stylesWithTheme.emptyText, { color: colors.muted }]}
                  >
                    {t("billing.customers.empty")}
                  </Text>
                )}
              </View>
            </View>

            <View style={[getCardStyle(colors), stylesWithTheme.sectionCard]}>
              <View style={stylesWithTheme.sectionHeader}>
                <Text
                  style={[stylesWithTheme.sectionTitle, { color: colors.text }]}
                >
                  {t("billing.insights.title")}
                </Text>
              </View>
              {insights.length ? (
                insights.map((insight, index) => (
                  <Text
                    key={`${insight}-${index}`}
                    style={[
                      stylesWithTheme.insightText,
                      { color: colors.text },
                    ]}
                  >
                    • {insight}
                  </Text>
                ))
              ) : (
                <Text
                  style={[stylesWithTheme.emptyText, { color: colors.muted }]}
                >
                  {t("billing.insights.empty")}
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingTop: 4,
  },
  chartBarWrapper: {
    width: 60,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  chartBar: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#4fafa9",
  },
  chartValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  chartLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  listMeta: {
    fontSize: 12,
    fontWeight: "500",
  },
  listValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  metricCard: {
    flex: 1,
    minWidth: "48%",
    gap: 4,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  metricSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
});

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 0,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 16,
      gap: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
    },
    metricsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    sectionCard: {
      gap: 10,
    },
    sectionCardHalf: {
      flex: 1,
      gap: 8,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    segmentWrapper: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 8,
    },
    splitRow: {
      flexDirection: "row",
      gap: 12,
    },
    emptyText: {
      fontSize: 13,
      fontWeight: "500",
    },
    insightText: {
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 20,
    },
  });
}
