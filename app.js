const $ = (s) => document.querySelector(s);
const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage?.local;
const store = {
  get: (key, fallback) => hasChromeStorage
    ? new Promise((resolve) => chrome.storage.local.get({ [key]: fallback }, (v) => resolve(v[key])))
    : Promise.resolve(JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback))),
  set: (data) => hasChromeStorage
    ? new Promise((resolve) => chrome.storage.local.set(data, resolve))
    : Promise.resolve(Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))),
};

const defaults = [
  { name: 'YouTube', url: 'https://youtube.com' },
  { name: 'Почта', url: 'https://mail.google.com' },
  { name: 'Календарь', url: 'https://calendar.google.com' },
  { name: 'Музыка', url: 'https://music.youtube.com' },
];
const quotes = ['«Внимание — самая редкая форма щедрости.»','«Маленький прогресс — тоже прогресс.»','«Сначала важное. Остальное подождёт.»','«Хороший день начинается с ясного намерения.»','«Создавай то, что хочется увидеть в мире.»'];
const defaultBackground = 'assets/default-background.png';
let state = { name:'', seconds:false, color:'#ff4d6d', links:defaults, tasks:[], bgImage:defaultBackground, bgBlur:0, glow:true };

async function init(){
  for(const key of Object.keys(state)) state[key] = await store.get(key,state[key]);
  if(!state.bgImage){state.bgImage=defaultBackground;await store.set({bgImage:defaultBackground})}
  $('#nameInput').value=state.name; document.documentElement.style.setProperty('--accent',state.color);
  $('#secondsToggle').classList.toggle('on',state.seconds); $('#secondsToggle').setAttribute('aria-checked',state.seconds);
  applyBackground();
  $('#blurRange').value=state.bgBlur; $('#blurValue').textContent=state.bgBlur;
  $('#glowToggle').classList.toggle('on',state.glow); $('#glowToggle').setAttribute('aria-checked',state.glow); document.body.classList.toggle('glow-off',!state.glow);
  document.querySelectorAll('.colors button').forEach(b=>b.classList.toggle('active',b.dataset.color===state.color));
  updateClock(); renderLinks(); renderTasks(); setInterval(updateClock,1000);
}
function updateClock(){
  const now=new Date(), h=now.getHours();
  const options={hour:'2-digit',minute:'2-digit',hour12:false}; if(state.seconds) options.second='2-digit';
  let time=now.toLocaleTimeString('ru-RU',options); if(state.seconds){const parts=time.split(':');time=`${parts[0]}:${parts[1]}<small>:${parts[2]}</small>`}
  $('#time').innerHTML=time; $('#date').textContent=now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
  const hello=h<6?'Доброй ночи':h<12?'Доброе утро':h<18?'Добрый день':'Добрый вечер';
  $('#greeting').innerHTML=`${hello}${state.name?', '+escapeHtml(state.name):''}. <span>На чём сфокусируемся?</span>`;
}
function renderLinks(){
  $('#linksGrid').innerHTML=state.links.map((l,i)=>`<a class="link-card" href="${safeUrl(l.url)}"><span class="link-icon">${escapeHtml(l.name[0]||'?')}</span><span class="link-name">${escapeHtml(l.name)}</span><button class="link-delete" data-index="${i}" title="Удалить">×</button></a>`).join('');
  document.querySelectorAll('.link-delete').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();state.links.splice(+b.dataset.index,1);await store.set({links:state.links});renderLinks()});
}
function renderTasks(){
  $('#taskList').innerHTML=state.tasks.map((t,i)=>`<li class="task ${t.done?'done':''}"><button class="task-check" data-check="${i}" aria-label="Готово"></button><span>${escapeHtml(t.text)}</span><button class="task-delete" data-delete="${i}" aria-label="Удалить">×</button></li>`).join('');
  const done=state.tasks.filter(t=>t.done).length,total=state.tasks.length;$('#taskCount').textContent=`${done} / ${total}`;$('#progressBar').style.width=total?`${done/total*100}%`:'0';
  document.querySelectorAll('[data-check]').forEach(b=>b.onclick=async()=>{state.tasks[+b.dataset.check].done=!state.tasks[+b.dataset.check].done;await saveTasks()});
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{state.tasks.splice(+b.dataset.delete,1);await saveTasks()});
}
async function saveTasks(){await store.set({tasks:state.tasks});renderTasks()}
function escapeHtml(s){const d=document.createElement('div');d.textContent=String(s);return d.innerHTML}
function safeUrl(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}}
function applyBackground(){
  document.documentElement.style.setProperty('--custom-bg',state.bgImage?`url("${state.bgImage}")`:'none');
  document.documentElement.style.setProperty('--bg-blur',`${state.bgBlur}px`);
  document.documentElement.style.setProperty('--shade',state.bgImage?'.44':'.12');
  $('#removeBackground').style.display=state.bgImage===defaultBackground?'none':'block';
}
function prepareImage(file){
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const maxW=1920,maxH=1080,scale=Math.min(1,maxW/image.width,maxH/image.height),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.84))};image.src=reader.result};reader.readAsDataURL(file)});
}

$('#searchForm').onsubmit=e=>{e.preventDefault();const q=$('#searchInput').value.trim();if(!q)return;const url=/^(https?:\/\/|[\w-]+\.[a-z]{2,})/i.test(q)?(q.startsWith('http')?q:`https://${q}`):`https://www.google.com/search?q=${encodeURIComponent(q)}`;location.href=url};
$('#taskForm').onsubmit=async e=>{e.preventDefault();const input=$('#taskInput'),text=input.value.trim();if(!text)return;state.tasks.unshift({text,done:false});input.value='';await saveTasks()};
$('#addLink').onclick=()=>$('#linkDialog').showModal();
$('#linkForm').onsubmit=async e=>{e.preventDefault();const name=$('#linkName').value.trim(),url=$('#linkUrl').value.trim();if(!name||!url)return;state.links.push({name,url});await store.set({links:state.links});renderLinks();$('#linkDialog').close();e.target.reset()};
const closeSettings=()=>{$('#settings').classList.remove('open');$('#settings').setAttribute('aria-hidden','true');$('#backdrop').classList.remove('show')};
$('#settingsButton').onclick=()=>{$('#settings').classList.add('open');$('#settings').setAttribute('aria-hidden','false');$('#backdrop').classList.add('show')};$('#settingsClose').onclick=closeSettings;$('#backdrop').onclick=closeSettings;
$('#nameInput').oninput=async e=>{state.name=e.target.value;await store.set({name:state.name});updateClock()};
$('#secondsToggle').onclick=async()=>{state.seconds=!state.seconds;$('#secondsToggle').classList.toggle('on',state.seconds);$('#secondsToggle').setAttribute('aria-checked',state.seconds);await store.set({seconds:state.seconds});updateClock()};
$('#backgroundButton').onclick=()=>$('#backgroundInput').click();
$('#backgroundInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{state.bgImage=await prepareImage(file);await store.set({bgImage:state.bgImage});applyBackground()}catch{alert('Не получилось обработать картинку. Попробуйте JPG, PNG или WebP.')}e.target.value=''};
$('#removeBackground').onclick=async()=>{state.bgImage=defaultBackground;await store.set({bgImage:defaultBackground});applyBackground()};
$('#blurRange').oninput=e=>{state.bgBlur=+e.target.value;$('#blurValue').textContent=state.bgBlur;applyBackground()};
$('#blurRange').onchange=()=>store.set({bgBlur:state.bgBlur});
$('#glowToggle').onclick=async()=>{state.glow=!state.glow;$('#glowToggle').classList.toggle('on',state.glow);$('#glowToggle').setAttribute('aria-checked',state.glow);document.body.classList.toggle('glow-off',!state.glow);await store.set({glow:state.glow})};
$('#colors').onclick=async e=>{const b=e.target.closest('button');if(!b)return;state.color=b.dataset.color;document.documentElement.style.setProperty('--accent',state.color);document.querySelectorAll('.colors button').forEach(x=>x.classList.toggle('active',x===b));await store.set({color:state.color})};
$('#focusToggle').onclick=()=>document.body.classList.toggle('focus-mode');$('#newQuote').onclick=()=>$('#quote').textContent=quotes[Math.floor(Math.random()*quotes.length)];
let glowFrame;
document.addEventListener('pointermove',e=>{if(!state.glow)return;cancelAnimationFrame(glowFrame);glowFrame=requestAnimationFrame(()=>{document.documentElement.style.setProperty('--mx',`${e.clientX}px`);document.documentElement.style.setProperty('--my',`${e.clientY}px`)})});
init();
