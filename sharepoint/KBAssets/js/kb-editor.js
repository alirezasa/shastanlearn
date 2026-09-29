/* =====================================================================
   پایگاه دانش شستان — ویرایشگر متن غنی (بدون وابستگی)
   خروجی HTML ساده و تمیز است. ویدیو و صوت به‌صورت پیوند داخل
   <p class="kb-embed"> ذخیره می‌شوند (فیلد Rich Text شیرپوینت تگ video را
   حذف می‌کند) و هنگام نمایش به پخش‌کننده تبدیل می‌شوند.
   ===================================================================== */
(function (window, document) {
  'use strict';
  var KB = window.KB;
  var U = KB.util, ui = KB.ui, html = U.html, icon = U.icon;

  var BLOCKS = [['p', 'پاراگراف'], ['h2', 'تیتر اصلی'], ['h3', 'تیتر فرعی'], ['h4', 'تیتر کوچک'], ['blockquote', 'نقل قول / نکته'], ['pre', 'کد']];
  var TOOLS = [
    ['bold', 'bold', 'پررنگ (Ctrl+B)'], ['italic', 'italic', 'مایل (Ctrl+I)'], ['underline', 'underline', 'زیرخط (Ctrl+U)'], ['strikeThrough', 'strike', 'خط‌خورده'], '|',
    ['insertUnorderedList', 'ul', 'فهرست نقطه‌ای'], ['insertOrderedList', 'ol', 'فهرست شماره‌دار'], '|',
    ['justifyRight', 'align-right', 'راست‌چین'], ['justifyCenter', 'align-center', 'وسط‌چین'], ['justifyLeft', 'align-left', 'چپ‌چین'], ['justifyFull', 'align-justify', 'تراز'], '|',
    ['link', 'link', 'درج پیوند (Ctrl+K)'], ['unlink', 'unlink', 'حذف پیوند'], ['image', 'image', 'درج تصویر'], ['media', 'video', 'درج ویدیو یا صوت'], ['file', 'paperclip', 'پیوند به فایل'],
    ['table', 'table', 'درج جدول'], ['insertHorizontalRule', 'minus', 'خط جداکننده'], '|',
    ['removeFormat', 'eraser', 'پاک کردن قالب‌بندی'], ['undo', 'undo', 'واگرد (Ctrl+Z)'], ['redo', 'redo', 'انجام دوباره'], '|',
    ['source', 'code', 'ویرایش HTML'], ['full', 'maximize', 'تمام‌صفحه']
  ];
  var STATE_CMDS = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyRight', 'justifyCenter', 'justifyLeft', 'justifyFull'];

  /** تمیز کردن HTML (خروجی و متن چسبانده‌شده) */
  function cleanHtml(input, fromPaste) {
    var safe = U.sanitizeHtml(input);
    var box = document.createElement('div');
    box.innerHTML = safe;
    U.$$('*', box).forEach(function (el) {
      el.classList.remove('is-selected');
      if (fromPaste) {
        var align = el.style && el.style.textAlign;
        el.removeAttribute('style');
        if (align && /^(center|left|right|justify)$/.test(align)) el.style.textAlign = align;
        if (el.tagName !== 'P' || !el.classList.contains('kb-embed')) el.removeAttribute('class');
        if (/^(SPAN|FONT)$/.test(el.tagName) && !el.attributes.length) { while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.remove(); }
      }
      if (el.tagName === 'DIV' && !el.attributes.length && el.parentNode === box) {
        var p = document.createElement('p');
        while (el.firstChild) p.appendChild(el.firstChild);
        el.replaceWith(p);
      }
    });
    // حذف پاراگراف‌های خالی انتهای متن
    while (box.lastChild && ((box.lastChild.nodeType === 3 && !box.lastChild.textContent.trim()) || (box.lastChild.nodeType === 1 && /^(P|DIV)$/.test(box.lastChild.tagName) && !box.lastChild.textContent.trim() && !box.lastChild.querySelector('img,video,audio,iframe,hr')))) box.lastChild.remove();
    return box.innerHTML.replace(/<p><br><\/p>$/, '');
  }

  function create(host, opts) {
    opts = opts || {};
    U.mount(host, html`<div class="kb-rte">
      <div class="kb-rte-bar" role="toolbar" aria-label="ابزار ویرایش">
        <select data-block aria-label="نوع بلوک">${BLOCKS.map(function (b) { return html`<option value="${b[0]}">${b[1]}</option>`; })}</select>
        <span class="kb-rte-sep"></span>
        ${TOOLS.map(function (t) { return t === '|' ? html`<span class="kb-rte-sep"></span>` : html`<button type="button" data-cmd="${t[0]}" title="${t[2]}" aria-label="${t[2]}">${icon(t[1])}</button>`; })}
      </div>
      <div class="kb-rte-area kb-prose" contenteditable="true" role="textbox" aria-multiline="true" aria-label="متن محتوا" data-placeholder="${opts.placeholder || 'متن محتوا را اینجا بنویسید… (می‌توانید از Word هم متن را بچسبانید)'}"></div>
      <textarea class="kb-rte-source" hidden aria-label="HTML"></textarea>
      <div class="kb-rte-foot"><span data-words></span><span data-mode>حالت نمایش</span></div>
    </div>`);
    var root = host.firstChild;
    var area = U.$('.kb-rte-area', root), src = U.$('.kb-rte-source', root), bar = U.$('.kb-rte-bar', root);
    var block = U.$('[data-block]', root);
    var savedRange = null, sourceMode = false;
    area.innerHTML = cleanHtml(opts.value || '');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch (e) { /* */ }

    function changed() { counts(); if (opts.onChange) opts.onChange(); }
    function counts() {
      var text = U.stripHtml(sourceMode ? src.value : area.innerHTML);
      var words = text ? text.split(' ').filter(Boolean).length : 0;
      U.$('[data-words]', root).textContent = U.faNum(words) + ' واژه — حدود ' + U.faNum(Math.max(1, Math.round(words / 200))) + ' دقیقه مطالعه';
    }
    function saveRange() {
      var sel = window.getSelection();
      if (sel.rangeCount && area.contains(sel.getRangeAt(0).commonAncestorContainer)) savedRange = sel.getRangeAt(0).cloneRange();
    }
    function restoreRange() {
      area.focus();
      if (!savedRange) { var r = document.createRange(); r.selectNodeContents(area); r.collapse(false); savedRange = r; }
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange);
    }
    function exec(cmd, val) { restoreRange(); document.execCommand(cmd, false, val == null ? null : val); saveRange(); changed(); refresh(); }
    function insertHTML(h) {
      restoreRange();
      document.execCommand('insertHTML', false, String(h));
      saveRange(); changed();
    }
    function refresh() {
      STATE_CMDS.forEach(function (c) {
        var b = bar.querySelector('[data-cmd="' + c + '"]');
        var on = false;
        try { on = document.queryCommandState(c); } catch (e) { /* */ }
        if (b) b.classList.toggle('is-on', on);
      });
      var node = window.getSelection().anchorNode;
      var el = node && (node.nodeType === 1 ? node : node.parentNode);
      var tag = 'p';
      while (el && el !== area) { var t = el.tagName.toLowerCase(); if (/^(h2|h3|h4|blockquote|pre|p)$/.test(t)) { tag = t; break; } el = el.parentNode; }
      block.value = tag;
    }
    function selectedText() { return savedRange ? savedRange.toString() : ''; }

    area.addEventListener('input', changed);
    area.addEventListener('keyup', function () { saveRange(); refresh(); });
    area.addEventListener('mouseup', function () { saveRange(); refresh(); });
    area.addEventListener('blur', saveRange);
    area.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); saveRange(); tool('link'); }
    });
    area.addEventListener('paste', function (e) {
      var cd = e.clipboardData;
      if (!cd) return;
      if (cd.files && cd.files.length && opts.onPasteFiles) { e.preventDefault(); saveRange(); opts.onPasteFiles(Array.prototype.slice.call(cd.files)); return; }
      var h = cd.getData('text/html'), t = cd.getData('text/plain');
      e.preventDefault();
      saveRange();
      if (h) insertHTML(cleanHtml(h.replace(/<!--[\s\S]*?-->/g, ''), true));
      else if (t) insertHTML(t.split(/\n{2,}/).map(function (p) { return '<p>' + U.esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''));
    });
    area.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length && opts.onPasteFiles) {
        e.preventDefault();
        opts.onPasteFiles(Array.prototype.slice.call(e.dataTransfer.files));
      }
    });
    // انتخاب تصویر و ویرایش مشخصات آن با دوبار کلیک
    area.addEventListener('click', function (e) {
      U.$$('img.is-selected', area).forEach(function (x) { x.classList.remove('is-selected'); });
      if (e.target.tagName === 'IMG') e.target.classList.add('is-selected');
    });
    area.addEventListener('dblclick', function (e) { if (e.target.tagName === 'IMG') imageProps(e.target); });
    block.addEventListener('change', function () { exec('formatBlock', '<' + block.value + '>'); });
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    U.on(bar, 'click', '[data-cmd]', function (e, b) { tool(b.getAttribute('data-cmd')); });

    function imageProps(img) {
      var fig = img.closest('figure');
      var cap = fig && fig.querySelector('figcaption');
      var m = ui.modal({
        title: 'مشخصات تصویر', icon: 'image',
        body: html`<div class="kb-field"><label class="kb-label" for="kb-img-alt">متن جایگزین (برای دسترس‌پذیری)</label><input id="kb-img-alt" class="kb-input" value="${img.getAttribute('alt') || ''}"></div>
          <div class="kb-field"><label class="kb-label" for="kb-img-cap">زیرنویس</label><input id="kb-img-cap" class="kb-input" value="${cap ? cap.textContent : ''}"></div>
          <div class="kb-field"><span class="kb-label">اندازه</span><div class="kb-segment" data-w>${[['', 'کامل'], ['75%', '۷۵٪'], ['50%', '۵۰٪'], ['33%', '۳۳٪']].map(function (w) { return html`<button type="button" data-v="${w[0]}" aria-pressed="${(img.style.width || '') === w[0]}">${w[1]}</button>`; })}</div></div>`,
        foot: html`<button type="button" class="kb-btn kb-btn-brand" data-ok>اعمال</button><button type="button" class="kb-btn kb-btn-danger" data-remove>${icon('trash')}حذف تصویر</button><button type="button" class="kb-btn kb-btn-ghost" data-kb-close>انصراف</button>`
      });
      var width = img.style.width || '';
      U.on(m.el, 'click', '[data-w] button', function (ev, b) { width = b.getAttribute('data-v'); U.$$('[data-w] button', m.el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); });
      m.el.querySelector('[data-remove]').addEventListener('click', function () { (fig || img).remove(); changed(); m.close(); });
      m.el.querySelector('[data-ok]').addEventListener('click', function () {
        img.setAttribute('alt', U.$('#kb-img-alt', m.el).value.trim());
        img.style.width = width; if (!width) img.removeAttribute('style');
        var c = U.$('#kb-img-cap', m.el).value.trim();
        if (c) {
          if (!fig) { fig = document.createElement('figure'); img.replaceWith(fig); fig.appendChild(img); }
          if (!cap) { cap = document.createElement('figcaption'); fig.appendChild(cap); }
          cap.textContent = c;
        } else if (cap) cap.remove();
        changed(); m.close();
      });
    }

    function toggleSource() {
      sourceMode = !sourceMode;
      if (sourceMode) { src.value = cleanHtml(area.innerHTML).replace(/(<\/(p|h2|h3|h4|blockquote|pre|ul|ol|table|figure)>)/g, '$1\n'); }
      else { area.innerHTML = cleanHtml(src.value); }
      area.hidden = sourceMode; src.hidden = !sourceMode;
      U.$$('button[data-cmd], select', bar).forEach(function (b) { var c = b.getAttribute('data-cmd'); if (c !== 'source' && c !== 'full') b.disabled = sourceMode; });
      bar.querySelector('[data-cmd="source"]').classList.toggle('is-on', sourceMode);
      U.$('[data-mode]', root).textContent = sourceMode ? 'حالت HTML' : 'حالت نمایش';
      (sourceMode ? src : area).focus();
    }
    src.addEventListener('input', changed);

    function tool(cmd) {
      if (cmd === 'source') return toggleSource();
      if (cmd === 'full') {
        root.classList.toggle('is-full');
        document.documentElement.style.overflow = root.classList.contains('is-full') ? 'hidden' : '';
        bar.querySelector('[data-cmd="full"]').classList.toggle('is-on', root.classList.contains('is-full'));
        return;
      }
      if (cmd === 'link') {
        var node = savedRange && savedRange.startContainer;
        var a = node && (node.nodeType === 1 ? node : node.parentNode).closest && (node.nodeType === 1 ? node : node.parentNode).closest('a');
        ui.prompt('درج پیوند', 'نشانی (URL) — برای صفحات داخلی نشانی نسبی هم مجاز است', a ? a.getAttribute('href') : 'http://').then(function (url) {
          if (!url) return;
          url = U.safeUrl(url);
          if (!url) return;
          if (!selectedText() && !a) insertHTML('<a href="' + U.esc(url) + '">' + U.esc(url) + '</a>');
          else exec('createLink', url);
        });
        return;
      }
      if (cmd === 'image' || cmd === 'media' || cmd === 'file') {
        if (!opts.pickMedia) return;
        var kind = cmd === 'image' ? 'image' : cmd === 'media' ? 'media' : 'any';
        opts.pickMedia(kind).then(function (f) { if (f) insertFile(f, kind); });
        return;
      }
      if (cmd === 'table') {
        ui.prompt('درج جدول', 'تعداد ستون × ردیف (مثلاً 3×4)', '3×4').then(function (v) {
          if (!v) return;
          var m = U.normalizeFa(v).match(/(\d+)\s*[x×*]\s*(\d+)/i);
          var cols = Math.min(10, m ? Number(m[1]) : 3), rows = Math.min(50, m ? Number(m[2]) : 4);
          var t = '<table><thead><tr>';
          for (var c = 0; c < cols; c++) t += '<th>عنوان ' + U.faNum(c + 1) + '</th>';
          t += '</tr></thead><tbody>';
          for (var r = 0; r < rows - 1; r++) { t += '<tr>'; for (c = 0; c < cols; c++) t += '<td>&nbsp;</td>'; t += '</tr>'; }
          insertHTML(t + '</tbody></table><p><br></p>');
        });
        return;
      }
      exec(cmd);
    }

    /** درج فایل انتخاب‌شده از کتابخانه/پیوست: {url, name} */
    function insertFile(f, kind) {
      var k = U.isMediaUrl(f.name || f.url);
      var name = f.title || (f.name || '').replace(/\.[^.]+$/, '');
      if (k === 'image' && kind !== 'any') insertHTML('<p><img src="' + U.esc(f.url) + '" alt="' + U.esc(name) + '"></p><p><br></p>');
      else if ((k === 'video' || k === 'audio') && kind !== 'any') insertHTML('<p class="kb-embed"><a href="' + U.esc(f.url) + '" data-type="' + k + '">' + U.esc(name || (k === 'video' ? 'ویدیو' : 'فایل صوتی')) + '</a></p><p><br></p>');
      else insertHTML('<a href="' + U.esc(f.url) + '">' + U.esc(f.name || name) + '</a>&nbsp;');
    }

    counts();
    return {
      el: root,
      getHTML: function () { return cleanHtml(sourceMode ? src.value : area.innerHTML); },
      setHTML: function (h) { area.innerHTML = cleanHtml(h); if (sourceMode) src.value = area.innerHTML; counts(); },
      insertFile: insertFile,
      insertHTML: insertHTML,
      replaceUrl: function (from, to) {
        var h = this.getHTML().split(from).join(to);
        this.setHTML(h);
      },
      focus: function () { area.focus(); }
    };
  }

  KB.editor = { create: create, clean: cleanHtml };
})(window, document);
