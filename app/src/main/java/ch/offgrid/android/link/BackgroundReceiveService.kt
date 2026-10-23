package ch.offgrid.android.link

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import ch.offgrid.android.R

/**
 * "Im Hintergrund empfangen": a foreground service of type `connectedDevice` that keeps the process
 * and therefore the open USB link alive while the app is in the background. It does no work itself.
 */
class BackgroundReceiveService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.bg_channel_name), NotificationManager.IMPORTANCE_LOW))
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.bg_notification_text))
            .setOngoing(true)
            .build()
        try {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE else 0
            ServiceCompat.startForeground(this, 1, notification, type)
        } catch (e: Exception) {
            // Android 14 only allows connectedDevice after a USB permission grant; the simulator has none.
            Log.w("OffGrid", "background receive unavailable: ${e.message}")
            stopSelf()
        }
        return START_STICKY
    }

    companion object {
        private const val CHANNEL = "receive"

        fun start(context: Context) {
            runCatching { context.startForegroundService(Intent(context, BackgroundReceiveService::class.java)) }
                .onFailure { Log.w("OffGrid", "cannot start background service: ${it.message}") }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, BackgroundReceiveService::class.java))
        }
    }
}
