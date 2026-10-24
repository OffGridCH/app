package ch.offgrid.android.link.sim

import ch.offgrid.android.link.FoundDevice
import ch.offgrid.android.link.Link
import ch.offgrid.android.link.LinkKind
import ch.offgrid.android.link.LinkSession
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow

/** [Link] backed by [SimulatedHeltec]; bytes go through the same framing as on USB. */
class SimulatedLink(val device: SimulatedHeltec) : Link {
    override val kind = LinkKind.SIMULATED

    /** Lets the demo menu "unplug" the simulated antenna so the disconnected states can be shown. */
    @Volatile
    var pluggedIn: Boolean = true

    override suspend fun find(): FoundDevice? {
        delay(400) // a USB scan is not instant either; keeps the step list readable
        return if (pluggedIn) FoundDevice(label = "ESP32", handle = null) else null
    }

    override suspend fun open(device: FoundDevice): LinkSession {
        delay(300)
        val output = this.device.attach()
        return object : LinkSession {
            override val incoming: Flow<ByteArray> = output.receiveAsFlow()

            override suspend fun write(bytes: ByteArray) {
                this@SimulatedLink.device.receive(bytes)
            }

            override fun close() {
                this@SimulatedLink.device.detach()
            }
        }
    }

    fun unplug() {
        pluggedIn = false
        device.unplug()
    }
}
