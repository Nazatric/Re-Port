package dev.dandelion.store.ui

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.dandelion.store.LocalAppState
import dev.dandelion.store.data.Game
import dev.dandelion.store.data.primaryPort
import kotlin.math.abs
import kotlin.math.min

private val HEIGHT = 164.dp

/** Native aspect-ratio cover flow. Tile width follows each game's real cover ratio. */
@Composable
fun CoverFlow(games: List<Game>, onOpen: (Game) -> Unit) {
    val state = LocalAppState.current
    val start = min(2, games.lastIndex)
    var index by remember { mutableIntStateOf(start) }
    var pos by remember { mutableStateOf(start.toFloat()) }
    var dragging by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.fillMaxWidth().height(HEIGHT + if (state.reflections) 90.dp else 20.dp)
            .pointerInput(games) {
                detectHorizontalDragGestures(
                    onDragEnd = { pos = pos.toInt().toFloat().coerceIn(0f, games.lastIndex.toFloat()); index = pos.toInt(); dragging = false },
                    onHorizontalDrag = { change, delta ->
                        change.consume(); dragging = true
                        pos = (pos - delta / 130f).coerceIn(-.45f, games.lastIndex + .45f)
                    },
                )
            }, contentAlignment = Alignment.TopCenter) {
            games.forEachIndexed { i, g ->
                val o = i - pos; val ao = abs(o)
                if (ao > 3.6f) return@forEachIndexed
                val c = o.coerceIn(-1f, 1f)
                val w = (HEIGHT.value * g.coverRatio).coerceIn(108f, 230f).dp
                Box(Modifier.padding(top = 8.dp).graphicsLayer {
                    val depth = min(ao, 1f) * 130f + (ao - 1f).coerceAtLeast(0f) * 26f
                    val k = 900f / (900f + depth); val s = (1f - min(ao, 1f) * .1f) * k
                    translationX = (o * 62f + c * 72f) * k
                    rotationY = -c * 58f; scaleX = s; scaleY = s
                    cameraDistance = 14f; transformOrigin = TransformOrigin(.5f, .45f)
                    alpha = 1f
                }.pressable { if (i == index) onOpen(g) else { index = i; pos = i.toFloat() } }) {
                    GameArt(g, Modifier.width(w).height(HEIGHT), radius = 10.dp)
                }
            }
        }
        val cur = games[index]
        Text(cur.title, Modifier.padding(horizontal = 20.dp), color = DColors.Ink, style = DType.Title, textAlign = TextAlign.Center, maxLines = 1)
        Text("${primaryPort(cur).name} · ${cur.platform}", color = DColors.InkSoft, fontSize = 12.sp, maxLines = 1)
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterVertically)) {
            games.forEachIndexed { i, g -> Box(Modifier.size(if (i == index) 18.dp else 6.dp, 6.dp).clip(CircleShape).background(if (i == index) DColors.LimeDeep else Color.Black.copy(alpha = .18f)).pressable { index = i; pos = i.toFloat() }) }
        }
    }
}
