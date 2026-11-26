package com.anwar.mofakira.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

class LocalPrayerCalculatorTest {
    private fun minutes(value: LocalTime): Int = value.hour * 60 + value.minute

    @Test
    fun meknesMatchesPublishedNovember2026TimesWithinOneMinute() {
        val official = listOf(
            "05:12,06:36,12:11,15:07,17:36,18:49",
            "05:13,06:37,12:11,15:06,17:35,18:49",
            "05:13,06:38,12:11,15:06,17:34,18:48",
            "05:14,06:39,12:11,15:05,17:33,18:47",
            "05:15,06:40,12:11,15:04,17:32,18:46",
            "05:16,06:41,12:11,15:04,17:31,18:46",
            "05:16,06:42,12:11,15:03,17:31,18:45",
            "05:17,06:43,12:11,15:02,17:30,18:44",
            "05:18,06:44,12:11,15:02,17:29,18:44",
            "05:19,06:45,12:11,15:01,17:28,18:43",
            "05:20,06:45,12:11,15:01,17:28,18:42",
            "05:20,06:46,12:11,15:00,17:27,18:42",
            "05:21,06:47,12:12,15:00,17:26,18:41",
            "05:22,06:48,12:12,14:59,17:26,18:41",
            "05:23,06:49,12:12,14:59,17:25,18:40",
            "05:24,06:50,12:12,14:58,17:24,18:40",
            "05:24,06:51,12:12,14:58,17:24,18:40",
            "05:25,06:52,12:12,14:57,17:23,18:39",
            "05:26,06:53,12:13,14:57,17:23,18:39",
            "05:27,06:54,12:13,14:57,17:22,18:38",
            "05:28,06:55,12:13,14:56,17:22,18:38",
            "05:28,06:56,12:13,14:56,17:22,18:38",
            "05:29,06:57,12:14,14:56,17:21,18:38",
            "05:30,06:58,12:14,14:56,17:21,18:37",
            "05:31,06:58,12:14,14:55,17:21,18:37",
            "05:32,06:59,12:15,14:55,17:20,18:37",
            "05:32,07:00,12:15,14:55,17:20,18:37",
            "05:33,07:01,12:15,14:55,17:20,18:37",
            "05:34,07:02,12:16,14:55,17:20,18:37",
            "05:35,07:03,12:16,14:55,17:20,18:37"
        )
        val keys = listOf("Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha")
        var worst = 0
        official.forEachIndexed { index, row ->
            val date = LocalDate.of(2026, 11, index + 1)
            val actual = LocalPrayerCalculator.calculateDay("Morocco", "Meknes", "21", "0", date)
            val expected = row.split(",").map { LocalTime.parse(it) }
            keys.forEachIndexed { column, key ->
                val difference = kotlin.math.abs(minutes(actual.getValue(key)) - minutes(expected[column]))
                worst = maxOf(worst, difference)
            }
        }
        assertTrue("Maximum difference was $worst minute(s)", worst <= 1)
    }

    @Test
    fun arabicCityAliasesResolveLocally() {
        val english = LocalPrayerCalculator.calculateDay("Morocco", "Meknes", "21", "0", LocalDate.of(2026, 11, 26))
        val arabic = LocalPrayerCalculator.calculateDay("المغرب", "مكناس", "21", "0", LocalDate.of(2026, 11, 26))
        assertEquals(english, arabic)
        assertEquals("Africa/Casablanca", LocalPrayerCalculator.timeZone("Morocco", "Meknes")?.id)
    }

    @Test(expected = IllegalArgumentException::class)
    fun unsupportedCityFailsClosedInsteadOfRequestingNetworkFallback() {
        LocalPrayerCalculator.calculateDay("Morocco", "مدينة غير مدرجة", "21", "0", LocalDate.of(2026, 11, 26))
    }
}
