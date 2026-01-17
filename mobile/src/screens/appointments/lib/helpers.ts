import type { ServiceRow } from "../../../components/appointment/PetServiceRow";

export type RowTotals = {
  price: number;
  duration: number;
  requiresTier: boolean;
};

export function isHexLight(color?: string) {
  if (!color || typeof color !== "string" || !color.startsWith("#"))
    return false;
  const hex = color.replace("#", "");
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (expanded.length !== 6) return false;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65;
}

export function normalizeBaseUrl(value?: string | null) {
  if (!value) return "";
  return value.replace(/\/$/, "");
}

const CONFIRMATION_BASE_URL = (() => {
  const candidates = [
    process.env.EXPO_PUBLIC_SITE_URL,
    process.env.EXPO_PUBLIC_WEB_URL,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (apiBase) {
    try {
      // use URL only for parsing origin safely
      // Use global URL if available
      const URLCtor: any = (globalThis as any)?.URL || (typeof URL !== "undefined" ? (URL as any) : undefined);
      if (URLCtor) {
        const parsed = new URLCtor(apiBase);
        return parsed.origin;
      }
      return normalizeBaseUrl(apiBase);
    } catch {
      return normalizeBaseUrl(apiBase);
    }
  }
  return "";
})();

export function buildConfirmationUrl(appointment?: {
  id?: string;
  public_token?: string | null;
}) {
  if (!appointment?.id || !appointment?.public_token || !CONFIRMATION_BASE_URL)
    return "";
  const query = `id=${encodeURIComponent(
    appointment.id
  )}&token=${encodeURIComponent(appointment.public_token)}`;
  return `${CONFIRMATION_BASE_URL}/appointments/confirm?${query}`;
}

export function parseRecurrenceFrequency(
  rule?: string | null
): "weekly" | "biweekly" | "monthly" | null {
  if (!rule) return null;
  const freqMatch = rule.match(/FREQ=([A-Z]+)/i);
  const intervalMatch = rule.match(/INTERVAL=(\d+)/i);
  const freq = freqMatch?.[1]?.toUpperCase();
  const interval = Number.parseInt(intervalMatch?.[1] || "1", 10);
  if (freq === "WEEKLY") {
    return interval === 2 ? "biweekly" : "weekly";
  }
  if (freq === "MONTHLY") {
    return "monthly";
  }
  return null;
}

export function createLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createServiceRow(initial?: Partial<ServiceRow>): ServiceRow {
  return (
    {
      id: initial?.id || createLocalId("row"),
      serviceId: initial?.serviceId || "",
      priceTierId: initial?.priceTierId || "",
      tierSelectionSource: initial?.tierSelectionSource ?? null,
      addonIds: initial?.addonIds || [],
    } as unknown
  ) as ServiceRow;
}

export function buildRowsFromAppointment(
  appointmentData: any,
  fallbackPetId: string | null = null
): {
  rowsByPet: Record<string, ServiceRow[]>;
  petIds: string[];
  totalsByRowId: Record<string, RowTotals>;
} {
  const rowsByPet: Record<string, ServiceRow[]> = {};
  const petIds = new Set<string>();
  const totalsByRowId: Record<string, RowTotals> = {};

  if (
    Array.isArray(appointmentData?.appointment_services) &&
    appointmentData.appointment_services.length > 0
  ) {
    appointmentData.appointment_services.forEach((entry: any) => {
      const petId = entry?.pet_id || entry?.pets?.id || fallbackPetId;
      const serviceId = entry?.service_id || entry?.services?.id || "";
      if (!petId || !serviceId) return;

      petIds.add(petId);
      const rowId = `${petId}-${serviceId}-${entry?.id || createLocalId("svc")}`;
      const row = createServiceRow({
        id: rowId,
        serviceId,
        priceTierId: entry?.price_tier_id || "",
        tierSelectionSource: entry?.price_tier_id ? "stored" : null,
        addonIds:
          entry?.appointment_service_addons
            ?.map((addon: any) => addon?.service_addon_id || addon?.id)
            .filter(Boolean) || [],
      });
      rowsByPet[petId] = [...(rowsByPet[petId] || []), row];

      const addonsTotal = Array.isArray(entry?.appointment_service_addons)
        ? entry.appointment_service_addons.reduce(
            (sum: number, addon: any) => sum + (addon?.price || 0),
            0
          )
        : 0;
      const basePrice = entry?.price_tier_price ?? entry?.services?.price ?? 0;
      const duration = entry?.duration ?? entry?.services?.default_duration ?? 0;
      totalsByRowId[rowId] = {
        price: (basePrice || 0) + (addonsTotal || 0),
        duration: duration || 0,
        requiresTier: false,
      };
    });
  } else if (appointmentData?.services?.id) {
    const petId = appointmentData?.pets?.id || fallbackPetId;
    if (petId) {
      petIds.add(petId);
      rowsByPet[petId] = [
        createServiceRow({
          id: `${petId}-${appointmentData.services.id}`,
          serviceId: appointmentData.services.id,
          priceTierId: "",
          tierSelectionSource: null,
          addonIds: [],
        }),
      ];
    }
  } else if (fallbackPetId) {
    petIds.add(fallbackPetId);
    rowsByPet[fallbackPetId] = [createServiceRow()];
  }

  return { rowsByPet, petIds: Array.from(petIds), totalsByRowId };
}

export { CONFIRMATION_BASE_URL };
