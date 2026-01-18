import { useState } from "react";
import type { Branding } from "../../api/branding";

// This hook encapsulates all marketplace branding logic/state
export function useAccountBranding(
  branding: Branding | null | undefined,
  _brandingAccountId?: string | null,
  _isOwner?: boolean,
) {
  const [accountName, setAccountNameState] = useState<string>(branding?.account_name || "");
  const [accountDescription, setAccountDescriptionState] = useState<string>(branding?.marketplace_description || "");
  const [accountRegion, setAccountRegionState] = useState<string>(branding?.marketplace_region || "");

  // Generic setter factory
  const createMarketplaceSetter = (
    stateSetter: (v: any) => void,
    _brandingKey: string,
    _payloadKey: string,
  ) => {
    return (value: any, _fromBranding = false) => {
      stateSetter(value);
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
