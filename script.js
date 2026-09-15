(function () {
  var wmV = document.getElementById('wm-v');
  var wmH = document.getElementById('wm-h');
  var wmVLabel = document.getElementById('wm-v-label');
  var wmHLabel = document.getElementById('wm-h-label');
  var photosInput = document.getElementById('photos');
  var folderInput = document.getElementById('folder');
  var listEl = document.getElementById('list');
  var statusEl = document.getElementById('status');
  var sizeEl = document.getElementById('size');
  var sizeValEl = document.getElementById('size-val');
  var opacityEl = document.getElementById('opacity');
  var opacityValEl = document.getElementById('opacity-val');
  var posBtns = document.getElementById('pos-btns');
  var downloadAllBtn = document.getElementById('download-all');
  var resetBtn = document.getElementById('reset');

  var wmVertical = null;
  var wmHorizontal = null;
  var items = [];
  var position = 'center';

  var isMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    var folderLabel = document.getElementById('folder-label');
    if (folderLabel) folderLabel.style.display = 'none';
  }

  function esc(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadWatermark(file, isVertical) {
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      if (isVertical) {
        wmVertical = img;
        wmVLabel.classList.add('has-file');
        wmVLabel.querySelector('img').src = url;
      } else {
        wmHorizontal = img;
        wmHLabel.classList.add('has-file');
        wmHLabel.querySelector('img').src = url;
      }
      renderAll();
    };
    img.src = url;
  }

  wmV.addEventListener('change', function (e) {
    loadWatermark(e.target.files[0], true);
  });
  wmH.addEventListener('change', function (e) {
    loadWatermark(e.target.files[0], false);
  });

  function addFiles(fileList) {
    var files = Array.prototype.filter.call(fileList, function (f) {
      return f.type.indexOf('image/') === 0;
    });
    files.forEach(function (file) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      var item = { file: file, img: img, url: url, orientation: null };
      items.push(item);
      img.onload = function () {
        item.orientation = img.naturalWidth >= img.naturalHeight ? 'h' : 'v';
        renderAll();
      };
      img.onerror = function () {
        var i = items.indexOf(item);
        if (i !== -1) items.splice(i, 1);
        renderAll();
      };
      img.src = url;
    });
  }

  photosInput.addEventListener('change', function (e) {
    addFiles(e.target.files);
    e.target.value = '';
  });
  folderInput.addEventListener('change', function (e) {
    addFiles(e.target.files);
    e.target.value = '';
  });

  sizeEl.addEventListener('input', function () {
    sizeValEl.textContent = sizeEl.value + '%';
    renderAll();
  });
  opacityEl.addEventListener('input', function () {
    opacityValEl.textContent = opacityEl.value + '%';
    renderAll();
  });

  posBtns.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-pos]');
    if (!btn) return;
    position = btn.getAttribute('data-pos');
    Array.prototype.forEach.call(posBtns.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', b === btn);
    });
    renderAll();
  });

  function buildCanvas(item, forPreview) {
    var img = item.img;
    var scale = forPreview
      ? Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight))
      : 1;
    var w = Math.round(img.naturalWidth * scale);
    var h = Math.round(img.naturalHeight * scale);
    var cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var wm = item.orientation === 'v' ? wmVertical : wmHorizontal;
    if (wm) {
      var pct = sizeEl.value / 100;
      var wmW = w * pct;
      var wmH = wmW * (wm.naturalHeight / wm.naturalWidth);
      var margin = w * 0.04;
      var x = 0;
      var y = 0;
      switch (position) {
        case 'topleft': x = margin; y = margin; break;
        case 'top': x = (w - wmW) / 2; y = margin; break;
        case 'topright': x = w - wmW - margin; y = margin; break;
        case 'left': x = margin; y = (h - wmH) / 2; break;
        case 'right': x = w - wmW - margin; y = (h - wmH) / 2; break;
        case 'bottomleft': x = margin; y = h - wmH - margin; break;
        case 'bottom': x = (w - wmW) / 2; y = h - wmH - margin; break;
        case 'bottomright': x = w - wmW - margin; y = h - wmH - margin; break;
        default: x = (w - wmW) / 2; y = (h - wmH) / 2;
      }
      ctx.globalAlpha = opacityEl.value / 100;
      ctx.drawImage(wm, x, y, wmW, wmH);
      ctx.globalAlpha = 1;
    }
    return cv;
  }

  function renderAll() {
    listEl.innerHTML = '';
    items.forEach(function (item) {
      var el = document.createElement('article');
      el.className = 'item';

      var thumb = document.createElement('canvas');
      thumb.className = 'thumb';
      var cv = buildCanvas(item, true);
      thumb.width = 200;
      thumb.height = 200;
      var tctx = thumb.getContext('2d');
      var tw = cv.width;
      var th = cv.height;
      var scale = Math.min(200 / tw, 200 / th);
      var dw = tw * scale;
      var dh = th * scale;
      tctx.fillStyle = '#fff';
      tctx.fillRect(0, 0, 200, 200);
      tctx.drawImage(cv, (200 - dw) / 2, (200 - dh) / 2, dw, dh);
      el.appendChild(thumb);

      var meta = document.createElement('div');
      meta.className = 'meta';
      var orientation = item.orientation === 'v' ? 'Verticaal' : 'Horizontaal';
      var badge = item.orientation === 'v' ? 'v' : 'h';
      meta.innerHTML =
        '<strong>' + esc(item.file.name) + '</strong>' +
        '<span class="badge ' + badge + '">' + orientation + '</span>';
      el.appendChild(meta);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost';
      btn.textContent = 'Downloaden';
      btn.addEventListener('click', function () { downloadOne(item); });
      el.appendChild(btn);

      listEl.appendChild(el);
    });
    statusEl.textContent = items.length + (items.length === 1 ? ' foto geselecteerd' : ' foto\'s geselecteerd');
    var ready =
      items.length > 0 &&
      wmVertical && wmHorizontal &&
      items.every(function (i) { return i.orientation; });
    downloadAllBtn.disabled = !ready;
  }

  function fileName(item) {
    return 'watermarked_' + item.file.name.replace(/\.[^.]+$/, '') + '.png';
  }

  function triggerDownload(url, name) {
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function canvasToBlob(cv) {
    return new Promise(function (resolve) {
      cv.toBlob(function (blob) { resolve(blob); }, 'image/png');
    });
  }

  function downloadOne(item) {
    var cv = buildCanvas(item, false);
    canvasToBlob(cv).then(function (blob) {
      triggerDownload(URL.createObjectURL(blob), fileName(item));
    });
  }

  downloadAllBtn.addEventListener('click', function () {
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = 'Bezig met verwerken...';
    var zip = new JSZip();
    var queue = items.map(function (item) {
      return canvasToBlob(buildCanvas(item, false)).then(function (blob) {
        zip.file(fileName(item), blob);
      });
    });
    Promise.all(queue)
      .then(function () { return zip.generateAsync({ type: 'blob' }); })
      .then(function (blob) {
        triggerDownload(URL.createObjectURL(blob), 'watermarked-photos.zip');
        downloadAllBtn.disabled = false;
        downloadAllBtn.textContent = 'Alles downloaden (.zip)';
      });
  });

  resetBtn.addEventListener('click', function () {
    items.forEach(function (item) { URL.revokeObjectURL(item.url); });
    items = [];
    wmVertical = null;
    wmHorizontal = null;
    wmVLabel.classList.remove('has-file');
    wmHLabel.classList.remove('has-file');
    wmVLabel.querySelector('img').removeAttribute('src');
    wmHLabel.querySelector('img').removeAttribute('src');
    wmV.value = '';
    wmH.value = '';
    renderAll();
  });
})();