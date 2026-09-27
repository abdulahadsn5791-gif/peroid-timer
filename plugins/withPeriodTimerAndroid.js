/**
 * Config plugin for the Android notification stack. Jobs:
 *  1. Patch AndroidManifest — permissions, the alarm + boot receivers, the
 *     home widget, the foreground-service live notification.
 *  2. Copy the Kotlin sources and Android resources from native/android into
 *     the generated android/ project (prebuild repeats the copy, so `expo
 *     prebuild` is always reproducible).
 *  3. Wire release signing and a bumpable versionCode in app/build.gradle, so
 *     a tagged CI build is signed with the real key instead of the debug one.
 *
 * Native code never contains schedule rules — it only reads the DayTimeline
 * snapshot the app writes.
 */
const {
  withAndroidManifest,
  withMainApplication,
  withAppBuildGradle,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE = "com.periodtimer";
const KOTLIN_DIR = path.join(__dirname, "..", "native", "android", "kotlin");
const RES_DIR = path.join(__dirname, "..", "native", "android", "res");
const APP_SRC = path.join("app", "src", "main");

function permissionsFor() {
  const list = [
    "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
  ];
  return list.map((name) => ({ $: { "android:name": name } }));
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
      ],
    },
    {
      $: {
        "android:name": `${PACKAGE}.TimerBootReceiver`,
        "android:exported": "true",
      },
      "intent-filter": [
        { action: [{ $: { "android:name": "android.intent.action.BOOT_COMPLETED" } }] },
        { action: [{ $: { "android:name": `${PACKAGE}.ACTION_RESCHEDULE` } }] },
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
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

function withManifestEdits(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const application = manifest.application[0];

    manifest["uses-permission"] = (manifest["uses-permission"] || []).concat(permissionsFor());

    application.receiver = (application.receiver || []).concat(receiversFor());
    application.service = (application.service || []).concat(serviceLiveNotification());

    cfg.modResults = { manifest };
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
  config = copyKotlinAndResources(config);
  config = withReleaseSigning(config);
  return config;
};