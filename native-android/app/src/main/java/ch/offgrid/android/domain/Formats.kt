package ch.offgrid.android.domain

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.roundToLong
import kotlin.math.sin
import kotlin.math.sqrt

/** Display formats from the screen spec ("Zeit- und Funkformate"), always Europe/Zurich and de-CH. */
object Formats {
    val ZONE: ZoneId = ZoneId.of("Europe/Zurich")
    val LOCALE: Locale = Locale.forLanguageTag("de-CH")
    private val HM = DateTimeFormatter.ofPattern("HH:mm", LOCALE)
    private val DMY_SHORT = DateTimeFormatter.ofPattern("dd.MM.yy", LOCALE)
    private val DM = DateTimeFormatter.ofPattern("dd.MM.", LOCALE)
    private val DMY = DateTimeFormatter.ofPattern("dd.MM.yyyy", LOCALE)
    private val WEEKDAYS = listOf("Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So.")

    private fun date(ms: Long): LocalDate = Instant.ofEpochMilli(ms).atZone(ZONE).toLocalDate()
    private fun daysAgo(ms: Long, now: Long): Long = ChronoUnit.DAYS.between(date(ms), date(now))

    fun time(ms: Long): String = Instant.ofEpochMilli(ms).atZone(ZONE).format(HM)

    fun listTime(ms: Long, now: Long): String = when (val d = daysAgo(ms, now)) {
        0L -> time(ms)
        1L -> "Gestern"
        in 2L..6L -> WEEKDAYS[date(ms).dayOfWeek.value - 1]
        else -> if (d < 0) time(ms) else Instant.ofEpochMilli(ms).atZone(ZONE).format(DMY_SHORT)
    }

    fun lastSeen(ms: Long?, now: Long): String = when {
        ms == null -> "noch nie empfangen"
        daysAgo(ms, now) <= 0L -> "zuletzt ${time(ms)}"
        daysAgo(ms, now) == 1L -> "zuletzt gestern"
        else -> "zuletzt ${Instant.ofEpochMilli(ms).atZone(ZONE).format(DM)}"
    }

    fun day(ms: Long, now: Long): String = when (daysAgo(ms, now)) {
        0L -> "HEUTE"
        1L -> "GESTERN"
        else -> Instant.ofEpochMilli(ms).atZone(ZONE).format(DMY)
    }

    fun sameDay(a: Long, b: Long): Boolean = date(a) == date(b)

    /**
     * The status line shows the band ("868 MHz" = EU868, 863 to 870 MHz) like the design; the
     * settings row shows the exact carrier, for example 869.525 MHz (link spec default).
     */
    fun band(freqMhz: Double): String = if (freqMhz in 863.0..870.0) "868" else freqMhz.toInt().toString()

    fun exactMhz(freqMhz: Double): String =
        String.format(LOCALE, "%.3f", freqMhz).trimEnd('0').trimEnd('.')

    /** Signal level 0..4 from the last RSSI; older than 15 minutes counts as out of range. */
    fun signalLevel(rssi: Int?, lastSeen: Long?, now: Long): Int {
        if (rssi == null || lastSeen == null || now - lastSeen > 15 * 60_000) return 0
        return when {
            rssi >= -80 -> 4
            rssi >= -95 -> 3
            rssi >= -105 -> 2
            else -> 1
        }
    }

    fun signalLabel(level: Int): String = when (level) {
        4 -> "Signal sehr gut"
        3 -> "Signal gut"
        2 -> "Signal mittel"
        1 -> "Signal schwach"
        else -> "Ausser Reichweite"
    }
}

data class GeoFix(val latitude: Double, val longitude: Double, val accuracyM: Int, val at: Long)

/** Pure geo helpers from the location spec, with tests. */
object Geo {
    private const val EARTH_RADIUS_M = 6_371_000.0
    private val COMPASS = listOf("Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten")

    fun distanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val p1 = Math.toRadians(lat1)
        val p2 = Math.toRadians(lat2)
        val dp = Math.toRadians(lat2 - lat1)
        val dl = Math.toRadians(lon2 - lon1)
        val a = sin(dp / 2) * sin(dp / 2) + cos(p1) * cos(p2) * sin(dl / 2) * sin(dl / 2)
        return 2 * EARTH_RADIUS_M * atan2(sqrt(a), sqrt(1 - a))
    }

    /** Initial bearing 0 to 359.9, 0 = north, clockwise. */
    fun bearingDegrees(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val p1 = Math.toRadians(lat1)
        val p2 = Math.toRadians(lat2)
        val dl = Math.toRadians(lon2 - lon1)
        val y = sin(dl) * cos(p2)
        val x = cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dl)
        return (Math.toDegrees(atan2(y, x)) + 360) % 360
    }

    fun compassName(deg: Double): String = COMPASS[(((deg % 360) + 360) % 360 / 45.0).roundToInt() % 8]

    fun formatDistance(m: Double): String {
        val r = (m / 10).roundToLong() * 10
        if (r < 1000) return "$r m"
        val k = (m / 100).roundToLong() / 10.0
        return if (k < 10) String.format(Formats.LOCALE, "%.1f km", k) else "${k.roundToLong()} km"
    }

    fun formatCoordinate(lat: Double, lon: Double): String =
        String.format(Formats.LOCALE, "%.5f° %s, %.5f° %s", abs(lat), if (lat < 0) "S" else "N", abs(lon), if (lon < 0) "W" else "O")

    fun formatLat(lat: Double): String = String.format(Formats.LOCALE, "%.5f° %s", abs(lat), if (lat < 0) "S" else "N")
    fun formatLon(lon: Double): String = String.format(Formats.LOCALE, "%.5f° %s", abs(lon), if (lon < 0) "W" else "O")

    fun formatCoordinatePlain(lat: Double, lon: Double): String = String.format(Locale.ROOT, "%.5f, %.5f", lat, lon)

    fun formatAccuracy(m: Int): String = "±${m.coerceAtLeast(1)} m"

    fun formatAgo(ms: Long, now: Long): String {
        val minutes = (now - ms) / 60_000
        return when {
            minutes < 1 -> "gerade eben"
            minutes < 60 -> "vor $minutes Min."
            minutes < 24 * 60 -> "vor ${minutes / 60} Std."
            else -> Formats.listTime(ms, now)
        }
    }
}
