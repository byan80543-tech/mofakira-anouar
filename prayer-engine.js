/* Local prayer-time engine for Anwar notebook.
 * No network requests, geolocation, remote API, or third-party runtime dependency.
 * Coordinates are city presets; unknown cities are rejected rather than guessed.
 * Morocco uses 19° Fajr / 17° Isha (AlAdhan method 21 parameters).
 */
(function installAnwarPrayerEngine(root) {
  'use strict';

  const CITY_COORDINATES = {
    Morocco: {
      meknes: [33.8935, -5.5473], mequinez: [33.8935, -5.5473], 'مكناس': [33.8935, -5.5473],
      fes: [34.0331, -5.0003], fez: [34.0331, -5.0003], 'فاس': [34.0331, -5.0003],
      casablanca: [33.5731, -7.5898], 'الدار البيضاء': [33.5731, -7.5898],
      rabat: [34.0209, -6.8416], 'الرباط': [34.0209, -6.8416],
      tangier: [35.7595, -5.8340], tanger: [35.7595, -5.8340], 'طنجة': [35.7595, -5.8340],
      marrakech: [31.6295, -7.9811], marrakesh: [31.6295, -7.9811], 'مراكش': [31.6295, -7.9811],
      agadir: [30.4278, -9.5981], 'agadir': [30.4278, -9.5981], 'أكادير': [30.4278, -9.5981], 'اكادير': [30.4278, -9.5981],
      oujda: [34.6814, -1.9086], 'وجدة': [34.6814, -1.9086],
      tetouan: [35.5889, -5.3626], 'تطوان': [35.5889, -5.3626],
      kenitra: [34.2610, -6.5802], 'القنيطرة': [34.2610, -6.5802],
      safi: [32.2994, -9.2372], 'آسفي': [32.2994, -9.2372], 'اسفي': [32.2994, -9.2372],
      taza: [34.2133, -4.0103], 'تازة': [34.2133, -4.0103],
      'al hoceima': [35.2517, -3.9372], alhucemas: [35.2517, -3.9372], 'الحسيمة': [35.2517, -3.9372],
      nador: [35.1681, -2.9335], 'الناظور': [35.1681, -2.9335],
      'beni mellal': [32.3373, -6.3498], 'بني ملال': [32.3373, -6.3498],
      khouribga: [32.8811, -6.9063], 'خريبكة': [32.8811, -6.9063],
      settat: [33.0010, -7.6166], 'سطات': [33.0010, -7.6166],
      berkane: [34.9167, -2.3167], 'بركان': [34.9167, -2.3167],
      larache: [35.1932, -6.1566], 'العرائش': [35.1932, -6.1566],
      essaouira: [31.5085, -9.7595], 'الصويرة': [31.5085, -9.7595],
      taroudant: [30.4703, -8.8769], 'تارودانت': [30.4703, -8.8769],
      guelmim: [28.9870, -10.0574], 'كلميم': [28.9870, -10.0574],
      dakhla: [23.6848, -15.9570], 'الداخلة': [23.6848, -15.9570]
    },
    Algeria: { algiers: [36.7538, 3.0588], 'الجزائر': [36.7538, 3.0588] },
    Tunisia: { tunis: [36.8065, 10.1815], 'تونس': [36.8065, 10.1815] },
    Libya: { tripoli: [32.8872, 13.1913], 'طرابلس': [32.8872, 13.1913] },
    Egypt: { cairo: [30.0444, 31.2357], 'القاهرة': [30.0444, 31.2357] },
    Sudan: { khartoum: [15.5007, 32.5599], 'الخرطوم': [15.5007, 32.5599] },
    Mauritania: { nouakchott: [18.0735, -15.9582], 'نواكشوط': [18.0735, -15.9582] },
    Somalia: { mogadishu: [2.0469, 45.3182], 'مقديشو': [2.0469, 45.3182] },
    Djibouti: { djibouti: [11.5721, 43.1456], 'جيبوتي': [11.5721, 43.1456] },
    Comoros: { moroni: [-11.7172, 43.2473], 'موروني': [-11.7172, 43.2473] },
    'Saudi Arabia': { riyadh: [24.7136, 46.6753], 'الرياض': [24.7136, 46.6753] },
    Yemen: { sanaa: [15.3694, 44.1910], sana: [15.3694, 44.1910], 'صنعاء': [15.3694, 44.1910] },
    Oman: { muscat: [23.5880, 58.3829], 'مسقط': [23.5880, 58.3829] },
    'United Arab Emirates': { 'abu dhabi': [24.4539, 54.3773], 'أبو ظبي': [24.4539, 54.3773], 'ابوظبي': [24.4539, 54.3773] },
    Qatar: { doha: [25.2854, 51.5310], 'الدوحة': [25.2854, 51.5310] },
    Bahrain: { manama: [26.2285, 50.5860], 'المنامة': [26.2285, 50.5860] },
    Kuwait: { 'kuwait city': [29.3759, 47.9774], kuwait: [29.3759, 47.9774], 'الكويت': [29.3759, 47.9774] },
    Iraq: { baghdad: [33.3152, 44.3661], 'بغداد': [33.3152, 44.3661] },
    Syria: { damascus: [33.5138, 36.2765], 'دمشق': [33.5138, 36.2765] },
    Lebanon: { beirut: [33.8938, 35.5018], 'بيروت': [33.8938, 35.5018] },
    Jordan: { amman: [31.9539, 35.9106], 'عمان': [31.9539, 35.9106] },
    Palestine: { gaza: [31.5017, 34.4668], 'غزة': [31.5017, 34.4668] },
    Turkey: { ankara: [39.9334, 32.8597], 'أنقرة': [39.9334, 32.8597] },
    France: { paris: [48.8566, 2.3522], 'باريس': [48.8566, 2.3522] },
    Germany: { berlin: [52.5200, 13.4050], 'برلين': [52.5200, 13.4050] },
    'United Kingdom': { london: [51.5072, -0.1276], 'لندن': [51.5072, -0.1276] },
    'United States': { washington: [38.9072, -77.0369], 'واشنطن': [38.9072, -77.0369] },
    Canada: { ottawa: [45.4215, -75.6972], 'أوتاوا': [45.4215, -75.6972], 'اوتاوا': [45.4215, -75.6972] },
    Pakistan: { islamabad: [33.6844, 73.0479], 'إسلام آباد': [33.6844, 73.0479], 'اسلام اباد': [33.6844, 73.0479] },
    India: { 'new delhi': [28.6139, 77.2090], delhi: [28.6139, 77.2090], 'نيودلهي': [28.6139, 77.2090] },
    Malaysia: { 'kuala lumpur': [3.1390, 101.6869], 'كوالالمبور': [3.1390, 101.6869] },
    Indonesia: { jakarta: [-6.2088, 106.8456], 'جاكرتا': [-6.2088, 106.8456] }
  };

  const COUNTRY_TIMEZONES = {
    Morocco: 'Africa/Casablanca', Algeria: 'Africa/Algiers', Tunisia: 'Africa/Tunis',
    Libya: 'Africa/Tripoli', Egypt: 'Africa/Cairo', Sudan: 'Africa/Khartoum',
    Mauritania: 'Africa/Nouakchott', Somalia: 'Africa/Mogadishu', Djibouti: 'Africa/Djibouti',
    Comoros: 'Indian/Comoro', 'Saudi Arabia': 'Asia/Riyadh', Yemen: 'Asia/Aden',
    Oman: 'Asia/Muscat', 'United Arab Emirates': 'Asia/Dubai', Qatar: 'Asia/Qatar',
    Bahrain: 'Asia/Bahrain', Kuwait: 'Asia/Kuwait', Iraq: 'Asia/Baghdad',
    Syria: 'Asia/Damascus', Lebanon: 'Asia/Beirut', Jordan: 'Asia/Amman',
    Palestine: 'Asia/Gaza', Turkey: 'Europe/Istanbul', France: 'Europe/Paris',
    Germany: 'Europe/Berlin', 'United Kingdom': 'Europe/London',
    'United States': 'America/New_York', Canada: 'America/Toronto',
    Pakistan: 'Asia/Karachi', India: 'Asia/Kolkata', Malaysia: 'Asia/Kuala_Lumpur',
    Indonesia: 'Asia/Jakarta'
  };

  const METHOD_PARAMETERS = {
    Morocco: { fajr: 19, isha: 17 },
    Algeria: { fajr: 18, isha: 17 },
    Tunisia: { fajr: 18, isha: 18 },
    Egypt: { fajr: 19.5, isha: 17.5 },
    'Saudi Arabia': { fajr: 18.5, ishaInterval: 90 },
    Oman: { fajr: 19.5, ishaInterval: 90 },
    'United Arab Emirates': { fajr: 19.5, ishaInterval: 90 },
    Qatar: { fajr: 18, ishaInterval: 90 },
    Bahrain: { fajr: 19.5, ishaInterval: 90 },
    Kuwait: { fajr: 18, isha: 17.5 },
    Turkey: { fajr: 18, isha: 17 },
    France: { fajr: 12, isha: 12 },
    'United States': { fajr: 15, isha: 15 },
    Canada: { fajr: 15, isha: 15 },
    Singapore: { fajr: 20, isha: 18 },
    Malaysia: { fajr: 20, isha: 18 },
    Indonesia: { fajr: 20, isha: 18 },
    Pakistan: { fajr: 18, isha: 18 }
  };

  const rad = function (degrees) { return degrees * Math.PI / 180; };
  const deg = function (radians) { return radians * 180 / Math.PI; };
  const normalizeCity = function (value) {
    return String(value || '').trim().toLocaleLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  };

  function getCoordinates(country, city) {
    const group = CITY_COORDINATES[String(country || '').trim()];
    if (!group) return null;
    const key = normalizeCity(city);
    const pair = group[key] || group[String(city || '').trim()];
    if (!pair) return null;
    return { latitude: pair[0], longitude: pair[1] };
  }

  function timezoneForCountry(country) {
    return COUNTRY_TIMEZONES[String(country || '').trim()] || '';
  }

  function solarPosition(year, month, day) {
    const jd = 2440587.5 + Date.UTC(year, month - 1, day, 12, 0, 0) / 86400000;
    const t = (jd - 2451545) / 36525;
    const l0 = ((280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360 + 360) % 360;
    const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    const center = Math.sin(rad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t))
      + Math.sin(rad(2 * m)) * (0.019993 - 0.000101 * t)
      + Math.sin(rad(3 * m)) * 0.000289;
    const trueLongitude = l0 + center;
    const omega = 125.04 - 1934.136 * t;
    const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * Math.sin(rad(omega));
    const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
    const obliquity = meanObliquity + 0.00256 * Math.cos(rad(omega));
    const declination = Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLongitude)));
    const y = Math.tan(rad(obliquity) / 2) ** 2;
    const eqTime = 4 * deg(
      y * Math.sin(2 * rad(l0))
      - 2 * eccentricity * Math.sin(rad(m))
      + 4 * eccentricity * y * Math.sin(rad(m)) * Math.cos(2 * rad(l0))
      - 0.5 * y * y * Math.sin(4 * rad(l0))
      - 1.25 * eccentricity * eccentricity * Math.sin(2 * rad(m))
    );
    return { declination: declination, equationOfTime: eqTime };
  }

  function hourAngle(altitude, latitude, declination) {
    const lat = rad(latitude);
    const numerator = Math.sin(rad(altitude)) - Math.sin(lat) * Math.sin(declination);
    const denominator = Math.cos(lat) * Math.cos(declination);
    if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return null;
    const cosine = numerator / denominator;
    if (cosine < -1 || cosine > 1) return null;
    return deg(Math.acos(Math.max(-1, Math.min(1, cosine))));
  }

  function localTime(utcMinutes, year, month, day, timezone) {
    const date = new Date(Date.UTC(year, month - 1, day) + Math.round(utcMinutes) * 60000);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(date);
  }

  function hijriDate(year, month, day) {
    try {
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
        timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric'
      }).formatToParts(date);
      const values = {};
      parts.forEach(function (part) { values[part.type] = part.value; });
      if (values.day && values.month && values.year) {
        return values.day + '-' + values.month + '-' + values.year;
      }
    } catch (_error) {}
    return '';
  }

  function calculate(input) {
    const source = input && typeof input === 'object' ? input : {};
    const dateMatch = String(source.date || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!dateMatch) throw new Error('تاريخ الحساب المحلي غير صالح.');
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = Number(dateMatch[3]);
    const validation = new Date(Date.UTC(year, month - 1, day));
    if (validation.getUTCFullYear() !== year || validation.getUTCMonth() + 1 !== month || validation.getUTCDate() !== day) {
      throw new Error('تاريخ الحساب المحلي غير صحيح.');
    }

    const coords = getCoordinates(source.country, source.city);
    if (!coords) {
      throw new Error('هذه المدينة غير مدرجة في قاعدة الإحداثيات المحلية. لم نرسلها إلى أي خدمة؛ اختر مدينة مدعومة أو أضف إحداثياتها في تحديث لاحق.');
    }
    const timezone = source.timezone || timezoneForCountry(source.country) || 'UTC';
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(validation); }
    catch (_error) { throw new Error('المنطقة الزمنية المحددة غير صالحة.'); }

    const solar = solarPosition(year, month, day);
    const latitude = coords.latitude;
    const longitude = coords.longitude;
    const solarNoonUtc = 720 - 4 * longitude - solar.equationOfTime;
    const sunsetAngle = hourAngle(-0.833, latitude, solar.declination);
    const fajrAngle = source.country === 'Morocco' ? 19 : (METHOD_PARAMETERS[source.country] || { fajr: 18 }).fajr;
    const method = METHOD_PARAMETERS[source.country] || { fajr: 18, isha: 17 };
    const fajrH = hourAngle(-fajrAngle, latitude, solar.declination);
    const ishaH = method.isha ? hourAngle(-method.isha, latitude, solar.declination) : null;
    const asrFactor = source.school === '1' ? 2 : 1;
    // At solar noon, the sun's zenith angle determines the object's shadow.
    // Asr begins when shadow length reaches the noon shadow plus the madhab factor.
    const noonZenithAngle = Math.abs(latitude - deg(solar.declination));
    const asrAltitude = deg(Math.atan(1 / (asrFactor + Math.tan(rad(noonZenithAngle)))));
    const asrH = hourAngle(asrAltitude, latitude, solar.declination);

    if (sunsetAngle === null || asrH === null) {
      throw new Error('تعذّر حساب الشروق أو العصر لهذه المدينة بهذا التاريخ؛ راجع إعدادات المدينة.');
    }

    const sunriseUtc = solarNoonUtc - sunsetAngle * 4;
    const sunsetUtc = solarNoonUtc + sunsetAngle * 4;
    const fajrUtc = fajrH === null ? sunriseUtc - 90 : solarNoonUtc - fajrH * 4;
    const asrUtc = solarNoonUtc + asrH * 4;
    const ishaUtc = method.ishaInterval
      ? sunsetUtc + method.ishaInterval
      : (ishaH === null ? sunsetUtc + 90 : solarNoonUtc + ishaH * 4);

    const timeZone = timezone;
    const timings = {
      Fajr: localTime(fajrUtc, year, month, day, timeZone),
      Dhuhr: localTime(solarNoonUtc + 1, year, month, day, timeZone),
      Asr: localTime(asrUtc, year, month, day, timeZone),
      Maghrib: localTime(sunsetUtc, year, month, day, timeZone),
      Isha: localTime(ishaUtc, year, month, day, timeZone)
    };
    const gregorian = String(dateMatch[1]) + '-' + String(dateMatch[2]) + '-' + String(dateMatch[3]);
    return {
      timings: timings,
      date: { gregorian: { date: gregorian }, hijri: { date: hijriDate(year, month, day) } },
      meta: { timezone: timeZone, source: 'local-astronomical-calculation' }
    };
  }

  root.AnwarPrayerEngine = Object.freeze({
    calculate: calculate,
    getCoordinates: getCoordinates,
    timezoneForCountry: timezoneForCountry
  });
})(window);
