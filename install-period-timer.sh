 #!/usr/bin/env bash
    # -------------------------------------------------
    # Install the latest Expo‑built APK on a connected Android device
    # -------------------------------------------------
    # Requirements:
    #   * adb must be on the PATH (install via `sudo apt-get install android-sdk platform-tools`)
    #   * USB debugging enabled on the phone (or wireless ADB already set up)
    #   * The APK file must exist – the script will pick the most recent one
    # -------------------------------------------------
    
    set -euo pipefail
    
    # ------------------- Config -----------------------
    # Adjust these if your package name or APK location differ
    APK_DIR="${PWD}"                     # folder where the APK lives (default: current directory)
    APK_PATTERN="period-timer-*.apk"    # glob pattern for the APK
    ANDROID_PACKAGE="com.periodtimer"          # matches android.package in app.json
    # -------------------------------------------------
    
    # Find the newest APK matching the pattern
    APK_PATH=$(ls -t "${APK_DIR}/${APK_PATTERN}" 2>/dev/null | head -n1 || true)
    
    if [[ -z "$APK_PATH" ]]; then
      echo "❌ No APK found in ${APK_DIR} matching '${APK_PATTERN}'."
        echo "   Build one with: bunx expo prebuild && (cd android && ./gradlew assembleRelease)"
      exit 1
    fi
    
    echo "📦 Found APK: $APK_PATH"
    
    # -------------------------------------------------
    # 1️⃣ Verify a device is connected
    if ! adb devices | grep -q "device$"; then
      echo "❌ No Android device detected."
      echo "   • Make sure USB debugging is enabled."
      echo "   • Plug the phone in (or enable wireless ADB)."
      exit 1
    fi
    
    echo "🔎 Device detected: $(adb get-serialno)"
    
    # -------------------------------------------------
    # 2️⃣ Install / replace the app
    echo "🚀 Installing APK..."
    adb install -r "$APK_PATH"
    
    echo "✅ Installation complete."
    
    # -------------------------------------------------
    # 3️⃣ (Optional) Launch the app immediately
    read -p "Launch the app now? [y/N] " answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
      echo "🏃 Starting app..."
      adb shell monkey -p "$ANDROID_PACKAGE" -c android.intent.category.LAUNCHER 1
      echo "✅ App launched."
    else
      echo "🛑 Skipping launch."
    fi