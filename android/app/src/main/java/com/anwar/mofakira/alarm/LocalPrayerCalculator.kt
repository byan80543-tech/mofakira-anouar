package com.anwar.mofakira.alarm

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.text.Normalizer
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin
import kotlin.math.tan

/**
 * Offline port of the project's bundled PrayTime 3.2 engine.
 * City coordinates, IANA zones, calculation methods and Morocco calibration
 * intentionally mirror local-prayer-engine.js.
 */
object LocalPrayerCalculator {
    data class Place(
        val country: String,
        val city: String,
        val aliases: List<String>,
        val latitude: Double,
        val longitude: Double,
        val zone: String
    )

    private val places = listOf(
        Place("Morocco","Meknes",listOf("مكناس","Mequinez"),33.8935,-5.5473,"Africa/Casablanca"),
        Place("Morocco","Fes",listOf("فاس","Fez"),34.0331,-5.0003,"Africa/Casablanca"),
        Place("Morocco","Casablanca",listOf("الدار البيضاء"),33.5731,-7.5898,"Africa/Casablanca"),
        Place("Morocco","Rabat",listOf("الرباط"),34.0209,-6.8416,"Africa/Casablanca"),
        Place("Morocco","Tangier",listOf("طنجة","Tanger"),35.7595,-5.8340,"Africa/Casablanca"),
        Place("Morocco","Marrakech",listOf("مراكش","Marrakesh"),31.6295,-7.9811,"Africa/Casablanca"),
        Place("Morocco","Agadir",listOf("أكادير","اكادير"),30.4278,-9.5981,"Africa/Casablanca"),
        Place("Morocco","Oujda",listOf("وجدة"),34.6814,-1.9086,"Africa/Casablanca"),
        Place("Morocco","Tetouan",listOf("تطوان"),35.5889,-5.3626,"Africa/Casablanca"),
        Place("Morocco","Kenitra",listOf("القنيطرة"),34.2610,-6.5802,"Africa/Casablanca"),
        Place("Morocco","Safi",listOf("آسفي","اسفي"),32.2994,-9.2372,"Africa/Casablanca"),
        Place("Morocco","Taza",listOf("تازة"),34.2132,-4.0103,"Africa/Casablanca"),
        Place("Morocco","Al Hoceima",listOf("الحسيمة","Hoceima"),35.2493,-3.9371,"Africa/Casablanca"),
        Place("Morocco","Nador",listOf("الناظور"),35.1681,-2.9335,"Africa/Casablanca"),
        Place("Morocco","Beni Mellal",listOf("بني ملال"),32.3373,-6.3498,"Africa/Casablanca"),
        Place("Morocco","Khouribga",listOf("خريبكة"),32.8811,-6.9063,"Africa/Casablanca"),
        Place("Morocco","Settat",listOf("سطات"),33.0010,-7.6166,"Africa/Casablanca"),
        Place("Morocco","Berkane",listOf("بركان"),34.9204,-2.3196,"Africa/Casablanca"),
        Place("Morocco","Larache",listOf("العرائش"),35.1932,-6.1557,"Africa/Casablanca"),
        Place("Morocco","Essaouira",listOf("الصويرة"),31.5085,-9.7595,"Africa/Casablanca"),
        Place("Morocco","Taroudant",listOf("تارودانت"),30.4703,-8.8769,"Africa/Casablanca"),
        Place("Morocco","Guelmim",listOf("كلميم"),28.9870,-10.0574,"Africa/Casablanca"),
        Place("Morocco","Dakhla",listOf("الداخلة"),23.6848,-15.9579,"Africa/Casablanca"),
        Place("Algeria","Algiers",listOf("الجزائر","Alger"),36.7538,3.0588,"Africa/Algiers"),
        Place("Tunisia","Tunis",listOf("تونس"),36.8065,10.1815,"Africa/Tunis"),
        Place("Libya","Tripoli",listOf("طرابلس"),32.8872,13.1913,"Africa/Tripoli"),
        Place("Egypt","Cairo",listOf("القاهرة"),30.0444,31.2357,"Africa/Cairo"),
        Place("Sudan","Khartoum",listOf("الخرطوم"),15.5007,32.5599,"Africa/Khartoum"),
        Place("Mauritania","Nouakchott",listOf("نواكشوط"),18.0735,-15.9582,"Africa/Nouakchott"),
        Place("Somalia","Mogadishu",listOf("مقديشو"),2.0469,45.3182,"Africa/Mogadishu"),
        Place("Djibouti","Djibouti",listOf("جيبوتي"),11.5721,43.1456,"Africa/Djibouti"),
        Place("Comoros","Moroni",listOf("موروني"),-11.7172,43.2473,"Indian/Comoro"),
        Place("Saudi Arabia","Riyadh",listOf("الرياض"),24.7136,46.6753,"Asia/Riyadh"),
        Place("Yemen","Sanaa",listOf("صنعاء","Sana"),15.3694,44.1910,"Asia/Aden"),
        Place("Oman","Muscat",listOf("مسقط"),23.5880,58.3829,"Asia/Muscat"),
        Place("United Arab Emirates","Abu Dhabi",listOf("أبو ظبي","ابوظبي"),24.4539,54.3773,"Asia/Dubai"),
        Place("Qatar","Doha",listOf("الدوحة"),25.2854,51.5310,"Asia/Qatar"),
        Place("Bahrain","Manama",listOf("المنامة"),26.2285,50.5860,"Asia/Bahrain"),
        Place("Kuwait","Kuwait City",listOf("مدينة الكويت","الكويت"),29.3759,47.9774,"Asia/Kuwait"),
        Place("Iraq","Baghdad",listOf("بغداد"),33.3152,44.3661,"Asia/Baghdad"),
        Place("Syria","Damascus",listOf("دمشق"),33.5138,36.2765,"Asia/Damascus"),
        Place("Lebanon","Beirut",listOf("بيروت"),33.8938,35.5018,"Asia/Beirut"),
        Place("Jordan","Amman",listOf("عمان","عمّان"),31.9539,35.9106,"Asia/Amman"),
        Place("Palestine","Gaza",listOf("غزة"),31.5017,34.4668,"Asia/Gaza"),
        Place("Turkey","Ankara",listOf("أنقرة","انقرة"),39.9334,32.8597,"Europe/Istanbul"),
        Place("France","Paris",listOf("باريس"),48.8566,2.3522,"Europe/Paris"),
        Place("Germany","Berlin",listOf("برلين"),52.5200,13.4050,"Europe/Berlin"),
        Place("United Kingdom","London",listOf("لندن"),51.5072,-0.1276,"Europe/London"),
        Place("United States","Washington",listOf("واشنطن","Washington DC","Washington, DC"),38.9072,-77.0369,"America/New_York"),
        Place("Canada","Ottawa",listOf("أوتاوا","اوتاوا"),45.4215,-75.6972,"America/Toronto"),
        Place("Pakistan","Islamabad",listOf("إسلام آباد","اسلام اباد"),33.6844,73.0479,"Asia/Karachi"),
        Place("India","New Delhi",listOf("نيودلهي","دلهي","Delhi"),28.6139,77.2090,"Asia/Kolkata"),
        Place("Malaysia","Kuala Lumpur",listOf("كوالالمبور"),3.1390,101.6869,"Asia/Kuala_Lumpur"),
        Place("Indonesia","Jakarta",listOf("جاكرتا"),-6.2088,106.8456,"Asia/Jakarta")
    )

    private data class Method(
        val fajr: Double,
        val isha: Double,
        val ishaMinutes: Double? = null,
        val maghribMinutes: Double = 1.0,
        val tuneSunrise: Double = 0.0,
        val tuneDhuhr: Double = 0.0,
        val tuneMaghrib: Double = 0.0
    )

    private data class SunPosition(val declination: Double, val equation: Double)

    fun timeZone(country: String, city: String): ZoneId? = findPlace(country, city)?.let {
        ZoneId.of(it.zone)
    }

    fun supportedCities(): List<Pair<String, String>> =
        places.map { it.country to it.city }

    fun calculateDay(
        country: String,
        city: String,
        method: String,
        school: String,
        date: LocalDate
    ): Map<String, LocalTime> {
        val place = findPlace(country, city)
            ?: throw IllegalArgumentException("المدينة غير مدرجة في الحساب المحلي: $city")
        val zone = ZoneId.of(place.zone)
        val settings = methodFor(method)
        val utcStart = date.atStartOfDay(ZoneId.of("UTC")).toInstant().toEpochMilli()
        val lat = place.latitude
        val lng = place.longitude

        fun sunPosition(time: Double): SunPosition {
            val d = utcStart / 86_400_000.0 - 10_957.5 + time / 24.0 - lng / 360.0
            val g = mod(357.529 + 0.98560028 * d, 360.0)
            val q = mod(280.459 + 0.98564736 * d, 360.0)
            val l = mod(q + 1.915 * sinD(g) + 0.020 * sinD(2 * g), 360.0)
            val e = 23.439 - 0.00000036 * d
            val ra = mod(atan2(cosD(e) * sinD(l), cosD(l)) * 180.0 / PI / 15.0, 24.0)
            return SunPosition(asinD(sinD(e) * sinD(l)), q / 15.0 - ra)
        }

        fun midDay(time: Double): Double = mod(12.0 - sunPosition(time).equation, 24.0)

        fun angleTime(angle: Double, time: Double, direction: Double = 1.0): Double {
            val decl = sunPosition(time).declination
            val denominator = cosD(lat) * cosD(decl)
            val ratio = (-sinD(angle) - sinD(lat) * sinD(decl)) / denominator
            if (!ratio.isFinite() || ratio < -1.0 || ratio > 1.0) return Double.NaN
            return midDay(time) + acosD(ratio) / 15.0 * direction
        }

        val asrFactor = if (school == "1") 2.0 else 1.0
        fun asrAngle(time: Double): Double {
            val decl = sunPosition(time).declination
            val x = asrFactor + tanD(abs(lat - decl))
            return -atanD(1.0 / x)
        }

        var fajr = angleTime(settings.fajr, 5.0, -1.0)
        var sunrise = angleTime(0.833, 6.0, -1.0)
        var dhuhr = midDay(12.0)
        var asr = angleTime(asrAngle(13.0), 13.0)
        var sunset = angleTime(0.833, 18.0)
        var maghrib = angleTime(1.0, 18.0)
        var isha = angleTime(settings.isha, 18.0)
        val night = 24.0 + sunrise - sunset
        val portion = night / 2.0
        if (!fajr.isFinite() || sunrise - fajr > portion) fajr = sunrise - portion
        if (!isha.isFinite() || isha - sunset > portion) isha = sunset + portion
        if (!maghrib.isFinite() || maghrib - sunset > portion) maghrib = sunset + portion

        maghrib = sunset + settings.maghribMinutes / 60.0
        if (settings.ishaMinutes != null) isha = maghrib + settings.ishaMinutes / 60.0
        dhuhr += settings.tuneDhuhr / 60.0

        val raw = linkedMapOf(
            "Fajr" to fajr,
            "Sunrise" to sunrise + settings.tuneSunrise / 60.0,
            "Dhuhr" to dhuhr,
            "Asr" to asr,
            "Sunset" to sunset,
            "Maghrib" to maghrib + settings.tuneMaghrib / 60.0,
            "Isha" to isha
        )
        return raw.mapValues { (key, hours) ->
            require(hours.isFinite()) { "تعذّر حساب $key لهذه المدينة" }
            val epoch = utcStart + floor((hours - lng / 15.0) * 3_600_000.0).toLong()
            val rounded = floor(epoch / 60_000.0 + 0.5).toLong() * 60_000L
            ZonedDateTime.ofInstant(Instant.ofEpochMilli(rounded), zone).toLocalTime()
        }
    }

    private fun methodFor(value: String): Method = when (value) {
        "1" -> Method(18.0, 18.0)
        "2" -> Method(15.0, 15.0)
        "3", "auto" -> Method(18.0, 17.0)
        "4" -> Method(18.5, 90.0, ishaMinutes = 90.0)
        "5" -> Method(19.5, 17.5)
        "8" -> Method(19.5, 90.0, ishaMinutes = 90.0)
        "9" -> Method(18.0, 17.5)
        "10" -> Method(18.0, 90.0, ishaMinutes = 90.0)
        "12" -> Method(12.0, 12.0)
        "13" -> Method(18.0, 17.0)
        "17" -> Method(20.0, 18.0)
        "18" -> Method(18.0, 18.0)
        "19" -> Method(18.0, 17.0)
        "21" -> Method(19.0, 17.0, tuneSunrise = -5.0, tuneDhuhr = 5.0, tuneMaghrib = 5.0)
        "23" -> Method(18.0, 18.0)
        else -> Method(18.0, 17.0)
    }

    private fun findPlace(country: String, city: String): Place? {
        val countryKey = normalizeCountry(country)
        val cityKey = normalize(city)
        return places.firstOrNull { place ->
            normalizeCountry(place.country) == countryKey &&
                (listOf(place.city) + place.aliases).any { normalize(it) == cityKey }
        }
    }

    private fun normalizeCountry(value: String): String {
        val normalized = normalize(value)
        return when (normalized) {
            "المغرب", "المملكه المغربيه" -> "morocco"
            "الجزائر" -> "algeria"
            "تونس" -> "tunisia"
            "ليبيا" -> "libya"
            "مصر" -> "egypt"
            "السودان" -> "sudan"
            "موريتانيا" -> "mauritania"
            "الصومال" -> "somalia"
            "جيبوتي" -> "djibouti"
            "جزر القمر" -> "comoros"
            "السعوديه" -> "saudi arabia"
            "اليمن" -> "yemen"
            "عمان" -> "oman"
            "الامارات" -> "united arab emirates"
            "قطر" -> "qatar"
            "البحرين" -> "bahrain"
            "الكويت" -> "kuwait"
            "العراق" -> "iraq"
            "سوريا" -> "syria"
            "لبنان" -> "lebanon"
            "الاردن" -> "jordan"
            "فلسطين" -> "palestine"
            "تركيا" -> "turkey"
            "فرنسا" -> "france"
            "المانيا" -> "germany"
            "بريطانيا" -> "united kingdom"
            "الولايات المتحده" -> "united states"
            "كندا" -> "canada"
            "باكستان" -> "pakistan"
            "الهند" -> "india"
            "ماليزيا" -> "malaysia"
            "اندونيسيا" -> "indonesia"
            else -> normalized
        }
    }

    private fun normalize(value: String): String {
        val decomposed = Normalizer.normalize(value.trim().lowercase(), Normalizer.Form.NFD)
        return decomposed
            .replace(Regex("\\p{Mn}+"), "")
            .replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
            .replace('ى', 'ي').replace('ؤ', 'و').replace('ئ', 'ي')
            .replace('ة', 'ه')
            .replace(Regex("[.,،]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun mod(value: Double, divisor: Double): Double =
        ((value % divisor) + divisor) % divisor

    private fun sinD(value: Double) = kotlin.math.sin(value * PI / 180.0)
    private fun cosD(value: Double) = cos(value * PI / 180.0)
    private fun tanD(value: Double) = tan(value * PI / 180.0)
    private fun asinD(value: Double) = kotlin.math.asin(value) * 180.0 / PI
    private fun acosD(value: Double) = acos(value) * 180.0 / PI
    private fun atanD(value: Double) = atan(value) * 180.0 / PI
}
