(function (g) {
  var TX = (g.TX = g.TX || {});

  function round(n, d) {
    var p = Math.pow(10, d == null ? 0 : d);
    return Math.round(n * p) / p;
  }

  TX.fmt = {
    int: function (n) {
      n = Math.round(Number(n) || 0);
      return n.toLocaleString("en-US");
    },
    usd: function (n) {
      return TX.fmt.int(n);
    },
    money: function (n) {
      return "$" + TX.fmt.int(n);
    },
    pct: function (x, d) {
      if (x == null || !isFinite(x)) return "—";
      d = d == null ? 1 : d;
      var p = x * 100;
      if (Math.abs(p) < 1e-9) return "0%";
      if (Math.abs(p - 100) < 1e-6) return "100%";
      return p.toFixed(d) + "%";
    },
    pctOrDash: function (x, d) {
      return TX.fmt.pct(x, d);
    },
    dur: function (sec) {
      if (sec == null || !isFinite(sec)) return "—";
      if (sec < 60) return Math.round(sec) + "s";
      if (sec < 3600) {
        var m = sec / 60;
        if (Math.abs(m - Math.round(m)) < 0.05) return Math.round(m) + "m";
        return m.toFixed(1) + "m";
      }
      return (sec / 3600).toFixed(1) + "h";
    },
    hm: function (hh, mm) {
      return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
    },
  };

  TX.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  function yTicks(max, n) {
    n = n || 4;
    if (!(max > 0)) max = 1;
    var out = [];
    for (var i = 0; i <= n; i++) out.push(max * (1 - i / n));
    return out;
  }

  function fmtTick(v, kind) {
    if (kind === "pct") return Math.round(v * 100) + "%";
    if (kind === "usd") {
      if (v >= 1000) return "$" + Math.round(v);
      return "$" + Math.round(v);
    }
    if (kind === "usdk") {
      if (v >= 1000) return "$" + Math.round(v / 1000) + "k";
      return "$" + Math.round(v);
    }
    return String(Math.round(v));
  }

  TX.charts = {
    line: function (cats, data, opt) {
      opt = opt || {};
      var W = opt.W || 640;
      var H = opt.H || 220;
      var L = 44;
      var R = 12;
      var T = 16;
      var B = 28;
      var color = opt.color || "#3d8fd1";
      var mx = opt.yMax != null ? opt.yMax : Math.max.apply(null, data.concat([0])) * 1.08;
      if (!(mx > 0)) mx = 1;
      var mn = 0;
      function x(i) {
        if (cats.length <= 1) return L;
        return L + (i * (W - L - R)) / (cats.length - 1);
      }
      function y(v) {
        return T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
      }
      var pts = data
        .map(function (v, i) {
          return x(i).toFixed(1) + "," + y(v).toFixed(1);
        })
        .join(" ");
      var parts = [];
      var ticks = yTicks(mx, 4);
      ticks.forEach(function (v, i) {
        var yy = T + ((H - T - B) * i) / 4;
        parts.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="rgba(240,240,240,.08)"/>');
        parts.push(
          '<text x="' +
            (L - 6) +
            '" y="' +
            (yy + 4).toFixed(1) +
            '" text-anchor="end" fill="rgba(240,240,240,.45)" font-size="10">' +
            TX.esc(fmtTick(v, opt.yKind || "usd")) +
            "</text>"
        );
      });
      (opt.refs || []).forEach(function (ref) {
        var yy = y(ref.v);
        parts.push(
          '<line x1="' +
            L +
            '" x2="' +
            (W - R) +
            '" y1="' +
            yy.toFixed(1) +
            '" y2="' +
            yy.toFixed(1) +
            '" stroke="' +
            ref.color +
            '" stroke-dasharray="4 3"/>'
        );
        parts.push(
          '<text x="' +
            (W - R) +
            '" y="' +
            (yy - 4).toFixed(1) +
            '" text-anchor="end" fill="' +
            ref.color +
            '" font-size="10">' +
            TX.esc(ref.label) +
            "</text>"
        );
      });
      if (opt.fill) {
        var area =
          x(0).toFixed(1) +
          "," +
          y(0).toFixed(1) +
          " " +
          pts +
          " " +
          x(data.length - 1).toFixed(1) +
          "," +
          y(0).toFixed(1);
        parts.push('<polygon points="' + area + '" fill="' + color + '" opacity=".18"/>');
      }
      parts.push('<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.75"/>');
      data.forEach(function (v, i) {
        parts.push('<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.2" fill="' + color + '"/>');
      });
      cats.forEach(function (c, i) {
        if (i % 2 !== 0 && cats.length > 12) return;
        parts.push(
          '<text x="' +
            x(i).toFixed(1) +
            '" y="' +
            (H - 8) +
            '" text-anchor="middle" fill="rgba(240,240,240,.45)" font-size="10">' +
            TX.esc(c) +
            "</text>"
        );
      });
      return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" height="' + H + '" xmlns="http://www.w3.org/2000/svg">' + parts.join("") + "</svg>";
    },

    hbar: function (items, opt) {
      opt = opt || {};
      var W = opt.W || 640;
      var rowH = 22;
      var H = items.length * rowH + 14;
      var L = opt.L || 128;
      var barMax = W - L - 78;
      var mx = opt.xMax != null ? opt.xMax : Math.max.apply(
        null,
        items
          .map(function (it) {
            return it.v;
          })
          .concat([0])
      );
      if (!(mx > 0)) mx = 1;
      var color = opt.color || "#e5484d";
      var parts = [];
      if (opt.ref != null) {
        var rx = L + (opt.ref / mx) * barMax;
        parts.push('<line x1="' + rx.toFixed(1) + '" x2="' + rx.toFixed(1) + '" y1="8" y2="' + (H - 8) + '" stroke="#e5484d" stroke-dasharray="4 3"/>');
        parts.push('<text x="' + (rx + 4).toFixed(1) + '" y="16" fill="#e5484d" font-size="10">' + TX.esc(opt.refLabel || "") + "</text>");
      }
      items.forEach(function (it, i) {
        var y = 12 + i * rowH;
        var w = Math.max(1.2, (it.v / mx) * barMax);
        var c = it.color || color;
        parts.push('<rect x="' + L + '" y="' + y + '" width="' + w.toFixed(1) + '" height="12" rx="2" fill="' + c + '" opacity=".9"/>');
        parts.push(
          '<text x="' +
            (L - 8) +
            '" y="' +
            (y + 10) +
            '" text-anchor="end" fill="rgba(240,240,240,.7)" font-size="11">' +
            TX.esc(it.label) +
            "</text>"
        );
        parts.push(
          '<text x="' +
            (L + w + 6).toFixed(1) +
            '" y="' +
            (y + 10) +
            '" fill="rgba(240,240,240,.7)" font-size="11">' +
            TX.esc(it.right == null ? "" : it.right) +
            "</text>"
        );
      });
      return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" height="' + H + '" xmlns="http://www.w3.org/2000/svg">' + parts.join("") + "</svg>";
    },

    vbar: function (items, opt) {
      opt = opt || {};
      var W = opt.W || 640;
      var H = opt.H || 200;
      var L = 48;
      var R = 12;
      var T = 12;
      var B = 28;
      var mx = Math.max.apply(
        null,
        items
          .map(function (it) {
            return it.v;
          })
          .concat([0])
      ) * 1.1;
      if (!(mx > 0)) mx = 1;
      var bw = (W - L - R) / items.length;
      var barW = Math.min(46.4, bw * 0.64);
      var parts = [];
      yTicks(mx, 4).forEach(function (v, i) {
        var yy = T + ((H - T - B) * i) / 4;
        parts.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="rgba(240,240,240,.08)"/>');
        parts.push(
          '<text x="' +
            (L - 6) +
            '" y="' +
            (yy + 4).toFixed(1) +
            '" text-anchor="end" fill="rgba(240,240,240,.45)" font-size="10">' +
            TX.esc(fmtTick(v, opt.yKind || "usdk")) +
            "</text>"
        );
      });
      items.forEach(function (it, i) {
        var h = (it.v / mx) * (H - T - B);
        var x = L + i * bw + (bw - barW) / 2;
        var y = T + (H - T - B) - h;
        parts.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(0.8, h).toFixed(1) + '" rx="2" fill="#3d8fd1"/>');
        parts.push(
          '<text x="' +
            (x + barW / 2).toFixed(1) +
            '" y="' +
            (H - 10) +
            '" text-anchor="middle" fill="rgba(240,240,240,.45)" font-size="10">' +
            TX.esc(it.label) +
            "</text>"
        );
      });
      return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" height="' + H + '" xmlns="http://www.w3.org/2000/svg">' + parts.join("") + "</svg>";
    },

    donut: function (items, center, sub) {
      var cx = 110;
      var cy = 110;
      var R = 78;
      var r = 48;
      var total = items.reduce(function (s, it) {
        return s + it.v;
      }, 0);
      if (!(total > 0)) total = 1;
      var a0 = -Math.PI / 2;
      var parts = [];
      function pt(ang, rad) {
        return [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
      }
      items.forEach(function (it) {
        var da = (it.v / total) * Math.PI * 2;
        var a1 = a0 + da;
        var large = da > Math.PI ? 1 : 0;
        var p0 = pt(a0, R);
        var p1 = pt(a1, R);
        var q0 = pt(a0, r);
        var q1 = pt(a1, r);
        var d =
          "M" +
          p0[0].toFixed(2) +
          "," +
          p0[1].toFixed(2) +
          " A" +
          R +
          " " +
          R +
          " 0 " +
          large +
          " 1 " +
          p1[0].toFixed(2) +
          "," +
          p1[1].toFixed(2) +
          " L" +
          q1[0].toFixed(2) +
          "," +
          q1[1].toFixed(2) +
          " A" +
          r +
          " " +
          r +
          " 0 " +
          large +
          " 0 " +
          q0[0].toFixed(2) +
          "," +
          q0[1].toFixed(2) +
          " Z";
        parts.push('<path d="' + d + '" fill="' + it.color + '"/>');
        a0 = a1;
      });
      parts.push('<text x="110" y="106" text-anchor="middle" fill="#f0f0f0" font-size="16" font-weight="590">' + TX.esc(center) + "</text>");
      parts.push('<text x="110" y="124" text-anchor="middle" fill="rgba(240,240,240,.5)" font-size="11">' + TX.esc(sub || "") + "</text>");
      var legend = items
        .map(function (it) {
          return '<span><i style="background:' + it.color + '"></i>' + TX.esc(it.label) + " " + TX.fmt.int(it.v) + "</span>";
        })
        .join("");
      return (
        '<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">' +
        '<svg width="220" height="220" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">' +
        parts.join("") +
        "</svg>" +
        '<div class="legend" style="flex-direction:column;gap:8px">' +
        legend +
        "</div></div>"
      );
    },
  };

  TX.round = round;
})(typeof window !== "undefined" ? window : globalThis);
