package dev.dandelion.store

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

actual fun currentLocalTime(): LocalTime {
    val c = Calendar.getInstance()
    val label = SimpleDateFormat("EEE, d MMM", Locale.getDefault()).format(c.time)
    return LocalTime(c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE), label)
}

/** Haptics are triggered through the View's performHapticFeedback in MainActivity if desired; kept no-op here to stay dependency-free. */
actual fun platformHaptic() = Unit
