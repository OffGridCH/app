package ch.offgrid.android.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Test

class NewGroupTest {
    @Test
    fun ticksAndUnticksMembers() {
        assertEquals(listOf(1L, 2L), toggleMember(listOf(1L), 2L, max = 8))
        assertEquals(listOf(2L), toggleMember(listOf(1L, 2L), 1L, max = 8))
    }

    @Test
    fun aFullPickerOnlyAllowsUnticking() {
        val full = (1L..8L).toList()
        assertEquals(full, toggleMember(full, 9L, max = 8))
        assertEquals((2L..8L).toList(), toggleMember(full, 1L, max = 8))
    }
}
