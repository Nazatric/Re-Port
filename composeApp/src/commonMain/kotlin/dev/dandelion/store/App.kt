package dev.dandelion.store

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.dandelion.store.screens.AboutScreen
import dev.dandelion.store.screens.BrowseScreen
import dev.dandelion.store.screens.CollectionScreen
import dev.dandelion.store.screens.GameDetailScreen
import dev.dandelion.store.screens.HomeScreen
import dev.dandelion.store.screens.LibraryScreen
import dev.dandelion.store.screens.SettingsScreen
import dev.dandelion.store.ui.Background
import dev.dandelion.store.ui.BottomNav
import dev.dandelion.store.ui.DColors
import dev.dandelion.store.ui.EaseOutExpo
import dev.dandelion.store.ui.GlassTint
import dev.dandelion.store.ui.InitialAvatar
import dev.dandelion.store.ui.isNight
import dev.dandelion.store.ui.surfaceFill
import dev.dandelion.store.ui.RePortLogo
import dev.dandelion.store.ui.glass
import dev.dandelion.store.ui.pressable
import kotlinx.coroutines.delay

@Composable
fun App(backHandler: @Composable (enabled: Boolean, onBack: () -> Unit) -> Unit = { _, _ -> }) {
    val state = remember { AppState(LocalStore()) }
    backHandler(state.canGoBack || !state.onboarded || state.editNameOpen) {
        when {
            state.editNameOpen -> state.editNameOpen = false
            state.canGoBack -> state.pop()
        }
    }
    LaunchedEffect(Unit) { state.loadCatalog() }
    LaunchedEffect(state.toastKey) { if (state.toast != null) { delay(2600); state.toast = null } }
    CompositionLocalProvider(LocalAppState provides state) {
        dev.dandelion.store.ui.DandelionTheme { PhoneFrame { Shell() } }
    }
}

@Composable
private fun PhoneFrame(content: @Composable () -> Unit) {
    val night = isNight()
    val outer = if (night) Brush.radialGradient(listOf(Color(0xFF071B30), Color(0xFF030B17), Color(0xFF01050C)))
    else Brush.radialGradient(listOf(Color(0xFF1E3B14), Color(0xFF0B150A), Color(0xFF050A05)))
    val inner = if (night) Color(0xFF061426) else Color(0xFFB7E23E)
    BoxWithConstraints(Modifier.fillMaxSize().background(outer), contentAlignment = Alignment.Center) {
        val framed = maxWidth > 540.dp && maxHeight > 700.dp
        if (framed) Box(Modifier.size(412.dp, minOf(maxHeight - 40.dp, 892.dp)).clip(RoundedCornerShape(44.dp)).background(Color(0xFF0C0F0C)).padding(11.dp).clip(RoundedCornerShape(33.dp)).background(inner)) { content() }
        else Box(Modifier.fillMaxSize().background(inner)) { content() }
    }
}

@Composable
private fun Shell() {
    val state = LocalAppState.current
    val topInset: Dp = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val bottomInset: Dp = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val pushed = state.stack.isNotEmpty()
    val night = isNight()
    val underScale by animateFloatAsState(if (pushed) .97f else 1f, tween(520, easing = EaseOutExpo), label = "underScale")
    Box(Modifier.fillMaxSize()) {
        Background()
        Box(Modifier.fillMaxSize().graphicsLayer { scaleX = underScale; scaleY = underScale }) {
            when (state.tab) {
                Tab.HOME -> HomeScreen(topInset)
                Tab.BROWSE -> BrowseScreen(topInset)
                Tab.LIBRARY -> LibraryScreen(topInset)
                Tab.SETTINGS -> SettingsScreen(topInset)
            }
        }
        if (!pushed) Box(Modifier.align(Alignment.BottomCenter)) { BottomNav(bottomInset) }

        val route = state.stack.lastOrNull()
        AnimatedContent(targetState = route, transitionSpec = {
            (slideInHorizontally(tween(480, easing = EaseOutExpo)) { it } + fadeIn(tween(220))) togetherWith
                (slideOutHorizontally(tween(360)) { it } + fadeOut(tween(300)))
        }, label = "routes") { r ->
            if (r == null) Box(Modifier)
            else Box(Modifier.fillMaxSize().background(if (night) Color(0xFF061426) else Color.White)) {
                Background(quiet = true)
                when (r) {
                    is Route.GameDetail -> GameDetailScreen(r.id, topInset)
                    is Route.Collection -> CollectionScreen(r.name, topInset)
                    Route.About -> AboutScreen(topInset)
                }
            }
        }
        var lastToast by remember { mutableStateOf("") }
        if (state.toast != null) lastToast = state.toast!!
        AnimatedVisibility(visible = state.toast != null, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = bottomInset + 110.dp)) {
            Box(Modifier.glass(GlassTint.DARK, CircleShape, sheen = false).padding(16.dp, 10.dp)) {
                Text(lastToast, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            }
        }
        if (!state.onboarded) NamePrompt(firstRun = true) { n, av -> state.finishOnboarding(n, av) }
        else if (state.editNameOpen) NamePrompt(firstRun = false) { n, av -> state.updateName(n); state.saveAvatar(av); state.editNameOpen = false }
    }
}

@Composable
private fun NamePrompt(firstRun: Boolean, onDone: (String, AvatarConfig) -> Unit) {
    val state = LocalAppState.current
    var value by remember { mutableStateOf(if (firstRun) "" else state.name) }
    var draftAvatar by remember { mutableStateOf(state.avatar) }
    var customUrl by remember { mutableStateOf("") }
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .45f)), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxWidth().padding(20.dp).glass(GlassTint.WHITE, RoundedCornerShape(24.dp)).padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            InitialAvatar(value.ifEmpty { "RP" }, 68.dp, configOverride = draftAvatar)
            Spacer(Modifier.height(10.dp))
            Text(if (firstRun) "Welcome to Re:Port" else "Customize Profile", color = DColors.Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text("Choose your display name, icon or custom image.", color = DColors.InkSoft, fontSize = 12.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            Spacer(Modifier.height(12.dp))
            androidx.compose.material3.TextField(
                value = value, onValueChange = { value = it.take(20) }, singleLine = true,
                placeholder = { Text("Your name") },
                modifier = Modifier.fillMaxWidth().clip(CircleShape),
                colors = androidx.compose.material3.TextFieldDefaults.colors(
                    focusedContainerColor = surfaceFill(), unfocusedContainerColor = surfaceFill(),
                    focusedTextColor = DColors.Ink, unfocusedTextColor = DColors.Ink,
                    focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
                ),
            )
            Spacer(Modifier.height(10.dp))
            androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)) {
                items(AvatarPreset.entries.size) { idx ->
                    val p = AvatarPreset.entries[idx]
                    val preview = draftAvatar.copy(mode = "preset", preset = p)
                    Box(Modifier.pressable { draftAvatar = preview }.clip(CircleShape).background(if (draftAvatar.mode == "preset" && draftAvatar.preset == p) DColors.LimeDeep.copy(alpha = .25f) else Color.Transparent).padding(3.dp)) {
                        InitialAvatar(value.ifEmpty { "RP" }, 42.dp, configOverride = preview)
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            androidx.compose.material3.TextField(
                value = customUrl, onValueChange = { customUrl = it }, singleLine = true,
                placeholder = { Text("Or paste custom image URL…", fontSize = 11.5.sp) },
                modifier = Modifier.fillMaxWidth().clip(CircleShape),
                colors = androidx.compose.material3.TextFieldDefaults.colors(
                    focusedContainerColor = surfaceFill(), unfocusedContainerColor = surfaceFill(),
                    focusedTextColor = DColors.Ink, unfocusedTextColor = DColors.Ink,
                    focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
                ),
            )
            if (customUrl.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                dev.dandelion.store.ui.GlossButton("Apply Image URL", {
                    draftAvatar = draftAvatar.copy(mode = "image", imageUrl = customUrl.trim())
                    customUrl = ""
                }, Modifier.fillMaxWidth(), GlassTint.WHITE, dev.dandelion.store.ui.ButtonSize.SMALL)
            }
            Spacer(Modifier.height(12.dp))
            dev.dandelion.store.ui.GlossButton(if (firstRun) "Start exploring" else "Save profile", {
                val finalName = value.trim().ifEmpty { state.name.ifEmpty { "Player" } }
                onDone(finalName, draftAvatar)
            }, Modifier.fillMaxWidth(), GlassTint.LIME, dev.dandelion.store.ui.ButtonSize.LARGE)
            if (!firstRun) dev.dandelion.store.ui.GlossButton("Cancel", { state.editNameOpen = false }, Modifier.fillMaxWidth().padding(top = 8.dp), GlassTint.WHITE, dev.dandelion.store.ui.ButtonSize.MEDIUM)
        }
    }
}
