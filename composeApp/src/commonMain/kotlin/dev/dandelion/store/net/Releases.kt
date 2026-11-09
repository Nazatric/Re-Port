package dev.dandelion.store.net

import dev.dandelion.store.data.Game
import dev.dandelion.store.data.PortProject
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.delay
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** F-Droid-style release resolution: read the upstream release index, pick the best
 *  arm64-v8a / universal APK, hand the real URL to the platform downloader.
 *  No account or API key. All requests have a deadline and bounded retries. */
@Serializable data class Asset(val name: String = "", val browser_download_url: String = "", val size: Long = 0)
@Serializable data class Release(val tag_name: String = "", val html_url: String = "", val assets: List<Asset> = emptyList())

data class ResolvedDownload(
    val url: String, val label: String, val fileName: String? = null,
    val sizeMb: Float? = null, val version: String? = null, val isApk: Boolean = false,
)

private val http = HttpClient()
private val json = Json { ignoreUnknownKeys = true; isLenient = true }
private val lru = LinkedHashMap<String, Pair<Long, Release>>()
private const val TTL = 30 * 60 * 1000L

private suspend fun <T> retry(tries: Int = 3, block: suspend () -> T): T {
    var last: Throwable? = null
    for (i in 0 until tries) {
        try { return block() } catch (e: Throwable) { last = e; if (i < tries - 1) delay(350L * (1L shl i)) }
    }
    throw last ?: IllegalStateException("Request failed")
}

fun githubRepo(url: String): Pair<String, String>? {
    val m = Regex("github\\.com/([^/]+)/([^/#?]+)").find(url) ?: return null
    return m.groupValues[1] to m.groupValues[2]
}
fun pickAsset(assets: List<Asset>): Asset? = assets.filter { a ->
    a.name.endsWith(".apk", true) && !Regex("(debug|test|unsigned)", RegexOption.IGNORE_CASE).containsMatchIn(a.name)
}.maxWithOrNull(compareBy<Asset> {
    val n = it.name.lowercase()
    when {
        Regex("arm64|aarch64").containsMatchIn(n) -> 100
        Regex("universal|allabi|full").containsMatchIn(n) -> 90
        Regex("armeabi|armv7").containsMatchIn(n) -> 60
        Regex("x86_64").containsMatchIn(n) -> 40
        else -> 75
    }
}.thenBy { it.size })

suspend fun resolveDownload(game: Game, port: PortProject): ResolvedDownload {
    val source = port.download.ifEmpty { port.url }
    val repo = githubRepo(port.url.ifEmpty { source })
    if (repo == null || !port.apk) {
        return ResolvedDownload(source, "Open download source")
    }
    val (owner, name) = repo
    val key = "$owner/$name"
    val cached = lru[key]?.let { (at, r) -> if (SystemTime.now() - at < TTL) r else null }
    val latest = "https://api.github.com/repos/$key/releases/latest"
    val listUrl = "https://api.github.com/repos/$key/releases?per_page=10"
    val fallbackUrl = if (Regex("/releases(/|$)").containsMatchIn(port.download)) port.download
        else "${port.url.trimEnd('/')}/releases"

    val release: Release? = try {
        val text = retry { http.get(latest).bodyAsText() }
        json.decodeFromString<Release>(text).also { lru[key] = SystemTime.now() to it }
    } catch (_: Throwable) {
        cached ?: try {
            val text = retry(2) { http.get(listUrl).bodyAsText() }
            val list = json.decodeFromString<List<Release>>(text)
            list.firstOrNull { pickAsset(it.assets) != null } ?: list.firstOrNull()
        } catch (_: Throwable) { null }
    }
    if (release == null) return ResolvedDownload(fallbackUrl, "Open releases page")
    val asset = pickAsset(release.assets)
    return if (asset != null) ResolvedDownload(
        asset.browser_download_url, "Download latest APK", asset.name,
        kotlin.math.round(asset.size / 100_000f) / 10f, release.tag_name, true,
    ) else ResolvedDownload(port.download.ifEmpty { release.html_url.ifEmpty { fallbackUrl } }, "Open releases page", version = release.tag_name)
}

private object SystemTime {
    private val start = kotlin.time.TimeSource.Monotonic.markNow()
    fun now(): Long = (kotlin.time.TimeSource.Monotonic.markNow() - start).inWholeMilliseconds
}
