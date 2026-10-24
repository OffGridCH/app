package ch.offgrid.android.link

import kotlinx.coroutines.flow.Flow

/** Which antenna implementation is active. */
enum class LinkKind { SIMULATED, USB }

/** A physical or simulated antenna that was found but not opened yet. */
data class FoundDevice(
    /** Short label for the "USB-Gerät erkannt" step, for example "ESP32". */
    val label: String,
    /** Opaque handle the [Link] implementation uses to open it. */
    val handle: Any?,
)

/**
 * Error codes for opening an antenna. They map 1:1 to the UI texts in the screen spec
 * (`no-device`, `permission-denied`, `open-failed`).
 */
enum class OpenError { NO_DEVICE, PERMISSION_DENIED, OPEN_FAILED }

class LinkOpenException(val error: OpenError, message: String? = null) : Exception(message ?: error.name)

/**
 * Byte transport to the antenna. Implementations: [ch.offgrid.android.link.sim.SimulatedLink]
 * (in-process firmware simulator) and [ch.offgrid.android.link.usb.UsbSerialLink] (Heltec V3 over
 * USB OTG). Everything above this interface (framing, JSON, unlock, messaging) is shared, so the
 * simulator exercises exactly the code path the real hardware will use.
 */
interface Link {
    val kind: LinkKind

    /** Looks for an antenna. Returns null when none is attached. */
    suspend fun find(): FoundDevice?

    /** Opens the device, asking for USB permission if needed. Throws [LinkOpenException]. */
    suspend fun open(device: FoundDevice): LinkSession
}

/** An open byte stream. `incoming` completes or fails when the device is gone. */
interface LinkSession {
    val incoming: Flow<ByteArray>
    suspend fun write(bytes: ByteArray)
    fun close()
}
