package ch.offgrid.android.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The design system's inline SVG icons (24x24 viewBox, round caps and joins), rebuilt as
 * [ImageVector]s from the same path data. Size and stroke width per icon follow the spec table.
 */
enum class OgIcon(val size: Dp, val stroke: Float, vararg val paths: String) {
    Back(22.dp, 2f, "M15 5l-7 7 7 7"),
    Plus(20.dp, 2f, "M12 5v14", "M5 12h14"),
    Settings(20.dp, 2f, "M4 7h10", "M18 7h2", circle(16f, 7f, 2f), "M4 17h2", "M10 17h10", circle(8f, 17f, 2f)),
    Send(22.dp, 2.2f, "M12 19V5", "M6 11l6-6 6 6"),
    Check(14.dp, 3f, "M5 12l5 5 9-10"),
    Qr(20.dp, 2.2f, rect(3f, 3f, 7f, 7f, 1.5f), rect(14f, 3f, 7f, 7f, 1.5f), rect(3f, 14f, 7f, 7f, 1.5f), "M14 14h3v3", "M21 14v7h-7"),
    Antenna(
        22.dp, 2f, "M12 13v8", circle(12f, 11f, 2f), "M7.8 6.8a6 6 0 0 0 0 8.4", "M16.2 6.8a6 6 0 0 1 0 8.4",
        "M5 4a10 10 0 0 0 0 14", "M19 4a10 10 0 0 1 0 14",
    ),
    Upload(22.dp, 2f, "M12 15V3", "M7 8l5-5 5 5", "M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"),
    Download(22.dp, 2f, "M12 3v12", "M7 10l5 5 5-5", "M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"),
    File(20.dp, 2f, "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5"),
    Info(18.dp, 2f, circle(12f, 12f, 9f), "M12 8v5", "M12 16.5v.01"),
    Warning(18.dp, 2f, "M12 3l9.5 17h-19z", "M12 10v4", "M12 17v.01"),
    Pin(22.dp, 2f, "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z", circle(12f, 10f, 2.5f)),
    Map(20.dp, 2.2f, "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z", "M9 4v14", "M15 6v14"),
    Copy(20.dp, 2f, rect(8f, 8f, 12f, 12f, 2f), "M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"),
    Refresh(18.dp, 2f, "M20 11a8 8 0 1 0-2.3 5.7", "M20 4v7h-7"),
    Users(20.dp, 2f, circle(9f, 8f, 3.5f), "M2.5 20a6.5 6.5 0 0 1 13 0", "M16 4.5a3.5 3.5 0 0 1 0 7", "M18 14.5a6.5 6.5 0 0 1 3.5 5.5"),
    ;

    val vector: ImageVector by lazy { build(stroke) }

    private val variants = HashMap<Float, ImageVector>()

    /** The same icon with another stroke width; a few places in the design draw an icon bolder. */
    fun vector(strokeWidth: Float): ImageVector =
        if (strokeWidth == stroke) vector else synchronized(variants) { variants.getOrPut(strokeWidth) { build(strokeWidth) } }

    private fun build(strokeWidth: Float) = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply {
        paths.forEach { d ->
            addPath(
                pathData = PathParser().parsePathString(d).toNodes(),
                stroke = SolidColor(Color.Black),
                strokeLineWidth = strokeWidth,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
    }.build()
}

/** Filled direction arrow used in location bubbles. */
val DirectionArrow: ImageVector by lazy {
    ImageVector.Builder("arrow", 24.dp, 24.dp, 24f, 24f).apply {
        addPath(PathParser().parsePathString("M12 3l5.5 15L12 15l-5.5 3z").toNodes(), fill = SolidColor(Color.Black))
    }.build()
}

private fun circle(cx: Float, cy: Float, r: Float) = "M${cx - r} $cy a$r $r 0 1 0 ${2 * r} 0 a$r $r 0 1 0 ${-2 * r} 0"

private fun rect(x: Float, y: Float, w: Float, h: Float, r: Float) =
    "M${x + r} ${y}h${w - 2 * r}a$r $r 0 0 1 $r ${r}v${h - 2 * r}a$r $r 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a$r $r 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a$r $r 0 0 1 $r ${-r}z"

@Composable
fun OgIconView(icon: OgIcon, tint: Color, modifier: Modifier = Modifier, size: Dp = icon.size, strokeWidth: Float = icon.stroke) {
    Icon(imageVector = icon.vector(strokeWidth), contentDescription = null, tint = tint, modifier = modifier.size(size))
}
