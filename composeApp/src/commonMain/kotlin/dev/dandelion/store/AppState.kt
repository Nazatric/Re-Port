package dev.dandelion.store

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import dev.dandelion.store.data.Catalog
import dev.dandelion.store.data.CatalogStore
import dev.dandelion.store.data.Game
import dev.dandelion.store.data.gameById
import dev.dandelion.store.data.SearchIndex

enum class Tab(val label: String) { HOME("Home"), BROWSE("Browse"), LIBRARY("Library"), SETTINGS("Settings") }
sealed interface Route {
    data class GameDetail(val id: String) : Route
    data class Collection(val name: String) : Route
    data object About : Route
}
enum class ThemeName(val label: String) { NXE("NXE Green"), MEADOW("Meadow"), SKY("Sky"), NIGHT("Night · Aero") }

enum class AvatarPreset(val id: String, val label: String) {
    GAMEPAD("gamepad", "Gamepad"),
    INITIALS("initials", "Initials"),
    NXE("nxe", "NXE Buddy"),
    DANDELION("dandelion", "Dandelion"),
    SWORD("sword", "Blade"),
    CROWN("crown", "Crown"),
    GHOST("ghost", "Ghost"),
    FLAME("flame", "Flame"),
    BOLT("bolt", "Volt"),
    PLANET("planet", "Orbit"),
    HEART("heart", "1-Up"),
    SHIELD("shield", "Crest");

    companion object {
        fun of(id: String): AvatarPreset = entries.firstOrNull { it.id == id } ?: GAMEPAD
    }
}

data class AvatarConfig(
    val mode: String = "preset", // "preset" | "image"
    val preset: AvatarPreset = AvatarPreset.GAMEPAD,
    val imageUrl: String = "",
)

data class BrowsePreset(
    val fileNeeds: Set<String> = emptySet(),
    val onlyApk: Boolean = false,
)

/** Persistent local state backed by Android SharedPreferences. */
expect class LocalStore() {
    fun get(key: String): String?
    fun put(key: String, value: String)
}

class AppState(private val store: LocalStore) {
    var catalog: Catalog? by mutableStateOf(null)
    var searchIndex: SearchIndex? by mutableStateOf(null)

    var name by mutableStateOf(store.get("name") ?: "")
    var avatar by mutableStateOf(
        AvatarConfig(
            mode = store.get("avatar_mode") ?: "preset",
            preset = AvatarPreset.of(store.get("avatar_preset") ?: "gamepad"),
            imageUrl = store.get("avatar_image") ?: "",
        )
    )
    var browsePreset by mutableStateOf<BrowsePreset?>(null)
    fun goBrowse(preset: BrowsePreset? = null) { browsePreset = preset; tab = Tab.BROWSE }
    var onboarded by mutableStateOf(!(store.get("name") ?: "").isEmpty())
    var editNameOpen by mutableStateOf(false)

    fun saveAvatar(cfg: AvatarConfig) {
        avatar = cfg
        store.put("avatar_mode", cfg.mode)
        store.put("avatar_preset", cfg.preset.id)
        store.put("avatar_image", cfg.imageUrl)
    }

    fun finishOnboarding(value: String, av: AvatarConfig? = null) {
        val v = value.trim().take(20)
        if (v.isEmpty()) return
        name = v; store.put("name", v)
        if (av != null) saveAvatar(av)
        onboarded = true
    }
    fun setName(value: String) {
        val v = value.trim().take(20)
        if (v.isEmpty()) return
        name = v; store.put("name", v)
    }

    var theme by mutableStateOf(runCatching { ThemeName.valueOf(store.get("theme") ?: "NXE") }.getOrDefault(ThemeName.NXE))
    var animations by mutableStateOf(store.get("animations") != "0")
    var reflections by mutableStateOf(store.get("reflections") != "0")
    var bubbles by mutableStateOf(store.get("bubbles") != "0")
    var autoplay by mutableStateOf(store.get("autoplay") == "1")
    var haptics by mutableStateOf(store.get("haptics") != "0")
    fun setTheme(v: ThemeName) { theme = v; store.put("theme", v.name) }
    fun setBool(key: String, v: Boolean) {
        store.put(key, if (v) "1" else "0")
        when (key) {
            "animations" -> animations = v; "reflections" -> reflections = v
            "bubbles" -> bubbles = v; "autoplay" -> autoplay = v; "haptics" -> haptics = v
        }
    }

    var tab by mutableStateOf(Tab.HOME)
    val stack = mutableStateListOf<Route>()
    val canGoBack: Boolean get() = stack.isNotEmpty()
    fun push(r: Route) { stack.add(r) }
    fun pop() { if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex) }

    val saved = mutableStateListOf<String>().apply {
        (store.get("saved") ?: "").split(",").filter { it.isNotEmpty() }.forEach(::add)
    }
    val recent = mutableStateListOf<String>().apply {
        (store.get("recent") ?: "").split(",").filter { it.isNotEmpty() }.forEach(::add)
    }
    fun toggleSaved(id: String) {
        if (!saved.remove(id)) saved.add(id)
        store.put("saved", saved.joinToString(","))
    }
    fun visit(id: String) {
        recent.remove(id); recent.add(0, id)
        while (recent.size > 24) recent.removeAt(recent.lastIndex)
        store.put("recent", recent.joinToString(","))
    }

    var toast by mutableStateOf<String?>(null)
    var toastKey by mutableStateOf(0)
    fun showToast(m: String) { toast = m; toastKey++ }

    suspend fun loadCatalog() {
        val c = CatalogStore.get()
        catalog = c
        searchIndex = SearchIndex(c)
    }
    fun game(id: String): Game? = catalog?.gameById(id)
}

val LocalAppState = staticCompositionLocalOf<AppState> { error("AppState missing") }
