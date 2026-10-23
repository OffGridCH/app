package ch.offgrid.android.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import ch.offgrid.android.BuildConfig
import ch.offgrid.android.domain.Formats
import ch.offgrid.android.domain.KeyPattern
import ch.offgrid.android.domain.MessageLimits
import ch.offgrid.android.domain.Settings
import ch.offgrid.android.link.LinkKind
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.Routes
import ch.offgrid.android.ui.back
import ch.offgrid.android.ui.components.ButtonVariant
import ch.offgrid.android.ui.components.CardDivider
import ch.offgrid.android.ui.components.InfoRow
import ch.offgrid.android.ui.components.OgAvatar
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgCard
import ch.offgrid.android.ui.components.OgIcon
import ch.offgrid.android.ui.components.OgIconView
import ch.offgrid.android.ui.components.OgSwitch
import ch.offgrid.android.ui.components.OgTextField
import ch.offgrid.android.ui.components.OgTopBar
import ch.offgrid.android.ui.components.SectionLabel
import ch.offgrid.android.ui.components.SignalBars
import ch.offgrid.android.ui.components.StatusDot
import ch.offgrid.android.ui.theme.Grotesk
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Screen 7 "Einstellungen". */
@Composable
fun SettingsScreen(nav: NavHostController) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val antenna by app.antenna.state.collectAsStateWithLifecycle()
    val settings by app.settings.values.collectAsStateWithLifecycle()
    val contacts by app.messaging.contacts.collectAsStateWithLifecycle(initialValue = emptyList())
    val messageCount by app.messaging.messageCount.collectAsStateWithLifecycle(initialValue = 0)
    val installId by produceState<String?>(null) { value = app.settings.installId() }
    var name by rememberSaveable { mutableStateOf<String?>(null) }
    var nameError by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    LaunchedEffect(settings[Settings.DISPLAY_NAME]) { if (name == null) name = settings[Settings.DISPLAY_NAME] }
    val pattern = remember(settings[Settings.OWN_PUBLIC_KEY], installId) {
        KeyPattern.fromSeed(settings[Settings.OWN_PUBLIC_KEY] ?: installId ?: "")
    }
    val now = rememberNow()
    val bestLevel = contacts.filter { it.state == "active" }.maxOfOrNull { Formats.signalLevel(it.lastRssi, it.lastSeenAt, now) } ?: 0

    Page {
        OgTopBar("Einstellungen", onBack = { nav.back() }, backLabel = "Zurück zu den Kontakten")
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
            Column(
                Modifier.fillMaxWidth().padding(start = 16.dp, top = 20.dp, end = 16.dp, bottom = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OgAvatar(pattern, 72.dp)
                Text("DEIN MUSTER", style = OgType.meta.copy(letterSpacing = 0.08.em))
            }

            SectionLabel("Profil")
            OgCard(padded = true, gap = 8.dp) {
                OgTextField(
                    "Anzeigename", name.orEmpty(), {
                        name = MessageLimits.clampToBytes(it, MessageLimits.MAX_NAME_BYTES)
                        nameError = false
                    },
                    hint = "Wird beim Hinzufügen an neue Kontakte übertragen.",
                    error = if (nameError) NAME_ERROR else null,
                    onBlur = {
                        val value = name.orEmpty().trim()
                        if (!MessageLimits.isValidName(value)) {
                            nameError = true
                        } else if (value != settings[Settings.DISPLAY_NAME]) {
                            scope.launch {
                                app.settings.put(Settings.DISPLAY_NAME, value)
                                runCatching { app.antenna.call("id.set_name", buildJsonObject { put("name", value) }) }
                            }
                        }
                    },
                )
            }

            SectionLabel("Antenne")
            OgCard {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 60.dp).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    StatusDot(antenna.ready)
                    Text(if (antenna.ready) "Verbunden" else "Getrennt", style = OgType.body, modifier = Modifier.weight(1f))
                    val level = if (antenna.ready) bestLevel else 0
                    SignalBars(level, label = Formats.signalLabel(level))
                }
                CardDivider()
                InfoRow("Anschluss", if (antenna.kind == LinkKind.SIMULATED) "Simuliert" else "USB-C · Serial")
                InfoRow("Frequenz", antenna.freqMhz?.let { "${Formats.band(it)} MHz" } ?: "–")
                InfoRow("Firmware", antenna.fwVersion ?: "–")
                Row(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OgButton("Neu verbinden", { nav.navigate(Routes.CONNECT) }, Modifier.weight(1f),
                        variant = ButtonVariant.Secondary, containerColor = Og.line)
                    OgButton("Trennen", { app.antenna.disconnect() }, Modifier.weight(1f),
                        variant = ButtonVariant.Secondary, enabled = antenna.ready)
                }
            }

            SectionLabel("Empfang")
            OgCard {
                SwitchRow(
                    "Im Hintergrund empfangen",
                    "Nachrichten kommen an, auch wenn die App geschlossen ist.",
                    settings[Settings.BG_RECEIVE] != "false",
                ) { on -> scope.launch { app.settings.put(Settings.BG_RECEIVE, on.toString()) } }
                CardDivider()
                SwitchRow("Vibration bei Nachricht", null, settings[Settings.VIBRATE] == "true") { on ->
                    scope.launch { app.settings.put(Settings.VIBRATE, on.toString()) }
                }
            }

            SectionLabel("Handywechsel")
            OgCard {
                LinkRow(OgIcon.Upload, "Daten exportieren", "Kontakte, Schlüssel und Nachrichten als Datei, mit Passwort geschützt.") {
                    nav.navigate(Routes.EXPORT)
                }
                CardDivider()
                LinkRow(OgIcon.Download, "Daten importieren", "Export-Datei vom alten Handy einlesen.") { nav.navigate(Routes.IMPORT) }
            }

            SectionLabel("Daten")
            OgCard {
                InfoRow("Kontakte", contacts.size.toString())
                InfoRow("Nachrichten", messageCount.toString())
                OgButton("Alle Daten löschen", { confirmDelete = true }, variant = ButtonVariant.DangerText)
            }
            Text(
                "OffGrid ${BuildConfig.VERSION_NAME}",
                style = OgType.meta,
                modifier = Modifier.fillMaxWidth().padding(top = 28.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            containerColor = Og.surface,
            shape = RoundedCornerShape(Og.rCard),
            text = {
                Text(
                    "Alle Kontakte und Nachrichten auf diesem Handy löschen? Das lässt sich nicht rückgängig machen.",
                    style = OgType.body,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    scope.launch {
                        app.messaging.deleteAll()
                        app.resetAnalyticsId()
                        nav.navigate(Routes.CONTACTS) { popUpTo(Routes.CONTACTS) { inclusive = true } }
                    }
                }) { Text("Löschen", style = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight(700), color = Og.danger)) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) {
                    Text("Abbrechen", style = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight(600), color = Og.text))
                }
            },
        )
    }
}

@Composable
private fun SwitchRow(title: String, help: String?, checked: Boolean, onChange: (Boolean) -> Unit) {
    // The whole row toggles, so TalkBack reads title, help and state as one switch.
    Row(
        Modifier.fillMaxWidth().heightIn(min = if (help != null) 68.dp else 60.dp)
            .toggleable(checked, role = Role.Switch, onValueChange = onChange)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = OgType.body)
            if (help != null) Text(help, style = OgType.help.copy(fontSize = 13.sp))
        }
        OgSwitch(checked, onCheckedChange = null)
    }
}

@Composable
private fun LinkRow(icon: OgIcon, title: String, text: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 72.dp).clickable(role = Role.Button, onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        OgIconView(icon, Og.accent, size = 22.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = OgType.bodyStrong.copy(fontSize = 16.sp))
            Text(text, style = OgType.help.copy(fontSize = 13.sp))
        }
    }
}
