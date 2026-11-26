import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {PrayTime}=require('../vendor/praytime.js');
assert.equal(typeof PrayTime,'function');
require('../local-prayer-engine.js');
const engine=globalThis.AnwarLocalPrayerEngine;
const official = [
 ['01','05:12','06:36','12:11','15:07','17:36','18:49'],
 ['02','05:13','06:37','12:11','15:06','17:35','18:49'],
 ['03','05:13','06:38','12:11','15:06','17:34','18:48'],
 ['04','05:14','06:39','12:11','15:05','17:33','18:47'],
 ['05','05:15','06:40','12:11','15:04','17:32','18:46'],
 ['06','05:16','06:41','12:11','15:04','17:31','18:46'],
 ['07','05:16','06:42','12:11','15:03','17:31','18:45'],
 ['08','05:17','06:43','12:11','15:02','17:30','18:44'],
 ['09','05:18','06:44','12:11','15:02','17:29','18:44'],
 ['10','05:19','06:45','12:11','15:01','17:28','18:43'],
 ['11','05:20','06:45','12:11','15:01','17:28','18:42'],
 ['12','05:20','06:46','12:11','15:00','17:27','18:42'],
 ['13','05:21','06:47','12:12','15:00','17:26','18:41'],
 ['14','05:22','06:48','12:12','14:59','17:26','18:41'],
 ['15','05:23','06:49','12:12','14:59','17:25','18:40'],
 ['16','05:24','06:50','12:12','14:58','17:24','18:40'],
 ['17','05:24','06:51','12:12','14:58','17:24','18:40'],
 ['18','05:25','06:52','12:12','14:57','17:23','18:39'],
 ['19','05:26','06:53','12:13','14:57','17:23','18:39'],
 ['20','05:27','06:54','12:13','14:57','17:22','18:38'],
 ['21','05:28','06:55','12:13','14:56','17:22','18:38'],
 ['22','05:28','06:56','12:13','14:56','17:22','18:38'],
 ['23','05:29','06:57','12:14','14:56','17:21','18:38'],
 ['24','05:30','06:58','12:14','14:56','17:21','18:37'],
 ['25','05:31','06:58','12:14','14:55','17:21','18:37'],
 ['26','05:32','06:59','12:15','14:55','17:20','18:37'],
 ['27','05:32','07:00','12:15','14:55','17:20','18:37'],
 ['28','05:33','07:01','12:15','14:55','17:20','18:37'],
 ['29','05:34','07:02','12:16','14:55','17:20','18:37'],
 ['30','05:35','07:03','12:16','14:55','17:20','18:37']
];
const keys=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
function mins(value){const [h,m]=value.split(':').map(Number);return h*60+m}
const rows=official.map(([day,...published])=>{
 const dateText=day+'-11-2026';
 const data=engine.calculateDay({dateText,country:'Morocco',city:'Meknes',method:'21',school:'0'});
 const calculated=keys.map(key=>data.timings[key]);
 const differences=calculated.map((value,i)=>mins(value)-mins(published[i]));
 return {date:dateText,published,calculated,differences,maxAbsDifference:Math.max(...differences.map(Math.abs))};
});
console.log('MEKNES_OFFICIAL_PARITY='+JSON.stringify(rows));
const worst=Math.max(...rows.map(row=>row.maxAbsDifference));
assert.ok(worst<=1,'Every one of the six daily times must match the published Meknes table within one minute; maximum difference was '+worst+' minutes.');
console.log('Moroccan Meknes official timetable parity passed for 30 days; maximum difference: '+worst+' minute(s).');
