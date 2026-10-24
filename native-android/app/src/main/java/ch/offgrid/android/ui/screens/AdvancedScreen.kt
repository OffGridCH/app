package ch.offgrid.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import ch.offgrid.android.domain.AntennaState
import ch.offgrid.android.domain.Formats
import ch.offgrid.android.domain.IgnoreEdit
import ch.offgrid.android.domain.LabConfig
import ch.offgrid.android.domain.MeshConfig
import ch.offgrid.android.domain.MessageLimits
import ch.offgrid.android.domain.RadioStats
import ch.offgrid.android.link.LinkClosedException
import ch.offgrid.android.link.LinkCommandException
import ch.offgrid.android.link.LinkTimeoutException
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.back
import ch.offgrid.android.ui.components.ButtonVariant
import ch.offgrid.android.ui.components.CardDivider
import ch.offgrid.android.ui.components.InfoRow
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgCard
import ch.offgrid.android.ui.components.OgNote
import ch.offgrid.android.ui.components.OgSegmented
import ch.offgrid.android.ui.components.OgTextField
import ch.offgrid.android.ui.components.OgTopBar
import ch.offgrid.android.ui.components.SectionLabel
import ch.offgrid.android.ui.theme.Grotesk
import ch.offgrid.android.ui.theme.Mono
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/**
 * "Erweitert / Lab": what the antenna is and how its radio and mesh are set, for lab tests and support. Mesh and
 * lab settings go to the antenna (`mesh.set`, `lab.set`) and are persisted there; every node of a test has to be
 * set on its own. Lab boards always reach this screen from the settings, team boards behind a switch.
 */
@Composable
fun AdvancedScreen(nav: NavHostController) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val antenna by app.antenna.state.collectAsStateWithLifecycle()
    var stats by remember { mutableStateOf<JsonObject?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var nodeInput by rememberSaveable { mutableStateOf("") }
    var nodeError by remember { mutableStateOf<String?>(null) }
    val ready = antenna.ready

    fun run(action: suspend () -> Unit) {
        if (busy) return
        scope.launch {
            busy = true
            error = null
            error = try {
                action()
                null
            } catch (e: LinkCommandException) {
                "Die Antenne hat abgelehnt: ${e.error.code}" + (e.error.message?.let { " ($it)" } ?: "")
            } catch (_: LinkClosedException) {
                "Die Antenne ist nicht verbunden."
            } catch (_: LinkTimeoutException) {
                "Die Antenne hat nicht geantwortet."
            }
            busy = false
        }
    }

    LaunchedEffect(ready) {
        if (ready) run {
            app.antenna.refreshInfo()
            stats = app.antenna.radioStats()
        }
    }

    Page {
        OgTopBar(if (antenna.labRadio) "Erweitert / Lab" else "Erweitert", onBack = { nav.back() }, backLabel = "Zurück zu den Einstellungen")
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
            if (!ready) OgNote("Die Antenne ist nicht verbunden. Die Werte sind vom letzten Verbinden, ändern geht erst wieder verbunden.")
            error?.let { OgNote(it) }

            FirmwareSection(antenna)
            RadioSection(antenna)
            MeshSection(antenna.mesh, enabled = ready && !busy) { changes -> run { app.antenna.setMesh(changes) } }

            if (antenna.labRadio) {
                val lab = antenna.lab
                SectionLabel("Lab")
                OgCard {
                    InfoRow("Eigene NodeID", antenna.nodeId ?: lab?.nodeId ?: "–")
                    Column(Modifier.padding(start = 16.dp, top = 12.dp, end = 16.dp, bottom = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Text-Codec", style = OgType.row.copy(fontSize = 15.sp))
                    }
                    Box(Modifier.alpha(if (ready && !busy) 1f else 0.4f)) {
                        OgSegmented(
                            listOf(MessageLimits.CODEC_RAW to "Roh (UTF-8)", MessageLimits.CODEC_OGZ1 to "OGZ1"),
                            selected = lab?.textCodec ?: antenna.textCodec,
                            label = "Text-Codec",
                        ) { codec ->
                            if (ready && !busy && codec != (lab?.textCodec ?: antenna.textCodec)) {
                                run { app.antenna.setLab(buildJsonObject { put("text_codec", codec) }) }
                            }
                        }
                    }
                    Text(
                        "OGZ1 komprimiert nur Texte über 83 Bytes (bis ${lab?.maxTextInputBytes ?: 160} Bytes Eingabe). " +
                            "Solche Nachrichten kann ein Board mit der Team-Firmware nicht lesen; es bestätigt sie nicht, " +
                            "und die Nachricht scheitert nach den Wiederholungen. Längere Texte teilt die App sonst selbst auf.",
                        style = OgType.help.copy(fontSize = 13.sp),
                        modifier = Modifier.padding(start = 16.dp, top = 10.dp, end = 16.dp, bottom = 14.dp),
                    )
                }

                SectionLabel("Ignorierliste")
                OgCard {
                    val ignored = lab?.ignoreNodes
                    if (ignored == null) {
                        InfoRow("Ignorierliste", "nicht unterstützt", last = true)
                    } else {
                        Text(
                            "Direkt gehörte Pakete dieser NodeIDs verwirft die Antenne, als wären sie ausser Reichweite. " +
                                "Über ein anderes Gerät weitergeleitete Kopien kommen an. So lassen sich Wege A → B → C im selben Raum testen.",
                            style = OgType.help.copy(fontSize = 13.sp),
                            modifier = Modifier.padding(start = 16.dp, top = 14.dp, end = 16.dp, bottom = 6.dp),
                        )
                        ignored.forEach { id ->
                            Row(
                                Modifier.fillMaxWidth().heightIn(min = Og.rowMin).padding(horizontal = 16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(id, style = OgType.value.copy(fontFamily = Mono, fontSize = 15.sp), modifier = Modifier.weight(1f))
                                SmallButton("Entfernen", enabled = ready && !busy, description = "$id von der Ignorierliste entfernen") {
                                    run { app.antenna.setLab(ignoreArgs(ignored - id)) }
                                }
                            }
                            CardDivider()
                        }
                        if (ignored.isEmpty()) {
                            InfoRow("Keine NodeID ignoriert", null)
                        }
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            OgTextField(
                                "NodeID hinzufügen", nodeInput, { nodeInput = it.take(6); nodeError = null },
                                placeholder = "z. B. 3F2A",
                                hint = "4 Hex-Ziffern, höchstens ${LabConfig.MAX_IGNORE_NODES}. Jedes Board zeigt seine NodeID hier unter «Eigene NodeID».",
                                error = nodeError,
                                capitalization = KeyboardCapitalization.Characters,
                                imeAction = ImeAction.Done,
                            )
                            OgButton("Hinzufügen", {
                                when (val edit = LabConfig.withIgnored(ignored, nodeInput, antenna.nodeId ?: lab.nodeId)) {
                                    is IgnoreEdit.Changed -> run {
                                        app.antenna.setLab(ignoreArgs(edit.nodes))
                                        nodeInput = ""
                                    }
                                    is IgnoreEdit.Refused -> nodeError = when (edit.reason) {
                                        IgnoreEdit.Reason.INVALID -> "Eine NodeID hat genau 4 Hex-Ziffern (0–9, A–F)."
                                        IgnoreEdit.Reason.OWN -> "Das ist die NodeID dieser Antenne."
                                        IgnoreEdit.Reason.DUPLICATE -> "Diese NodeID ist schon auf der Liste."
                                        IgnoreEdit.Reason.FULL -> "Die Liste ist voll (${LabConfig.MAX_IGNORE_NODES} NodeIDs)."
                                    }
                                }
                            }, variant = ButtonVariant.Secondary, enabled = ready && !busy && nodeInput.isNotBlank())
                        }
                    }
                }
            }

            SectionLabel("Funkstatistik")
            OgCard {
                val rows = stats?.let(RadioStats::rows).orEmpty()
                if (rows.isEmpty()) {
                    InfoRow("Statistik", if (ready) "–" else "nicht verbunden")
                } else {
                    rows.forEach { (label, value) -> InfoRow(label, value) }
                }
                Row(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OgButton("Aktualisieren", { run { app.antenna.refreshInfo(); stats = app.antenna.radioStats() } }, Modifier.weight(1f),
                        variant = ButtonVariant.Secondary, enabled = ready && !busy, height = 46.dp, radius = 14.dp)
                    OgButton("Zurücksetzen", { run { stats = app.antenna.radioStats(reset = true) } }, Modifier.weight(1f),
                        variant = ButtonVariant.Secondary, enabled = ready && !busy, height = 46.dp, radius = 14.dp)
                }
            }
        }
    }
}

private fun ignoreArgs(nodes: List<String>) = buildJsonObject {
    putJsonArray("ignore_nodes") { nodes.forEach { add(JsonPrimitive(it)) } }
}

@Composable
private fun FirmwareSection(a: AntennaState) {
    SectionLabel("Firmware")
    OgCard {
        InfoRow("Geräte-ID", a.deviceId ?: "–")
        InfoRow("NodeID", a.nodeId ?: "–")
        a.deviceName?.let { InfoRow("Name auf der Antenne", it) }
        InfoRow("Version", a.fwVersion ?: "–")
        a.fwBuild?.let { InfoRow("Build", it) }
        InfoRow(
            "Art",
            when {
                a.deviceId == null -> "–"
                a.labRadio -> "Lab-Image"
                a.radioDiagnostics -> "Team-Firmware, Diagnoseprofil"
                else -> "Team-Firmware"
            },
        )
        a.vaultStatus?.let { InfoRow("Tresor", it) }
        a.secureBoot?.let { InfoRow("Secure Boot", if (it) "an" else "aus") }
        a.flashEncryption?.let { InfoRow("Flash-Verschlüsselung", if (it) "an" else "aus") }
        a.lockTimeoutS?.let { InfoRow("Sperrt ohne Befehl nach", if (it == 0) "nie" else "$it s") }
        a.lastLock?.let { InfoRow("Zuletzt gesperrt", "${Formats.time(it.at)} · ${lockReasonShort(it.reason)}") }
        a.lastDeviceError?.let { InfoRow("Letzter Gerätefehler", it) }
        InfoRow("Verlorene Ereignisse", a.droppedEvents?.toString() ?: "–", last = true)
    }
}

@Composable
private fun RadioSection(a: AntennaState) {
    val r = a.radio
    SectionLabel("Funk")
    OgCard {
        InfoRow(
            "Funkmodul",
            when (a.radioRunning) {
                true -> "läuft"
                false -> "aus" + (a.radioError?.let { " (Fehler $it)" } ?: "")
                null -> "–"
            },
        )
        InfoRow("Frequenz", r?.freqMhz?.let { "${Formats.exactMhz(it)} MHz" } ?: "–")
        r?.bwKhz?.let { InfoRow("Bandbreite", "${Formats.exactMhz(it)} kHz") }
        r?.sf?.let { InfoRow("Spreading Factor", "SF$it") }
        r?.cr?.let { InfoRow("Coding Rate", "4/$it") }
        r?.txPowerDbm?.let { InfoRow("Sendeleistung", "$it dBm") }
        r?.preamble?.let { InfoRow("Präambel", "$it Symbole") }
        r?.syncWord?.let { InfoRow("Sync-Word", "0x" + it.toString(16).uppercase().padStart(2, '0')) }
        InfoRow("Sendezeit 23 Bytes", r?.airtime23Ms?.let { "≈ $it ms" } ?: "–", last = true)
    }
}

@Composable
private fun MeshSection(mesh: MeshConfig?, enabled: Boolean, onChange: (JsonObject) -> Unit) {
    SectionLabel("Mesh")
    OgCard {
        if (mesh == null) {
            InfoRow("Mesh-Einstellungen", "nicht gelesen", last = true)
            return@OgCard
        }
        mesh.hopDefault?.let { hops ->
            Row(
                Modifier.fillMaxWidth().heightIn(min = 68.dp).padding(horizontal = 16.dp, vertical = 10.dp).alpha(if (enabled) 1f else 0.4f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("Hop-Limit", style = OgType.body)
                    Text("Wie oft andere Geräte eine eigene Nachricht höchstens weiterleiten (0 = nur direkt).", style = OgType.help.copy(fontSize = 13.sp))
                }
                SmallButton("−", enabled = enabled && hops > 0, description = "Hop-Limit verringern") {
                    onChange(buildJsonObject { put("hop_default", hops - 1) })
                }
                Text(hops.toString(), style = OgType.value.copy(fontSize = 16.sp), modifier = Modifier.semantics { contentDescription = "Hop-Limit $hops" })
                SmallButton("+", enabled = enabled && hops < MeshConfig.MAX_HOPS, description = "Hop-Limit erhöhen") {
                    onChange(buildJsonObject { put("hop_default", hops + 1) })
                }
            }
            CardDivider()
        }
        mesh.relayEnabled?.let { relay ->
            SwitchRow("Weiterleiten", "Nachrichten anderer Geräte weitersenden.", relay, enabled) { on ->
                onChange(buildJsonObject { put("relay_enabled", on) })
            }
            CardDivider()
            mesh.relayWhenLocked?.let { locked ->
                SwitchRow("Auch gesperrt weiterleiten", "Die Antenne leitet weiter, auch wenn kein Handy sie entsperrt hat.",
                    locked, enabled && relay) { on -> onChange(buildJsonObject { put("relay_when_locked", on) }) }
                CardDivider()
            }
        }
        mesh.retries?.let { InfoRow("Wiederholungen pro Nachricht", it.toString()) }
        InfoRow("Kanalprüfung vor dem Senden (CAD)", mesh.cadEnabled?.let { if (it) "an" else "aus" } ?: "–", last = true)
    }
}

@Composable
private fun SmallButton(text: String, enabled: Boolean, description: String, onClick: () -> Unit) {
    Box(
        Modifier.heightIn(min = 40.dp).clip(RoundedCornerShape(12.dp)).background(Og.surface2)
            .border(1.dp, Og.border, RoundedCornerShape(12.dp)).alpha(if (enabled) 1f else 0.4f)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description }
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = TextStyle(fontFamily = Grotesk, fontSize = 15.sp, fontWeight = FontWeight(600), color = Og.text),
            modifier = Modifier.padding(vertical = 8.dp))
    }
}
