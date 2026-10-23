package ch.offgrid.android.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ch.offgrid.android.ui.theme.Grotesk
import ch.offgrid.android.ui.theme.Og
import ch.offgrid.android.ui.theme.OgType

// ------------------------------------------------------------------ buttons

enum class ButtonVariant { Primary, Secondary, DangerText }

/** `og-button`: primary 54 high on ice blue, secondary 48 high outlined, danger text for card rows. */
@Composable
fun OgButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Primary,
    enabled: Boolean = true,
    icon: OgIcon? = null,
    fullWidth: Boolean = true,
    containerColor: Color? = null,
) {
    val (height, shape) = when (variant) {
        ButtonVariant.Primary -> Og.btnH to RoundedCornerShape(Og.rBtn)
        ButtonVariant.Secondary -> Og.btn2H to RoundedCornerShape(Og.rBtn2)
        ButtonVariant.DangerText -> 56.dp to RoundedCornerShape(0.dp)
    }
    val textColor = when (variant) {
        ButtonVariant.Primary -> Og.onAccent
        ButtonVariant.Secondary -> Og.text
        ButtonVariant.DangerText -> Og.danger
    }
    Row(
        modifier = modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .height(height)
            .alpha(if (enabled) 1f else 0.4f)
            .clip(shape)
            .then(
                when (variant) {
                    ButtonVariant.Primary -> Modifier.background(containerColor ?: Og.accent)
                    ButtonVariant.Secondary -> Modifier.background(containerColor ?: Color.Transparent).border(1.dp, Og.border, shape)
                    ButtonVariant.DangerText -> Modifier
                },
            )
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 16.dp),
        horizontalArrangement = if (variant == ButtonVariant.DangerText) Arrangement.Start else Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            OgIconView(icon, textColor, size = if (variant == ButtonVariant.Primary) 20.dp else 18.dp)
            Spacer(Modifier.width(10.dp))
        }
        Text(
            text,
            style = TextStyle(
                fontFamily = Grotesk,
                fontSize = if (variant == ButtonVariant.Secondary) 15.sp else 16.sp,
                fontWeight = FontWeight(if (variant == ButtonVariant.Primary) 700 else 600),
                color = textColor,
            ),
        )
    }
}

/** `og-icon-button`: 44x44, `round` on surface with border, `plain` for the back arrow. */
@Composable
fun OgIconButton(icon: OgIcon, label: String, onClick: () -> Unit, round: Boolean = true, modifier: Modifier = Modifier, tint: Color = Og.text) {
    Box(
        modifier = modifier
            .size(44.dp)
            .clip(if (round) CircleShape else RoundedCornerShape(14.dp))
            .then(if (round) Modifier.background(Og.surface).border(1.dp, Og.border, CircleShape) else Modifier)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) { OgIconView(icon, tint) }
}

// ------------------------------------------------------------------ layout pieces

/** `og-topbar`: back button and page title, padding 14 12 8 6, gap 6. */
@Composable
fun OgTopBar(title: String, onBack: () -> Unit, backLabel: String, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = 6.dp, top = 14.dp, end = 12.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        OgIconButton(OgIcon.Back, backLabel, onBack, round = false)
        Text(title, style = OgType.pageTitle, modifier = Modifier.weight(1f).semantics { heading() }, maxLines = 1)
        trailing()
    }
}

@Composable
fun SectionLabel(text: String, list: Boolean = false, color: Color = Og.text3) {
    Text(
        text.uppercase(),
        style = OgType.section.copy(color = color),
        modifier = Modifier.padding(start = if (list) 20.dp else 28.dp, top = 26.dp, end = 28.dp, bottom = 8.dp),
    )
}

/** `og-card`: surface, 1px border, radius 20, side margin 16. */
@Composable
fun OgCard(modifier: Modifier = Modifier, padded: Boolean = false, gap: Dp = 14.dp, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = modifier
            .padding(horizontal = Og.gutter)
            .fillMaxWidth()
            .clip(RoundedCornerShape(Og.rCard))
            .background(Og.surface)
            .border(1.dp, Og.border, RoundedCornerShape(Og.rCard))
            .then(if (padded) Modifier.padding(16.dp) else Modifier),
        verticalArrangement = if (padded) Arrangement.spacedBy(gap) else Arrangement.Top,
        content = content,
    )
}

@Composable
fun CardDivider() = HorizontalDivider(thickness = 1.dp, color = Og.line)

/** `og-info-row`: label left (row style, text-2), value right (mono 13). */
@Composable
fun InfoRow(label: String, value: String? = null, last: Boolean = false, content: (@Composable () -> Unit)? = null) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = Og.rowMin).padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(label, style = OgType.row.copy(fontSize = 15.sp))
            if (content != null) content() else if (value != null) Text(value, style = OgType.value)
        }
        if (!last) CardDivider()
    }
}

// ------------------------------------------------------------------ avatar, signal, dots

enum class AvatarVariant { Normal, Pending, Square }

/** `og-avatar`: 5x5 key pattern in a circle; dashed circle while the key exchange is pending. */
@Composable
fun OgAvatar(pattern: BooleanArray?, size: Dp, variant: AvatarVariant = AvatarVariant.Normal, modifier: Modifier = Modifier) {
    val (cell, gap) = when {
        size >= 96.dp -> 9.dp to 2.dp
        size >= 72.dp -> 7.dp to 1.5.dp
        size >= 48.dp -> 5.dp to 1.dp
        else -> 4.dp to 1.dp
    }
    val shape = when (variant) {
        AvatarVariant.Square -> RoundedCornerShape(if (size >= 48.dp) 14.dp else 12.dp)
        else -> CircleShape
    }
    if (variant == AvatarVariant.Pending) {
        Canvas(modifier.size(size)) {
            val stroke = 1.5.dp.toPx()
            drawCircle(
                color = Og.dashed,
                radius = this.size.minDimension / 2 - stroke / 2,
                style = Stroke(width = stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))),
            )
        }
        return
    }
    val cellColor = if (variant == AvatarVariant.Square) Og.accent else Og.text2
    Box(
        modifier = modifier.size(size).clip(shape).background(Og.surface).border(1.dp, Og.border, shape),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(cell * 5 + gap * 4)) {
            val c = cell.toPx()
            val g = gap.toPx()
            val radius = if (size >= 96.dp) 2.dp.toPx() else 1.dp.toPx()
            pattern?.forEachIndexed { index, on ->
                if (on) {
                    val x = (index % 5) * (c + g)
                    val y = (index / 5) * (c + g)
                    drawRoundRect(cellColor, Offset(x, y), Size(c, c), CornerRadius(radius, radius))
                }
            }
        }
    }
}

/** `og-signal-bars`: four bars, `level` of them in accent. md = 20x14, sm = 15x11. */
@Composable
fun SignalBars(level: Int, small: Boolean = false, label: String? = null, modifier: Modifier = Modifier) {
    val w = if (small) 15.dp else 20.dp
    val h = if (small) 11.dp else 14.dp
    Canvas(
        modifier
            .size(w, h)
            .then(if (label != null) Modifier.semantics { contentDescription = label; role = Role.Image } else Modifier),
    ) {
        val sx = this.size.width / 20f
        val sy = this.size.height / 14f
        val bars = listOf(0f to 10f, 5.5f to 7f, 11f to 4f, 16.5f to 0f)
        bars.forEachIndexed { i, (x, y) ->
            drawRoundRect(
                color = if (i < level) Og.accent else Og.signalOff,
                topLeft = Offset(x * sx, y * sy),
                size = Size(3.5f * sx, (14f - y) * sy),
                cornerRadius = CornerRadius(1f * sx, 1f * sy),
            )
        }
    }
}

@Composable
fun StatusDot(ok: Boolean) {
    Box(Modifier.size(8.dp).clip(CircleShape).background(if (ok) Og.ok else Og.danger))
}

/** Unread badge: min 18x18 pill on accent, 11/700. */
@Composable
fun OgBadge(count: Int) {
    if (count <= 0) return
    Box(
        Modifier.heightIn(min = 18.dp).widthIn(min = 18.dp).clip(RoundedCornerShape(999.dp)).background(Og.accent)
            .padding(horizontal = 5.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(if (count > 99) "99+" else count.toString(), style = TextStyle(fontFamily = Grotesk, fontSize = 11.sp, fontWeight = FontWeight(700), color = Og.onAccent))
    }
}

// ------------------------------------------------------------------ banners and notes

/** `og-banner` (danger tone) with an optional action button on the right. */
@Composable
fun OgBanner(title: String, text: String, actionLabel: String?, onAction: () -> Unit) {
    Row(
        modifier = Modifier
            .padding(start = 14.dp, top = 12.dp, end = 14.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(Og.rBtn))
            .background(Og.dangerBg)
            .border(1.dp, Og.dangerBorder, RoundedCornerShape(Og.rBtn))
            .padding(start = 16.dp, top = 12.dp, end = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = TextStyle(fontFamily = Grotesk, fontSize = 15.sp, fontWeight = FontWeight(650), color = Og.dangerTitle))
            Text(text, style = TextStyle(fontFamily = Grotesk, fontSize = 13.sp, lineHeight = 18.sp, color = Og.dangerText))
        }
        if (actionLabel != null) {
            Box(
                Modifier.height(40.dp).clip(RoundedCornerShape(12.dp)).background(Og.text)
                    .clickable(role = Role.Button, onClick = onAction).padding(horizontal = 14.dp),
                contentAlignment = Alignment.Center,
            ) { Text(actionLabel, style = TextStyle(fontFamily = Grotesk, fontSize = 14.sp, fontWeight = FontWeight(700), color = Og.bg)) }
        }
    }
}

/** `og-note`: warning icon and text on the danger background. */
@Composable
fun OgNote(text: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .padding(start = 16.dp, top = 14.dp, end = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(Og.rBtn))
            .background(Og.dangerBg)
            .border(1.dp, Og.dangerBorder, RoundedCornerShape(Og.rBtn))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OgIconView(OgIcon.Warning, Og.dangerTitle, Modifier.padding(top = 1.dp))
        Text(text, style = TextStyle(fontFamily = Grotesk, fontSize = 14.sp, lineHeight = 20.sp, color = Og.dangerText))
    }
}

// ------------------------------------------------------------------ step list

enum class StepState { Done, Active, Todo }

data class Step(val label: String, val state: StepState, val meta: String? = null)

/** `og-step-list` with done box, active spinner or pulse dot, and empty todo box. */
@Composable
fun StepList(steps: List<Step>, compact: Boolean = false, spinner: Boolean = true) {
    Column(
        modifier = Modifier
            .padding(start = 16.dp, top = if (compact) 24.dp else 26.dp, end = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(Og.rCard))
            .background(Og.surface2)
            .border(1.dp, Og.line, RoundedCornerShape(Og.rCard))
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        steps.forEachIndexed { i, step ->
            Row(
                Modifier.fillMaxWidth().heightIn(min = 52.dp).semantics {
                    stateDescription = when (step.state) {
                        StepState.Done -> "erledigt"
                        StepState.Active -> "läuft"
                        StepState.Todo -> "offen"
                    }
                },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(Modifier.size(26.dp), contentAlignment = Alignment.Center) {
                    when (step.state) {
                        StepState.Done -> Box(
                            Modifier.size(26.dp).clip(RoundedCornerShape(Og.rXs)).background(Og.accent),
                            contentAlignment = Alignment.Center,
                        ) { OgIconView(OgIcon.Check, Og.onAccent) }
                        StepState.Active -> if (spinner) Spinner() else PulseDot()
                        StepState.Todo -> Box(Modifier.size(26.dp).border(1.5.dp, Og.borderMuted, RoundedCornerShape(9.dp)))
                    }
                }
                Text(
                    step.label,
                    modifier = Modifier.weight(1f),
                    style = TextStyle(
                        fontFamily = Grotesk, fontSize = 15.sp,
                        fontWeight = FontWeight(if (step.state == StepState.Active) 600 else 400),
                        color = if (step.state == StepState.Todo) Og.text3 else Og.text,
                    ),
                )
                if (step.meta != null) {
                    Text(step.meta, style = OgType.meta.copy(color = if (step.state == StepState.Active) Og.accent else Og.text3))
                }
            }
            if (i < steps.lastIndex) CardDivider()
        }
    }
}

@Composable
fun Spinner(size: Dp = 18.dp) {
    val transition = rememberInfiniteTransition(label = "spin")
    val angle by transition.animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "angle")
    Canvas(Modifier.size(size)) {
        val stroke = 2.5.dp.toPx()
        drawCircle(Og.borderMuted, radius = this.size.minDimension / 2 - stroke / 2, style = Stroke(stroke))
        drawArc(Og.accent, angle - 90f, 90f, false, style = Stroke(stroke),
            topLeft = Offset(stroke / 2, stroke / 2), size = Size(this.size.width - stroke, this.size.height - stroke))
    }
}

@Composable
private fun PulseDot() {
    val transition = rememberInfiniteTransition(label = "pulse")
    val t by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(1600), RepeatMode.Restart), label = "t")
    Canvas(Modifier.size(32.dp)) {
        val base = 6.dp.toPx()
        drawCircle(Og.accentPulse.copy(alpha = 0.55f * (1 - t)), radius = base + 10.dp.toPx() * t)
        drawCircle(Og.accent, radius = base)
    }
}

// ------------------------------------------------------------------ inputs

/** `og-text-field`: label above, 46 high input on the darker input colour, accent border on focus. */
@Composable
fun OgTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    password: Boolean = false,
    optional: Boolean = false,
    hint: String? = null,
    error: String? = null,
    onBlur: () -> Unit = {},
) {
    var focused by remember { mutableStateOf(false) }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            buildAnnotatedString {
                append(label)
                if (optional) withStyle(SpanStyle(color = Og.text3)) { append(" (optional)") }
            },
            style = TextStyle(fontFamily = Grotesk, fontSize = 13.sp, color = Og.text2),
        )
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = TextStyle(fontFamily = Grotesk, fontSize = 16.sp, color = Og.text, letterSpacing = if (password) 2.sp else 0.sp),
            cursorBrush = SolidColor(Og.accent),
            visualTransformation = if (password) PasswordVisualTransformation('•') else VisualTransformation.None,
            keyboardOptions = if (password) KeyboardOptions(keyboardType = KeyboardType.Password) else KeyboardOptions.Default,
            modifier = Modifier
                .fillMaxWidth()
                .height(Og.inputH)
                .onFocusChanged {
                    if (focused && !it.isFocused) onBlur()
                    focused = it.isFocused
                }
                .semantics { contentDescription = label },
            decorationBox = { inner ->
                Box(
                    Modifier.fillMaxWidth().height(Og.inputH).clip(RoundedCornerShape(Og.rInput)).background(Og.input)
                        .border(1.dp, if (focused) Og.accent else Og.border, RoundedCornerShape(Og.rInput))
                        .padding(horizontal = 14.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (value.isEmpty() && placeholder != null) {
                        Text(placeholder, style = TextStyle(fontFamily = Grotesk, fontSize = 16.sp, color = Og.placeholder))
                    }
                    inner()
                }
            },
        )
        if (error != null) Text(error, style = OgType.help.copy(color = Og.danger))
        else if (hint != null) Text(hint, style = OgType.help)
    }
}

/** `og-switch`: 52x32 track, 26 knob. */
@Composable
fun OgSwitch(checked: Boolean, onCheckedChange: (Boolean) -> Unit, label: String) {
    Box(
        Modifier
            .size(52.dp, 32.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (checked) Og.accent else Og.signalOff)
            .clickable(role = Role.Switch) { onCheckedChange(!checked) }
            .semantics { contentDescription = label; stateDescription = if (checked) "an" else "aus" }
            .padding(3.dp),
        contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(Modifier.size(26.dp).clip(CircleShape).background(if (checked) Og.onAccent else Og.text3))
    }
}

/** `og-segmented`: two tabs, the active one on light ground. */
@Composable
fun OgSegmented(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Row(
        Modifier
            .padding(start = 16.dp, top = 8.dp, end = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Og.surface)
            .border(1.dp, Og.border, RoundedCornerShape(16.dp))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEach { (value, label) ->
            val active = value == selected
            Box(
                Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(12.dp))
                    .background(if (active) Og.text else Color.Transparent)
                    .clickable(role = Role.Tab) { onSelect(value) }
                    .semantics { this.selected = active },
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = TextStyle(fontFamily = Grotesk, fontSize = 15.sp, fontWeight = FontWeight(if (active) 700 else 500),
                    color = if (active) Og.bg else Og.text2))
            }
        }
    }
}

/** `og-check-row` for the member picker. */
@Composable
fun CheckRow(name: String, pattern: BooleanArray?, checked: Boolean, enabled: Boolean, last: Boolean, onToggle: () -> Unit) {
    Column {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 64.dp).alpha(if (enabled) 1f else 0.4f)
                .clickable(enabled = enabled, role = Role.Checkbox, onClick = onToggle)
                .semantics { stateDescription = if (checked) "ausgewählt" else "nicht ausgewählt" }
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            OgAvatar(pattern, 40.dp)
            Text(name, modifier = Modifier.weight(1f), style = TextStyle(fontFamily = Grotesk, fontSize = 16.sp, fontWeight = FontWeight(600), color = Og.text))
            if (checked) {
                Box(Modifier.size(24.dp).clip(RoundedCornerShape(7.dp)).background(Og.accent), contentAlignment = Alignment.Center) {
                    OgIconView(OgIcon.Check, Og.onAccent)
                }
            } else {
                Box(Modifier.size(24.dp).border(1.5.dp, Og.borderMuted, RoundedCornerShape(7.dp)))
            }
        }
        if (!last) CardDivider()
    }
}

/** Fixed footer area for the primary page action: padding 12 16 26. */
@Composable
fun Footer(top: Dp = 12.dp, content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(PaddingValues(start = 16.dp, top = top, end = 16.dp, bottom = 26.dp)),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

@Composable
fun CenteredBody(text: String, modifier: Modifier = Modifier, color: Color = Og.text2) {
    Text(text, modifier = modifier, style = OgType.body2.copy(color = color, textAlign = TextAlign.Center))
}

/** Dashed border for queued bubbles (`1.5px dashed accent`). */
fun Modifier.dashedBorder(color: Color, width: Dp, radius: Dp, dash: Dp = 6.dp, gapLen: Dp = 4.dp): Modifier = drawBehind {
    val stroke = width.toPx()
    drawRoundRect(
        color = color,
        topLeft = Offset(stroke / 2, stroke / 2),
        size = Size(size.width - stroke, size.height - stroke),
        cornerRadius = CornerRadius(radius.toPx(), radius.toPx()),
        style = Stroke(width = stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash.toPx(), gapLen.toPx()))),
    )
}
