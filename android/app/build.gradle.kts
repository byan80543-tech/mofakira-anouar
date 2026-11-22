plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.anwar.mofakira"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.anwar.mofakira"
        minSdk = 23
        targetSdk = 35
        versionCode = 7
        versionName = "0.7.0"
    }
    buildTypes {
        getByName("debug") {
            // Keep the test APK alongside the previously installed stable app.
            // Release builds keep the production application ID unchanged.
            applicationIdSuffix = ".preview.v07"
            versionNameSuffix = "-preview"
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }
}
dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.webkit:webkit:1.13.0")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("androidx.media3:media3-exoplayer:1.11.1")
    implementation("androidx.media3:media3-session:1.11.1")
}
