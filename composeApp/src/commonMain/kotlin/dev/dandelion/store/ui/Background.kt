package dev.dandelion.store.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import dev.dandelion.store.LocalAppState
import dev.dandelion.store.ThemeName

/** Static vector backdrops. Meadow and Sky are layered nature scenes
 *  (sun glow, clouds, mountains, meadows); NXE stays graphic. */
@Composable
fun Background(quiet: Boolean = false, modifier: Modifier = Modifier) {
    val state = LocalAppState.current
    Box(modifier.fillMaxSize()) {
        when (state.theme) {
            ThemeName.NXE -> Canvas(Modifier.fillMaxSize()) {
                drawRect(Brush.verticalGradient(listOf(Color(0xFFD9F183), Color(0xFFB7E23E), Color(0xFF8CC63E), Color(0xFF639F24))))
                drawCircle(Brush.radialGradient(listOf(Color(0x8AFFFFAA), Color.Transparent), center = Offset(size.width / 2, size.height * .3f), radius = 210.dp.toPx()), 210.dp.toPx(), Offset(size.width / 2, size.height * .3f))
                if (!quiet && state.bubbles) {
                    for (i in 0 until 10) {
                        val x = (i * 97f) % size.width
                        val y = (i * 173f) % size.height
                        drawCircle(Color.White.copy(alpha = .22f), (8f + (i % 4) * 9f).dp.toPx(), Offset(x, y), style = androidx.compose.ui.graphics.drawscope.Stroke(1.5.dp.toPx()))
                    }
                }
                drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color.White.copy(alpha = .45f)), startY = size.height - 150.dp.toPx(), endY = size.height))
            }
            ThemeName.NIGHT -> Canvas(Modifier.fillMaxSize()) {
                val w = size.width; val h = size.height
                fun glow(cx: Float, cy: Float, radius: Float, color: Color, alpha: Float) {
                    drawCircle(
                        Brush.radialGradient(listOf(color.copy(alpha = alpha), color.copy(alpha = alpha * .35f), Color.Transparent), center = Offset(cx, cy), radius = radius),
                        radius, Offset(cx, cy),
                    )
                }
                // Midnight Aero base + luminous glows
                drawRect(Brush.verticalGradient(listOf(Color(0xFF020813), Color(0xFF06182F), Color(0xFF0A2C50), Color(0xFF0D4063), Color(0xFF041426))))
                glow(w * .8f, h * .17f, 220.dp.toPx(), Color(0xFF8EE8FF), .42f)
                glow(w * .17f, h * .58f, 190.dp.toPx(), Color(0xFF63E1D0), .24f)
                glow(w * .73f, h * .78f, 220.dp.toPx(), Color(0xFF4BB8FF), .28f)

                // Layered aurora ribbons
                fun ribbon(top: Float, amp: Float, alpha: Float, c1: Color, c2: Color) {
                    val y = h * top
                    val b = Brush.linearGradient(listOf(c1.copy(alpha = 0f), c1.copy(alpha = alpha), c2.copy(alpha = alpha * .8f), c2.copy(alpha = 0f)))
                    val p = Path().apply {
                        moveTo(-30.dp.toPx(), y)
                        cubicTo(w * .2f, y - amp, w * .38f, y + amp, w * .58f, y - amp * .25f)
                        cubicTo(w * .78f, y - amp, w * .92f, y + amp * .3f, w + 30.dp.toPx(), y - amp * .5f)
                        lineTo(w + 30.dp.toPx(), y + amp * .7f)
                        cubicTo(w * .8f, y + amp * 1.1f, w * .6f, y + amp * .2f, w * .38f, y + amp * .9f)
                        cubicTo(w * .2f, y + amp * 1.3f, w * .05f, y + amp * .4f, -30.dp.toPx(), y + amp)
                        close()
                    }
                    drawPath(p, b)
                }
                ribbon(.28f, 60.dp.toPx(), .26f, Color(0xFF57E6C4), Color(0xFF7AA8FF))
                ribbon(.47f, 55.dp.toPx(), .2f, Color(0xFF4AD9FF), Color(0xFF5FF0C8))
                ribbon(.69f, 48.dp.toPx(), .14f, Color(0xFF8B6BFF), Color(0xFF4BD8FF))

                // Light streaks
                val streak = Color(0xFF8CEEFF)
                listOf(.32f, .5f, .72f).forEachIndexed { i, f ->
                    val y = h * f
                    val p = Path().apply {
                        moveTo(-20.dp.toPx(), y)
                        quadraticBezierTo(w * .3f, y - 60.dp.toPx(), w * .62f, y - 10.dp.toPx())
                        quadraticBezierTo(w * .85f, y + 30.dp.toPx(), w + 20.dp.toPx(), y - 20.dp.toPx())
                    }
                    drawPath(p, streak.copy(alpha = .3f - i * .06f), style = androidx.compose.ui.graphics.drawscope.Stroke(1.4.dp.toPx()))
                }

                // Star field + sparkles
                for (i in 0 until 30) {
                    val x = ((i * 97 + 23) % 397).dp.toPx()
                    val y = ((i * 173 + 61) % 830).dp.toPx()
                    drawCircle(Color(0xFFDFF6FF).copy(alpha = .42f + (i % 4) * .13f), (1f + (i % 3) * .3f).dp.toPx(), Offset(x, y))
                }
                listOf(Triple(.75f, .13f, 9f), Triple(.17f, .34f, 7f), Triple(.87f, .64f, 8f)).forEach { (fx, fy, r) ->
                    val x = w * fx; val y = h * fy; val rr = r.dp.toPx()
                    drawLine(Color.White.copy(alpha = .75f), Offset(x, y - rr), Offset(x, y + rr), 1.2.dp.toPx())
                    drawLine(Color.White.copy(alpha = .75f), Offset(x - rr, y), Offset(x + rr, y), 1.2.dp.toPx())
                }

                // Aero glass bokeh
                listOf(Triple(.15f, .2f, 34f), Triple(.8f, .39f, 52f), Triple(.29f, .56f, 26f), Triple(.7f, .85f, 66f)).forEach { (fx, fy, r) ->
                    val x = w * fx; val y = h * fy; val rr = r.dp.toPx()
                    drawCircle(Color(0xFFBDEFFF).copy(alpha = .1f), rr, Offset(x, y))
                    drawCircle(Color(0xFFBDEFFF).copy(alpha = .18f), rr, Offset(x, y), style = androidx.compose.ui.graphics.drawscope.Stroke(1.3.dp.toPx()))
                }

                // Horizon + dark vignette
                drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color(0xFF7DE3FF).copy(alpha = .18f)), startY = h * .78f, endY = h))
                val base = Path().apply {
                    moveTo(0f, h * .92f); quadraticBezierTo(w * .3f, h * .86f, w * .58f, h * .91f)
                    quadraticBezierTo(w * .82f, h * .96f, w, h * .89f); lineTo(w, h); lineTo(0f, h); close()
                }
                drawPath(base, Color(0xFF01060F).copy(alpha = .7f))
            }
            ThemeName.SKY -> Canvas(Modifier.fillMaxSize()) {
                val w = size.width; val h = size.height
                drawRect(Brush.verticalGradient(listOf(Color(0xFF3F9DE0), Color(0xFF7CC3F2), Color(0xFFC9E9FF), Color(0xFFF2FBFF), Color.White)))
                // sun + halo
                drawCircle(Brush.radialGradient(listOf(Color(0xE8FFFFF4), Color(0x99FFF6CF), Color.Transparent), center = Offset(w * .77f, h * .14f), radius = 150.dp.toPx()), 150.dp.toPx(), Offset(w * .77f, h * .14f))
                drawCircle(Color(0xFFFFFEF8), 30.dp.toPx(), Offset(w * .77f, h * .14f))
                // cirrus streaks
                drawLine(Color.White.copy(alpha = .55f), Offset(w * .1f, h * .24f), Offset(w * .55f, h * .22f), 7.dp.toPx())
                drawLine(Color.White.copy(alpha = .4f), Offset(w * .44f, h * .28f), Offset(w * .9f, h * .27f), 5.dp.toPx())
                // cumulus banks with shaded bases
                fun cloud(cx: Float, cy: Float, s: Float, a: Float) {
                    drawCircle(Color.White.copy(alpha = a), 20.dp.toPx() * s, Offset(cx - 26.dp.toPx() * s, cy))
                    drawCircle(Color.White.copy(alpha = a), 26.dp.toPx() * s, Offset(cx, cy - 8.dp.toPx() * s))
                    drawCircle(Color.White.copy(alpha = a), 18.dp.toPx() * s, Offset(cx + 28.dp.toPx() * s, cy))
                    drawOval(Color(0xFFDCEFFF).copy(alpha = a * .9f), Offset(cx - 58.dp.toPx() * s, cy + 2.dp.toPx()), androidx.compose.ui.geometry.Size(116.dp.toPx() * s, 16.dp.toPx() * s))
                }
                cloud(w * .25f, h * .37f, 1f, .95f)
                cloud(w * .75f, h * .48f, 1.1f, .85f)
                cloud(w * .3f, h * .6f, .8f, .7f)
                cloud(w * .72f, h * .72f, .7f, .5f)
                // birds
                val bird = Color(0xFF5B7A99).copy(alpha = .65f)
                listOf(w * .36f to h * .34f, w * .47f to h * .36f, w * .63f to h * .32f).forEach { (x, y) ->
                    val p = Path().apply { moveTo(x - 9.dp.toPx(), y); quadraticBezierTo(x - 3.dp.toPx(), y - 6.dp.toPx(), x, y); quadraticBezierTo(x + 3.dp.toPx(), y - 6.dp.toPx(), x + 9.dp.toPx(), y) }
                    drawPath(p, bird, style = androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx()))
                }
                drawRect(Color.White.copy(alpha = .35f), Offset(0f, h * .85f), androidx.compose.ui.geometry.Size(w, h * .15f))
            }
            ThemeName.MEADOW -> Canvas(Modifier.fillMaxSize()) {
                val w = size.width; val h = size.height
                drawRect(Brush.verticalGradient(listOf(Color(0xFF4AA8F0), Color(0xFF8FCDF8), Color(0xFFD5EFFF), Color(0xFFF2FBEE))))
                // sun + glow + sparkles
                drawCircle(Brush.radialGradient(listOf(Color(0xE8FFFDF2), Color(0x80FFF3C2), Color.Transparent), center = Offset(w * .22f, h * .11f), radius = 150.dp.toPx()), 150.dp.toPx(), Offset(w * .22f, h * .11f))
                drawCircle(Color(0xFFFFFDF0), 28.dp.toPx(), Offset(w * .22f, h * .11f))
                drawCircle(Color.White.copy(alpha = .5f), 5.dp.toPx(), Offset(w * .36f, h * .08f))
                // mountains with snowcaps
                val ridge = Path().apply {
                    moveTo(0f, h * .7f); lineTo(w * .17f, h * .6f); lineTo(w * .32f, h * .67f); lineTo(w * .49f, h * .58f)
                    lineTo(w * .68f, h * .68f); lineTo(w * .83f, h * .61f); lineTo(w, h * .69f); lineTo(w, h * .79f); lineTo(0f, h * .79f); close()
                }
                drawPath(ridge, Color(0xFF9DC3E8).copy(alpha = .9f))
                drawLine(Color.White.copy(alpha = .6f), Offset(0f, h * .7f), Offset(w, h * .69f), 3.dp.toPx())
                // clouds
                fun cloud(cx: Float, cy: Float, s: Float, a: Float) {
                    drawCircle(Color.White.copy(alpha = a), 20.dp.toPx() * s, Offset(cx - 26.dp.toPx() * s, cy))
                    drawCircle(Color.White.copy(alpha = a), 26.dp.toPx() * s, Offset(cx, cy - 8.dp.toPx() * s))
                    drawCircle(Color.White.copy(alpha = a), 18.dp.toPx() * s, Offset(cx + 28.dp.toPx() * s, cy))
                    drawOval(Color(0xFFD8EFFF).copy(alpha = a * .85f), Offset(cx - 56.dp.toPx() * s, cy + 2.dp.toPx()), androidx.compose.ui.geometry.Size(112.dp.toPx() * s, 15.dp.toPx() * s))
                }
                cloud(w * .72f, h * .2f, 1f, .94f)
                cloud(w * .22f, h * .33f, .85f, .78f)
                cloud(w * .8f, h * .44f, .9f, .85f)
                cloud(w * .32f, h * .55f, .65f, .6f)
                // birds
                val bird = Color(0xFF4A6B8A).copy(alpha = .6f)
                listOf(w * .41f to h * .28f, w * .52f to h * .31f).forEach { (x, y) ->
                    val p = Path().apply { moveTo(x - 8.dp.toPx(), y); quadraticBezierTo(x - 2.dp.toPx(), y - 6.dp.toPx(), x, y); quadraticBezierTo(x + 2.dp.toPx(), y - 6.dp.toPx(), x + 8.dp.toPx(), y) }
                    drawPath(p, bird, style = androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx()))
                }
                // hills with highlight ridges
                fun hill(top: Float, c1: Color, c2: Color) {
                    val p = Path().apply {
                        moveTo(0f, h * top)
                        quadraticBezierTo(w * .27f, h * (top - .07f), w * .55f, h * (top - .01f))
                        quadraticBezierTo(w * .8f, h * (top + .04f), w, h * (top - .03f))
                        lineTo(w, h); lineTo(0f, h); close()
                    }
                    drawPath(p, Brush.verticalGradient(listOf(c1, c2)))
                }
                hill(.75f, Color(0xFFB9E387), Color(0xFFB9E387))
                hill(.785f, Color(0xFFA5D95C), Color(0xFF7CBD35))
                hill(.85f, Color(0xFF8CC63E), Color(0xFF5F9F22))
                hill(.925f, Color(0xFF79B531), Color(0xFF4C8A1A))
                drawLine(Color.White.copy(alpha = .45f), Offset(0f, h * .785f), Offset(w, h * .755f), 3.dp.toPx())
                // grass tufts
                val grass = Color(0xFF3F7A16).copy(alpha = .8f)
                listOf(.15f to .9f, .44f to .95f, .73f to .91f, .3f to .98f, .61f to .98f).forEach { (fx, fy) ->
                    val x = w * fx; val y = h * fy
                    drawLine(grass, Offset(x, y), Offset(x - 4.dp.toPx(), y - 12.dp.toPx()), 2.4.dp.toPx())
                    drawLine(grass, Offset(x, y), Offset(x, y - 14.dp.toPx()), 2.4.dp.toPx())
                    drawLine(grass, Offset(x, y), Offset(x + 4.dp.toPx(), y - 12.dp.toPx()), 2.4.dp.toPx())
                }
                // flowers
                listOf(.23f to .94f, .54f to .9f, .82f to .95f).forEach { (fx, fy) ->
                    drawCircle(Color.White, 4.dp.toPx(), Offset(w * fx, h * fy))
                    drawCircle(Color(0xFFF6C945), 1.6.dp.toPx(), Offset(w * fx, h * fy))
                }
                listOf(.37f to .92f, .66f to .94f).forEach { (fx, fy) -> drawCircle(Color(0xFFF6C945), 3.dp.toPx(), Offset(w * fx, h * fy)) }
                // dandelion seeds
                val seed = Color.White.copy(alpha = .9f)
                listOf(Triple(.77f, .56f, 18f), Triple(.17f, .66f, -14f), Triple(.51f, .73f, 30f)).forEach { (fx, fy, rot) ->
                    val cx = w * fx; val cy = h * fy
                    drawLine(seed, Offset(cx, cy), Offset(cx, cy + 12.dp.toPx()), 1.3.dp.toPx())
                    for (a in listOf(-38f, -19f, 0f, 19f, 38f)) {
                        val rad = Math.toRadians((a + rot).toDouble()).toFloat()
                        drawLine(seed, Offset(cx, cy), Offset(cx + kotlin.math.sin(rad) * 8.dp.toPx(), cy - kotlin.math.cos(rad) * 8.dp.toPx()), 1.1.dp.toPx())
                    }
                }
                drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color.White.copy(alpha = .45f)), startY = h - 150.dp.toPx(), endY = h))
            }
        }
    }
}
