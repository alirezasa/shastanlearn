document.addEventListener('DOMContentLoaded', () => {

  /* ---------- اسلایدر (فقط اگر در صفحه وجود داشت) ---------- */
  const slidesEl = document.getElementById('slides');
  if (slidesEl) {
    const slides = slidesEl.children;
    const total = slides.length;
    const dotsWrap = document.getElementById('dots');
    const sliderEl = document.getElementById('slider');
    let index = 0;
    let timer = null;

    // ساخت نقطه‌ها
    for (let i = 0; i < total; i++) {
      const d = document.createElement('span');
      d.className = 'dot' + (i === 0 ? ' active' : '');
      d.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(d);
    }
    const dots = dotsWrap.children;

    function render() {
      slidesEl.style.transform = `translateX(${index * 100}%)`;
      for (let i = 0; i < dots.length; i++)
        dots[i].classList.toggle('active', i === index);
    }
    function goTo(i) { index = (i + total) % total; render(); }
    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    document.getElementById('nextBtn')?.addEventListener('click', next);
    document.getElementById('prevBtn')?.addEventListener('click', prev);

    function start() { timer = setInterval(next, 5000); }
    function stop() { clearInterval(timer); }
    start();

    // توقف هنگام هاور
    sliderEl?.addEventListener('mouseenter', stop);
    sliderEl?.addEventListener('mouseleave', start);
  }

  /* ---------- پنل اعلان ---------- */
  const notifBtn = document.getElementById('notifBtn');
  const notifPanel = document.getElementById('notifPanel');
  if (notifBtn && notifPanel) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifPanel.classList.toggle('open');
    });
    // بستن با کلیک بیرون
    document.addEventListener('click', (e) => {
      if (!notifPanel.contains(e.target) && e.target !== notifBtn)
        notifPanel.classList.remove('open');
    });
  }

  /* ---------- جستجوی زنده ---------- */
  const searchInput = document.getElementById('searchInput');
  const grid = document.getElementById('postGrid');
  if (searchInput && grid) {
    const cards = grid.querySelectorAll('.post-card');
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      cards.forEach(card => {
        const title = (card.dataset.title || '').toLowerCase();
        const text = card.textContent.toLowerCase();
        const match = title.includes(q) || text.includes(q);
        card.style.display = match ? '' : 'none';
      });
    });
  }

  /* ---------- کپی لینک صفحه (صفحه داخلی) ---------- */
  const copyBtn = document.getElementById('copyLink');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        const old = copyBtn.textContent;
        copyBtn.textContent = '✔ کپی شد';
        setTimeout(() => copyBtn.textContent = old, 1500);
      } catch {
        alert('امکان کپی وجود ندارد');
      }
    });
  }

});
