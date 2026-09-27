/* 教材に沿った採点練習。旧単語カードの記録とは分けて保存する。 */
const P = {mode:'word-choice', scope:'lesson', count:10, session:null, records:{}, draft:'', hint:false, warning:''};
const MODES = {'word-choice':['単語｜意味を選ぶ','韓国語を見て、日本語を選びます。'], 'word-input':['単語｜韓国語を書く','日本語から辞書形を入力します。'], 'grammar-fill':['文法｜穴埋め','場面に合う形を入力します。']};
const norm = s => String(s).normalize('NFC').replace(/[\s.,!?。、！？]/g,'');
function shuffle(a){a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function initPractice(){
 const raw=LS.get('practice.v1',{});P.records=raw && typeof raw==='object' && !Array.isArray(raw)?raw:{};
 P.mode=LS.get('practiceMode','word-choice');if(!MODES[P.mode])P.mode='word-choice';
 S.lesson=Math.max(1,Math.min(12,Number(LS.get('practiceLesson',1))||1));
}
function questions(mode=P.mode){
 if(mode.startsWith('word'))return allWords().map((w,i)=>({id:`${mode}:${w.n}:${w.ko}`,n:w.n,mode,w,answers:[w.ko,...(w.ko.includes('(을)')?[w.ko.replace('(을)','을'),w.ko.replace('(을)','')]:[])],jp:w.jp,full:w.ko}));
 return (S.data.practice||[]).map(q=>({...q,id:`${mode}:${q.id}`,n:q.lesson,mode,answers:q.answers}));
}
function pool(){return questions().filter(q=>P.scope==='all'||(P.scope==='mistakes'?P.records[q.id]?.last===false:q.n===S.lesson))}
function setupQuestion(){
 P.draft='';P.hint=false;P.warning='';
 const q=P.session.queue[P.session.idx];
 if(q.mode==='word-choice'){
  let others=allWords().filter(w=>w.jp!==q.w.jp && w.ko!==q.w.ko);
  const same=others.filter(w=>w.pos===q.w.pos);others=shuffle(same).concat(shuffle(others));
  const choices=[q.w.jp];for(const w of others)if(!choices.includes(w.jp)&&choices.length<4)choices.push(w.jp);
  P.session.choices=shuffle(choices);
 }

}
function startPractice(list){
 const qs=list||shuffle(pool()).slice(0,P.count===0?undefined:P.count);
 if(!qs.length)return;
 P.session={queue:qs,idx:0,results:[],answered:false,finished:false,choices:[]};setupQuestion();render();
}
function submitPractice(value,skip=false){
 const s=P.session;if(!s||s.answered||s.finished)return;
 const q=s.queue[s.idx];const answer=value??P.draft;
 if(!skip && !norm(answer)){P.warning='答えを入力するか、「わからない」を選びましょう。';render();return}
 const accepted=q.mode==='word-choice'?[q.w.jp]:q.answers;
 const ok=!skip&&accepted.some(a=>norm(a)===norm(answer));
 const record=P.records[q.id]||{};
 P.records[q.id]={attempts:(Number(record.attempts)||0)+1,correct:(Number(record.correct)||0)+(ok?1:0),last:ok,updated:new Date().toISOString()};
 LS.set('practice.v1',P.records);
 s.results.push({id:q.id,ok,answer,skip,hint:P.hint});s.answered=true;P.warning='';render();
 document.querySelector('.feedback')?.focus();
}
function questionHint(q){
 if(q.mode==='word-input')return `最初の文字：${q.w.ko[0]}　／　${q.w.pos||'ことば'}`;
 const l=S.data.lessons.find(l=>l.n===q.n);const g=l.grammar[q.grammar];
 return `${g.form}：${g.say}`;
}
function feedback(q,result){
 const g=q.mode.startsWith('grammar')?S.data.lessons.find(l=>l.n===q.n).grammar[q.grammar]:null;
 const detail=g?`<div class="explanation">${esc(g.body||g.say).replace(/\n/g,'<br>')}</div>`:(q.w.ex?`<div class="ko" lang="ko">${esc(q.w.ex.ko)}</div><div>${esc(q.w.ex.jp)}</div>`:'');
 const correct=q.mode==='word-choice'?q.w.jp:q.mode==='grammar-fill'?q.answers[0]:q.full;
 return `<section class="feedback ${result.ok?'correct':'incorrect'}" tabindex="-1" aria-live="polite"><h3>${result.ok?'正解！':result.skip?'答えを確認しましょう':'もう一度、形を確認しましょう'}</h3>${!result.ok&&!result.skip?`<p>あなたの答え：${esc(result.answer)}</p>`:''}<p><strong>正解：</strong><span lang="${q.mode==='word-choice'?'ja':'ko'}">${esc(correct)}</span></p>${g?`<p class="ko" lang="ko">${esc(q.full)}</p><p>${esc(q.jp)}</p>`:''}${detail}</section>`;
}
function sessionView(){
 const s=P.session;
 if(s.finished){
  const right=s.results.filter(x=>x.ok).length;const missed=s.queue.filter((q,i)=>!s.results[i].ok);const helped=s.results.filter(x=>x.hint).length;
  return `<section class="practice-hero"><span class="eyebrow">練習結果</span><h2>${right} / ${s.queue.length} 問正解</h2><p>${missed.length?'間違えた問題を、もう一度。':'このセットを完了しました。別の練習にも挑戦しましょう。'}</p>${helped?`<small>ヒントを使った問題：${helped}問</small>`:''}</section><div class="row">${missed.length?'<button class="btn primary" data-pr="retry">間違いだけ再挑戦</button>':''}<button class="btn" data-pr="home">練習を選ぶ</button></div>${s.queue.map((q,i)=>`<div class="card result-item"><strong>${s.results[i].ok?'○':'復習'}　 第${q.n}課</strong><div>${esc(q.mode.startsWith('word')?q.w.ko+'：'+q.w.jp:q.full)}</div></div>`).join('')}`;
 }
 const q=s.queue[s.idx];const answered=s.answered;let input='';
 if(q.mode==='word-choice')input=`<div class="options">${s.choices.map((v,i)=>`<button class="btn option" data-option="${i}" ${answered?'disabled':''}>${esc(v)}</button>`).join('')}</div>`;
 else input=`<label class="answer-label" for="practice-answer">${q.mode==='word-input'?'韓国語（辞書形）':'空欄に入る韓国語'}</label><input id="practice-answer" class="answer-input ko" type="text" lang="ko" value="${esc(P.draft)}" placeholder="ここに入力" autocomplete="off" autocapitalize="off" spellcheck="false" ${answered?'disabled':''}><div class="tapnote">空白・文末の句読点は採点に含めません。</div>`;
 let prompt=q.mode==='word-choice'?q.w.ko:q.mode==='word-input'?q.w.jp:q.mode==='grammar-fill'?q.blank.replace('___','（　　　）'):q.jp;
 return `<div class="session-top"><span>${esc(MODES[q.mode][0])}・第${q.n}課</span><button class="text-btn" data-pr="pause">中断</button></div><div class="bar"><i style="width:${(s.idx+(answered?1:0))/s.queue.length*100}%"></i></div><p class="progress-label">${s.idx+1} / ${s.queue.length} 問</p><section class="card question"><h2 class="ko" lang="${q.mode==='word-input'?'ja':'ko'}">${esc(prompt)}</h2>${q.mode==='grammar-fill'?`<p>${esc(q.jp)}</p><p class="prompt">${esc(q.prompt)}</p>`:''}${q.mode==='word-input'&&q.w.form?'<p class="prompt">「〜ます」ではなく、辞書形で答えましょう。</p>':''}${input}${P.warning?`<p role="alert">${esc(P.warning)}</p>`:''}</section>${!answered?`<div class="row">${q.mode!=='word-choice'?'<button class="btn primary" data-pr="submit">答え合わせ</button>':''}<button class="btn" data-pr="skip">わからない</button></div>${q.mode!=='word-choice'?`<button class="text-btn" data-pr="hint">ヒント</button>${P.hint?`<p class="hint">${esc(questionHint(q))}</p>`:''}`:''}`:feedback(q,s.results[s.idx])+`<button class="btn primary next" data-pr="next">${s.idx+1===s.queue.length?'結果を見る':'次の問題'}</button>`}`;
}
function practiceView(){
 if(P.session&&!P.session.paused)return sessionView();
 const available=pool();const attempted=questions().filter(q=>P.records[q.id]);const missed=questions().filter(q=>P.records[q.id]?.last===false);
 return `<section class="practice-hero"><span class="eyebrow">ことばを、自分の力に。</span><h2>単語・文法トレーニング</h2><p>単語を選ぶ・書く。文法を使う。<br>料理の場面で、使える韓国語を増やしましょう。</p></section>${P.session?.paused?'<button class="btn primary next" data-pr="resume">中断した練習を続ける</button>':''}<div class="mode-grid">${Object.entries(MODES).map(([id,[title,desc]],i)=>`<button class="mode-card" data-mode="${id}" aria-pressed="${P.mode===id}"><span class="mode-number">0${i+1}</span><strong>${title}</strong><small>${desc}</small></button>`).join('')}</div><div class="practice-settings"><h3>出題範囲</h3><div class="toggle">${[['lesson','選んだ課'],['all','全12課'],['mistakes','間違いだけ']].map(([id,label])=>`<button data-scope="${id}" aria-pressed="${P.scope===id}">${label}</button>`).join('')}</div>${P.scope==='lesson'?picker()+`<p class="lesson-name">第${S.lesson}課　${esc(S.data.lessons.find(l=>l.n===S.lesson).dish_ko)}</p>`:''}<label for="practice-count">1回の問題数</label><select id="practice-count">${[[5,'5問'],[10,'10問'],[0,'対象すべて']].map(([n,t])=>`<option value="${n}" ${P.count===n?'selected':''}>${t}</option>`).join('')}</select><p class="tapnote">対象 ${available.length}問${P.scope==='mistakes'?'（この練習形式で間違えた問題）':''}。${P.count?`最大${P.count}問ずつ出題します。`:''}</p><button class="btn primary next" data-pr="start" ${available.length?'':'disabled'}>${available.length?'練習をはじめる':P.scope==='mistakes'?'間違えた問題はまだありません':'この範囲の問題はありません'}</button></div><div class="stats"><div class="stat"><b>${attempted.length}</b><span>取り組んだ問題</span></div><div class="stat"><b>${attempted.length-missed.length}</b><span>前回正解</span></div><div class="stat"><b>${missed.length}</b><span>復習する問題</span></div></div><p class="tapnote">記録はこの端末のブラウザーに保存されます。既存の単語カードの記録は「復習」タブで確認できます。</p>`;
}
document.addEventListener('input',e=>{if(e.target.id==='practice-answer')P.draft=e.target.value});
document.addEventListener('keydown',e=>{if(e.target.id==='practice-answer'&&e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();submitPractice()}});
document.addEventListener('change',e=>{if(e.target.id==='practice-count'){P.count=Number(e.target.value);render()}});
document.addEventListener('click',e=>{
 const t=e.target.closest('button');if(!t||!S.data||t.disabled)return;
 if(t.dataset.lesson){LS.set('practiceLesson',S.lesson);return}
 if(t.dataset.mode){P.mode=t.dataset.mode;LS.set('practiceMode',P.mode);render();return}
 if(t.dataset.scope){P.scope=t.dataset.scope;render();return}
 if(t.dataset.option!==undefined){submitPractice(P.session.choices[Number(t.dataset.option)]);return}
 const a=t.dataset.pr;if(!a)return;
 if(a==='start')startPractice();
 if(a==='home'){P.session=null;render()}
 if(a==='pause'){P.session.paused=true;render()}
 if(a==='resume'){P.session.paused=false;render()}
 if(a==='submit')submitPractice(P.draft);
 if(a==='skip')submitPractice('',true);
 if(a==='hint'){P.hint=true;render()}
 if(a==='next'){
  if(!P.session.answered)return;
  P.session.idx++;P.session.answered=false;
  if(P.session.idx===P.session.queue.length)P.session.finished=true;else setupQuestion();
  render();window.scrollTo({top:0,behavior:'instant'});
 }
 if(a==='retry'){const s=P.session;startPractice(shuffle(s.queue.filter((q,i)=>!s.results[i].ok)))}
});
