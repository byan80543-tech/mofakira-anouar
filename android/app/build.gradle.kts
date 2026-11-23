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
        versionCode = 18
        versionName = "0.9.9"
    }
    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("ANWAR_RELEASE_KEYSTORE_PATH")
            if (!keystorePath.isNullOrBlank()) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("ANWAR_RELEASE_STORE_PASSWORD")
                keyAlias = System.getenv("ANWAR_RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("ANWAR_RELEASE_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("debug") {
            // Previews are kept apart from the production app and earlier previews.
            applicationIdSuffix = ".preview.v18"
            versionNameSuffix = "-preview"
        }
        getByName("release") {
            // All public updates must retain this one private signing key forever.
            signingConfig = signingConfigs.getByName("release")
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


// Keep the canonical web application in one place. The Android APK receives
// the complete PWA shell and its local assets at build time; no menu is rebuilt
// or maintained as a separate Android-only copy.
val anwarWebSourceRoot = rootProject.projectDir.parentFile
val anwarWebAssets = layout.projectDirectory.dir("src/main/assets/www")
val syncAnwarWebAssets = tasks.register<Sync>("syncAnwarWebAssets") {
    from(anwarWebSourceRoot) {
        include("index.html")
        include("*.js")
        include("*.css")
        include("*.webmanifest")
        include("*.json")
        include("*.png")
        include("*.jpg")
        include("*.jpeg")
        include("*.svg")
        include("*.webp")
        include("_headers")
        include("assets/**")
        include("vendor/**")
        include("workers/**")
        include("functions/**")
        exclude("**/node_modules/**")
    }
    into(anwarWebAssets)
}
tasks.named("preBuild").configure {
    dependsOn(syncAnwarWebAssets)
}
