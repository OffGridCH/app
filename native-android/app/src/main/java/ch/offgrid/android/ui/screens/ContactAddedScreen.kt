package ch.offgrid.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import ch.offgrid.android.data.ContactEntity
import ch.offgrid.android.domain.MessageLimits
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.Routes
import ch.offgrid.android.ui.components.ButtonVariant
import ch.offgrid.android.ui.components.Footer
import ch.offgrid.android.ui.components.OgAvatar
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgCard
import ch.offgrid.android.ui.components.OgIcon
import ch.offgrid.android.ui.components.OgIconView
import ch.offgrid.android.ui.components.OgTextField
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.launch

/** Screen 5 "Schlüssel ausgetauscht": compare the key pattern and name the contact. */
@Composable
fun ContactAddedScreen(nav: NavHostController, contactId: Long) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var contact by remember { mutableStateOf<ContactEntity?>(null) }
    // Survives rotation, so typed names are not overwritten when the contact is loaded again.
    var prefilled by rememberSaveable { mutableStateOf(false) }
    var displayName by rememberSaveable { mutableStateOf("") }
    var firstName by rememberSaveable { mutableStateOf("") }
    var lastName by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(contactId) {
        val c = app.db.contacts().byId(contactId)
        if (c == null) {
            nav.navigate(Routes.CONTACTS) { popUpTo(Routes.CONTACTS) { inclusive = true } }
            return@LaunchedEffect
        }
        contact = c
        if (!prefilled) {
            displayName = c.displayName
            firstName = c.firstName.orEmpty()
            lastName = c.lastName.orEmpty()
            prefilled = true
        }
    }
    val c = contact ?: return
    val nameValid = MessageLimits.isValidName(displayName)

    Page {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            Column(
                Modifier.fillMaxWidth().padding(start = 24.dp, top = 56.dp, end = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Box {
                    OgAvatar(patternFor(c.fingerprint), 96.dp)
                    // `right: -2px; bottom: -2px` in KontaktBenennen.dc.html; the check is drawn 3.2 wide there.
                    Box(
                        Modifier.align(Alignment.BottomEnd).offset(x = 2.dp, y = 2.dp).size(32.dp).clip(CircleShape)
                            .background(Og.ok).border(3.dp, Og.bg, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) { OgIconView(OgIcon.Check, Og.onAccent, size = 14.dp, strokeWidth = 3.2f) }
                }
                // Heading and text form their own group with gap 8 under the 16 below the avatar.
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Schlüssel ausgetauscht",
                        style = OgType.hero.copy(textAlign = TextAlign.Center),
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        "Vergleicht das Muster auf beiden Handys. Sieht es gleich aus, hat alles geklappt.",
                        style = OgType.body2.copy(textAlign = TextAlign.Center),
                        modifier = Modifier.widthIn(max = 300.dp),
                    )
                }
            }
            Spacer(Modifier.height(32.dp))
            OgCard(padded = true) {
                OgTextField(
                    "Anzeigename", displayName, { displayName = MessageLimits.clampToBytes(it, MessageLimits.MAX_NAME_BYTES) },
                    error = if (!nameValid) NAME_ERROR else null,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OgTextField("Vorname", firstName, { firstName = it.take(100) }, Modifier.weight(1f), placeholder = "Vorname", optional = true)
                    OgTextField("Nachname", lastName, { lastName = it.take(100) }, Modifier.weight(1f), placeholder = "Nachname", optional = true)
                }
            }
        }
        // The design has no gap above the buttons (`padding: 0 16px 26px`); the flexible space does it.
        Footer(top = 0.dp) {
            OgButton("Speichern und schreiben", enabled = nameValid, onClick = {
                scope.launch {
                    app.messaging.renameContact(c.id, displayName, firstName, lastName)
                    nav.navigate(Routes.chat(c.id)) { popUpTo(Routes.CONTACTS) }
                }
            })
            OgButton("Muster stimmt nicht überein", variant = ButtonVariant.Secondary, onClick = {
                scope.launch {
                    app.messaging.deleteContact(c.id)
                    nav.navigate(Routes.add()) { popUpTo(Routes.CONTACTS) }
                }
            })
        }
    }
}
