package app.report.port

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.Coil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun SettingsScreen(vm: ReportViewModel, onAbout: () -> Unit, onSubmit: () -> Unit) {
    val p = LocalReportColors.current
    val s = vm.settings
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var url by remember(s.catalogUrl) { mutableStateOf(s.catalogUrl) }
    var confirming by remember { mutableStateOf<String?>(null) }
    var cacheMessage by remember { mutableStateOf("") }
    LazyColumn(Modifier.fillMaxSize().background(p.background), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { Hero("Settings") }
        item {
            Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
                Text("Appearance", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = p.text)
                Choice("Color theme", s.theme, listOf("system" to "System", "azure" to "Azure", "graphite" to "Graphite", "lime" to "Lime")) { vm.updateSettings(s.copy(theme = it)) }
                Choice("Text size", s.textSize.toString(), listOf("0" to "Default", "1" to "Large", "2" to "Larger")) { vm.updateSettings(s.copy(textSize = it.toInt())) }
                ToggleRow("High contrast", s.highContrast, { vm.updateSettings(s.copy(highContrast = it)) })
                ToggleRow("Reduce motion", s.reduceMotion, { vm.updateSettings(s.copy(reduceMotion = it)) }, "Also follows the Android animation setting")
                ToggleRow("Haptic feedback", s.haptics, { vm.updateSettings(s.copy(haptics = it)) })
                ToggleRow("List layout", s.listView, { vm.updateSettings(s.copy(listView = it)) })
            }
        }
        item {
            Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp)) {
                Text("Catalog updates", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = p.text)
                Text("The complete bundled catalog works offline. Check for newer published entries without installing another APK.", color = p.muted, fontSize = 13.sp)
                ToggleRow("Automatic updates", s.autoUpdate, { vm.updateSettings(s.copy(autoUpdate = it)) })
                OutlinedTextField(value = url, onValueChange = { url = it }, label = { Text("Catalog HTTPS URL") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { if (url.startsWith("https://", true)) vm.updateSettings(s.copy(catalogUrl = url.trim())) else Toast.makeText(context, "Use an HTTPS URL", Toast.LENGTH_SHORT).show() }) { Text("Save URL") }
                    Button(onClick = { vm.refreshCatalog() }, enabled = !vm.updating) { Text(if (vm.updating) "Checking…" else "Check now") }
                }
                if (vm.updateStatus.isNotBlank()) Text(vm.updateStatus, color = p.muted, fontSize = 12.sp)
                vm.catalog?.let { Text("Catalog ${it.generated} · ${it.games.size} entries", color = p.muted, fontSize = 12.sp) }
            }
        }
        item {
            Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
                Text("Storage & data", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = p.text)
                ToggleRow("Data saver", s.dataSaver, { vm.updateSettings(s.copy(dataSaver = it)) }, "Use cached artwork only")
                TextButton(onClick = {
                    scope.launch {
                        withContext(Dispatchers.IO) { Coil.imageLoader(context).diskCache?.clear(); Coil.imageLoader(context).memoryCache?.clear() }
                        cacheMessage = "Artwork cache cleared."
                    }
                }) { Text("Clear artwork cache") }
                if (cacheMessage.isNotBlank()) Text(cacheMessage, color = p.muted, fontSize = 12.sp)
                TextButton(onClick = { confirming = "saved" }) { Text("Clear saved games") }
                TextButton(onClick = { confirming = "history" }) { Text("Clear recently viewed") }
            }
        }
        item {
            Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp)) {
                Text("More", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = p.text)
                TextButton(onClick = onSubmit) { Text("Suggest a port") }
                TextButton(onClick = onAbout) { Text("About & sources") }
                Text("Re:Port · Native Android", color = p.muted, fontSize = 12.sp)
            }
        }
    }
    confirming?.let { target ->
        AlertDialog(onDismissRequest = { confirming = null }, title = { Text(if (target == "saved") "Clear saved games?" else "Clear history?") },
            text = { Text("This removes the list from this device.") }, confirmButton = { TextButton(onClick = { if (target == "saved") vm.clearSaved() else vm.clearRecent(); confirming = null }) { Text("Clear") } },
            dismissButton = { TextButton(onClick = { confirming = null }) { Text("Cancel") } })
    }
}

@Composable
fun AboutScreen(catalog: Catalog, onBack: () -> Unit) {
    val p = LocalReportColors.current
    LazyColumn(Modifier.fillMaxSize().background(p.background), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { Hero("About", onBack = onBack) }
        item {
            Panel(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("What Re:Port is", style = MaterialTheme.typography.titleLarge, color = p.text, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text("A directory of unofficial Android ports, source ports, engine rebuilds, decompilations and recompilations. Re:Port links to developers and does not host game files or APKs.", color = p.text)
                Spacer(Modifier.height(12.dp))
                Text("${catalog.games.count { it.platform != "engine" }} games · ${catalog.games.count { it.platform == "engine" }} engines · ${catalog.games.sumOf { it.ports.size }} ports", color = p.accent, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp)); Text("Sources", style = MaterialTheme.typography.titleMedium, color = p.text, fontWeight = FontWeight.Bold)
                Text(catalog.sources.joinToString("\n"), color = p.muted)
                Spacer(Modifier.height(12.dp)); Text("Credits", style = MaterialTheme.typography.titleMedium, color = p.text, fontWeight = FontWeight.Bold)
                Text("Community lists, OpenPortsGames, Awesome Decomp Games, LaunchBox Games Database, Steam, Wikipedia (CC BY-SA 4.0), Wikidata, GitHub and Libretro. Game names, logos and artwork belong to their owners.", color = p.muted, fontSize = 13.sp)
            }
        }
    }
}

@Composable
fun SubmitScreen(vm: ReportViewModel, onBack: () -> Unit, game: Game?) {
    val p = LocalReportColors.current
    val context = LocalContext.current
    var title by remember(game?.id) { mutableStateOf(game?.title ?: "") }
    var developer by remember { mutableStateOf("") }
    var link by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var queued by remember { mutableStateOf(vm.submissions()) }
    LazyColumn(Modifier.fillMaxSize().background(p.background), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { Hero(if (game == null) "Suggest a port" else "Report a problem", onBack = onBack) }
        item {
            Panel(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("There is no connected review service. Your details are saved on this device so you can copy and send them to the maintainer.", color = p.muted, fontSize = 13.sp)
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(title, { title = it.take(120) }, label = { Text("Game title") }, modifier = Modifier.fillMaxWidth(), enabled = game == null)
                if (game == null) {
                    OutlinedTextField(developer, { developer = it.take(80) }, label = { Text("Developer or project") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(link, { link = it.take(500) }, label = { Text("Release link") }, modifier = Modifier.fillMaxWidth())
                }
                OutlinedTextField(notes, { notes = it.take(600) }, label = { Text(if (game == null) "Notes" else "What is wrong?") }, modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp))
                if (message.isNotBlank()) Text(message, color = p.accent, fontSize = 13.sp)
                Button(onClick = {
                    val validUrl = link.startsWith("https://", true) || link.startsWith("http://", true)
                    if (title.isBlank() || (game == null && (developer.isBlank() || !validUrl)) || (game != null && notes.trim().length < 5)) {
                        message = "Please add the required details and a valid release link."
                    } else {
                        val text = listOf(if (game != null) "REPORT: $title" else "Game: $title", "Developer: $developer", "Link: $link", "Notes: $notes").joinToString("\n")
                        vm.saveSubmission(text); queued = vm.submissions(); message = "Saved on this device. Copy it to send to the maintainer."; notes = ""
                    }
                }) { Text("Save details") }
            }
        }
        if (queued.isNotBlank()) item {
            Panel(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                Text("Saved submissions", color = p.text, fontWeight = FontWeight.Bold)
                Text(queued, color = p.muted, fontSize = 12.sp, maxLines = 12)
                Row {
                    TextButton(onClick = { (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Re:Port submission", queued)); Toast.makeText(context, "Copied", Toast.LENGTH_SHORT).show() }) { Text("Copy") }
                    TextButton(onClick = { vm.clearSubmissions(); queued = "" }) { Text("Clear") }
                }
            }
        }
    }
}
