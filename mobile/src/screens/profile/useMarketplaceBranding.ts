import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import debounce from "lodash.debounce";
import { updateBranding } from "../../api/branding";
import type { Branding } from "../../api/branding";

// This hook encapsulates all marketplace branding logic/state
export function useAccountBranding(
  branding: Branding | null | undefined,
  brandingAccountId?: string | null,
  isOwner?: boolean,
) {
  const queryClient = useQueryClient();
  // Account branding state
  const [accountName, setAccountNameState] = useState<string>(branding?.account_name || "");
  const [accountDescription, setAccountDescriptionState] = useState<string>(branding?.marketplace_description || "");
  const [accountRegion, setAccountRegionState] = useState<string>(branding?.marketplace_region || "");

  // Generic setter factory
  const createMarketplaceSetter = (
    stateSetter: (v: any) => void,
    brandingKey: string,
    payloadKey: string,
  ) => {
    return (value: any, fromBranding = false) => {
      stateSetter(value);
      // can mark dirty or autosave here
    };
  };

  const setAccountName = createMarketplaceSetter(setAccountNameState, "account_name", "name");

  return {
    accountName,
    setAccountName,
    accountDescription,
    setAccountDescription: createMarketplaceSetter(
      setAccountDescriptionState,
      "marketplace_description",
      "marketplace_description",
    ),
    accountRegion,
    setAccountRegion: createMarketplaceSetter(
      setAccountRegionState,
      "marketplace_region",
      "marketplace_region",
    ),
  };
}
