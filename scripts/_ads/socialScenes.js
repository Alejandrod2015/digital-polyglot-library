/* Piezas para redes (organico: Reels, TikTok, Shorts).
 *
 * No es otra escena desde cero: envuelve el Lector + Practice de adScenes.js
 * (__ad.seek) y le cambia el ritmo encima. Lo que se queda igual es lo que ya
 * funciona: karaoke con la narracion real, la tarjeta del vocabulario y el
 * Meaning publicado con su sonido. Lo que cambia:
 *
 *  1. Gancho en el fotograma 0: titular puesto y la palabra en grande, sin
 *     entrada suave (en el feed el primer segundo decide).
 *  2. Zoom del telefono a la linea de la palabra mientras suena, y luego a la
 *     palabra con su tarjeta.
 *  3. Subtitulo grande de la frase narrada, con la traduccion debajo: se
 *     entiende en silencio.
 *  4. Corte seco a Practice (sin deslizamiento), destello al acertar.
 *  5. Bucle: el ultimo fotograma es el primero, asi la repeticion no salta.
 *
 * Franjas libres (1920 de alto): arriba el 14 % y abajo el 20 % los tapa la
 * interfaz de Reels y TikTok; a la derecha, la columna de botones.
 *
 * Sigue siendo una funcion PURA del tiempo: el render pide fotogramas sueltos.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const SCENE = Number(params.get("scene") || 1);

  const SOCIAL = {
    60: {
      sticker: { tag: "PERUVIAN SLANG", word: "roche", out: 1.25 },
      // Trozos del subtitulo por indice de palabra de la ventana, con su
      // traduccion. La palabra clave va con la pastilla.
      caption: [
        { from: 0, to: 3, en: "But every strange word" },
        { from: 4, to: 9, en: "sank her deeper into the cringe" },
        { from: 10, to: 13, en: "of not understanding a thing." },
      ],
      key: "roche",
      zoom: { inAt: 2.25, inDur: 0.4, z1: 1.6, panAt: 3.35, panDur: 0.4, z2: 1.28 },
      // Igual que switchAt de la escena; el acierto cae en switchAt + tap - 0,4.
      switchAt: 4.85,
      hit: 6.2,
      loopDur: 0.32,
      // Pantalla final con CTA. Con ella no hay bucle: el video acaba en que hacer.
      // Lo que dice es lo que hay: /beta es una solicitud de acceso anticipado.
      end: { at: 7.5 },
    },
  };
  const C = SOCIAL[SCENE];
  if (!C || !window.__ad) return;

  const base = window.__ad;
  const seek0 = base.seek;
  const FPS = 30;
  const D = base.duration;
  // Ultimo fotograma que pide el render: ahi el bucle tiene que haber cerrado.
  const LAST = (Math.round(D * FPS) - 1) / FPS;
  const LOOP_AT = LAST - C.loopDur;
  const SW = C.switchAt;
  // adScenes desliza 0,4 s al cambiar de pantalla: sumarlos despues del corte
  // lo convierte en un corte seco sin tocar su codigo.
  const SLIDE = 0.4;
  const orig = function (t) { return t < SW ? t : t + SLIDE; };

  function ease(x) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3); }
  function easeIO(x) { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  const css = document.createElement("style");
  css.textContent =
    ".soSticker{position:absolute;left:50%;top:352px;z-index:6;text-align:center;pointer-events:none;transform-origin:50% 50%}" +
    ".soTag{display:inline-block;font-weight:900;font-size:13px;letter-spacing:.14em;color:#0a2340;background:#fff;" +
      "padding:5px 12px 6px;border-radius:999px;box-shadow:0 8px 20px -8px rgba(10,35,64,.45)}" +
    ".soWord{display:block;margin-top:8px;font-weight:900;font-size:76px;line-height:1;letter-spacing:-.04em;color:#0a2340;" +
      "background:#fcd34d;padding:6px 26px 14px;border-radius:22px;box-shadow:0 18px 40px -14px rgba(10,35,64,.55)}" +
    ".soCap{position:absolute;left:24px;right:24px;top:640px;z-index:6;text-align:center;pointer-events:none}" +
    ".soCapBox{display:inline-block;background:rgba(10,35,64,.94);border-radius:18px;padding:12px 18px 13px;" +
      "box-shadow:0 16px 36px -14px rgba(10,35,64,.6)}" +
    ".soEs{font-weight:900;font-size:27px;line-height:1.22;letter-spacing:-.02em;color:#fff}" +
    ".soEs .on{color:#fcd34d}" +
    ".soEs .key{color:#0a2340;background:#fcd34d;padding:0 8px 2px;border-radius:8px}" +
    ".soEn{margin-top:4px;font-weight:800;font-size:15px;line-height:1.3;color:rgba(255,255,255,.72)}" +
    // El titular queda por encima del telefono cuando este crece con el zoom.
    "#head{position:relative;z-index:7;margin-top:14px}" +
    ".soEnd{position:absolute;inset:0;z-index:20;text-align:center;padding:0 36px;" +
      "background:radial-gradient(ellipse 70% 42% at 50% 2%,rgba(252,211,77,.30) 0%,transparent 62%),linear-gradient(180deg,#fdfbf5 0%,#f3f0e7 55%,#eae5d8 100%)}" +
    ".soLogo{display:block;width:230px;margin:224px auto 0}" +
    ".soEndHead{margin:40px 0 0;font-weight:900;font-size:38px;line-height:1.26;letter-spacing:-.035em;color:#0a2340}" +
    ".soEndHead span{background:#fcd34d;padding:1px 10px 3px;border-radius:10px}" +
    ".soBtn{margin:46px auto 0;max-width:400px;background:#0a2340;color:#fff;font-weight:900;font-size:25px;letter-spacing:-.01em;" +
      "padding:20px 24px 22px;border-radius:999px;box-shadow:0 20px 40px -16px rgba(10,35,64,.55)}" +
    ".soUrl{margin-top:22px;font-weight:900;font-size:23px;color:#0a2340;letter-spacing:-.01em}" +
    ".soPlat{margin-top:6px;font-weight:800;font-size:15px;color:rgba(10,35,64,.56)}" +
    ".soFlash{position:absolute;z-index:5;pointer-events:none;border-radius:40px;" +
      "background:radial-gradient(circle,rgba(252,211,77,.85) 0%,rgba(252,211,77,.25) 45%,transparent 70%)}";
  document.head.appendChild(css);

  // Un pelo mas pequeno que la 54: con el titular 14 px mas abajo, el pie del
  // telefono no se mete en la franja que tapa la interfaz.
  document.documentElement.style.setProperty("--scale", "0.93");
  const root = document.getElementById("root");
  const wrap = document.querySelector(".adPhoneWrap");
  const phone = document.getElementById("phone");
  const head = document.getElementById("head");
  const hookA = document.getElementById("hookA");
  const hookB = document.getElementById("hookB");

  const sticker = document.createElement("div");
  sticker.className = "soSticker";
  sticker.innerHTML = '<span class="soTag">' + C.sticker.tag + '</span><span class="soWord">' + C.sticker.word + "</span>";
  root.appendChild(sticker);

  const cap = document.createElement("div");
  cap.className = "soCap";
  root.appendChild(cap);

  const flash = document.createElement("div");
  flash.className = "soFlash";
  root.appendChild(flash);

  const STORY = window.__AD_STORIES[{ 60: "roche" }[SCENE]];
  const W = STORY.words;
  function norm(s) { return s.toLowerCase().replace(/[^a-záéíóúñü]/g, ""); }
  const keyNode = Array.prototype.slice.call(document.querySelectorAll("#comboA #storyBody .w"))
    .find(function (n) { return norm(n.textContent) === C.key; });
  const panel = document.getElementById("panel");

  // El subtitulo se pinta una vez por trozo; por fotograma solo cambian clases.
  const chunkHTML = C.caption.map(function (ch) {
    let es = "";
    for (let i = ch.from; i <= ch.to; i++) {
      const w = W[i];
      const k = norm(w.t) === C.key;
      es += (w.pre || "") + '<span data-i="' + i + '"' + (k ? ' class="key"' : "") + ">" + w.t + "</span>" + (w.post || "") + (i < ch.to ? " " : "");
    }
    return '<div class="soCapBox"><div class="soEs">' + es + '</div><div class="soEn">' + ch.en + "</div></div>";
  });
  let shown = -1;

  function caption(t, alpha) {
    let k = 0;
    C.caption.forEach(function (ch, i) { if (t >= W[ch.from].s) k = i; });
    if (k !== shown) { cap.innerHTML = chunkHTML[k]; shown = k; }
    Array.prototype.slice.call(cap.querySelectorAll("[data-i]")).forEach(function (n) {
      const i = Number(n.getAttribute("data-i"));
      const on = t >= W[i].s && t < W[i].e;
      if (n.className !== "key") n.className = on ? "on" : "";
    });
    cap.style.opacity = String(alpha);
  }

  /* Zoom: se mide sin transformar y se lleva el punto de interes a un sitio
   * fijo del lienzo. */
  const TARGET = { x: 270, y: 470 };
  function center(node) {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function zoom(t) {
    wrap.style.transformOrigin = "0 0";
    wrap.style.transform = "none";
    const Z = C.zoom;
    if (t >= SW || t < Z.inAt) return;
    const O = wrap.getBoundingClientRect();
    // En horizontal manda el telefono (centrado), no la palabra: si no, el
    // zoom saca media linea del cuadro.
    const k = { x: center(phone).x, y: center(keyNode).y };
    const a = easeIO((t - Z.inAt) / Z.inDur);
    const b = easeIO((t - Z.panAt) / Z.panDur);
    let p = k, z = 1 + (Z.z1 - 1) * a;
    if (t >= Z.panAt) {
      const pc = center(panel);
      const mid = { x: k.x, y: (k.y + pc.y) / 2 };
      p = { x: k.x + (mid.x - k.x) * b, y: k.y + (mid.y - k.y) * b };
      z = Z.z1 + (Z.z2 - Z.z1) * b;
    }
    // El punto viaja desde donde esta hasta TARGET a la vez que crece.
    const ty = p.y + (TARGET.y - p.y) * a;
    const tx = p.x + (TARGET.x - p.x) * a;
    const trX = tx - O.left - (p.x - O.left) * z;
    const trY = ty - O.top - (p.y - O.top) * z;
    wrap.style.transform = "translate(" + trX + "px," + trY + "px) scale(" + z + ")";
  }

  /* Pantalla final: la marca, lo que hace la app y que hacer para tenerla. */
  const end = document.createElement("div");
  end.className = "soEnd";
  end.innerHTML =
    '<img class="soLogo" src="../../public/digital-polyglot-logo-light.png" alt="">' +
    '<h2 class="soEndHead">Hear it in a story.<br><span>Then make it stick.</span></h2>' +
    '<div class="soBtn">Apply for early access</div>' +
    '<div class="soUrl">digitalpolyglot.com/beta</div>' +
    '<div class="soPlat">iPhone &amp; Android</div>';
  if (C.end) root.appendChild(end);
  function endCard(t) {
    if (!C.end) return;
    const u = t - C.end.at;
    end.style.display = u >= 0 ? "" : "none";
    if (u < 0) return;
    const parts = end.children;
    for (let i = 0; i < parts.length; i++) {
      const g = ease((u - i * 0.06) / 0.25);
      parts[i].style.opacity = String(g);
      parts[i].style.transform = "translateY(" + (1 - g) * 14 + "px)";
    }
    // El boton late una vez, cuando ya esta todo puesto.
    const b = u - 0.7;
    if (b > 0 && b < 0.4) parts[2].style.transform = "scale(" + (1 + 0.05 * Math.sin(Math.PI * b / 0.4)) + ")";
  }

  function stick(alpha, scale) {
    sticker.style.opacity = String(alpha);
    sticker.style.transform = "translateX(-50%) rotate(-4deg) scale(" + scale + ")";
  }

  function seek(t) {
    const tail = !C.end && t >= LOOP_AT ? ease((t - LOOP_AT) / C.loopDur) : 0;
    endCard(t);
    if (tail > 0) seek0(0); // deja el lector en su fotograma 0 para el bucle
    seek0(orig(t));

    head.style.opacity = "1";
    head.style.transform = "none";
    zoom(t);

    // Titular: cambia de golpe con el corte, y vuelve en el bucle.
    const second = t >= SW && tail < 0.5 ? 1 : 0;
    // Con el zoom el telefono sube hasta el titular y lo tapa: se retira
    // mientras dura, y el subtitulo lleva la frase.
    const zoomed = t >= C.zoom.inAt && t < SW ? ease((t - C.zoom.inAt) / 0.25) : 0;
    hookA.style.opacity = String((1 - second) * (1 - zoomed));
    hookA.style.transform = "none";
    hookB.style.opacity = String(second);
    hookB.style.transform = "none";

    // Pegatina del gancho: puesta desde el fotograma 0 con un golpe de escala.
    const out = C.sticker.out;
    if (t < out + 0.25) {
      const pop = 1.06 - 0.06 * ease(t / 0.22);
      const g = ease((t - out) / 0.25);
      stick(1 - g, pop - 0.35 * g);
    } else if (tail > 0) {
      const g = ease((tail - 0.5) / 0.5);
      stick(g, 1.06 + 0.3 * (1 - g));
    } else {
      stick(0, 1);
    }

    // Subtitulo: toda la frase del lector; se va con el corte.
    if (t < SW) caption(t, 1);
    else if (tail > 0) caption(0, ease((tail - 0.5) / 0.5));
    else caption(0, 0);

    // Bucle: Practice sale por la izquierda y el lector entra por la derecha.
    if (tail > 0) {
      document.getElementById("comboA").style.transform = "translateX(" + (1 - tail) * 105 + "%)";
      document.getElementById("comboB").style.transform = "translateX(" + -tail * 105 + "%)";
    }

    // Acierto: destello dorado detras de la opcion y un golpe del telefono.
    const u = t - C.hit;
    if (u >= 0 && u < 0.45 && tail === 0) {
      const opt = document.querySelector("#p4g0 .p4Opt.p4OptOk");
      const c = opt ? center(opt) : center(phone);
      const f = u / 0.45;
      flash.style.opacity = String(1 - f);
      flash.style.width = flash.style.height = 180 + 240 * ease(f) + "px";
      flash.style.left = c.x - (90 + 120 * ease(f)) + "px";
      flash.style.top = c.y - (90 + 120 * ease(f)) + "px";
      const bump = 1 + 0.035 * Math.sin(Math.PI * Math.min(1, u / 0.3));
      wrap.style.transformOrigin = "50% 60%";
      wrap.style.transform = "scale(" + bump + ")";
    } else {
      flash.style.opacity = "0";
    }
  }

  window.__ad = Object.assign({}, base, {
    seek: seek,
    sfx: [{ file: "practice-combo.mp3", at: C.hit }],
  });
  seek(0);
})();
