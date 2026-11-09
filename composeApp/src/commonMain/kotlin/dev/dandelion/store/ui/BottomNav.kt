package dev.dandelion.store.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.dandelion.store.LocalAppState
import dev.dandelion.store.Tab

@Composable
fun BottomNav(bottomInset: Dp) {
    val state = LocalAppState.current
    val tabs = Tab.entries
    Box(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = bottomInset + 10.dp)) {
        val idx = tabs.indexOf(state.tab)
            Box(Modifier.height(66.dp).fillMaxWidth().glass(GlassTint.WHITE, RoundedCornerShape(22.dp)).padding(6.dp)) {
                // sliding pill (transform only)
                Box(Modifier.fillMaxSize()) {
                    Box(Modifier.fillMaxWidth(1f / tabs.size).fillMaxHeight()
                        .graphicsLayer { translationX = idx * size.width.toFloat() }
                        .padding(horizontal = 3.dp).glass(GlassTint.LIME, RoundedCornerShape(16.dp)))
                }
                Row(Modifier.fillMaxSize()) {
                    tabs.forEach { t ->
                        val active = t == state.tab
                        val c = if (active) Color.White else DColors.InkSoft
                        Column(Modifier.weight(1f).fillMaxHeight().pressable { state.tab = t }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                            Icon(when (t) {
                                Tab.HOME -> Icons.Default.Home; Tab.BROWSE -> Icons.Default.Search; Tab.LIBRARY -> Icons.Default.Favorite
                                Tab.SETTINGS -> Icons.Default.Settings
                            }, null, Modifier.size(21.dp), tint = c)
                            Text(t.label, color = c, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
    }
}
