package ch.offgrid.android.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import ch.offgrid.android.BuildConfig
import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.domain.ConversationItem
import ch.offgrid.android.domain.Formats
import ch.offgrid.android.domain.KeyPattern
import ch.offgrid.android.domain.Settings
import ch.offgrid.android.link.LinkKind
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.Routes
import ch.offgrid.android.ui.components.AvatarVariant
import ch.offgrid.android.ui.components.Footer
import ch.offgrid.android.ui.components.OgAvatar
import ch.offgrid.android.ui.components.OgBadge
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgIcon
import ch.offgrid.android.ui.components.OgIconButton
import ch.offgrid.android.ui.components.SignalBars
import ch.offgrid.android.ui.components.StatusDot
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType

/** Screen 3 "Kontakte" with the empty state "Noch keine Kontakte". */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ContactsScreen(nav: NavHostController) {
    val app = LocalApp.current
    val items by app.messaging.conversations.collectAsStateWithLifecycle(initialValue = null)
    val antenna by app.antenna.state.collectAsStateWithLifecycle()
    val settings by app.settings.values.collectAsStateWithLifecycle()
    val installId by produceState<String?>(null) { value = app.settings.installId() }
    val now = rememberNow()
    var demoMenu by remember { mutableStateOf(false) }
    val list = items ?: return
    val empty = list.isEmpty()
    val ownPattern = remember(settings[Settings.OWN_PUBLIC_KEY], installId) {
        KeyPattern.fromSeed(settings[Settings.OWN_PUBLIC_KEY] ?: installId ?: "")
    }

    Box(Modifier.fillMaxSize()) {
        Page {
            Row(
                Modifier.fillMaxWidth().padding(start = 20.dp, top = 22.dp, end = 20.dp, bottom = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "OffGrid",
                    style = OgType.appTitle,
                    modifier = Modifier.semantics { heading() }
                        .combinedClickable(onClick = {}, onLongClick = { if (BuildConfig.DEBUG) demoMenu = true }),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OgIconButton(OgIcon.Settings, "Einstellungen", { nav.navigate(Routes.SETTINGS) })
                    if (!empty) {
                        if (list.count { it.contact?.state == "active" } > 0) {
                            OgIconButton(OgIcon.Users, "Gruppe erstellen", { nav.navigate(Routes.NEW_GROUP) })
                        }
                        OgIconButton(OgIcon.Plus, "Kontakt hinzufügen", { nav.navigate(Routes.add()) })
                    }
                }
            }
            AntennaStatusLine(antenna.ready, antenna.kind, antenna.freqMhz) { nav.navigate(Routes.CONNECT) }
            HorizontalDivider(Modifier.padding(start = 20.dp, top = 6.dp, end = 20.dp, bottom = 8.dp), thickness = 1.dp, color = Og.line)

            if (empty) {
                EmptyState(ownPattern, Modifier.weight(1f))
            } else {
                LazyColumn(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                    items(list, key = { (it.contact?.id ?: -(it.group?.id ?: 0)).toString() + (it.group != null) }) { item ->
                        ConversationRow(item, now, onOpen = {
                            item.contact?.let { nav.navigate(Routes.chat(it.id)) }
                            item.group?.let { nav.navigate(Routes.group(it.id)) }
                        })
                    }
                }
            }
            Footer {
                OgButton(if (empty) "Ersten Kontakt hinzufügen" else "Kontakt hinzufügen", { nav.navigate(Routes.add()) }, icon = OgIcon.Qr)
            }
        }
        if (demoMenu) DemoMenu(onClose = { demoMenu = false })
    }
}

/** "● Antenne verbunden · USB-C · 868 MHz", tappable to the connect screen. */
@Composable
fun AntennaStatusLine(ready: Boolean, kind: LinkKind, freqMhz: Double?, onClick: () -> Unit) {
    Row(
        Modifier.padding(horizontal = 12.dp).fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp))
            .clickable(role = Role.Button, onClick = onClick).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        StatusDot(ready)
        Text(if (ready) "Antenne verbunden" else "Antenne getrennt", style = OgType.preview.copy(color = Og.text2))
        val transport = if (kind == LinkKind.SIMULATED) "Simuliert" else "USB-C"
        Text(
            if (ready) "· $transport · ${freqMhz?.let(Formats::band) ?: "868"} MHz" else "· Tippen zum Verbinden",
            style = OgType.meta.copy(fontSize = 12.sp),
        )
    }
}

@Composable
private fun ConversationRow(item: ConversationItem, now: Long, onOpen: () -> Unit) {
    val contact = item.contact
    val pending = contact?.state == "pending"
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(Og.rBtn))
            .then(if (pending) Modifier else Modifier.clickable(role = Role.Button, onClick = onOpen))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        when {
            item.group != null -> OgAvatar(groupPattern(item.group), 48.dp, AvatarVariant.Square)
            pending -> OgAvatar(null, 48.dp, AvatarVariant.Pending)
            else -> OgAvatar(patternFor(contact!!.fingerprint), 48.dp)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(item.group?.name ?: contact!!.displayName, style = OgType.bodyStrong.copy(fontSize = 17.sp), maxLines = 1,
                    overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (contact != null) {
                    val level = if (pending) 0 else Formats.signalLevel(contact.lastRssi, contact.lastSeenAt, now)
                    SignalBars(level, label = if (pending) null else Formats.signalLabel(level))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                if (pending) {
                    Text("Schlüssel ausstehend", style = OgType.preview.copy(color = Og.accent, fontSize = 15.sp), modifier = Modifier.weight(1f))
                } else {
                    Text(
                        preview(item),
                        style = OgType.preview.copy(fontSize = 15.sp, color = if (item.unread > 0) Og.text2 else Og.text3),
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        OgBadge(item.unread)
                        item.last?.let { Text(Formats.listTime(it.sentAt, now), style = OgType.meta.copy(fontSize = 12.sp)) }
                    }
                }
            }
        }
    }
}

private fun preview(item: ConversationItem): String {
    val last: MessageEntity = item.last ?: return if (item.group != null) "Gruppe · ${item.memberCount} Mitglieder" else "Noch keine Nachrichten"
    val body = if (last.kind == "geo") "Standort" else last.text
    return when {
        last.direction == "out" -> "Du: $body"
        item.group != null -> "${last.senderName ?: "?"}: $body"
        else -> body
    }
}

@Composable
private fun EmptyState(ownPattern: BooleanArray, modifier: Modifier) {
    Column(
        modifier.fillMaxWidth().padding(horizontal = 36.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OgAvatar(ownPattern, 56.dp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                repeat(3) { Box(Modifier.size(5.dp).clip(CircleShape).background(Og.borderMuted)) }
            }
            OgAvatar(null, 56.dp, AvatarVariant.Pending)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Noch keine Kontakte", style = OgType.emptyTitle, modifier = Modifier.semantics { heading() })
            Text(
                "Triff dich mit jemandem, der OffGrid nutzt, und scannt gegenseitig eure Codes. Danach könnt ihr ohne Mobilnetz schreiben.",
                style = OgType.body2.copy(textAlign = TextAlign.Center),
            )
        }
    }
}
