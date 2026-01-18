import React from "react";
import ProfileScreen from "../ProfileScreen";
import { useProfileScreen } from "./useProfileScreen";

// Wrapper component: uses the new hook (migration target) while delegating
// rendering to the existing `ProfileScreen`. This allows incremental migration
// without breaking the app.
export default function ProfileScreenWrapper(props: any) {
  useProfileScreen();
  // For now we do not pass the hook into the legacy screen to avoid changing
  // its API; future work will remove duplication and have `ProfileScreen` be
  // a thin composition of components using the hook.
  return <ProfileScreen {...props} />;
}
