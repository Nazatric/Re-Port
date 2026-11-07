package app.report.port

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

private const val DEFAULT_CATALOG_URL = "https://raw.githubusercontent.com/Nazatric/Re-Port/arena/59c5f4cf-re-port/public/catalog.json"
private const val MAX_CATALOG_BYTES = 16 * 1024 * 1024

data class AppSettings(
    val theme: String = "system", val textSize: Int = 0, val reduceMotion: Boolean = false,
    val dataSaver: Boolean = false, val haptics: Boolean = true, val highContrast: Boolean = false,
    val listView: Boolean = false, val autoUpdate: Boolean = true, val catalogUrl: String = DEFAULT_CATALOG_URL,
)

class ReportViewModel(app: Application) : AndroidViewModel(app) {
    private val prefs = app.getSharedPreferences("report-native", 0)
    private val cachedCatalog = File(app.filesDir, "catalog.json")
    var catalog by mutableStateOf<Catalog?>(null); private set
    var loadingError by mutableStateOf<String?>(null); private set
    var updateStatus by mutableStateOf(""); private set
    var updating by mutableStateOf(false); private set
    var settings by mutableStateOf(readSettings()); private set
    var saved by mutableStateOf(prefs.getStringSet("saved", emptySet())?.toSet() ?: emptySet()); private set
    var recent by mutableStateOf(readRecent()); private set

    init { load() }
    private fun readSettings() = AppSettings(
        theme = prefs.getString("theme", "system") ?: "system", textSize = prefs.getInt("textSize", 0).coerceIn(0, 2),
        reduceMotion = prefs.getBoolean("reduceMotion", false), dataSaver = prefs.getBoolean("dataSaver", false),
        haptics = prefs.getBoolean("haptics", true), highContrast = prefs.getBoolean("highContrast", false),
        listView = prefs.getBoolean("listView", false), autoUpdate = prefs.getBoolean("autoUpdate", true),
        catalogUrl = prefs.getString("catalogUrl", DEFAULT_CATALOG_URL) ?: DEFAULT_CATALOG_URL,
    )
    private fun readRecent() = prefs.getString("recent", "").orEmpty().split('|').filter { it.isNotBlank() }
    fun updateSettings(s: AppSettings) {
        settings = s
        prefs.edit().putString("theme", s.theme).putInt("textSize", s.textSize).putBoolean("reduceMotion", s.reduceMotion)
            .putBoolean("dataSaver", s.dataSaver).putBoolean("haptics", s.haptics).putBoolean("highContrast", s.highContrast)
            .putBoolean("listView", s.listView).putBoolean("autoUpdate", s.autoUpdate).putString("catalogUrl", s.catalogUrl).apply()
    }
    fun toggleSaved(id: String) {
        saved = if (id in saved) saved - id else saved + id
        prefs.edit().putStringSet("saved", saved).apply()
    }
    fun clearSaved() { saved = emptySet(); prefs.edit().remove("saved").apply() }
    fun addRecent(id: String) {
        recent = (listOf(id) + recent.filterNot { it == id }).take(24)
        prefs.edit().putString("recent", recent.joinToString("|")).apply()
    }
    fun clearRecent() { recent = emptyList(); prefs.edit().remove("recent").apply() }
    fun saveSubmission(text: String) {
        val previous = prefs.getString("submissions", "").orEmpty()
        prefs.edit().putString("submissions", listOf(text, previous).filter(String::isNotBlank).joinToString("\n\n---\n\n")).apply()
    }
    fun submissions(): String = prefs.getString("submissions", "").orEmpty()
    fun clearSubmissions() { prefs.edit().remove("submissions").apply() }

    fun load() {
        viewModelScope.launch {
            loadingError = null
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val bundled = getApplication<Application>().assets.open("catalog.json").bufferedReader().use { parseCatalog(it.readText()) }
                    val cached = runCatching { if (cachedCatalog.isFile && cachedCatalog.length() <= MAX_CATALOG_BYTES) parseCatalog(cachedCatalog.readText()) else null }.getOrNull()
                    if (cached != null && isNewer(cached, bundled)) cached else bundled
                }
            }
            result.onSuccess { catalog = it; if (settings.autoUpdate) refreshCatalog(silent = true) }
                .onFailure { loadingError = "Could not load the bundled catalog. Please reinstall the app." }
        }
    }
    fun refreshCatalog(silent: Boolean = false) {
        if (updating) return
        if (!settings.catalogUrl.startsWith("https://", ignoreCase = true)) {
            updateStatus = "Catalog URL must use HTTPS."; return
        }
        viewModelScope.launch {
            updating = true
            if (!silent) updateStatus = "Checking for updates…"
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val conn = (URL(settings.catalogUrl).openConnection() as HttpURLConnection).apply {
                        connectTimeout = 10000; readTimeout = 15000; instanceFollowRedirects = false
                        setRequestProperty("User-Agent", "RePort-Android/2")
                    }
                    try {
                        require(conn.responseCode == 200) { "HTTP ${conn.responseCode}" }
                        require(conn.contentLengthLong <= MAX_CATALOG_BYTES) { "Catalog is too large" }
                        val bytes = conn.inputStream.use { input ->
                            val out = java.io.ByteArrayOutputStream()
                            val buffer = ByteArray(8192)
                            while (true) { val n = input.read(buffer); if (n < 0) break; require(out.size() + n <= MAX_CATALOG_BYTES); out.write(buffer, 0, n) }
                            out.toByteArray()
                        }
                        val text = bytes.toString(Charsets.UTF_8)
                        val parsed = parseCatalog(text)
                        require(parsed.games.size >= 50 && parsed.generated.isNotBlank() && parsed.platforms.isNotEmpty() && parsed.collections.isNotEmpty()) { "Incomplete catalog" }
                        parsed to text
                    } finally { conn.disconnect() }
                }
            }
            result.onSuccess { (next, text) ->
                val current = catalog
                if (current == null || isNewer(next, current)) {
                    val persisted = withContext(Dispatchers.IO) { runCatching {
                        val temp = File(cachedCatalog.parentFile, "catalog.tmp")
                        temp.writeText(text)
                        check(temp.renameTo(cachedCatalog))
                    }.isSuccess }
                    catalog = next
                    updateStatus = if (persisted) "Catalog updated · ${next.games.size} entries" else "Catalog updated for this session; could not save offline."
                } else if (!silent) updateStatus = "Catalog is up to date."
            }.onFailure { if (!silent) updateStatus = "Could not check for updates. Your offline catalog is still available." }
            updating = false
        }
    }
    private fun isNewer(a: Catalog, b: Catalog): Boolean =
        a.generated > b.generated || (a.generated == b.generated && (a.revision > b.revision || (a.revision == b.revision && a.games.size > b.games.size)))
}
