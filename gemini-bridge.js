(() => {
  const url = new URL(location.href);
  const prompt = url.searchParams.get('koraPrompt');
  if (!prompt) return;

  url.searchParams.delete('koraPrompt');
  history.replaceState(null, '', url);

  const visible = (element) => element && element.getClientRects().length > 0;
  const findComposer = () => {
    const selectors = [
      'textarea[aria-label]',
      'div[contenteditable="true"][role="textbox"]',
      '.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"]',
      'textarea',
    ];
    const candidates = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]).filter(visible);
    return candidates.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
  };

  const setComposerText = (composer) => {
    composer.focus();
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const prototype = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(composer, prompt);
    } else {
      composer.textContent = prompt;
    }
    composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const submit = () => {
    const labels = ['Send message', 'Send', 'Submit', 'Отправить сообщение', 'Отправить'];
    const buttons = [...document.querySelectorAll('button')].filter(visible);
    const button = buttons.find((item) => labels.some((label) =>
      (item.getAttribute('aria-label') || '').toLowerCase().includes(label.toLowerCase()) ||
      (item.getAttribute('data-tooltip') || '').toLowerCase().includes(label.toLowerCase())
    ));
    if (button && !button.disabled) button.click();
  };

  let attempts = 0;
  const timer = setInterval(() => {
    const composer = findComposer();
    attempts += 1;
    if (!composer && attempts < 60) return;
    clearInterval(timer);
    if (!composer) return;
    setComposerText(composer);
    setTimeout(submit, 450);
  }, 250);
})();
