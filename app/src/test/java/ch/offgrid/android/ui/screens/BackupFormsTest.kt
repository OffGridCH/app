package ch.offgrid.android.ui.screens

import ch.offgrid.android.domain.BackupCodec
import ch.offgrid.android.domain.BackupData
import ch.offgrid.android.domain.BackupError
import ch.offgrid.android.domain.BackupException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.IOException
import java.security.InvalidAlgorithmParameterException

class BackupFormsTest {
    @Test
    fun fieldsStayQuietUntilLeftOrSubmitted() {
        assertEquals(PasswordErrors(null, null), passwordErrors("abc", "", showPassword = false, showRepeat = false))
        assertEquals(PasswordErrors(PASSWORD_TOO_SHORT, null), passwordErrors("abc", "", showPassword = true, showRepeat = false))
    }

    @Test
    fun submitWithEmptyRepeatShowsTheMismatch() {
        val errors = passwordErrors("geheim123", "", showPassword = true, showRepeat = true)
        assertEquals(PasswordErrors(null, PASSWORD_MISMATCH), errors)
    }

    @Test
    fun matchingLongPasswordsHaveNoErrors() {
        assert(passwordErrors("geheim123", "geheim123", showPassword = true, showRepeat = true).none)
        assert(!passwordErrors("geheim12", "geheim13", showPassword = true, showRepeat = true).none)
    }

    @Test
    fun emptyBlankAndOversizedFilesAreNoBackups() {
        assertNull(backupText(ByteArray(0), 100))
        assertNull(backupText(" \n".toByteArray(), 100))
        assertNull(backupText(ByteArray(101) { 'a'.code.toByte() }, 100))
        assertEquals("{}", backupText("{}".toByteArray(), 100))
    }

    @Test
    fun importFailuresMapToSpecErrors() {
        assertEquals(BackupError.WRONG_PASSWORD, importError(BackupException(BackupError.WRONG_PASSWORD)))
        assertEquals(BackupError.WRONG_PASSWORD, importError(InvalidAlgorithmParameterException("IV is empty")))
        assertEquals(BackupError.INVALID_FILE, importError(IOException("gone")))
        assertEquals(BackupError.INVALID_FILE, importError(SecurityException("no grant")))
        assertNull(importError(IllegalStateException("bug")))
    }

    @Test
    fun damagedFilesNeverEscapeAsUnexpectedErrors() {
        val file = Json.parseToJsonElement(BackupCodec.encrypt(BackupData(createdAt = 1, displayName = null, contacts = emptyList(), messages = emptyList()), "geheim123", iterations = 1_000)).jsonObject
        for ((field, value) in listOf("iv" to "", "data" to "AAAA", "salt" to "%%%", "data" to "")) {
            val damaged = JsonObject(file + (field to JsonPrimitive(value))).toString()
            val e = runCatching { BackupCodec.decrypt(damaged, "geheim123") }.exceptionOrNull()
            assertNotNull("$field=$value", e?.let(::importError))
        }
    }
}
