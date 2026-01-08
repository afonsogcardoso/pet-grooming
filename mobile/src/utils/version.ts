import Constants from 'expo-constants';

function normalizeVersionInput(value?: string | number | null) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export function resolveAppVersion() {
  return (
    normalizeVersionInput(Constants.nativeAppVersion) ||
    normalizeVersionInput((Constants as any).expoConfig?.version) ||
    normalizeVersionInput((Constants as any).manifest?.version) ||
    normalizeVersionInput((Constants as any).manifest2?.version) ||
    normalizeVersionInput((Constants as any).manifestExtra?.version) ||
    null
  );
}

export function resolveBuildVersion() {
  return (
    normalizeVersionInput(Constants.nativeBuildVersion) ||
    normalizeVersionInput(Constants.expoConfig?.ios?.buildNumber) ||
    normalizeVersionInput(Constants.expoConfig?.android?.versionCode) ||
    null
  );
}

export function resolveVersionTag() {
  const appVersion = resolveAppVersion();
  const buildVersion = resolveBuildVersion();
  const tag = [appVersion, buildVersion].filter(Boolean).join('-');
  return tag || null;
}

export function formatVersionLabel() {
  const appVersion = resolveAppVersion();
  const buildVersion = resolveBuildVersion();
  if (appVersion && buildVersion) return `v${appVersion} (${buildVersion})`;
  if (appVersion) return `v${appVersion}`;
  if (buildVersion) return `build ${buildVersion}`;
  return null;
}
