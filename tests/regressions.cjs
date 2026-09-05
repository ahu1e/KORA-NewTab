const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const app = read('app.js');
const extract = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

async function main() {
  const search = vm.createContext({ URL });
  vm.runInContext(extract('function searchDestination', "$('#searchForm')"), search);
  assert.match(search.searchDestination('github.com инструкция'), /google.com\/search\?/);
  assert.equal(search.searchDestination('github.com'), 'https://github.com/');
  assert.equal(search.searchDestination('HTTPS://EXAMPLE.COM/a'), 'https://example.com/a');

  let listener, latest;
  const stale = { paused: true, currentTime: 20, duration: 200, play() { throw Error('Wrong audio'); } };
  const playing = { paused: false, currentTime: 60, duration: 240, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
  const player = { innerText: '1:00 4:00', querySelector: () => null, querySelectorAll: () => [] };
  vm.runInNewContext(read('yandex-music.js'), {
    document: { body: player, querySelector: () => null, querySelectorAll: () => [stale, playing] },
    navigator: {}, setInterval() {}, setTimeout() {},
    chrome: { runtime: { sendMessage: m => latest = m.state, onMessage: { addListener: fn => listener = fn } } },
  });
  assert.equal(latest.paused, false);
  assert.equal(latest.currentTime, 60);
  listener({ type: 'KORA_YANDEX_CONTROL', action: 'playpause' }, null, () => {});
  assert.equal(playing.paused, true);
  listener({ type: 'KORA_YANDEX_CONTROL', action: 'playpause' }, null, () => {});
  assert.equal(playing.paused, false);

  const selection = vm.createContext({ Date, $: () => ({}), updateYandexPlayer: media => latest = media });
  vm.runInContext(extract('let yandexTabId=', 'function formatMediaTime'), selection);
  vm.runInContext(`yandexSources.set(1,{id:1,updated:Date.now(),state:{available:true,paused:false,title:'Playing'}});
    selectYandexSource();
    yandexSources.set(2,{id:2,updated:Date.now(),state:{available:true,paused:true,title:'Paused'}});
    selectYandexSource();`, selection);
  assert.equal(latest.title, 'Playing');

  let saved = [{ text: 'Legacy', done: false }], queue = Promise.resolve(), id = 0;
  const tasks = vm.createContext({
    navigator: { locks: { request: (_name, fn) => { const next = queue.then(fn); queue = next.catch(() => {}); return next; } } },
    crypto: { randomUUID: () => String(++id) }, state: {}, renderTasks() {},
    store: { get: async () => structuredClone(saved), set: async data => { saved = structuredClone(data.tasks); } },
  });
  vm.runInContext(extract('async function mutateTasks', 'if(hasChromeStorage)'), tasks);
  await Promise.all([
    tasks.mutateTasks(list => list.push({ id: 'a', text: 'First tab' })),
    tasks.mutateTasks(list => list.push({ id: 'b', text: 'Second tab' })),
  ]);
  assert.deepEqual(saved.map(t => t.text), ['Legacy', 'First tab', 'Second tab']);
  assert.ok(saved[0].id);
  console.log('PASS: search, active audio/pause, music tab selection, concurrent tasks and migration');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
