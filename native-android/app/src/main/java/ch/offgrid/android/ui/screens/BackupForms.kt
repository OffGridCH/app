package ch.offgrid.android.ui.screens

import ch.offgrid.android.domain.BackupCodec
import ch.offgrid.android.domain.BackupError
import ch.offgrid.android.domain.BackupException
import java.io.IOException
import java.security.GeneralSecurityException

/** Errors under the two password fields on "Daten exportieren"; null where the field is fine or not judged yet. */
data class PasswordErrors(val password: String?, val repeat: String?) {
    val none: Boolean get() = password == null && repeat == null
}

/**
 * [showPassword] and [showRepeat] say whether a field may complain yet: after the user left it, or
 * after a tap on the export button. The mismatch is shown on submit even while the repeat field is
 * still empty, so the button never fails silently.
 */
fun passwordErrors(password: String, repeat: String, showPassword: Boolean, showRepeat: Boolean) = PasswordErrors(
    password = PASSWORD_TOO_SHORT.takeIf { showPassword && password.length < BackupCodec.MIN_PASSWORD },
    repeat = PASSWORD_MISMATCH.takeIf { showRepeat && password != repeat },
)

/** Text of a picked backup file, or null when it cannot be one: empty, blank or larger than [limit] bytes. */
fun backupText(bytes: ByteArray, limit: Int): String? =
    if (bytes.isEmpty() || bytes.size > limit) null else bytes.toString(Charsets.UTF_8).takeIf { it.isNotBlank() }

/**
 * Maps an import failure to the spec's error code, or null for failures that are not about the file
 * (cancellation, programming errors), which the caller rethrows. A file in the right format whose
 * crypto fields are damaged gets "Falsches Passwort oder beschädigte Datei."; unreadable or foreign
 * files get "Das ist keine OffGrid-Export-Datei.".
 */
fun importError(e: Throwable): BackupError? = when (e) {
    is BackupException -> e.error
    is GeneralSecurityException -> BackupError.WRONG_PASSWORD
    is IOException, is SecurityException -> BackupError.INVALID_FILE
    else -> null
}
