import Constants from 'expo-constants';

function normalizeVersionInput(value?: string | number | null) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export function resolveAppVersion() {
  return (
    normalizeVersionInput(Constants.nativeAppVersion) ||
    normalizeVersionInput(Constants.expoConfig?.version) ||
    normalizeVersionInput(Constants.manifest?.version) ||
    // @ts-expect-error manifest2 is undocumented but present on some builds
    normalizeVersionInput(Constants.manifest2?.version) ||
    // @ts-expect-error manifestExtra is new on SDK 54+
    normalizeVersionInput(Constants.manifestExtra?.version) ||
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
