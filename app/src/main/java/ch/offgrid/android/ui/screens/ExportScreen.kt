package ch.offgrid.android.ui.screens

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import ch.offgrid.android.domain.BackupCodec
import ch.offgrid.android.domain.BackupError
import ch.offgrid.android.domain.BackupService
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.back
import ch.offgrid.android.ui.components.Footer
import ch.offgrid.android.ui.components.InfoRow
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgCard
import ch.offgrid.android.ui.components.OgIcon
import ch.offgrid.android.ui.components.OgIconView
import ch.offgrid.android.ui.components.OgNote
import ch.offgrid.android.ui.components.OgTextField
import ch.offgrid.android.ui.components.OgTopBar
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException

const val PASSWORD_TOO_SHORT = "Mindestens 8 Zeichen."
const val PASSWORD_MISMATCH = "Die Passwörter stimmen nicht überein."

fun BackupError.text(): String = when (this) {
    BackupError.WRONG_PASSWORD -> "Falsches Passwort oder beschädigte Datei."
    BackupError.INVALID_FILE -> "Das ist keine OffGrid-Export-Datei."
    BackupError.WRITE_FAILED -> "Die Datei konnte nicht gespeichert werden."
}

/** Screen 8 "Daten exportieren": encrypted backup file, shared through the Android share sheet. */
@Composable
fun ExportScreen(nav: NavHostController) {
    val app = LocalApp.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val contacts by app.messaging.contacts.collectAsStateWithLifecycle(initialValue = emptyList())
    val messageCount by app.messaging.messageCount.collectAsStateWithLifecycle(initialValue = 0)
    var password by remember { mutableStateOf("") }
    var repeat by remember { mutableStateOf("") }
    var touched by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<BackupError?>(null) }
    val tooShort = password.length < BackupCodec.MIN_PASSWORD
    val mismatch = password != repeat

    Page {
        OgTopBar("Daten exportieren", onBack = { nav.back() }, backLabel = "Zurück zu den Einstellungen")
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            Text(
                "Für den Wechsel auf ein neues Handy. Die Datei enthält deine Schlüssel, darum wird sie mit einem Passwort verschlüsselt.",
                style = OgType.body2,
                modifier = Modifier.padding(start = 24.dp, top = 8.dp, end = 24.dp),
            )
            Spacer(Modifier.height(22.dp))
            OgCard {
                InfoRow("Kontakte und Schlüssel", contacts.size.toString())
                InfoRow("Nachrichten", messageCount.toString(), last = true)
            }
            Spacer(Modifier.height(14.dp))
            OgCard(padded = true) {
                OgTextField("Passwort", password, { password = it }, password = true,
                    error = if (touched && tooShort) PASSWORD_TOO_SHORT else null, onBlur = { if (password.isNotEmpty()) touched = true })
                OgTextField("Passwort wiederholen", repeat, { repeat = it }, password = true,
                    error = if (touched && repeat.isNotEmpty() && mismatch) PASSWORD_MISMATCH else null, onBlur = { touched = true })
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OgIconView(OgIcon.Info, Og.text3, Modifier.padding(top = 1.dp))
                    Text("Ohne Passwort lässt sich die Datei nicht mehr öffnen. Es gibt keine Wiederherstellung.", style = OgType.help)
                }
            }
            error?.let { OgNote(it.text()) }
        }
        Footer {
            OgButton(
                if (working) "Wird erstellt …" else "Datei erstellen und teilen",
                icon = OgIcon.Upload,
                enabled = !working,
                onClick = {
                    touched = true
                    if (tooShort || mismatch) return@OgButton
                    working = true
                    error = null
                    scope.launch {
                        try {
                            val now = System.currentTimeMillis()
                            val text = app.backup.export(password, now)
                            val file = withContext(Dispatchers.IO) {
                                File(context.cacheDir, "exports").apply { mkdirs() }.resolve(BackupService.fileName(now)).apply { writeText(text) }
                            }
                            val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                            val send = Intent(Intent.ACTION_SEND)
                                .setType("application/octet-stream")
                                .putExtra(Intent.EXTRA_STREAM, uri)
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            context.startActivity(Intent.createChooser(send, "Export teilen"))
                            nav.back()
                        } catch (_: IOException) {
                            error = BackupError.WRITE_FAILED
                        } finally {
                            working = false
                        }
                    }
                },
            )
        }
    }
}
