package ch.offgrid.android.domain

import ch.offgrid.android.analytics.AnalyticsEvent
import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.data.OffGridDatabase
import ch.offgrid.android.link.LinkClosedException
import ch.offgrid.android.link.LinkCommandException
import ch.offgrid.android.link.LinkTimeoutException
import ch.offgrid.android.link.int
import ch.offgrid.android.link.obj
import ch.offgrid.android.link.str
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

enum class PairingError { INVALID_QR, ANTENNA_NOT_READY, CONTACT_EXISTS, SELF_PAIR, FAILED }

data class PairingState(
    /** QR text from `pair.begin`; rendered as the QR code. */
    val qr: String? = null,
    val error: PairingError? = null,
    /** Set after we scanned the other side. */
    val scannedName: String? = null,
    val scannedContactId: Long? = null,
    /** Our first packet to the peer went out (step "Schlüssel per Funk gesendet"). */
    val pingSent: Boolean = false,
    /** The peer's first valid packet arrived: the contact is active (step 3). */
    val confirmedContactId: Long? = null,
)

/**
 * QR key exchange as in link spec 7.4. Both people show their code (`pair.begin`) and scan the
 * other one (`pair.complete`). The contact is `pending` until the first valid packet from the peer;
 * to make that happen right away, the app sends an empty reaction as a ping (see README).
 */
class Pairing(
    private val antenna: AntennaManager,
    private val messaging: Messaging,
    private val db: OffGridDatabase,
    private val scope: CoroutineScope,
    private val track: (AnalyticsEvent) -> Unit = {},
) {
    private val _state = MutableStateFlow(PairingState())
    val state: StateFlow<PairingState> = _state.asStateFlow()
    private var refreshJob: Job? = null
    private var watchJob: Job? = null

    /** Requests a fresh QR from the device and refreshes it shortly before the 300 s expiry. */
    fun begin() {
        track(AnalyticsEvent.PairingStarted)
        refreshJob?.cancel()
        refreshJob = scope.launch {
            while (true) {
                if (!antenna.state.value.ready) {
                    _state.update { it.copy(error = PairingError.ANTENNA_NOT_READY) }
                    antenna.state.first { it.ready }
                }
                val result = runCatching { antenna.call("pair.begin") }.getOrNull()
                if (result == null) {
                    delay(1_000)
                    continue
                }
                _state.update { it.copy(qr = result.str("qr"), error = null) }
                // Spec: do not refresh between being scanned and scanning back; 280 s leaves room for that.
                delay(((result.int("expires_s") ?: 300) - 20) * 1_000L)
            }
        }
    }

    fun complete(qrText: String) {
        scope.launch {
            val qr = qrText.trim()
            if (!looksLikeOffGridQr(qr)) {
                _state.update { it.copy(error = PairingError.INVALID_QR) }
                return@launch
            }
            if (!antenna.state.value.ready) {
                _state.update { it.copy(error = PairingError.ANTENNA_NOT_READY) }
                return@launch
            }
            try {
                val result = try {
                    antenna.call("pair.complete", buildJsonObject { put("qr", qr) })
                } catch (e: LinkCommandException) {
                    if (e.error.code != "E_NO_PAIRING") throw e
                    antenna.call("pair.begin")
                    antenna.call("pair.complete", buildJsonObject { put("qr", qr) })
                }
                val contactJson = result.obj("contact")!!
                val deviceId = antenna.state.value.deviceId!!
                val id = messaging.upsertFromDevice(deviceId, contactJson, keepName = false)
                _state.update { it.copy(error = null, scannedName = contactJson.str("name"), scannedContactId = id, pingSent = false) }
                watchConfirmation(id)
                // The contact is stored at this point; the ping only speeds up activation. Firmware that
                // rejects it (the team image up to ed9fd57 refuses every reaction, see docs/hardware.md)
                // must not turn a successful pairing into an error. The peer's own ping activates us anyway.
                val pinged = try {
                    antenna.call("msg.send", Messaging.pingArgs(contactJson.int("contact_id")!!))
                    true
                } catch (_: LinkCommandException) {
                    false
                }
                _state.update { it.copy(pingSent = pinged) }
            } catch (e: LinkCommandException) {
                _state.update {
                    it.copy(error = when (e.error.code) {
                        "E_INVALID_QR" -> PairingError.INVALID_QR
                        "E_CONTACT_EXISTS" -> PairingError.CONTACT_EXISTS
                        "E_SELF_PAIR" -> PairingError.SELF_PAIR
                        else -> PairingError.FAILED
                    })
                }
            } catch (_: LinkClosedException) {
                _state.update { it.copy(error = PairingError.ANTENNA_NOT_READY) }
            } catch (_: LinkTimeoutException) {
                _state.update { it.copy(error = PairingError.FAILED) }
            }
        }
    }

    private fun watchConfirmation(contactId: Long) {
        watchJob?.cancel()
        watchJob = scope.launch {
            db.contacts().observe(contactId).filterNotNull().first { it.state == "active" }
            _state.update { it.copy(confirmedContactId = contactId) }
            track(AnalyticsEvent.PairingCompleted)
        }
    }

    /** Leaves the screen: discard the pending pairing on the device (spec `pair.cancel`). */
    fun cancel() {
        refreshJob?.cancel()
        watchJob?.cancel()
        _state.value = PairingState()
        scope.launch { runCatching { antenna.call("pair.cancel") } }
    }

    fun clearError() = _state.update { it.copy(error = null) }

    companion object {
        /** Cheap local check before bothering the device: Base64 of "OG1" + 32 B key + 16 B salt + name. */
        fun looksLikeOffGridQr(text: String): Boolean {
            val raw = runCatching { OgCrypto.unb64(text) }.getOrNull() ?: return false
            return raw.size >= 51 && raw[0] == 'O'.code.toByte() && raw[1] == 'G'.code.toByte() && raw[2] == '1'.code.toByte()
        }
    }
}
