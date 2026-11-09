# Re:Port

Native Android app extracted from `1st.zip` on the `App` branch. The UI uses Kotlin and Jetpack Compose; there is no Capacitor or WebView app in this branch. The archive's web preview and Wasm target are not included.

## Build

Install JDK 17 or newer, the Android SDK (API 35), and Gradle 8.13. The archive does not include the Gradle wrapper executable or JAR; generate them locally, then build the debug APK:

```sh
gradle wrapper --gradle-version 8.13
./gradlew :composeApp:assembleDebug
```

Release builds in the supplied project use the debug signing key. Configure a persistent release key before distributing them. The extracted project has not been built or tested in this environment.
