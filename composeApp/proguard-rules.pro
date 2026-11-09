# kotlinx.serialization generated serializers are retained by the plugin rules.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class dev.dandelion.store.data.** { *; }
-assumenosideeffects class android.util.Log { public static int d(...); public static int v(...); }
