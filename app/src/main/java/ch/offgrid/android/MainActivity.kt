package ch.offgrid.android

import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import ch.offgrid.android.analytics.AnalyticsEvent
import ch.offgrid.android.ui.AppNavHost
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.theme.OffGridTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )
        val container = (application as OffGridApp).container
        if (savedInstanceState == null) container.analytics.track(AnalyticsEvent.AppOpened)
        setContent {
            CompositionLocalProvider(LocalApp provides container) {
                OffGridTheme { AppNavHost() }
            }
        }
        handleUsbIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleUsbIntent(intent)
    }

    /** Plugging in the Heltec starts the app with USB permission already granted; connect right away. */
    private fun handleUsbIntent(intent: Intent?) {
        if (intent?.action == UsbManager.ACTION_USB_DEVICE_ATTACHED) {
            (application as OffGridApp).container.antenna.connect()
        }
    }
}
