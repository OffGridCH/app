package ch.offgrid.android.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ch.offgrid.android.DemoData
import ch.offgrid.android.link.LinkKind
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.components.ButtonVariant
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgSheet
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Debug-only test menu (long press on "OffGrid"): demo data, unplugging the simulated antenna,
 * radio range, switching between simulated and USB link, and the firmware mock's `mock.receive`.
 */
@Composable
fun BoxScope.DemoMenu(visible: Boolean, onClose: () -> Unit) {
    val app = LocalApp.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val kind by app.linkKind.collectAsStateWithLifecycle()
    val antenna by app.antenna.state.collectAsStateWithLifecycle()
    var status by remember { mutableStateOf<String?>(null) }
    val demo = remember { DemoData(app) }
    fun run(label: String, block: suspend () -> Unit) {
        status = "$label …"
        scope.launch {
            status = runCatching { block() }.fold({ "$label: fertig" }, { "$label: ${it.message ?: it::class.simpleName}" })
        }
    }

    OgSheet(visible, "Testmenü", onClose = onClose) {
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "Antenne: ${if (kind == LinkKind.SIMULATED) "simuliert" else "USB"} · ${antenna.phase.name.lowercase()}",
                style = OgType.meta,
            )
            if (kind == LinkKind.SIMULATED) {
                OgButton("Demo-Kontakte anlegen", { run("Demo-Kontakte") { demo.seedContacts().getOrThrow() } }, variant = ButtonVariant.Secondary)
                OgButton("Demo-Gruppe anlegen", { run("Demo-Gruppe") { demo.seedGroup().getOrThrow() } }, variant = ButtonVariant.Secondary)
                OgButton("Peer-Code in Zwischenablage", {
                    val code = demo.newPeerCode(DemoData.nextPeerName())
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("OffGrid-Code", code))
                    status = "Code kopiert"
                }, variant = ButtonVariant.Secondary)
                // Two buttons instead of a toggle: the simulated antenna keeps the range in its flash
                // across restarts, so a toggle state kept here would start out wrong.
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OgButton("Alle ausser Reichweite", { run("Ausser Reichweite") { demo.setAllInRange(false) } },
                        Modifier.weight(1f), variant = ButtonVariant.Secondary)
                    OgButton("Alle in Reichweite", { run("In Reichweite") { demo.setAllInRange(true) } },
                        Modifier.weight(1f), variant = ButtonVariant.Secondary)
                }
                OgButton(if (app.simLink.pluggedIn) "Antenne ausstecken" else "Antenne einstecken", {
                    if (app.simLink.pluggedIn) {
                        app.simLink.unplug()
                    } else {
                        app.simLink.pluggedIn = true
                        app.antenna.connect()
                    }
                    onClose()
                }, variant = ButtonVariant.Secondary)
            } else {
                // The firmware mock has no radio yet; `mock.receive` injects a message from a contact slot.
                OgButton("Mock: Nachricht empfangen", {
                    run("mock.receive") {
                        val slot = app.db.contacts().all().firstOrNull { it.state == "active" }?.deviceContactId ?: error("kein aktiver Kontakt")
                        app.antenna.call("mock.receive", buildJsonObject {
                            put("from", slot); put("type", "text"); put("text", "Hallo vom Mock")
                        })
                    }
                }, variant = ButtonVariant.Secondary)
            }
            OgButton(if (kind == LinkKind.SIMULATED) "Auf USB-Antenne wechseln" else "Auf simulierte Antenne wechseln", {
                app.setLinkKind(if (kind == LinkKind.SIMULATED) LinkKind.USB else LinkKind.SIMULATED)
                app.antenna.connect()
                onClose()
            })
            status?.let { Text(it, style = OgType.help) }
        }
    }
}
