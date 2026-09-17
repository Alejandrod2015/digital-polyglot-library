/* Redes (organico): dos formatos que NO son el Lector + Practice del telefono.
 *
 *  61 "quiz": el que mira juega. Se oye una frase real de una historia, sale la
 *     pregunta con las cuatro opciones del Meaning publicado y una cuenta atras,
 *     y se resuelve con el sonido de acierto de la app.
 *  62 "tour": seis paises, seis expresiones, cortes de dos segundos. Cada una
 *     con la portada de su historia, su definicion y el trozo narrado.
 *
 * Datos: palabras y tiempos de adStories.js (los de la app), definiciones y
 * opciones de las escenas 51-56. Los trozos de audio se cortan en silencios
 * MEDIDOS (RMS a 40 ms) y el render los mezcla desde __ad.clips.
 *
 * Funcion pura del tiempo, como el resto: el render pide fotogramas sueltos.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const SCENE = Number(params.get("scene") || 1);
  if (SCENE !== 61 && SCENE !== 62) return;

  const STORIES = window.__AD_STORIES;
  const AUDIO_DIR = "/tmp/claude-501/dpl-ads/audio/";

  const FLAG = {
    ES: '<rect width="3" height="2" fill="#AA151B"/><rect width="3" height="1" y="0.5" fill="#F1BF00"/>',
    MX: '<rect width="1" height="2" x="0" fill="#006847"/><rect width="1" height="2" x="1" fill="#FFFFFF"/><rect width="1" height="2" x="2" fill="#CE1126"/>' +
      '<image href="../../public/flags/mx-coat.png" x="1.06" y="0.53" width="0.88" height="0.94" preserveAspectRatio="xMidYMid meet"/>',
    CO: '<rect width="3" height="1" y="0" fill="#FCD116"/><rect width="3" height="0.5" y="1" fill="#003893"/><rect width="3" height="0.5" y="1.5" fill="#CE1126"/>',
    PE: '<rect width="1" height="2" x="0" fill="#D91023"/><rect width="1" height="2" x="1" fill="#FFFFFF"/><rect width="1" height="2" x="2" fill="#D91023"/>',
    CL: '<rect width="3" height="1" fill="#FFFFFF"/><rect width="3" height="1" y="1" fill="#D52B1E"/><rect width="1" height="1" fill="#0039A6"/>' +
      '<polygon fill="#FFFFFF" points="0.5,0.2 0.57,0.4 0.78,0.4 0.61,0.52 0.67,0.72 0.5,0.6 0.33,0.72 0.39,0.52 0.22,0.4 0.43,0.4"/>',
    AR: '<rect width="3" height="2" fill="#74ACDF"/><rect width="3" height="0.667" y="0.667" fill="#FFFFFF"/><circle cx="1.5" cy="1" r="0.2" fill="#F6B40E"/>',
  };
  function flag(code, w) {
    return '<svg viewBox="0 0 3 2" width="' + w + '" height="' + (w * 2) / 3 + '" style="border-radius:3px;display:block">' + FLAG[code] + "</svg>";
  }

  function ease(x) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3); }

  /* Un trozo narrado: palabras [from, to] de una ventana, con el corte del
   * audio medido (off: donde empieza respecto a la primera palabra; len: lo
   * que dura hasta el silencio tras la ultima). key: palabras con pastilla. */
  function snippet(sp) {
    const st = STORIES[sp.story];
    const W = st.words;
    return Object.assign({}, sp, {
      W: W, cover: st.cover, origin: sp.from,
      audio: AUDIO_DIR + sp.story + ".mp3",
      ss: st.audioStart + W[sp.from].s + sp.off,
    });
  }

  /** Subtitulo con karaoke. `u` = segundos desde que arranca el clip. */
  function captionHTML(sp, idPrefix) {
    let es = sp.lead || "";
    for (let i = sp.from; i <= sp.to; i++) {
      const w = sp.W[i];
      let txt = w.t.replace(/[“”]/g, "");
      if (i === sp.from && !sp.lead) txt = txt.charAt(0).toUpperCase() + txt.slice(1);
      const pre = i === sp.from ? (sp.pre || "") : "";
      // La expresion va en UNA pastilla aunque sean varias palabras.
      const tail = i === sp.to ? sp.end : (w.post || "").replace(/[“”]/g, "") + " ";
      if (i === sp.key[0]) es += pre + '<span class="key">';
      else es += pre;
      if (i >= sp.key[0] && i <= sp.key[1]) {
        es += txt + (i === sp.key[1] ? "</span>" + tail : tail);
      } else {
        es += '<span id="' + idPrefix + i + '">' + txt + "</span>" + tail;
      }
    }
    return es;
  }
  function paintCaption(sp, idPrefix, u) {
    for (let i = sp.from; i <= sp.to; i++) {
      const n = document.getElementById(idPrefix + i);
      if (!n) continue;
      if (i >= sp.key[0] && i <= sp.key[1]) continue;
      const s = sp.W[i].s - sp.W[sp.origin].s - sp.off;
      const e = sp.W[i].e - sp.W[sp.origin].s - sp.off;
      n.className = u >= s && u < Math.min(e, sp.len) ? "on" : "";
    }
  }

  const css = document.createElement("style");
  css.textContent = [
    "#root{padding:0!important;background:#051834!important}",
    ".sf{position:absolute;inset:0;overflow:hidden;font-family:Nunito,system-ui,sans-serif;color:#fff}",
    ".sfBg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 45%}",
    ".sfScrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,24,52,.92) 0%,rgba(5,24,52,.62) 26%,rgba(5,24,52,.30) 44%,rgba(5,24,52,.55) 60%,rgba(5,24,52,.94) 80%,#051834 100%)}",
    ".sfHead{position:absolute;top:142px;left:24px;right:24px;text-align:center;font-weight:900;font-size:34px;line-height:1.26;letter-spacing:-.035em;text-shadow:0 2px 18px rgba(0,0,0,.35)}",
    ".sfHead .pill{color:#0a2340;background:#fcd34d;padding:1px 10px 3px;border-radius:10px;text-shadow:none;-webkit-box-decoration-break:clone;box-decoration-break:clone}",
    ".sfChip{position:absolute;left:50%;display:flex;align-items:center;gap:9px;background:#fff;color:#0a2340;font-weight:900;font-size:15px;letter-spacing:.13em;padding:7px 15px 7px 9px;border-radius:999px;box-shadow:0 10px 24px -10px rgba(0,0,0,.5);white-space:nowrap}",
    ".sfChip small{font-size:13px;letter-spacing:.04em;color:rgba(10,35,64,.5);margin-left:4px}",
    ".sfWord{position:absolute;left:0;right:0;text-align:center}",
    ".sfWord span{display:inline-block;font-weight:900;font-size:60px;line-height:1;letter-spacing:-.04em;color:#0a2340;background:#fcd34d;padding:8px 24px 14px;border-radius:20px;box-shadow:0 18px 40px -14px rgba(0,0,0,.6)}",
    ".sfMean{position:absolute;left:24px;right:24px;text-align:center;font-weight:900;font-size:27px;letter-spacing:-.02em;text-shadow:0 2px 14px rgba(0,0,0,.6)}",
    ".sfMean span{display:inline-block;background:rgba(10,35,64,.9);padding:5px 16px 7px;border-radius:14px;text-shadow:none}",
    ".sfMean em{font-style:normal;color:#fcd34d}",
    ".sfCap{position:absolute;left:22px;right:22px;text-align:center}",
    ".sfCapBox{display:inline-block;background:rgba(10,35,64,.94);border-radius:18px;padding:12px 18px 13px;box-shadow:0 16px 36px -14px rgba(0,0,0,.6)}",
    ".sfEs{font-weight:900;font-size:26px;line-height:1.24;letter-spacing:-.02em}",
    ".sfEs .on{color:#fcd34d}.sfEs .key{color:#0a2340;background:#fcd34d;padding:0 7px 2px;border-radius:8px;white-space:nowrap}",
    ".sfEn{margin-top:5px;font-weight:800;font-size:15px;line-height:1.3;color:rgba(255,255,255,.74)}",
    ".sfLabel{font-weight:900;font-size:12px;letter-spacing:.16em;color:rgba(255,255,255,.62);margin-bottom:8px}",
    ".sfBars{position:absolute;top:742px;left:50%;transform:translateX(-50%);display:flex;gap:6px}",
    ".sfBars i{display:block;width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,.25);overflow:hidden}",
    ".sfBars i b{display:block;height:100%;background:#fcd34d}",
    // Quiz
    ".sfQuiz{position:absolute;inset:0;background:radial-gradient(ellipse 110% 55% at 50% 0%,#1d437a 0%,#08264d 58%,#051834 100%)}",
    ".sfTimer{position:absolute;top:252px;left:60px;right:60px;height:8px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden}",
    ".sfTimer b{display:block;height:100%;background:#fcd34d;border-radius:4px}",
    ".sfGrid{position:absolute;top:292px;left:34px;right:34px;display:grid;grid-template-columns:1fr 1fr;gap:14px}",
    ".sfOpt{position:relative;height:138px;border-radius:18px;background:#0f2c55;border:2px solid rgba(125,211,252,.16);display:flex;align-items:center;justify-content:center;text-align:center;padding:18px 12px 12px;font-weight:900;font-size:21px;line-height:1.2;letter-spacing:-.01em}",
    ".sfOpt i{position:absolute;top:12px;left:50%;width:34px;height:4px;margin-left:-17px;border-radius:2px}",
    ".sfOpt.ok{background:#0d4d45;border-color:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.18),0 18px 40px -12px rgba(52,211,153,.45)}",
    ".sfOpt.ok::after{content:'';position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:50%;background:#34d399 url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4 8-9' fill='none' stroke='%23062b26' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") center/16px no-repeat}",
    ".sfOpt.off{opacity:.32}",
    ".sfCount{position:absolute;top:606px;left:50%;width:68px;height:68px;margin-left:-34px;border-radius:50%;border:3px solid #fcd34d;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:36px;color:#fcd34d}",
    ".sfReveal{position:absolute;top:604px;left:26px;right:26px;text-align:center}",
  ].join("");
  document.head.appendChild(css);

  const root = document.getElementById("root");
  root.className = "page";
  const clips = [];
  const sfx = [];
  let duration = 0;
  let seek;

  /* ------------------------------------------------------------------ 61 */
  if (SCENE === 61) {
    const sp = snippet({
      story: "gato", from: 2, to: 12, key: [10, 12], off: 0.66, len: 3.14, end: ".",
      chunks: [[2, 7], [8, 12]],
    });
    const hint = snippet({ story: "gato", from: 10, to: 12, key: [10, 12], off: -0.02, len: 0.8, end: "" });
    const Q = { options: ["the whole town", "only the owner", "not a soul", "half the street"], correct: 2 };
    const ACC = ["#fbbf24", "#38bdf8", "#c084fc", "#34d399"];
    const QUIZ_AT = 3.4, REVEAL = 5.3, HINT_AT = 5.7;
    duration = 7.4;
    clips.push({ file: sp.audio, ss: sp.ss, len: sp.len, at: 0 });
    clips.push({ file: hint.audio, ss: hint.ss, len: hint.len, at: HINT_AT });
    sfx.push({ file: "practice-correct.mp3", at: REVEAL });

    // Cada trozo del subtitulo es el mismo clip, recortado a sus palabras.
    const chunkSp = sp.chunks.map(function (c, k) {
      return Object.assign({}, sp, { from: c[0], to: c[1], end: k === 0 ? "" : ".", key: sp.key });
    });

    root.innerHTML =
      '<div class="sf" id="s1">' +
        '<img class="sfBg" id="bg" src="' + sp.cover + '" alt="">' +
        '<div class="sfScrim"></div>' +
        '<div class="sfHead">Would you get this<br><span class="pill">in Spain?</span></div>' +
        '<div class="sfChip" style="top:262px;transform:translateX(-50%)">' + flag("ES", 26) + "SPAIN</div>" +
        '<div class="sfCap" style="top:470px"><div class="sfLabel">HEARD IN A STORY</div><div class="sfCapBox"><div class="sfEs" id="capEs"></div></div></div>' +
      "</div>" +
      '<div class="sf" id="s2" style="display:none">' +
        '<div class="sfQuiz"></div>' +
        '<div class="sfHead" id="qHead">What does<br><span class="pill">&ldquo;ni el gato&rdquo; mean?</span></div>' +
        '<div class="sfTimer" id="timer"><b id="timerFill"></b></div>' +
        '<div class="sfGrid">' + Q.options.map(function (o, i) {
          return '<div class="sfOpt" id="opt' + i + '"><i style="background:' + ACC[i] + '"></i>' + o + "</div>";
        }).join("") + "</div>" +
        '<div class="sfCount" id="count">3</div>' +
        '<div class="sfReveal" id="reveal" style="opacity:0"><div class="sfCapBox">' +
          '<div class="sfEs">' + captionHTML(Object.assign({}, sp, { end: "." }), "rv") + "</div>" +
          '<div class="sfEn">&ldquo;Here at 1:30, not even the cat eats.&rdquo; Nobody does.</div>' +
        "</div></div>" +
      "</div>";

    let shown = -1;
    seek = function (t) {
      const s1 = document.getElementById("s1"), s2 = document.getElementById("s2");
      if (t < QUIZ_AT) {
        s1.style.display = ""; s2.style.display = "none";
        document.getElementById("bg").style.transform = "scale(" + (1.12 - 0.1 * ease(t / QUIZ_AT)) + ")";
        let k = 0;
        chunkSp.forEach(function (c, i) { if (t >= c.W[c.from].s - sp.W[sp.from].s - sp.off - 0.05) k = i; });
        if (k !== shown) { document.getElementById("capEs").innerHTML = captionHTML(chunkSp[k], "c"); shown = k; }
        paintCaption(chunkSp[k], "c", t);
        return;
      }
      s1.style.display = "none"; s2.style.display = "";
      const u = t - QUIZ_AT;
      const left = Math.max(0, REVEAL - t);
      const total = REVEAL - QUIZ_AT;
      const revealed = t >= REVEAL;
      document.getElementById("timerFill").style.width = (left / total) * 100 + "%";
      document.getElementById("timer").style.opacity = revealed ? "0" : "1";
      const count = document.getElementById("count");
      count.textContent = String(Math.max(1, Math.ceil((left / total) * 3)));
      count.style.opacity = revealed ? "0" : "1";
      count.style.transform = "scale(" + (1.18 - 0.18 * ease(((total - left) % (total / 3)) / 0.2)) + ")";
      Q.options.forEach(function (_, i) {
        const n = document.getElementById("opt" + i);
        n.className = "sfOpt" + (revealed ? (i === Q.correct ? " ok" : " off") : "");
        const pop = i === Q.correct && revealed ? 1 + 0.06 * Math.sin(Math.PI * Math.min(1, (t - REVEAL) / 0.3)) : 1;
        const inn = 0.94 + 0.06 * ease((u - i * 0.04) / 0.18);
        n.style.transform = "scale(" + pop * inn + ")";
      });
      const rv = document.getElementById("reveal");
      const g = revealed ? ease((t - REVEAL - 0.1) / 0.25) : 0;
      rv.style.opacity = String(g);
      rv.style.transform = "translateY(" + (1 - g) * 12 + "px)";
      // La frase de la historia se ilumina otra vez con "ni el gato" en su sitio.
      paintCaption(Object.assign({}, sp, { end: "." }), "rv", 99);
    };
  }

  /* ------------------------------------------------------------------ 62 */
  if (SCENE === 62) {
    const TOUR = [
      { cc: "ES", country: "SPAIN", word: "ni el gato", mean: "not a soul", en: "not even the cat eats.",
        sp: { story: "gato", from: 8, to: 12, key: [10, 12], off: -0.08, len: 1.44, lead: "&hellip;", end: "." } },
      { cc: "MX", country: "MEXICO", word: "qué pedo", mean: "what's up", en: "What's up, finally remembered us?",
        sp: { story: "pedo", from: 9, to: 15, key: [9, 10], off: 0.3, len: 2.06, pre: "¿", end: "?" } },
      { cc: "CO", country: "COLOMBIA", word: "la comedera", mean: "a sudden craving to eat", en: "in case she got a craving on the way.",
        sp: { story: "comedera", from: 10, to: 18, key: [17, 18], off: 0, len: 2.22, lead: "&hellip;", end: "." } },
      { cc: "PE", country: "PERU", word: "roche", mean: "embarrassment", en: "into the cringe of not understanding a thing.",
        sp: { story: "roche", from: 7, to: 13, key: [9, 9], off: -0.04, len: 2.2, lead: "&hellip;", end: "." } },
      { cc: "CL", country: "CHILE", word: "quedó la escoba", mean: "it turned out wild", en: "and it turned out wild.",
        sp: { story: "escoba", from: 13, to: 16, key: [14, 16], off: -0.02, len: 0.94, lead: "&hellip;", end: "." } },
      { cc: "AR", country: "ARGENTINA", word: "embalada", mean: "carried away", en: "because she was carried away with someone too.",
        sp: { story: "embalada", from: 20, to: 26, key: [24, 24], off: 0, len: 2.42, lead: "&hellip;", end: "." } },
    ];
    const LEAD = 0.14, TAIL = 0.42, MIN = 1.5;
    let at = 0;
    TOUR.forEach(function (seg, i) {
      seg.sp = snippet(seg.sp);
      seg.start = at;
      seg.clipAt = at + (i === 0 ? 0.02 : LEAD);
      seg.dur = Math.max(MIN, (seg.clipAt - at) + seg.sp.len + TAIL);
      at += seg.dur;
      clips.push({ file: seg.sp.audio, ss: seg.sp.ss, len: seg.sp.len, at: seg.clipAt });
    });
    duration = Math.round(at * 30) / 30;

    root.innerHTML =
      '<div class="sf">' +
        TOUR.map(function (seg, i) {
          return '<img class="sfBg" id="bg' + i + '" src="' + seg.sp.cover + '" alt="" style="opacity:0">';
        }).join("") +
        '<div class="sfScrim"></div>' +
        '<div class="sfHead">6 countries.<br><span class="pill">6 words textbooks skip.</span></div>' +
        '<div class="sfChip" id="chip" style="top:258px"></div>' +
        '<div class="sfWord" id="word" style="top:312px"><span></span></div>' +
        '<div class="sfMean" id="mean" style="top:410px"></div>' +
        '<div class="sfCap" id="cap" style="top:600px"></div>' +
        '<div class="sfBars">' + TOUR.map(function (_, i) { return '<i><b id="bar' + i + '"></b></i>'; }).join("") + "</div>" +
      "</div>";

    let shown = -1;
    seek = function (t) {
      let k = 0;
      TOUR.forEach(function (seg, i) { if (t >= seg.start) k = i; });
      const seg = TOUR[k];
      const u = t - seg.start;
      if (k !== shown) {
        TOUR.forEach(function (_, i) { document.getElementById("bg" + i).style.opacity = i === k ? "1" : "0"; });
        document.getElementById("chip").innerHTML = flag(seg.cc, 26) + seg.country + "<small>" + (k + 1) + "/6</small>";
        document.getElementById("word").firstChild.textContent = seg.word;
        document.getElementById("mean").innerHTML = "<span>= <em>" + seg.mean + "</em></span>";
        document.getElementById("cap").innerHTML = '<div class="sfCapBox"><div class="sfEs">' + captionHTML(seg.sp, "c") +
          '</div><div class="sfEn">' + seg.en + "</div></div>";
        shown = k;
      }
      document.getElementById("bg" + k).style.transform = "scale(" + (1.14 - 0.1 * ease(u / seg.dur)) + ")";
      // Golpe de entrada: la palabra llega grande y torcida y se asienta.
      const p = k === 0 ? 1 : ease(u / 0.22);
      document.getElementById("word").style.transform = "rotate(" + (-3 - 4 * (1 - p)) + "deg) scale(" + (1.25 - 0.25 * p) + ")";
      document.getElementById("chip").style.transform = "translateX(-50%) translateY(" + (1 - p) * -10 + "px)";
      const m = k === 0 ? 1 : ease((u - 0.08) / 0.22);
      document.getElementById("mean").style.opacity = String(m);
      document.getElementById("mean").style.transform = "translateY(" + (1 - m) * 10 + "px)";
      paintCaption(seg.sp, "c", t - seg.clipAt);
      TOUR.forEach(function (s, i) {
        document.getElementById("bar" + i).style.width = (i < k ? 100 : i > k ? 0 : Math.min(100, (u / s.dur) * 100)) + "%";
      });
    };
  }

  window.__ad = Object.assign({}, window.__ad, {
    seek: seek, duration: duration, audioUntil: null, sfx: sfx, clips: clips,
  });
  seek(0);
})();
