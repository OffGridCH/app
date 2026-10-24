package ch.offgrid.android.link.tcp

import ch.offgrid.android.link.FoundDevice
import ch.offgrid.android.link.Link
import ch.offgrid.android.link.LinkKind
import ch.offgrid.android.link.LinkOpenException
import ch.offgrid.android.link.LinkSession
import ch.offgrid.android.link.OpenError
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

/**
 * Development link to a real antenna through a serial-to-TCP bridge (`lab/tools/bridge.py` in the
 * firmware lab). The bytes are exactly what the board sends on its UART, so everything above the
 * [Link] interface runs the same code as on USB. Used by the emulator (`10.0.2.2`) and by the JVM
 * hardware tests; never part of a release build (see [hardwareLink]).
 */
class TcpLink(
    private val host: String,
    private val port: Int,
    override val kind: LinkKind = LinkKind.USB,
    private val connectTimeoutMs: Int = 2_000,
) : Link {
    override suspend fun find(): FoundDevice? = withContext(Dispatchers.IO) {
        // A bridge that accepts the connection counts as a found device; the probe socket is closed again
        // because the bridge serves one client at a time.
        try {
            Socket().use { it.connect(InetSocketAddress(host, port), connectTimeoutMs) }
            FoundDevice(label = "TCP $host:$port", handle = host to port)
        } catch (_: IOException) {
            null
        }
    }

    override suspend fun open(device: FoundDevice): LinkSession = withContext(Dispatchers.IO) {
        val socket = Socket()
        try {
            socket.tcpNoDelay = true
            socket.connect(InetSocketAddress(host, port), connectTimeoutMs)
        } catch (e: IOException) {
            runCatching { socket.close() }
            throw LinkOpenException(OpenError.OPEN_FAILED, e.message)
        }
        TcpSession(socket)
    }

    private class TcpSession(private val socket: Socket) : LinkSession {
        override val incoming: Flow<ByteArray> = callbackFlow {
            val reader = launch(Dispatchers.IO) {
                val buffer = ByteArray(4096)
                val input = socket.getInputStream()
                try {
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        if (n > 0) send(buffer.copyOf(n))
                    }
                    close(IOException("bridge closed the connection"))
                } catch (e: IOException) {
                    close(e)
                }
            }
            awaitClose { reader.cancel(); runCatching { socket.close() } }
        }.flowOn(Dispatchers.IO)

        override suspend fun write(bytes: ByteArray) = withContext(Dispatchers.IO) {
            val output = socket.getOutputStream()
            output.write(bytes)
            output.flush()
        }

        override fun close() {
            runCatching { socket.close() }
        }
    }
}
