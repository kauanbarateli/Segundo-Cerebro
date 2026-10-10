// Playwright otherwise passes the Node worker environment to Chromium.
// Preserve only OS settings. Auth/server credentials remain in Node/Next.
const NAMES = ["PATH", "LANG", "LC_ALL", "TZ", "HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME"];

export function browserProcessEnvironment(environment) {
  const result = {};
  for (const name of NAMES) {
    const descriptor = Object.getOwnPropertyDescriptor(environment, name);
    if (!descriptor) continue;
    if (!Object.hasOwn(descriptor, "value") || typeof descriptor.value !== "string" ||
        descriptor.value.length > 8192 || descriptor.value.includes("\0")) {
      throw new Error("BROWSER_PROCESS_ENVIRONMENT_REFUSED");
    }
    result[name] = descriptor.value;
  }
  return result;
}
