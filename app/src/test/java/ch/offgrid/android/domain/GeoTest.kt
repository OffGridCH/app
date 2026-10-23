package ch.offgrid.android.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class GeoTest {
    // Own position and Anna's position from the design ("1.2 km", "Richtung Nordosten · 42°").
    private val me = 47.05021 to 8.30934
    private val anna = 47.05812 to 8.31998

    @Test
    fun distanceAndBearingMatchTheDesign() {
        val d = Geo.distanceMeters(me.first, me.second, anna.first, anna.second)
        assertEquals("1.2 km", Geo.formatDistance(d))
        val b = Geo.bearingDegrees(me.first, me.second, anna.first, anna.second)
        assertEquals(42.0, b, 1.0)
        assertEquals("Nordosten", Geo.compassName(b))
    }

    @Test
    fun formatsCoordinatesAndDistances() {
        assertEquals("47.05812° N, 8.31998° O", Geo.formatCoordinate(anna.first, anna.second))
        assertEquals("±8 m", Geo.formatAccuracy(8))
        assertEquals("340 m", Geo.formatDistance(338.0))
        assertEquals("12 km", Geo.formatDistance(12_340.0))
        assertEquals("Norden", Geo.compassName(355.0))
    }

    @Test
    fun bandShowsTheDesignValue() {
        assertEquals("868", Formats.band(869.525))
    }
}
