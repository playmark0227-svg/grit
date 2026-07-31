// ============================================================
// GRIT モーション (motion.js)
// スクロールに合わせた出現アニメーションと、ヒーローの視差。
// common.js から読み込まれるので、各ページで個別に読む必要はない。
//
// 方針: 派手に動かさない。ゆっくり、少しだけ。
// OSで「視差効果を減らす」を有効にしている人には一切動かさない。
// ============================================================

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- スクロールで現れる ----------
   [data-reveal] を付けた要素が画面に入ったら .is-in が付く。
   [data-reveal="stagger"] は子要素を少しずつ遅らせて出す。 */

function setupReveal() {
  const targets = document.querySelectorAll("[data-reveal]:not(.is-in)");
  if (!targets.length) return;

  if (REDUCED || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const show = (el, stagger) => {
    if (stagger) {
      Array.from(el.children).forEach((child, i) => {
        child.style.transitionDelay = `${Math.min(i * 90, 540)}ms`;
      });
    }
    el.classList.add("is-in");
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        show(e.target, e.target.dataset.reveal === "stagger");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );
  targets.forEach((el) => io.observe(el));

  // 保険: 監視が働かない状況(iframe内、極端に短いページ、古い環境など)でも
  // 本文が消えたままにならないよう、一定時間後に必ず表示する。
  // 中身が読めないことの方が、アニメーションが出ないことより問題なので。
  setTimeout(() => {
    document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => {
      show(el, el.dataset.reveal === "stagger");
      io.unobserve(el);
    });
  }, 2500);
}

/* ---------- ヒーロー写真の視差 ----------
   スクロール量の 1/6 だけ背景をずらす。数値を上げると酔うので上げない。 */

function setupParallax() {
  if (REDUCED) return;
  const layers = document.querySelectorAll("[data-parallax]");
  if (!layers.length) return;

  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    layers.forEach((el) => {
      const rate = Number(el.dataset.parallax) || 0.16;
      el.style.setProperty("--parallax", `${Math.round(y * rate)}px`);
    });
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

/* ---------- 画像が読めたらふわっと出す ----------
   遅れて届いた写真がガタッと出るのを防ぐ。 */

function setupImageFade() {
  document.querySelectorAll("img").forEach((img) => {
    if (img.dataset.noFade !== undefined) return;
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add("img-ready");
    } else {
      img.addEventListener("load", () => img.classList.add("img-ready"), { once: true });
      img.addEventListener("error", () => img.classList.add("img-ready"), { once: true });
    }
  });
}

/** 動的に描画した後に呼ぶと、増えた要素にも効く */
export function refreshMotion() {
  setupReveal();
  setupImageFade();
}

function init() {
  setupReveal();
  setupParallax();
  setupImageFade();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// 一覧の描画は非同期なので、描き終わりを待って拾い直す
window.addEventListener("grit:rendered", refreshMotion);
