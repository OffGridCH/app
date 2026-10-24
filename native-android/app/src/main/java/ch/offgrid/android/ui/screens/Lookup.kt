package ch.offgrid.android.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavHostController
import ch.offgrid.android.ui.back
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * A database row a screen is about. Room emits null once the row is gone (deleted, or a stale id
 * restored after process death); [Loading] keeps that apart from "not loaded yet".
 */
sealed interface Lookup<out T> {
    data object Loading : Lookup<Nothing>
    data object Gone : Lookup<Nothing>
    data class Found<T>(val value: T) : Lookup<T>
}

fun <T : Any> Flow<T?>.asLookup(): Flow<Lookup<T>> = map { if (it == null) Lookup.Gone else Lookup.Found(it) }

val <T> Lookup<T>.found: T? get() = if (this is Lookup.Found) value else null

/**
 * Leaves a screen whose subject is gone instead of showing it empty. It pops only while this screen
 * is the top of the back stack, so a back press at the same moment does not pop twice.
 */
@Composable
fun LeaveWhenGone(gone: Boolean, nav: NavHostController) {
    val owner = LocalLifecycleOwner.current
    LaunchedEffect(gone) {
        if (gone && nav.currentBackStackEntry === owner) nav.back()
    }
}
