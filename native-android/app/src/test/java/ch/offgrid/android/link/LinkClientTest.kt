package ch.offgrid.android.link

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class LinkClientTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** A session we feed by hand; [fail] simulates pulling the USB cable. */
    private class FakeSession : LinkSession {
        val toApp = Channel<ByteArray>(Channel.UNLIMITED)
        val written = Channel<String>(Channel.UNLIMITED)
        override val incoming: Flow<ByteArray> = toApp.receiveAsFlow()
        override suspend fun write(bytes: ByteArray) {
            written.send(bytes.toString(Charsets.UTF_8))
        }
        override fun close() = Unit
        fun send(line: String) = toApp.trySend((line + "\n").toByteArray())
        fun fail() = toApp.close(IOException("USB device detached"))
    }

    @After
    fun tearDown() = scope.cancel()

    @Test
    fun matchesResponsesAndIgnoresTheFirmwareParseErrorWithoutId() = runBlocking {
        val session = FakeSession()
        session.toApp.trySend("\n".toByteArray()) // ends the dropped first partial line
        val client = LinkClient(session, scope)
        val result = CompletableDeferred<Long?>()
        val job = scope.launch { result.complete(client.call("sys.ping").long("uptime_ms")) }
        val request = withTimeout(2_000) { session.written.receive() }
        assertEquals("{\"id\":1,\"cmd\":\"sys.ping\"}\n", request)
        session.send("{\"ok\":false,\"error\":{\"code\":\"E_PARSE\",\"message\":\"invalid JSON\"}}")
        session.send("{\"id\":1,\"ok\":true,\"result\":{\"uptime_ms\":42}}")
        assertEquals(42L, withTimeout(2_000) { result.await() })
        job.join()
    }

    @Test
    fun unplugEndsTheEventStreamWithoutThrowingAndReportsTheCause() = runBlocking {
        val session = FakeSession()
        session.toApp.trySend("\n".toByteArray())
        val client = LinkClient(session, scope)
        session.send("{\"evt\":\"sys.boot\",\"t\":1,\"data\":{}}")
        session.fail()
        val names = mutableListOf<String>()
        withTimeout(2_000) { for (event in client.events) names += event.name }
        assertEquals(listOf("sys.boot"), names)
        assertTrue(withTimeout(2_000) { client.closed.await() } is IOException)
    }
}
