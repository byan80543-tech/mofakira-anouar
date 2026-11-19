import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');

function extractFunction(name,nextName){
 const start=source.indexOf(`function ${name}(`);
 assert.notEqual(start,-1,`${name} exists in app-core.js`);
 const end=source.indexOf(`\nfunction ${nextName}(`,start);
 assert.notEqual(end,-1,`${nextName} follows ${name}`);
 return source.slice(start,end).trim();
}

const decodeSource=extractFunction('decodeCaptionEntities','parseCaptionFile');
const parseSource=extractFunction('parseCaptionFile','transcriptParagraphs');
const sandbox={};
vm.runInNewContext(
 `${decodeSource}\n${parseSource}\nglobalThis.decodeCaptionEntities=decodeCaptionEntities;\nglobalThis.parseCaptionFile=parseCaptionFile;`,
 sandbox,
 {timeout:1000}
);

const decode=sandbox.decodeCaptionEntities;
const cases=[
 ['&amp;lt;','&lt;','ampersand entity is decoded once, not recursively'],
 ['&amp;quot;','&quot;','nested quote entity is decoded once'],
 ['&lt;','<','less-than entity'],
 ['&gt;','>','greater-than entity'],
 ['&quot;','"','double-quote entity'],
 ['&#39;',"'",'decimal apostrophe entity'],
 ['&apos;',"'",'named apostrophe entity'],
 ['&nbsp;',' ','non-breaking-space entity'],
 ['A &amp; B','A & B','ordinary ampersand text'],
 ['&#60;','<','decimal numeric entity'],
 ['&#38;lt;','&lt;','numeric ampersand does not trigger a second decode'],
 ['&#38;amp;lt;','&amp;lt;','newly generated ampersand entity is not decoded again'],
 ['&amp;#60;','&#60;','numeric entity exposed by ampersand is not decoded again'],
 ['&AMP;LT;','&LT;','case-insensitive entity matching'],
 ['&#0;',' ','zero code point preserves prior invalid-entity behavior'],
 ['&#1114112;',' ','out-of-range code point preserves prior invalid-entity behavior'],
 ['&unknown;','&unknown;','unknown entity remains unchanged'],
 ['plain text','plain text','ordinary text remains unchanged']
];
for(const [input,expected,label] of cases){
 assert.equal(decode(input),expected,label);
}

const vtt='WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;';
assert.equal(
 sandbox.parseCaptionFile(vtt,'vtt'),
 '&lt;script&gt;alert(1)&lt;/script&gt;',
 'VTT import preserves escaped markup as text after one decoding pass'
);
const srt='1\n00:00:01,000 --> 00:00:02,000\n&amp;quot;مرحبا&amp;quot;';
assert.equal(
 sandbox.parseCaptionFile(srt,'srt'),
 '&quot;مرحبا&quot;',
 'SRT import does not recursively decode nested quote entities'
);

console.log(`PASS caption entity decoding: ${cases.length} cases plus VTT/SRT import integration`);
