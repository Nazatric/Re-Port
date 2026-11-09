package dev.dandelion.store

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.delay

/** Wall-clock pieces for the Galaxy-S3-style lock-screen clock on Home. */
data class LocalTime(val hour24: Int, val minute: Int, val dateLabel: String) {
    val hour12: Int get() = (hour24 % 12).let { if (it == 0) 12 else it }
    val minuteLabel: String get() = minute.toString().padStart(2, '0')
    val ampm: String get() = if (hour24 >= 12) "PM" else "AM"
    val greeting: String get() = when { hour24 < 12 -> "Good morning"; hour24 < 18 -> "Good afternoon"; else -> "Good evening" }
}

expect fun currentLocalTime(): LocalTime

/** Light haptic tick; no-op on the web. */
expect fun platformHaptic()

@Composable
fun rememberLocalTime(): LocalTime {
    var t by remember { mutableStateOf(currentLocalTime()) }
    LaunchedEffect(Unit) { while (true) { delay(10_000); t = currentLocalTime() } }
    return t
}
