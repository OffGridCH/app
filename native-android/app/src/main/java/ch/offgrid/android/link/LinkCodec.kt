package ch.offgrid.android.link

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.longOrNull
import kotlin.math.roundToInt

/** Error object of a failed response (link spec 4.2). */
data class LinkError(val code: String, val message: String?, val field: String?)

/** A line received from the device (link spec section 4). */
sealed interface Incoming {
    /** Response to a request. `id` is null for `E_PARSE` answers. */
    data class Response(
        val id: Long?,
        val ok: Boolean,
        val result: JsonObject,
        val error: LinkError?,
    ) : Incoming

    /** Asynchronous event. `t` is the device uptime in ms. */
    data class Event(val name: String, val t: Long?, val data: JsonObject) : Incoming
}

/** A request from the app (app to device), used by the simulator to decode commands. */
data class Request(val id: Long, val cmd: String, val args: JsonObject)

class LineTooLongException(bytes: Int) : IllegalArgumentException("line is $bytes bytes, max is $MAX_LINE_BYTES")

/** Encodes and decodes the three line kinds of the link protocol. */
object LinkCodec {
    /** Compact JSON without pretty printing; string escaping guarantees no raw newline in a line. */
    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = true
        encodeDefaults = true
    }

    fun encodeRequest(id: Long, cmd: String, args: JsonObject? = null): ByteArray = finish(
        buildJsonObject {
            put("id", JsonPrimitive(id))
            put("cmd", JsonPrimitive(cmd))
            if (args != null) put("args", args)
        },
    )

    fun encodeResponseOk(id: Long?, result: JsonObject): ByteArray = finish(
        buildJsonObject {
            put("id", id?.let(::JsonPrimitive) ?: JsonNull)
            put("ok", JsonPrimitive(true))
            put("result", result)
        },
    )

    fun encodeResponseError(id: Long?, code: String, message: String, field: String? = null): ByteArray = finish(
        buildJsonObject {
            if (id != null) put("id", JsonPrimitive(id))
            put("ok", JsonPrimitive(false))
            put(
                "error",
                buildJsonObject {
                    put("code", JsonPrimitive(code))
                    put("message", JsonPrimitive(message))
                    if (field != null) put("field", JsonPrimitive(field))
                },
            )
        },
    )

    fun encodeEvent(name: String, t: Long, data: JsonObject): ByteArray = finish(
        buildJsonObject {
            put("evt", JsonPrimitive(name))
            put("t", JsonPrimitive(t))
            put("data", data)
        },
    )

    private fun finish(obj: JsonObject): ByteArray {
        val bytes = (json.encodeToString(JsonObject.serializer(), obj) + "\n").toByteArray(Charsets.UTF_8)
        if (bytes.size > MAX_LINE_BYTES) throw LineTooLongException(bytes.size)
        return bytes
    }

    /** Decodes a device line. Returns null when the line is not valid JSON or has no known shape. */
    fun decodeIncoming(line: String): Incoming? {
        val obj = parseObject(line) ?: return null
        val evt = obj["evt"]?.stringOrNull()
        if (evt != null) {
            return Incoming.Event(evt, obj["t"]?.longOrNullSafe(), obj["data"].asObject())
        }
        val ok = (obj["ok"] as? JsonPrimitive)?.booleanOrNull ?: return null
        val error = (obj["error"] as? JsonObject)?.let {
            LinkError(
                code = it["code"]?.stringOrNull() ?: "E_INTERNAL",
                message = it["message"]?.stringOrNull(),
                field = it["field"]?.stringOrNull(),
            )
        }
        return Incoming.Response(obj["id"]?.longOrNullSafe(), ok, obj["result"].asObject(), error)
    }

    /** Decodes an app request line (used by the simulated firmware). */
    fun decodeRequest(line: String): Request? {
        val obj = parseObject(line) ?: return null
        val id = obj["id"]?.longOrNullSafe() ?: return null
        val cmd = obj["cmd"]?.stringOrNull() ?: return null
        return Request(id, cmd, obj["args"].asObject())
    }

    private fun parseObject(line: String): JsonObject? = try {
        json.parseToJsonElement(line) as? JsonObject
    } catch (_: IllegalArgumentException) {
        null
    }
}

internal fun JsonElement?.asObject(): JsonObject = (this as? JsonObject) ?: JsonObject(emptyMap())

internal fun JsonElement.stringOrNull(): String? = (this as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull

internal fun JsonElement.longOrNullSafe(): Long? = (this as? JsonPrimitive)?.takeIf { !it.isString }?.longOrNull

/** Typed accessors that respect the spec rule "types are strict, so "5" is not 5". */
fun JsonObject.str(key: String): String? = this[key]?.takeIf { it !is JsonNull }?.stringOrNull()
fun JsonObject.long(key: String): Long? = this[key]?.takeIf { it !is JsonNull }?.longOrNullSafe()
fun JsonObject.int(key: String): Int? = long(key)?.toInt()
fun JsonObject.double(key: String): Double? =
    (this[key] as? JsonPrimitive)?.takeIf { !it.isString && it !is JsonNull }?.content?.toDoubleOrNull()
/**
 * A signal value in whole dB. The firmware writes RSSI as a float (`"rssi": -91.5`, `Contacts::View::rssi`),
 * which [int] rejects as not an integer.
 */
fun JsonObject.dbm(key: String): Int? = double(key)?.roundToInt()
fun JsonObject.bool(key: String): Boolean? = (this[key] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
fun JsonObject.obj(key: String): JsonObject? = this[key] as? JsonObject
fun JsonObject.isNull(key: String): Boolean = this[key] is JsonNull

