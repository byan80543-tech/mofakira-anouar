package com.anwar.mofakira.playback

import android.net.Uri
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class QuranEdition(
    val reciterName: String,
    val narrationName: String,
    val serverUrl: String,
    val availableSurahs: List<Int>
) {
    val displayName: String
        get() = if (narrationName.isBlank()) reciterName else "$reciterName — $narrationName"

    fun surahUrl(number: Int): String =
        serverUrl.trimEnd('/') + "/" + number.toString().padStart(3, '0') + ".mp3"
}

data class LiveStation(
    val name: String,
    val url: String
)

data class LessonSeries(
    val id: String,
    val title: String,
    val count: Int,
    val sourceUrl: String,
    val urlForIndex: (Int) -> String,
    val trackNames: List<String> = emptyList()
) {
    fun trackTitle(index: Int): String =
        trackNames.getOrNull(index) ?: "الدرس ${(index + 1).toString().padStart(2, '0')} من $count"
}

data class DevotionalTrack(
    val id: String,
    val title: String,
    val sourceLabel: String,
    val url: String
)

/**
 * Native mirror of the verified catalog used by the current notebook.
 *
 * Dynamic Quran readers and radio stations are loaded from the same MP3Quran
 * API used by the web application. Direct audio URLs stay HTTPS-only.
 */
object NativeMediaCatalog {
    private val allSurahs = (1..114).toList()

    val surahNames = (
        "الفاتحة,البقرة,آل عمران,النساء,المائدة,الأنعام,الأعراف,الأنفال,التوبة,يونس,هود,يوسف,الرعد,إبراهيم,الحجر,النحل,الإسراء,الكهف,مريم,طه,الأنبياء,الحج,المؤمنون,النور,الفرقان,الشعراء,النمل,القصص,العنكبوت,الروم,لقمان,السجدة,الأحزاب,سبأ,فاطر,يس,الصافات,ص,الزمر,غافر,فصلت,الشورى,الزخرف,الدخان,الجاثية,الأحقاف,محمد,الفتح,الحجرات,ق,الذاريات,الطور,النجم,القمر,الرحمن,الواقعة,الحديد,المجادلة,الحشر,الممتحنة,الصف,الجمعة,المنافقون,التغابن,الطلاق,التحريم,الملك,القلم,الحاقة,المعارج,نوح,الجن,المزمل,المدثر,القيامة,الإنسان,المرسلات,النبأ,النازعات,عبس,التكوير,الانفطار,المطففين,الانشقاق,البروج,الطارق,الأعلى,الغاشية,الفجر,البلد,الشمس,الليل,الضحى,الشرح,التين,العلق,القدر,البينة,الزلزلة,العاديات,القارعة,التكاثر,العصر,الهمزة,الفيل,قريش,الماعون,الكوثر,الكافرون,النصر,المسد,الإخلاص,الفلق,الناس"
        ).split(",")

    private val curatedEditions = listOf(
        QuranEdition("عبد الرحمن بنموسى", "ورش عن نافع", "https://media.way2quran.com/abdel-rahman-benmoussa/warsh-an-nafi/", allSurahs),
        QuranEdition("مشاري العفاسي", "حفص", "https://server8.mp3quran.net/afs/", allSurahs),
        QuranEdition("ماهر المعيقلي", "حفص", "https://server12.mp3quran.net/maher/", allSurahs),
        QuranEdition("عبدالرحمن السديس", "حفص", "https://server11.mp3quran.net/sds/", allSurahs),
        QuranEdition("سعود الشريم", "حفص", "https://server7.mp3quran.net/shur/", allSurahs),
        QuranEdition("عبدالباسط عبدالصمد", "حفص", "https://server7.mp3quran.net/basit/", allSurahs),
        QuranEdition("سعد الغامدي", "حفص", "https://server7.mp3quran.net/s_gmd/", allSurahs),
        QuranEdition("أحمد العجمي", "حفص", "https://server10.mp3quran.net/ajm/", allSurahs),
        QuranEdition("ياسر الدوسري", "حفص", "https://server11.mp3quran.net/yasser/", allSurahs),
        QuranEdition("أبو بكر الشاطري", "حفص", "https://server11.mp3quran.net/shatri/", allSurahs),
        QuranEdition("محمد صديق المنشاوي", "حفص", "https://server10.mp3quran.net/minsh/", allSurahs),
        QuranEdition("إبراهيم الأخضر", "حفص", "https://server6.mp3quran.net/akdr/", allSurahs),
        QuranEdition("محمد أيوب", "حفص", "https://cdn.mp3quran.net/audio/muhammad-ayyub/r1/", allSurahs)
    )

    val lessonSeries = listOf(
        LessonSeries("tawhid", "شرح كتاب التوحيد — السلسلة الكاملة", 55,
            "https://islamhouse.com/ar/audios/2837173",
            { i -> "https://d1.islamhouse.com/data/ar/ih_sounds/chain_01/shar7-ketab-taw7eed-al-badr/ar-${(i + 1).toString().padStart(2, '0')}-shar7-ketab-taw7eed-al-badr.mp3" }),
        LessonSeries("wasitiyya", "شرح العقيدة الواسطية (عام 1432هـ)", 50,
            "https://alfiqh.net/شرح-العقيدة-الواسطية-عام-1432هـ-عبدالرزاق-البدر/",
            { i -> "https://archive.org/download/Sharh_Wasitiya_1432H/${(i + 1).toString().padStart(2, '0')}.mp3" }),
        LessonSeries("dawa", "شرح الداء والدواء", 83,
            "https://sabil-alrashad.com/AudioPlaylist/9",
            { i -> "https://sabil-alrashad.com/Home/DownloadAudioFile/${36 + i}" }),
        LessonSeries("usul", "شرح ثلاثة الأصول (1429هـ)", 17,
            "https://al-badr.net/sub/196",
            { i -> "https://al-badr.net/download/esound/choroohat/tsalatsatul-ushul/${(i + 1).toString().padStart(2, '0')}.mp3" }),
        LessonSeries("usul2", "شرح الأصول الثلاثة وأدلتها (1434هـ)", 9,
            "https://al-badr.net/sub/303",
            { i -> "https://al-badr.net/download/esound/choroohat/tsalatsatul-ushul-1434h/${(i + 1).toString().padStart(2, '0')}.mp3" }),
        LessonSeries("qawaid", "شرح القواعد الأربع", 3,
            "https://al-badr.net/sub/59",
            { i -> "https://al-badr.net/download/esound/choroohat/kawaid-alarbaa/${(i + 1).toString().padStart(3, '0')}.mp3" }),
        LessonSeries("nawqid", "شرح نواقض الإسلام (1431هـ)", 11,
            "https://al-badr.net/sub/215",
            { i -> "https://al-badr.net/download/esound/choroohat/nawaqidlul-islam/${(i + 1).toString().padStart(2, '0')}.mp3" }),
        LessonSeries("kashf", "شرح كشف الشبهات (1428–1429هـ)", 11,
            "https://al-badr.net/sub/80",
            { i -> "https://al-badr.net/download/esound/choroohat/Kashf-Alshubuhat/${(i + 1).toString().padStart(2, '0')}.mp3" }),
        LessonSeries("masail", "شرح مسائل الجاهلية", 11,
            "https://al-badr.net/sub/60",
            { i -> "https://al-badr.net/download/esound/choroohat/masail-aljahilia/${(i + 1).toString().padStart(3, '0')}.mp3" }),
        LessonSeries("usulIman", "شرح كتاب أصول الإيمان", 30,
            "https://al-badr.net/sub/56",
            { i -> "https://al-badr.net/download/esound/choroohat/usul-aliman/${(i + 1).toString().padStart(3, '0')}.mp3" }),
        LessonSeries("usulAqaid", "شرح رسالة أصول العقائد الدينية", 14,
            "https://al-badr.net/sub/58",
            { i -> "https://al-badr.net/download/esound/choroohat/usul-alakaid/${(i + 1).toString().padStart(3, '0')}.mp3" }),
        LessonSeries("kabair", "شرح كتاب الكبائر", 41,
            "https://al-badr.net/sub/315",
            { i -> "https://al-badr.net/download/esound/choroohat/alkabair-li-abdil-wahhab/${(i + 1).toString().padStart(2, '0')}.mp3" }),
        LessonSeries("sharia", "شرح كتاب الشريعة للآجري", 140,
            "https://www.ajurry.com/vb/forum/منابر-المتون-العلمية-وشروحها/منبر-المنهج-السلفي-وأصوله/شـروح-منهجية/43507-شرح-كتاب-الشريعة-للآجري-للشيخ-عبد-الرزاق-البدر",
            { i -> "https://archive.org/download/fawaid_051/${(i + 1).toString().padStart(3, '0')}.mp3" }),
        LessonSeries("maarij", "تعليق على معارج القبول", 280,
            "https://al-badr.net/sub/362",
            { i -> "https://al-badr.net/download/esound/choroohat/ma3arijul-qobul/${(i + 1).toString().padStart(3, '0')}.mp3" }),
        LessonSeries("jawhara", "شرح الجوهرة الفريدة في تحقيق العقيدة", 6,
            "https://al-badr.net/sub/84",
            { i -> "https://mail.al-badr.net/download/esound/choroohat/Manduma-Aljawhara/${(i + 1).toString().padStart(2, '0')}.mp3" },
            listOf("من البيت 1 إلى 57", "من البيت 58 إلى 91", "من البيت 92 إلى 135", "من البيت 136 إلى 196", "من البيت 197 إلى 248", "من البيت 249 إلى 296"))
    )

    val devotionalTracks = listOf(
        DevotionalTrack(
            "ya-rab",
            "يا رب إن عظمت ذنوبي",
            "الملف 004",
            "https://archive.org/download/20240309_20240309_1714/" +
                Uri.encode("004  الشيخ سيد النقشبندى, يا رب ان عظمت ذنوبى كثرة.mp3")
        ),
        DevotionalTrack(
            "aghayb",
            "أغيب وذو اللطائف لا يغيب",
            "ضمن المجموعة الصوتية · الملف 007",
            "https://archive.org/download/20240309_20240309_1714/" +
                Uri.encode("007  مجموعه ابتهالات مختارة نادرة جدا للشيخ النقشبندى.mp3")
        )
    )

    fun loadReciters(): List<QuranEdition> {
        val dynamic = runCatching {
            val root = getJson("https://www.mp3quran.net/api/v3/reciters?language=ar")
            val reciters = root.optJSONArray("reciters") ?: return@runCatching emptyList()
            buildList {
                for (i in 0 until reciters.length()) {
                    val reciter = reciters.optJSONObject(i) ?: continue
                    val reciterName = safeText(reciter.optString("name"), "قارئ")
                    val moshafArray = reciter.optJSONArray("moshaf") ?: continue
                    for (j in 0 until moshafArray.length()) {
                        val moshaf = moshafArray.optJSONObject(j) ?: continue
                        val server = safeHttps(moshaf.optString("server")) ?: continue
                        val rawList = moshaf.optString("surah_list")
                        val surahs = rawList.split(",")
                            .mapNotNull { it.trim().toIntOrNull() }
                            .filter { it in 1..114 }
                            .distinct()
                            .sorted()
                        val total = moshaf.optInt("surah_total", 0)
                        val available = when {
                            surahs.isNotEmpty() -> surahs
                            total in 1..114 -> (1..total).toList()
                            else -> emptyList()
                        }
                        if (available.isEmpty()) continue
                        val narration = safeText(moshaf.optString("name"), "رواية متاحة")
                        add(QuranEdition(reciterName, narration, server, available))
                    }
                }
            }
        }.getOrDefault(emptyList())

        val combined = LinkedHashMap<String, QuranEdition>()
        (curatedEditions + dynamic).forEach { edition ->
            val key = edition.displayName + "|" + edition.serverUrl.trimEnd('/')
            combined.putIfAbsent(key, edition)
        }
        return combined.values.sortedBy { it.displayName }
    }

    fun quickRadioStation(): LiveStation =
        LiveStation("إذاعة زين بلادي للقرآن الكريم", "https://asmaki.ma:8000/radio.mp3")

    fun loadStations(): List<LiveStation> {
        val dynamic = runCatching {
            val root = getJson("https://www.mp3quran.net/api/v3/radios?language=ar")
            val radios = root.optJSONArray("radios") ?: return@runCatching emptyList()
            buildList {
                for (i in 0 until radios.length()) {
                    val item = radios.optJSONObject(i) ?: continue
                    val url = safeHttps(item.optString("url")) ?: continue
                    val name = safeText(item.optString("name"), "إذاعة القرآن")
                    add(LiveStation(name, url))
                }
            }
        }.getOrDefault(emptyList())

        val combined = LinkedHashMap<String, LiveStation>()
        dynamic.forEach { combined[it.url] = it }
        val fallbackUrl = safeHttps("https://asmaki.ma:8000/radio.mp3")
        if (fallbackUrl != null) {
            combined.remove(fallbackUrl)
            val ordered = linkedMapOf(fallbackUrl to LiveStation("إذاعة زين بلادي للقرآن الكريم", fallbackUrl))
            combined.forEach { (url, station) -> ordered[url] = station }
            return ordered.values.toList()
        }
        return combined.values.toList()
    }

    private fun getJson(rawUrl: String): JSONObject {
        val connection = (URL(rawUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8_000
            readTimeout = 10_000
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "MofakiraAnwarAndroid/0.2")
            instanceFollowRedirects = true
        }
        try {
            if (connection.responseCode !in 200..299) {
                throw IllegalStateException("Catalog HTTP ${connection.responseCode}")
            }
            val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            require(body.length <= 5_000_000) { "Audio catalog response is too large" }
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun safeHttps(raw: String): String? {
        val candidate = raw.trim()
        if (candidate.length !in 9..2_000) return null
        return runCatching {
            val uri = Uri.parse(candidate)
            if (uri.scheme != "https" || uri.host.isNullOrBlank() || uri.userInfo != null) null
            else uri.toString()
        }.getOrNull()
    }

    private fun safeText(raw: String?, fallback: String): String {
        val value = raw.orEmpty().trim().replace(Regex("\\s+"), " ")
        return if (value.isNotEmpty()) value.take(120) else fallback
    }
}
