package dev.dandelion.store.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class Blade(val id: String, val title: String, val subtitle: String, val icon: ImageVector, val action: String, val onOpen: () -> Unit)

@Composable
fun BladeStack(blades: List<Blade>) {
    var sel by remember { mutableIntStateOf(0) }
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(148.dp), horizontalArrangement = Arrangement.spacedBy((-6).dp)) {
        blades.forEachIndexed { i, b ->
            val active = i == sel
            Box(Modifier.weight(if (active) 1f else .18f).fillMaxHeight().glass(GlassTint.LIME, androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                .pressable { if (active) b.onOpen() else sel = i }) {
                if (!active) Box(Modifier.fillMaxWidth().fillMaxHeight(), contentAlignment = Alignment.Center) { Icon(b.icon, null, Modifier.size(20.dp), tint = Color.White) }
                else Column(Modifier.fillMaxWidth().fillMaxHeight().padding(14.dp), verticalArrangement = Arrangement.SpaceBetween) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Icon(b.icon, null, Modifier.size(22.dp), tint = Color.White)
                        Text("${i + 1} of ${blades.size}", color = Color.White.copy(alpha = .9f), fontSize = 11.sp)
                    }
                    Column { Text(b.title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, maxLines = 1); Text(b.subtitle, color = Color.White.copy(alpha = .9f), fontSize = 11.5.sp, maxLines = 1) }
                    Row(Modifier.height(32.dp).glass(GlassTint.WHITE, androidx.compose.foundation.shape.CircleShape).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(b.action, color = DColors.LimeDeep, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(0.dp))
                        Icon(Icons.Default.KeyboardArrowRight, null, Modifier.size(14.dp), tint = DColors.LimeDeep)
                    }
                }
            }
        }
    }
}
