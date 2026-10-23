package ch.offgrid.android.ui.screens

import android.Manifest
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import ch.offgrid.android.BuildConfig
import ch.offgrid.android.DemoData
import ch.offgrid.android.link.LinkKind
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.Routes
import ch.offgrid.android.ui.back
import ch.offgrid.android.ui.components.AvatarVariant
import ch.offgrid.android.ui.components.ButtonVariant
import ch.offgrid.android.ui.components.OgAvatar
import ch.offgrid.android.ui.components.OgButton
import ch.offgrid.android.ui.components.OgCard
import ch.offgrid.android.ui.components.OgNote
import ch.offgrid.android.ui.components.OgSegmented
import ch.offgrid.android.ui.components.OgTextField
import ch.offgrid.android.ui.components.OgTopBar
import ch.offgrid.android.ui.components.QrCard
import ch.offgrid.android.ui.components.QrScanner
import ch.offgrid.android.ui.components.Step
import ch.offgrid.android.ui.components.StepList
import ch.offgrid.android.ui.components.StepState
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.launch

private const val SCANNER_UNAVAILABLE = "Der QR-Scanner ist auf diesem Handy nicht verfügbar."

/** Screen 4 "Kontakt hinzufügen": show my code, scan the other one (mutual QR, link spec 7.4). */
@Composable
fun AddContactScreen(nav: NavHostController, scanTab: Boolean) {
    val app = LocalApp.current
    val pairing by app.pairing.state.collectAsStateWithLifecycle()
    val linkKind by app.linkKind.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(if (scanTab) "scan" else "mine") }
    var finished by remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        app.pairing.begin()
        onDispose { if (!finished) app.pairing.cancel() }
    }
    LaunchedEffect(pairing.confirmedContactId) {
        val id = pairing.confirmedContactId ?: return@LaunchedEffect
        finished = true
        app.pairing.cancel()
        nav.navigate(Routes.added(id)) { popUpTo(Routes.ADD) { inclusive = true } }
    }

    Page {
        OgTopBar("Kontakt hinzufügen", onBack = { nav.back() }, backLabel = "Zurück zu den Kontakten")
        OgSegmented(listOf("mine" to "Mein Code", "scan" to "Code scannen"), tab, label = "Art des Hinzufügens") {
            tab = it
            app.pairing.clearError()
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            if (tab == "mine") MyCodeTab(pairing.qr, confirmed = pairing.confirmedContactId != null)
            else ScanTab(
                scannedName = pairing.scannedName,
                pingSent = pairing.pingSent,
                confirmed = pairing.confirmedContactId != null,
                simulated = linkKind == LinkKind.SIMULATED,
                onCode = app.pairing::complete,
            )
            pairing.error?.let { OgNote(it.text()) }
            Spacer(Modifier.height(16.dp))
        }
        if (tab == "mine") {
            Text(
                "Der Code enthält deinen Schlüssel. Zeig ihn nur Personen, mit denen du schreiben willst.",
                style = OgType.help.copy(fontSize = 13.sp, lineHeight = 19.sp, textAlign = TextAlign.Center),
                modifier = Modifier.fillMaxWidth().padding(start = 28.dp, end = 28.dp, bottom = 28.dp),
            )
        }
    }
}

@Composable
private fun MyCodeTab(qr: String?, confirmed: Boolean) {
    Column(
        Modifier.fillMaxWidth().padding(start = 24.dp, top = 28.dp, end = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        QrCard(qr)
        Text(
            "Lass dein Gegenüber diesen Code mit der OffGrid-App scannen.",
            style = OgType.body2.copy(textAlign = TextAlign.Center),
            modifier = Modifier.widthIn(max = 290.dp),
        )
    }
    StepList(
        spinner = false,
        steps = listOf(
            Step("Code bereit", if (qr != null) StepState.Done else StepState.Active, meta = if (qr != null) "erledigt" else null),
            Step("Gegenüber scannt", if (confirmed) StepState.Done else StepState.Active, meta = if (confirmed) "erledigt" else "wartet …"),
            Step("Antwort per Funk empfangen", if (confirmed) StepState.Done else StepState.Todo),
        ),
    )
}

@Composable
private fun ScanTab(scannedName: String?, pingSent: Boolean, confirmed: Boolean, simulated: Boolean, onCode: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val app = LocalApp.current
    var cameraOn by remember { mutableStateOf(false) }
    var cameraError by remember { mutableStateOf<String?>(null) }
    var pasting by remember { mutableStateOf(false) }
    var pasted by remember { mutableStateOf("") }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) cameraOn = true else cameraError = SCANNER_UNAVAILABLE
    }

    if (scannedName != null) {
        Column(
            Modifier.fillMaxWidth().padding(start = 24.dp, top = 28.dp, end = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            OgAvatar(null, 96.dp, AvatarVariant.Pending)
            Text(scannedName, style = OgType.hero)
        }
        StepList(
            spinner = false,
            steps = listOf(
                Step("Code gescannt", StepState.Done, meta = "erledigt"),
                Step("Schlüssel per Funk gesendet", if (pingSent) StepState.Done else StepState.Active, meta = if (pingSent) "erledigt" else "sendet …"),
                Step(
                    "Bestätigung empfangen",
                    when {
                        confirmed -> StepState.Done
                        pingSent -> StepState.Active
                        else -> StepState.Todo
                    },
                    meta = if (pingSent && !confirmed) "wartet …" else null,
                ),
            ),
        )
        return
    }

    Column(
        Modifier.fillMaxWidth().padding(start = 24.dp, top = 28.dp, end = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Box(
            Modifier.size(298.dp).clip(RoundedCornerShape(28.dp)).background(Og.bg).border(1.dp, Og.border, RoundedCornerShape(28.dp))
                .then(
                    if (cameraOn) Modifier else Modifier.clickable(role = Role.Button) {
                        cameraError = null
                        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                        if (granted) cameraOn = true else permission.launch(Manifest.permission.CAMERA)
                    }.semantics { contentDescription = "Kamera starten und Code scannen" },
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (cameraOn) {
                QrScanner(onResult = { cameraOn = false; onCode(it) }, modifier = Modifier.fillMaxSize())
            } else {
                Text("KAMERA STARTEN", style = OgType.meta.copy(fontSize = 12.sp, letterSpacing = 1.2.sp))
            }
            ScanCorners()
        }
        Text("Halte die Kamera auf den Code, den dein Gegenüber anzeigt.", style = OgType.body2.copy(textAlign = TextAlign.Center))
    }
    cameraError?.let { OgNote(it) }

    // Fallback without camera: paste the QR text (for example from a chat or the demo menu).
    if (pasting) {
        OgCard(padded = true, modifier = Modifier.padding(top = 16.dp)) {
            OgTextField("Code einfügen", pasted, { pasted = it.trim() }, placeholder = "T0cx…")
            OgButton("Code verwenden", { pasting = false; onCode(pasted) }, enabled = pasted.isNotEmpty())
        }
    } else {
        Column(Modifier.padding(start = 16.dp, top = 16.dp, end = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OgButton("Code aus Zwischenablage einfügen", {
                val clip = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                pasted = clip.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(context)?.toString()?.trim().orEmpty()
                pasting = true
            }, variant = ButtonVariant.Secondary)
            if (BuildConfig.DEBUG && simulated) {
                // Debug only: a fresh virtual peer on the simulated antenna, scanned as if from its screen.
                OgButton("Simulierten Kontakt scannen", {
                    scope.launch { onCode(DemoData(app).newPeerCode(DemoData.nextPeerName())) }
                }, variant = ButtonVariant.Secondary)
            }
        }
    }
}

/** Four accent corner brackets, 46x46, 4 px, outer radius 14, 34 px from the edge. */
@Composable
private fun ScanCorners() {
    Canvas(Modifier.size(298.dp)) {
        val inset = 34.dp.toPx()
        val len = 46.dp.toPx()
        val r = 14.dp.toPx()
        val topLeft = Path().apply {
            moveTo(inset, inset + len)
            lineTo(inset, inset + r)
            arcTo(Rect(inset, inset, inset + 2 * r, inset + 2 * r), 180f, 90f, false)
            lineTo(inset + len, inset)
        }
        val stroke = Stroke(4.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
        // The other three corners are mirror images of the top-left one.
        listOf(1f to 1f, -1f to 1f, 1f to -1f, -1f to -1f).forEach { (sx, sy) ->
            scale(sx, sy, pivot = center) { drawPath(topLeft, Og.accent, style = stroke) }
        }
    }
}
