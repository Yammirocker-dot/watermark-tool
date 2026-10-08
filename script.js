(function () {
  function startApp() {
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
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[c];
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

        req.onsuccess = function () {
          resolve(req.result);
        };

        req.onerror = function () {
          reject(req.error);
        };
      });
    }

    var DEFAULT_WM = {
      v: 'wm-v.png',
      h: 'wm-h.png'
    };

    function saveWM(blob, key) {
      blob.arrayBuffer()
        .then(function (buf) {
          return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
              var tx = db.transaction('watermarks', 'readwrite');

              tx.objectStore('watermarks').put(buf, key);

              tx.oncomplete = function () {
                db.close();
                resolve();
              };

              tx.onerror = function () {
                db.close();
                reject(tx.error);
              };
            });
          });
        })
        .then(function () {
          var el = key === 'v' ? wmVSaved : wmHSaved;
          if (el) el.hidden = false;
        })
        .catch(function (err) {
          console.error('watermark opslaan mislukt', err);
        });
    }

    function analyzeWM(img) {
      var w = img.naturalWidth;
      var h = img.naturalHeight;

      var cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;

      var ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);

      var data;

      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch (e) {
        cv.width = 1;
        cv.height = 1;
        return null;
      }

      var minX = w;
      var minY = h;
      var maxX = -1;
      var maxY = -1;

      for (var y = 0; y < h; y++) {
        var row = y * w * 4;

        for (var x = 0; x < w; x++) {
          if (data[row + x * 4 + 3] > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      cv.width = 1;
      cv.height = 1;

      if (maxX === -1) return null;

      return {
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1
      };
    }

    function attachWatermark(source, isVertical, saved) {
      var url = URL.createObjectURL(source);
      var img = new Image();

      img.onload = function () {
        var box = analyzeWM(img);

        var wmo = {
          img: img,
          box: box
        };

        if (isVertical) {
          wmVertical = wmo;
        } else {
          wmHorizontal = wmo;
        }

        var label = isVertical ? wmVLabel : wmHLabel;
        var savedEl = isVertical ? wmVSaved : wmHSaved;

        label.classList.add('has-file');
        label.querySelector('img').src = url;

        if (savedEl) {
          savedEl.hidden = !saved;
        }

        renderAll();
      };

      img.onerror = function () {
        URL.revokeObjectURL(url);
      };

      img.src = url;
    }

    function bindWatermarkInput(input, isVertical, key) {
      input.addEventListener('change', function (e) {
        var f = e.target.files[0];

        if (f) {
          attachWatermark(f, isVertical, true);
          saveWM(f, key);
        }

        input.value = '';
      });
    }

    function loadDefaultWM(isVertical) {
      var key = isVertical ? 'v' : 'h';

      fetch(DEFAULT_WM[key], {
        cache: 'no-cache'
      })
        .then(function (res) {
          if (!res.ok) {
            throw new Error('niet gevonden');
          }

          return res.blob();
        })
        .then(function (blob) {
          attachWatermark(blob, isVertical, false);
        })
        .catch(function () {});
    }

    function loadOneWM(key, isVertical) {
      openDB()
        .then(function (db) {
          return new Promise(function (resolve, reject) {
            var tx = db.transaction('watermarks', 'readonly');
            var r = tx.objectStore('watermarks').get(key);

            tx.oncomplete = function () {
              db.close();
              resolve(r.result);
            };

            tx.onerror = function () {
              db.close();
              reject(tx.error);
            };
          });
        })
        .then(function (buf) {
          if (buf) {
            attachWatermark(
              new Blob([buf], {
                type: 'image/png'
              }),
              isVertical,
              true
            );
          } else {
            loadDefaultWM(isVertical);
          }
        })
        .catch(function () {
          loadDefaultWM(isVertical);
        });
    }

    bindWatermarkInput(wmV, true, 'v');
    bindWatermarkInput(wmH, false, 'h');

    wmVChange.addEventListener('click', function () {
      wmV.click();
    });

    wmHChange.addEventListener('click', function () {
      wmH.click();
    });

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

          var item = {
            file: file,
            img: img,
            url: url,
            orientation: null
          };

          items.push(item);

          img.onload = function () {
            try {
              item.orientation =
                img.naturalWidth >= img.naturalHeight
                  ? 'h'
                  : 'v';

              renderAll();
            } catch (err) {
              setStatus(
                'Fout bij verwerken: ' + err.message
              );
            }
          };

          img.onerror = function () {
            failed++;

            var i = items.indexOf(item);

            if (i !== -1) {
              items.splice(i, 1);
            }

            URL.revokeObjectURL(url);

            renderAll();

            setStatus(
              '1 of meer bestanden konden niet als afbeelding worden gelezen. ' +
              'iPhone-HEIC werkt niet op de pc (zet om naar JPG/PNG); andere bestanden kunnen beschadigd zijn.'
            );
          };

          img.src = url;

        } catch (err) {
          setStatus(
            'Fout bij openen: ' + err.message
          );
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
      photosDrop.addEventListener('dragover', function (e) {
        e.preventDefault();
      });

      photosDrop.addEventListener('drop', function (e) {
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      });
    }

    function buildCanvas(item, forPreview) {
      var img = item.img;

      var scale = forPreview
        ? Math.min(
            1,
            320 / Math.max(
              img.naturalWidth,
              img.naturalHeight
            )
          )
        : 1;

      var w = Math.round(img.naturalWidth * scale);
      var h = Math.round(img.naturalHeight * scale);

      var cv = document.createElement('canvas');

      cv.width = w;
      cv.height = h;

      var ctx = cv.getContext('2d');

      ctx.drawImage(
        img,
        0,
        0,
        w,
        h
      );

      var wm =
        item.orientation === 'v'
          ? wmVertical
          : wmHorizontal;

      if (wm) {
        var fw = wm.img.naturalWidth;
        var fh = wm.img.naturalHeight;

        var s = Math.min(
          w / fw,
          h / fh
        );

        var dw;
        var dh;
        var dx;
        var dy;

        if (wm.box) {
          dw = wm.box.w * s;
          dh = wm.box.h * s;

          var m = h * 0.015;

          dx = w - dw - m;
          dy = h - dh - m;

          ctx.drawImage(
            wm.img,
            wm.box.x,
            wm.box.y,
            wm.box.w,
            wm.box.h,
            dx,
            dy,
            dw,
            dh
          );
        } else {
          dw = fw * s;
          dh = fh * s;

          ctx.drawImage(
            wm.img,
            w - dw,
            h - dh,
            dw,
            dh
          );
        }
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

          var cv = buildCanvas(
            item,
            true
          );

          thumb.width = 200;
          thumb.height = 200;

          var tctx = thumb.getContext('2d');

          var tw = cv.width;
          var th = cv.height;

          var scale = Math.min(
            200 / tw,
            200 / th
          );

          var dw = tw * scale;
          var dh = th * scale;

          tctx.fillStyle = '#fff';

          tctx.fillRect(
            0,
            0,
            200,
            200
          );

          tctx.drawImage(
            cv,
            (200 - dw) / 2,
            (200 - dh) / 2,
            dw,
            dh
          );

          // Previewcanvas niet langer dan nodig in geheugen houden
          cv.width = 1;
          cv.height = 1;

          el.appendChild(thumb);

          var meta = document.createElement('div');
          meta.className = 'meta';

          var orientation =
            item.orientation === 'v'
              ? 'Verticaal'
              : 'Horizontaal';

          var badge =
            item.orientation === 'v'
              ? 'v'
              : 'h';

          meta.innerHTML =
            '<strong>' +
            esc(item.file.name) +
            '</strong>' +
            '<span class="badge ' +
            badge +
            '">' +
            orientation +
            '</span>';

          el.appendChild(meta);

          var btn = document.createElement('button');

          btn.type = 'button';
          btn.className = 'ghost';
          btn.textContent = 'Downloaden';

          btn.addEventListener(
            'click',
            function () {
              downloadOne(item);
            }
          );

          el.appendChild(btn);
          listEl.appendChild(el);
        });

        setStatus(
          items.length +
          (
            items.length === 1
              ? ' foto geselecteerd'
              : ' foto\'s geselecteerd'
          )
        );

        var ready =
          items.length > 0 &&
          wmVertical &&
          wmHorizontal &&
          items.every(function (i) {
            return i.orientation;
          });

        downloadAllBtn.disabled = !ready;

      } catch (err) {
        setStatus(
          'Fout bij weergave: ' +
          err.message
        );
      }
    }

    function fileName(item) {
      return (
        'watermarked_' +
        item.file.name.replace(
          /\.[^.]+$/,
          ''
        ) +
        '.jpg'
      );
    }

    function triggerDownload(url, name) {
      var a = document.createElement('a');

      a.href = url;
      a.download = name;

      document.body.appendChild(a);

      a.click();
      a.remove();

      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 2000);
    }

    function canvasToBlob(cv) {
      return new Promise(function (resolve, reject) {
        cv.toBlob(
          function (blob) {
            if (blob) {
              resolve(blob);
            } else {
              reject(
                new Error(
                  'Kon afbeelding niet als JPG verwerken.'
                )
              );
            }
          },
          'image/jpeg',
          0.92
        );
      });
    }

    async function downloadOne(item) {
      var cv = null;

      try {
        cv = buildCanvas(
          item,
          false
        );

        var blob = await canvasToBlob(cv);

        var url = URL.createObjectURL(blob);

        triggerDownload(
          url,
          fileName(item)
        );

      } catch (err) {
        setStatus(
          'Fout bij downloaden: ' +
          err.message
        );

      } finally {
        if (cv) {
          cv.width = 1;
          cv.height = 1;
        }
      }
    }

    downloadAllBtn.addEventListener(
      'click',
      async function () {
        if (downloadAllBtn.disabled) {
          return;
        }

        downloadAllBtn.disabled = true;

        var originalText =
          downloadAllBtn.textContent;

        var zip = new JSZip();

        try {
          for (
            var i = 0;
            i < items.length;
            i++
          ) {
            var item = items[i];

            setStatus(
              'Foto ' +
              (i + 1) +
              ' van ' +
              items.length +
              ' verwerken...'
            );

            downloadAllBtn.textContent =
              'Verwerken ' +
              (i + 1) +
              '/' +
              items.length +
              '...';

            var cv = null;

            try {
              /*
               * BELANGRIJK:
               * We maken hier slechts één volledig
               * resolutiecanvas tegelijk.
               */
              cv = buildCanvas(
                item,
                false
              );

              var blob =
                await canvasToBlob(cv);

              zip.file(
                fileName(item),
                blob
              );

            } finally {
              /*
               * Canvas direct verkleinen zodat
               * de backing store vrijkomt.
               */
              if (cv) {
                cv.width = 1;
                cv.height = 1;
              }
            }

            /*
             * Geef de browser een event-loop moment
             * om geheugen op te ruimen.
             */
            await new Promise(
              function (resolve) {
                setTimeout(
                  resolve,
                  0
                );
              }
            );
          }

          setStatus(
            'ZIP wordt gemaakt...'
          );

          downloadAllBtn.textContent =
            'ZIP maken...';

          /*
           * JPEG's zijn al gecomprimeerd.
           * STORE voorkomt dat JSZip ze opnieuw
           * probeert te comprimeren.
           *
           * streamFiles vermindert de hoeveelheid
           * tijdelijke ZIP-data in geheugen.
           */
          var zipBlob =
            await zip.generateAsync(
              {
                type: 'blob',
                streamFiles: true,
                compression: 'STORE'
              },
              function (metadata) {
                setStatus(
                  'ZIP maken... ' +
                  Math.round(
                    metadata.percent
                  ) +
                  '%'
                );
              }
            );

          var zipUrl =
            URL.createObjectURL(
              zipBlob
            );

          triggerDownload(
            zipUrl,
            'watermarked-photos.zip'
          );

          setStatus(
            'Klaar! ' +
            items.length +
            ' foto\'s verwerkt.'
          );

        } catch (err) {
          console.error(
            'Downloadfout:',
            err
          );

          setStatus(
            'Fout bij verwerken: ' +
            err.message
          );

        } finally {
          downloadAllBtn.disabled = false;

          downloadAllBtn.textContent =
            originalText ||
            'Alles downloaden (.zip)';
        }
      }
    );

    resetBtn.addEventListener(
      'click',
      function () {
        items.forEach(
          function (item) {
            URL.revokeObjectURL(
              item.url
            );
          }
        );

        items = [];

        renderAll();
      }
    );

    loadOneWM(
      'v',
      true
    );

    loadOneWM(
      'h',
      false
    );
  }

  var auth = null;

  var lockEl =
    document.getElementById('lock');

  var lockInput =
    document.getElementById('lock-input');

  var lockBtn =
    document.getElementById('lock-btn');

  var lockError =
    document.getElementById('lock-error');

  function hexToBytes(hex) {
    var out =
      new Uint8Array(
        hex.length / 2
      );

    for (
      var i = 0;
      i < out.length;
      i++
    ) {
      out[i] =
        parseInt(
          hex.substr(
            i * 2,
            2
          ),
          16
        );
    }

    return out;
  }

  function bytesToHex(buf) {
    var b =
      new Uint8Array(buf);

    var s = '';

    for (
      var i = 0;
      i < b.length;
      i++
    ) {
      s += (
        '0' +
        b[i].toString(16)
      ).slice(-2);
    }

    return s;
  }

  function deriveKey(
    password,
    cfg
  ) {
    var enc =
      new TextEncoder();

    return crypto.subtle
      .importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      )
      .then(
        function (key) {
          return crypto.subtle
            .deriveBits(
              {
                name: 'PBKDF2',
                hash: 'SHA-256',
                salt: hexToBytes(
                  cfg.salt
                ),
                iterations:
                  cfg.iterations
              },
              key,
              256
            );
        }
      )
      .then(bytesToHex);
  }

  function tryUnlock() {
    var pass =
      lockInput.value;

    if (!pass || !auth) {
      return;
    }

    lockError.hidden = true;

    deriveKey(
      pass,
      auth
    )
      .then(function (hex) {
        if (hex === auth.hash) {
          try {
            localStorage.setItem(
              'wm-key',
              auth.hash
            );
          } catch (e) {}

          lockEl.hidden = true;

          startApp();

        } else {
          lockError.hidden = false;
          lockInput.value = '';
          lockInput.focus();
        }
      })
      .catch(function () {
        lockError.hidden = false;
      });
  }

  lockBtn.addEventListener(
    'click',
    tryUnlock
  );

  lockInput.addEventListener(
    'keydown',
    function (e) {
      if (e.key === 'Enter') {
        tryUnlock();
      }
    }
  );

  function noLock() {
    lockEl.hidden = true;
    startApp();
  }

  fetch(
    'auth.json',
    {
      cache: 'no-cache'
    }
  )
    .then(function (res) {
      return res.ok
        ? res.json()
        : null;
    })
    .catch(function () {
      return null;
    })
    .then(function (cfg) {
      if (!cfg) {
        noLock();
        return;
      }

      if (
        !window.crypto ||
        !crypto.subtle
      ) {
        noLock();
        return;
      }

      auth = cfg;

      var saved = null;

      try {
        saved =
          localStorage.getItem(
            'wm-key'
          );
      } catch (e) {}

      if (
        saved === cfg.hash
      ) {
        lockEl.hidden = true;
        startApp();
        return;
      }

      lockInput.focus();
    });
})();
