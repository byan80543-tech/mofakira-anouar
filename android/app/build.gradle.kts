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
        versionCode = 14
        versionName = "0.9.5"
    }
    buildTypes {
        getByName("debug") {
            // Keep the test APK alongside the previously installed stable app.
            // Release builds keep the production application ID unchanged.
            applicationIdSuffix = ".preview.v14"
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
