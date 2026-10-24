package ch.offgrid.android.link

import android.content.Context
import ch.offgrid.android.BuildConfig
import ch.offgrid.android.link.tcp.TcpLink
import ch.offgrid.android.link.usb.UsbSerialLink

/**
 * The link behind "USB antenna". Debug builds can point it at a serial-to-TCP bridge instead
 * (`OFFGRID_TCP_LINK=10.0.2.2:5555` in `local.properties`), so the emulator talks to a real Heltec
 * attached to another machine. Release builds always use USB; the field is empty there.
 */
fun hardwareLink(context: Context): Link {
    val endpoint = BuildConfig.TCP_LINK.takeIf { BuildConfig.DEBUG && it.isNotBlank() } ?: return UsbSerialLink(context)
    val host = endpoint.substringBeforeLast(':')
    val port = endpoint.substringAfterLast(':').toIntOrNull() ?: return UsbSerialLink(context)
    return TcpLink(host, port)
}
