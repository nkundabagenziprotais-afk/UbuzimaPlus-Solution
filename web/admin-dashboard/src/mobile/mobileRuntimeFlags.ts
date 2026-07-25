export type MobileRuntimeFlags = {
  reactMobileNavigation: boolean;
  reactMobileHome: boolean;
  legacyMobileRuntime: boolean;
};

type MobileRuntimeEnvironment = Readonly<
  Record<string, string | boolean | undefined>
>;

function readBooleanFlag(
  value: string | boolean | undefined,
  fallback: boolean,
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function resolveMobileRuntimeFlags(
  environment: MobileRuntimeEnvironment,
): MobileRuntimeFlags {
  return {
    reactMobileNavigation: readBooleanFlag(
      environment.VITE_REACT_MOBILE_NAVIGATION,
      false,
    ),
    reactMobileHome: readBooleanFlag(
      environment.VITE_REACT_MOBILE_HOME,
      false,
    ),
    legacyMobileRuntime: readBooleanFlag(
      environment.VITE_LEGACY_MOBILE_RUNTIME,
      true,
    ),
  };
}

export const mobileRuntimeFlags = resolveMobileRuntimeFlags(
  import.meta.env as MobileRuntimeEnvironment,
);
