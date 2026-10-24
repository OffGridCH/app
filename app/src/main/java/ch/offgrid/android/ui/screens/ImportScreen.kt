package ch.offgrid.android.ui.screens

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import ch.offgrid.android.domain.BackupError
import ch.offgrid.android.domain.BackupException
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.Routes
import ch.offgrid.android.ui.back
import ch.offgrid.android.ui.components.Footer
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgCard
import ch.offgrid.android.ui.components.OgIcon
import ch.offgrid.android.ui.components.OgIconView
import ch.offgrid.android.ui.components.OgNote
import ch.offgrid.android.ui.components.OgTextField
import ch.offgrid.android.ui.components.OgTopBar
import ch.offgrid.android.ui.theme.Grotesk
import ch.offgrid.android.ui.theme.Mono
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Largest backup we read; a full history of text messages stays far below it. */
private const val MAX_BACKUP_BYTES = 20 * 1024 * 1024

/** Screen 9 "Daten importieren". */
@Composable
fun ImportScreen(nav: NavHostController) {
    val app = LocalApp.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    // The picked document stays readable until reboot, so the saved Uri survives process death.
    var uri by rememberSaveable { mutableStateOf<Uri?>(null) }
    var fileName by rememberSaveable { mutableStateOf<String?>(null) }
    var password by rememberSaveable { mutableStateOf("") }
    var error by rememberSaveable { mutableStateOf<BackupError?>(null) }
    var working by remember { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { picked ->
        if (picked != null) {
            uri = picked
            error = null
            fileName = context.contentResolver.query(picked, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            } ?: picked.lastPathSegment
        }
    }

    Page {
        OgTopBar("Daten importieren", onBack = { nav.back() }, backLabel = "Zurück zu den Einstellungen")
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            Text(
                "Wähle die Export-Datei von deinem alten Handy und gib das Passwort ein.",
                style = OgType.body2,
                modifier = Modifier.padding(start = 24.dp, top = 8.dp, end = 24.dp),
            )
            Row(
                Modifier.padding(start = 16.dp, top = 22.dp, end = 16.dp).fillMaxWidth().heightIn(min = 72.dp)
                    .clip(RoundedCornerShape(Og.rCard)).background(Og.surface).border(1.dp, Og.border, RoundedCornerShape(Og.rCard))
                    .clickable(role = Role.Button) { picker.launch(arrayOf("*/*")) }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(Og.accentSoft), contentAlignment = Alignment.Center) {
                    OgIconView(OgIcon.File, Og.accent, size = 20.dp)
                }
                if (fileName == null) {
                    Text("Datei wählen", style = TextStyle(fontFamily = Grotesk, fontSize = 16.sp, fontWeight = FontWeight(600), color = Og.text))
                } else {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(fileName!!, style = TextStyle(fontFamily = Mono, fontSize = 14.sp, color = Og.text), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("Andere Datei wählen", style = OgType.help)
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
            OgCard(padded = true) {
                OgTextField(
                    "Passwort der Export-Datei", password, { password = it; error = null }, password = true,
                    error = error?.text(), imeAction = ImeAction.Done,
                )
            }
            OgNote("Der Import ersetzt alle Kontakte und Nachrichten auf diesem Handy.")
        }
        Footer(top = 0.dp) {
            OgButton(
                if (working) "Wird importiert …" else "Importieren",
                enabled = uri != null && password.isNotEmpty() && !working,
                onClick = {
                    val source = uri ?: return@OgButton
                    working = true
                    error = null
                    scope.launch {
                        try {
                            val text = withContext(Dispatchers.IO) {
                                context.contentResolver.openInputStream(source)?.use { input ->
                                    backupText(input.readNBytesCompat(MAX_BACKUP_BYTES + 1), MAX_BACKUP_BYTES)
                                }
                            } ?: throw BackupException(BackupError.INVALID_FILE)
                            // Replacing all data must not stop halfway when a rotation cancels this scope.
                            withContext(NonCancellable) { app.backup.import(text, password) }
                            nav.navigate(Routes.CONTACTS) { popUpTo(0) }
                        } catch (e: Exception) {
                            error = importError(e) ?: throw e
                        } finally {
                            working = false
                        }
                    }
                },
            )
        }
    }
}

/** InputStream.readNBytes is API 33+, so read up to [limit] bytes by hand. */
private fun java.io.InputStream.readNBytesCompat(limit: Int): ByteArray {
    val out = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    while (out.size() < limit) {
        val n = read(buffer, 0, minOf(buffer.size, limit - out.size()))
        if (n < 0) break
        out.write(buffer, 0, n)
    }
    return out.toByteArray()
}
