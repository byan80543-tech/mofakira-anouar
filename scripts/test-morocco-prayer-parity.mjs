import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {PrayTime}=require('../vendor/praytime.js');
assert.equal(typeof PrayTime,'function');
require('../local-prayer-engine.js');
const engine=globalThis.AnwarLocalPrayerEngine;
const official=[
 ['24-11-2026','05:30','06:58','12:14','14:56','17:21','18:37'],
 ['25-11-2026','05:31','06:58','12:14','14:55','17:21','18:37'],
 ['26-11-2026','05:32','06:59','12:15','14:55','17:20','18:37'],
 ['27-11-2026','05:32','07:00','12:15','14:55','17:20','18:37'],
 ['28-11-2026','05:33','07:01','12:15','14:55','17:20','18:37'],
 ['29-11-2026','05:34','07:02','12:16','14:55','17:20','18:37'],
 ['30-11-2026','05:35','07:03','12:16','14:55','17:20','18:37']
];
const keys=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
const rows=official.map(([dateText,...published])=>{
 const data=engine.calculateDay({dateText,country:'Morocco',city:'Meknes',method:'21',school:'0'});
 return {date:dateText,published,calculated:keys.map(key=>data.timings[key])};
});
console.log('MEKNES_OFFICIAL_PARITY='+JSON.stringify(rows));
