/*
 * Morocco prayer-time method for Anwar notebook.
 *
 * This file adapts the Morocco method published by Mihrab Methods:
 * https://github.com/MihrabHQ/mihrab-methods
 * Original project author: Hassan El Ghamri and contributors.
 * The adaptation is distributed under MPL-2.0; see
 * licenses/MPL-2.0-Mihrab-Methods.txt and THIRD-PARTY-NOTICES.md.
 *
 * The method follows the published Habous calculation procedure:
 * Meeus apparent Sun, Fajr 19°, Isha 17°, Dhuhr +5 minutes,
 * apparent-Sun Asr with refraction, and local-horizon estimates.
 * This local port does not include the upstream city-fitted points or
 * its dated correction list; results are therefore estimates, not a
 * claim of certified minute-for-minute equivalence to Habous tables.
 */
(function installAnwarMoroccoMethod(root) {
  'use strict';

  const RAD = Math.PI / 180;
  const DAY_MS = 86400000;
  const ITERATIONS = 3;

  function apparentSun(daysFromJ2000) {
    const T = daysFromJ2000 / 36525;
    const L0 = (((280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360) + 360) % 360;
    const M = (357.52911 + T * (35999.05029 - 0.0001537 * T)) * RAD;
    const C =
      (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(M) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
      0.000289 * Math.sin(3 * M);
    const omega = (125.04 - 1934.136 * T) * RAD;
    const meanSolarLongitude = (280.4665 + 36000.7698 * T) * RAD;
    const meanLunarLongitude = (218.3165 + 481267.8813 * T) * RAD;
    const dPsi = (
      -17.2 * Math.sin(omega) -
      1.32 * Math.sin(2 * meanSolarLongitude) -
      0.23 * Math.sin(2 * meanLunarLongitude) +
      0.21 * Math.sin(2 * omega)
    ) / 3600;
    const dEpsilon = (
      9.2 * Math.cos(omega) +
      0.57 * Math.cos(2 * meanSolarLongitude) +
      0.1 * Math.cos(2 * meanLunarLongitude) -
      0.09 * Math.cos(2 * omega)
    ) / 3600;
    const meanObliquity =
      23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const longitude = (L0 + C - 0.00569 + dPsi) * RAD;
    const obliquity = (meanObliquity + dEpsilon) * RAD;
    const rightAscension = (
      ((Math.atan2(
        Math.cos(obliquity) * Math.sin(longitude),
        Math.cos(longitude)
      ) / RAD) % 360) + 360
    ) % 360;
    const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
    const equation = L0 - 0.0057183 - rightAscension + dPsi * Math.cos(obliquity);
    const equationOfTime = ((((equation + 180) % 360) + 360) % 360 - 180) * 4;
    return { declination, equationOfTime };
  }

  function refractionFromTrue(altitude) {
    return (1.02 / Math.tan((altitude + 10.3 / (altitude + 5.11)) * RAD)) / 60;
  }

  function refractionFromApparent(altitude) {
    return (1 / Math.tan((altitude + 7.31 / (altitude + 4.4)) * RAD)) / 60;
  }

  function dipEast(heightMeters) {
    return 0.32 + 0.025 * Math.sqrt(Math.max(heightMeters, 0));
  }

  function dipWest(heightMeters) {
    return 0.37 + 0.021 * Math.sqrt(Math.max(heightMeters, 0));
  }

  function rawMinutes(latitude, longitude, year, month, day, heightMeters, asrShadow) {
    const d0 = (
      Date.UTC(year, month - 1, day) - Date.UTC(2000, 0, 1)
    ) / DAY_MS - 0.5;
    const sunAt = function (minutes) {
      return apparentSun(d0 + minutes / 1440);
    };

    let noon = 720 - 4 * longitude;
    for (let i = 0; i < ITERATIONS; i++) {
      noon = 720 - 4 * longitude - sunAt(noon).equationOfTime;
    }

    const sinLatitude = Math.sin(latitude * RAD);
    const cosLatitude = Math.cos(latitude * RAD);
    const T = (d0 + noon / 1440) / 36525;
    const meanAnomaly = (357.52911 + 35999.05029 * T) * RAD;
    const horizon = -(
      34 / 60 +
      0.26667 / (
        1.00014 -
        0.016708 * Math.cos(meanAnomaly) -
        0.00014 * Math.cos(2 * meanAnomaly)
      )
    );

    const event = function (altitudeForDeclination, direction, start) {
      let time = start;
      for (let i = 0; i < ITERATIONS; i++) {
        const sun = sunAt(time);
        const altitude = altitudeForDeclination(sun.declination);
        const cosineHourAngle = (
          Math.sin(altitude * RAD) -
          sinLatitude * Math.sin(sun.declination)
        ) / (cosLatitude * Math.cos(sun.declination));
        if (!(Math.abs(cosineHourAngle) <= 1)) return NaN;
        time = 720 - 4 * longitude - sun.equationOfTime +
          direction * 4 * Math.acos(cosineHourAngle) / RAD;
      }
      return time;
    };

    const fixed = function (altitude) { return function () { return altitude; }; };
    const noonDeclination = sunAt(noon).declination;
    const noonTrueAltitude = 90 - Math.abs(latitude - noonDeclination / RAD);
    const noonApparentAltitude = noonTrueAltitude + refractionFromTrue(noonTrueAltitude);
    const asrApparentAltitude = Math.atan(
      1 / (asrShadow + 1 / Math.tan(noonApparentAltitude * RAD))
    ) / RAD;
    const asrTrueAltitude = asrApparentAltitude -
      refractionFromApparent(asrApparentAltitude);
    const eastDip = dipEast(heightMeters);
    const westDip = dipWest(heightMeters);

    return {
      fajr: event(fixed(-19), -1, noon - 420) - 0.5,
      sunrise: event(fixed(horizon - eastDip), -1, noon - 360) - 1.0,
      dhuhr: noon + 5,
      asr: event(fixed(asrTrueAltitude), 1, noon + 200),
      maghrib: event(fixed(horizon - westDip), 1, noon + 360) + 1.8,
      isha: event(fixed(-17), 1, noon + 420)
    };
  }

  function formatMinutes(value, roundDown) {
    if (!Number.isFinite(value)) throw new Error('تعذّر حساب أحد مواقيت الصلاة لهذه المدينة.');
    const total = roundDown ? Math.floor(value) : Math.floor(value + 0.5);
    const normalized = ((total % 1440) + 1440) % 1440;
    return String(Math.floor(normalized / 60)).padStart(2, '0') +
      ':' + String(normalized % 60).padStart(2, '0');
  }

  function calculate(input) {
    const value = input && typeof input === 'object' ? input : {};
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    const year = Number(value.year);
    const month = Number(value.month);
    const day = Number(value.day);
    const heightMeters = Number.isFinite(Number(value.heightMeters))
      ? Math.max(0, Math.min(9000, Number(value.heightMeters)))
      : 0;
    const asrShadow = value.school === '1' || value.school === 2 ? 2 : 1;

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 ||
        !Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error('مدخلات حساب مواقيت المغرب غير صالحة.');
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
        date.getUTCDate() !== day) {
      throw new Error('تاريخ حساب مواقيت المغرب غير صحيح.');
    }

    const result = rawMinutes(latitude, longitude, year, month, day, heightMeters, asrShadow);
    return {
      Fajr: formatMinutes(result.fajr, true),
      Sunrise: formatMinutes(result.sunrise, false),
      Dhuhr: formatMinutes(result.dhuhr, false),
      Asr: formatMinutes(result.asr, false),
      Maghrib: formatMinutes(result.maghrib, false),
      Isha: formatMinutes(result.isha, false)
    };
  }

  root.AnwarMoroccoPrayerMethod = Object.freeze({ calculate: calculate });
})(window);
