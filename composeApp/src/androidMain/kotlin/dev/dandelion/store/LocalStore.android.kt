package dev.dandelion.store

import android.content.Context

actual class LocalStore {
    private val prefs get() = AndroidApp.context.getSharedPreferences("report", Context.MODE_PRIVATE)
    actual fun get(key: String): String? = prefs.getString(key, null)
    actual fun put(key: String, value: String) { prefs.edit().putString(key, value).apply() }
}
