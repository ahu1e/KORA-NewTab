(() => {
  const getPlayer = () =>
    document.querySelector('[aria-labelledby="player-region"]') ||
    document.querySelector('[aria-label="Player"]') ||
    document.querySelector('[class*="PlayerBar_root"]') ||
    document.body;

  const textFrom = (selectors, root = document) => {
    for (const selector of selectors) {
      const text = root.querySelector(selector)?.textContent?.trim();
      if (text) return text;
    }
    return '';
  };

  const getAudio = () => [...document.querySelectorAll('audio')].find((audio) =>
    !audio.paused || audio.currentTime > 0 || Number.isFinite(audio.duration)
  ) || null;

  const parseTime = (value) => {
    const parts = value.trim().split(':').map(Number);
    if (parts.some(Number.isNaN) || parts.length < 2) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  const getDomProgress = (player) => {
    const sliders = [...player.querySelectorAll('input[type="range"], [role="slider"]')];
    const progress = sliders.find((item) => {
      const label = `${item.getAttribute('aria-label') || ''} ${item.getAttribute('data-test-id') || ''}`.toLowerCase();
      return ['progress', 'прогресс', 'timeline', 'position', 'позици'].some((word) => label.includes(word));
    });
    let sliderProgress = 0;
    if (progress) {
      const current = Number(progress.value ?? progress.getAttribute('aria-valuenow'));
      const maximum = Number(progress.max ?? progress.getAttribute('aria-valuemax'));
      if (Number.isFinite(current) && Number.isFinite(maximum) && maximum > 0) sliderProgress = current / maximum;
    }

    const times = [...player.querySelectorAll('span, time, div')]
      .filter((item) => item.children.length === 0 && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(item.textContent.trim()))
      .map((item) => parseTime(item.textContent));
    if (times.length >= 2) {
      const currentTime = Math.min(times[0], times[1]);
      const duration = Math.max(times[0], times[1]);
      if (duration > 0) return { currentTime, duration, progress: currentTime / duration };
    }
    return { currentTime: 0, duration: 0, progress: sliderProgress };
  };

  const findControl = (action) => {
    const player = getPlayer();
    const selectors = {
      playpause: [
        'button[aria-label="Playback"]', 'button[aria-label="Воспроизведение"]',
        'button[aria-label="Pause"]', 'button[aria-label="Пауза"]',
        'button[aria-label="Play"]', 'button[aria-label="Играть"]',
        'button[data-test-id="play"]', 'button[data-test-id="pause"]',
        'button[class*="PlayButton"]', '[class*="PlayButton"] button',
      ],
      next: [
        'button[aria-label="Next track"]', 'button[aria-label="Следующий трек"]',
        'button[aria-label="Next"]', 'button[aria-label="Следующий"]',
        'button[data-test-id*="next"]', 'button[class*="next"]',
      ],
      previous: [
        'button[aria-label="Previous track"]', 'button[aria-label="Предыдущий трек"]',
        'button[aria-label="Previous"]', 'button[aria-label="Предыдущий"]',
        'button[data-test-id*="previous"]', 'button[data-test-id*="prev"]',
        'button[class*="prev"]',
      ],
    };
    for (const selector of selectors[action] || []) {
      const button = player.querySelector(selector) || document.querySelector(selector);
      if (button) return button;
    }
    const buttons = [...player.querySelectorAll('button')];
    return buttons.find((button) => {
      const marker = `${button.getAttribute('aria-label') || ''} ${button.title || ''} ${button.getAttribute('data-test-id') || ''}`.toLowerCase();
      if (action === 'next') return /next|следующ/.test(marker);
      if (action === 'previous') return /previous|предыдущ|назад|(^|[_-])prev([_-]|$)/.test(marker);
      if (/next|следующ|previous|предыдущ|назад|(^|[_-])prev([_-]|$)/.test(marker)) return false;
      return /playback|воспроизвед|pause|пауза|(^|[_-])play([_-]|$)|играть/.test(marker);
    }) || null;
  };

  const getState = () => {
    const player = getPlayer();
    const audio = getAudio();
    const metadata = navigator.mediaSession?.metadata;
    const domProgress = getDomProgress(player);
    const currentTime = audio?.currentTime || domProgress.currentTime;
    const duration = Number.isFinite(audio?.duration) ? audio.duration : domProgress.duration;
    const playButton = findControl('playpause');
    const buttonLabel = playButton?.getAttribute('aria-label')?.toLowerCase() || '';
    const paused = audio ? audio.paused : !['pause', 'пауза'].some((word) => buttonLabel.includes(word));
    const title = metadata?.title || textFrom(['[class*="Meta_title"]', '[data-test-id*="track-title"]'], player);
    const artist = metadata?.artist || textFrom(['[class*="Meta_artist"]', '[data-test-id*="artist"]'], player);
    const artwork = metadata?.artwork?.at(-1)?.src || player.querySelector('[class*="cover"] img, img[class*="cover"]')?.src || '';
    return {
      available: Boolean(title || audio || playButton), title: title || 'Яндекс Музыка', artist, artwork, paused,
      currentTime: currentTime || 0, duration: duration || 0,
      progress: duration > 0 ? currentTime / duration : domProgress.progress,
    };
  };

  const sendState = () => {
    try { chrome.runtime.sendMessage({ type: 'KORA_YANDEX_STATE', state: getState() }, () => void chrome.runtime.lastError); } catch {}
  };

  const setProgress = (ratio) => {
    const audio = getAudio();
    if (audio && Number.isFinite(audio.duration)) { audio.currentTime = audio.duration * ratio; return true; }
    const player = getPlayer();
    const sliders = [...player.querySelectorAll('input[type="range"], [role="slider"]')];
    const progress = sliders.find((item) => /progress|прогресс|timeline|position|позици/i.test(`${item.getAttribute('aria-label') || ''} ${item.getAttribute('data-test-id') || ''}`));
    if (!progress) return false;
    const maximum = Number(progress.max ?? progress.getAttribute('aria-valuemax')) || 100;
    const value = maximum * ratio;
    if (progress instanceof HTMLInputElement) Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(progress, value);
    else progress.setAttribute('aria-valuenow', value);
    progress.dispatchEvent(new Event('input', { bubbles: true }));
    progress.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'KORA_YANDEX_CONTROL') return;
    let handled = false;
    if (['playpause', 'next', 'previous'].includes(message.action)) {
      const button = findControl(message.action);
      if (button) { button.click(); handled = true; }
    }
    if (message.action === 'seek') handled = setProgress(Math.max(0, Math.min(1, message.ratio)));
    respond({ handled });
    setTimeout(sendState, 100);
  });

  sendState();
  setInterval(sendState, 500);
})();
