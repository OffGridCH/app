package ch.offgrid.android.domain

import ch.offgrid.android.crypto.FixedKeyUnlockTokenSource
import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.data.SettingDao
import ch.offgrid.android.data.SettingEntity
import ch.offgrid.android.link.Incoming
import ch.offgrid.android.link.int
import ch.offgrid.android.link.sim.SimFlashStore
import ch.offgrid.android.link.sim.SimulatedHeltec
import ch.offgrid.android.link.sim.SimulatedLink
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

/**
 * The app's antenna session against the simulated lab.3 antenna: provisioning, wrong phone, rate limit,
 * auto-lock and the authenticated factory reset. Real hardware is not involved.
 */
class AntennaSecurityTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val flashFile = File.createTempFile("sim-heltec", ".json").also { it.delete() }
    private val device = SimulatedHeltec(SimFlashStore(flashFile), scope)
    private val link = SimulatedLink(device)
    private val readyCount = Channel<String>(Channel.UNLIMITED)

    @After
    fun tearDown() {
        scope.cancel()
        flashFile.delete()
    }

    private fun manager(phone: String, settings: Settings = Settings(MemorySettingDao(), scope)) =
        AntennaManager(scope, { link }, FixedKeyUnlockTokenSource(OgCrypto.sha256(phone.toByteArray())), settings).apply {
            listener = object : AntennaListener {
                override suspend fun onReady(antenna: AntennaManager, deviceId: String) { readyCount.trySend(deviceId) }
                override suspend fun onEvent(event: Incoming.Event) {}
                override suspend fun onDeviceRebooted() {}
            }
        }

    private suspend fun AntennaManager.settle(): AntennaState = withTimeout(15_000) {
        state.first { it.phase == AntennaPhase.READY || it.phase == AntennaPhase.ERROR }
    }

    private suspend fun AntennaManager.reconnect(): AntennaState {
        disconnect()
        connect()
        return settle()
    }

    @Test
    fun anotherPhoneSeesUnlockFailedThenRateLimited() = runBlocking {
        val owner = manager("phone-a")
        owner.connect()
        assertEquals(AntennaPhase.READY, owner.settle().phase)
        owner.disconnect()
        device.powerCycle() // locked again, as after unplugging it

        val other = manager("phone-b")
        other.connect()
        assertEquals(AntennaError.UNLOCK_FAILED, other.settle().error)
        assertEquals(AntennaError.UNLOCK_FAILED, other.reconnect().error)
        assertEquals(AntennaError.UNLOCK_FAILED, other.reconnect().error)
        // Three failures: the antenna waits 2 s before it checks a token again (Security.cpp backoff).
        with(other.reconnect()) {
            assertEquals(AntennaError.RATE_LIMITED, error)
            assertEquals("E_RATE_LIMITED", errorCode)
        }
    }

    @Test
    fun autoLockIsReopenedAndTheReasonCleared() = runBlocking {
        val m = manager("phone-a")
        m.connect()
        m.settle()
        readyCount.receive()
        m.call("sec.lock")
        withTimeout(5_000) { readyCount.receive() }
        val state = m.state.value
        assertEquals(AntennaPhase.READY, state.phase)
        assertNull(state.lockReason)
    }

    @Test
    fun provisioningAFreshVaultDropsAnOldTransferToken() = runBlocking {
        val settings = Settings(MemorySettingDao(), scope)
        settings.put(Settings.TRANSFER_TOKEN, OgCrypto.b64(ByteArray(32)))
        settings.put(Settings.TRANSFER_DEVICE, device.deviceIdHex)
        val m = manager("phone-a", settings)
        m.connect()
        assertEquals(AntennaPhase.READY, m.settle().phase)
        assertNull(settings.get(Settings.TRANSFER_TOKEN))
        assertNull(settings.get(Settings.TRANSFER_DEVICE))
    }

    @Test
    fun factoryResetErasesTheAntennaAndSetsItUpAgain() = runBlocking {
        val m = manager("phone-a")
        m.connect()
        val before = m.settle()
        readyCount.receive()
        val qr = device.addVirtualPeer("Anna", -90)
        m.call("pair.begin")
        m.call("pair.complete", buildJsonObject { put("qr", qr) })
        assertEquals(1, m.call("contact.list", buildJsonObject { put("offset", 0); put("limit", 10) }).int("total"))

        assertEquals(ResetResult.DONE, m.factoryReset())
        withTimeout(10_000) { readyCount.receive() }
        val after = m.state.value
        assertEquals(AntennaPhase.READY, after.phase)
        assertEquals(before.deviceId, after.deviceId)
        // New vault, new identity, no contacts.
        assertNotEquals(before.nodeId, after.nodeId)
        assertEquals(0, m.call("contact.list", buildJsonObject { put("offset", 0); put("limit", 10) }).int("total"))
    }

    @Test
    fun onlyTheOwnersTokenResetsTheAntenna() = runBlocking {
        val owner = manager("phone-a")
        owner.connect()
        owner.settle()
        owner.disconnect()
        // The antenna stays unlocked until its heartbeat timeout, so another phone gets a session without a
        // token; the reset still needs the owner's token under the reset label.
        val stranger = manager("phone-b")
        stranger.connect()
        assertEquals(AntennaPhase.READY, stranger.settle().phase)
        assertEquals(ResetResult.WRONG_PHONE, stranger.factoryReset())
        stranger.disconnect()

        // After a backup import the old phone's token is tried as well.
        val settings = Settings(MemorySettingDao(), scope)
        settings.put(Settings.TRANSFER_TOKEN, OgCrypto.b64(owner.tokenFor(device.deviceIdHex)))
        settings.put(Settings.TRANSFER_DEVICE, device.deviceIdHex)
        val heir = manager("phone-c", settings)
        heir.connect()
        assertEquals(AntennaPhase.READY, heir.settle().phase)
        assertEquals(ResetResult.DONE, heir.factoryReset())
        assertNull(settings.get(Settings.TRANSFER_TOKEN))
    }

    private class MemorySettingDao : SettingDao {
        private val map = MutableStateFlow<Map<String, String>>(emptyMap())
        override fun observeAll(): Flow<List<SettingEntity>> = map.map { m -> m.map { SettingEntity(it.key, it.value) } }
        override suspend fun get(key: String): String? = map.value[key]
        override suspend fun put(setting: SettingEntity) { map.value = map.value + (setting.key to setting.value) }
        override suspend fun remove(key: String) { map.value = map.value - key }
    }
}
