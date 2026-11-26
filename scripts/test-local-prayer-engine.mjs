import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrayTime } = require('../vendor/praytime.js');

const calculator = new PrayTime()
  .adjust({
    fajr: 19,
    isha: 17,
    maghrib: '0 min',
    dhuhr: '0 min',
    asr: 'Standard',
    highLats: 'NightMiddle'
  })
  .location([33.8935, -5.5473])
  .timezone('Africa/Casablanca')
  .round('nearest')
  .format('24h');

const result = calculator.times([2026, 11, 26]);
for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
  assert.match(result[key], /^([01]\d|2[0-3]):[0-5]\d$/, key + ' must be a valid local clock time');
}
assert.ok(result.fajr < result.sunrise, 'Fajr must precede sunrise');
assert.ok(result.sunrise < result.dhuhr, 'Sunrise must precede Dhuhr');
assert.ok(result.dhuhr < result.asr, 'Dhuhr must precede Asr');
assert.ok(result.asr < result.maghrib, 'Asr must precede Maghrib');
assert.ok(result.maghrib < result.isha, 'Maghrib must precede Isha');
console.log('Local prayer calculator smoke test passed:', result);
