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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The QR flow of link spec 5 against both simulated firmwares: the shown code has to stay the one the antenna
 * completes with, also when the pairing screen is opened several times.
 */
class PairingTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @After
    fun tearDown() = scope.cancel()

    private class Rig(val device: SimulatedHeltec, val antenna: AntennaManager, val pairing: Pairing, val store: FakeStore)

    private fun rig(lab: Boolean): Rig {
        val device = SimulatedHeltec(SimFlashStore(null), scope, labRadio = lab)
        val antenna = AntennaManager(scope, { SimulatedLink(device) }, FixedKeyUnlockTokenSource(OgCrypto.sha256("p".toByteArray())),
            Settings(MemorySettingDao(), scope)).apply {
            listener = object : AntennaListener {
                override suspend fun onReady(antenna: AntennaManager, deviceId: String) {}
                override suspend fun onEvent(event: Incoming.Event) {}
                override suspend fun onDeviceRebooted() {}
            }
        }
        val store = FakeStore()
        return Rig(device, antenna, Pairing(antenna, store, scope), store)
    }

    private suspend fun Rig.ready() {
        antenna.connect()
        withTimeout(10_000) { antenna.state.first { it.ready } }
    }

    private suspend fun Rig.shownCode(after: Int = 0): String = withTimeout(5_000) {
        pairing.state.first { it.qr != null && it.codeVersion > after }.qr!!
    }

    private suspend fun Rig.settled(): PairingState = withTimeout(5_000) {
        pairing.state.first { it.error != null || it.scannedName != null }
    }

    private fun saltOf(qr: String) = OgCrypto.unb64(qr).copyOfRange(35, 51)

    private fun reopenKeepsTheCode(lab: Boolean) = runBlocking {
        val r = rig(lab)
        r.ready()
        r.pairing.begin()
        val first = r.shownCode()
        r.pairing.leave()
        r.pairing.begin()
        assertEquals(first, r.shownCode())
        r.pairing.leave()
        r.pairing.begin()
        assertEquals(first, r.shownCode())
        // The antenna still has exactly the salt in the code, so a peer who scanned it gets the same key.
        assertArrayEquals(saltOf(first), r.device.pairingSalt())
    }

    @Test
    fun reopeningTheScreenKeepsTheCodeOnTeamFirmware() = reopenKeepsTheCode(lab = false)

    @Test
    fun reopeningTheScreenKeepsTheCodeOnTheLabImage() = reopenKeepsTheCode(lab = true)

    @Test
    fun aLockedAntennaGetsANewCode() = runBlocking {
        val r = rig(lab = true)
        r.ready()
        r.pairing.begin()
        val first = r.shownCode()
        r.pairing.leave()
        val before = r.antenna.state.value.unlockCount
        r.antenna.call("sec.lock")
        withTimeout(5_000) { r.antenna.state.first { it.ready && it.unlockCount > before } }
        r.pairing.begin()
        assertNotEquals(first, r.shownCode())
    }

    @Test
    fun anEndedSessionIsRenewedAndTheNewCodeShown() = runBlocking {
        val r = rig(lab = false)
        r.ready()
        r.pairing.begin()
        val v = r.pairing.state.value.codeVersion
        val shown = r.shownCode()
        r.pairing.complete(r.device.addVirtualPeer("Anna", -80))
        assertEquals("Anna", r.settled().scannedName)
        // Team firmware: the completion ended the session. A second peer in the same visit needs a new one.
        r.pairing.leave()
        r.pairing.begin()
        assertEquals(shown, r.shownCode(after = v))
        r.pairing.complete(r.device.addVirtualPeer("Ben", -80))
        val s = withTimeout(5_000) { r.pairing.state.first { it.scannedName == "Ben" } }
        assertTrue(s.codeRenewed)
        assertNotEquals(shown, s.qr)
    }

    @Test
    fun theSamePeerCodeTwiceIsCodeUsedOnTheLabImage() = runBlocking {
        val r = rig(lab = true)
        r.ready()
        r.pairing.begin()
        r.shownCode()
        val anna = r.device.addVirtualPeer("Anna", -80)
        r.pairing.complete(anna)
        r.settled()
        r.pairing.leave()
        r.pairing.begin()
        r.shownCode()
        r.pairing.complete(anna, replace = true)
        assertEquals(PairingError.CODE_USED, r.settled().error)
    }

    @Test
    fun anExistingContactCanBePairedAgainWithReplace() = runBlocking {
        val r = rig(lab = false)
        r.ready()
        r.pairing.begin()
        r.shownCode()
        val anna = r.device.addVirtualPeer("Anna", -80)
        r.pairing.complete(anna)
        r.settled()
        r.pairing.leave()
        r.pairing.begin()
        r.shownCode()
        r.pairing.complete(anna)
        val refused = r.settled()
        assertEquals(PairingError.CONTACT_EXISTS, refused.error)
        assertEquals(anna, refused.replaceCode)
        r.pairing.complete(refused.replaceCode!!, replace = true)
        val s = withTimeout(5_000) { r.pairing.state.first { it.scannedName != null } }
        assertEquals(null, s.error)
        assertEquals(1, r.antenna.call("contact.list").int("total"))
        assertFalse(r.store.saved.isEmpty())
    }

    private class FakeStore : Pairing.Store {
        val saved = mutableListOf<JsonObject>()
        private val states = MutableStateFlow<Map<Long, String>>(emptyMap())
        override suspend fun save(deviceId: String, contact: JsonObject): Long {
            saved += contact
            val id = contact.int("contact_id")!!.toLong()
            states.value = states.value + (id to "pending")
            return id
        }
        override fun contactState(contactId: Long): Flow<String?> = states.map { it[contactId] }
    }

    private class MemorySettingDao : SettingDao {
        private val map = MutableStateFlow<Map<String, String>>(emptyMap())
        override fun observeAll(): Flow<List<SettingEntity>> = map.map { m -> m.map { SettingEntity(it.key, it.value) } }
        override suspend fun get(key: String): String? = map.value[key]
        override suspend fun put(setting: SettingEntity) { map.value = map.value + (setting.key to setting.value) }
        override suspend fun remove(key: String) { map.value = map.value - key }
    }
}
