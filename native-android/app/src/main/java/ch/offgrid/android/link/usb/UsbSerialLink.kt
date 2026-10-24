package ch.offgrid.android.link.usb

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import androidx.core.content.ContextCompat
import ch.offgrid.android.link.FoundDevice
import ch.offgrid.android.link.Link
import ch.offgrid.android.link.LinkKind
import ch.offgrid.android.link.LinkOpenException
import ch.offgrid.android.link.LinkSession
import ch.offgrid.android.link.OpenError
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.hoho.android.usbserial.util.SerialInputOutputManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

/**
 * Real antenna: Heltec WiFi LoRa 32 V3 over USB OTG. The firmware's default build talks on UART0
 * through the board's CP2102 bridge (`OFFGRID_SERIAL_NATIVE_USB=0`), which usb-serial-for-android
 * drives without root; the `serial_mock_usb` build uses the ESP32-S3's own USB-Serial/JTAG (CDC)
 * instead, which the default prober also finds. Serial settings from link spec 3.1: 115200 8N1.
 */
class UsbSerialLink(private val context: Context, private val baudRate: Int = 115_200) : Link {
    override val kind = LinkKind.USB
    private val usb = context.getSystemService(UsbManager::class.java)

    override suspend fun find(): FoundDevice? = withContext(Dispatchers.IO) {
        val driver = UsbSerialProber.getDefaultProber().findAllDrivers(usb).firstOrNull() ?: return@withContext null
        FoundDevice(label = labelFor(driver.device), handle = driver)
    }

    override suspend fun open(device: FoundDevice): LinkSession {
        val driver = device.handle as? UsbSerialDriver ?: throw LinkOpenException(OpenError.NO_DEVICE)
        if (!usb.hasPermission(driver.device) && !requestPermission(driver.device)) {
            throw LinkOpenException(OpenError.PERMISSION_DENIED)
        }
        return withContext(Dispatchers.IO) {
            val connection = usb.openDevice(driver.device) ?: throw LinkOpenException(OpenError.OPEN_FAILED)
            val port = driver.ports.firstOrNull() ?: throw LinkOpenException(OpenError.OPEN_FAILED)
            try {
                port.open(connection)
                port.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
                // Link spec 3.3: DTR/RTS drive the ESP32 auto-reset circuit, and RTS high with DTR low pulls EN
                // low. Clearing RTS before DTR never passes through that combination. A reset matters a lot with
                // the current firmware mock: it forgets identity, provisioning and contacts on every boot.
                runCatching { port.rts = false; port.dtr = false }
            } catch (e: Exception) {
                runCatching { port.close() }
                throw LinkOpenException(OpenError.OPEN_FAILED, e.message)
            }
            UsbSession(port)
        }
    }

    private class UsbSession(private val port: UsbSerialPort) : LinkSession {
        override val incoming: Flow<ByteArray> = callbackFlow {
            val io = SerialInputOutputManager(port, object : SerialInputOutputManager.Listener {
                override fun onNewData(data: ByteArray) {
                    trySend(data)
                }

                override fun onRunError(e: Exception) {
                    close(e)
                }
            })
            io.start()
            awaitClose { io.stop() }
        }.flowOn(Dispatchers.IO)

        override suspend fun write(bytes: ByteArray) = withContext(Dispatchers.IO) {
            port.write(bytes, WRITE_TIMEOUT_MS)
        }

        override fun close() {
            runCatching { port.close() }
        }
    }

    private suspend fun requestPermission(device: UsbDevice): Boolean = suspendCancellableCoroutine { cont ->
        val action = "${context.packageName}.USB_PERMISSION"
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (intent.action != action) return
                runCatching { context.unregisterReceiver(this) }
                if (cont.isActive) cont.resume(intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false))
            }
        }
        ContextCompat.registerReceiver(context, receiver, IntentFilter(action), ContextCompat.RECEIVER_NOT_EXPORTED)
        cont.invokeOnCancellation { runCatching { context.unregisterReceiver(receiver) } }
        // Android 14 forbids mutable PendingIntents with implicit intents, so the intent names our package.
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        val intent = Intent(action).setPackage(context.packageName)
        usb.requestPermission(device, PendingIntent.getBroadcast(context, 0, intent, flags))
    }

    private fun labelFor(device: UsbDevice): String = when (device.vendorId) {
        VENDOR_SILABS -> "CP2102"
        VENDOR_ESPRESSIF -> "ESP32-S3"
        else -> device.productName ?: "USB-Serial"
    }

    private companion object {
        const val WRITE_TIMEOUT_MS = 1_000
        const val VENDOR_SILABS = 0x10C4
        const val VENDOR_ESPRESSIF = 0x303A
    }
}
