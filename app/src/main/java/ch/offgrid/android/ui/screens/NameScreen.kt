package ch.offgrid.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ch.offgrid.android.domain.MessageLimits
import ch.offgrid.android.domain.Settings
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.components.Footer
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgCard
import ch.offgrid.android.ui.components.OgTextField
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import androidx.compose.runtime.remember
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

const val NAME_ERROR = "Der Name muss 1 bis 24 Byte lang sein (Umlaute zählen doppelt)."

/** Screen 2 "Wie heisst du?" (onboarding step 2, built from the connect and name-contact parts). */
@Composable
fun NameScreen(onDone: () -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var name by rememberSaveable { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    val valid = MessageLimits.isValidName(name)
    fun submit() {
        if (!valid || saving) return
        saving = true
        scope.launch {
            val trimmed = name.trim()
            app.settings.put(Settings.DISPLAY_NAME, trimmed)
            app.settings.put(Settings.ONBOARDED, "true")
            // The name travels in our QR code, so the device needs it too (id.set_name).
            runCatching { app.antenna.call("id.set_name", buildJsonObject { put("name", trimmed) }) }
            onDone()
        }
    }
    Page {
        Column(Modifier.weight(1f).padding(top = 56.dp)) {
            Column(Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("SCHRITT 2 VON 2", style = OgType.section.copy(color = Og.accent))
                Text("Wie heisst du?", style = OgType.display, modifier = Modifier.semantics { heading() })
                Text("Dieser Name wird beim Hinzufügen an deine Kontakte übertragen.", style = OgType.body2.copy(fontSize = 16.sp))
            }
            Spacer(Modifier.height(24.dp))
            OgCard(padded = true) {
                OgTextField(
                    "Anzeigename", name, { name = MessageLimits.clampToBytes(it, MessageLimits.MAX_NAME_BYTES) },
                    error = if (name.isNotEmpty() && !valid) NAME_ERROR else null,
                    capitalization = KeyboardCapitalization.Words,
                    imeAction = ImeAction.Done,
                    onImeAction = ::submit,
                )
            }
        }
        Footer {
            OgButton("Los gehts", onClick = ::submit, enabled = valid && !saving)
        }
    }
}
