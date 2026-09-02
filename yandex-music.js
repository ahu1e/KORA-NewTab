(() => {
  const textFrom = (selectors) => {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = element?.textContent?.trim();
      if (text) return text;
    }
    return '';
  };

  const getAudio = () => [...document.querySelectorAll('audio')].find((audio) =>
    Number.isFinite(audio.duration) || audio.currentTime > 0 || !audio.paused
  ) || document.querySelector('audio');

  const getState = () => {
    const audio = getAudio();
    const metadata = navigator.mediaSession?.metadata;
    const title = metadata?.title || textFrom([
      '[class*="PlayerBarDesktop_track"] [class*="Meta_title"]',
      '[class*="PlayerBar_track"] [class*="Meta_title"]',
      '[class*="Meta_title"]',
    ]);
    const artist = metadata?.artist || textFrom([
      '[class*="PlayerBarDesktop_track"] [class*="Meta_artist"]',
      '[class*="PlayerBar_track"] [class*="Meta_artist"]',
      '[class*="Meta_artist"]',
    ]);
    const artwork = metadata?.artwork?.at(-1)?.src || document.querySelector('[class*="PlayerBarDesktop_cover"] img, [class*="PlayerBar_cover"] img')?.src || '';
    return {
      available: Boolean(audio || title), title: title || 'Яндекс Музыка', artist,
      artwork, paused: audio ? audio.paused : true,
      currentTime: audio?.currentTime || 0,
      duration: Number.isFinite(audio?.duration) ? audio.duration : 0,
    };
  };

  const sendState = () => {
    try {
      chrome.runtime.sendMessage({ type: 'KORA_YANDEX_STATE', state: getState() }, () => void chrome.runtime.lastError);
    } catch {}
  };

  const findButton = (action) => {
    const words = action === 'next'
      ? ['следующий', 'next']
      : ['предыдущий', 'previous', 'назад'];
    return [...document.querySelectorAll('button')].find((button) => {
      const label = `${button.getAttribute('aria-label') || ''} ${button.title || ''}`.toLowerCase();
      return words.some((word) => label.includes(word));
    });
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'KORA_YANDEX_CONTROL') return;
    const audio = getAudio();
    if (message.action === 'playpause' && audio) audio.paused ? audio.play() : audio.pause();
    if ((message.action === 'next' || message.action === 'previous')) findButton(message.action)?.click();
    if (message.action === 'seek' && audio && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, message.time));
    setTimeout(sendState, 150);
  });

  sendState();
  setInterval(sendState, 1000);
})();
