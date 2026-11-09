package dev.dandelion.store

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import dev.dandelion.store.net.ResolvedDownload

object AndroidApp { lateinit var context: Context }

actual fun performDownload(resolved: ResolvedDownload) {
    val ctx = AndroidApp.context
    if (!resolved.isApk) { openBrowser(resolved.url); return }
    val dm = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    val req = DownloadManager.Request(Uri.parse(resolved.url)).apply {
        setTitle(resolved.fileName ?: "Re:Port APK")
        setDescription("Community native port from GitHub Releases")
        setMimeType("application/vnd.android.package-archive")
        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, resolved.fileName ?: "report.apk")
        addRequestHeader("Accept", "application/vnd.android.package-archive")
    }
    val id = dm.enqueue(req)
    // When the APK lands, hand its content Uri to the system package installer.
    ctx.registerReceiver(object : BroadcastReceiver() {
        override fun onReceive(c: Context, intent: Intent) {
            if (intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != id) return
            try {
                val uri = dm.getUriForDownloadedFile(id)
                if (uri != null) {
                    val install = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/vnd.android.package-archive")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    c.startActivity(install)
                }
            } finally { c.unregisterReceiver(this) }
        }
    }, android.content.IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
        if (android.os.Build.VERSION.SDK_INT >= 33) Context.RECEIVER_NOT_EXPORTED else 0)
}

actual fun openBrowser(url: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    AndroidApp.context.startActivity(intent)
}
