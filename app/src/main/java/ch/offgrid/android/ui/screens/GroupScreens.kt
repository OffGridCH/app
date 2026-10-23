package ch.offgrid.android.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import ch.offgrid.android.data.GroupEntity
import ch.offgrid.android.domain.KeyPattern
import ch.offgrid.android.domain.MessageLimits
import ch.offgrid.android.link.LinkClosedException
import ch.offgrid.android.link.LinkCommandException
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.Routes
import ch.offgrid.android.ui.back
import ch.offgrid.android.ui.components.AvatarVariant
import ch.offgrid.android.ui.components.CheckRow
import ch.offgrid.android.ui.components.Footer
import ch.offgrid.android.ui.components.MessageBubble
import ch.offgrid.android.ui.components.OgAvatar
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgCard
import ch.offgrid.android.ui.components.OgNote
import ch.offgrid.android.ui.components.OgTextField
import ch.offgrid.android.ui.components.OgTopBar
import ch.offgrid.android.ui.components.SectionLabel
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.launch

const val GROUP_NAME_ERROR = "Der Gruppenname muss 1 bis 24 Byte lang sein (Umlaute zählen doppelt)."

fun groupPattern(group: GroupEntity): BooleanArray = KeyPattern.fromSeed("group:${group.deviceId}:${group.deviceGroupId}")

/** Ticks or unticks [id] in the member picker; a new member is only added while fewer than [max] are chosen. */
fun toggleMember(selected: List<Long>, id: Long, max: Int): List<Long> = when {
    id in selected -> selected - id
    selected.size < max -> selected + id
    else -> selected
}

/** Group screen "Neue Gruppe" (optional T20; on the link a proposed `group.create`, see README). */
@Composable
fun NewGroupScreen(nav: NavHostController) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val contacts by app.messaging.contacts.collectAsStateWithLifecycle(initialValue = emptyList())
    val active = contacts.filter { it.state == "active" }
    var name by rememberSaveable { mutableStateOf("") }
    // A LongArray is bundle-safe, so the ticks survive rotation and process death.
    var selectedIds by rememberSaveable { mutableStateOf(LongArray(0)) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    val nameValid = MessageLimits.isValidName(name)
    // Only contacts that are still active count, in case one was deleted while the picker was open.
    val selected = selectedIds.filter { id -> active.any { it.id == id } }

    Page {
        OgTopBar("Neue Gruppe", onBack = { nav.back() }, backLabel = "Zurück zu den Kontakten")
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            OgCard(padded = true, modifier = Modifier.padding(top = 8.dp)) {
                OgTextField("Gruppenname", name, { name = MessageLimits.clampToBytes(it, MessageLimits.MAX_NAME_BYTES) },
                    error = if (name.isNotEmpty() && !nameValid) GROUP_NAME_ERROR else null)
            }
            SectionLabel("Mitglieder · ${selected.size} von ${MessageLimits.MAX_GROUP_MEMBERS}", list = false, weight = 500)
            OgCard {
                active.forEachIndexed { i, c ->
                    val checked = c.id in selected
                    CheckRow(
                        name = c.displayName,
                        pattern = patternFor(c.fingerprint),
                        checked = checked,
                        enabled = checked || selected.size < MessageLimits.MAX_GROUP_MEMBERS,
                        last = i == active.lastIndex,
                    ) { selectedIds = toggleMember(selected, c.id, MessageLimits.MAX_GROUP_MEMBERS).toLongArray() }
                }
            }
            Text(
                "Nur Kontakte mit abgeschlossenem Handshake. Jedes Mitglied bekommt den Gruppenschlüssel per Funk.",
                style = OgType.help.copy(lineHeight = 1.45.em),
                modifier = Modifier.padding(start = 28.dp, top = 14.dp, end = 28.dp),
            )
            error?.let { OgNote(it) }
        }
        Footer(top = 0.dp) {
            OgButton("Gruppe erstellen", enabled = nameValid && selected.isNotEmpty() && !working, onClick = {
                working = true
                error = null
                scope.launch {
                    app.messaging.createGroup(name, selected)
                        .onSuccess { id -> nav.navigate(Routes.group(id)) { popUpTo(Routes.CONTACTS) } }
                        .onFailure { e ->
                            error = when {
                                e is LinkClosedException -> "Antenne nicht verbunden. Gruppen werden auf der Antenne angelegt."
                                e is LinkCommandException && e.error.code == "E_UNKNOWN_CMD" ->
                                    "Diese Antennen-Firmware kennt noch keine Gruppen."
                                else -> "Die Gruppe konnte nicht erstellt werden."
                            }
                        }
                    working = false
                }
            })
        }
    }
}

/** Group chat: sender names over incoming bubbles, no location button, no delivery receipts. */
@Composable
fun GroupChatScreen(nav: NavHostController, groupId: Long) {
    val app = LocalApp.current
    val group by remember(groupId) { app.messaging.group(groupId).asLookup() }.collectAsStateWithLifecycle(Lookup.Loading)
    val messages by app.messaging.groupMessages(groupId).collectAsStateWithLifecycle(initialValue = emptyList())
    val members by app.messaging.members.collectAsStateWithLifecycle(initialValue = emptyList())
    val antenna by app.antenna.state.collectAsStateWithLifecycle()
    val now = rememberNow()
    var draft by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(messages.size) { app.messaging.markGroupRead(groupId) }
    // A deleted group, or a stale id after process death, leads back instead of an empty screen.
    LeaveWhenGone(group == Lookup.Gone, nav)
    val g = group.found ?: run {
        Page {}
        return
    }
    val count = members.count { it.groupId == groupId } + 1

    Page {
        ChatHeader(
            title = g.name,
            meta = "Gruppe · $count Mitglieder",
            onBack = { nav.back() },
            avatar = { OgAvatar(groupPattern(g), 40.dp, AvatarVariant.Square) },
        )
        if (!antenna.ready) DisconnectedBanner { nav.navigate(Routes.CONNECT) }
        MessageList(messages, now, Modifier.weight(1f), empty = "Noch keine Nachrichten. Schreib die erste.") { row ->
            val m = row.message
            MessageBubble(
                out = m.direction == "out",
                status = m.status,
                text = m.text,
                meta = metaFor(m, antenna.ready),
                groupStart = row.groupStart,
                continued = row.continued,
                senderName = if (row.showSender) m.senderName else null,
                onRetry = { app.messaging.retry(m.id) },
            )
        }
        ChatComposer(
            draft = draft,
            onDraft = { draft = it },
            target = g.name,
            ready = antenna.ready,
            maxBytes = antenna.maxTextBytes,
            onSend = {
                app.messaging.sendGroupText(g.id, draft)
                draft = ""
            },
            onLocation = null,
        )
    }
}
