package ch.offgrid.android.domain

import ch.offgrid.android.data.ContactEntity
import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.data.MessageStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class BackupCodecTest {
    private val data = BackupData(
        createdAt = 1_000,
        displayName = "HolyG",
        contacts = listOf(
            ContactEntity(id = 1, deviceId = "7CDFA100ABCD", deviceContactId = 1, displayName = "Anna Meier", nodeId = "E841",
                publicKey = "wLEmtaoTS4TmRiUla43olzeHYSsfODnSxgUm0hFOiG0=", fingerprint = "0501 3010 7790", state = "active", createdAt = 1),
        ),
        messages = listOf(
            MessageEntity(id = 1, contactId = 1, direction = "in", kind = "text", text = "Grüezi", status = MessageStatus.DELIVERED, sentAt = 2),
        ),
        unlock = UnlockTransfer("7CDFA100ABCD", "QUJD"),
    )

    // Few iterations keep the test fast; the format is the same as with 210 000.
    private fun encrypt(password: String) = BackupCodec.encrypt(data, password, iterations = 1_000)

    @Test
    fun roundTrips() {
        assertEquals(data, BackupCodec.decrypt(encrypt("geheim123"), "geheim123"))
    }

    @Test
    fun fileIsEncryptedAndSelfDescribing() {
        val file = encrypt("geheim123")
        assertFalse(file.contains("Grüezi"))
        assertFalse(file.contains("Anna"))
        assert(file.contains("\"format\":\"offgrid-backup\"") && file.contains("\"kdf\":\"pbkdf2-sha256\""))
    }

    @Test
    fun wrongPasswordAndForeignFilesAreReported() {
        val wrong = runCatching { BackupCodec.decrypt(encrypt("geheim123"), "falsch123") }.exceptionOrNull() as BackupException
        assertEquals(BackupError.WRONG_PASSWORD, wrong.error)
        val foreign = runCatching { BackupCodec.decrypt("{\"hello\":1}", "geheim123") }.exceptionOrNull() as BackupException
        assertEquals(BackupError.INVALID_FILE, foreign.error)
    }
}
