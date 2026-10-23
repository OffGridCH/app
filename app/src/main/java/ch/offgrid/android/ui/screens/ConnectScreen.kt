package ch.offgrid.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.invisibleToUser
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ch.offgrid.android.domain.AntennaPhase
import ch.offgrid.android.domain.Settings
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.components.ButtonVariant
import ch.offgrid.android.ui.components.Footer
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgIcon
import ch.offgrid.android.ui.components.OgIconView
import ch.offgrid.android.ui.components.OgNote
import ch.offgrid.android.ui.components.Step
import ch.offgrid.android.ui.components.StepList
import ch.offgrid.android.ui.components.StepState
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType

/** Screen 1 "Antenne verbinden" (onboarding step 1 and "Neu verbinden" from settings). */
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
fun ConnectScreen(onNext: (onboardingDone: Boolean) -> Unit) {
    val app = LocalApp.current
    val state by app.antenna.state.collectAsStateWithLifecycle()
    val onboarded by produceState<Boolean?>(null) { value = app.settings.get(Settings.ONBOARDED) == "true" }
    LaunchedEffect(Unit) {
        if (state.phase == AntennaPhase.DISCONNECTED || state.phase == AntennaPhase.ERROR) app.antenna.connect()
    }
    val scroll = rememberScrollState()
    // On phone-sized screens the note sits below the fold; bring it into view when it appears.
    LaunchedEffect(state.error) { if (state.error != null) scroll.animateScrollTo(scroll.maxValue) }
    val phase = state.phase
    val found = phase == AntennaPhase.DEVICE_FOUND || phase == AntennaPhase.CONNECTING || phase == AntennaPhase.READY
    Page {
        Column(Modifier.weight(1f).verticalScroll(scroll)) {
            Box(Modifier.fillMaxWidth().height(330.dp).semantics { invisibleToUser() }, contentAlignment = Alignment.Center) {
                Box(Modifier.size(300.dp).border(1.dp, Og.line, CircleShape))
                Box(Modifier.size(220.dp).border(1.dp, Og.borderMuted, CircleShape))
                // The design PNG shows this ring brighter than the accent-soft token, so accent at 35 %.
                Box(Modifier.size(140.dp).border(1.5.dp, Og.accent.copy(alpha = 0.35f), CircleShape))
                Box(Modifier.size(84.dp).clip(RoundedCornerShape(28.dp)).background(Og.accent), contentAlignment = Alignment.Center) {
                    OgIconView(OgIcon.Antenna, Og.onAccent, size = 40.dp)
                }
            }
            Column(Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (onboarded == false) {
                    Text("SCHRITT 1 VON 2", style = OgType.section.copy(color = Og.accent))
                }
                Text("Antenne anschliessen", style = OgType.display, modifier = Modifier.semantics { heading() })
                Text(
                    "Verbinde die OffGrid-Antenne per USB-C mit deinem Handy. Danach schreibst du auch ohne Mobilnetz.",
                    style = OgType.body2,
                )
            }
            StepList(
                compact = true,
                steps = listOf(
                    Step(
                        "USB-Gerät erkannt",
                        when {
                            found -> StepState.Done
                            phase == AntennaPhase.SEARCHING -> StepState.Active
                            else -> StepState.Todo
                        },
                        meta = if (found) state.deviceLabel else null,
                    ),
                    Step(
                        "Verbindung wird aufgebaut",
                        when (phase) {
                            AntennaPhase.READY -> StepState.Done
                            AntennaPhase.CONNECTING, AntennaPhase.DEVICE_FOUND -> StepState.Active
                            else -> StepState.Todo
                        },
                    ),
                    Step(
                        "Funkmodul bereit",
                        if (phase == AntennaPhase.READY) StepState.Done else StepState.Todo,
                        meta = if (phase == AntennaPhase.READY) state.fwVersion?.let { "FW $it" } else null,
                    ),
                ),
            )
            state.error?.let { OgNote(it.text()) }
            Spacer(Modifier.height(16.dp))
        }
        Footer(top = 0.dp) {
            OgButton("Weiter", onClick = { onNext(onboarded == true) }, enabled = state.ready)
            OgButton("Erneut suchen", onClick = { app.antenna.disconnect(); app.antenna.connect() },
                variant = ButtonVariant.Secondary, enabled = !state.busy)
        }
    }
}
