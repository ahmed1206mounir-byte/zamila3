(function () {
  "use strict";

  const LETTERS = ["أ", "ب", "ج", "د"];
  const STORE_KEY = "sn-culture-best-v1";

  const $ = (id) => document.getElementById(id);
  const screens = { home: $("home"), quiz: $("quiz"), result: $("result") };

  let session = null; // الجلسة الحالية

  /* ---------- التخزين المحلي (أفضل نتيجة) ---------- */
  function loadBest() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveBest(key, percent) {
    try {
      const b = loadBest();
      if (percent > (b[key] || 0)) {
        b[key] = percent;
        localStorage.setItem(STORE_KEY, JSON.stringify(b));
      }
    } catch (e) { /* التخزين غير متاح */ }
  }

  /* ---------- أدوات ---------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function show(name) {
    Object.keys(screens).forEach((k) => (screens[k].hidden = k !== name));
    window.scrollTo({ top: 0 });
  }

  function axisOf(index) {
    return AXES.find((a) => index >= a.from && index < a.to);
  }

  /* ---------- الرئيسية ---------- */
  function renderHome() {
    const best = loadBest();
    const list = $("axesList");
    list.innerHTML = "";
    AXES.forEach((axis) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "axis-card";
      const count = axis.to - axis.from;
      const b = best["axis" + axis.id];
      btn.innerHTML =
        '<span class="axis-title">' + axis.name +
        '<span class="axis-meta">' + count + " سؤالاً</span></span>" +
        (b !== undefined ? '<span class="axis-best">أفضل نتيجة: ' + b + "%</span>" : "");
      btn.addEventListener("click", () => {
        const items = [];
        for (let i = axis.from; i < axis.to; i++) items.push(i);
        start({ key: "axis" + axis.id, label: axis.name, indices: items });
      });
      list.appendChild(btn);
    });
    show("home");
  }

  /* ---------- بدء الاختبار ---------- */
  function start(config) {
    const useShuffle = $("shuffleOpts").checked;
    session = {
      config: config,
      useShuffle: useShuffle,
      order: config.random ? shuffle(config.indices) : config.indices.slice(),
      pos: 0,
      score: 0,
      answered: false,
      wrong: []
    };
    if (config.random) session.order = session.order.slice(0, config.limit);
    show("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const s = session;
    const idx = s.order[s.pos];
    const item = QUESTIONS[idx];
    s.answered = false;

    let opts = item.o.map((text, i) => ({ text: text, correct: i === item.a }));
    if (s.useShuffle) opts = shuffle(opts);
    s.current = { idx: idx, opts: opts };

    const total = s.order.length;
    $("quizAxis").textContent = s.config.random || s.config.key === "all"
      ? axisOf(idx).name
      : s.config.label;
    $("quizCount").textContent = "السؤال " + (s.pos + 1) + " من " + total;
    $("progressFill").style.width = (s.pos / total) * 100 + "%";
    $("progress").setAttribute("aria-valuenow", Math.round((s.pos / total) * 100));
    $("questionText").textContent = item.q;
    $("scoreLive").textContent = "الصحيحة: " + s.score;
    $("feedback").textContent = "";
    $("feedback").className = "feedback";
    $("nextBtn").disabled = true;
    $("nextBtn").textContent = s.pos === total - 1 ? "عرض النتيجة" : "التالي";

    const box = $("options");
    box.innerHTML = "";
    opts.forEach((o, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "option";
      b.innerHTML = '<span class="opt-key">' + LETTERS[i] + '</span><span class="opt-text"></span>';
      b.querySelector(".opt-text").textContent = o.text;
      b.addEventListener("click", () => choose(i));
      box.appendChild(b);
    });
  }

  function choose(i) {
    const s = session;
    if (s.answered) return;
    s.answered = true;

    const opts = s.current.opts;
    const buttons = Array.from($("options").children);
    const ok = opts[i].correct;

    buttons.forEach((b, k) => {
      b.disabled = true;
      if (opts[k].correct) b.classList.add("correct");
      else if (k === i) b.classList.add("wrong");
      else b.classList.add("dim");
    });

    const fb = $("feedback");
    if (ok) {
      s.score++;
      fb.textContent = "✓ إجابة صحيحة";
      fb.className = "feedback ok";
    } else {
      const right = opts.find((o) => o.correct).text;
      fb.textContent = "✕ إجابة خاطئة. الصحيح: " + right;
      fb.className = "feedback no";
      s.wrong.push({ idx: s.current.idx, chosen: opts[i].text, right: right });
    }
    $("scoreLive").textContent = "الصحيحة: " + s.score;
    $("nextBtn").disabled = false;
    $("nextBtn").focus();
  }

  function next() {
    const s = session;
    if (!s.answered) return;
    if (s.pos < s.order.length - 1) {
      s.pos++;
      renderQuestion();
    } else {
      finish();
    }
  }

  /* ---------- النتيجة ---------- */
  function finish() {
    const s = session;
    const total = s.order.length;
    const percent = Math.round((s.score / total) * 100);
    if (!s.config.retry) saveBest(s.config.key, percent);

    $("ring").style.setProperty("--p", percent);
    $("resPercent").textContent = percent + "%";
    $("resDetail").textContent = "أجبت عن " + s.score + " من " + total + " أسئلة إجابة صحيحة.";
    $("resTitle").textContent =
      percent >= 90 ? "ممتاز" :
      percent >= 75 ? "جيد جداً" :
      percent >= 50 ? "مقبول، واصل التدرّب" : "تحتاج إلى مزيد من المراجعة";

    $("retryWrong").hidden = s.wrong.length === 0;

    const rev = $("review");
    rev.innerHTML = "";
    if (s.wrong.length === 0) {
      rev.innerHTML = '<div class="all-good">كل إجاباتك صحيحة. لا توجد أسئلة للمراجعة.</div>';
    } else {
      const h = document.createElement("h3");
      h.textContent = "أسئلة للمراجعة (" + s.wrong.length + ")";
      rev.appendChild(h);
      s.wrong.forEach((w) => {
        const d = document.createElement("div");
        d.className = "rev-item";
        const q = document.createElement("p");
        q.className = "rev-q";
        q.textContent = QUESTIONS[w.idx].q;
        const you = document.createElement("p");
        you.className = "rev-line you";
        you.innerHTML = '<span class="rev-label">إجابتك: </span>';
        you.append(w.chosen);
        const right = document.createElement("p");
        right.className = "rev-line right";
        right.innerHTML = '<span class="rev-label">الصحيح: </span>';
        right.append(w.right);
        d.append(q, you, right);
        rev.appendChild(d);
      });
    }
    $("progressFill").style.width = "100%";
    show("result");
  }

  /* ---------- الأحداث ---------- */
  $("startAll").addEventListener("click", () =>
    start({ key: "all", label: "كل الأسئلة", indices: QUESTIONS.map((_, i) => i), random: true, limit: QUESTIONS.length })
  );
  $("startRandom").addEventListener("click", () =>
    start({ key: "random", label: "اختبار عشوائي", indices: QUESTIONS.map((_, i) => i), random: true, limit: 20 })
  );
  $("nextBtn").addEventListener("click", next);
  $("brandBtn").addEventListener("click", renderHome);
  $("goHome").addEventListener("click", renderHome);
  $("restartSame").addEventListener("click", () => {
    const c = Object.assign({}, session.config);
    delete c.retry;
    if (!c.random) c.indices = c.indices.slice();
    start(c);
  });
  $("retryWrong").addEventListener("click", () => {
    const idxs = session.wrong.map((w) => w.idx);
    start({ key: session.config.key, label: "مراجعة الأخطاء", indices: idxs, retry: true });
  });

  document.addEventListener("keydown", (e) => {
    if (screens.quiz.hidden || !session) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= session.current.opts.length && !session.answered) {
      choose(n - 1);
    } else if ((e.key === "Enter" || e.key === " ") && session.answered) {
      if (document.activeElement !== $("nextBtn")) { e.preventDefault(); next(); }
    }
  });

  /* ---------- بوابة الدخول ---------- */
  const PASSWORD = "zamila";
  const GATE_KEY = "sn-culture-unlocked";

  function unlock() {
    document.body.classList.remove("locked");
    try { sessionStorage.setItem(GATE_KEY, "1"); } catch (e) {}
    window.scrollTo({ top: 0 });
  }

  (function initGate() {
    try {
      if (sessionStorage.getItem(GATE_KEY) === "1") { unlock(); return; }
    } catch (e) {}
    const form = $("gateForm");
    const input = $("gatePass");
    input.focus();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (input.value.trim().toLowerCase() === PASSWORD) {
        unlock();
      } else {
        $("gateError").textContent = "كلمة السر غير صحيحة. حاول مرة أخرى.";
        input.select();
        form.classList.remove("shake");
        void form.offsetWidth;
        form.classList.add("shake");
      }
    });
  })();

  renderHome();
})();
