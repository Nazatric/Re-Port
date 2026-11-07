package app.report.port

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.absoluteValue

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HomeScreen(catalog: Catalog, onGame: (String) -> Unit, onBrowse: (Filters) -> Unit) {
    val p = LocalReportColors.current
    var search by rememberSaveable { mutableStateOf("") }
    val featured = remember(catalog) { catalog.games.filter { it.platform != "engine" && (it.cover.isNotBlank() || it.steamId != null) }
        .sortedByDescending { it.popularity }.take(80).shuffled().take(12) }
    val updated = remember(catalog) { catalog.games.filter { it.platform != "engine" && it.updated.isNotBlank() }.sortedByDescending { it.updated }.take(12) }
    val engines = remember(catalog) { catalog.games.filter { it.platform == "engine" }.sortedByDescending { it.supports.size }.take(4) }
    LazyColumn(Modifier.fillMaxSize().background(p.background), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Hero("Spotlight", showBrand = true, trailing = { IconButton(onClick = { onBrowse(Filters(query = search)) }) { Icon(Icons.Default.Search, "Search", tint = Color.White) } }) {
                Spacer(Modifier.height(16.dp))
                OutlinedTextField(value = search, onValueChange = { search = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                    placeholder = { Text("Find a game or port") }, leadingIcon = { Icon(Icons.Default.Search, null) },
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Search),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = { onBrowse(Filters(query = search)) }),
                    shape = RoundedCornerShape(30.dp), colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White,
                        unfocusedTextColor = Color(0xFF182C38), focusedTextColor = Color(0xFF182C38), unfocusedBorderColor = Color.Transparent, focusedBorderColor = Color.White))
            }
        }
        if (featured.isNotEmpty()) item {
            val pager = rememberPagerState(pageCount = { featured.size })
            Column(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                HorizontalPager(state = pager, contentPadding = PaddingValues(horizontal = 88.dp), pageSpacing = 8.dp, modifier = Modifier.fillMaxWidth()) { page ->
                    val offset = ((pager.currentPage - page) + pager.currentPageOffsetFraction).absoluteValue.coerceIn(0f, 1f)
                    Cover(featured[page], Modifier.fillMaxWidth().height(235.dp).graphicsLayer {
                        scaleX = 1f - offset * .15f; scaleY = 1f - offset * .15f
                        rotationY = (pager.currentPage - page + pager.currentPageOffsetFraction).coerceIn(-1f, 1f) * 22f
                        cameraDistance = 12f * density
                    }.clickable { onGame(featured[page].id) })
                }
                Text(featured[pager.currentPage].title, Modifier.padding(top = 8.dp), color = p.text, fontWeight = FontWeight.Bold, maxLines = 1, fontSize = 17.sp)
                Text("${pager.currentPage + 1} / ${featured.size}", color = p.muted, fontSize = 12.sp)
            }
        }
        item { Spacer(Modifier.height(22.dp)); Box(Modifier.padding(horizontal = 16.dp)) { SectionTitle("Genres", "See all") { onBrowse(Filters()) } } }
        item {
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(catalog.collections, key = { it.id }) { c ->
                    Box(Modifier.width(130.dp).height(100.dp).clip(RoundedCornerShape(17.dp)).background(Brush.verticalGradient(listOf(p.accentLight, p.accent)))
                        .clickable { onBrowse(Filters(genre = c.id)) }.padding(12.dp), contentAlignment = Alignment.BottomStart) {
                        Text(c.name, color = p.accentText, fontWeight = FontWeight.Bold, maxLines = 2)
                    }
                }
            }
        }
        item { Spacer(Modifier.height(16.dp)); Box(Modifier.padding(horizontal = 16.dp)) { SectionTitle("Recently Updated", "See all") { onBrowse(Filters(sort = "updated")) } } }
        item { GameRail(updated, onGame) }
        item { Spacer(Modifier.height(14.dp)); Box(Modifier.padding(horizontal = 16.dp)) { SectionTitle("Engines and Launchers", "See all") { onBrowse(Filters(platform = "engine")) } } }
        items(engines, key = { it.id }) { game -> GameListRow(game, onClick = { onGame(game.id) }, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) }
        item { Panel(Modifier.fillMaxWidth().padding(16.dp)) { Text("Every port here is unofficial. Re:Port links to developers and does not host game files. Bring your own legally obtained copy where required.", color = p.muted, style = MaterialTheme.typography.bodySmall) } }
    }
}

@Composable
fun GameRail(games: List<Game>, onGame: (String) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        items(games, key = { it.id }) { g -> GameCard(g, { onGame(g.id) }, Modifier.width(140.dp)) }
    }
}

@Composable
fun GameListRow(game: Game, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val p = LocalReportColors.current
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(p.surface).clickable(onClick = onClick).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Cover(game, Modifier.width(60.dp).height(80.dp)); Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(game.title, color = p.text, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(4.dp)); Text(listOfNotNull(game.year?.toString(), game.platform.uppercase(), "${game.ports.size} port${if (game.ports.size == 1) "" else "s"}").joinToString(" · "), color = p.muted, fontSize = 12.sp)
            if (game.summary.isNotBlank()) Text(game.summary, color = p.muted, maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 12.sp, lineHeight = 15.sp)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(catalog: Catalog, filters: Filters, onFilter: (Filters) -> Unit, listView: Boolean, onView: (Boolean) -> Unit, onGame: (String) -> Unit) {
    val p = LocalReportColors.current
    var sheet by remember { mutableStateOf(false) }
    val results by produceState<List<Game>?>(null, catalog, filters) {
        value = withContext(Dispatchers.Default) { filterGames(catalog, filters) }
    }
    val items = results
    LazyColumn(Modifier.fillMaxSize().background(p.background), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Hero("Library", trailing = { IconButton(onClick = { sheet = true }) { Icon(Icons.Default.Tune, "Filters", tint = Color.White) } }) {
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(value = filters.query, onValueChange = { onFilter(filters.copy(query = it.take(80))) }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                    placeholder = { Text("Search games, ports, developers") }, leadingIcon = { Icon(Icons.Default.Search, null) }, shape = RoundedCornerShape(24.dp),
                    colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White, unfocusedTextColor = Color(0xFF182C38), focusedTextColor = Color(0xFF182C38)))
            }
        }
        item {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (items == null) "Searching…" else "${items.size} results", Modifier.weight(1f), color = p.muted, fontWeight = FontWeight.SemiBold)
                    TextButton(onClick = { onView(!listView) }) { Text(if (listView) "Grid" else "List") }
                    FilledTonalButton(onClick = { sheet = true }) { Text("Filters") }
                }
                val selected = listOfNotNull(filters.genre.takeIf(String::isNotEmpty)?.let { catalog.collections.find { c -> c.id == it }?.name ?: it },
                    filters.platform.takeIf(String::isNotEmpty)?.let { catalog.platforms.find { p -> p.id == it }?.name ?: it }, filters.source.takeIf(String::isNotEmpty),
                    if (filters.works) "Works" else null, if (filters.noFiles) "No files needed" else null, if (filters.controller) "Controller" else null)
                if (selected.isNotEmpty()) Text(selected.joinToString(" · "), color = p.accent, fontSize = 12.sp)
            }
        }
        if (items != null && items.isEmpty()) item { Panel(Modifier.fillMaxWidth().padding(16.dp)) { Text("No ports match your filters.", color = p.text); TextButton(onClick = { onFilter(Filters()) }) { Text("Clear filters") } } }
        if (items != null) {
            if (listView) items(items, key = { it.id }) { game -> GameListRow(game, { onGame(game.id) }, Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) }
            else items(items.chunked(2), key = { it.first().id }) { row ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { game -> GameCard(game, { onGame(game.id) }, Modifier.weight(1f)) }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
    if (sheet) ModalBottomSheet(onDismissRequest = { sheet = false }, containerColor = p.surface) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 40.dp)) {
            Text("Filter & sort", style = MaterialTheme.typography.headlineSmall, color = p.text, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
            Choice("Sort", filters.sort, listOf("popular" to "Most popular", "updated" to "Recently updated", "added" to "Newly added", "title" to "Title A to Z", "year" to "Release year")) { onFilter(filters.copy(sort = it)) }
            Choice("Genre", filters.genre, listOf("" to "All genres") + catalog.collections.map { it.id to it.name } + ("other" to "More games")) { onFilter(filters.copy(genre = it)) }
            Choice("Platform", filters.platform, listOf("" to "All platforms") + catalog.platforms.map { it.id to it.name }) { onFilter(filters.copy(platform = it)) }
            val sourceTypes = remember(catalog) { catalog.games.flatMap { it.ports.map(Port::kind) }.filter(String::isNotBlank).distinct().sorted() }
            Choice("Release source", filters.source, listOf("" to "All sources") + sourceTypes.map { it to it.replaceFirstChar(Char::uppercase) }) { onFilter(filters.copy(source = it)) }
            ToggleRow("Reported working", filters.works, { onFilter(filters.copy(works = it)) })
            ToggleRow("No game files needed", filters.noFiles, { onFilter(filters.copy(noFiles = it)) })
            ToggleRow("Controller supported", filters.controller, { onFilter(filters.copy(controller = it)) })
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = { onFilter(Filters()) }, modifier = Modifier.weight(1f)) { Text("Reset") }
                Button(onClick = { sheet = false }, modifier = Modifier.weight(1f)) { Text("Show results") }
            }
        }
    }
}

@Composable
fun Choice(label: String, selected: String, options: List<Pair<String, String>>, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val name = options.firstOrNull { it.first == selected }?.second ?: selected
    Column(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        Text(label, color = LocalReportColors.current.muted, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) { Text(name, modifier = Modifier.weight(1f)); Text("⌄") }
    }
    if (open) AlertDialog(onDismissRequest = { open = false }, title = { Text(label) }, text = {
        Column(Modifier.heightIn(max = 400.dp).verticalScroll(rememberScrollState())) {
            options.forEach { (id, name) -> TextButton(onClick = { onSelect(id); open = false }, modifier = Modifier.fillMaxWidth()) { Text(if (id == selected) "✓  $name" else name, Modifier.weight(1f)) } }
        }
    }, confirmButton = { TextButton(onClick = { open = false }) { Text("Close") } })
}

@Composable
fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit, hint: String? = null) {
    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(label, color = LocalReportColors.current.text, fontWeight = FontWeight.Medium); if (hint != null) Text(hint, color = LocalReportColors.current.muted, fontSize = 12.sp) }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
fun BrowseScreen(catalog: Catalog, onBrowse: (Filters) -> Unit) {
    val p = LocalReportColors.current
    val sources = remember(catalog) { catalog.games.flatMap { it.ports.map(Port::kind) }.filter(String::isNotBlank).distinct().sorted() }
    LazyColumn(Modifier.fillMaxSize().background(p.background), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { Hero("Browse") }
        item { Box(Modifier.padding(16.dp)) { SectionTitle("Collections") } }
        items(catalog.collections.chunked(2), key = { it.first().id }) { row ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { c -> Tile(c.name, c.blurb, Modifier.weight(1f)) { onBrowse(Filters(genre = c.id)) } }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        item { Box(Modifier.padding(16.dp)) { SectionTitle("Original Platforms") } }
        items(catalog.platforms.chunked(2), key = { it.first().id }) { row ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { platform -> Tile(platform.name, "${platform.count} games", Modifier.weight(1f)) { onBrowse(Filters(platform = platform.id)) } }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        item { Box(Modifier.padding(16.dp)) { SectionTitle("Release Sources") } }
        items(sources, key = { it }) { source ->
            Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).clickable { onBrowse(Filters(source = source)) }) {
                Text(source.replaceFirstChar(Char::uppercase), color = p.text, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun Tile(title: String, subtitle: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val p = LocalReportColors.current
    Column(modifier.heightIn(min = 104.dp).clip(RoundedCornerShape(16.dp)).background(Brush.verticalGradient(listOf(p.accentLight, p.accent)))
        .clickable(onClick = onClick).padding(14.dp), verticalArrangement = Arrangement.Bottom) {
        Text(title, color = p.accentText, fontWeight = FontWeight.Bold, maxLines = 2)
        if (subtitle.isNotBlank()) Text(subtitle, color = p.accentText.copy(alpha = .8f), fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}
