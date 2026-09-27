/**
 * Dynamic app config. `app.json` stays the static base; this file only adds
 * the one thing that differs between build kinds.
 *
 * Set PERIOD_TIMER_RELEASE=1 for anything that ships to users. Release builds
 * must not contain the Expo dev client: it drags in the dev launcher and the
 * developer menu, which have no business in a distributed APK.
 */
const DEV_ONLY_PLUGINS = new Set(["expo-dev-client"]);

function pluginName(plugin) {
  return typeof plugin === "string" ? plugin : plugin?.[0];
}

module.exports = ({ config }) => {
  if (process.env.PERIOD_TIMER_RELEASE !== "1") {
    return config;
  }

  return {
    ...config,
    plugins: config.plugins.filter((plugin) => !DEV_ONLY_PLUGINS.has(pluginName(plugin))),
  };
};
