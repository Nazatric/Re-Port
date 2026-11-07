package app.report.port

import org.json.JSONArray
import org.json.JSONObject
import java.text.Normalizer

data class Port(
    val name: String = "", val developer: String = "", val kind: String = "site",
    val url: String = "", val download: String = "", val version: String = "",
    val updated: String = "", val added: String = "", val files: String = "",
    val filesNote: String = "", val works: String = "", val controller: String = "",
    val notes: String = "", val instructions: String = "", val lifecycle: String = "",
    val source: String = "", val downloads: Long = 0, val stars: Long = 0,
    val apk: Boolean = false, val paid: Boolean = false, val mirror: Boolean = false,
)
data class Game(
    val id: String, val title: String, val year: Int?, val platform: String,
    val platforms: List<String>, val genres: List<String>, val summary: String,
    val description: String, val cover: String, val launchbox: String, val descSource: String,
    val steamId: Long?, val screenshots: List<String>, val updated: String, val added: String,
    val views: Long, val ports: List<Port>, val supports: List<String>,
) {
    val popularity: Double get() = views + ports.sumOf { it.downloads / 10.0 + it.stars / 5.0 }
}
data class Platform(val id: String, val name: String, val short: String, val count: Int)
data class Collection(val id: String, val name: String, val blurb: String)
data class Catalog(
    val generated: String, val revision: String, val sources: List<String>,
    val platforms: List<Platform>, val collections: List<Collection>, val games: List<Game>,
) {
    val byId: Map<String, Game> by lazy { games.associateBy { it.id } }
}

private fun JSONObject.str(name: String): String = optString(name, "").takeUnless { it == "null" } ?: ""
private fun JSONArray?.strings(): List<String> = if (this == null) emptyList() else (0 until length()).mapNotNull { optString(it).takeIf(String::isNotBlank) }
private inline fun <T> JSONArray?.objects(transform: (JSONObject) -> T): List<T> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it)?.let(transform) }

fun parseCatalog(json: String): Catalog {
    val root = JSONObject(json)
    val games = root.optJSONArray("games").objects { g ->
        val steam = g.optJSONObject("steam")
        Game(
            id = g.str("id"), title = g.str("title"), year = g.optInt("year", 0).takeIf { it > 0 },
            platform = g.str("platform"), platforms = g.optJSONArray("platforms").strings(), genres = g.optJSONArray("genres").strings(),
            summary = g.str("summary"), description = g.str("description"), cover = g.str("cover"),
            launchbox = g.str("launchbox"), descSource = g.str("descSource"),
            steamId = steam?.optLong("id", 0)?.takeIf { it > 0 }, screenshots = steam?.optJSONArray("shots").strings(),
            updated = g.str("updated"), added = g.str("added"), views = g.optLong("views", 0),
            supports = g.optJSONArray("supports").strings(),
            ports = g.optJSONArray("ports").objects { p ->
                Port(p.str("name"), p.str("developer"), p.str("kind"), p.str("url"), p.str("download"),
                    p.str("version"), p.str("updated"), p.str("added"), p.str("files"), p.str("filesNote"),
                    p.str("works"), p.str("controller"), p.str("notes"), p.str("instructions"), p.str("lifecycle"),
                    p.str("source"), p.optLong("downloads", 0), p.optLong("stars", 0), p.optBoolean("apk"),
                    p.optBoolean("paid"), p.optBoolean("mirror"))
            },
        )
    }
    require(games.isNotEmpty() && games.all { it.id.isNotBlank() && it.title.isNotBlank() } && games.map { it.id }.toSet().size == games.size) { "Invalid catalog" }
    return Catalog(root.str("generated"), root.str("revision"), root.optJSONArray("sources").strings(),
        root.optJSONArray("platforms").objects { Platform(it.str("id"), it.str("name"), it.str("short"), it.optInt("count")) },
        root.optJSONArray("collections").objects { Collection(it.str("id"), it.str("name"), it.str("blurb")) }, games)
}

data class Filters(
    val query: String = "", val genre: String = "", val platform: String = "", val source: String = "",
    val works: Boolean = false, val noFiles: Boolean = false, val controller: Boolean = false,
    val sort: String = "popular",
)
fun normalizeText(text: String): String = Normalizer.normalize(text, Normalizer.Form.NFD)
    .replace(Regex("\\p{M}+"), "").lowercase().replace(Regex("[^a-z0-9]+"), " ").trim()

fun filterGames(catalog: Catalog, filters: Filters): List<Game> {
    val query = normalizeText(filters.query).split(' ').filter { it.isNotBlank() }
    val platforms = catalog.platforms.associate { it.id to it.name }
    val genres = catalog.collections.associate { it.id to it.name }
    val result = catalog.games.asSequence().filter { g ->
        (!filters.genre.isNotEmpty() || g.genres.contains(filters.genre) || (filters.genre == "other" && g.genres.isEmpty())) &&
        (filters.platform.isEmpty() || g.platform == filters.platform || filters.platform in g.platforms) &&
        (filters.source.isEmpty() || g.ports.any { p -> p.kind == filters.source || p.source.equals(filters.source, ignoreCase = true) }) &&
        (!filters.works || g.ports.any { it.works == "yes" }) && (!filters.noFiles || g.ports.any { it.files == "none" }) &&
        (!filters.controller || g.ports.any { it.controller == "both" || it.controller == "controller" }) &&
        (query.isEmpty() || normalizeText(listOf(g.title, platforms[g.platform].orEmpty(), g.genres.joinToString(" ") { genres[it] ?: it },
            g.ports.joinToString(" ") { "${it.name} ${it.developer}" }, g.year?.toString().orEmpty()).joinToString(" ")).let { text -> query.all { it in text } })
    }.toList()
    val titleQuery = normalizeText(filters.query)
    fun score(g: Game): Int {
        val title = normalizeText(g.title)
        return when { title == titleQuery -> 0; title.startsWith(titleQuery) -> 1; title.contains(titleQuery) -> 2; query.all { it in title } -> 3; else -> 4 }
    }
    val comparator: Comparator<Game> = when (filters.sort) {
        "title" -> compareBy(String.CASE_INSENSITIVE_ORDER) { it.title }
        "updated" -> compareByDescending<Game> { it.updated }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.title }
        "added" -> compareByDescending<Game> { it.added }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.title }
        "year" -> compareByDescending<Game> { it.year ?: 0 }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.title }
        else -> compareByDescending<Game> { it.popularity }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.title }
    }
    return if (query.isNotEmpty() && filters.sort == "popular") result.sortedWith(compareBy<Game> { score(it) }.then(comparator)) else result.sortedWith(comparator)
}
