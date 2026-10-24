package ch.offgrid.android.ui.screens

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.invisibleToUser
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ch.offgrid.android.BuildConfig
import ch.offgrid.android.R
import ch.offgrid.android.domain.AntennaPhase
import ch.offgrid.android.link.LinkKind
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
import ch.offgrid.android.ui.theme.LocalReducedMotion
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
    val radioDown = state.ready && state.radioRunning == false
    val retryIn = rememberSecondsUntil(state.retryAt)
    val found = phase == AntennaPhase.DEVICE_FOUND || phase == AntennaPhase.CONNECTING || phase == AntennaPhase.READY
    Page {
        Column(Modifier.weight(1f).verticalScroll(scroll)) {
            ConnectHero(
                searching = phase == AntennaPhase.SEARCHING || phase == AntennaPhase.DEVICE_FOUND || phase == AntennaPhase.CONNECTING,
                // Debug builds: a long press switches to the simulated antenna, so a phone without a
                // Heltec still gets through onboarding.
                onDebugLongPress = if (BuildConfig.DEBUG) {
                    {
                        app.setLinkKind(LinkKind.SIMULATED)
                        app.antenna.connect()
                    }
                } else {
                    null
                },
            )
            Column(Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (onboarded == false) {
                    Text("SCHRITT 1 VON 2", style = OgType.section.copy(color = Og.accent))
                }
                Text("Antenne anschliessen", style = OgType.display, modifier = Modifier.semantics { heading() })
                Text(
                    "Verbinde die OffGrid-Antenne per USB-C mit deinem Handy. Danach schreibst du auch ohne Mobilnetz.",
                    style = OgType.body2.copy(fontSize = 16.sp),
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
                        meta = state.activity?.text() ?: if (phase == AntennaPhase.READY) state.deviceId else null,
                    ),
                    Step(
                        if (radioDown) "Funkmodul nicht bereit" else "Funkmodul bereit",
                        if (phase == AntennaPhase.READY && !radioDown) StepState.Done else StepState.Todo,
                        meta = if (phase == AntennaPhase.READY) state.fwVersion?.let { "FW $it" } else null,
                    ),
                ),
            )
            state.lockReason?.takeIf { !state.ready }?.let { OgNote(lockReasonText(it)) }
            state.error?.let { OgNote(it.text(state.errorCode, retryIn, state.vaultStatus)) }
            if (radioDown) {
                OgNote(
                    "Die Antenne ist entsperrt, aber ihr Funkmodul läuft nicht" + (state.radioError?.let { " (Fehler $it)" } ?: "") +
                        ". Nachrichten bleiben in der Warteschlange. Steck die Antenne neu ein.",
                )
            }
            Spacer(Modifier.height(16.dp))
        }
        Footer(top = 0.dp) {
            OgButton("Weiter", onClick = { onNext(onboarded == true) }, enabled = state.ready)
            OgButton("Erneut suchen", onClick = { app.antenna.disconnect(); app.antenna.connect() },
                variant = ButtonVariant.Secondary, enabled = !state.busy)
        }
    }
}

/**
 * Hero of `Antenne.dc.html`: three rings around the antenna. While the app looks for the
 * antenna a ring ripples outwards from the tile; it stays still with reduced motion.
 */
@Composable
private fun ConnectHero(searching: Boolean, onDebugLongPress: (() -> Unit)?) {
    val reduced = LocalReducedMotion.current
    Box(
        Modifier.fillMaxWidth().height(330.dp).semantics { invisibleToUser() }
            .then(if (onDebugLongPress != null) Modifier.pointerInput(Unit) { detectTapGestures(onLongPress = { onDebugLongPress() }) } else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.size(300.dp).border(1.dp, Og.line, CircleShape))
        Box(Modifier.size(220.dp).border(1.dp, Og.signalOff, CircleShape))
        Box(Modifier.size(140.dp).border(1.5.dp, Og.ringAccent, CircleShape))
        if (searching && !reduced) {
            val ripple = rememberInfiniteTransition(label = "ripple")
            val t by ripple.animateFloat(0f, 1f, infiniteRepeatable(tween(2400, easing = LinearEasing)), label = "t")
            Canvas(Modifier.size(300.dp)) {
                val r = 42.dp.toPx() + (size.minDimension / 2 - 42.dp.toPx()) * t
                drawCircle(Og.ringAccent.copy(alpha = 1f - t), r, style = Stroke(1.5.dp.toPx()))
            }
        }
        // The real antenna instead of the icon tile: render `icon-upright.png` from
        // offgrid-antenna-3d at ecf734b, cropped and scaled to 3x of 220 dp.
        Image(painterResource(R.drawable.antenna_render), contentDescription = null, modifier = Modifier.height(220.dp))
    }
}
