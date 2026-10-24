package ch.offgrid.android.ui.screens

import android.Manifest
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
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
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
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
import ch.offgrid.android.ui.components.StepList
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import kotlinx.coroutines.launch

/** Spec error `scanner-unavailable`. */
private const val SCANNER_UNAVAILABLE = "Der QR-Scanner ist auf diesem Handy nicht verfügbar."

/** No spec text exists for a denied camera; worded like the spec's `location-denied`. */
private const val CAMERA_DENIED = "Kamerazugriff fehlt. Erlaube ihn in den Android-Einstellungen."

/** Texts under the QR code and the scanner: 16 px, line height 1.45, `--og-text-2` (`Handshake.dc.html`). */
private val IntroStyle = OgType.body2.copy(fontSize = 16.sp, lineHeight = 1.45.em, textAlign = TextAlign.Center)

private enum class CameraProblem { NO_CAMERA, DENIED }

/** Screen 4 "Kontakt hinzufügen": show my code, scan the other one (mutual QR, link spec 7.4). */
@Composable
fun AddContactScreen(nav: NavHostController, scanTab: Boolean) {
    val app = LocalApp.current
    val vm = viewModel { AddContactViewModel(app.pairing, app.antenna.state) }
    val ui by vm.ui.collectAsStateWithLifecycle()
    val linkKind by app.linkKind.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(if (scanTab) "scan" else "mine") }

    LaunchedEffect(ui.confirmedContactId) {
        val id = ui.confirmedContactId ?: return@LaunchedEffect
        vm.finish()
        nav.navigate(Routes.added(id)) { popUpTo(Routes.ADD) { inclusive = true } }
    }

    Page {
        OgTopBar("Kontakt hinzufügen", onBack = { nav.back() }, backLabel = "Zurück zu den Kontakten")
        OgSegmented(listOf("mine" to "Mein Code", "scan" to "Code scannen"), tab, label = "Art des Hinzufügens") {
            tab = it
            vm.clearError()
        }
        BoxWithConstraints(Modifier.weight(1f)) {
            // At least as tall as the viewport, so the hint sits at the bottom like in the design and
            // scrolls with the rest when large font sizes make the page longer than the screen.
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = maxHeight)) {
                if (tab == "mine") {
                    MyCodeTab(ui)
                } else {
                    ScanTab(ui, simulated = linkKind == LinkKind.SIMULATED, onStart = vm::clearError, onCode = vm::scan)
                }
                ui.error?.let { OgNote(it.text()) }
                if (ui.canReplace) {
                    OgButton("Neu koppeln", vm::replace, Modifier.padding(start = 16.dp, top = 10.dp, end = 16.dp),
                        variant = ButtonVariant.Secondary)
                }
                if (ui.codeRenewed && tab == "mine") {
                    OgNote("Dein Code hat sich erneuert. Hat dein Gegenüber den alten schon gescannt, muss es diesen neu scannen.")
                }
                Spacer(Modifier.height(16.dp))
                Spacer(Modifier.weight(1f))
                if (tab == "mine") {
                    Text(
                        "Der Code enthält deinen Schlüssel. Zeig ihn nur Personen, mit denen du schreiben willst.",
                        style = OgType.help.copy(lineHeight = 1.45.em, textAlign = TextAlign.Center),
                        modifier = Modifier.fillMaxWidth().padding(start = 28.dp, end = 28.dp, bottom = 28.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun MyCodeTab(ui: AddContactUi) {
    Column(
        Modifier.fillMaxWidth().padding(start = 24.dp, top = 28.dp, end = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        QrCard(ui.qr)
        Text(
            "Lass dein Gegenüber diesen Code mit der OffGrid-App scannen.",
            style = IntroStyle,
            modifier = Modifier.widthIn(max = 290.dp),
        )
    }
    StepList(spinner = false, steps = myCodeSteps(codeReady = ui.qr != null, confirmed = ui.confirmed))
}

@Composable
private fun ScanTab(ui: AddContactUi, simulated: Boolean, onStart: () -> Unit, onCode: (String) -> Unit) {
    val context = LocalContext.current
    var cameraOn by rememberSaveable { mutableStateOf(false) }
    var problem by rememberSaveable { mutableStateOf<CameraProblem?>(null) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) cameraOn = true else problem = CameraProblem.DENIED
    }
    // Back from the Android settings with the camera allowed: the hint is no longer true.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        if (problem == CameraProblem.DENIED && context.hasCameraPermission()) problem = null
    }

    val scannedName = ui.scannedName
    if (scannedName != null) {
        Column(
            Modifier.fillMaxWidth().padding(start = 24.dp, top = 28.dp, end = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            OgAvatar(null, 96.dp, AvatarVariant.Pending)
            Text(scannedName, style = OgType.hero.copy(textAlign = TextAlign.Center), modifier = Modifier.semantics { heading() })
        }
        StepList(spinner = false, steps = scanSteps(pingSent = ui.pingSent, confirmed = ui.confirmed))
        return
    }

    Column(
        Modifier.fillMaxWidth().padding(start = 24.dp, top = 28.dp, end = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        val shape = RoundedCornerShape(Og.rQr)
        Box(
            // 298 as in the design; narrower screens shrink it to a square that still fits.
            Modifier.widthIn(max = 298.dp).fillMaxWidth().aspectRatio(1f)
                .clip(shape).background(Og.bg).border(1.dp, Og.border, shape)
                .then(
                    if (cameraOn) {
                        Modifier.semantics { contentDescription = "Kamera läuft" }
                    } else {
                        Modifier.clickable(role = Role.Button) {
                            onStart()
                            problem = null
                            when {
                                !context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) -> problem = CameraProblem.NO_CAMERA
                                context.hasCameraPermission() -> cameraOn = true
                                else -> permission.launch(Manifest.permission.CAMERA)
                            }
                        }.semantics { contentDescription = "Kamera starten und Code scannen" }
                    },
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (cameraOn) {
                QrScanner(onResult = { cameraOn = false; onCode(it) }, modifier = Modifier.fillMaxSize())
            } else {
                Text(
                    "KAMERA STARTEN",
                    style = OgType.meta.copy(letterSpacing = 0.1.em),
                    modifier = Modifier.clearAndSetSemantics {},
                )
            }
            ScanCorners(Modifier.matchParentSize())
        }
        Text("Halte die Kamera auf den Code, den dein Gegenüber anzeigt.", style = IntroStyle, modifier = Modifier.widthIn(max = 290.dp))
    }
    when (problem) {
        CameraProblem.NO_CAMERA -> OgNote(SCANNER_UNAVAILABLE)
        CameraProblem.DENIED -> {
            OgNote(CAMERA_DENIED)
            Column(Modifier.padding(start = 16.dp, top = 10.dp, end = 16.dp)) {
                OgButton("Android-Einstellungen öffnen", { context.openAppSettings() }, variant = ButtonVariant.Secondary)
            }
        }
        null -> Unit
    }
    if (BuildConfig.DEBUG) DebugCodeInput(simulated, onCode)
}

/** Debug builds only: paste a QR text (from a chat or the demo menu) or scan a simulated peer. */
@Composable
private fun DebugCodeInput(simulated: Boolean, onCode: (String) -> Unit) {
    val context = LocalContext.current
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var pasting by rememberSaveable { mutableStateOf(false) }
    var pasted by rememberSaveable { mutableStateOf("") }
    if (pasting) {
        OgCard(padded = true, modifier = Modifier.padding(top = 16.dp)) {
            OgTextField("Code einfügen", pasted, { pasted = it.trim() }, placeholder = "T0cx…")
            OgButton("Code verwenden", { pasting = false; onCode(pasted) }, enabled = pasted.isNotEmpty())
        }
        return
    }
    Column(Modifier.padding(start = 16.dp, top = 16.dp, end = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OgButton("Code aus Zwischenablage einfügen", {
            val clip = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            pasted = clip.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(context)?.toString()?.trim().orEmpty()
            pasting = true
        }, variant = ButtonVariant.Secondary)
        if (simulated) {
            // A fresh virtual peer on the simulated antenna, scanned as if from its screen.
            OgButton("Simulierten Kontakt scannen", {
                scope.launch { onCode(DemoData(app).newPeerCode(DemoData.nextPeerName())) }
            }, variant = ButtonVariant.Secondary)
        }
    }
}

private fun Context.hasCameraPermission() =
    ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

/** Once Android stops showing the permission dialog, the app's settings page is the only way back. */
private fun Context.openAppSettings() {
    startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
}

/**
 * Four accent corner brackets as the CSS draws them: 46x46 boxes 34 from the edge with 4 wide
 * left/top borders (square ends) and outer radius 14. The stroke runs on the centre line of that
 * border, so it sits 2 inside the outer edge with radius 12.
 */
@Composable
private fun ScanCorners(modifier: Modifier) {
    Canvas(modifier) {
        val width = 4.dp.toPx()
        val line = 34.dp.toPx() + width / 2
        val end = (34 + 46).dp.toPx()
        val r = 14.dp.toPx() - width / 2
        val topLeft = Path().apply {
            moveTo(line, end)
            lineTo(line, line + r)
            arcTo(Rect(line, line, line + 2 * r, line + 2 * r), 180f, 90f, false)
            lineTo(end, line)
        }
        val stroke = Stroke(width, cap = StrokeCap.Butt, join = StrokeJoin.Miter)
        // The other three corners are mirror images of the top-left one.
        listOf(1f to 1f, -1f to 1f, 1f to -1f, -1f to -1f).forEach { (sx, sy) ->
            scale(sx, sy, pivot = center) { drawPath(topLeft, Og.accent, style = stroke) }
        }
    }
}
