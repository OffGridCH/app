package ch.offgrid.android.domain

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.math.roundToInt

enum class LocationError { DENIED, TIMEOUT, UNAVAILABLE, NO_MAPS_APP }

/**
 * Own GPS fix. GPS works without mobile network. With the simulated antenna the service returns
 * the fixed demo position from the design (47.05021, 8.30934, ±8 m) so the demo is reproducible.
 */
class LocationService(private val context: Context, private val simulated: () -> Boolean) {
    private val _fix = MutableStateFlow<GeoFix?>(null)
    val fix: StateFlow<GeoFix?> = _fix.asStateFlow()
    private val _locating = MutableStateFlow(false)
    val locating: StateFlow<Boolean> = _locating.asStateFlow()
    private val _error = MutableStateFlow<LocationError?>(null)
    val error: StateFlow<LocationError?> = _error.asStateFlow()

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    /** The simulated antenna comes with a demo position, so it needs no permission. */
    fun needsPermission(): Boolean = !simulated() && !hasPermission()

    suspend fun locate(): GeoFix? {
        _locating.value = true
        _error.value = null
        try {
            if (simulated()) {
                delay(600)
                return GeoFix(47.05021, 8.30934, 8, System.currentTimeMillis()).also { _fix.value = it }
            }
            if (!hasPermission()) {
                _error.value = LocationError.DENIED
                return null
            }
            val location = withTimeoutOrNull(20_000) { currentLocation() }
            if (location == null) {
                _error.value = LocationError.TIMEOUT
                return null
            }
            return GeoFix(location.latitude, location.longitude, location.accuracy.roundToInt().coerceAtLeast(1), location.time)
                .also { _fix.value = it }
        } catch (_: Exception) {
            _error.value = LocationError.UNAVAILABLE
            return null
        } finally {
            _locating.value = false
        }
    }

    /** A fix is used for distance and direction only while it is at most 10 minutes old. */
    fun isFresh(fix: GeoFix?, now: Long): Boolean = fix != null && now - fix.at <= 10 * 60_000

    @SuppressLint("MissingPermission") // checked in locate()
    private suspend fun currentLocation(): Location? = suspendCancellableCoroutine { cont ->
        val manager = context.getSystemService(LocationManager::class.java)
        val provider = when {
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> null
        }
        if (provider == null) {
            cont.resume(null)
            return@suspendCancellableCoroutine
        }
        val recent = manager.getLastKnownLocation(provider)?.takeIf { System.currentTimeMillis() - it.time < 30_000 }
        if (recent != null) {
            cont.resume(recent)
            return@suspendCancellableCoroutine
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            manager.getCurrentLocation(provider, null, ContextCompat.getMainExecutor(context)) { if (cont.isActive) cont.resume(it) }
        } else {
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    manager.removeUpdates(this)
                    if (cont.isActive) cont.resume(location)
                }
            }
            @Suppress("DEPRECATION")
            manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
            cont.invokeOnCancellation { manager.removeUpdates(listener) }
        }
    }
}
