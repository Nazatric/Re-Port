package app.report.port

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

private fun openLink(context: android.content.Context, url: String) {
    val uri = runCatching { Uri.parse(url) }.getOrNull()
    if (uri == null || uri.scheme?.lowercase() !in listOf("https", "http") || uri.host.isNullOrBlank()) {
        Toast.makeText(context, "No valid release link available", Toast.LENGTH_SHORT).show(); return
    }
    try { context.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
    catch (_: ActivityNotFoundException) { Toast.makeText(context, "No app can open this link", Toast.LENGTH_SHORT).show() }
}

@Composable
fun DetailScreen(game: Game, catalog: Catalog, saved: Boolean, onBack: () -> Unit, onSave: () -> Unit,
                 onGame: (String) -> Unit, onBrowse: (Filters) -> Unit, onReport: () -> Unit) {
    val p = LocalReportColors.current
    val context = LocalContext.current
    var screenshot by remember(game.id) { mutableStateOf<String?>(null) }
    var expanded by remember(game.id) { mutableStateOf(false) }
    val primary = game.ports.firstOrNull()
    val supported = remember(game.id, catalog) { game.supports.mapNotNull(catalog.byId::get) }
    val related = remember(game.id, catalog) { catalog.games.asSequence().filter { it.id != game.id && it.genres.any(game.genres::contains) }.take(12).toList() }
    LazyColumn(Modifier.fillMaxSize().background(p.background), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Hero(game.title, onBack = onBack, trailing = {
                IconButton(onClick = onSave) { Icon(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, if (saved) "Remove from saved" else "Save", tint = Color.White) }
                IconButton(onClick = {
                    val text = "${game.title} — unofficial Android port\n${primary?.download.orEmpty()}"
                    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share"))
                }) { Icon(Icons.Default.Share, "Share", tint = Color.White) }
            }) {
                Spacer(Modifier.height(15.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Cover(game, Modifier.width(115.dp).height(160.dp)); Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(listOfNotNull(game.year?.toString(), game.platform.uppercase()).joinToString(" · "), color = Color.White.copy(alpha = .88f))
                        Text(game.ports.map { it.developer }.filter(String::isNotBlank).distinct().take(2).joinToString(", "), color = Color.White.copy(alpha = .88f), fontSize = 13.sp)
                    }
                }
            }
        }
        item {
            Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                Button(onClick = { openLink(context, primary?.download.orEmpty()) }, enabled = primary != null, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
                    Text("Open download page", fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(8.dp))
                Text("Opens the developer's release page · ${primary?.kind?.uppercase().orEmpty()}", color = p.muted, fontSize = 12.sp)
                if (primary?.mirror == true || primary?.kind == "4pda") Text("This link is a community mirror; check the source before downloading.", color = p.accent, fontSize = 12.sp)
            }
        }
        item {
            Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                Text("Quick facts", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = p.text)
                Spacer(Modifier.height(8.dp))
                Fact("Compatibility", when (primary?.works) { "yes" -> "Reported working"; "bug" -> "Has bugs"; "no" -> "Not working"; else -> "Untested" })
                Fact("Controls", when (primary?.controller) { "both" -> "Touch and controller"; "controller" -> "Controller"; "touch" -> "Touch"; else -> "Not listed" })
                Fact("Game files", when (primary?.files) { "none" -> "None needed"; "rom" -> "Your own ROM required"; "files" -> "Your own game files required"; "app" -> "Companion app required"; else -> "Check the developer's instructions" })
                if (!primary?.filesNote.isNullOrBlank()) Text(primary!!.filesNote, color = p.muted, fontSize = 12.sp)
                Fact("Last update", primary?.updated?.ifBlank { primary.added }?.ifBlank { "Not listed" } ?: "Not listed")
            }
        }
        item {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
                SectionTitle("About"); Spacer(Modifier.height(8.dp))
                Panel(Modifier.fillMaxWidth()) {
                    val description = game.description.ifBlank { game.summary }.ifBlank { "No description is available yet." }
                    Text(description, color = p.text, maxLines = if (expanded) Int.MAX_VALUE else 6, overflow = TextOverflow.Ellipsis)
                    if (description.length > 330) TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Show less" else "Read more") }
                    if (game.genres.isNotEmpty()) {
                        Text(game.genres.joinToString(" · ") { id -> catalog.collections.find { it.id == id }?.name ?: id }, color = p.accent, fontSize = 12.sp)
                    }
                    if (game.descSource == "wikipedia") Text("Description from Wikipedia, CC BY-SA 4.0.", color = p.muted, fontSize = 11.sp)
                }
            }
        }
        if (game.screenshots.isNotEmpty()) {
            item { Box(Modifier.padding(horizontal = 16.dp)) { SectionTitle("Screenshots") } }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(game.screenshots) { shot ->
                        Artwork(shot, "Open screenshot", Modifier.width(230.dp).height(130.dp).clip(RoundedCornerShape(12.dp)).clickable { screenshot = shot })
                    }
                }
            }
        }
        if (supported.isNotEmpty()) { item { Box(Modifier.padding(16.dp)) { SectionTitle("Supported games") } }; item { GameRail(supported, onGame) } }
        item { Box(Modifier.padding(16.dp)) { SectionTitle("Available Ports") } }
        items(game.ports) { port ->
            Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp)) {
                Text(port.name.ifBlank { port.developer.ifBlank { "Port" } }, color = p.text, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                Text(listOf(port.developer, port.kind.uppercase(), port.version, port.lifecycle).filter(String::isNotBlank).distinct().joinToString(" · "), color = p.muted, fontSize = 12.sp)
                if (port.notes.isNotBlank()) { Spacer(Modifier.height(8.dp)); Text(port.notes, color = p.text, fontSize = 13.sp) }
                if (port.instructions.isNotBlank()) { Spacer(Modifier.height(8.dp)); Text(port.instructions, color = p.muted, fontSize = 13.sp) }
                if (port.source.isNotBlank()) Text("Source: ${port.source}", color = p.muted, fontSize = 12.sp)
                if (port.paid || port.mirror) Text(if (port.paid) "May be paid" else "Community mirror", color = p.accent, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
                OutlinedButton(onClick = { openLink(context, port.download.ifBlank { port.url }) }) { Text("View release") }
            }
        }
        game.ports.firstOrNull { it.kind == "github" }?.let { github ->
            item { GithubReleaseCard(github) { openLink(context, it) } }
        }
        if (related.isNotEmpty()) { item { Box(Modifier.padding(16.dp)) { SectionTitle("You may also like") } }; item { GameRail(related, onGame) } }
        item {
            Panel(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Before you install", color = p.text, fontWeight = FontWeight.Bold)
                Text("Re:Port does not host APKs or game files. Only download from sources you trust, and use your own legally obtained game files.", color = p.muted, fontSize = 13.sp)
                TextButton(onClick = onReport) { Text("Report a problem") }
            }
        }
    }
    screenshot?.let { shot ->
        Dialog(onDismissRequest = { screenshot = null }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
                Artwork(shot, "Game screenshot", Modifier.fillMaxWidth().fillMaxHeight(.82f), crop = false)
                TextButton(onClick = { screenshot = null }, modifier = Modifier.align(Alignment.TopEnd).padding(20.dp)) { Text("Close", color = Color.White) }
            }
        }
    }
}

@Composable
fun Fact(label: String, value: String) {
    val p = LocalReportColors.current
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        Text(label, modifier = Modifier.width(112.dp), color = p.muted, fontSize = 13.sp)
        Text(value, modifier = Modifier.weight(1f), color = p.text, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun SavedScreen(catalog: Catalog, saved: Set<String>, recent: List<String>, onClear: () -> Unit, onGame: (String) -> Unit, onLibrary: () -> Unit) {
    val p = LocalReportColors.current
    val savedGames = remember(catalog, saved) { saved.mapNotNull(catalog.byId::get).sortedBy { it.title.lowercase() } }
    val viewed = remember(catalog, recent, saved) { recent.filterNot(saved::contains).mapNotNull(catalog.byId::get).take(14) }
    LazyColumn(Modifier.fillMaxSize().background(p.background), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { Hero("Saved") }
        item { Box(Modifier.padding(16.dp)) { SectionTitle("My list") } }
        if (savedGames.isEmpty()) item { Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) { Text("Nothing saved yet", color = p.text, fontWeight = FontWeight.Bold); Text("Save a game to keep it here offline.", color = p.muted); TextButton(onClick = onLibrary) { Text("Browse the library") } } }
        items(savedGames.chunked(2), key = { it.first().id }) { row ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { g -> GameCard(g, { onGame(g.id) }, Modifier.weight(1f)) }; if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        if (viewed.isNotEmpty()) {
            item { Box(Modifier.padding(16.dp)) { SectionTitle("Recently Viewed", "Clear", onClear) } }
            item { GameRail(viewed, onGame) }
        }
    }
}

@Composable
fun MissingScreen(onBack: () -> Unit) {
    Column { Hero("Not found", onBack = onBack); Panel(Modifier.fillMaxWidth().padding(16.dp)) { Text("This entry is no longer in the catalog.") } }
}
