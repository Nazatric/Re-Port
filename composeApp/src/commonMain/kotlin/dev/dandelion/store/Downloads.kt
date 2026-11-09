package dev.dandelion.store

import dev.dandelion.store.net.ResolvedDownload

/** Platform download bridge for Android's DownloadManager and package installer. */
expect fun performDownload(resolved: ResolvedDownload)
expect fun openBrowser(url: String)
