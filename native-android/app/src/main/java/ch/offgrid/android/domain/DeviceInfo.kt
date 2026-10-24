package ch.offgrid.android.domain

import ch.offgrid.android.link.bool
import ch.offgrid.android.link.double
import ch.offgrid.android.link.int
import ch.offgrid.android.link.str
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** `radio.get` (link spec 7): the PHY settings every node of a mesh has to share. */
data class RadioConfig(
    val freqMhz: Double?,
    val bwKhz: Double?,
    val sf: Int?,
    val cr: Int?,
    val txPowerDbm: Int?,
    val preamble: Int?,
    val syncWord: Int?,
    /** Estimated airtime of a 23-byte packet at these settings. */
    val airtime23Ms: Int?,
) {
    companion object {
        fun parse(o: JsonObject) = RadioConfig(
            freqMhz = o.double("freq_mhz"), bwKhz = o.double("bw_khz"), sf = o.int("sf"), cr = o.int("cr"),
            txPowerDbm = o.int("tx_power_dbm"), preamble = o.int("preamble"), syncWord = o.int("sync_word"),
            airtime23Ms = o.int("est_airtime_ms_23b"),
        )
    }
}

/** `mesh.get` / `mesh.set` (link spec 8). Fields an older image does not report stay null. */
data class MeshConfig(
    val hopDefault: Int?,
    val relayEnabled: Boolean?,
    val relayWhenLocked: Boolean?,
    val retries: Int?,
    val cadEnabled: Boolean?,
) {
    companion object {
        const val MAX_HOPS = 7

        fun parse(o: JsonObject) = MeshConfig(
            hopDefault = o.int("hop_default"), relayEnabled = o.bool("relay_enabled"),
            relayWhenLocked = o.bool("relay_when_locked"), retries = o.int("retries"), cadEnabled = o.bool("cad_enabled"),
        )
    }
}

/**
 * `lab.get` / `lab.set` of the lab radio image (only when `sys.hello.lab_radio` is true, only unlocked).
 * [ignoreNodes] are NodeIDs whose directly heard packets the antenna drops as if they were out of range;
 * copies relayed by another node still arrive. That forces A→B→C routes with all boards in one room.
 */
data class LabConfig(
    val textCodec: String,
    val maxTextInputBytes: Int?,
    val nodeId: String?,
    val fw: String?,
    /** Null when the image predates the ignore list. */
    val ignoreNodes: List<String>?,
) {
    companion object {
        const val MAX_IGNORE_NODES = 8
        private val NODE_ID = Regex("^[0-9A-F]{4}$")

        fun parse(o: JsonObject) = LabConfig(
            textCodec = o.str("text_codec") ?: MessageLimits.CODEC_RAW,
            maxTextInputBytes = o.int("max_text_input_bytes"),
            nodeId = o.str("node_id"),
            fw = o.str("fw"),
            ignoreNodes = (o["ignore_nodes"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.content },
        )

        /** Normalises user input to the four upper-case hex digits of a NodeID, or null when it is not one. */
        fun normalizeNodeId(input: String): String? = input.trim().removePrefix("0x").uppercase().takeIf { NODE_ID.matches(it) }
    }
}

/** Counters of `radio.stats` in the order the advanced screen lists them, with German labels. */
object RadioStats {
    val LABELS: List<Pair<String, String>> = listOf(
        "tx_packets" to "Gesendete Pakete",
        "rx_packets" to "Empfangene Pakete",
        "relayed" to "Weitergeleitet",
        "relay_suppressed" to "Weiterleitung unterdrückt",
        "relay_dropped" to "Weiterleitung verworfen",
        "rate_limit_drops" to "Verworfen (Ratenlimit)",
        "acks_sent" to "Bestätigungen gesendet",
        "acks_received" to "Bestätigungen empfangen",
        "retries" to "Wiederholungen",
        "resends" to "Erneut gesendet (wartend)",
        "rx_crc_errors" to "CRC-Fehler",
        "rx_tag_failures" to "Authentifizierung fehlgeschlagen",
        "rx_malformed" to "Fehlerhafte Pakete",
        "rx_dedupe_drops" to "Duplikate verworfen",
        "cad_scans" to "Kanalprüfungen",
        "cad_busy" to "Kanal belegt",
        "tx_airtime_ms_total" to "Sendezeit gesamt (ms)",
        "tx_duty_cycle_max_percent" to "Duty Cycle max. (%)",
        "locked_buffered" to "Gepuffert während gesperrt",
        "locked_expired" to "Puffer abgelaufen",
        "radio_failures" to "Funkfehler",
        "radio_timeouts" to "Funk-Zeitüberschreitungen",
        "dropped_events" to "Verlorene Ereignisse",
        "dropped_acks" to "Verlorene Bestätigungen",
        "last_rssi" to "Letzter RSSI (dBm)",
        "last_snr" to "Letzter SNR (dB)",
    )

    /** Label and printable value for every known counter in [result], then any unknown numeric fields. */
    fun rows(result: JsonObject): List<Pair<String, String>> {
        val known = LABELS.mapNotNull { (key, label) -> format(result[key])?.let { label to it } }
        val extra = result.keys.filter { key -> LABELS.none { it.first == key } }.sorted()
            .mapNotNull { key -> format(result[key])?.let { key to it } }
        return known + extra
    }

    private fun format(value: Any?): String? {
        val p = value as? JsonPrimitive ?: return null
        if (p.isString) return null
        val d = p.content.toDoubleOrNull() ?: return null
        return if (d == Math.floor(d) && !d.isInfinite()) d.toLong().toString() else String.format(java.util.Locale.ROOT, "%.1f", d)
    }
}
