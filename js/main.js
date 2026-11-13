// ぷるる茶房 見本サイト：画面の動きとフォーム

// ▼ お問い合わせの送信先。Formspree（https://formspree.io）でフォームを作り、発行されたURLに差し替える
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID';

// 3Dが使えないときの絵（SVG）用の色。js/three-scene.js の FLAVORS と同じ値
const FLAVOR_COLORS = {
  milk:   { liquid: '#E2CBAA', syrup: '#C9AA82', syrupO: 0.5, crown: '#FBF7F0', crumbO: 0, tint: '#F5EFE6', word: 'Milk Tea' },
  matcha: { liquid: '#A3BA78', syrup: '#5E7A3A', syrupO: 0.4, crown: '#F8F6EC', crumbO: 0, tint: '#EEEEE2', word: 'Matcha' },
  berry:  { liquid: '#EDC6BE', syrup: '#D25F6A', syrupO: 0.45, crown: '#F2B29B', crumbO: 1, tint: '#F5EAE6', word: 'Strawberry' },
  kokuto: { liquid: '#D6B796', syrup: '#3E200F', syrupO: 0.86, crown: '#FBF6EE', crumbO: 0, tint: '#EFE6DB', word: 'Kokuto' },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isWide = () => window.matchMedia('(min-width: 960px)').matches;
const yen = (n) => '¥' + n.toLocaleString('ja-JP');

/* ---------- ぷるんと弾むボタン ---------- */
function purun(el) {
  if (reduceMotion || !el) return;
  el.classList.remove('is-purun');
  void el.offsetWidth; // アニメーションを最初からやり直す
  el.classList.add('is-purun');
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-purun]');
  if (el) purun(el);
});
document.addEventListener('animationend', (e) => {
  if (e.animationName === 'purun') e.target.classList.remove('is-purun');
});

/* ---------- 仮のリンク（SNSなど） ---------- */
$$('[data-dummy-link]').forEach((a) => {
  a.setAttribute('title', '見本サイトのため、リンク先は準備中です');
  a.addEventListener('click', (e) => e.preventDefault());
});

/* ---------- ヘッダー ---------- */
const header = $('[data-header]');
const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
onScrollHeader();
window.addEventListener('scroll', onScrollHeader, { passive: true });

const navToggle = $('[data-nav-toggle]');
const nav = $('#global-nav');
function setNav(open) {
  navToggle.setAttribute('aria-expanded', String(open));
  $('.nav-toggle-label', navToggle).textContent = open ? 'メニューを閉じる' : 'メニューを開く';
  nav.classList.toggle('is-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
navToggle.addEventListener('click', () => setNav(navToggle.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav.classList.contains('is-open')) { setNav(false); navToggle.focus(); }
});
window.matchMedia('(min-width: 960px)').addEventListener('change', () => setNav(false));

/* ---------- メニューのタブ ---------- */
const tabs = $$('[role="tab"]');
function selectTab(tab, focus) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => { selectTab(tab); purun(tab); });
  tab.addEventListener('keydown', (e) => {
    const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    selectTab(tabs[(map[e.key] + tabs.length) % tabs.length], true);
  });
});

/* ---------- 3Dが使えないときの絵の色 ---------- */
function paintFallback(el, key) {
  const c = FLAVOR_COLORS[key];
  el.style.setProperty('--liquid', c.liquid);
  el.style.setProperty('--syrup', c.syrup);
  el.style.setProperty('--syrup-o', c.syrupO);
  el.style.setProperty('--crown', c.crown);
  el.style.setProperty('--crumb-o', c.crumbO);
}

/* ---------- ヒーローと4つの味（スクロールで味が変わる） ---------- */
const stage = $('[data-stage]');
const stageFallback = $('.stage-fallback', stage);
const steps = $$('[data-step]');
const STEP_ORDER = ['hero', 'milk', 'matcha', 'berry', 'kokuto'];
let heroScene = null;
let activeStep = 'hero';

function poseFor(step) {
  const i = STEP_ORDER.indexOf(step);
  const turn = i * Math.PI * 0.5;
  if (isWide()) {
    if (step === 'hero') return { fx: 0.25, fy: -0.02, scale: 0.84, turn };
    const side = i % 2 === 1 ? 0.24 : -0.24; // カードと反対側にカップを置く
    return { fx: side, fy: -0.02, scale: 0.8, turn };
  }
  if (step === 'hero') return { fx: 0, fy: -0.1, scale: 0.6, turn };
  return { fx: 0, fy: 0.19, scale: 0.56, turn };
}

// 背景の大きな英字と、背景のほのかな色も味に合わせて変える
const stageWord = $('[data-stage-word]');
let wordTimer = 0;
function setStageWord(text) {
  if (stageWord.textContent === text) return;
  if (reduceMotion) { stageWord.textContent = text; return; }
  stageWord.classList.add('is-swap');
  clearTimeout(wordTimer);
  wordTimer = setTimeout(() => { stageWord.textContent = text; stageWord.classList.remove('is-swap'); }, 350);
}

function applyStep(step) {
  activeStep = step;
  const el = steps.find((s) => s.dataset.step === step);
  const flavor = el ? el.dataset.flavor : 'milk';
  paintFallback(stageFallback, flavor);
  stage.style.setProperty('--tint', FLAVOR_COLORS[flavor].tint);
  setStageWord(step === 'hero' ? 'Pururu' : FLAVOR_COLORS[flavor].word);
  if (heroScene) {
    heroScene.setFlavor(flavor);
    heroScene.setPose(poseFor(step));
  }
}

const stepObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) applyStep(entry.target.dataset.step);
  });
}, { rootMargin: '-48% 0px -48% 0px' });
steps.forEach((s) => stepObserver.observe(s));
window.matchMedia('(min-width: 960px)').addEventListener('change', () => applyStep(activeStep));

// スクロール量に合わせて、少しずつ回す
let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (!heroScene || scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    const base = poseFor(activeStep);
    heroScene.setPose({ turn: base.turn + window.scrollY * 0.0012 });
    scrollTicking = false;
  });
}, { passive: true });

/* ---------- カスタマイズ・シミュレーター ---------- */
const form = $('[data-custom-form]');
const customStage = $('.custom-stage');
const customFallback = $('[data-custom-fallback]');
const sweet = $('[data-sweet]');
const totalEl = $('[data-total]');
const totalFloat = $('[data-total-float]');
const summaryEl = $('[data-summary]');
let customScene = null;
let lastTotal = null;
const ICE_LABEL = ['氷なし', '氷少なめ', '氷ふつう', '氷多め'];

function readCustom() {
  const base = $('input[name="base"]:checked', form);
  const ice = Number($('input[name="ice"]:checked', form).value);
  const tops = $$('input[name="top"]:checked', form);
  const sweetness = Number(sweet.value);
  const total = Number(base.dataset.price) + tops.reduce((sum, t) => sum + Number(t.dataset.price), 0);
  const toppings = { pearl: false, foam: false, nata: false, azuki: false };
  tops.forEach((t) => { toppings[t.value] = true; });
  const baseName = base.parentElement.querySelector('span').firstChild.textContent.trim();
  const topNames = tops.map((t) => t.parentElement.querySelector('span').firstChild.textContent.trim());
  return { flavor: base.value, ice, sweetness, total, toppings, baseName, topNames };
}

function updateCustom() {
  const s = readCustom();
  $('[data-sweet-out]').textContent = s.sweetness + '%';
  sweet.style.setProperty('--fill', (s.sweetness / 120) * 100 + '%');
  sweet.setAttribute('aria-valuetext', '甘さ' + s.sweetness + '%');

  totalEl.textContent = yen(s.total);
  totalFloat.textContent = yen(s.total);
  if (lastTotal !== null && lastTotal !== s.total) { purun(totalEl); purun(totalFloat); }
  lastTotal = s.total;
  summaryEl.textContent = [s.baseName, '甘さ' + s.sweetness + '%', ICE_LABEL[s.ice], ...s.topNames].join('・');

  // 3D
  if (customScene) {
    customScene.setFlavor(s.flavor);
    customScene.setSweetness(s.sweetness / 100);
    customScene.setIce(s.ice);
    customScene.setToppings(s.toppings);
  }
  // 3Dが使えないときの絵
  paintFallback(customFallback, s.flavor);
  customFallback.style.setProperty('--crown-o', s.toppings.foam ? 1 : 0);
  if (!s.toppings.foam) customFallback.style.setProperty('--crumb-o', 0);
  $('[data-fb="nata"]', customFallback).style.opacity = s.toppings.nata ? 1 : 0;
  $('[data-fb="azuki"]', customFallback).style.opacity = s.toppings.azuki ? 1 : 0;
  $$('[data-ice]', customFallback).forEach((r) => { r.style.opacity = Number(r.dataset.ice) <= s.ice ? 1 : 0; });
}
form.addEventListener('input', updateCustom);
form.addEventListener('change', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) purun($('span', chip));
});
form.addEventListener('submit', (e) => e.preventDefault());
updateCustom();

/* ---------- 指とマウスで、カップを少し傾ける ---------- */
function pointerTo(x, y) {
  const nx = (x / window.innerWidth) * 2 - 1;
  const ny = (y / window.innerHeight) * 2 - 1;
  heroScene?.setPointer(nx, ny);
  customScene?.setPointer(nx, ny);
}
window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') pointerTo(e.clientX, e.clientY); }, { passive: true });
window.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) pointerTo(t.clientX, t.clientY); }, { passive: true });
window.addEventListener('touchend', () => { heroScene?.setPointer(0, 0); customScene?.setPointer(0, 0); }, { passive: true });

/* ---------- 3Dの起動（動きを減らす設定・WebGLなしのときは絵のまま） ---------- */
async function start3D() {
  if (reduceMotion) return;
  let mod;
  try {
    mod = await import('./three-scene.js?v=3');
  } catch (err) {
    console.warn('3Dを読み込めなかったため、イラストで表示します。', err);
    return;
  }
  if (!mod.canUseWebGL()) return;
  const quality = mod.detectQuality();

  try {
    heroScene = mod.createDrinkScene($('[data-drink-canvas]'), {
      quality,
      onFail: () => stage.classList.remove('is-3d'),
    });
    heroScene.setIce(2); // 写真のように、上に氷を浮かべる
    stage.classList.add('is-3d');
    applyStep(activeStep);
  } catch (err) {
    console.warn('3Dを表示できなかったため、イラストで表示します。', err);
    heroScene = null;
  }

  try {
    customScene = mod.createDrinkScene($('[data-custom-canvas]'), {
      quality,
      startScale: 0.95,
      startAngle: 0.3,
      spinSpeed: 0.22,
      onFail: () => customStage.classList.remove('is-3d'),
    });
    customScene.setPose({ fx: 0, fy: -0.01, scale: 0.95, turn: 0 });
    customStage.classList.add('is-3d');
    updateCustom();
  } catch (err) {
    console.warn('シミュレーターの3Dを表示できなかったため、イラストで表示します。', err);
    customScene = null;
  }
}
applyStep('hero');
start3D();

/* ---------- お問い合わせフォーム ---------- */
const contact = $('[data-contact-form]');
const statusEl = $('[data-form-status]');
const RULES = {
  name: (v) => (v.trim() ? '' : 'お名前を入力してください。'),
  email: (v) => {
    if (!v.trim()) return 'メールアドレスを入力してください。';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'メールアドレスの形をご確認ください（例：name@example.com）。';
  },
  message: (v) => (v.trim().length >= 5 ? '' : 'お問い合わせ内容を5文字以上で入力してください。'),
};

function checkField(input) {
  const msg = RULES[input.name] ? RULES[input.name](input.value) : '';
  const err = $('#' + input.id + '-err');
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  err.textContent = msg;
  err.hidden = !msg;
  return !msg;
}
$$('input[required], textarea[required]', contact).forEach((input) => {
  input.addEventListener('blur', () => { if (input.value) checkField(input); });
  input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') checkField(input); });
});

contact.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.className = 'form-status';
  const fields = $$('input[required], textarea[required]', contact);
  const results = fields.map(checkField);
  if (results.includes(false)) {
    fields[results.indexOf(false)].focus();
    return;
  }
  if (FORMSPREE_ENDPOINT.includes('YOUR_FORM_ID')) {
    statusEl.textContent = '見本サイトのため、送信先はまだ設定していません（js/main.js の FORMSPREE_ENDPOINT を設定すると送れるようになります）。';
    return;
  }
  const button = $('button[type="submit"]', contact);
  button.disabled = true;
  statusEl.textContent = '送信しています…';
  try {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      body: new FormData(contact),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    contact.reset();
    statusEl.classList.add('is-ok');
    statusEl.textContent = '送信しました。3営業日以内にメールでお返事します。';
  } catch (err) {
    statusEl.classList.add('is-ng');
    statusEl.textContent = '送信できませんでした。時間をおいて、もう一度お試しください。';
  } finally {
    button.disabled = false;
  }
});
