package ch.offgrid.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.domain.MessageDetails
import ch.offgrid.android.domain.REACTIONS
import ch.offgrid.android.ui.components.ButtonVariant
import ch.offgrid.android.ui.components.InfoRow
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgSheet
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType

/**
 * Sheet after a long press on a bubble: the reactions for a peer's message (when [onReact] is set) and the
 * transport details from [MessageDetails]. [message] is the live row, so a delivery that arrives while the
 * sheet is open shows at once.
 */
@Composable
fun BoxScope.MessageSheet(
    message: MessageEntity?,
    recipient: String?,
    onClose: () -> Unit,
    onReact: ((MessageEntity, String?) -> Unit)? = null,
) {
    // Keep the last message while the sheet slides out.
    var last by remember { mutableStateOf<MessageEntity?>(null) }
    message?.let { last = it }
    val m = last
    val reactions = onReact != null && m != null && m.direction == "in" && m.ctr != null
    OgSheet(message != null, if (reactions) "Nachricht" else "Details", onClose = onClose) {
        if (m == null) return@OgSheet
        if (reactions) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                REACTIONS.forEach { emoji ->
                    val chosen = m.peerReaction == emoji
                    Box(
                        Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(if (chosen) Og.accentSoft else Og.surface2)
                            .clickable(role = Role.Button, onClickLabel = if (chosen) "Reaktion entfernen" else "Reagieren") {
                                onReact?.invoke(m, if (chosen) null else emoji)
                                onClose()
                            },
                        contentAlignment = Alignment.Center,
                    ) { Text(emoji, fontSize = 22.sp) }
                }
            }
        }
        val rows = MessageDetails.rows(m, recipient)
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(Og.rCard)).border(1.dp, Og.border, RoundedCornerShape(Og.rCard))) {
            rows.forEachIndexed { i, (label, value) -> InfoRow(label, value, last = i == rows.lastIndex) }
        }
        if (!MessageDetails.hasRadioDetails(m) && m.direction == "out") {
            Text("Hops, Wiederholungen und Laufzeit meldet die Antenne mit der Zustellung. Ältere Firmware meldet sie nicht.", style = OgType.meta)
        }
        OgButton("Schliessen", onClose, variant = ButtonVariant.Secondary)
    }
}
