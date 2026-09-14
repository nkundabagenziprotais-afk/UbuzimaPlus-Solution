plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val previewKeystorePath =
    System.getenv("UBIZIMA_PREVIEW_KEYSTORE_PATH")
val previewStorePassword =
    System.getenv("UBIZIMA_PREVIEW_STORE_PASSWORD")
val previewKeyAlias =
    System.getenv("UBIZIMA_PREVIEW_KEY_ALIAS")
val previewKeyPassword =
    System.getenv("UBIZIMA_PREVIEW_KEY_PASSWORD")
val previewStoreType =
    System.getenv("UBIZIMA_PREVIEW_STORE_TYPE")

val previewSigningConfigured =
    listOf(
        previewKeystorePath,
        previewStorePassword,
        previewKeyAlias,
        previewKeyPassword,
        previewStoreType,
    ).all { !it.isNullOrBlank() }

if (
    System.getenv("CI") == "true" &&
    !previewSigningConfigured
) {
    throw org.gradle.api.GradleException(
        "Permanent Ubuzima+ Preview signing is required in CI."
    )
}

android {
    namespace = "com.ubuzimaplus.preview"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.ubuzimaplus.preview"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // Flutter 3.35+ adds ARM32, ARM64 and x86_64 release ABI filters by default.
        // Ubuzima+ Preview 3.2.0 is intentionally distributed as an ARM64 APK.
        ndk {
            abiFilters.clear()
            abiFilters.addAll(listOf("arm64-v8a"))
        }
    }

    signingConfigs {
        if (previewSigningConfigured) {
            create("previewRelease") {
                storeFile = file(previewKeystorePath!!)
                storePassword = previewStorePassword!!
                keyAlias = previewKeyAlias!!
                keyPassword = previewKeyPassword!!
                storeType = previewStoreType!!
            }
        }
    }

    buildTypes {
        release {
            // Preview CI build is re-signed with the stable Ubuzima+ Preview key before distribution.
            signingConfig =
                if (previewSigningConfigured) {
                    signingConfigs.getByName("previewRelease")
                } else {
                    // Local-only fallback. CI requires permanent signing.
                    signingConfigs.getByName("debug")
                }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
