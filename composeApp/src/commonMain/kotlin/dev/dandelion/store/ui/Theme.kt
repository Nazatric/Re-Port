package dev.dandelion.store.ui

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import dev.dandelion.store.LocalAppState
import dev.dandelion.store.ThemeName

/** True when the Night (dark Aero) theme is active. All glass surfaces and text
 *  tokens read this, so one switch repaints the whole UI without per-screen branches. */
val LocalNightTheme = staticCompositionLocalOf { false }

@Composable
fun isNight(): Boolean = LocalNightTheme.current

/** Theme-aware palette. Identical hex values to the web build. */
object DColors {
    val Ink: Color @Composable get() = if (isNight()) Color(0xFFEEF7FF) else Color(0xFF243326)
    val InkSoft: Color @Composable get() = if (isNight()) Color(0xFFA4BDD6) else Color(0xFF5B6B5E)
    val Azure: Color @Composable get() = if (isNight()) Color(0xFF67DCFF) else Color(0xFF1F7FD6)
    val Lime: Color @Composable get() = if (isNight()) Color(0xFF29B6E6) else Color(0xFF8CC63E)
    val LimeGlow: Color @Composable get() = if (isNight()) Color(0xFF8CE9FF) else Color(0xFFC9EE6A)
    val LimeMid: Color @Composable get() = if (isNight()) Color(0xFF3FC8E8) else Color(0xFF9AD343)
    val LimeDeep: Color @Composable get() = if (isNight()) Color(0xFF2A9FCF) else Color(0xFF5F9F22)
    val LimeDark: Color @Composable get() = if (isNight()) Color(0xFF1B7FB8) else Color(0xFF7FBE2E)
    val Red = Color(0xFFE0452F)
    val Gold = Color(0xFFF6B31C)
}

val EaseOutExpo = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)
val EaseSpring = CubicBezierEasing(0.34f, 1.4f, 0.64f, 1f)

val LimeBrush: Brush
    @Composable get() = if (isNight()) Brush.verticalGradient(
        0f to Color(0xFF45C3E8), 0.46f to Color(0xFF1883B8), 1f to Color(0xFF0B4C80)
    ) else Brush.verticalGradient(0f to Color(0xFFC9EE6A), 0.45f to Color(0xFF9AD343), 1f to Color(0xFF7FBE2E))

val BlueBrush: Brush
    @Composable get() = if (isNight()) Brush.verticalGradient(
        listOf(Color(0xFF5CC8F7), Color(0xFF1F8FD0), Color(0xFF0D4F8E))
    ) else Brush.verticalGradient(listOf(Color(0xFF8DD4FF), Color(0xFF44A9F2), Color(0xFF1F7FD6)))

val WhiteLimeBrush: Brush
    @Composable get() = if (isNight()) Brush.verticalGradient(
        listOf(Color(0xFF173A5C), Color(0xFF0B2540))
    ) else Brush.verticalGradient(listOf(Color.White, Color(0xFFE4F3C8)))

/** Small inset surfaces (chips, tags, search fields). */
@Composable
fun subtleFill(): Color = if (isNight()) Color(0xFF96D7FF).copy(alpha = .12f) else Color.Black.copy(alpha = .06f)

/** Raised translucent button / badge surface. */
@Composable
fun surfaceFill(): Color = if (isNight()) Color(0xFF0D243C).copy(alpha = .88f) else Color.White.copy(alpha = .9f)

/** Positive/negative status badges. */
@Composable
fun positiveBadge(): Color = if (isNight()) Color(0xFF1E6E92).copy(alpha = .55f) else Color(0xFFD1FAE5)

/** Light humanist type ramp. */
object DType {
    val Display = TextStyle(fontWeight = FontWeight.Light, fontSize = 66.sp, letterSpacing = (-2.5).sp, lineHeight = 66.sp)
    val ScreenTitle = TextStyle(fontWeight = FontWeight.Light, fontSize = 34.sp, letterSpacing = (-0.8).sp, lineHeight = 36.sp)
    val Title = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 17.sp, letterSpacing = (-0.2).sp)
    val Body = TextStyle(fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 19.sp)
    val Label = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
    val Caption = TextStyle(fontWeight = FontWeight.Normal, fontSize = 11.5.sp)
    val Tiny = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 10.sp, letterSpacing = 0.4.sp)
}

@Composable
fun DandelionTheme(content: @Composable () -> Unit) {
    val night = LocalAppState.current.theme == ThemeName.NIGHT
    CompositionLocalProvider(LocalNightTheme provides night) {
        MaterialTheme(
            colorScheme = lightColorScheme(
                primary = DColors.Lime,
                onPrimary = Color.White,
                secondary = DColors.Azure,
                background = Color.Transparent,
                surface = Color.Transparent,
                onBackground = DColors.Ink,
                onSurface = DColors.Ink,
            ),
            typography = Typography(bodyMedium = DType.Body, titleMedium = DType.Title, labelLarge = DType.Label),
            content = content,
        )
    }
}
