package dev.dandelion.store.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import dev.dandelion.store.LocalAppState
import dev.dandelion.store.data.Game

enum class GlassTint { WHITE, LIME, BLUE, DARK, AMBER }

@Composable
fun Modifier.glass(tint: GlassTint = GlassTint.WHITE, shape: Shape = RoundedCornerShape(18.dp), sheen: Boolean = true): Modifier {
    val night = isNight()
    val base: Brush = when (tint) {
        GlassTint.WHITE -> if (night) Brush.verticalGradient(listOf(Color(0xFF183552).copy(alpha = .9f), Color(0xFF07192D).copy(alpha = .82f)))
        else Brush.verticalGradient(listOf(Color.White.copy(alpha = .97f), Color.White.copy(alpha = .88f)))
        GlassTint.LIME -> LimeBrush
        GlassTint.BLUE -> BlueBrush
        GlassTint.DARK -> if (night) Brush.verticalGradient(listOf(Color(0xFF09192C).copy(alpha = .97f), Color(0xFF030C18).copy(alpha = .97f)))
        else Brush.verticalGradient(listOf(Color(0xE63C463C), Color(0xE6192019)))
        GlassTint.AMBER -> Brush.verticalGradient(listOf(Color(0xFFF7B955), Color(0xFFE2901C), Color(0xFFBF6C0C)))
    }
    val edge = if (night) Color(0xFF9BDCFF).copy(alpha = if (tint == GlassTint.WHITE) .34f else .5f) else Color.White.copy(alpha = if (tint == GlassTint.WHITE) .95f else .5f)
    val sheenTop = if (night) Color(0xFFDFF6FF).copy(alpha = .3f) else Color.White.copy(alpha = .5f)
    val sheenBottom = if (night) Color(0xFFDFF6FF).copy(alpha = .03f) else Color.White.copy(alpha = .06f)
    return this
        .clip(shape)
        .drawBehind {
            drawRect(base)
            if (sheen) drawRect(Brush.verticalGradient(0f to sheenTop, 1f to sheenBottom, endY = size.height * .5f), size = Size(size.width, size.height * .5f))
            drawLine(edge, Offset(0f, .5f), Offset(size.width, .5f), 1.5f)
        }
        .border(1.dp, edge, shape)
}

@Composable
fun Modifier.iconGloss(shape: Shape): Modifier {
    val night = isNight()
    return this.clip(shape).drawWithContent {
        drawContent()
        val top = if (night) Color.White.copy(alpha = .34f) else Color.White.copy(alpha = .5f)
        val bottom = if (night) Color.White.copy(alpha = .08f) else Color.White.copy(alpha = .12f)
        drawRect(Brush.verticalGradient(0f to top, 1f to bottom, endY = size.height * .45f), size = Size(size.width, size.height * .45f))
    }.border(
        1.dp,
        if (night) Color(0xFFB0E6FF).copy(alpha = .42f) else Color.White.copy(alpha = .3f),
        shape,
    )
}

@Composable
fun Modifier.pressable(onClick: () -> Unit): Modifier {
    val i = remember { MutableInteractionSource() }
    return this.clickable(interactionSource = i, indication = null, onClick = onClick)
}

enum class ButtonSize(val height: Dp, val pad: Dp, val font: Float) { SMALL(36.dp, 12.dp, 12f), MEDIUM(40.dp, 16.dp, 13f), LARGE(48.dp, 20.dp, 15f) }

@Composable
fun GlossButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, tint: GlassTint = GlassTint.LIME, size: ButtonSize = ButtonSize.MEDIUM, icon: ImageVector? = null, enabled: Boolean = true) {
    val fg = if (tint == GlassTint.WHITE) DColors.Ink else Color.White
    Row(modifier.height(size.height).pressable { if (enabled) onClick() }.glass(tint, CircleShape).padding(horizontal = size.pad),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
        if (icon != null) Icon(icon, null, Modifier.size(16.dp), tint = fg)
        Text(text, color = fg, fontSize = size.font.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}
@Composable
fun IconButton(icon: ImageVector, onClick: () -> Unit, size: Dp = 44.dp) {
    Box(Modifier.size(size).pressable { onClick() }.glass(GlassTint.WHITE, CircleShape), contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(size * .45f), tint = DColors.Ink) }
}
@Composable
fun GlossToggle(checked: Boolean, onChange: (Boolean) -> Unit) {
    Box(Modifier.size(56.dp, 32.dp).clip(CircleShape).background(if (checked) LimeBrush else Brush.verticalGradient(listOf(Color(0xFFE9E9E9), Color(0xFFC7C7C7))))
        .pressable { onChange(!checked) }) {
        Text(if (checked) "ON" else "OFF", Modifier.align(if (checked) Alignment.CenterStart else Alignment.CenterEnd).padding(horizontal = 8.dp), color = if (checked) Color.White else Color(0xFF8A8A8A), fontSize = 9.sp, fontWeight = FontWeight.Bold)
        Box(Modifier.padding(3.dp).size(26.dp).clip(CircleShape).background(Brush.verticalGradient(listOf(Color.White, Color(0xFFE4E4E4))))
            .align(Alignment.CenterStart).then(Modifier.padding(start = if (checked) 24.dp else 0.dp)))
    }
}
@Composable
fun Chip(text: String, active: Boolean, onClick: () -> Unit) {
    Box(Modifier.height(36.dp).pressable { onClick() }.glass(if (active) GlassTint.LIME else GlassTint.WHITE, CircleShape).padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
        Text(text, color = if (active) Color.White else DColors.InkSoft, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}
@Composable
fun SectionHeader(title: String, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp), verticalAlignment = Alignment.Bottom) {
        Text(title, Modifier.weight(1f), color = DColors.Ink, style = DType.Title)
        if (action != null) Text(action, Modifier.pressable { onAction() }, color = DColors.Azure, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
    }
}
@Composable
fun BackHeader(title: String? = null, topInset: Dp = 0.dp, actions: @Composable RowScope.() -> Unit = {}) {
    val state = LocalAppState.current
    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = topInset + 12.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(Icons.Default.KeyboardArrowLeft, onClick = { state.pop() })
        Spacer(Modifier.width(10.dp))
        Text(title ?: "", Modifier.weight(1f), color = DColors.Ink, style = DType.Title, maxLines = 1, overflow = TextOverflow.Ellipsis)
        actions()
    }
}

/** Real artwork at its measured aspect ratio — never cropped, never letterboxed.
 *  Coil provides L1 memory + L2 disk cache and decodes off the main thread. */
@Composable
fun GameArt(game: Game, modifier: Modifier = Modifier, radius: Dp = 14.dp, eager: Boolean = false) {
    var failed by remember(game.id) { mutableStateOf(false) }
    val shape = RoundedCornerShape(radius)
    if (failed || game.cover.isEmpty()) {
        val fallback = if (isNight()) Brush.verticalGradient(listOf(Color(0xFF123A5C), Color(0xFF061426))) else Brush.verticalGradient(listOf(Color(0xFF3D5A22), Color(0xFF16220E)))
        Box(modifier.clip(shape).background(fallback), contentAlignment = Alignment.Center) {
            Text(game.title, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        }
        return
    }
    AsyncImage(
        model = game.cover, contentDescription = "${game.title} cover art",
        modifier = modifier.clip(shape), contentScale = ContentScale.FillBounds,
        onError = { failed = true },
    )
}
@Composable
fun GameShot(url: String, modifier: Modifier = Modifier, ratio: Float = 16f / 9f) {
    var failed by remember(url) { mutableStateOf(false) }
    if (failed || url.isEmpty()) Box(modifier.clip(RoundedCornerShape(14.dp)).background(subtleFill()))
    else AsyncImage(model = url, contentDescription = null, modifier = modifier.clip(RoundedCornerShape(14.dp)), contentScale = ContentScale.Fit, onError = { failed = true })
}
@Composable
fun RePortLogo(size: Dp, color: Color = Color.White, modifier: Modifier = Modifier) {
    androidx.compose.foundation.Canvas(modifier.size(size)) {
        val r = this.size.minDimension / 2
        val c = Offset(r, r)
        // Official icon: dark steel disc with a blue orb core.
        drawCircle(Color(0xFF141B22), r, c)
        drawCircle(Color(0xFF0A6FAE), r * .82f, c)
        drawCircle(Color(0xFF9FE9FF), r * .55f, Offset(c.x - r * .12f, c.y - r * .18f))
        drawCircle(Color.White.copy(alpha = .9f), r * .2f, Offset(c.x - r * .18f, c.y - r * .28f))
        drawArc(Color(0xFFC9D2DA), 200f, 140f, false, Offset(c.x - r * .82f, c.y - r * .82f), Size(r * 1.64f, r * 1.64f), r * .12f)
        drawArc(Color(0xFFC9D2DA), 20f, 140f, false, Offset(c.x - r * .82f, c.y - r * .82f), Size(r * 1.64f, r * 1.64f), r * .12f)
        drawCircle(Color(0xFF2B343D), r * .13f, Offset(c.x + r * .42f, c.y - r * .42f))
    }
}
@Composable
fun InitialAvatar(name: String, size: Dp = 40.dp, configOverride: dev.dandelion.store.AvatarConfig? = null) {
    val state = LocalAppState.current
    val cfg = configOverride ?: state.avatar
    val initials = name.trim().take(2).uppercase().ifEmpty { "RP" }
    if (cfg.mode == "image" && cfg.imageUrl.isNotEmpty()) {
        AsyncImage(
            model = cfg.imageUrl,
            contentDescription = name.ifEmpty { "Profile avatar" },
            modifier = Modifier.size(size).iconGloss(CircleShape),
            contentScale = ContentScale.Crop,
        )
        return
    }
    val brush = LimeBrush
    Box(Modifier.size(size).iconGloss(CircleShape).background(brush), contentAlignment = Alignment.Center) {
        val glyphText = when (cfg.preset) {
            dev.dandelion.store.AvatarPreset.INITIALS -> initials
            dev.dandelion.store.AvatarPreset.GAMEPAD -> "🎮"
            dev.dandelion.store.AvatarPreset.NXE -> "👤"
            dev.dandelion.store.AvatarPreset.DANDELION -> "❁"
            dev.dandelion.store.AvatarPreset.SWORD -> "⚔"
            dev.dandelion.store.AvatarPreset.CROWN -> "♛"
            dev.dandelion.store.AvatarPreset.GHOST -> "👻"
            dev.dandelion.store.AvatarPreset.FLAME -> "🔥"
            dev.dandelion.store.AvatarPreset.BOLT -> "⚡"
            dev.dandelion.store.AvatarPreset.PLANET -> "🪐"
            dev.dandelion.store.AvatarPreset.HEART -> "♥"
            dev.dandelion.store.AvatarPreset.SHIELD -> "🛡"
        }
        Text(glyphText, color = Color.White, fontSize = (size.value * .38f).sp, fontWeight = FontWeight.Bold)
    }
}
@Composable
fun IconBubble(icon: ImageVector, color: Color, size: Dp = 38.dp) {
    Box(Modifier.size(size).iconGloss(CircleShape).background(Brush.verticalGradient(listOf(color, color.copy(alpha = .8f)))), contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(size * .48f), tint = Color.White) }
}
@Composable
fun SettingRow(icon: ImageVector, color: Color, title: String, subtitle: String? = null, onClick: (() -> Unit)? = null, trailing: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().then(if (onClick != null) Modifier.pressable { onClick() } else Modifier).padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        IconBubble(icon, color)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) { Text(title, color = DColors.Ink, style = DType.Label); if (subtitle != null) Text(subtitle, color = DColors.InkSoft, style = DType.Caption, maxLines = 1) }
        trailing()
        if (onClick != null) Icon(Icons.Default.KeyboardArrowRight, null, Modifier.size(18.dp), tint = DColors.InkSoft)
    }
}
@Composable
fun EmptyState(title: String, subtitle: String, action: @Composable () -> Unit = {}) {
    Column(Modifier.fillMaxWidth().padding(24.dp, 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(80.dp).iconGloss(CircleShape).background(Brush.verticalGradient(listOf(Color.White, Color(0xFFE8F3D5)))), contentAlignment = Alignment.Center) { RePortLogo(44.dp, DColors.Lime) }
        Spacer(Modifier.height(16.dp))
        Text(title, color = DColors.Ink, style = DType.Title)
        Spacer(Modifier.height(4.dp))
        Text(subtitle, color = DColors.InkSoft, fontSize = 12.5.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        action()
    }
}
