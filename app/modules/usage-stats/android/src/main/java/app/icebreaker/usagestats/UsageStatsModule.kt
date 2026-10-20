package app.icebreaker.usagestats

import android.app.AppOpsManager
import android.app.NotificationManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads only screen on/off events and the Do Not Disturb state. Usage events also carry package
 * names, but those are discarded here and never reach JavaScript, let alone the backend.
 */
class UsageStatsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("UsageStats")

    // SCREEN_INTERACTIVE / SCREEN_NON_INTERACTIVE events exist since Android 9 (API 28).
    Constant("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
    }

    Function("hasPermission") {
      hasUsageAccess()
    }

    Function("openPermissionSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        context.startActivity(intent)
      } catch (e: Exception) {
        // Some devices don't support opening the page for a specific package.
        context.startActivity(
          Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }

    Function("getScreenEvents") { sinceMs: Double ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || !hasUsageAccess()) {
        return@Function emptyList<Map<String, Any>>()
      }
      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = manager.queryEvents(sinceMs.toLong(), System.currentTimeMillis())
      val event = UsageEvents.Event()
      val result = mutableListOf<Map<String, Any>>()
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        val type = when (event.eventType) {
          UsageEvents.Event.SCREEN_INTERACTIVE -> "on"
          UsageEvents.Event.SCREEN_NON_INTERACTIVE -> "off"
          else -> null
        } ?: continue
        result.add(mapOf("type" to type, "at" to event.timeStamp.toDouble()))
      }
      result
    }

    Function("isDoNotDisturbOn") {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val filter = manager.currentInterruptionFilter
      filter != NotificationManager.INTERRUPTION_FILTER_ALL &&
        filter != NotificationManager.INTERRUPTION_FILTER_UNKNOWN
    }
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
      )
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
