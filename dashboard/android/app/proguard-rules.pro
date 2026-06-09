# Fuji Studio — ProGuard/R8 rules

# Keep Capacitor bridge classes (required — obfuscation breaks JS↔Java bridge)
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod public *;
}

# Keep WebView JS interface classes if addJavascriptInterface() is ever used.
# Replace fqcn.of.javascript.interface.for.webview with the actual class name.
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Preserve stack trace line numbers in crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**
