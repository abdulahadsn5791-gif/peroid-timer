package com.periodtimer

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers the single native module. Linked to MainApplication by the
 * withPeriodTimerAndroid config plugin.
 */
// ReactPackage's members are deprecated in favor of the BaseReactPackage/
// TurboModule path, but the classic interface is still what prebuilt RN 0.86
// wires through PackageList — silence the deprecation until that migration.
@Suppress("DEPRECATION")
class PeriodTimerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(PeriodTimerSchedulerModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}