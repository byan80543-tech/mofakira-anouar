/* Offline prayer calculator and bundled city coordinates. */
(function(root){
'use strict';
const C=[
['Morocco','Meknes',['مكناس','Mequinez'],33.8935,-5.5473,'Africa/Casablanca'],['Morocco','Fes',['فاس','Fez'],34.0331,-5.0003,'Africa/Casablanca'],
['Morocco','Casablanca',['الدار البيضاء'],33.5731,-7.5898,'Africa/Casablanca'],['Morocco','Rabat',['الرباط'],34.0209,-6.8416,'Africa/Casablanca'],
['Morocco','Tangier',['طنجة','Tanger'],35.7595,-5.8340,'Africa/Casablanca'],['Morocco','Marrakech',['مراكش','Marrakesh'],31.6295,-7.9811,'Africa/Casablanca'],
['Morocco','Agadir',['أكادير','اكادير'],30.4278,-9.5981,'Africa/Casablanca'],['Morocco','Oujda',['وجدة'],34.6814,-1.9086,'Africa/Casablanca'],
['Morocco','Tetouan',['تطوان'],35.5889,-5.3626,'Africa/Casablanca'],['Morocco','Kenitra',['القنيطرة'],34.2610,-6.5802,'Africa/Casablanca'],
['Morocco','Safi',['آسفي','اسفي'],32.2994,-9.2372,'Africa/Casablanca'],['Morocco','Taza',['تازة'],34.2132,-4.0103,'Africa/Casablanca'],
['Morocco','Al Hoceima',['الحسيمة','Hoceima'],35.2493,-3.9371,'Africa/Casablanca'],['Morocco','Nador',['الناظور'],35.1681,-2.9335,'Africa/Casablanca'],
['Morocco','Beni Mellal',['بني ملال'],32.3373,-6.3498,'Africa/Casablanca'],['Morocco','Khouribga',['خريبكة'],32.8811,-6.9063,'Africa/Casablanca'],
['Morocco','Settat',['سطات'],33.0010,-7.6166,'Africa/Casablanca'],['Morocco','Berkane',['بركان'],34.9204,-2.3196,'Africa/Casablanca'],
['Morocco','Larache',['العرائش'],35.1932,-6.1557,'Africa/Casablanca'],['Morocco','Essaouira',['الصويرة'],31.5085,-9.7595,'Africa/Casablanca'],
['Morocco','Taroudant',['تارودانت'],30.4703,-8.8769,'Africa/Casablanca'],['Morocco','Guelmim',['كلميم'],28.9870,-10.0574,'Africa/Casablanca'],
['Morocco','Dakhla',['الداخلة'],23.6848,-15.9579,'Africa/Casablanca'],['Algeria','Algiers',['الجزائر','Alger'],36.7538,3.0588,'Africa/Algiers'],
['Tunisia','Tunis',['تونس'],36.8065,10.1815,'Africa/Tunis'],['Libya','Tripoli',['طرابلس'],32.8872,13.1913,'Africa/Tripoli'],
['Egypt','Cairo',['القاهرة'],30.0444,31.2357,'Africa/Cairo'],['Sudan','Khartoum',['الخرطوم'],15.5007,32.5599,'Africa/Khartoum'],
['Mauritania','Nouakchott',['نواكشوط'],18.0735,-15.9582,'Africa/Nouakchott'],['Somalia','Mogadishu',['مقديشو'],2.0469,45.3182,'Africa/Mogadishu'],
['Djibouti','Djibouti',['جيبوتي'],11.5721,43.1456,'Africa/Djibouti'],['Comoros','Moroni',['موروني'],-11.7172,43.2473,'Indian/Comoro'],
['Saudi Arabia','Riyadh',['الرياض'],24.7136,46.6753,'Asia/Riyadh'],['Yemen','Sanaa',['صنعاء','Sana'],15.3694,44.1910,'Asia/Aden'],
['Oman','Muscat',['مسقط'],23.5880,58.3829,'Asia/Muscat'],['United Arab Emirates','Abu Dhabi',['أبو ظبي','ابوظبي'],24.4539,54.3773,'Asia/Dubai'],
['Qatar','Doha',['الدوحة'],25.2854,51.5310,'Asia/Qatar'],['Bahrain','Manama',['المنامة'],26.2285,50.5860,'Asia/Bahrain'],
['Kuwait','Kuwait City',['مدينة الكويت','الكويت'],29.3759,47.9774,'Asia/Kuwait'],['Iraq','Baghdad',['بغداد'],33.3152,44.3661,'Asia/Baghdad'],
['Syria','Damascus',['دمشق'],33.5138,36.2765,'Asia/Damascus'],['Lebanon','Beirut',['بيروت'],33.8938,35.5018,'Asia/Beirut'],
['Jordan','Amman',['عمان','عمّان'],31.9539,35.9106,'Asia/Amman'],['Palestine','Gaza',['غزة'],31.5017,34.4668,'Asia/Gaza'],
['Turkey','Ankara',['أنقرة','انقرة'],39.9334,32.8597,'Europe/Istanbul'],['France','Paris',['باريس'],48.8566,2.3522,'Europe/Paris'],
['Germany','Berlin',['برلين'],52.5200,13.4050,'Europe/Berlin'],['United Kingdom','London',['لندن'],51.5072,-0.1276,'Europe/London'],
['United States','Washington',['واشنطن','Washington DC','Washington, DC'],38.9072,-77.0369,'America/New_York'],
['Canada','Ottawa',['أوتاوا','اوتاوا'],45.4215,-75.6972,'America/Toronto'],['Pakistan','Islamabad',['إسلام آباد','اسلام اباد'],33.6844,73.0479,'Asia/Karachi'],
['India','New Delhi',['نيودلهي','دلهي','Delhi'],28.6139,77.2090,'Asia/Kolkata'],['Malaysia','Kuala Lumpur',['كوالالمبور'],3.1390,101.6869,'Asia/Kuala_Lumpur'],
['Indonesia','Jakarta',['جاكرتا'],-6.2088,106.8456,'Asia/Jakarta']
];
const CA={'المغرب':'Morocco','الجزائر':'Algeria','تونس':'Tunisia','ليبيا':'Libya','مصر':'Egypt','السودان':'Sudan','موريتانيا':'Mauritania','الصومال':'Somalia','جيبوتي':'Djibouti','جزر القمر':'Comoros','السعودية':'Saudi Arabia','اليمن':'Yemen','عمان':'Oman','الإمارات':'United Arab Emirates','قطر':'Qatar','الكويت':'Kuwait','البحرين':'Bahrain','العراق':'Iraq','سوريا':'Syria','لبنان':'Lebanon','الأردن':'Jordan','فلسطين':'Palestine','تركيا':'Turkey','فرنسا':'France','ألمانيا':'Germany','بريطانيا':'United Kingdom','الولايات المتحدة':'United States','كندا':'Canada','باكستان':'Pakistan','الهند':'India','ماليزيا':'Malaysia','إندونيسيا':'Indonesia'};
const M={'1':{base:'Karachi',label:'Karachi'},'2':{base:'ISNA',label:'ISNA'},'3':{base:'MWL',label:'MWL'},'4':{base:'Makkah',label:'Umm al-Qura'},'5':{base:'Egypt',label:'Egypt'},'8':{base:'MWL',label:'Gulf',adjust:{fajr:19.5,isha:'90 min'}},'9':{base:'MWL',label:'Kuwait',adjust:{fajr:18,isha:17.5}},'10':{base:'MWL',label:'Qatar',adjust:{fajr:18,isha:'90 min'}},'12':{base:'France',label:'France'},'13':{base:'MWL',label:'Turkey',adjust:{fajr:18,isha:17}},'17':{base:'Malaysia',label:'Malaysia'},'18':{base:'MWL',label:'Tunisia',adjust:{fajr:18,isha:18}},'19':{base:'MWL',label:'Algeria',adjust:{fajr:18,isha:17}},'21':{base:'MWL',label:'Morocco',adjust:{fajr:19,isha:17}},'23':{base:'MWL',label:'Jordan',adjust:{fajr:18,isha:18}}};
function norm(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[.,،]/g,' ').replace(/\s+/g,' ').trim()}
function placeFor(country,city){const c=CA[String(country||'').trim()]||String(country||'').trim(),n=norm(city);return C.find(x=>x[0]===c&&[x[1],...x[2]].some(a=>norm(a)===n))||null}
function getTimezone(country,city){const p=placeFor(country,city);return p?p[5]:''}
function hijri(dateText,tz){try{const a=dateText.split('-').map(Number),d=new Date(Date.UTC(a[2],a[1]-1,a[0],12)),p=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{timeZone:tz,day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(d),v=t=>p.find(x=>x.type===t)?.value||'',y=(v('year').match(/\d+/)||[])[0]||'';return v('day')&&v('month')&&y?v('day')+'-'+v('month')+'-'+y:''}catch(_e){return ''}}
function calculateDay(o){
 o=o&&typeof o==='object'?o:{};
 const date=String(o.dateText||''),a=date.split('-').map(Number),valid=new Date(Date.UTC(a[2],a[1]-1,a[0]));
 if(a.length!==3||a.some(n=>!Number.isInteger(n))||a[0]<1||a[0]>31||a[1]<1||a[1]>12||a[2]<1900||a[2]>2200||valid.getUTCDate()!==a[0]||valid.getUTCMonth()+1!==a[1])throw Error('تاريخ المواقيت غير صالح.');
 const p=placeFor(o.country,o.city);
 if(!p)throw Error('هذه المدينة غير مدرجة بعد في جدول الحساب المحلي. اختر مدينة مدعومة بدل إرسال موقعك إلى خدمة خارجية.');
 if(typeof root.PrayTime!=='function')throw Error('محرك الحساب المحلي غير جاهز. أعد تحميل مفكرة أنوار بعد تحديثها.');
 const m=M[String(o.method||'')]||{base:'MWL',label:'MWL (default)'},calc=new root.PrayTime(m.base);
 calc.location([p[3],p[4]]).timezone(p[5]).format('24h').round('nearest');
 calc.adjust(Object.assign({asr:o.school==='1'?'Hanafi':'Standard',highLats:'NightMiddle'},m.adjust||{}));
 // Moroccan Habous timetable calibration: keep the city's IANA timezone and apply the published solar-event offsets.
 if(String(o.method)==='21')calc.tune({sunrise:-5,dhuhr:5,maghrib:5});
 const t=calc.times([a[2],a[1],a[0]]),timings={Fajr:t.fajr,Sunrise:t.sunrise,Dhuhr:t.dhuhr,Asr:t.asr,Sunset:t.sunset,Maghrib:t.maghrib,Isha:t.isha};
 for(const k of ['Fajr','Dhuhr','Asr','Maghrib','Isha'])if(!/^\d{2}:\d{2}$/.test(String(timings[k]||'')))throw Error('تعذّر حساب '+k+' لهذه المدينة والتاريخ محليًا.');
 return {timings,date:{gregorian:{date:date},hijri:{date:hijri(date,p[5])}},meta:{timezone:p[5],source:'local',method:m.label,city:p[1]}};
}
function listSupportedCities(){return C.map(p=>({country:p[0],city:p[1],timezone:p[5]}))}
root.AnwarLocalPrayerEngine=Object.freeze({calculateDay,getTimezone,listSupportedCities});
if(typeof module!=='undefined'&&module.exports)module.exports=root.AnwarLocalPrayerEngine;
})(globalThis);
