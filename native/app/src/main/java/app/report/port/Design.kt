package app.report.port

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest

@Immutable
data class ReportColors(val background: Color, val surface: Color, val surfaceAlt: Color, val text: Color,
    val muted: Color, val heroTop: Color, val heroBottom: Color, val accent: Color, val accentLight: Color,
    val accentText: Color, val stroke: Color, val dark: Boolean)
val Graphite = ReportColors(Color(0xFF101215), Color(0xFF242930), Color(0xFF343A43), Color(0xFFF5F7FA), Color(0xFFBCC4CD),
    Color(0xFF0D1014), Color(0xFF3A414B), Color(0xFFF0A30A), Color(0xFFFFD46A), Color(0xFF1C1200), Color(0xFF626B76), true)
val Azure = ReportColors(Color(0xFFEDF3F8), Color.White, Color(0xFFDCEAF6), Color(0xFF142737), Color(0xFF526574),
    Color(0xFF0A3F94), Color(0xFF58B0ED), Color(0xFF1674C8), Color(0xFF87D3FF), Color.White, Color(0xFFB3C9DA), false)
val Lime = ReportColors(Color(0xFFF0F5E9), Color.White, Color(0xFFDFEBCF), Color(0xFF203119), Color(0xFF52634B),
    Color(0xFF1F6209), Color(0xFF75C12D), Color(0xFF3F8F12), Color(0xFFA9E85B), Color.White, Color(0xFFAEC99C), false)
val LocalReportColors = staticCompositionLocalOf { Graphite }
val LocalDataSaver = staticCompositionLocalOf { false }
val LocalHaptics = staticCompositionLocalOf { true }

@Composable
fun ReportTheme(settings: AppSettings, content: @Composable () -> Unit) {
    val systemDark = androidx.compose.foundation.isSystemInDarkTheme()
    val base = when (settings.theme) { "azure" -> Azure; "lime" -> Lime; "graphite" -> Graphite; else -> if (systemDark) Graphite else Azure }
    val palette = if (settings.highContrast) base.copy(text = if (base.dark) Color.White else Color.Black, muted = if (base.dark) Color.White else Color.Black, stroke = if (base.dark) Color.White else Color.Black) else base
    val colors = if (palette.dark) darkColorScheme(primary = palette.accent, onPrimary = palette.accentText, background = palette.background,
        surface = palette.surface, onSurface = palette.text, onBackground = palette.text) else lightColorScheme(primary = palette.accent,
        onPrimary = palette.accentText, background = palette.background, surface = palette.surface, onSurface = palette.text, onBackground = palette.text)
    val density = androidx.compose.ui.platform.LocalDensity.current
    val adjusted = remember(density, settings.textSize) { androidx.compose.ui.unit.Density(density.density, density.fontScale * listOf(1f, 1.12f, 1.25f)[settings.textSize.coerceIn(0, 2)]) }
    CompositionLocalProvider(LocalReportColors provides palette, LocalDataSaver provides settings.dataSaver, LocalHaptics provides settings.haptics && !settings.reduceMotion, androidx.compose.ui.platform.LocalDensity provides adjusted) {
        MaterialTheme(colorScheme = colors, content = content)
    }
}

@Composable
fun Hero(title: String, showBrand: Boolean = false, onBack: (() -> Unit)? = null, trailing: @Composable RowScope.() -> Unit = {},
         extra: @Composable ColumnScope.() -> Unit = {}) {
    val p = LocalReportColors.current
    Box(Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(p.heroTop, p.heroBottom)))) {
        Canvas(Modifier.matchParentSize()) {
            val wave = Path().apply { moveTo(0f, size.height * .82f); cubicTo(size.width * .3f, size.height * .68f, size.width * .7f, size.height * .98f, size.width, size.height * .78f); lineTo(size.width, size.height); lineTo(0f, size.height); close() }
            drawPath(wave, Color.White.copy(alpha = .08f))
        }
        Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp).padding(top = 12.dp, bottom = 24.dp)) {
            Row(Modifier.fillMaxWidth().heightIn(min = 44.dp), verticalAlignment = Alignment.CenterVertically) {
                if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color.White) }
                if (showBrand) {
                    androidx.compose.foundation.Image(painterResource(R.drawable.brand), null, Modifier.size(38.dp).clip(RoundedCornerShape(9.dp)))
                    Spacer(Modifier.width(10.dp)); Text("Re:Port", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
                Spacer(Modifier.weight(1f)); trailing()
            }
            Spacer(Modifier.height(12.dp))
            Text("RE:PORT", color = Color.White.copy(alpha = .8f), fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
            Text(title, color = Color.White, fontSize = 40.sp, lineHeight = 44.sp, fontWeight = FontWeight.Light)
            extra()
        }
    }
}

@Composable
fun Panel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val p = LocalReportColors.current
    Column(modifier.clip(RoundedCornerShape(18.dp)).background(p.surface).border(1.dp, p.stroke.copy(alpha = .55f), RoundedCornerShape(18.dp)).padding(16.dp), content = content)
}

@Composable
fun SectionTitle(title: String, action: String? = null, onAction: (() -> Unit)? = null) {
    val p = LocalReportColors.current
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = p.text, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        if (action != null && onAction != null) TextButton(onClick = onAction) { Text(action, color = p.accent) }
    }
}

private fun coverUrls(game: Game): List<String> = buildList {
    if (game.cover.startsWith("https://")) add(game.cover)
    game.steamId?.let { add("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/$it/library_600x900.jpg") }
}.distinct()

@Composable
fun Cover(game: Game, modifier: Modifier = Modifier) {
    val p = LocalReportColors.current
    val context = LocalContext.current
    val dataSaver = LocalDataSaver.current
    val urls = remember(game.id, game.cover, game.steamId) { coverUrls(game) }
    var index by remember(game.id, urls) { mutableIntStateOf(0) }
    Box(modifier.clip(RoundedCornerShape(10.dp)).background(Brush.linearGradient(listOf(p.heroBottom, p.heroTop)))
        .border(1.dp, Color.White.copy(alpha = .28f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
        Text(game.title, Modifier.padding(8.dp), color = Color.White, textAlign = TextAlign.Center, fontWeight = FontWeight.Bold, maxLines = 4, overflow = TextOverflow.Ellipsis)
        if (index < urls.size) {
            val req = ImageRequest.Builder(context).data(urls[index]).crossfade(200)
                .networkCachePolicy(if (dataSaver) CachePolicy.DISABLED else CachePolicy.ENABLED).build()
            AsyncImage(model = req, contentDescription = "${game.title} cover", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop,
                onError = { index++ })
        }
    }
}

@Composable
fun Artwork(url: String, description: String, modifier: Modifier = Modifier, crop: Boolean = true) {
    val dataSaver = LocalDataSaver.current
    val request = ImageRequest.Builder(LocalContext.current).data(url.takeIf { it.startsWith("https://") })
        .crossfade(180).networkCachePolicy(if (dataSaver) CachePolicy.DISABLED else CachePolicy.ENABLED).build()
    AsyncImage(model = request, contentDescription = description, modifier = modifier.background(LocalReportColors.current.surfaceAlt),
        contentScale = if (crop) ContentScale.Crop else ContentScale.Fit)
}

@Composable
fun GameCard(game: Game, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val p = LocalReportColors.current
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(p.surface).clickable(onClick = onClick).padding(8.dp)) {
        Cover(game, Modifier.fillMaxWidth().aspectRatio(.7f))
        Spacer(Modifier.height(7.dp))
        Text(game.title, color = p.text, fontWeight = FontWeight.SemiBold, maxLines = 2, minLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 14.sp, lineHeight = 18.sp)
        Text(listOfNotNull(game.year?.toString(), game.platform.uppercase()).joinToString(" · "), color = p.muted, fontSize = 11.sp, maxLines = 1)
    }
}

@Composable
fun Dock(active: String, onTab: (String) -> Unit) {
    val p = LocalReportColors.current
    val haptics = androidx.compose.ui.platform.LocalHapticFeedback.current
    val hapticsEnabled = LocalHaptics.current
    val tabs: List<Triple<String, String, ImageVector>> = listOf(
        Triple("home", "Home", Icons.Default.Home), Triple("library", "Library", Icons.Default.MenuBook),
        Triple("browse", "Browse", Icons.Default.Layers), Triple("saved", "Saved", Icons.Default.Bookmark), Triple("settings", "Settings", Icons.Default.Settings))
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp).clip(RoundedCornerShape(24.dp))
        .background(Brush.verticalGradient(listOf(Color(0xFF454B55), Color(0xFF11151A))))
        .border(1.dp, Color.White.copy(alpha = .24f), RoundedCornerShape(24.dp)).padding(4.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
        tabs.forEach { (key, label, icon) ->
            val selected = active == key
            Column(Modifier.weight(1f).clip(RoundedCornerShape(18.dp)).clickable { if (hapticsEnabled) haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove); onTab(key) }.padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(width = 44.dp, height = 32.dp).clip(RoundedCornerShape(13.dp))
                    .background(if (selected) Brush.verticalGradient(listOf(p.accentLight, p.accent)) else Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent))), contentAlignment = Alignment.Center) {
                    Icon(icon, contentDescription = null, tint = if (selected) p.accentText else Color(0xFFCDD5DF), modifier = Modifier.size(22.dp))
                }
                Text(label, color = if (selected) Color.White else Color(0xFFCDD5DF), fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            }
        }
    }
}
