@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.dandelion.store.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.dandelion.store.LocalAppState
import dev.dandelion.store.Route
import dev.dandelion.store.Tab
import dev.dandelion.store.ThemeName
import dev.dandelion.store.data.Collection
import dev.dandelion.store.data.Filters
import dev.dandelion.store.data.Game
import dev.dandelion.store.data.gameById
import dev.dandelion.store.data.PortProject
import dev.dandelion.store.data.SortMode
import dev.dandelion.store.data.applyFilters
import dev.dandelion.store.data.evidenceLabels
import dev.dandelion.store.data.fileLabels
import dev.dandelion.store.data.filters
import dev.dandelion.store.data.kindLabels
import dev.dandelion.store.data.primaryPort
import dev.dandelion.store.net.ResolvedDownload
import dev.dandelion.store.net.resolveDownload
import dev.dandelion.store.openBrowser
import dev.dandelion.store.performDownload
import dev.dandelion.store.rememberLocalTime
import dev.dandelion.store.ui.BackHeader
import dev.dandelion.store.ui.Blade
import dev.dandelion.store.ui.BladeStack
import dev.dandelion.store.ui.ButtonSize
import dev.dandelion.store.ui.Chip
import dev.dandelion.store.ui.CoverFlow
import dev.dandelion.store.ui.DColors
import dev.dandelion.store.ui.DType
import dev.dandelion.store.ui.EmptyState
import dev.dandelion.store.ui.GameArt
import dev.dandelion.store.ui.GameShot
import dev.dandelion.store.ui.GlassTint
import dev.dandelion.store.ui.GlossButton
import dev.dandelion.store.ui.IconBubble
import dev.dandelion.store.ui.IconButton
import dev.dandelion.store.ui.InitialAvatar
import dev.dandelion.store.ui.RePortLogo
import dev.dandelion.store.ui.SectionHeader
import dev.dandelion.store.ui.SettingRow
import dev.dandelion.store.ui.GlossToggle
import dev.dandelion.store.ui.LimeBrush
import dev.dandelion.store.ui.isNight
import dev.dandelion.store.ui.subtleFill
import dev.dandelion.store.ui.surfaceFill
import dev.dandelion.store.ui.positiveBadge
import dev.dandelion.store.ui.glass
import dev.dandelion.store.ui.pressable
import kotlinx.coroutines.launch

/* ------------------------------ Home --------------------------------- */
@Composable
fun HomeScreen(topInset: Dp) {
    val state = LocalAppState.current
    val catalog = state.catalog ?: return Loading()
    val t = rememberLocalTime()
    val featured = listOf("super-mario-64", "hollow-knight", "celeste", "diablo", "the-elder-scrolls-iii-morrowind", "the-legend-of-zelda-ocarina-of-time", "half-life", "sonic-mania")
        .mapNotNull { catalog.gameById(it) }.filter { it.cover.isNotEmpty() }
    val recentGames = state.recent.mapNotNull { catalog.gameById(it) }.take(6)
    val readyCount = catalog.games.count { it.ports.any { p -> p.files == "none" } }
    val apkCount = catalog.games.count { it.ports.any { p -> p.apk } }
    val needFilesCount = catalog.games.count { it.ports.any { p -> p.files == "files" || p.files == "rom" } }
    val blades = listOf(
        Blade("library", "My Library", "${state.saved.size} saved · ${state.recent.size} viewed", Icons.Default.Favorite, "Open Library") { state.tab = Tab.LIBRARY },
        Blade("ready", "Ready to play", "$readyCount ports · no files needed", Icons.Default.CheckCircle, "See them") { state.goBrowse(dev.dandelion.store.BrowsePreset(fileNeeds = setOf("none"))) },
        Blade("apk", "APK releases", "$apkCount with Android builds", Icons.Default.Star, "Browse catalog") { state.goBrowse(dev.dandelion.store.BrowsePreset(onlyApk = true)) },
        Blade("files", "Bring your own files", "$needFilesCount need a legal copy", Icons.Default.List, "View requirements") { state.goBrowse(dev.dandelion.store.BrowsePreset(fileNeeds = setOf("files", "rom"))) },
    )
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 116.dp)) {
        item {
            Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = topInset + 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(CircleShape).background(Brush.verticalGradient(listOf(Color(0xFFC9EE6A), Color(0xFF5F9F22)))), contentAlignment = Alignment.Center) { RePortLogo(25.dp) }
                Spacer(Modifier.width(10.dp))
                Text("Re:Port", color = DColors.Ink, fontSize = 24.sp, fontWeight = FontWeight.Light)
                Spacer(Modifier.weight(1f))
                IconButton(Icons.Default.Search) { state.tab = Tab.BROWSE }
                Spacer(Modifier.width(8.dp))
                Row(Modifier.height(44.dp).pressable { state.editNameOpen = true }.glass(GlassTint.WHITE, CircleShape).padding(start = 6.dp, end = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    InitialAvatar(state.name, 32.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(state.name, color = DColors.Ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Column(Modifier.padding(horizontal = 20.dp).padding(top = 28.dp)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("${t.hour12}:${t.minuteLabel}", color = DColors.Ink, style = DType.Display)
                    Spacer(Modifier.width(8.dp)); Text(t.ampm, color = DColors.InkSoft, fontSize = 16.sp)
                }
                Text("${t.dateLabel} · ${t.greeting}, ${state.name}", color = DColors.InkSoft, fontSize = 13.sp)
            }
            SectionHeader("Featured community ports", Modifier.padding(horizontal = 20.dp).padding(top = 16.dp), "See all") { state.tab = Tab.BROWSE }
            CoverFlow(featured) { state.push(Route.GameDetail(it.id)) }
            Spacer(Modifier.height(12.dp))
            BladeStack(blades)
        }
        if (recentGames.isNotEmpty()) item {
            SectionHeader("Recently viewed", Modifier.padding(horizontal = 16.dp))
            androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(horizontal = 20.dp)) {
                items(recentGames) { g -> Column(Modifier.width(92.dp).pressable { state.push(Route.GameDetail(g.id)) }) { GameArt(g, Modifier.fillMaxWidth().aspectRatio(g.coverRatio)); Text(g.title, Modifier.padding(top = 6.dp), color = DColors.Ink, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 2) } }
            }
        }
        item {
            SectionHeader("Collections", Modifier.padding(horizontal = 16.dp).padding(top = 20.dp))
            Column(Modifier.padding(horizontal = 16.dp)) {
                catalog.collections.take(9).chunked(3).forEach { row ->
                    Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        row.forEachIndexed { i, c ->
                            val colors = listOf(0xFFB91C1C, 0xFF0284C7, 0xFF854D0E, 0xFF64748B, 0xFF15803D, 0xFF7C3AED)
                            Box(Modifier.weight(1f).height(86.dp).clip(RoundedCornerShape(16.dp))
                                .background(Brush.verticalGradient(listOf(Color(colors[(i + row[0].id.length) % colors.size]), Color(0xFF1C2530))))
                                .pressable { state.push(Route.Collection(c.name)) }.padding(10.dp), contentAlignment = Alignment.BottomStart) {
                                Column { Text(c.name, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold); Text("${catalog.games.count { it.collections.contains(c.id) }} ports", color = Color.White.copy(alpha = .8f), fontSize = 10.sp) }
                            }
                        }
                    }
                }
            }
        }
        item {
            SectionHeader("Recently added", Modifier.padding(horizontal = 16.dp).padding(top = 12.dp))
            Column(Modifier.padding(horizontal = 16.dp).glass().padding(6.dp)) {
                catalog.games.filter { it.added.isNotEmpty() }.sortedByDescending { it.added }.take(5).forEach { g ->
                    Row(Modifier.fillMaxWidth().pressable { state.push(Route.GameDetail(g.id)) }.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        GameArt(g, Modifier.width(48.dp).aspectRatio(g.coverRatio), radius = 10.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) { Text(g.title, color = DColors.Ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1); Text("${primaryPort(g).name} · ${g.platform}", color = DColors.InkSoft, fontSize = 11.5.sp, maxLines = 1) }
                        Text(g.added.takeLast(5), color = DColors.InkSoft, fontSize = 10.5.sp)
                    }
                }
            }
        }
    }
}

/* ------------------------------ Browse ------------------------------- */
@Composable
fun GameCard(game: Game, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val state = LocalAppState.current
    val wished = game.id in state.saved
    Box(modifier.glass().padding(8.dp)) {
        Column {
            Box(Modifier.pressable { onOpen() }) {
                GameArt(game, Modifier.fillMaxWidth().aspectRatio(game.coverRatio), radius = 12.dp)
                Box(Modifier.align(Alignment.BottomStart).padding(8.dp).clip(CircleShape).background(if (game.ports.any { it.apk }) DColors.LimeDeep else Color(0xFFB45309)).padding(horizontal = 8.dp, vertical = 3.dp)) {
                    Text(if (game.ports.any { it.apk }) "APK release" else "Project source", color = Color.White, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
                }
            }
            Column(Modifier.pressable { onOpen() }.padding(4.dp)) {
                Text(game.title, color = DColors.Ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 2)
                Text(primaryPort(game).name, color = DColors.InkSoft, fontSize = 11.sp, maxLines = 1)
                Text("${game.platform} · ${game.year}", color = DColors.InkSoft, fontSize = 11.sp)
            }
        }
        Box(Modifier.align(Alignment.TopEnd).padding(8.dp).size(40.dp).clip(CircleShape).background(surfaceFill()).pressable { state.toggleSaved(game.id) }, contentAlignment = Alignment.Center) {
            Icon(Icons.Default.Favorite, null, Modifier.size(16.dp), tint = if (wished) Color(0xFFE0452F) else DColors.InkSoft)
        }
    }
}

@Composable
fun BrowseScreen(topInset: Dp) {
    val state = LocalAppState.current
    val catalog = state.catalog ?: return Loading()
    var filters by remember { mutableStateOf(Filters()) }
    var showSheet by remember { mutableStateOf(false) }
    var limit by remember { mutableIntStateOf(48) }
    val facets = remember(catalog) { catalog.filters() }
    LaunchedEffect(state.browsePreset) {
        val preset = state.browsePreset
        if (preset != null) {
            filters = Filters(fileNeeds = preset.fileNeeds, onlyApk = preset.onlyApk)
            limit = 48
            state.browsePreset = null
        }
    }
    val results = remember(filters, state.saved.size, catalog) {
        catalog.applyFilters(filters, state.saved.toSet(), state.searchIndex ?: dev.dandelion.store.data.SearchIndex(catalog))
    }
    LaunchedEffect(filters) { limit = 48 }
    Box(Modifier.fillMaxSize()) {
        LazyVerticalGrid(columns = GridCells.Fixed(2), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 116.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item(span = { GridItemSpan(2) }) {
                Column {
                    Text("Browse", Modifier.padding(start = 20.dp, top = topInset + 16.dp), color = DColors.Ink, style = DType.ScreenTitle)
                    Text("${catalog.games.size} unofficial Android ports · ${catalog.collections.size} collections", Modifier.padding(start = 20.dp, top = 6.dp), color = DColors.InkSoft, fontSize = 12.5.sp)
                    Spacer(Modifier.height(14.dp))
                    Row(Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                        androidx.compose.material3.TextField(
                            value = filters.query,
                            onValueChange = { filters = filters.copy(query = it) },
                            singleLine = true,
                            placeholder = { Text("Games, port projects, engines, repos…", fontSize = 13.sp) },
                            leadingIcon = { Icon(Icons.Default.Search, null, Modifier.size(18.dp), tint = DColors.InkSoft) },
                            modifier = Modifier.weight(1f).height(52.dp).clip(CircleShape),
                            colors = androidx.compose.material3.TextFieldDefaults.colors(
                                focusedContainerColor = surfaceFill(),
                                unfocusedContainerColor = surfaceFill(),
                                focusedIndicatorColor = Color.Transparent,
                                unfocusedIndicatorColor = Color.Transparent,
                            ),
                        )
                        Spacer(Modifier.width(8.dp))
                        Box(Modifier.size(48.dp).pressable { showSheet = true }.glass(if (filters.count > 0) GlassTint.LIME else GlassTint.WHITE, CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Default.List, null, Modifier.size(20.dp), tint = if (filters.count > 0) Color.White else DColors.Ink) }
                    }
                    Spacer(Modifier.height(12.dp))
                    androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(horizontal = 16.dp)) {
                        item { Chip("All", filters.collections.isEmpty()) { filters = filters.copy(collections = emptySet()) } }
                        items(catalog.collections) { c -> Chip(c.name, c.id in filters.collections) { filters = filters.copy(collections = toggle(filters.collections, c.id)) } }
                    }
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${results.size} results", color = DColors.InkSoft, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text(filters.sort.label, Modifier.pressable {
                            val all = SortMode.entries
                            filters = filters.copy(sort = all[(all.indexOf(filters.sort) + 1) % all.size])
                        }, color = DColors.Azure, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                    if (filters.count > 0) Text("Clear ${filters.count} filters", Modifier.padding(horizontal = 16.dp).pressable { filters = Filters() }.clip(CircleShape).background(DColors.LimeDeep).padding(horizontal = 12.dp, vertical = 6.dp), color = Color.White, fontSize = 11.sp)
                    Spacer(Modifier.height(8.dp))
                }
            }
            if (results.isEmpty()) item(span = { GridItemSpan(2) }) { EmptyState("No ports match", "Try a different search or remove a filter.") }
            items(results.take(limit), key = { it.id }) { g -> GameCard(g, onOpen = { state.push(Route.GameDetail(g.id)) }) }
            if (limit < results.size) item(span = { GridItemSpan(2) }) {
                GlossButton("Load more (${results.size - limit} left)", { limit += 48 }, Modifier.fillMaxWidth(), GlassTint.WHITE, ButtonSize.MEDIUM)
            }
        }
        if (showSheet) FilterSheet(filters, facets, { filters = it; showSheet = false }, { showSheet = false })
    }
}
private fun <T> toggle(set: Set<T>, v: T): Set<T> = if (v in set) set - v else set + v

@Composable
private fun FilterSheet(current: Filters, facets: dev.dandelion.store.data.FilterFacets, onApply: (Filters) -> Unit, onClose: () -> Unit) {
    var f by remember { mutableStateOf(current) }
    val state = LocalAppState.current
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .4f)).pressable { onClose() })
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Bottom) {
        Column(Modifier.fillMaxWidth().height(560.dp).glass(GlassTint.WHITE, RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)).padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text("Filters", color = DColors.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold); Text("Refine the community catalog", color = DColors.InkSoft, fontSize = 11.5.sp) }
                IconButton(Icons.Default.Close) { onClose() }
            }
            LazyColumn(Modifier.weight(1f)) {
                item { FacetGroup("Genre", facets.genres, f.genres) { f = f.copy(genres = toggle(f.genres, it)) } }
                item { FacetGroup("Original platform", facets.platforms, f.platforms) { f = f.copy(platforms = toggle(f.platforms, it)) } }
                item { FacetGroup("Download source", facets.kinds, f.kinds, { kindLabels[it] ?: it }) { f = f.copy(kinds = toggle(f.kinds, it)) } }
                item { FacetGroup("Engine", facets.engines, f.engines) { f = f.copy(engines = toggle(f.engines, it)) } }
                item { FacetGroup("Game files", facets.fileNeeds, f.fileNeeds, { fileLabels[it] ?: it }) { f = f.copy(fileNeeds = toggle(f.fileNeeds, it)) } }
                item { FacetGroup("Android evidence", facets.evidence, f.evidence, { evidenceLabels[it] ?: it }) { f = f.copy(evidence = toggle(f.evidence, it)) } }
                item {
                    FacetGroup("Release decade", listOf("1980", "1990", "2000", "2010", "2020"), f.decades.map { it.toString() }.toSet(), { "${it}s" }) {
                        val d = it.toInt(); f = f.copy(decades = toggle(f.decades, d))
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Chip("Saved", f.onlySaved) { f = f.copy(onlySaved = !f.onlySaved) }
                        Chip("Has APK release", f.onlyApk) { f = f.copy(onlyApk = !f.onlyApk) }
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlossButton("Clear", { f = Filters() }, Modifier.weight(1f), GlassTint.WHITE, ButtonSize.MEDIUM)
                GlossButton("Apply", { onApply(f) }, Modifier.weight(2f), GlassTint.LIME, ButtonSize.MEDIUM)
            }
        }
    }
}
@Composable
private fun FacetGroup(title: String, options: List<String>, selected: Set<String>, label: (String) -> String = { it }, onToggle: (String) -> Unit) {
    Column(Modifier.padding(bottom = 12.dp)) {
        Text(title.uppercase(), Modifier.padding(bottom = 6.dp), color = DColors.InkSoft, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { o -> Chip(label(o), o in selected) { onToggle(o) } }
        }
    }
}

/* --------------------------- Game detail ----------------------------- */
@Composable
fun GameDetailScreen(id: String, topInset: Dp) {
    val state = LocalAppState.current
    val catalog = state.catalog ?: return Loading()
    val g = catalog.gameById(id) ?: return EmptyState("Port not found", "This entry is not in the bundled catalog.")
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf("Overview") }
    var selected by remember { mutableIntStateOf(g.ports.indexOf(primaryPort(g)).coerceAtLeast(0)) }
    var busy by remember { mutableStateOf(false) }
    var resolved by remember { mutableStateOf<ResolvedDownload?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val port = g.ports.getOrNull(selected) ?: primaryPort(g)
    LaunchedEffect(id) { state.visit(id) }
    LaunchedEffect(selected) { resolved = null; error = null }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 48.dp)) {
        item {
            Box(Modifier.fillMaxWidth().height(280.dp)) {
                GameShot(g.shots.firstOrNull() ?: g.cover, Modifier.fillMaxSize(), 412f / 280f)
                Box(Modifier.fillMaxSize().background(
                    if (isNight()) Brush.verticalGradient(listOf(Color(0xFF07182C).copy(alpha = .28f), Color(0xFF07182C).copy(alpha = .82f), Color(0xFF07182C)))
                    else Brush.verticalGradient(listOf(Color.White.copy(alpha = .3f), Color.White.copy(alpha = .8f), Color.White))
                ))
            }
            BackHeader(topInset = topInset) {
                IconButton(Icons.Default.Favorite) { state.toggleSaved(g.id) }
                IconButton(Icons.Default.Share) { state.showToast("Share: ${g.title}") }
            }
        }
        item {
            Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.Bottom) {
                GameArt(g, Modifier.width(104.dp).aspectRatio(g.coverRatio), radius = 20.dp)
                Spacer(Modifier.width(16.dp))
                Column {
                    Row { Text(g.platform, Modifier.clip(CircleShape).background(subtleFill()).padding(horizontal = 8.dp, vertical = 2.dp), fontSize = 10.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.width(6.dp)); Text(if (g.ports.any { it.apk }) "APK release" else "Source project", Modifier.clip(CircleShape).background(positiveBadge()).padding(horizontal = 8.dp, vertical = 2.dp), color = if (isNight()) Color(0xFFB9ECFF) else Color(0xFF065F46), fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                    Text(g.title, Modifier.padding(top = 6.dp), color = DColors.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, lineHeight = 26.sp)
                    Text("${g.year}", color = DColors.Azure, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                    Text(g.genres.take(2).joinToString(" · "), color = DColors.InkSoft, fontSize = 11.5.sp)
                }
            }
        }
        item {
            Column(Modifier.padding(16.dp).glass().padding(12.dp)) {
                Text("${kindLabels[port.kind] ?: port.kind} · ${port.developer}", color = DColors.InkSoft, fontSize = 11.sp)
                if (g.ports.size > 1) Text("Project ${selected + 1} of ${g.ports.size} — tap a port in the Ports tab to switch", Modifier.padding(top = 4.dp), color = DColors.InkSoft, fontSize = 10.5.sp)
                Spacer(Modifier.height(8.dp))
                GlossButton(if (busy) "Checking releases…" else resolved?.label ?: if (port.apk) "Get latest APK" else "Open download source", {
                    if (busy) return@GlossButton
                    scope.launch {
                        busy = true; error = null
                        try {
                            val r = resolved ?: resolveDownload(g, port)
                            resolved = r
                            performDownload(r)
                            state.showToast(if (r.isApk) "Downloading ${r.fileName}" else "Opened download source")
                        } catch (e: Throwable) { error = e.message ?: "Could not reach the release index" }
                        finally { busy = false }
                    }
                }, Modifier.fillMaxWidth(), GlassTint.LIME, ButtonSize.LARGE)
                if (error != null) Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(error!!, Modifier.weight(1f), color = Color(0xFF92400E), fontSize = 11.5.sp)
                    GlossButton("Retry", { scope.launch { busy = true; try { val r = resolveDownload(g, port); resolved = r; performDownload(r); error = null } catch (e: Throwable) { error = e.message } finally { busy = false } } }, tint = GlassTint.AMBER, size = ButtonSize.SMALL)
                }
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlossButton("Project page", { openBrowser(port.url) }, Modifier.weight(1f), GlassTint.WHITE, ButtonSize.SMALL)
                    GlossButton("Release link", { openBrowser(port.download) }, Modifier.weight(1f), GlassTint.WHITE, ButtonSize.SMALL)
                }
                Text("The latest Android APK is resolved from the project's release index. Re:Port never hosts game files.", Modifier.padding(top = 8.dp), color = DColors.InkSoft, fontSize = 11.sp)
            }
        }
        item {
            Row(Modifier.padding(16.dp, 12.dp).fillMaxWidth().glass(GlassTint.WHITE, CircleShape).height(40.dp).padding(4.dp)) {
                listOf("Overview", "Files", "Gallery", "Ports").forEach { t ->
                    Box(Modifier.weight(1f).fillMaxHeight().pressable { tab = t }.glass(if (tab == t) GlassTint.LIME else GlassTint.WHITE, CircleShape), contentAlignment = Alignment.Center) {
                        Text(t, color = if (tab == t) Color.White else DColors.InkSoft, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
        when (tab) {
            "Overview" -> {
                item { Column(Modifier.padding(16.dp, 8.dp).glass().padding(16.dp)) { Text("About this game", color = DColors.Ink, fontSize = 13.sp, fontWeight = FontWeight.Bold); Text(g.description.ifEmpty { g.summary }, Modifier.padding(top = 8.dp), color = DColors.InkSoft, style = DType.Body); androidx.compose.foundation.layout.FlowRow(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) { g.genres.forEach { x -> Text(x, Modifier.clip(CircleShape).background(subtleFill()).padding(horizontal = 10.dp, vertical = 4.dp), color = DColors.InkSoft, fontSize = 11.sp) } } } }
                item { SectionHeader("Port requirements", Modifier.padding(horizontal = 16.dp).padding(top = 12.dp)); Column(Modifier.padding(horizontal = 16.dp).glass().padding(horizontal = 16.dp)) { listOf("Game files" to (fileLabels[port.files] ?: port.files), "Details" to (port.filesNote.ifEmpty { "Follow the linked project instructions" }), "Engine" to (port.engine.ifEmpty { "See project" }), "Controller" to (port.controller.ifEmpty { "See project" }), "Android evidence" to (evidenceLabels[port.evidence] ?: port.evidence), "Updated" to port.updated).forEach { (k, v) -> Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(k, color = DColors.InkSoft, fontSize = 12.5.sp); Text(v, Modifier.weight(1f), color = DColors.Ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.End, maxLines = 2) } } } }
            }
            "Files" -> item { Column(Modifier.padding(16.dp, 8.dp).glass().padding(16.dp)) { Text("Files you need", color = DColors.Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold); Text(fileLabels[port.files] ?: port.files, Modifier.padding(top = 8.dp), color = DColors.InkSoft, style = DType.Body); if (port.filesNote.isNotEmpty()) Text(port.filesNote, Modifier.padding(top = 8.dp), color = DColors.Ink, fontSize = 12.sp); Spacer(Modifier.height(12.dp)); GlossButton("Read the project setup guide", { openBrowser(port.url) }, Modifier.fillMaxWidth(), GlassTint.WHITE, ButtonSize.MEDIUM) } }
            "Gallery" -> {
                item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { GameArt(g, Modifier.width(220.dp).aspectRatio(g.coverRatio), radius = 18.dp) } }
                items(g.shots) { s -> GameShot(s, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) }
            }
            else -> items(g.ports) { p ->
                val i = g.ports.indexOf(p)
                Column(Modifier.padding(horizontal = 16.dp, vertical = 6.dp).glass().padding(14.dp).pressable { selected = i }) {
                    Text(p.name, color = DColors.Ink, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                    Text("${p.developer} ${p.version}", color = DColors.InkSoft, fontSize = 11.5.sp)
                    Text(kindLabels[p.kind] ?: p.kind, color = DColors.Azure, fontSize = 11.sp)
                    Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        GlossButton("Source", { openBrowser(p.url) }, Modifier.weight(1f), GlassTint.WHITE, ButtonSize.SMALL)
                        GlossButton("Download", { openBrowser(p.download) }, Modifier.weight(1f), GlassTint.WHITE, ButtonSize.SMALL)
                    }
                }
            }
        }
        item {
            SectionHeader("More from the catalog", Modifier.padding(horizontal = 20.dp).padding(top = 20.dp))
            androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(horizontal = 20.dp)) {
                items(catalog.games.filter { it.id != g.id && (it.platform == g.platform || it.genres.any { x -> g.genres.contains(x) }) }.take(6)) { r ->
                    Column(Modifier.width(92.dp).pressable { state.push(Route.GameDetail(r.id)) }) { GameArt(r, Modifier.fillMaxWidth().aspectRatio(r.coverRatio)); Text(r.title, Modifier.padding(top = 6.dp), color = DColors.Ink, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 2) }
                }
            }
        }
    }
}

/* ---------------------------- Library -------------------------------- */
@Composable
fun LibraryScreen(topInset: Dp) {
    val state = LocalAppState.current
    val catalog = state.catalog ?: return Loading()
    var seg by remember { mutableStateOf("Saved") }
    val list = (if (seg == "Saved") state.saved else state.recent).mapNotNull { catalog.gameById(it) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 116.dp)) {
        item {
            Text("Library", Modifier.padding(start = 20.dp, top = topInset + 16.dp), color = DColors.Ink, style = DType.ScreenTitle)
            Text("${state.saved.size} saved · ${state.recent.size} recently viewed", Modifier.padding(start = 20.dp, top = 6.dp), color = DColors.InkSoft, fontSize = 12.5.sp)
            Row(Modifier.padding(16.dp).fillMaxWidth().glass(GlassTint.WHITE, CircleShape).height(40.dp).padding(4.dp)) {
                listOf("Saved", "Recent").forEach { t -> Box(Modifier.weight(1f).fillMaxHeight().pressable { seg = t }.glass(if (seg == t) GlassTint.LIME else GlassTint.WHITE, CircleShape), contentAlignment = Alignment.Center) { Text(t, color = if (seg == t) Color.White else DColors.InkSoft, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold) } }
            }
        }
        if (list.isEmpty()) item { EmptyState(if (seg == "Saved") "Nothing saved yet" else "No history yet", if (seg == "Saved") "Tap the heart on a port to keep it here." else "Ports you open appear here.") { GlossButton("Browse catalog", { state.tab = Tab.BROWSE }) } }
        items(list) { g ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).glass().padding(8.dp).pressable { state.push(Route.GameDetail(g.id)) }, verticalAlignment = Alignment.CenterVertically) {
                GameArt(g, Modifier.width(54.dp).aspectRatio(g.coverRatio), radius = 10.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) { Text(g.title, color = DColors.Ink, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1); Text("${primaryPort(g).name} · ${g.platform}", color = DColors.InkSoft, fontSize = 11.5.sp, maxLines = 1) }
                IconButton(if (seg == "Saved") Icons.Default.Close else Icons.Default.Favorite) { state.toggleSaved(g.id) }
            }
        }
    }
}

/* ---------------------------- Settings ------------------------------- */
@Composable
fun SettingsScreen(topInset: Dp) {
    val state = LocalAppState.current
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 116.dp)) {
        item {
            Text("Settings", Modifier.padding(start = 20.dp, top = topInset + 16.dp), color = DColors.Ink, style = DType.ScreenTitle)
            Text("Unofficial Android game ports", Modifier.padding(start = 20.dp, top = 6.dp), color = DColors.InkSoft, fontSize = 12.5.sp)
            Row(Modifier.padding(16.dp).fillMaxWidth().glass(GlassTint.LIME).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.pressable { state.editNameOpen = true }) { InitialAvatar(state.name, 58.dp) }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(state.name, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                    Text(if (state.avatar.mode == "image") "Custom profile picture" else "Avatar: ${state.avatar.preset.label}", color = Color.White.copy(alpha = .9f), fontSize = 11.5.sp)
                }
                GlossButton("Customize", { state.editNameOpen = true }, tint = GlassTint.WHITE, size = ButtonSize.SMALL)
            }
        }
        item {
            Text("PROFILE & AVATAR PICTURE", Modifier.padding(start = 24.dp, top = 12.dp), color = DColors.InkSoft, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Column(Modifier.padding(16.dp, 8.dp).glass().padding(bottom = 12.dp)) {
                SettingRow(Icons.Default.Person, DColors.Lime, "Display name", state.name, { state.editNameOpen = true })
                SettingRow(Icons.Default.Star, DColors.Azure, "Profile picture studio", "Upload photo, pick game cover or icon", { state.editNameOpen = true })
                Text("Quick avatar style", Modifier.padding(start = 16.dp, top = 8.dp, bottom = 6.dp), color = DColors.Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(horizontal = 16.dp)) {
                    items(dev.dandelion.store.AvatarPreset.entries) { p ->
                        val preview = state.avatar.copy(mode = "preset", preset = p)
                        Column(Modifier.pressable { state.saveAvatar(preview) }, horizontalAlignment = Alignment.CenterHorizontally) {
                            InitialAvatar(state.name, 42.dp, configOverride = preview)
                            Text(p.label, color = DColors.InkSoft, fontSize = 10.sp)
                        }
                    }
                }
            }
        }
        item {
            Text("APPEARANCE", Modifier.padding(start = 24.dp, top = 12.dp), color = DColors.InkSoft, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Column(Modifier.padding(16.dp, 8.dp).glass()) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    ThemeName.entries.toList().chunked(2).forEach { rowItems ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            rowItems.forEach { th ->
                                val active = state.theme == th
                                Column(Modifier.weight(1f).pressable { state.updateTheme(th) }, horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(Modifier.fillMaxWidth().height(66.dp).clip(RoundedCornerShape(14.dp)).background(when (th) { ThemeName.NXE -> Brush.verticalGradient(listOf(Color(0xFFD9F183), Color(0xFF639F24))); ThemeName.MEADOW -> Brush.verticalGradient(listOf(Color(0xFF8FCFFF), Color(0xFF8CC63E))); ThemeName.SKY -> Brush.verticalGradient(listOf(Color(0xFF5FB4F7), Color.White)); ThemeName.NIGHT -> Brush.verticalGradient(listOf(Color(0xFF04101F), Color(0xFF0B3559), Color(0xFF0B6F8C))) }).then(if (active) Modifier.padding(3.dp) else Modifier))
                                    Text(th.label, color = if (active) DColors.LimeDeep else DColors.InkSoft, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }
                SettingRow(Icons.Default.Star, Color(0xFFF5A623), "Smooth animations", "Interruptible transform motion", trailing = { GlossToggle(state.animations) { state.setBool("animations", it) } })
                SettingRow(Icons.Default.CheckCircle, Color(0xFF4FB6FF), "Cover reflections", "Mirrored artwork in cover flow", trailing = { GlossToggle(state.reflections) { state.setBool("reflections", it) } })
                SettingRow(Icons.Default.Info, DColors.Lime, "Floating bubbles", "Background particles on home", trailing = { GlossToggle(state.bubbles) { state.setBool("bubbles", it) } })
                SettingRow(Icons.Default.Refresh, Color(0xFF8E6CFF), "Cover flow autoplay", "Rotate featured ports while idle", trailing = { GlossToggle(state.autoplay) { state.setBool("autoplay", it) } })
                SettingRow(Icons.Default.Settings, Color(0xFF8E6CFF), "Haptic feedback", "Vibration on supported devices", trailing = { GlossToggle(state.haptics) { state.setBool("haptics", it) } })
            }
        }
        item { Text("ABOUT", Modifier.padding(start = 24.dp, top = 12.dp), color = DColors.InkSoft, fontSize = 12.sp, fontWeight = FontWeight.Bold); Column(Modifier.padding(16.dp, 8.dp).glass()) { SettingRow(Icons.Default.Info, DColors.Azure, "About Re:Port", "Catalog, sources and downloads", { state.push(Route.About) }) } }
    }
}

/* ------------------------- About / Collection ------------------------ */
@Composable
fun AboutScreen(topInset: Dp) {
    val state = LocalAppState.current
    val catalog = state.catalog ?: return Loading()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 60.dp)) {
        item {
            BackHeader("About", topInset = topInset)
            Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(96.dp).clip(RoundedCornerShape(26.dp)).background(LimeBrush), contentAlignment = Alignment.Center) { RePortLogo(60.dp) }
                Text("Re:Port", Modifier.padding(top = 16.dp), color = DColors.Ink, fontSize = 32.sp, fontWeight = FontWeight.Light)
                Text("Unofficial Android game port directory", color = DColors.InkSoft, fontSize = 12.5.sp)
                Text("A directory, not an emulator.", Modifier.padding(top = 12.dp), color = DColors.Ink, fontSize = 14.sp)
                Text("Re:Port catalogs ${catalog.games.size} community native ports — source ports, engine rebuilds, decompilations and static recompilations — merged from community indexes. Every port links to its own source and release page.", Modifier.padding(top = 12.dp), color = DColors.InkSoft, fontSize = 12.5.sp, textAlign = TextAlign.Center)
            }
        }
        item {
            SectionHeader("How downloads work", Modifier.padding(horizontal = 16.dp))
            Column(Modifier.padding(16.dp).glass().padding(16.dp)) {
                listOf("GitHub releases" to "The release index is read and an arm64-v8a / universal APK is selected, then handed to the system downloader and package installer.", "Other sources" to "Telegram, project sites, mirrors and stores open in your browser at their real download page.", "Game files" to "Most ports ship the engine only. Bring the original files from a copy you own.").forEach { (k, v) -> Column(Modifier.padding(vertical = 8.dp)) { Text(k, color = DColors.Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold); Text(v, color = DColors.InkSoft, fontSize = 11.5.sp) } }
            }
        }
    }
}

@Composable
fun CollectionScreen(name: String, topInset: Dp) {
    val state = LocalAppState.current
    val catalog = state.catalog ?: return Loading()
    val col: Collection? = catalog.collections.firstOrNull { it.name == name }
    val list = if (col != null) catalog.games.filter { it.collections.contains(col.id) } else catalog.games.filter { it.genres.contains(name) }
    LazyVerticalGrid(columns = GridCells.Fixed(2), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 60.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item(span = { GridItemSpan(2) }) { Column { BackHeader(name, topInset = topInset); Column(Modifier.padding(16.dp).glass().padding(16.dp)) { Text(name, color = DColors.Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold); Text("${list.size} community ports · ${col?.blurb ?: ""}", color = DColors.InkSoft, fontSize = 12.sp) } } }
        items(list.take(60)) { g -> GameCard(g, onOpen = { state.push(Route.GameDetail(g.id)) }) }
    }
}

@Composable
private fun Loading() { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Loading catalog…", color = DColors.InkSoft, fontSize = 13.sp) } }
