package dev.dandelion.store

import android.app.Application
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class RePortApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AndroidApp.context = applicationContext
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        AndroidApp.context = applicationContext
        requestHighestRefreshRate()
        setContent {
            App(backHandler = { enabled, onBack -> BackHandler(enabled = enabled, onBack = onBack) })
        }
    }

    /** Select the highest display refresh-rate mode (90/120/144 Hz panels). */
    private fun requestHighestRefreshRate() {
        val modes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display?.supportedModes
        else @Suppress("DEPRECATION") windowManager.defaultDisplay.supportedModes
        val best = modes?.maxByOrNull { it.refreshRate } ?: return
        window.attributes = window.attributes.apply {
            preferredDisplayModeId = best.modeId
            @Suppress("DEPRECATION")
            preferredRefreshRate = best.refreshRate
        }
    }
}
