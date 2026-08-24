(function () {
  var state = {
    raw: null,
    sheetName: "",
    fileName: "",
    result: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showErr(msg) {
    var el = $("err");
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function readThresholds() {
    function n(id, def) {
      var v = parseFloat($(id).value);
      return isFinite(v) ? v : def;
    }
    return {
      decline: n("th-decline", 20) / 100,
      refund: n("th-refund", 10) / 100,
      smallUsd: n("th-small", 30),
      cardTopupCount: n("th-topup-n", 3),
      intervalSec: n("th-interval", 120),
      userDeclineMinSpend: n("th-user-n", 5),
      cardDeclineMinSpend: n("th-card-n", 5),
      burstMinCards: n("th-burst-cards", 2),
      accountUserMinSpend: n("th-au-n", 8),
    };
  }

  function readFx() {
    function n(id, def) {
      var v = parseFloat($(id).value);
      return isFinite(v) && v > 0 ? v : def;
    }
    return {
      EURUSD: n("fx-eurusd", TX.DEFAULT_FX.EURUSD),
      USDINR: n("fx-usdinr", TX.DEFAULT_FX.USDINR),
    };
  }

  function recompute() {
    if (!state.raw) return;
    showErr("");
    try {
      state.result = TX.analyze(state.raw, {
        thresholds: readThresholds(),
        fx: readFx(),
        fileName: state.fileName,
        sheetName: state.sheetName,
      });
      TX.render(state.result);
      $("desk").classList.add("show");
      $("btn-print").disabled = false;
      $("file-meta").textContent =
        state.fileName + " · 工作表「" + state.sheetName + "」 · " + state.result.rowsN.toLocaleString("en-US") + " 行";
    } catch (e) {
      $("desk").classList.remove("show");
      $("btn-print").disabled = true;
      showErr(e.message || String(e));
    }
  }

  function loadArrayBuffer(buf, name) {
    try {
      var pack = TX.readExcel(buf);
      state.raw = pack.rows;
      state.sheetName = pack.sheetName;
      state.fileName = name || "workbook.xlsx";
      recompute();
    } catch (e) {
      state.raw = null;
      $("desk").classList.remove("show");
      $("btn-print").disabled = true;
      showErr(e.message || String(e));
    }
  }

  function loadFile(file) {
    if (!file) return;
    var low = (file.name || "").toLowerCase();
    if (low && !/\.xlsx?$/.test(low)) {
      showErr("请上传 .xlsx 文件（现有交易记录格式）。");
      return;
    }
    showErr("");
    $("file-meta").textContent = "正在读取 " + file.name + " …";
    var reader = new FileReader();
    reader.onload = function (ev) {
      loadArrayBuffer(ev.target.result, file.name);
    };
    reader.onerror = function () {
      showErr("文件读取失败");
    };
    reader.readAsArrayBuffer(file);
  }

  function bindTabs() {
    var nav = $("tab-nav");
    nav.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      var id = btn.getAttribute("data-tab");
      nav.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("on", b === btn);
      });
      document.querySelectorAll("#desk .panel").forEach(function (p) {
        p.classList.toggle("on", p.id === "p-" + id);
      });
    });
  }

  function bindDrop() {
    var drop = $("drop");
    var input = $("file");
    drop.addEventListener("click", function () {
      input.click();
    });
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) loadFile(input.files[0]);
      input.value = "";
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.add("over");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.remove("over");
      });
    });
    drop.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
  }

  function bindAdvanced() {
    ["th-decline", "th-refund", "th-small", "th-topup-n", "th-interval", "th-user-n", "th-card-n", "th-burst-cards", "th-au-n", "fx-eurusd", "fx-usdinr"].forEach(
      function (id) {
        $(id).addEventListener("change", recompute);
        $(id).addEventListener("input", function () {
          if (state._t) clearTimeout(state._t);
          state._t = setTimeout(recompute, 180);
        });
      }
    );
  }

  function printDesk() {
    if (!state.result) return;
    document.body.classList.add("print-all");
    window.print();
  }

  window.addEventListener("afterprint", function () {
    document.body.classList.remove("print-all");
  });

  document.addEventListener("DOMContentLoaded", function () {
    bindTabs();
    bindDrop();
    bindAdvanced();
    $("btn-print").addEventListener("click", printDesk);
    $("th-decline").value = TX.DEFAULT_THRESHOLDS.decline * 100;
    $("th-refund").value = TX.DEFAULT_THRESHOLDS.refund * 100;
    $("th-small").value = TX.DEFAULT_THRESHOLDS.smallUsd;
    $("th-topup-n").value = TX.DEFAULT_THRESHOLDS.cardTopupCount;
    $("th-interval").value = TX.DEFAULT_THRESHOLDS.intervalSec;
    $("th-user-n").value = TX.DEFAULT_THRESHOLDS.userDeclineMinSpend;
    $("th-card-n").value = TX.DEFAULT_THRESHOLDS.cardDeclineMinSpend;
    $("th-burst-cards").value = TX.DEFAULT_THRESHOLDS.burstMinCards;
    $("th-au-n").value = TX.DEFAULT_THRESHOLDS.accountUserMinSpend;
    $("fx-eurusd").value = TX.DEFAULT_FX.EURUSD;
    $("fx-usdinr").value = TX.DEFAULT_FX.USDINR;
  });
})();
