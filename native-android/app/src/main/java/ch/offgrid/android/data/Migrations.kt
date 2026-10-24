package ch.offgrid.android.data

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * 1 to 2: `messages.refSession` for the reconnect reconciliation (see `OutboxReconciler`).
 *
 * Version 1 cleared the refs of sent messages whenever the antenna restarted, which left them at
 * "gesendet" for good although nobody knew whether they arrived. Those direct messages become
 * "Nicht zugestellt" (reason `lost`) so they can be sent again. Group messages keep "gesendet": without
 * an end-to-end ACK that is their final state.
 */
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE messages ADD COLUMN refSession TEXT")
        db.execSQL(
            "UPDATE messages SET status = 4, failReason = 'lost' " +
                "WHERE direction = 'out' AND groupId IS NULL AND msgRef IS NULL AND status IN (1, 2)",
        )
    }
}

/** 2 to 3: delivery and signal details per message for the details sheet, and "zugestellt, während offline". */
val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        listOf("snr REAL", "hops INTEGER", "retry INTEGER", "rttMs INTEGER", "compressed INTEGER", "bytesOnAir INTEGER",
            "airtimeMs INTEGER", "deviceState TEXT", "deliveredOffline INTEGER NOT NULL DEFAULT 0")
            .forEach { db.execSQL("ALTER TABLE messages ADD COLUMN $it") }
    }
}
