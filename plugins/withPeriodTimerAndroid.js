/**
 * Config plugin for the Android notification stack. Jobs:
 *  1. Patch AndroidManifest — permissions, the alarm + boot receivers, the
 *     home widget, the foreground-service live notification.
 *  2. Copy the Kotlin sources and Android resources from native/android into
 *     the generated android/ project (prebuild repeats the copy, so `expo
 *     prebuild` is always reproducible).
 *  3. Pin the app theme to the light/white look the app is designed in.
 *  4. Wire release signing and a bumpable versionCode in app/build.gradle, so
 *     a tagged CI build is signed with the real key instead of the debug one.
 *
 * Native code never contains schedule rules — it only reads the DayTimeline
 * snapshot the app writes.
 */
const {
  withAndroidManifest,
  withAndroidStyles,
  withMainApplication,
  withAppBuildGradle,
  withGradleProperties,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE = "com.periodtimer";
const KOTLIN_DIR = path.join(__dirname, "..", "native", "android", "kotlin");
const RES_DIR = path.join(__dirname, "..", "native", "android", "res");
const APP_SRC = path.join("app", "src", "main");

function permissionsFor() {
  return [
    // Play-policy-safe exact alarms: the free USE_EXACT_ALARM covers alarm-
    // clock-style apps (no user toggle needed, Android 13+); on Android 12L
    // and below we keep the legacy SCHEDULE_EXACT_ALARM permission.
    { $: { "android:name": "android.permission.USE_EXACT_ALARM" } },
    { $: { "android:name": "android.permission.SCHEDULE_EXACT_ALARM", "android:maxSdkVersion": "32" } },
    { $: { "android:name": "android.permission.RECEIVE_BOOT_COMPLETED" } },
    { $: { "android:name": "android.permission.POST_NOTIFICATIONS" } },
    { $: { "android:name": "android.permission.VIBRATE" } },
    { $: { "android:name": "android.permission.FOREGROUND_SERVICE" } },
    { $: { "android:name": "android.permission.FOREGROUND_SERVICE_SPECIAL_USE" } },
  ];
}

function receiversFor() {
  return [
    {
      $: {
        "android:name": `${PACKAGE}.TimerAlarmReceiver`,
        "android:exported": "false",
      },
      "intent-filter": [
        { action: [{ $: { "android:name": `${PACKAGE}.ACTION_ALARM` } }] },
        { action: [{ $: { "android:name": `${PACKAGE}.ACTION_END_ALERT` } }] },
      ],
    },
    {
      $: {
        "android:name": `${PACKAGE}.TimerBootReceiver`,
        // Exported is REQUIRED for the system BOOT_COMPLETED broadcast.
        // Deliberately NO custom actions here: an exported receiver that
        // advertises its own actions in an intent-filter is the pattern Play
        // Protect's broadcast-spoofing heuristics flag. In-app rescheduling
        // uses an explicit intent (component-addressed, no filter needed),
        // and the receiver trusts no extras — the only effect of any spoof
        // would be re-reading our own snapshot and re-arming our own alarms.
        "android:exported": "true",
      },
      "intent-filter": [
        { action: [{ $: { "android:name": "android.intent.action.BOOT_COMPLETED" } }] },
      ],
    },
    {
      $: {
        "android:name": `${PACKAGE}.TimerWidgetProvider`,
        "android:exported": "false",
      },
      "intent-filter": [
        { action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] },
      ],
      "meta-data": [
        { $: { "android:name": "android.appwidget.provider", "android:resource": "@xml/timer_widget_info" } },
      ],
    },
  ];
}

function serviceLiveNotification() {
  return {
    $: {
      "android:name": `${PACKAGE}.PeriodForegroundService`,
      "android:exported": "false",
      "android:foregroundServiceType": "specialUse",
    },
    "property": [
      {
        $: {
          "android:name": "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
          "android:value": "live period countdown notification with progress",
        },
      },
    ],
  };
}

const SIGNING_DEBUG_BLOCK = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }`;

const RELEASE_SIGNING_BLOCK = `        release {
            storeFile file(System.getenv('PERIOD_TIMER_KEYSTORE'))
            storePassword System.getenv('PERIOD_TIMER_STORE_PASSWORD')
            keyAlias System.getenv('PERIOD_TIMER_KEY_ALIAS')
            keyPassword System.getenv('PERIOD_TIMER_KEY_PASSWORD')
        }`;

const RELEASE_DEBUG_SIGNING = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

/**
 * A keystore path is only honoured when the file is really there. Without this
 * guard a typo in CI would silently fall through to the debug key and publish an
 * APK nobody can upgrade later.
 */
function keystoreOrNull() {
  const store = process.env.PERIOD_TIMER_KEYSTORE;
  if (!store) return null;
  if (!fs.existsSync(store)) {
    throw new Error(
      `withPeriodTimerAndroid: PERIOD_TIMER_KEYSTORE points at ${store}, which does not exist.`,
    );
  }
  return store;
}

const VERSION_CODE_PATTERN = /^(\s*versionCode)\s+\d+/m;
const VERSION_NAME_PATTERN = /^(\s*versionName)\s+["'].*?["']/m;

/**
 * One APK carries every Android ABI, so the same release installs on real
 * phones (arm64/arm32) AND on x86 emulators — "device not supported" can never
 * happen. Gradle tuning keeps the 4-ABI CI build within runner limits.
 */
const GRADLE_TUNING = {
  "org.gradle.jvmargs": "-Xmx4096m -XX:MaxMetaspaceSize=1024m",
  "org.gradle.parallel": "true",
  "org.gradle.caching": "true",
  reactNativeArchitectures: "armeabi-v7a,arm64-v8a,x86,x86_64",
};

function withGradleTuning(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(GRADLE_TUNING)) {
      const existing = cfg.modResults.find((p) => p.type === "property" && p.key === key);
      if (existing) {
        existing.value = value;
      } else {
        cfg.modResults.push({ type: "property", key, value });
      }
    }
    return cfg;
  });
}

function patchVersion(contents) {
  const versionCode = process.env.PERIOD_TIMER_VERSION_CODE ?? "1";
  if (!/^\d+$/.test(versionCode)) {
    throw new Error(
      `withPeriodTimerAndroid: PERIOD_TIMER_VERSION_CODE must be a positive integer, got "${versionCode}".`,
    );
  }
  // Test for a match rather than comparing the patched string: when versionCode
  // already equals the requested value the replace is a legitimate no-op.
  if (!VERSION_CODE_PATTERN.test(contents)) {
    throw new Error("withPeriodTimerAndroid: could not find versionCode in app/build.gradle.");
  }
  let patched = contents.replace(VERSION_CODE_PATTERN, `$1 ${versionCode}`);

  const versionName = process.env.PERIOD_TIMER_VERSION_NAME;
  if (versionName) {
    if (!/^\d+(\.\d+){0,2}$/.test(versionName)) {
      throw new Error(
        `withPeriodTimerAndroid: PERIOD_TIMER_VERSION_NAME must look like 1.2.3, got "${versionName}".`,
      );
    }
    if (!VERSION_NAME_PATTERN.test(patched)) {
      throw new Error("withPeriodTimerAndroid: could not find versionName in app/build.gradle.");
    }
    patched = patched.replace(VERSION_NAME_PATTERN, `$1 "${versionName}"`);
  }

  return patched;
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    contents = patchVersion(contents);

    if (keystoreOrNull()) {
      if (!contents.includes(SIGNING_DEBUG_BLOCK)) {
        throw new Error(
          "withPeriodTimerAndroid: could not find the debug signingConfig block in app/build.gradle.",
        );
      }
      if (!contents.includes(RELEASE_DEBUG_SIGNING)) {
        throw new Error(
          "withPeriodTimerAndroid: could not find the release signingConfig in app/build.gradle.",
        );
      }
      contents = contents
        .replace(SIGNING_DEBUG_BLOCK, `${SIGNING_DEBUG_BLOCK}\n${RELEASE_SIGNING_BLOCK}`)
        .replace(RELEASE_DEBUG_SIGNING, "            signingConfig signingConfigs.release");
    } else {
      // Guardrail: a debug-signed APK cannot install over any published
      // release (signature mismatch). The CI tag build is the supported way
      // to produce a distributable APK.
      console.warn(
        "withPeriodTimerAndroid: PERIOD_TIMER_KEYSTORE is not set — assembleRelease will be DEBUG-signed. " +
          "Fine for local testing; for a distributable APK use the CI tag build (git tag vX.Y.Z && git push --tags).",
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

function withManifestEdits(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const application = manifest.application[0];

    // Only add permissions the Expo template doesn't already declare — a
    // duplicate uses-permission element makes the manifest merger warn on
    // every release build (FOREGROUND_SERVICE and VIBRATE ship upstream).
    const existing = new Set(
      (manifest["uses-permission"] || []).map((p) => p.$["android:name"]),
    );
    const additions = permissionsFor().filter((p) => !existing.has(p.$["android:name"]));
    manifest["uses-permission"] = (manifest["uses-permission"] || []).concat(additions);

    application.receiver = (application.receiver || []).concat(receiversFor());
    application.service = (application.service || []).concat(serviceLiveNotification());

    cfg.modResults = { manifest };
    return cfg;
  });
}

/**
 * Pin the app theme to light so a fresh install is white no matter what the
 * phone's dark-mode switch says.
 *
 * `userInterfaceStyle: "light"` in app.json is a NO-OP without expo-system-ui:
 * prebuild only prints "Install expo-system-ui in your project to enable this
 * feature." and leaves the Expo template's
 * `AppTheme` parent = `Theme.AppCompat.DayNight.NoActionBar`, which follows the
 * system dark mode. So on a phone with dark mode on, the launch window and every
 * native-drawn surface (dialogs, the dev menu) came up dark while the app's own
 * `theme` setting defaulted to the white look — a dark window behind a white
 * app, and a dark flash before the first React frame.
 *
 * The theme the user picks in Settings is the app's own `theme` setting (home +
 * settings pages), so this only fixes the *native* shell. Setting the parent to
 * the Light variant and turning force-dark off makes the native shell white
 * regardless of the OS, with no extra dependency.
 */
const APP_THEME_ITEMS = {
  // Android 10+ inverts a light app that has not opted out, which would darken
  // the white canvas behind our own light surfaces.
  "android:forceDarkAllowed": "false",
  "android:windowLightStatusBar": "true",
};

function withLightAppTheme(config) {
  return withAndroidStyles(config, (cfg) => {
    const resources = cfg.modResults.resources ?? (cfg.modResults.resources = {});
    const styles = Array.isArray(resources.style) ? resources.style : (resources.style = []);

    let appTheme = styles.find((style) => style && style.$ && style.$.name === "AppTheme");
    if (!appTheme) {
      appTheme = { $: { name: "AppTheme" }, item: [] };
      styles.push(appTheme);
    }
    appTheme.$.parent = "Theme.AppCompat.Light.NoActionBar";

    const items = Array.isArray(appTheme.item) ? appTheme.item : (appTheme.item = []);
    for (const [name, value] of Object.entries(APP_THEME_ITEMS)) {
      const existing = items.find((item) => item && item.$ && item.$.name === name);
      if (existing) {
        existing._ = value;
      } else {
        items.push({ $: { name }, _: value });
      }
    }

    return cfg;
  });
}

function withMainApplicationRegistration(config) {
  return withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    const marker = "PackageList(this).packages.apply {";
    if (contents.includes(marker)) {
      contents = contents.replace(
        marker,
        `${marker}\n                add(${PACKAGE}.PeriodTimerPackage())`,
      );
      cfg.modResults.contents = contents;
    }
    return cfg;
  });
}

function copyKotlinAndResources(config) {
  return withDangerousMod(config, ["android", async (cfg) => {
    const platformDir = cfg.modRequest.platformProjectRoot;
    const srcDir = path.join(platformDir, APP_SRC);
    const kotlinTarget = path.join(srcDir, "java", ...PACKAGE.split("."));

    fs.mkdirSync(kotlinTarget, { recursive: true });
    for (const file of fs.readdirSync(KOTLIN_DIR)) {
      if (!file.endsWith(".kt")) continue;
      fs.copyFileSync(path.join(KOTLIN_DIR, file), path.join(kotlinTarget, file));
    }

    fs.mkdirSync(path.join(srcDir, "res"), { recursive: true });
    copyDirRecursive(RES_DIR, path.join(srcDir, "res"));

    const rawDir = path.join(srcDir, "res", "raw");
    fs.mkdirSync(rawDir, { recursive: true });
    const wavSource = path.join(cfg.modRequest.projectRoot, "assets", "period-end.wav");
    if (fs.existsSync(wavSource)) {
      fs.copyFileSync(wavSource, path.join(rawDir, "period_end.wav"));
    }
    return cfg;
  }]);
}

function copyDirRecursive(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      copyDirRecursive(src, dest);
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dest);
    }
  }
}

module.exports = function withPeriodTimerAndroid(config) {
  config = withManifestEdits(config);
  config = withMainApplicationRegistration(config);
  config = withLightAppTheme(config);
  config = copyKotlinAndResources(config);
  config = withGradleTuning(config);
  config = withReleaseSigning(config);
  return config;
};
