package ch.offgrid.android.ui.components

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ch.offgrid.android.data.MessageStatus
import ch.offgrid.android.ui.theme.Grotesk
import ch.offgrid.android.ui.theme.Mono
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

private val inShape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = 20.dp, bottomStart = 6.dp)
private val outShape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = 6.dp, bottomStart = 20.dp)

/** Day separator: line, `HEUTE`, line. */
@Composable
fun DayDivider(label: String) {
    Row(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        HorizontalDivider(Modifier.weight(1f), thickness = 1.dp, color = Og.line)
        Text(label, style = OgType.section)
        HorizontalDivider(Modifier.weight(1f), thickness = 1.dp, color = Og.line)
    }
}

/** Meta line under outgoing bubbles: time, status word and small signal bars. */
@Composable
private fun OutMeta(status: Int, meta: String, onRetry: () -> Unit) {
    if (status == MessageStatus.FAILED) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Nicht gesendet", style = OgType.meta.copy(color = Og.danger, fontSize = 12.sp))
            Box(
                Modifier.height(32.dp).clip(RoundedCornerShape(10.dp)).background(Og.surface).border(1.dp, Og.border, RoundedCornerShape(10.dp))
                    .clickable(role = Role.Button, onClick = onRetry).padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center,
            ) { Text("Erneut senden", style = TextStyle(fontFamily = Grotesk, fontSize = 13.sp, fontWeight = FontWeight(600), color = Og.text)) }
        }
        return
    }
    val level = when (status) {
        MessageStatus.DELIVERED -> 4
        MessageStatus.SENT -> 2
        else -> 0
    }
    Row(Modifier.padding(end = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(meta, style = OgType.meta)
        SignalBars(level, small = true)
    }
}

/** `og-message-bubble`. Outgoing bubbles are solid when sent, dashed while queued, red-outlined on failure. */
@Composable
fun MessageBubble(
    out: Boolean,
    status: Int,
    text: String,
    meta: String,
    senderName: String? = null,
    reaction: String? = null,
    onRetry: () -> Unit = {},
    onLongPress: (() -> Unit)? = null,
) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (out) Alignment.End else Alignment.Start) {
        Column(Modifier.fillMaxWidth(0.78f), horizontalAlignment = if (out) Alignment.End else Alignment.Start,
            verticalArrangement = Arrangement.spacedBy(if (status == MessageStatus.FAILED) 6.dp else 4.dp)) {
            if (senderName != null) {
                Text(senderName, modifier = Modifier.padding(start = 6.dp, bottom = 2.dp),
                    style = TextStyle(fontFamily = Grotesk, fontSize = 12.sp, fontWeight = FontWeight(650), color = Og.text2))
            }
            val queued = out && (status == MessageStatus.LOCAL_QUEUED || status == MessageStatus.DEVICE_QUEUED)
            val failed = out && status == MessageStatus.FAILED
            val shape = if (out) outShape else inShape
            Box(
                Modifier
                    .clip(shape)
                    .then(
                        when {
                            !out -> Modifier.background(Og.surface).border(1.dp, Og.border, shape)
                            queued -> Modifier.dashedBorder(Og.accent, 1.5.dp, 20.dp)
                            failed -> Modifier.border(1.5.dp, Og.danger, shape)
                            else -> Modifier.background(Og.accent)
                        },
                    )
                    .then(if (onLongPress != null) Modifier.clickable(onClick = onLongPress) else Modifier)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) {
                Text(
                    text,
                    style = OgType.body.copy(
                        color = if (out && !queued && !failed) Og.onAccent else Og.text,
                        fontWeight = FontWeight(if (out) 500 else 400),
                    ),
                )
            }
            if (reaction != null) Text(reaction, fontSize = 16.sp, modifier = Modifier.padding(horizontal = 6.dp))
            if (out) OutMeta(status, meta, onRetry) else Text(meta, style = OgType.meta, modifier = Modifier.padding(start = 6.dp))
        }
    }
}

/** `og-location-bubble`: own position (accent) or the peer's with distance and direction. */
@Composable
fun LocationBubble(
    out: Boolean,
    status: Int,
    title: String,
    coordinate: String,
    accuracy: String?,
    meta: String,
    distance: String?,
    directionText: String?,
    bearing: Double?,
    onOpen: () -> Unit,
    onRetry: () -> Unit,
) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (out) Alignment.End else Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val queued = out && (status == MessageStatus.LOCAL_QUEUED || status == MessageStatus.DEVICE_QUEUED)
        val failed = out && status == MessageStatus.FAILED
        val shape = if (out) outShape else inShape
        Column(
            Modifier
                .width(if (out) 250.dp else 260.dp)
                .clip(shape)
                .then(
                    when {
                        !out -> Modifier.background(Og.surface).border(1.dp, Og.border, shape)
                        queued -> Modifier.dashedBorder(Og.accent, 1.5.dp, 20.dp)
                        failed -> Modifier.border(1.5.dp, Og.danger, shape)
                        else -> Modifier.background(Og.accent)
                    },
                )
                .clickable(onClick = onOpen)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(if (out) 6.dp else 10.dp),
        ) {
            val solid = out && !queued && !failed
            val fg = if (solid) Og.onAccent else Og.text
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OgIconView(OgIcon.Pin, if (out) fg else Og.accent, size = 18.dp)
                Text(title, style = TextStyle(fontFamily = Grotesk, fontSize = 15.sp, fontWeight = FontWeight(700), color = fg))
            }
            if (out) {
                Text(
                    coordinate + (accuracy?.let { "\nGenauigkeit $it" } ?: ""),
                    style = TextStyle(fontFamily = Mono, fontSize = 12.sp, lineHeight = 18.sp, color = fg),
                )
            } else {
                if (distance != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.size(44.dp).border(1.dp, Og.border, CircleShape), contentAlignment = Alignment.Center) {
                            Icon(DirectionArrow, null, tint = Og.accent, modifier = Modifier.size(26.dp).rotate((bearing ?: 0.0).toFloat()))
                        }
                        Column {
                            Text(distance, style = TextStyle(fontFamily = Grotesk, fontSize = 24.sp, fontWeight = FontWeight(750), letterSpacing = (-0.48).sp, color = Og.text))
                            if (directionText != null) Text(directionText, style = TextStyle(fontFamily = Grotesk, fontSize = 14.sp, color = Og.text2))
                        }
                    }
                }
                Text(coordinate + (accuracy?.let { " · $it" } ?: ""), style = TextStyle(fontFamily = Mono, fontSize = 12.sp, color = Og.text3))
                Box(
                    Modifier.fillMaxWidth().height(40.dp).clip(RoundedCornerShape(12.dp)).background(Og.line)
                        .clickable(role = Role.Button, onClick = onOpen),
                    contentAlignment = Alignment.Center,
                ) { Text("Anzeigen", style = TextStyle(fontFamily = Grotesk, fontSize = 14.sp, fontWeight = FontWeight(650), color = Og.text)) }
            }
        }
        if (out) OutMeta(status, meta, onRetry) else Text(meta, style = OgType.meta, modifier = Modifier.padding(start = 6.dp))
    }
}

/** `og-composer`: optional location button, 48 high input with byte counter, send button. */
@Composable
fun Composer(
    text: String,
    onTextChange: (String) -> Unit,
    placeholder: String,
    label: String,
    sendLabel: String,
    usedBytes: Int,
    maxBytes: Int,
    onSend: () -> Unit,
    onLocation: (() -> Unit)?,
) {
    val canSend = text.isNotBlank() && usedBytes <= maxBytes
    Column(Modifier.fillMaxWidth().background(Og.bar)) {
        HorizontalDivider(thickness = 1.dp, color = Og.line)
        Row(
            Modifier.fillMaxWidth().padding(start = 14.dp, top = 10.dp, end = 14.dp, bottom = 22.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(if (onLocation != null) 8.dp else 10.dp),
        ) {
            if (onLocation != null) {
                Box(
                    Modifier.padding(bottom = 21.dp).size(48.dp).clip(RoundedCornerShape(16.dp)).background(Og.surface)
                        .border(1.dp, Og.border, RoundedCornerShape(16.dp)).clickable(role = Role.Button, onClick = onLocation)
                        .semantics { contentDescription = "Standort senden" },
                    contentAlignment = Alignment.Center,
                ) { OgIconView(OgIcon.Pin, Og.text) }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                BasicTextField(
                    value = text,
                    onValueChange = onTextChange,
                    textStyle = TextStyle(fontFamily = Grotesk, fontSize = 16.sp, color = Og.text),
                    cursorBrush = SolidColor(Og.accent),
                    maxLines = 4,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { if (canSend) onSend() }),
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = label },
                    decorationBox = { inner ->
                        Box(
                            Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(16.dp)).background(Og.surface)
                                .border(1.dp, Og.border, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 12.dp),
                            contentAlignment = Alignment.CenterStart,
                        ) {
                            if (text.isEmpty()) Text(placeholder, maxLines = 1, style = TextStyle(fontFamily = Grotesk, fontSize = 16.sp, color = Og.placeholder))
                            inner()
                        }
                    },
                )
                Text(
                    "$usedBytes / $maxBytes Zeichen pro Funkspruch",
                    style = OgType.meta.copy(color = if (usedBytes > maxBytes) Og.danger else Og.text3),
                    modifier = Modifier.padding(start = 4.dp),
                )
            }
            Box(
                Modifier.padding(bottom = 21.dp).size(48.dp).alpha(if (canSend) 1f else 0.9f).clip(RoundedCornerShape(16.dp)).background(Og.accent)
                    .clickable(enabled = canSend, role = Role.Button, onClick = onSend)
                    .semantics { contentDescription = sendLabel },
                contentAlignment = Alignment.Center,
            ) { OgIconView(OgIcon.Send, Og.onAccent) }
        }
    }
}

/** `og-sheet`: scrim plus bottom panel with handle and title. Back closes it. */
@Composable
fun BoxScope.OgSheet(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    BackHandler(onBack = onClose)
    Box(
        Modifier.matchParentSize().background(Og.scrim)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClose),
    )
    Column(
        Modifier.align(Alignment.BottomCenter).fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .background(Og.surface)
            .border(1.dp, Og.border, RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
            .navigationBarsPadding()
            .padding(start = 20.dp, top = 10.dp, end = 20.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Box(Modifier.align(Alignment.CenterHorizontally).size(36.dp, 4.dp).clip(RoundedCornerShape(999.dp)).background(Og.borderMuted))
        Text(title, style = OgType.pageTitle)
        content()
    }
}

/** `og-bearing-dial`: compass rose with north up and the arrow rotated to the target bearing. */
@Composable
fun BearingDial(bearing: Double?, label: String) {
    val measurer = rememberTextMeasurer()
    Canvas(Modifier.size(232.dp).semantics { contentDescription = label; role = Role.Image }) {
        val s = size.width / 240f
        val c = Offset(120 * s, 120 * s)
        drawCircle(Og.surface2, 116 * s, c)
        drawCircle(Og.border, 116 * s, c, style = Stroke(1.5.dp.toPx()))
        drawCircle(Og.line, 78 * s, c, style = Stroke(1.dp.toPx()))
        listOf(30, 60, 120, 150, 210, 240, 300, 330).forEach { deg ->
            rotate(deg.toFloat(), c) {
                drawLine(Og.borderMuted, Offset(120 * s, 8 * s), Offset(120 * s, 16 * s), 2.dp.toPx(), StrokeCap.Round)
            }
        }
        fun letter(t: String, x: Float, y: Float, color: Color, weight: Int) {
            val layout = measurer.measure(t, TextStyle(fontFamily = Mono, fontSize = 13.sp, fontWeight = FontWeight(weight), color = color))
            drawText(layout, topLeft = Offset(x * s - layout.size.width / 2f, y * s - layout.size.height / 2f))
        }
        letter("N", 120f, 30f, Og.accent, 600)
        letter("O", 212f, 120f, Og.text3, 400)
        letter("S", 120f, 214f, Og.text3, 400)
        letter("W", 28f, 120f, Og.text3, 400)
        if (bearing != null) {
            rotate(bearing.toFloat(), c) {
                val p = Path().apply {
                    moveTo(120 * s, 54 * s); lineTo(148 * s, 154 * s); lineTo(120 * s, 138 * s); lineTo(92 * s, 154 * s); close()
                }
                drawPath(p, Og.accent)
            }
            drawCircle(Og.bg, 4 * s, c)
        } else {
            letter("?", 120f, 120f, Og.text3, 400)
        }
    }
}

/** QR code on a light card (padding 22, radius 28), modules drawn as soft squares like the design. */
@Composable
fun QrCard(data: String?, modifier: Modifier = Modifier) {
    val matrix = remember(data) {
        data?.let {
            QRCodeWriter().encode(it, BarcodeFormat.QR_CODE, 0, 0,
                mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M, EncodeHintType.MARGIN to 0))
        }
    }
    Box(
        modifier.clip(RoundedCornerShape(Og.rQr)).background(Og.text).padding(22.dp)
            .semantics { contentDescription = "QR-Code mit deinem Schlüssel"; role = Role.Image },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(230.dp)) {
            if (matrix == null) return@Canvas
            val n = matrix.width
            val cell = size.width / n
            val inset = cell * 0.06f
            for (y in 0 until n) for (x in 0 until n) {
                if (matrix.get(x, y)) {
                    drawRoundRect(Og.bg, Offset(x * cell + inset, y * cell + inset), Size(cell - 2 * inset, cell - 2 * inset),
                        CornerRadius(cell * 0.28f, cell * 0.28f))
                }
            }
        }
        if (matrix == null) Spinner(28.dp)
    }
}

@Composable
fun VSpace(height: Dp) = Spacer(Modifier.height(height))
