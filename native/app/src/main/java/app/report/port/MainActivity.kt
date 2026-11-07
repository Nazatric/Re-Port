package app.report.port

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.activity.compose.BackHandler
import coil.Coil
import coil.ImageLoader
import coil.decode.SvgDecoder

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        Coil.setImageLoader(ImageLoader.Builder(applicationContext).components { add(SvgDecoder.Factory()) }.crossfade(true).build())
        setContent { val vm: ReportViewModel = viewModel(); ReportTheme(vm.settings) { ReportApp(vm) } }
    }
}

@Composable
fun ReportApp(vm: ReportViewModel) {
    var stack by rememberSaveable { mutableStateOf(listOf("home")) }
    var filters by remember { mutableStateOf(Filters()) }
    val current = stack.lastOrNull() ?: "home"
    val holder = rememberSaveableStateHolder()
    var backwards by remember { mutableStateOf(false) }
    fun push(route: String) { if (route != stack.last()) { backwards = false; stack = stack + route } }
    fun back() { if (stack.size > 1) { backwards = true; stack = stack.dropLast(1) } }
    fun tab(route: String) {
        if (route != current) {
            backwards = false
            if (route == "library") filters = Filters()
            stack = if (route == "home") listOf("home") else listOf("home", route)
        }
    }
    BackHandler(enabled = stack.size > 1) { back() }
    val active = when { current.startsWith("game/") -> "library"; current in listOf("home", "library", "browse", "saved", "settings") -> current; else -> "settings" }
    Scaffold(
        containerColor = LocalReportColors.current.background,
        contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = { Dock(active, ::tab) },
    ) { padding ->
        val catalog = vm.catalog
        if (catalog == null) {
            Column(Modifier.fillMaxSize().padding(padding).background(LocalReportColors.current.background)) {
                Hero("Spotlight", showBrand = true)
                if (vm.loadingError != null) {
                    Panel(Modifier.fillMaxWidth().padding(18.dp)) {
                        Text(vm.loadingError.orEmpty()); Spacer(Modifier.height(12.dp)); Button(onClick = vm::load) { Text("Try again") }
                    }
                } else {
                    LinearProgressIndicator(Modifier.fillMaxWidth())
                    Text("Loading your offline library…", Modifier.padding(20.dp), color = LocalReportColors.current.muted)
                }
            }
        } else {
            val systemMotionOff = android.os.Build.VERSION.SDK_INT >= 26 && !android.animation.ValueAnimator.areAnimatorsEnabled()
            AnimatedContent(targetState = current, modifier = Modifier.padding(padding).fillMaxSize(), label = "page transition", transitionSpec = {
                if (vm.settings.reduceMotion || systemMotionOff) EnterTransition.None togetherWith ExitTransition.None
                else (fadeIn(tween(360)) + slideInHorizontally(tween(400)) { if (backwards) -it / 14 else it / 14 }) togetherWith
                    (fadeOut(tween(220)) + slideOutHorizontally(tween(350)) { if (backwards) it / 18 else -it / 18 })
            }) { route ->
                holder.SaveableStateProvider(route) {
                    when {
                        route == "home" -> HomeScreen(catalog, onGame = { vm.addRecent(it); push("game/$it") }, onBrowse = { filters = it; push("library") })
                        route == "library" -> LibraryScreen(catalog, filters, { filters = it }, vm.settings.listView,
                            { vm.updateSettings(vm.settings.copy(listView = it)) }, { vm.addRecent(it); push("game/$it") })
                        route == "browse" -> BrowseScreen(catalog) { filters = it; push("library") }
                        route == "saved" -> SavedScreen(catalog, vm.saved, vm.recent, vm::clearRecent,
                            onGame = { vm.addRecent(it); push("game/$it") }, onLibrary = { filters = Filters(); push("library") })
                        route == "settings" -> SettingsScreen(vm, onAbout = { push("about") }, onSubmit = { push("submit") })
                        route == "about" -> AboutScreen(catalog, ::back)
                        route == "submit" -> SubmitScreen(vm, ::back, null)
                        route.startsWith("report/") -> SubmitScreen(vm, ::back, catalog.byId[route.removePrefix("report/")])
                        route.startsWith("game/") -> {
                            val game = catalog.byId[route.removePrefix("game/")]
                            if (game != null) DetailScreen(game, catalog, vm.saved.contains(game.id), ::back,
                                { vm.toggleSaved(game.id) }, { vm.addRecent(it); push("game/$it") }, { filters = it; push("library") }, { push("report/${game.id}") })
                            else MissingScreen(::back)
                        }
                        else -> MissingScreen(::back)
                    }
                }
            }
        }
    }
}
