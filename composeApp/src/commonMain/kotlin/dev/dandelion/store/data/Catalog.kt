package dev.dandelion.store.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import dev.dandelion.store.resources.Res
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Serializable
data class PortProject(
    val name: String = "", val developer: String = "", val kind: String = "",
    val url: String = "", val download: String = "", val version: String = "",
    val updated: String = "", val apk: Boolean = false, val files: String = "unknown",
    val filesNote: String = "", val engine: String = "", val controller: String = "",
    val evidence: String = "", val stars: Int = 0, val downloads: Int = 0,
)
@Serializable
data class Game(
    val id: String, val title: String, val year: Int = 0, val platform: String = "Other",
    val genres: List<String> = emptyList(), val collections: List<String> = emptyList(),
    val summary: String = "", val description: String = "", val cover: String = "",
    val coverRatio: Float = 0.75f, val shots: List<String> = emptyList(),
    val updated: String = "", val added: String = "", val views: Int = 0,
    val steamAppId: Int? = null, val ports: List<PortProject> = emptyList(),
)
@Serializable
data class Collection(val id: String, val name: String, val blurb: String = "")
@Serializable
data class Catalog(
    val generated: String = "", val upstream: String = "", val revision: String = "",
    val sources: List<String> = emptyList(), val collections: List<Collection> = emptyList(),
    val games: List<Game> = emptyList(),
)

val kindLabels = mapOf(
    "github" to "GitHub", "telegram" to "Telegram", "site" to "Project site", "playstore" to "Play Store",
    "4pda" to "4PDA", "discord" to "Discord", "mirror" to "Mirror", "itch" to "itch.io", "reddit" to "Reddit",
    "web" to "Website", "gamejolt" to "Game Jolt", "archive" to "Internet Archive", "fdroid" to "F-Droid",
    "gitlab" to "GitLab", "gamebanana" to "GameBanana",
)
val fileLabels = mapOf(
    "files" to "Bring PC game files", "rom" to "Bring a disc / ROM", "none" to "Ready to play",
    "app" to "Complete app", "unknown" to "See project instructions",
)
val evidenceLabels = mapOf(
    "github-apk" to "APK release verified", "github-readme" to "Android build documented", "napl-list" to "Listed in NAPL",
)

/** Single source of truth: the exact same catalog.json bundled in the web build. */
object CatalogStore {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    @Volatile private var cached: Catalog? = null

    suspend fun get(): Catalog = cached ?: withContext(Dispatchers.Default) {
        val raw = Res.readBytes("files/catalog.json").decodeToString()
        val parsed = json.decodeFromString<Catalog>(raw)
        cached = parsed
        parsed
    }
    fun peek(): Catalog? = cached
}

fun Catalog.gameById(id: String): Game? = games.firstOrNull { it.id == id }
fun primaryPort(game: Game): PortProject = game.ports.maxByOrNull(::scorePort) ?: game.ports.first()
private fun scorePort(p: PortProject) = (if (p.apk) 1000 else 0) + (if (p.evidence == "github-apk") 600 else 0) +
    (if (p.kind == "github") 300 else 0) + p.downloads.coerceAtMost(200) + p.stars.coerceAtMost(100) +
    (if (p.version.isNotEmpty()) 20 else 0) +
    (if (Regex("android|apk|mobile", RegexOption.IGNORE_CASE).containsMatchIn(p.name)) 150 else 0) -
    (if (Regex("launcher|tool|manager|patcher|builder|art", RegexOption.IGNORE_CASE).containsMatchIn(p.name)) 500 else 0)
fun Catalog.primaryPort(game: Game): PortProject {
    fun score(p: PortProject) = (if (p.apk) 1000 else 0) + (if (p.evidence == "github-apk") 600 else 0) +
        (if (p.kind == "github") 300 else 0) + p.downloads.coerceAtMost(200) + p.stars.coerceAtMost(100) +
        (if (p.version.isNotEmpty()) 20 else 0) +
        (if (Regex("android|apk|mobile", RegexOption.IGNORE_CASE).containsMatchIn(p.name)) 150 else 0) -
        (if (Regex("launcher|tool|manager|patcher|builder|art", RegexOption.IGNORE_CASE).containsMatchIn(p.name)) 500 else 0)
    return game.ports.maxByOrNull(::score) ?: game.ports.first()
}

enum class SortMode(val label: String) { RELEVANCE("Relevance"), NAME("Title A–Z"), NEWEST("Newest"), OLDEST("Oldest"), POPULAR("Most viewed"), PORTS("Most ports") }

data class Filters(
    val query: String = "", val collections: Set<String> = emptySet(), val genres: Set<String> = emptySet(),
    val platforms: Set<String> = emptySet(), val kinds: Set<String> = emptySet(), val engines: Set<String> = emptySet(),
    val fileNeeds: Set<String> = emptySet(), val evidence: Set<String> = emptySet(), val decades: Set<Int> = emptySet(),
    val onlySaved: Boolean = false, val onlyApk: Boolean = false, val sort: SortMode = SortMode.RELEVANCE,
) {
    val count: Int get() = (if (query.isBlank()) 0 else 1) + collections.size + genres.size + platforms.size +
        kinds.size + engines.size + fileNeeds.size + evidence.size + decades.size +
        (if (onlySaved) 1 else 0) + (if (onlyApk) 1 else 0)
}

fun Catalog.filters(): FilterFacets = FilterFacets(
    genres = games.flatMap { it.genres }.distinct().sorted(),
    platforms = games.map { it.platform }.distinct().sorted(),
    kinds = games.flatMap { it.ports.map { p -> p.kind } }.distinct().sorted(),
    engines = games.flatMap { it.ports.mapNotNull { p -> p.engine.takeIf { it.isNotEmpty() } } }.distinct().sorted(),
    fileNeeds = games.flatMap { it.ports.map { p -> p.files } }.distinct().sorted(),
    evidence = games.flatMap { it.ports.mapNotNull { p -> p.evidence.takeIf { it.isNotEmpty() } } }.distinct().sorted(),
)
data class FilterFacets(
    val genres: List<String>, val platforms: List<String>, val kinds: List<String>,
    val engines: List<String>, val fileNeeds: List<String>, val evidence: List<String>,
)

/** Precomputed lowercase haystack keeps search off the composition critical path. */
class SearchIndex(catalog: Catalog) {
    private val map: Map<String, String> = catalog.games.associate { g ->
        g.id to listOf(g.title, g.platform, g.year.toString(), *g.genres.toTypedArray(),
            *g.ports.map { "${it.name} ${it.developer} ${it.engine} ${it.url}" }.toTypedArray())
            .joinToString(" ").lowercase()
    }
    fun matches(g: Game, terms: List<String>): Boolean {
        if (terms.isEmpty()) return true
        val hay = map[g.id] ?: return false
        return terms.all { hay.contains(it) }
    }
}

fun Catalog.applyFilters(f: Filters, saved: Set<String>, index: SearchIndex): List<Game> {
    val terms = f.query.trim().lowercase().split(Regex("\\s+")).filter { it.isNotEmpty() }
    val out = games.filter { g ->
        if (!index.matches(g, terms)) return@filter false
        if (f.collections.isNotEmpty() && f.collections.none { g.collections.contains(it) }) return@filter false
        if (f.genres.isNotEmpty() && f.genres.none { g.genres.contains(it) }) return@filter false
        if (f.platforms.isNotEmpty() && !f.platforms.contains(g.platform)) return@filter false
        if (f.kinds.isNotEmpty() && g.ports.none { f.kinds.contains(it.kind) }) return@filter false
        if (f.engines.isNotEmpty() && g.ports.none { f.engines.contains(it.engine) }) return@filter false
        if (f.fileNeeds.isNotEmpty() && g.ports.none { f.fileNeeds.contains(it.files) }) return@filter false
        if (f.evidence.isNotEmpty() && g.ports.none { f.evidence.contains(it.evidence) }) return@filter false
        if (f.decades.isNotEmpty() && f.decades.none { g.year >= it && g.year < it + 10 }) return@filter false
        if (f.onlySaved && g.id !in saved) return@filter false
        if (f.onlyApk && g.ports.none { it.apk }) return@filter false
        true
    }
    return when (f.sort) {
        SortMode.NAME -> out.sortedBy { it.title }
        SortMode.NEWEST -> out.sortedByDescending { it.year }
        SortMode.OLDEST -> out.sortedBy { it.year }
        SortMode.POPULAR -> out.sortedByDescending { it.views }
        SortMode.PORTS -> out.sortedByDescending { it.ports.size }
        SortMode.RELEVANCE -> out.sortedWith(compareByDescending<Game> { it.ports.any { p -> p.apk } }.thenByDescending { it.views })
    }
}
