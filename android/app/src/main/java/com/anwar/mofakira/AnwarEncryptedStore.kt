package com.anwar.mofakira

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Small encrypted store for private Android preferences.
 *
 * The Android Keystore protects a non-exportable AES-256 key. Values are
 * authenticated with their namespace as AAD. Legacy plaintext values are
 * removed only after the encrypted replacement has been committed and read
 * back successfully.
 */
object AnwarEncryptedStore {
    private const val STORE_FILE = "anwar_encrypted_preferences_v1"
    private const val KEY_ALIAS = "anwar_private_preferences_aes_gcm_v1"
    private const val FORMAT = "anwar-private-preferences"
    private const val VERSION = 1
    private const val MAX_PLAINTEXT_BYTES = 2 * 1024 * 1024

    @Synchronized
    fun read(context: Context, namespace: String): String? {
        require(namespace.isNotBlank()) { "Private storage namespace is required." }
        val envelope = context.getSharedPreferences(STORE_FILE, Context.MODE_PRIVATE)
            .getString(namespace, null) ?: return null
        val json = JSONObject(envelope)
        require(json.optString("format") == FORMAT && json.optInt("version", -1) == VERSION) {
            "صيغة التخزين المشفر غير مدعومة."
        }
        val iv = Base64.decode(json.getString("iv"), Base64.NO_WRAP)
        val ciphertext = Base64.decode(json.getString("ciphertext"), Base64.NO_WRAP)
        require(iv.size == 12 && ciphertext.size in 16..(MAX_PLAINTEXT_BYTES + 16)) {
            "بيانات التخزين المشفر غير صالحة."
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, getKey(context), GCMParameterSpec(128, iv))
        cipher.updateAAD(namespace.toByteArray(StandardCharsets.UTF_8))
        return String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8)
    }

    @Synchronized
    fun write(context: Context, namespace: String, plaintext: String) {
        require(namespace.isNotBlank()) { "Private storage namespace is required." }
        val plainBytes = plaintext.toByteArray(StandardCharsets.UTF_8)
        require(plainBytes.size <= MAX_PLAINTEXT_BYTES) { "حجم البيانات الخاصة يتجاوز الحد الآمن." }

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getKey(context))
        cipher.updateAAD(namespace.toByteArray(StandardCharsets.UTF_8))
        val ciphertext = cipher.doFinal(plainBytes)
        val envelope = JSONObject()
            .put("format", FORMAT)
            .put("version", VERSION)
            .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            .toString()

        val prefs = context.getSharedPreferences(STORE_FILE, Context.MODE_PRIVATE)
        val previous = prefs.getString(namespace, null)
        if (!prefs.edit().putString(namespace, envelope).commit()) {
            throw IllegalStateException("تعذّر تثبيت البيانات الخاصة المشفرة.")
        }
        try {
            val verified = read(context, namespace)
            if (verified != plaintext) throw IllegalStateException("لم تتطابق مراجعة التخزين المشفر.")
        } catch (error: Exception) {
            val rollback = prefs.edit()
            if (previous == null) rollback.remove(namespace) else rollback.putString(namespace, previous)
            rollback.commit()
            throw error
        } finally {
            plainBytes.fill(0)
        }
    }

    /**
     * Reads a single legacy string, encrypts it, verifies the new value,
     * then removes only that legacy key. A failed migration leaves plaintext
     * untouched and blocks writes at the caller.
     */
    @Synchronized
    fun readOrMigrate(
        context: Context,
        namespace: String,
        legacyPreferences: String,
        legacyKey: String,
        defaultValue: String? = null
    ): String? {
        val encrypted = read(context, namespace)
        if (encrypted != null) {
            val legacy = context.getSharedPreferences(legacyPreferences, Context.MODE_PRIVATE)
            if (legacy.getString(legacyKey, null) == encrypted) {
                if (!legacy.edit().remove(legacyKey).commit() || legacy.contains(legacyKey)) {
                    throw IllegalStateException("بقيت نسخة نصية قديمة؛ أعد فتح القسم لإكمال تنظيفها.")
                }
            }
            return encrypted
        }

        val legacy = context.getSharedPreferences(legacyPreferences, Context.MODE_PRIVATE)
        val plaintext = legacy.getString(legacyKey, null) ?: return defaultValue
        write(context, namespace, plaintext)
        if (read(context, namespace) != plaintext) {
            throw IllegalStateException("فشل التحقق من ترحيل البيانات القديمة؛ احتفظنا بالنسخة الأصلية.")
        }
        if (!legacy.edit().remove(legacyKey).commit() || legacy.contains(legacyKey)) {
            throw IllegalStateException("شُفّرت البيانات، لكن بقيت نسخة نصية قديمة. أعد فتح القسم لإكمال التنظيف.")
        }
        return plaintext
    }

    /**
     * Migrates all primitive values in a legacy SharedPreferences file to one
     * encrypted JSON document, then clears the old file after verification.
     */
    @Synchronized
    fun readPreferencesJson(
        context: Context,
        namespace: String,
        legacyPreferences: String
    ): String? {
        val encrypted = read(context, namespace)
        val legacy = context.getSharedPreferences(legacyPreferences, Context.MODE_PRIVATE)
        if (encrypted != null) {
            if (legacy.all.isNotEmpty()) {
                val legacyJson = preferencesToJson(legacy.all)
                if (legacyJson.toString() == encrypted &&
                    (!legacy.edit().clear().commit() || legacy.all.isNotEmpty())) {
                    throw IllegalStateException("بقيت نسخة نصية قديمة من الإعدادات. أعد فتح القسم لإكمال التنظيف.")
                }
            }
            return encrypted
        }
        if (legacy.all.isEmpty()) return null

        val plaintext = preferencesToJson(legacy.all).toString()
        write(context, namespace, plaintext)
        if (read(context, namespace) != plaintext) {
            throw IllegalStateException("فشل التحقق من ترحيل إعدادات القسم؛ احتفظنا بالنسخة الأصلية.")
        }
        if (!legacy.edit().clear().commit() || legacy.all.isNotEmpty()) {
            throw IllegalStateException("شُفّرت الإعدادات، لكن بقيت نسخة نصية قديمة. أعد فتح القسم لإكمال التنظيف.")
        }
        return plaintext
    }

    private fun preferencesToJson(values: Map<String, *>): JSONObject {
        val json = JSONObject()
        values.forEach { (key, value) ->
            when (value) {
                is String, is Boolean, is Int, is Long, is Float, is Double -> json.put(key, value)
                is Set<*> -> json.put(key, JSONArray(value.filterIsInstance<String>()))
                else -> Log.w("AnwarEncryptedStore", "Skipped unsupported legacy preference type for $key")
            }
        }
        return json
    }

    private fun getKey(context: Context): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}
