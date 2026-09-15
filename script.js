(function () {
  var wmV = document.getElementById('wm-v');
  var wmH = document.getElementById('wm-h');
  var wmVLabel = document.getElementById('wm-v-label');
  var wmHLabel = document.getElementById('wm-h-label');
  var wmVChange = document.getElementById('wm-v-change');
  var wmHChange = document.getElementById('wm-h-change');
  var wmVSaved = document.getElementById('wm-v-saved');
  var wmHSaved = document.getElementById('wm-h-saved');
  var photosInput = document.getElementById('photos');
  var folderInput = document.getElementById('folder');
  var photosDrop = document.getElementById('photo-drop');
  var listEl = document.getElementById('list');
  var statusEl = document.getElementById('status');
  var downloadAllBtn = document.getElementById('download-all');
  var resetBtn = document.getElementById('reset');

  var wmVertical = null;
  var wmHorizontal = null;
  var items = [];

  var isMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    var folderLabel = document.getElementById('folder-label');
    if (folderLabel) folderLabel.style.display = 'none';
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function esc(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('watermark-tool', 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains('watermarks')) {
          req.result.createObjectStore('watermarks');
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function saveWM(file, key) {
    openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('watermarks', 'readwrite');
        tx.objectStore('watermarks').put(file, key);
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    }).catch(function () {});
  }

  function loadSavedWM() {
    openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('watermarks', 'readonly');
        var rv = tx.objectStore('watermarks').get('v');
        var rh = tx.objectStore('watermarks').get('h');
        tx.oncomplete = function () { db.close(); resolve({ v: rv.result, h: rh.result }); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    }).then(function (saved) {
      if (saved.v) attachWatermark(saved.v, true);
      if (saved.h) attachWatermark(saved.h, false);
    }).catch(function () {});
  }

  function attachWatermark(source, isVertical) {
    var url = URL.createObjectURL(source);
    var img = new Image();
    img.onload = function () {
      if (isVertical) {
        wmVertical = img;
      } else {
        wmHorizontal = img;
      }
      var label = isVertical ? wmVLabel : wmHLabel;
      var savedEl = isVertical ? wmVSaved : wmHSaved;
      label.classList.add('has-file');
      label.querySelector('img').src = url;
      if (savedEl) savedEl.hidden = false;
      renderAll();
    };
    img.src = url;
  }

  function bindWatermarkInput(input, isVertical) {
    input.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (f) {
        attachWatermark(f, isVertical);
        saveWM(f, isVertical ? 'v' : 'h');
      }
      input.value = '';
    });
  }

  bindWatermarkInput(wmV, true);
  bindWatermarkInput(wmH, false);
  wmVChange.addEventListener('click', function () { wmV.click(); });
  wmHChange.addEventListener('click', function () { wmH.click(); });

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) {
      setStatus('Geen bestanden geselecteerd.');
      return;
    }
    var failed = 0;
    files.forEach(function (file) {
      var url;
      try {
        url = URL.createObjectURL(file);
        var img = new Image();
        var item = { file: file, img: img, url: url, orientation: null };
        items.push(item);
        img.onload = function () {
          try {
            item.orientation = img.naturalWidth >= img.naturalHeight ? 'h' : 'v';
            renderAll();
          } catch (err) {
            setStatus('Fout bij verwerken: ' + err.message);
          }
        };
        img.onerror = function () {
          failed++;
          var i = items.indexOf(item);
          if (i !== -1) items.splice(i, 1);
          renderAll();
          setStatus(
            '1 of meer bestanden konden niet als afbeelding worden gelezen. ' +
            'iPhone-HEIC werkt niet op de pc (zet om naar JPG/PNG); andere bestanden kunnen beschadigd zijn.'
          );
        };
        img.src = url;
      } catch (err) {
        setStatus('Fout bij openen: ' + err.message);
      }
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
  if (photosDrop) {
    photosDrop.addEventListener('dragover', function (e) { e.preventDefault(); });
    photosDrop.addEventListener('drop', function (e) {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    });
  }

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
      ctx.drawImage(wm, 0, 0, w, h);
    }
    return cv;
  }

  function renderAll() {
    try {
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
      setStatus(items.length + (items.length === 1 ? ' foto geselecteerd' : ' foto\'s geselecteerd'));
      var ready =
        items.length > 0 &&
        wmVertical && wmHorizontal &&
        items.every(function (i) { return i.orientation; });
      downloadAllBtn.disabled = !ready;
    } catch (err) {
      setStatus('Fout bij weergave: ' + err.message);
    }
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
    try {
      var cv = buildCanvas(item, false);
      canvasToBlob(cv).then(function (blob) {
        triggerDownload(URL.createObjectURL(blob), fileName(item));
      });
    } catch (err) {
      setStatus('Fout bij downloaden: ' + err.message);
    }
  }

  downloadAllBtn.addEventListener('click', function () {
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = 'Bezig met verwerken...';
    var zip = new JSZip();
    var queue;
    try {
      queue = items.map(function (item) {
        return canvasToBlob(buildCanvas(item, false)).then(function (blob) {
          zip.file(fileName(item), blob);
        });
      });
    } catch (err) {
      setStatus('Fout bij verwerken: ' + err.message);
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = 'Alles downloaden (.zip)';
      return;
    }
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
    renderAll();
  });

  loadSavedWM();
})();