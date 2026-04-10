(function () {
  const toggle = document.getElementById('chatToggle');
  const window_ = document.getElementById('chatWindow');
  const closeBtn = document.getElementById('chatClose');
  const messagesEl = document.getElementById('chatMessages');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  let conversationHistory = [];
  let isOpen = false;

  // ── Open / Close ──────────────────────────────────────
  function openChat() {
    isOpen = true;
    window_.classList.add('open');
    toggle.innerHTML = '✕';
    input.focus();
    if (messagesEl.children.length === 0) {
      addBotMessage('Namaste! 🙏 Welcome to PrimeRealty Properties! I\'m your personal property assistant.\n\nAre you looking to **buy**, **rent**, or **sell** a property?');
    }
  }

  function closeChat() {
    isOpen = false;
    window_.classList.remove('open');
    toggle.innerHTML = '💬';
  }

  toggle.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  // ── Render ────────────────────────────────────────────
  function addBotMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
    messagesEl.appendChild(el);
    scrollBottom();
  }

  function addUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollBottom();
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typing';
    el.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    messagesEl.appendChild(el);
    scrollBottom();
    return el;
  }

  function removeTyping() {
    const el = document.getElementById('typing');
    if (el) el.remove();
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Send message ──────────────────────────────────────
  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    sendBtn.disabled = true;
    addUserMessage(text);

    conversationHistory.push({ role: 'user', content: text });

    showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory })
      });

      const data = await res.json();
      removeTyping();

      if (!res.ok) throw new Error(data.error || 'Error');

      const botText = data.message;
      conversationHistory.push({ role: 'assistant', content: botText });
      addBotMessage(botText);

      // If lead data collected, POST to /api/lead
      if (data.leadData) {
        try {
          await fetch('/api/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.leadData)
          });
        } catch (e) {
          // silently fail — user experience unaffected
        }
      }

    } catch (err) {
      removeTyping();
      addBotMessage('Sorry, I\'m having trouble connecting. Please try again or call us at +91 70876 42005. 🙏');
    }

    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();
