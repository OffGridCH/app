package ch.offgrid.android.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import ch.offgrid.android.data.ContactEntity
import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.data.MessageStatus
import ch.offgrid.android.domain.Conversation
import ch.offgrid.android.domain.Formats
import ch.offgrid.android.domain.Geo
import ch.offgrid.android.domain.GeoFix
import ch.offgrid.android.domain.MessageLimits
import ch.offgrid.android.domain.REACTIONS
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.Routes
import ch.offgrid.android.ui.back
import ch.offgrid.android.ui.components.ButtonVariant
import ch.offgrid.android.ui.components.Composer
import ch.offgrid.android.ui.components.DayDivider
import ch.offgrid.android.ui.components.LocationBubble
import ch.offgrid.android.ui.components.MessageBubble
import ch.offgrid.android.ui.components.OgAvatar
import ch.offgrid.android.ui.components.OgBanner
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgIcon
import ch.offgrid.android.ui.components.OgIconButton
import ch.offgrid.android.ui.components.OgIconView
import ch.offgrid.android.ui.components.OgNote
import ch.offgrid.android.ui.components.OgSheet
import ch.offgrid.android.ui.components.SignalBars
import ch.offgrid.android.ui.components.Spinner
import ch.offgrid.android.ui.theme.Grotesk
import ch.offgrid.android.ui.theme.Mono
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.launch

/** Screen 6 "Chat" with the disconnected banner, location bubbles and the "Standort senden" sheet. */
@Composable
fun ChatScreen(nav: NavHostController, contactId: Long) {
    val app = LocalApp.current
    val contact by remember(contactId) { app.messaging.contact(contactId).asLookup() }.collectAsStateWithLifecycle(Lookup.Loading)
    val messages by app.messaging.messages(contactId).collectAsStateWithLifecycle(initialValue = emptyList())
    val antenna by app.antenna.state.collectAsStateWithLifecycle()
    val myFix by app.location.fix.collectAsStateWithLifecycle()
    val now = rememberNow()
    var draft by rememberSaveable { mutableStateOf("") }
    var locationSheet by rememberSaveable { mutableStateOf(false) }
    var reactTo by remember { mutableStateOf<MessageEntity?>(null) }
    LaunchedEffect(messages.size) { app.messaging.markRead(contactId) }
    ConversationOnScreen(Conversation.Direct(contactId))
    // Opened from a notification for a contact that was deleted since: nothing to show.
    LeaveWhenGone(contact == Lookup.Gone, nav)
    val c = contact.found ?: return
    val ready = antenna.ready

    Box(Modifier.fillMaxSize()) {
        Page {
            ChatHeader(
                title = c.displayName,
                meta = (if (ready) "über Funk · " else "") + Formats.lastSeen(c.lastSeenAt, now),
                onBack = { nav.back() },
                avatar = { OgAvatar(patternFor(c.fingerprint), 40.dp) },
                trailing = {
                    val level = if (ready) Formats.signalLevel(c.lastRssi, c.lastSeenAt, now) else 0
                    Box(Modifier.size(44.dp), contentAlignment = Alignment.Center) { SignalBars(level, label = Formats.signalLabel(level)) }
                },
            )
            if (!ready) DisconnectedBanner { nav.navigate(Routes.CONNECT) }
            MessageList(messages, now, Modifier.weight(1f), empty = "Noch keine Nachrichten. Schreib die erste.") { row ->
                val m = row.message
                if (m.kind == "geo") {
                    GeoBubble(row, c, myFix, now, ready, onOpen = { nav.navigate(Routes.location(c.id, m.id)) }, onRetry = { app.messaging.retry(m.id) })
                } else {
                    MessageBubble(
                        out = m.direction == "out",
                        status = m.status,
                        text = m.text,
                        meta = metaFor(m, ready),
                        groupStart = row.groupStart,
                        continued = row.continued,
                        reaction = m.peerReaction,
                        onRetry = { app.messaging.retry(m.id) },
                        onLongPress = if (m.direction == "in" && m.ctr != null) ({ reactTo = m }) else null,
                    )
                }
            }
            ChatComposer(
                draft = draft,
                onDraft = { draft = it },
                // Chat.png says "Nachricht an Anna", chat-standort.png "Nachricht an Anna Meier"; the
                // screens skill settles it with display_name.
                target = c.displayName,
                ready = ready,
                maxBytes = antenna.maxTextBytes,
                onSend = {
                    app.messaging.sendText(c.id, draft)
                    draft = ""
                },
                onLocation = { locationSheet = true },
            )
        }
        LocationSheet(locationSheet, c.displayName, onClose = { locationSheet = false }) { fix ->
            app.messaging.sendLocation(c.id, fix)
            locationSheet = false
        }
        // Keep the last target while the sheet slides out.
        var lastReactTo by remember { mutableStateOf<MessageEntity?>(null) }
        reactTo?.let { lastReactTo = it }
        OgSheet(reactTo != null, "Reaktion", onClose = { reactTo = null }) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                REACTIONS.forEach { emoji ->
                    val chosen = lastReactTo?.peerReaction == emoji
                    Box(
                        Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(if (chosen) Og.accentSoft else Og.surface2)
                            .clickable(role = Role.Button, onClickLabel = if (chosen) "Reaktion entfernen" else "Reagieren") {
                                lastReactTo?.let { app.messaging.react(it, if (chosen) null else emoji) }
                                reactTo = null
                            },
                        contentAlignment = Alignment.Center,
                    ) { Text(emoji, fontSize = 22.sp) }
                }
            }
            OgButton("Abbrechen", { reactTo = null }, variant = ButtonVariant.Secondary)
        }
    }
}

/** Chat and group header: back, avatar 40, name and meta, optional trailing box. */
@Composable
fun ChatHeader(title: String, meta: String, onBack: () -> Unit, avatar: @Composable () -> Unit, trailing: @Composable () -> Unit = {}) {
    Row(
        Modifier.fillMaxWidth().padding(start = 6.dp, top = 14.dp, end = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        OgIconButton(OgIcon.Back, "Zurück zu den Kontakten", onBack, round = false)
        avatar()
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = OgType.chatName, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.semantics { heading() })
            Text(meta, style = OgType.meta, maxLines = 1)
        }
        trailing()
    }
    HorizontalDivider(thickness = 1.dp, color = Og.line)
}

@Composable
fun DisconnectedBanner(onConnect: () -> Unit) {
    OgBanner("Antenne getrennt", "Nachrichten werden gesendet, sobald sie wieder verbunden ist.", "Verbinden", onConnect)
}

/**
 * Bottom-aligned message list with day dividers. It is laid out in reverse, so it opens at the
 * newest message and stays there when new ones arrive. New bubbles fade and slide into place.
 */
@Composable
fun MessageList(
    messages: List<MessageEntity>,
    now: Long,
    modifier: Modifier,
    empty: String,
    item: @Composable (MessageRow.Msg) -> Unit,
) {
    if (messages.isEmpty()) {
        Box(modifier.fillMaxWidth().padding(horizontal = 32.dp), contentAlignment = Alignment.Center) {
            Text(empty, style = OgType.body2.copy(color = Og.text3, textAlign = TextAlign.Center))
        }
        return
    }
    val rows = remember(messages, now) { messageRows(messages, now).asReversed() }
    val listState = rememberLazyListState()
    LaunchedEffect(messages.lastOrNull()?.id) { listState.animateScrollToItem(0) }
    LazyColumn(
        modifier.fillMaxWidth(),
        state = listState,
        reverseLayout = true,
        contentPadding = PaddingValues(start = 14.dp, top = 16.dp, end = 14.dp, bottom = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.Bottom),
    ) {
        items(rows, key = { it.key }, contentType = { if (it is MessageRow.Day) 0 else 1 }) { row ->
            Box(Modifier.animateItem()) {
                when (row) {
                    is MessageRow.Day -> DayDivider(row.label)
                    is MessageRow.Msg -> item(row)
                }
            }
        }
    }
}

/** Meta line: in → time; out → "14:03 · zugestellt", "wartet auf Funk …" or "in Warteschlange". */
fun metaFor(m: MessageEntity, ready: Boolean): String {
    val time = Formats.time(m.sentAt)
    if (m.direction == "in") return time
    return when (m.status) {
        MessageStatus.DELIVERED -> "$time · zugestellt"
        MessageStatus.SENT -> "$time · gesendet"
        MessageStatus.LOCAL_QUEUED, MessageStatus.DEVICE_QUEUED -> if (ready) "wartet auf Funk …" else "in Warteschlange"
        else -> time
    }
}

@Composable
private fun GeoBubble(row: MessageRow.Msg, c: ContactEntity, myFix: GeoFix?, now: Long, ready: Boolean, onOpen: () -> Unit, onRetry: () -> Unit) {
    val m = row.message
    val lat = m.lat ?: return
    val lon = m.lon ?: return
    val out = m.direction == "out"
    val app = LocalApp.current
    val fresh = !out && app.location.isFresh(myFix, now)
    val bearing = if (fresh) Geo.bearingDegrees(myFix!!.latitude, myFix.longitude, lat, lon) else null
    LocationBubble(
        out = out,
        status = m.status,
        title = if (out) "Mein Standort" else "Standort von ${c.firstName ?: c.displayName}",
        coordinate = Geo.formatCoordinate(lat, lon),
        accuracy = m.accuracyM?.let(Geo::formatAccuracy),
        meta = metaFor(m, ready),
        distance = if (fresh) Geo.formatDistance(Geo.distanceMeters(myFix!!.latitude, myFix.longitude, lat, lon)) else null,
        directionText = bearing?.let { "Richtung ${Geo.compassName(it)}" },
        bearing = bearing,
        onOpen = onOpen,
        onRetry = onRetry,
        groupStart = row.groupStart,
        continued = row.continued,
    )
}

/** Composer with the byte counter; texts change while the antenna is away (spec §6.4). */
@Composable
fun ChatComposer(
    draft: String,
    onDraft: (String) -> Unit,
    target: String,
    ready: Boolean,
    maxBytes: Int,
    onSend: () -> Unit,
    onLocation: (() -> Unit)?,
) {
    Composer(
        text = draft,
        onTextChange = onDraft,
        placeholder = if (ready) "Nachricht an $target" else "Wird später gesendet",
        label = "Nachricht an $target",
        sendLabel = if (ready) "Senden" else "In Warteschlange legen",
        usedBytes = MessageLimits.utf8Bytes(draft),
        maxBytes = maxBytes,
        onSend = onSend,
        onLocation = onLocation,
    )
}

/** Sheet "Standort senden" (spec §10): locate once, show the fix, send it as a `geo` message. */
@Composable
private fun BoxScope.LocationSheet(visible: Boolean, name: String, onClose: () -> Unit, onSend: (GeoFix) -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    val fix by app.location.fix.collectAsStateWithLifecycle()
    val locating by app.location.locating.collectAsStateWithLifecycle()
    val error by app.location.error.collectAsStateWithLifecycle()
    val now = rememberNow()
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        scope.launch { app.location.locate() }
    }
    LaunchedEffect(visible) {
        if (!visible) return@LaunchedEffect
        if (!app.location.needsPermission()) app.location.locate()
        else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }
    val current = fix?.takeIf { app.location.isFresh(it, now) }

    OgSheet(visible, "Standort senden", onClose = onClose) {
        when {
            locating || (current == null && error == null) -> FixCard {
                Spinner()
                Text("Standort wird bestimmt …", style = TextStyle(fontFamily = Grotesk, fontSize = 15.sp, color = Og.text))
            }
            current != null -> {
                FixCard {
                    Box(Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(Og.accentSoft), contentAlignment = Alignment.Center) {
                        OgIconView(OgIcon.Pin, Og.accent, size = 24.dp)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            Geo.formatLat(current.latitude) + "\n" + Geo.formatLon(current.longitude),
                            style = TextStyle(fontFamily = Mono, fontSize = 16.sp, lineHeight = 21.6.sp, color = Og.text),
                        )
                        Text(
                            "Genauigkeit ${Geo.formatAccuracy(current.accuracyM)} · ${Geo.formatAgo(current.at, now)}",
                            style = OgType.help,
                        )
                    }
                }
                if (current.accuracyM > 100) OgNote("Ungenau – im Freien wird es meist besser.", Modifier.padding(0.dp))
            }
            else -> {
                OgNote(error!!.text())
                OgButton("Erneut versuchen", { scope.launch { app.location.locate() } }, variant = ButtonVariant.Secondary)
            }
        }
        Text("Wird per Funk an $name gesendet – auch ohne Mobilnetz.", style = OgType.body2.copy(fontSize = 14.sp, lineHeight = 20.sp))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OgButton("An $name senden", { current?.let(onSend) }, enabled = current != null, icon = OgIcon.Send)
            OgButton("Abbrechen", onClose, variant = ButtonVariant.Secondary)
        }
    }
}

@Composable
private fun FixCard(content: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(Og.rCard)).background(Og.bg).border(1.dp, Og.border, RoundedCornerShape(Og.rCard))
            .padding(16.dp).semantics(mergeDescendants = true) { contentDescription = "Standort" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) { content() }
}
