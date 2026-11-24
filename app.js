const params = new URLSearchParams(location.search);
const idsRaw = params.get('ids') || '1,2,3';
const delayRaw = params.get('delay') || '0';
const delay = Number(delayRaw);

const summaryEl = document.getElementById('summary');
const usersEl = document.getElementById('users');
const cancelBtn = document.getElementById('cancel');

let controller = null;

cancelBtn.addEventListener('click', () => {
  if (controller) controller.abort();
});

function parseIds(raw) {
  const parts = raw.split(',');
  if (parts.length < 1 || parts.length > 5) return null;
  const out = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isInteger(n) || n <= 0) return null;
    out.push(n);
  }
  return out;
}

function renderSuccess(article, user) {
  article.dataset.state = 'success';
  article.textContent = '';

  const name = document.createElement('h2');
  name.className = 'name';
  name.textContent = `${user.firstName} ${user.lastName}`;

  const email = document.createElement('a');
  email.className = 'email';
  email.href = `mailto:${user.email}`;
  email.textContent = user.email;

  const city = document.createElement('span');
  city.className = 'city';
  city.textContent = user.address?.city || '';

  const company = document.createElement('span');
  company.className = 'company';
  company.textContent = user.company?.name || '';

  article.append(name, email, city, company);
}

function renderError(article, message) {
  article.dataset.state = 'error';
  article.textContent = '';
  const span = document.createElement('span');
  span.className = 'message';
  span.textContent = message;
  article.appendChild(span);
}

function renderAborted(article) {
  article.dataset.state = 'aborted';
  article.textContent = 'Отменено';
}

async function start(ids, delay) {
  controller = new AbortController();
  summaryEl.dataset.state = 'loading';
  summaryEl.textContent = 'Загрузка...';

  // Карточки в правильном порядке
  const cards = ids.map(id => {
    const article = document.createElement('article');
    article.dataset.id = String(id);
    article.dataset.state = 'loading';
    article.textContent = 'Загрузка...';
    usersEl.appendChild(article);
    return article;
  });

  async function loadOne(id, article) {
    const url = `https://dummyjson.com/users/${id}?delay=${delay}`;
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      renderSuccess(article, data);
      return { ok: true };
    } catch (err) {
      if (err.name === 'AbortError') {
        renderAborted(article);
        return { ok: false, aborted: true };
      }
      renderError(article, err.message || 'Ошибка');
      return { ok: false };
    }
  }

  const results = await Promise.allSettled(
    ids.map((id, i) => loadOne(id, cards[i]))
  );

  let success = 0, errors = 0, aborted = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.ok) success++;
      else if (r.value.aborted) aborted++;
      else errors++;
    } else {
      errors++;
    }
  }

  if (aborted > 0 && success === 0 && errors === 0) {
    summaryEl.dataset.state = 'aborted';
    summaryEl.textContent = `Отменено: ${aborted}`;
  } else if (success === ids.length) {
    summaryEl.dataset.state = 'success';
    summaryEl.textContent = `Загружено: ${success}; ошибок: 0`;
  } else if (success === 0) {
    summaryEl.dataset.state = 'error';
    summaryEl.textContent = `Загружено: 0; ошибок: ${errors}`;
  } else {
    summaryEl.dataset.state = 'partial';
    summaryEl.textContent = `Загружено: ${success}; ошибок: ${errors}`;
  }

  cancelBtn.disabled = true;
}

// Запуск
const ids = parseIds(idsRaw);
const delayOk = Number.isFinite(delay) && delay >= 0 && delay <= 5000;

if (!ids || !delayOk) {
  summaryEl.dataset.state = 'error';
  summaryEl.textContent = 'Некорректные параметры: проверьте ids и delay';
  cancelBtn.disabled = true;
} else {
  start(ids, delay);
}