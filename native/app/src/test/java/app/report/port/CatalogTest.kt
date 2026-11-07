package app.report.port

import org.junit.Assert.*
import org.junit.Test

class CatalogTest {
    private fun game(id: String, title: String, kind: String = "github", platform: String = "pc", genre: String = "action") = Game(
        id, title, 2000, platform, listOf(platform), listOf(genre), "summary", "description", "", "", "", null,
        emptyList(), "2026-01-01", "2026-01-01", 1, listOf(Port(name = title, developer = "Dev", kind = kind, download = "https://example.com", files = "none", works = "yes", controller = "both")), emptyList())
    private val catalog = Catalog("2026-01-01", "2026-01-01", listOf("source"),
        listOf(Platform("pc", "PC", "PC", 2), Platform("ps1", "PlayStation", "PS1", 1)),
        listOf(Collection("action", "Action", ""), Collection("rpg", "Role-playing", "")),
        listOf(game("doom", "Doom"), game("doom2", "Doom II"), game("zelda", "Zélda", "telegram", "ps1", "rpg")))

    @Test fun `search is accent insensitive and ranks exact titles`() {
        assertEquals("zelda", filterGames(catalog, Filters(query = "zelda")).single().id)
        assertEquals("doom", filterGames(catalog, Filters(query = "doom")).first().id)
    }
    @Test fun `filters by source platform genre and capabilities`() {
        assertEquals(listOf("zelda"), filterGames(catalog, Filters(platform = "ps1", genre = "rpg", source = "telegram", works = true, noFiles = true, controller = true)).map { it.id })
        assertTrue(filterGames(catalog, Filters(source = "not-a-source")).isEmpty())
    }
    @Test fun `sorting returns the complete set`() {
        val results = filterGames(catalog, Filters(sort = "title"))
        assertEquals(3, results.size)
        assertEquals("Doom", results.first().title)
    }
}
