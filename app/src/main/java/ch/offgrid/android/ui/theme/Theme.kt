package ch.offgrid.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import ch.offgrid.android.R

/** Design tokens, 1:1 from the team's `tokens.scss`. There is only a dark theme. */
object Og {
    val bg = Color(0xFF0F1115)
    val surface = Color(0xFF1A1D24)
    val surface2 = Color(0xFF15181E)
    val bar = Color(0xFF13161B)
    val input = Color(0xFF0F1115)
    val scrim = Color(0xB80A0C0F)

    val line = Color(0xFF262A33)
    val border = Color(0xFF2C313B)
    val borderMuted = Color(0xFF3D4350)
    val dashed = Color(0xFF4A5060)

    val text = Color(0xFFEEF0F5)
    val text2 = Color(0xFFC5CAD6)
    val text3 = Color(0xFF959CAB)
    val placeholder = Color(0xFF8A91A0)

    val accent = Color(0xFF9DB4FF)
    val onAccent = Color(0xFF0B1020)
    val accentSoft = Color(0xFF232B45)
    val accentPulse = Color(0x8C9DB4FF)

    val signalOff = Color(0xFF2E3440)
    val ok = Color(0xFF7FD6A4)

    val danger = Color(0xFFFF8F87)
    val dangerTitle = Color(0xFFFFB4AD)
    val dangerText = Color(0xFFE8D6D3)
    val dangerBg = Color(0xFF2A2220)
    val dangerBorder = Color(0xFF4A3330)

    // Radii
    val rXs = 9.dp
    val rSm = 10.dp
    val rMd = 12.dp
    val rInput = 14.dp
    val rBtn2 = 16.dp
    val rBtn = 18.dp
    val rCard = 20.dp
    val rQr = 28.dp

    // Spacing and sizes
    val gutter = 16.dp
    val gutterText = 24.dp
    val gutterTitle = 20.dp
    val btnH = 54.dp
    val btn2H = 48.dp
    val inputH = 46.dp
    val rowMin = 52.dp
}

@OptIn(ExperimentalTextApi::class)
private fun variable(res: Int, weight: Int) =
    Font(res, FontWeight(weight), variationSettings = FontVariation.Settings(FontVariation.weight(weight)))

/** Schibsted Grotesk (variable) and Geist Mono, bundled so the app works offline (OFL licensed). */
val Grotesk = FontFamily(listOf(400, 500, 600, 650, 700, 750, 800).map { variable(R.font.schibsted_grotesk, it) })
val Mono = FontFamily(listOf(400, 500, 600).map { variable(R.font.geist_mono, it) })

/** Text styles from the design system table ("Stil-Name"). */
object OgType {
    val display = TextStyle(fontFamily = Grotesk, fontSize = 32.sp, lineHeight = 1.1.em, fontWeight = FontWeight(800), letterSpacing = (-0.03).em, color = Og.text)
    val appTitle = TextStyle(fontFamily = Grotesk, fontSize = 30.sp, fontWeight = FontWeight(800), letterSpacing = (-0.03).em, color = Og.text)
    val hero = TextStyle(fontFamily = Grotesk, fontSize = 24.sp, fontWeight = FontWeight(750), letterSpacing = (-0.02).em, color = Og.text)
    val emptyTitle = TextStyle(fontFamily = Grotesk, fontSize = 22.sp, fontWeight = FontWeight(700), letterSpacing = (-0.01).em, color = Og.text)
    val pageTitle = TextStyle(fontFamily = Grotesk, fontSize = 20.sp, fontWeight = FontWeight(700), letterSpacing = (-0.01).em, color = Og.text)
    val chatName = TextStyle(fontFamily = Grotesk, fontSize = 17.sp, lineHeight = 1.2.em, fontWeight = FontWeight(650), color = Og.text)
    val bodyStrong = TextStyle(fontFamily = Grotesk, fontSize = 16.sp, fontWeight = FontWeight(650), color = Og.text)
    val body = TextStyle(fontFamily = Grotesk, fontSize = 16.sp, lineHeight = 1.4.em, fontWeight = FontWeight(400), color = Og.text)
    val body2 = TextStyle(fontFamily = Grotesk, fontSize = 15.sp, lineHeight = 1.5.em, fontWeight = FontWeight(400), color = Og.text2)
    val row = TextStyle(fontFamily = Grotesk, fontSize = 15.sp, fontWeight = FontWeight(400), color = Og.text2)
    val preview = TextStyle(fontFamily = Grotesk, fontSize = 14.sp, fontWeight = FontWeight(400), color = Og.text3)
    val help = TextStyle(fontFamily = Grotesk, fontSize = 13.sp, lineHeight = 1.4.em, fontWeight = FontWeight(400), color = Og.text3)
    val meta = TextStyle(fontFamily = Mono, fontSize = 11.sp, fontWeight = FontWeight(400), color = Og.text3)
    val section = TextStyle(fontFamily = Mono, fontSize = 11.sp, fontWeight = FontWeight(500), letterSpacing = 0.12.em, color = Og.text3)
    val value = TextStyle(fontFamily = Mono, fontSize = 13.sp, fontWeight = FontWeight(400), color = Og.text)
}

@Composable
fun OffGridTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            background = Og.bg, surface = Og.surface, primary = Og.accent, onPrimary = Og.onAccent,
            onBackground = Og.text, onSurface = Og.text, error = Og.danger,
        ),
        content = content,
    )
}
