package app.report.port

import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

data class ReleaseAsset(val name: String, val url: String, val size: Long)
data class ReleaseInfo(val title: String, val date: String, val url: String, val prerelease: Boolean, val assets: List<ReleaseAsset>)
private val releases = ConcurrentHashMap<String, Pair<Long, ReleaseInfo>>()

private fun parseRelease(o: JSONObject): ReleaseInfo {
    val assets = o.optJSONArray("assets") ?: JSONArray()
    return ReleaseInfo(o.optString("name").ifBlank { o.optString("tag_name") }, o.optString("published_at").take(10), o.optString("html_url"), o.optBoolean("prerelease"),
        (0 until assets.length()).mapNotNull { assets.optJSONObject(it) }.map { ReleaseAsset(it.optString("name"), it.optString("browser_download_url"), it.optLong("size")) })
}

private fun githubRepository(port: Port): Pair<String, String>? {
    val u = runCatching { Uri.parse(port.url) }.getOrNull() ?: return null
    if (!u.scheme.equals("https", true) || !u.host.equals("github.com", true)) return null
    val parts = u.pathSegments
    if (parts.size < 2 || !parts[0].matches(Regex("[A-Za-z0-9_.-]+")) || !parts[1].matches(Regex("[A-Za-z0-9_.-]+"))) return null
    return parts[0] to parts[1].removeSuffix(".git")
}

private fun fetchRelease(owner: String, repo: String): ReleaseInfo? {
    val key = "$owner/$repo".lowercase()
    releases[key]?.let { if (System.currentTimeMillis() - it.first < 3 * 60 * 60 * 1000L) return it.second }
    fun request(path: String): Pair<Int, String> {
        val conn = URL("https://api.github.com/repos/${Uri.encode(owner)}/${Uri.encode(repo)}/$path").openConnection() as HttpURLConnection
        conn.connectTimeout = 8000; conn.readTimeout = 10000
        conn.setRequestProperty("Accept", "application/vnd.github+json"); conn.setRequestProperty("User-Agent", "RePort-Android/2")
        return try {
            val code = conn.responseCode
            val text = if (code == 200) conn.inputStream.bufferedReader().use { it.readText().take(500000) } else ""
            code to text
        } finally { conn.disconnect() }
    }
    val (code, body) = request("releases/latest")
    val json = if (code == 200) JSONObject(body) else if (code == 404) {
        val (listCode, listBody) = request("releases?per_page=1")
        if (listCode == 200) JSONArray(listBody).optJSONObject(0) else null
    } else null
    return json?.let(::parseRelease)?.also { releases[key] = System.currentTimeMillis() to it }
}

@Composable
fun GithubReleaseCard(port: Port, openUrl: (String) -> Unit) {
    val repo = remember(port.url) { githubRepository(port) } ?: return
    val dataSaver = LocalDataSaver.current
    var status by remember(repo, dataSaver) { mutableStateOf(if (dataSaver) "Data saver is on." else "Checking latest release…") }
    val info by produceState<ReleaseInfo?>(null, repo, dataSaver) {
        if (!dataSaver) {
            val result = withContext(Dispatchers.IO) { runCatching { fetchRelease(repo.first, repo.second) }.getOrNull() }
            value = result
            status = if (result == null) "Live release details are unavailable; you can still open the release page." else ""
        }
    }
    val p = LocalReportColors.current
    Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp)) {
        Text("Latest GitHub release", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = p.text)
        if (info == null) Text(status, color = p.muted, fontSize = 12.sp)
        info?.let { release ->
            Text(release.title, color = p.text, fontWeight = FontWeight.SemiBold)
            Text(listOf(release.date, if (release.prerelease) "Pre-release" else "").filter(String::isNotBlank).joinToString(" · "), color = p.muted, fontSize = 12.sp)
            release.assets.filter { it.name.endsWith(".apk", true) || it.name.endsWith(".apks", true) || it.name.endsWith(".aab", true) || it.name.endsWith(".xapk", true) }.take(8).forEach { asset ->
                TextButton(onClick = { openUrl(asset.url) }) { Text(asset.name, maxLines = 2) }
            }
            OutlinedButton(onClick = { openUrl(release.url) }) { Text("Open release") }
        }
    }
}
