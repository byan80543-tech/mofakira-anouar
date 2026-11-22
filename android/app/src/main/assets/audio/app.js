(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const bridge=()=>window.AnwarAudioBridge||null;
  const state={
    catalog:null,groups:[],mode:'quran',readerLimit:36,query:'',
    selectedEdition:null,selectedSurah:2,selectedStation:0,
    selectedSeries:0,selectedLesson:0,playMode:'continuous',
    player:{isPlaying:false,mediaId:'',position:0,duration:0,volume:.8},
    scrubbing:false
  };

  const arabicNumber=value=>Number(value||0).toLocaleString('ar');
  const text=(tag,className,value)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    node.textContent=value==null?'':String(value);
    return node;
  };
  const makeButton=(className,label)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=className;
    if(label)button.setAttribute('aria-label',label);
    return button;
  };
  const formatTime=ms=>{
    const total=Math.max(0,Math.floor((Number(ms)||0)/1000));
    return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
  };
  const call=(method,...args)=>{
    const api=bridge();
    if(!api||typeof api[method]!=='function'){
      nativeStatus('لم يكتمل الاتصال بمشغل أنوار بعد.');
      return;
    }
    try{api[method](...args)}catch(_error){nativeStatus('تعذّر تنفيذ أمر التشغيل. أعد المحاولة.')}
  };
  function nativeStatus(message){
    $('audioStatus').textContent=String(message||'');
  }
  function showMode(mode){
    const valid=['quran','radio','lessons','ibtihalat'];
    state.mode=valid.includes(mode)?mode:'quran';
    ['quran','radio','lessons','ibtihalat'].forEach(key=>{
      const screen=$(key+'Screen');
      if(screen)screen.hidden=key!==state.mode;
      const tab=document.querySelector('[data-mode="'+key+'"]');
      if(tab)tab.setAttribute('aria-selected',String(key===state.mode));
    });
    if(state.mode==='radio')renderStations();
    if(state.mode==='lessons')renderLessons();
    if(state.mode==='ibtihalat')renderDevotionals();
    window.scrollTo({top:0,behavior:'instant'});
  }

  function groupReciters(){
    const map=new Map();
    (state.catalog?.editions||[]).forEach(edition=>{
      const name=String(edition.reciterName||'قارئ').trim()||'قارئ';
      const key=name.replace(/\s+/g,' ').toLocaleLowerCase('ar');
      if(!map.has(key))map.set(key,{name,editions:[]});
      map.get(key).editions.push(edition);
    });
    state.groups=Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }

  function makeTulip(className){
    const seal=text('span',className,'');
    seal.setAttribute('aria-hidden','true');
    const image=document.createElement('img');
    image.src='tulip-cutout.svg';
    image.alt='';
    image.loading='lazy';
    image.decoding='async';
    seal.append(image);
    return seal;
  }

  function makeRoseButton(className,label,index,handler){
    const button=makeButton(className,label);
    button.textContent='تشغيل';
    button.dataset.playing='false';
    if(index!==undefined)button.dataset.index=String(index);
    button.addEventListener('click',event=>{
      event.stopPropagation();
      handler();
    });
    return button;
  }

  function renderReciters(){
    const grid=$('reciterGrid');
    grid.replaceChildren();
    const query=String($('rq').value||'').trim().toLocaleLowerCase('ar');
    const matches=state.groups.filter(group=>
      !query||
      group.name.toLocaleLowerCase('ar').includes(query)||
      group.editions.some(edition=>String(edition.displayName||'').toLocaleLowerCase('ar').includes(query))
    );
    const visible=matches.slice(0,state.readerLimit);
    if(!visible.length){
      grid.append(text('div','reciter-empty','لا توجد نتائج بهذا الاسم.'));
    }
    visible.forEach(group=>{
      const card=document.createElement('div');
      card.className='reciter-card';
      card.setAttribute('role','listitem');
      const first=group.editions[0];
      const selected=group.editions.some(edition=>Number(edition.index)===Number(state.selectedEdition));
      card.setAttribute('aria-selected',String(selected));
      card.append(makeTulip('reciter-seal'));

      const body=text('div','reciter-body','');
      body.append(text('span','reciter-name',group.name));
      if(group.editions.length>1){
        const details=document.createElement('details');
        details.className='reciter-variants-menu';
        const summary=document.createElement('summary');
        summary.setAttribute('aria-label','عرض الروايات والتسجيلات');
        summary.title='الروايات والتسجيلات';
        const menu=text('div','reciter-variants','');
        group.editions.forEach(edition=>{
          const option=makeButton('reciter-version',edition.displayName);
          option.textContent=edition.narrationName||edition.displayName;
          option.dataset.playing='false';
          option.addEventListener('click',event=>{
            event.stopPropagation();
            state.selectedEdition=Number(edition.index);
            playEdition(edition);
            details.open=false;
          });
          menu.append(option);
        });
        details.append(summary,menu);
        body.append(details);
      }
      card.append(body);
      const play=makeRoseButton('reciter-play','تشغيل '+group.name,first.index,()=>{
        state.selectedEdition=Number(first.index);
        playEdition(first);
      });
      card.append(play);
      card.addEventListener('click',event=>{
        if(event.target.closest('button,summary'))return;
        state.selectedEdition=Number(first.index);
        renderReciters();
      });
      grid.append(card);
    });
    $('reciterCount').textContent='القرّاء '+arabicNumber(matches.length)+' من '+arabicNumber(state.groups.length);
    const more=$('reciterMore');
    more.hidden=matches.length<=visible.length;
    more.textContent='عرض المزيد من القراء · '+arabicNumber(matches.length-visible.length)+' متبقٍ';
    syncPlayingControls();
  }

  function playEdition(edition){
    if(!edition)return;
    const available=Array.isArray(edition.availableSurahs)?edition.availableSurahs:[];
    if(available.length&&!available.includes(Number(state.selectedSurah))){
      state.selectedSurah=Number(available[0]);
      syncSurahLabel();
    }
    const continuous=state.playMode==='continuous';
    state.selectedEdition=Number(edition.index);
    call('playEdition',Number(edition.index),Number(state.selectedSurah),continuous);
    nativeStatus(continuous?'جارٍ بدء التلاوة المتتابعة…':'جارٍ تشغيل السورة المختارة…');
    renderReciters();
  }

  function syncSurahLabel(){
    const names=state.catalog?.surahNames||[];
    const name=names[state.selectedSurah-1]||'الفاتحة';
    $('surahPickerCurrent').textContent=state.selectedSurah+'. '+name;
  }

  function renderSurahOptions(query){
    const list=$('surahPickerList');
    list.replaceChildren();
    const names=state.catalog?.surahNames||[];
    const q=String(query||'').trim().toLocaleLowerCase('ar');
    let shown=0;
    names.forEach((name,index)=>{
      const number=index+1;
      if(q&&!name.toLocaleLowerCase('ar').includes(q)&&!String(number).includes(q))return;
      const option=makeButton('surah-picker-option',number+'. '+name);
      option.setAttribute('role','option');
      option.setAttribute('aria-selected',String(number===state.selectedSurah));
      option.dataset.surahOption=String(number);
      option.append(makeTulip('surah-picker-option-tulip'));
      const copy=text('span','surah-picker-option-copy','');
      copy.append(text('span','surah-picker-option-number',number+'.'));
      copy.append(text('span','surah-picker-option-name',name));
      option.append(copy);
      list.append(option);
      shown++;
    });
    if(!shown)list.append(text('div','surah-picker-empty','لا توجد سورة بهذا الاسم.'));
  }

  function openSurahPicker(){
    $('surahPickerSearch').value='';
    renderSurahOptions('');
    $('surahPickerModal').hidden=false;
    $('surahPickerButton').setAttribute('aria-expanded','true');
    $('surahPickerSearch').focus();
  }
  function closeSurahPicker(){
    $('surahPickerModal').hidden=true;
    $('surahPickerButton').setAttribute('aria-expanded','false');
    $('surahPickerButton').focus();
  }

  function setPlayMode(mode){
    state.playMode=mode==='single'?'single':'continuous';
    $('readerAdvanceMode').value=state.playMode;
    document.querySelectorAll('input[name="audioMode"]').forEach(input=>{
      input.checked=input.value===state.playMode;
    });
  }

  function renderStations(){
    const grid=$('stationGrid');
    grid.replaceChildren();
    const query=String($('stationSearch').value||'').trim().toLocaleLowerCase('ar');
    const stations=state.catalog?.stations||[];
    const matches=stations.filter(station=>!query||String(station.name).toLocaleLowerCase('ar').includes(query));
    matches.forEach(station=>{
      const card=makeButton('live-station-option',station.name);
      const selected=Number(station.index)===Number(state.selectedStation);
      card.setAttribute('aria-selected',String(selected));
      card.append(makeTulip('station-tulip'));
      card.append(text('span','station-name',station.name));
      const play=makeRoseButton('reciter-play station-play','تشغيل '+station.name,station.index,()=>{
        state.selectedStation=Number(station.index);
        call('playStation',Number(station.index));
        renderStations();
      });
      card.append(play);
      card.addEventListener('click',event=>{
        if(event.target.closest('.station-play'))return;
        state.selectedStation=Number(station.index);
        renderStations();
      });
      grid.append(card);
    });
    if(!matches.length)grid.append(text('div','reciter-empty','لا توجد محطة بهذا الاسم.'));
    $('stationCount').textContent='المحطات '+arabicNumber(matches.length);
  }

  function seriesGroups(){
    const series=state.catalog?.lessonSeries||[];
    const names={
      tawhid:'شرح كتاب التوحيد',
      wasitiyya:'شروح العقيدة',
      dawa:'شروح أخرى',
      usul:'أصول العقيدة',
      usul2:'أصول العقيدة',
      qawaid:'أصول العقيدة',
      nawqid:'أصول العقيدة',
      kashf:'أصول العقيدة',
      masail:'شروح أخرى',
      sharia:'شروح أخرى',
      maarij:'شروح أخرى',
      jawhara:'شروح أخرى',
      kabair:'شروح أخرى',
      usulIman:'أصول العقيدة',
      usulAqaid:'أصول العقيدة'
    };
    const groups=new Map();
    series.forEach(item=>{
      const group=names[item.id]||'سلاسل علمية أخرى';
      if(!groups.has(group))groups.set(group,[]);
      groups.get(group).push(item);
    });
    return groups;
  }

  function renderSeriesOptions(query){
    const list=$('lessonSeriesList');
    list.replaceChildren();
    const q=String(query||'').trim().toLocaleLowerCase('ar');
    for(const [groupName,series] of seriesGroups()){
      const section=text('section','lesson-series-group','');
      section.append(text('div','lesson-series-group-title',groupName));
      let shown=0;
      series.forEach(item=>{
        const searchable=String(item.title||'').toLocaleLowerCase('ar');
        if(q&&!searchable.includes(q)&&!groupName.toLocaleLowerCase('ar').includes(q))return;
        const button=makeButton('lesson-series-option',item.title);
        button.dataset.seriesOption=String(item.index);
        button.setAttribute('role','option');
        button.setAttribute('aria-selected',String(Number(item.index)===Number(state.selectedSeries)));
        button.append(makeTulip('lesson-series-option-tulip'));
        const copy=text('span','lesson-series-option-copy','');
        copy.append(text('span','lesson-series-option-name',item.title));
        copy.append(text('span','lesson-series-option-meta',arabicNumber(item.count)+' درسًا'));
        button.append(copy);
        button.append(text('span','lesson-series-option-check',Number(item.index)===Number(state.selectedSeries)?'✓':''));
        section.append(button);
        shown++;
      });
      if(shown)list.append(section);
    }
    if(!list.children.length)list.append(text('div','lesson-series-empty','لا توجد سلسلة بهذا الاسم.'));
  }

  function openSeriesModal(){
    $('lessonSeriesSearch').value='';
    renderSeriesOptions('');
    $('lessonSeriesModal').hidden=false;
    $('lessonSeriesButton').setAttribute('aria-expanded','true');
    $('lessonSeriesSearch').focus();
  }
  function closeSeriesModal(){
    $('lessonSeriesModal').hidden=true;
    $('lessonSeriesButton').setAttribute('aria-expanded','false');
    $('lessonSeriesButton').focus();
  }

  function renderLessons(){
    const series=state.catalog?.lessonSeries||[];
    const selected=series.find(item=>Number(item.index)===Number(state.selectedSeries))||series[0];
    if(!selected){
      $('lessonList').replaceChildren(text('div','lesson-empty','لا تتوفر سلسلة الآن.'));
      return;
    }
    state.selectedSeries=Number(selected.index);
    $('lessonSeriesCurrent').textContent=selected.title;
    $('lessonCount').textContent=arabicNumber(selected.count)+' درسًا';
    const list=$('lessonList');
    list.replaceChildren();
    for(let index=0;index<Number(selected.count);index++){
      const name=selected.tracks?.[index]||('الدرس '+String(index+1).padStart(2,'0')+' من '+selected.count);
      const item=makeButton('lesson-item',name);
      item.dataset.lessonIndex=String(index);
      item.setAttribute('aria-current',String(index===state.selectedLesson));
      item.append(makeTulip('lesson-tulip'));
      item.append(text('span','lesson-item-name',name));
      const play=makeRoseButton('reciter-play lesson-item-play','تشغيل '+name,index,()=>{
        state.selectedLesson=index;
        call('playLesson',Number(selected.index),index);
        renderLessons();
      });
      item.append(play);
      item.addEventListener('click',event=>{
        if(event.target.closest('.lesson-item-play'))return;
        state.selectedLesson=index;
        call('playLesson',Number(selected.index),index);
        renderLessons();
      });
      list.append(item);
    }
    $('lessonSourceButton').onclick=()=>call('openSource',String(selected.sourceUrl||''));
    $('playLessonSeries').onclick=()=>call('playLesson',Number(selected.index),0);
  }

  function renderDevotionals(){
    const list=$('devotionalList');
    list.replaceChildren();
    const tracks=state.catalog?.devotionalTracks||[];
    $('devotionalCount').textContent=arabicNumber(tracks.length)+' صوتيات';
    tracks.forEach(track=>{
      const item=makeButton('lesson-item',track.title);
      item.append(makeTulip('lesson-tulip'));
      item.append(text('span','lesson-item-name',track.title+' · '+(track.sourceLabel||'')));
      const play=makeRoseButton('lesson-item-play','تشغيل '+track.title,track.index,()=>call('playDevotional',Number(track.index)));
      item.append(play);
      item.addEventListener('click',event=>{
        if(event.target.closest('.lesson-item-play'))return;
        call('playDevotional',Number(track.index));
      });
      list.append(item);
    });
    if(!tracks.length)list.append(text('div','lesson-empty','لا تتوفر ابتهالات الآن.'));
  }

  function syncPlayingControls(){
    const player=state.player;
    $('rpp').dataset.playing=String(!!player.isPlaying);
    $('rpp').setAttribute('aria-label',player.isPlaying?'إيقاف مؤقت':'استئناف التشغيل');
    $('rpp').textContent=player.isPlaying?'إيقاف مؤقت':'تشغيل';
    $('nowPlayingTitle').textContent=player.title||'إذاعة أنوار القرآنية';
    $('nowPlayingArtist').textContent=player.artist||'المشغل الأصلي لمفكرة أنوار';
    const volume=$('volumeRange');
    if(!state.volumeTouched&&volume)volume.value=String(Math.max(0,Math.min(1,Number(player.volume)||0)));
    const duration=Number(player.duration)||0;
    const position=Number(player.position)||0;
    if(!state.scrubbing){
      $('seekRange').value=duration>0?String(Math.min(1000,Math.round(position/duration*1000))):'0';
    }
    $('elapsedTime').textContent=formatTime(position);
    $('durationTime').textContent=formatTime(duration);
    const playingId=String(player.mediaId||'');
    const activeSeries=playingId.match(/^lesson:([^:]+):(\d+)$/);
    document.querySelectorAll('.reciter-play[data-index],.reciter-version[data-index]').forEach(button=>{
      const active=button.dataset.index!==undefined&&playingId.startsWith('quran:')&&
        Number(button.dataset.index)===Number(state.selectedEdition);
      button.dataset.playing=String(!!(active&&player.isPlaying));
    });
    document.querySelectorAll('.lesson-item-play[data-index]').forEach(button=>{
      const active=!!activeSeries&&Number(button.dataset.index)===Number(activeSeries[2]);
      button.dataset.playing=String(!!(active&&player.isPlaying));
    });
    document.querySelectorAll('.station-play[data-index]').forEach(button=>{
      const active=playingId.startsWith('radio:')&&Number(button.dataset.index)===Number(state.selectedStation);
      button.dataset.playing=String(!!(active&&player.isPlaying));
    });
    document.querySelectorAll('[data-lesson-index]').forEach(item=>{
      item.setAttribute('aria-current',String(!!activeSeries&&Number(item.dataset.lessonIndex)===Number(activeSeries[2])));
    });

  }

  function setLaunchMode(mode){
    showMode(mode);
  }

  function onCatalog(raw){
    try{state.catalog=typeof raw==='string'?JSON.parse(raw):raw}catch(_error){
      nativeStatus('تعذّر قراءة فهرس المكتبة الصوتية.');
      return;
    }
    groupReciters();
    if(state.catalog.editions?.length){
      const first=state.catalog.editions[0];
      state.selectedEdition=Number(first.index);
      const available=first.availableSurahs||[];
      if(available.length&&!available.includes(state.selectedSurah))state.selectedSurah=Number(available[0]);
    }
    renderReciters();
    renderStations();
    renderLessons();
    renderDevotionals();
    syncSurahLabel();
    $('catalogLoading').hidden=true;
    nativeStatus('تم تجهيز القراء والروايات والمحطات والسلاسل.');
  }

  function onPlayerState(raw){
    state.player=typeof raw==='string'?JSON.parse(raw):raw;
    const id=String(state.player.mediaId||'');
    if(id.startsWith('quran:')){
      const parts=id.split(':');
      const server=parts.slice(1,-1).join(':');
      const edition=(state.catalog?.editions||[]).find(item=>String(item.serverUrl).replace(/\/+$/,'')===server.replace(/\/+$/,''));
      if(edition)state.selectedEdition=Number(edition.index);
      const surah=Number(parts[parts.length-1]);
      if(surah>=1&&surah<=114)state.selectedSurah=surah;
      syncSurahLabel();
    }else if(id.startsWith('lesson:')){
      const parts=id.split(':');
      const series=(state.catalog?.lessonSeries||[]).find(item=>item.id===parts[1]);
      if(series){
        state.selectedSeries=Number(series.index);
        state.selectedLesson=Number(parts[2]||0);
        if(state.mode==='lessons')renderLessons();
      }
    }else if(id.startsWith('radio:')){
      const station=(state.catalog?.stations||[]).find(item=>item.url===id.slice(6));
      if(station)state.selectedStation=Number(station.index);
    }
    syncPlayingControls();
  }

  function onNativeStatus(message){
    nativeStatus(message);
  }

  $('audioClose').addEventListener('click',()=>call('close'));
  $('serviceBack').addEventListener('click',()=>call('close'));
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>showMode(button.dataset.mode)));
  $('quickRadioButton').addEventListener('click',()=>showMode('radio'));
  $('rq').addEventListener('input',()=>{state.readerLimit=36;renderReciters()});
  $('reciterMore').addEventListener('click',()=>{state.readerLimit+=36;renderReciters()});
  $('surahPickerButton').addEventListener('click',openSurahPicker);
  $('surahPickerClose').addEventListener('click',closeSurahPicker);
  $('surahPickerSearch').addEventListener('input',()=>renderSurahOptions($('surahPickerSearch').value));
  $('surahPickerList').addEventListener('click',event=>{
    const option=event.target.closest('[data-surah-option]');
    if(!option)return;
    state.selectedSurah=Number(option.dataset.surahOption);
    syncSurahLabel();
    closeSurahPicker();
    if(state.player.mediaId?.startsWith('quran:')&&state.selectedEdition!==null){
      const edition=(state.catalog.editions||[]).find(item=>Number(item.index)===Number(state.selectedEdition));
      if(edition)playEdition(edition);
    }
  });
  $('readerAdvanceMode').addEventListener('change',()=>setPlayMode($('readerAdvanceMode').value));
  document.querySelectorAll('input[name="audioMode"]').forEach(input=>input.addEventListener('change',()=>{
    if(input.value==='live'){showMode('radio');return;}
    setPlayMode(input.value);
  }));
  $('stationSearch').addEventListener('input',renderStations);
  $('playSelectedStation').addEventListener('click',()=>call('playStation',Number(state.selectedStation)));
  $('lessonSeriesButton').addEventListener('click',openSeriesModal);
  $('lessonSeriesClose').addEventListener('click',closeSeriesModal);
  $('lessonSeriesSearch').addEventListener('input',()=>renderSeriesOptions($('lessonSeriesSearch').value));
  $('lessonSeriesList').addEventListener('click',event=>{
    const option=event.target.closest('[data-series-option]');
    if(!option)return;
    state.selectedSeries=Number(option.dataset.seriesOption);
    state.selectedLesson=0;
    renderLessons();
    closeSeriesModal();
  });
  $('surahPickerModal').addEventListener('click',event=>{if(event.target===$('surahPickerModal'))closeSurahPicker()});
  $('lessonSeriesModal').addEventListener('click',event=>{if(event.target===$('lessonSeriesModal'))closeSeriesModal()});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(!$('surahPickerModal').hidden)closeSurahPicker();
      if(!$('lessonSeriesModal').hidden)closeSeriesModal();
    }
  });
  $('rpp').addEventListener('click',()=>call('togglePlayback'));
  $('previousTrack').addEventListener('click',()=>call('previous'));
  $('nextTrack').addEventListener('click',()=>call('next'));
  $('volumeRange').addEventListener('input',()=>{
    state.volumeTouched=true;
    call('setVolume',Number($('volumeRange').value));
  });
  $('seekRange').addEventListener('pointerdown',()=>state.scrubbing=true);
  $('seekRange').addEventListener('input',()=>{state.scrubbing=true});
  $('seekRange').addEventListener('change',()=>{
    const duration=Number(state.player.duration)||0;
    if(duration>0)call('seekTo',Math.round(duration*(Number($('seekRange').value)/1000)));
    state.scrubbing=false;
  });

  window.AnwarAudio={
    setLaunchMode,onCatalog,onPlayerState,onNativeStatus,
    _state:state
  };
  const launch=()=>call('requestCatalog');
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',launch,{once:true});
  else launch();
})();
