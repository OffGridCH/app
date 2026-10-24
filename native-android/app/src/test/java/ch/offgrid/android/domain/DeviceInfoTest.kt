package ch.offgrid.android.domain

import ch.offgrid.android.link.LinkCodec
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

class DeviceInfoTest {
    @Test
    fun theIgnoreListTakesFourHexDigitsButNotTheOwnNodeOrMoreThanEight() {
        assertEquals(IgnoreEdit.Changed(listOf("3F2A")), LabConfig.withIgnored(emptyList(), " 0x3f2a ", "A1B2"))
        assertEquals(IgnoreEdit.Refused(IgnoreEdit.Reason.INVALID), LabConfig.withIgnored(emptyList(), "3F2", "A1B2"))
        assertEquals(IgnoreEdit.Refused(IgnoreEdit.Reason.INVALID), LabConfig.withIgnored(emptyList(), "XYZW", "A1B2"))
        assertEquals(IgnoreEdit.Refused(IgnoreEdit.Reason.OWN), LabConfig.withIgnored(emptyList(), "a1b2", "A1B2"))
        assertEquals(IgnoreEdit.Refused(IgnoreEdit.Reason.DUPLICATE), LabConfig.withIgnored(listOf("3F2A"), "3f2a", null))
        val full = (1..8).map { "000$it" }
        assertEquals(IgnoreEdit.Refused(IgnoreEdit.Reason.FULL), LabConfig.withIgnored(full, "1234", null))
    }

    @Test
    fun labGetIsParsedWithTheIgnoreList() {
        val lab = LabConfig.parse(
            LinkCodec.json.parseToJsonElement(
                """{"text_codec":"ogz1","max_text_input_bytes":160,"node_id":"A1B2","fw":"0.3.0-lab.3","ignore_nodes":["3F2A"]}""",
            ) as JsonObject,
        )
        assertEquals(LabConfig("ogz1", 160, "A1B2", "0.3.0-lab.3", listOf("3F2A")), lab)
        // An image before the ignore list has no field: null, so the screen says "nicht unterstützt".
        assertEquals(null, LabConfig.parse(JsonObject(emptyMap())).ignoreNodes)
    }
}
