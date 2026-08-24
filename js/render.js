(function (g) {
  var TX = (g.TX = g.TX || {});

  function esc(s) {
    return TX.esc(s);
  }
  function F() {
    return TX.fmt;
  }
  function dot(tone) {
    return tone ? '<span class="dot ' + tone + '"></span>' : "";
  }
  function stat(v, l, tone) {
    return '<div class="stat"><div class="v ' + (tone || "") + '">' + v + '</div><div class="l">' + l + "</div></div>";
  }
  function callout(kind, t, b) {
    return '<div class="callout ' + kind + '"><div class="t">' + esc(t) + '</div><div class="b">' + b + "</div></div>";
  }
  function caption(s) {
    return '<p class="caption">' + esc(s) + "</p>";
  }
  function muted(s) {
    return '<p class="muted">' + s + "</p>";
  }
  function dim(s) {
    return '<p class="dim">' + s + "</p>";
  }

  function table(headers, rows, opt) {
    opt = opt || {};
    var thead =
      "<thead><tr>" +
      headers
        .map(function (h) {
          var cls = h.right ? ' class="right"' : "";
          return "<th" + cls + ">" + esc(h.l) + "</th>";
        })
        .join("") +
      "</tr></thead>";
    var body = rows
      .map(function (r) {
        return (
          "<tr>" +
          r
            .map(function (c, i) {
              var cls = headers[i] && headers[i].right ? ' class="right"' : "";
              return "<td" + cls + ">" + c + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    var mh = opt.maxHeight ? ' style="max-height:' + opt.maxHeight + '"' : "";
    return '<div class="tbl-wrap"' + mh + "><table>" + thead + "<tbody>" + body + "</tbody></table></div>";
  }

  function adsCell(p) {
    return p == null ? "—" : F().pct(p, 0);
  }

  function rAmtCell(v) {
    return v == null ? "—" : F().pct(v, 1);
  }

  TX.render = function (S) {
    var th = S.th;
    var all = S.all;
    var alerts = S.alerts;
    var nDeclBook = alerts.book_decline.length;
    var nRefBook = alerts.book_refund.length;
    var nDeclUser = alerts.user_decline.length;
    var nDeclCard = alerts.card_decline.length;
    var nDual = alerts.card_dual_topup.length;
    var nBurstU = S.burstUsers.length;
    var nBurst = S.bursts.length;
    var burstAmt = S.bursts.reduce(function (s, c) {
      return s + c.amt;
    }, 0);
    var burstN = S.bursts.reduce(function (s, c) {
      return s + c.n;
    }, 0);

    var header =
      '<div class="stack stack-6">' +
      '<div class="row">' +
      "<h1>TX RISK MONITOR</h1>" +
      '<span class="pill sm active">' +
      esc(S.dateLabel) +
      "</span>" +
      '<span class="dim">D-BOOK · ' +
      F().int(S.rowsN) +
      " 笔 · " +
      F().int(all.nUsers) +
      " 用户 · " +
      F().int(all.nCards) +
      " 卡</span>" +
      '<span class="spacer"></span>' +
      '<span class="dim">拒付=失败 ' +
      F().pct(th.decline, 0) +
      " · 退款 " +
      F().pct(th.refund, 0) +
      " · 单卡转入 · 群充 · 小额 &lt;" +
      F().money(th.smallUsd) +
      "</span>" +
      "</div>" +
      '<p class="muted">消费拒付率 ' +
      F().pct(all.decl) +
      "（" +
      (all.decl >= th.decline ? "已破" : "账面未破") +
      " " +
      F().pct(th.decline, 0) +
      "），" +
      nDeclBook +
      " 个通道账户、" +
      nDeclUser +
      " 个用户、" +
      nDeclCard +
      " 张卡已越线。群充 " +
      nBurstU +
      " 人、" +
      nBurst +
      " 簇。小额（折美元 &lt; " +
      F().money(th.smallUsd) +
      "）占消费笔数 " +
      F().pct(all.smallP) +
      "。" +
      (S.multiDay ? " 文件含多日，已按北京时间小时叠加。" : "") +
      (S.skipped ? " 跳过 " + S.skipped + " 行（记录时间无法解析）。" : "") +
      "</p></div>";

    document.getElementById("desk-head").innerHTML = header;
    document.getElementById("p-overview").innerHTML = renderOverview(S);
    document.getElementById("p-alerts").innerHTML = renderAlerts(S);
    document.getElementById("p-book").innerHTML = renderBook(S);
    document.getElementById("p-user").innerHTML = renderUser(S);
    document.getElementById("p-card").innerHTML = renderCard(S);
    document.getElementById("p-burst").innerHTML = renderBurst(S);
    document.getElementById("p-mcc").innerHTML = renderMcc(S);
    document.getElementById("desk-foot").innerHTML = renderFoot(S);
  };

  function renderOverview(S) {
    var th = S.th;
    var all = S.all;
    var alerts = S.alerts;
    var nDeclBook = alerts.book_decline.length;
    var nDeclUser = alerts.user_decline.length;
    var nDeclCard = alerts.card_decline.length;
    var nDual = alerts.card_dual_topup.length;
    var nBurstU = S.burstUsers.length;
    var nBurst = S.bursts.length;
    var burstAmt = S.bursts.reduce(function (s, c) {
      return s + c.amt;
    }, 0);

    var peak = S.hours.slice().sort(function (a, b) {
      return b.decl - a.decl;
    })[0];

    var html = '<div class="stack stack-18">';
    html += callout(
      "danger",
      "越线摘要 · 按已确认口径",
      "拒付 = 交易失败。拒付 ≥" +
        F().pct(th.decline, 0) +
        "：" +
        nDeclBook +
        " 个通道账户、" +
        nDeclUser +
        " 个用户、" +
        nDeclCard +
        " 张卡。退款 ≥" +
        F().pct(th.refund, 0) +
        "：" +
        alerts.book_refund.length +
        " 个通道账户。单卡双规则同时命中 " +
        nDual +
        " 张。群充（跨卡、间隔&lt;" +
        th.intervalSec +
        " 秒）" +
        nBurstU +
        " 用户 / " +
        nBurst +
        " 簇 / " +
        F().money(burstAmt) +
        "，见「群充」页。跨日退款（该卡当日无成功消费）" +
        F().int(S.all.nRefRoll || 0) +
        " 笔 " +
        F().money(S.all.refAmtRoll || 0) +
        " 已进滚动窗口，不进当天退款比。小额按折美元 &lt; " +
        F().money(th.smallUsd) +
        "，" +
        F().int(all.smallN) +
        " 笔。"
    );
    html +=
      '<div class="grid g3">' +
      stat(F().pct(all.decl), "消费拒付率  " + F().int(all.nSpendFail) + " / " + F().int(all.nSpend), all.decl >= th.decline ? "tone-danger" : "tone-warning") +
      stat(rAmtCell(all.rAmt), "当天退款金额比  " + F().money(all.refAmt) + " / " + F().money(all.okAmt)) +
      stat(rAmtCell(all.rCnt), "当天退款笔数比  " + F().int(all.nRef) + " / " + F().int(all.nSpendOk)) +
      stat(F().money(all.refAmtRoll || 0), "跨日滚动退款  " + F().int(all.nRefRoll || 0) + " 笔", all.nRefRoll ? "tone-info" : "") +
      stat(F().pct(all.smallP), "小额笔数占比  折USD &lt; " + F().money(th.smallUsd), "tone-warning") +
      stat(String(nDual), "单卡快充且&gt;" + th.cardTopupCount + "次", nDual ? "tone-danger" : "") +
      stat(String(nBurstU), "群充用户  " + nBurst + " 簇", nBurstU ? "tone-danger" : "") +
      "</div>";

    html += '<div class="grid g21">';
    html += '<div class="stack stack-8"><h2>分时消费成功金额与拒付率</h2>';
    html += dim(
      "左轴图：消费成功金额（USD）。右图：全量交易失败笔数 / 全量笔数。" +
        (peak ? peak.label + ":00 拒付脉冲最高（" + F().pct(peak.decl) + "）。" : "") +
        (S.multiDay ? "多日已按小时叠加。" : "")
    );
    html += '<div class="chart">' + TX.charts.line(
      S.hours.map(function (x) {
        return x.label;
      }),
      S.hours.map(function (x) {
        return x.spendOk;
      }),
      { fill: true, color: "#3d8fd1", yKind: "usd" }
    ) + "</div>";
    html += caption("消费成功金额 by hour · USD · 成功消费 abs(金额) 折美元");
    html += "</div>";

    html += '<div class="stack stack-8"><h2>分时拒付率</h2>';
    html += '<div class="chart">' + TX.charts.line(
      S.hours.map(function (x) {
        return x.label;
      }),
      S.hours.map(function (x) {
        return x.decl;
      }),
      {
        color: "#e5484d",
        yKind: "pct",
        yMax: Math.max(0.25, th.decline * 1.25, Math.max.apply(null, S.hours.map(function (x) { return x.decl; })) * 1.15),
        refs: [
          { v: th.decline, color: "#e5484d", label: F().pct(th.decline, 0) },
          { v: th.refund, color: "#d99a2a", label: F().pct(th.refund, 0) },
        ],
      }
    ) + "</div>";
    html += caption("失败笔数 / 该小时全部交易笔数 · 虚线为整理阈值");
    html += "</div></div>";

    var bookBars = S.books.map(function (b) {
      return {
        label: TX.shortChn(b.chn) + " " + b.acct.replace("default", "").trim(),
        v: b.decl,
        right: F().pct(b.decl, 1),
        color: b.decl >= th.decline ? "#e5484d" : "#e5484d",
      };
    });
    bookBars.forEach(function (it, i) {
      var b = S.books[i];
      it.label = (TX.shortChn(b.chn) + " " + (b.acct === "default" ? "default" : b.acct)).replace("default default", "default");
      if (b.chn === "2号通道-共享" && b.acct === "ac_pp_2") it.label = "2号 ac_pp_2";
      if (b.chn === "s通道" && b.acct === "default") it.label = "s通道 default";
      if (b.chn === "s通道" && b.acct === "ac_s_2") it.label = "s通道 ac_s_2";
      if (b.chn === "3号通道-共享") it.label = "3号通道-共享";
    });

    html += '<div class="grid g2">';
    html += '<div class="stack stack-8"><h2>通道账户消费拒付率 vs ' + F().pct(th.decline, 0) + " 阈值</h2>";
    html += '<div class="chart">' + TX.charts.hbar(bookBars, { ref: th.decline, refLabel: F().pct(th.decline, 0), xMax: 1 }) + "</div>";
    html += caption("消费失败笔 / 消费笔 · 金额 USD");
    html += "</div>";

    var failBars = S.failBuckets.slice(0, 11).map(function (b) {
      return { label: b.label, v: b.n, right: String(b.n), color: "#d99a2a" };
    });
    html += '<div class="stack stack-8"><h2>失败原因结构（' + F().int(all.nFailAll) + " 笔失败）</h2>";
    html += '<div class="chart">' + TX.charts.hbar(failBars, { color: "#d99a2a" }) + "</div>";
    var paused = S.failBuckets.filter(function (b) {
      return b.id === "paused";
    })[0];
    html += caption(
      "失败原因归并" +
        (paused ? " · paused " + F().pct(paused.n / all.nFailAll, 0) + " 多为库存卫生，不是盗刷" : "")
    );
    html += "</div></div>";

    if (S.hotspots.length) {
      html += '<div class="grid g3">';
      S.hotspots.forEach(function (h) {
        html +=
          '<div class="card"><div class="card-h">' +
          esc(h.title) +
          '<span class="dim">' +
          esc(h.tag) +
          "</span></div><div class=\"card-b\">" +
          esc(h.body) +
          "</div></div>";
      });
      html += "</div>";
    }

    html += "<h2>资金簿</h2>";
    html +=
      '<div class="grid g4">' +
      stat(F().money(all.topupAmt), "转入  " + F().int(all.nTopup) + " 笔", "tone-success") +
      stat(F().money(all.okAmt), "消费成功  " + F().int(all.nSpendOk) + " 笔") +
      stat(F().money(all.failAmt), "消费失败金额  " + F().int(all.nSpendFail) + " 笔", "tone-danger") +
      stat(F().money(all.wdAmt), "转出  " + F().int(all.nWithdraw) + " 笔") +
      "</div>";
    html += dim(
      "已取消 " +
        F().int(all.nCancel) +
        " 笔（abs " +
        F().money(all.cancelAbs) +
        "，含 " +
        F().int(all.nCancelPos) +
        " 笔正金额撤销，未计入退款）。待处理 " +
        F().int(all.nPending) +
        " 笔（abs " +
        F().money(all.pendingAbs) +
        "），分母未剔除。"
    );

    var typeItems = [
      { key: "消费", color: "#3d8fd1" },
      { key: "转入", color: "#2f9e6a" },
      { key: "转出", color: "#d99a2a" },
      { key: "验证", color: "#8b8b9a" },
      { key: "退款", color: "#e5484d" },
    ]
      .map(function (it) {
        return { label: it.key, v: S.typeN[it.key] || 0, color: it.color };
      })
      .filter(function (it) {
        return it.v > 0;
      });
    html += "<h3>交易类型构成（笔数）</h3>";
    html += '<div id="c-pie">' + TX.charts.donut(typeItems, F().int(all.n), "笔") + "</div>";
    html += caption("交易类型笔数 · 全量 " + F().int(all.n));
    html += "</div>";
    return html;
  }

  function renderAlerts(S) {
    var th = S.th;
    var html = '<div class="stack stack-18">';
    html += callout(
      "warning",
      "口径（看表前先读）",
      "拒付 = 交易状态「交易失败」。消费拒付率 = 消费失败笔 / 消费笔（含已取消、待处理，不去掉）。退款仅「交易类型=退款」，已取消正金额不算退款。跨日退款（该卡当日无成功消费）不进当天退款比，放入「滚动窗口」表。"
    );
    html += "<h2>拒付 ≥" + F().pct(th.decline, 0) + " · 通道 × 帐户名</h2>";
    html += muted(S.alerts.book_decline.length + " 个账户已破线。");
    html += table(
      [
        { l: "通道" },
        { l: "帐户名" },
        { l: "消费笔", right: true },
        { l: "失败笔", right: true },
        { l: "拒付率", right: true },
        { l: "成功金额", right: true },
        { l: "失败金额", right: true },
        { l: "用户", right: true },
        { l: "卡", right: true },
      ],
      S.alerts.book_decline.map(function (b) {
        return [
          dot("danger") + esc(b.chn),
          esc(b.acct),
          F().int(b.nSpend),
          F().int(b.nSpendFail),
          F().pct(b.decl, 1),
          F().usd(b.okAmt),
          F().usd(b.failAmt),
          F().int(b.nUsers),
          F().int(b.nCards),
        ];
      })
    );
    html += caption("消费失败笔 / 消费笔 ≥" + F().pct(th.decline, 0) + " · 金额 USD · 未设最低笔数门槛");

    html += "<h2>退款 ≥" + F().pct(th.refund, 0) + " · 通道 × 帐户名</h2>";
    html += table(
      [
        { l: "通道" },
        { l: "帐户名" },
        { l: "成功消费笔", right: true },
        { l: "成功金额", right: true },
        { l: "退款笔", right: true },
        { l: "退款金额", right: true },
        { l: "金额比", right: true },
        { l: "笔数比", right: true },
      ],
      S.alerts.book_refund.map(function (b) {
        return [
          dot("danger") + esc(b.chn),
          esc(b.acct),
          F().int(b.nSpendOk),
          F().usd(b.okAmt),
          F().int(b.nRef),
          F().usd(b.refAmt),
          rAmtCell(b.rAmt),
          rAmtCell(b.rCnt),
        ];
      })
    );
    html += caption("退款金额 / 消费成功金额 · 仅当天可归因退款（该卡当日有成功消费）· 阈值 " + F().pct(th.refund, 0));

    html += "<h2>拒付 ≥" + F().pct(th.decline, 0) + " · 用户（消费 ≥" + th.userDeclineMinSpend + " 笔）</h2>";
    html += muted(S.alerts.user_decline.length + " 人。按拒付率降序。");
    var udec = S.alerts.user_decline.slice().sort(function (a, b) {
      return b.decl - a.decl || b.failAmt - a.failAmt;
    });
    html += table(
      [
        { l: "用户ID" },
        { l: "帐户" },
        { l: "通道" },
        { l: "消费", right: true },
        { l: "失败", right: true },
        { l: "拒付率", right: true },
        { l: "成功$", right: true },
        { l: "失败$", right: true },
        { l: "小额笔数%", right: true },
        { l: "广告金额%", right: true },
      ],
      udec.map(function (u) {
        return [
          dot("danger") + esc(u.user),
          esc(u.accts),
          esc(u.chns),
          F().int(u.nSpend),
          F().int(u.nSpendFail),
          F().pct(u.decl, 1),
          F().usd(u.okAmt),
          F().usd(u.failAmt),
          F().pct(u.smallP, 0),
          adsCell(u.adsP),
        ];
      }),
      { maxHeight: "480px" }
    );
    html += caption("用户维度 · 消费失败/消费 ≥" + F().pct(th.decline, 0) + " 且消费≥" + th.userDeclineMinSpend + " · 广告金额% = FACEBK/META/TikTok/Google Ads");

    html += "<h2>退款 ≥" + F().pct(th.refund, 0) + " · 用户（当天可归因）</h2>";
    var uref = S.alerts.user_refund.slice().sort(function (a, b) {
      return (b.rAmt || 0) - (a.rAmt || 0) || b.refAmt - a.refAmt;
    });
    html += table(
      [
        { l: "用户ID" },
        { l: "帐户" },
        { l: "成功消费笔", right: true },
        { l: "成功金额", right: true },
        { l: "当天退款笔", right: true },
        { l: "当天退款$", right: true },
        { l: "金额比", right: true },
        { l: "笔数比", right: true },
        { l: "备注" },
      ],
      uref.map(function (u) {
        var tone = u.rAmt != null && u.rAmt >= th.refund * 2 ? "danger" : "warning";
        return [
          dot(tone) + esc(u.user),
          esc(u.accts),
          F().int(u.nSpendOk),
          F().usd(u.okAmt),
          F().int(u.nRef),
          F().usd(u.refAmt),
          rAmtCell(u.rAmt),
          rAmtCell(u.rCnt),
          esc(u.note || ""),
        ];
      })
    );
    html += caption("分子 = 该卡当日有成功消费的退款；跨日退款见下方滚动窗口");

    html += "<h2>跨日退款 · 滚动窗口</h2>";
    html += muted(
      "判定：退款卡在退款当日无成功消费。不计入当天退款比分子，也不用当天成功消费当分母。共 " +
        (S.alerts.roll_refund || S.rollRefunds || []).length +
        " 用户 / " +
        F().int(S.all.nRefRoll || 0) +
        " 笔 / " +
        F().money(S.all.refAmtRoll || 0) +
        "。"
    );
    var rolls = (S.alerts.roll_refund || S.rollRefunds || []).slice().sort(function (a, b) {
      return b.refAmtRoll - a.refAmtRoll;
    });
    html += table(
      [
        { l: "用户ID" },
        { l: "帐户" },
        { l: "通道" },
        { l: "滚动笔数", right: true },
        { l: "滚动金额", right: true },
        { l: "当天成功笔", right: true },
        { l: "当天成功$", right: true },
        { l: "当天可归因退款$", right: true },
        { l: "备注" },
      ],
      rolls.map(function (u) {
        return [
          dot("info") + esc(u.user),
          esc(u.accts),
          esc(u.chns),
          F().int(u.nRefRoll),
          F().usd(u.refAmtRoll),
          F().int(u.nSpendOk),
          F().usd(u.okAmt),
          F().usd(u.refAmt),
          esc(u.note || ""),
        ];
      }),
      { maxHeight: "360px" }
    );
    if (S.rollCards && S.rollCards.length) {
      html += "<h3>滚动窗口 · 卡明细（金额头部）</h3>";
      html += table(
        [
          { l: "卡号" },
          { l: "用户" },
          { l: "通道" },
          { l: "笔数", right: true },
          { l: "金额", right: true },
          { l: "日期" },
          { l: "商户" },
        ],
        S.rollCards.slice(0, 40).map(function (c) {
          return [
            esc(c.cardMask),
            esc(c.user),
            esc(c.chns),
            F().int(c.nRefRoll),
            F().usd(c.refAmtRoll),
            esc(c.date),
            esc(c.merchants || ""),
          ];
        }),
        { maxHeight: "320px" }
      );
      html += caption("同一卡号 · 退款当日该卡无成功消费 · 共 " + S.rollCards.length + " 张");
    }
    html += "</div>";
    return html;
  }

  function renderBook(S) {
    var th = S.th;
    var html = '<div class="stack stack-16">';
    html += "<h2>通道 × 帐户名 全量（当天）</h2>";
    html += muted("统计主键是通道 × 帐户名。「default」不能当单一通道看，它会跨多个 api类型。");
    html += table(
      [
        { l: "通道" },
        { l: "帐户名" },
        { l: "总笔", right: true },
        { l: "消费", right: true },
        { l: "失败", right: true },
        { l: "拒付率", right: true },
        { l: "成功$", right: true },
        { l: "失败$", right: true },
        { l: "退款$", right: true },
        { l: "退款金额比", right: true },
        { l: "退款笔数比", right: true },
        { l: "小额笔%", right: true },
        { l: "广告$%", right: true },
      ],
      S.books.map(function (b) {
        var tone = b.decl >= th.decline || (b.rAmt != null && b.rAmt >= th.refund) ? "danger" : b.decl >= th.decline * 0.75 ? "warning" : "";
        return [
          (tone ? dot(tone) : "") + esc(b.chn),
          esc(b.acct),
          F().int(b.n),
          F().int(b.nSpend),
          F().int(b.nSpendFail),
          F().pct(b.decl, 1),
          F().usd(b.okAmt),
          F().usd(b.failAmt),
          F().usd(b.refAmt),
          rAmtCell(b.rAmt),
          rAmtCell(b.rCnt),
          F().pct(b.smallP, 0),
          adsCell(b.adsP),
        ];
      })
    );
    html += caption("红 ≥" + F().pct(th.decline, 0) + " 拒付或退款≥" + F().pct(th.refund, 0) + " · 黄 近线拒付 · 金额 USD");

    html += "<h3>帐户名汇总（文档主键，通道已混合）</h3>";
    html += table(
      [
        { l: "帐户名" },
        { l: "总笔", right: true },
        { l: "用户", right: true },
        { l: "卡", right: true },
        { l: "消费拒付率", right: true },
        { l: "成功$", right: true },
        { l: "失败$", right: true },
        { l: "退款$", right: true },
        { l: "退款金额比", right: true },
      ],
      S.accts.map(function (a) {
        var tone = a.rAmt != null && a.rAmt >= th.refund ? "danger" : "";
        return [
          (tone ? dot(tone) : "") + esc(a.acct),
          F().int(a.n),
          F().int(a.nUsers),
          F().int(a.nCards),
          F().pct(a.decl, 1),
          F().usd(a.okAmt),
          F().usd(a.failAmt),
          F().usd(a.refAmt),
          rAmtCell(a.rAmt),
        ];
      })
    );
    html += caption("按帐户名加总 · default 可能覆盖多个 api类型");
    html += "</div>";
    return html;
  }

  function renderUser(S) {
    var th = S.th;
    var top = S.users.slice(0, 12);
    var html = '<div class="stack stack-16">';
    html += "<h2>用户头寸 · 成功消费金额 Top 12</h2>";
    html += table(
      [
        { l: "用户ID" },
        { l: "成功$", right: true },
        { l: "成功笔", right: true },
        { l: "失败$", right: true },
        { l: "拒付率", right: true },
        { l: "广告$%", right: true },
        { l: "小额笔%", right: true },
        { l: "退款$", right: true },
        { l: "状态" },
      ],
      top.map(function (u) {
        var flagged = (u.nSpend >= th.userDeclineMinSpend && u.decl >= th.decline) || (u.rAmt != null && u.rAmt >= th.refund);
        return [
          (flagged ? dot("danger") : "") + esc(u.user),
          F().usd(u.okAmt),
          F().int(u.nSpendOk),
          F().usd(u.failAmt),
          F().pct(u.decl, 1),
          adsCell(u.adsP),
          F().pct(u.smallP, 0),
          F().usd(u.refAmt),
          esc(u.statusLabel),
        ];
      })
    );
    html += caption("用户成功消费金额 Top 12 · 红=拒付≥" + F().pct(th.decline, 0) + " 或 退款≥" + F().pct(th.refund, 0));

    html += "<h2>账户 × 用户 拒付越线（消费 ≥" + th.accountUserMinSpend + "）</h2>";
    html += table(
      [
        { l: "帐户名" },
        { l: "用户ID" },
        { l: "通道" },
        { l: "消费", right: true },
        { l: "失败", right: true },
        { l: "拒付率", right: true },
        { l: "成功$", right: true },
        { l: "失败$", right: true },
      ],
      S.accountUsers.map(function (u) {
        return [
          dot("danger") + esc(u.acct),
          esc(u.user),
          esc(u.chns),
          F().int(u.nSpend),
          F().int(u.nSpendFail),
          F().pct(u.decl, 1),
          F().usd(u.okAmt),
          F().usd(u.failAmt),
        ];
      }),
      { maxHeight: "360px" }
    );
    html += caption("帐户名 × 用户 id · 消费≥" + th.accountUserMinSpend + " 且拒付≥" + F().pct(th.decline, 0) + " · 共 " + S.accountUsers.length + " 条");

    var usPct = S.all.okAmt ? (S.countries.filter(function (c) { return c.label === "US"; })[0] || { v: 0 }).v / S.all.okAmt : 0;
    var blank = S.countries.filter(function (c) { return c.label === "(blank)"; })[0];
    html += callout(
      "info",
      "用户国家 / 币种",
      "成功消费金额 " +
        F().pct(usPct, 0) +
        " 落在商户国家 US" +
        (blank ? "。空白国家 " + F().money(blank.v) : "") +
        "。账户币种按「币种」列折美元。当天商户国家 ≥3 的用户 " +
        S.nCty3 +
        " 人" +
        (S.maxCtyUser ? "，最多 " + S.maxCtyUser.user + "（" + S.maxCtyUser.nCty + " 国）" : "") +
        "。"
    );
    html += "</div>";
    return html;
  }

  function renderCard(S) {
    var th = S.th;
    var dual = S.alerts.card_dual_topup.slice().sort(function (a, b) {
      return b.nTopup - a.nTopup || b.topupAmt - a.topupAmt;
    });
    var onlyN = S.alerts.card_count_only.slice().sort(function (a, b) {
      return b.nTopup - a.nTopup || b.topupAmt - a.topupAmt;
    });
    var onlyF = S.alerts.card_fast_only.slice().sort(function (a, b) {
      return (a.minGap || 9e9) - (b.minGap || 9e9);
    });
    var decl = S.alerts.card_decline.slice().sort(function (a, b) {
      return b.failAmt - a.failAmt;
    });

    var html = '<div class="stack stack-18">';
    html += callout(
      "danger",
      "单卡转入 · 同时命中「当天&gt;" + th.cardTopupCount + "次」且「间隔&lt;" + th.intervalSec + "秒」",
      dual.length +
        " 张。跨卡、同一用户 " +
        th.intervalSec +
        " 秒内给多张卡充值，记在「群充」页，不并进这张单卡表。"
    );
    html += "<h2>转入双规则同时命中</h2>";
    html += table(
      [
        { l: "卡号" },
        { l: "用户" },
        { l: "通道" },
        { l: "转入次数", right: true },
        { l: "转入金额", right: true },
        { l: "最小间隔", right: true },
        { l: "快充间隔数", right: true },
        { l: "最长连充", right: true },
        { l: "时段" },
      ],
      dual.map(function (c) {
        return [
          dot("danger") + esc(c.cardMask),
          esc(c.user),
          esc(c.chns),
          F().int(c.nTopup),
          F().usd(c.topupAmt),
          F().dur(c.minGap),
          F().int(c.fastN),
          F().int(c.maxStreak),
          esc(c.span),
        ];
      })
    );
    html += caption("同一卡号 · 转入次数&gt;" + th.cardTopupCount + " 且存在相邻间隔&lt;" + th.intervalSec + " 秒");

    html += "<h2>当天转入 &gt;" + th.cardTopupCount + " 次（未快充的 " + onlyN.length + " 张）</h2>";
    html += muted("间隔均 ≥" + th.intervalSec + " 秒，更像反复补额度，不像脚本连充。");
    html += table(
      [
        { l: "卡号" },
        { l: "用户" },
        { l: "通道" },
        { l: "次数", right: true },
        { l: "金额", right: true },
        { l: "最小间隔", right: true },
        { l: "时段" },
      ],
      onlyN.slice(0, 24).map(function (c) {
        return [
          dot("warning") + esc(c.cardMask),
          esc(c.user),
          esc(c.chns),
          F().int(c.nTopup),
          F().usd(c.topupAmt),
          F().dur(c.minGap),
          esc(c.span),
        ];
      }),
      { maxHeight: "320px" }
    );
    html += caption("转入&gt;" + th.cardTopupCount + " 且最小间隔≥" + th.intervalSec + " 秒 · 共 " + onlyN.length + " 张");

    html += "<h2>间隔 &lt;" + th.intervalSec + " 秒（当天次数 ≤" + th.cardTopupCount + "）</h2>";
    html += callout("warning", "跨卡连充 · 规则盲区", "单卡次数可以不到 " + (th.cardTopupCount + 1) + "，按单卡规则不会进次数表，但账户层可能是群充。见「群充」页。");
    html += table(
      [
        { l: "卡号" },
        { l: "用户" },
        { l: "通道" },
        { l: "次数", right: true },
        { l: "金额", right: true },
        { l: "最小间隔", right: true },
      ],
      onlyF.map(function (c) {
        return [esc(c.cardMask), esc(c.user), esc(c.chns), F().int(c.nTopup), F().usd(c.topupAmt), F().dur(c.minGap)];
      }),
      { maxHeight: "280px" }
    );
    html += caption("相邻转入间隔&lt;" + th.intervalSec + " 秒且当天次数≤" + th.cardTopupCount + " · 共 " + onlyF.length + " 张");

    html += "<h2>单卡消费拒付 ≥" + F().pct(th.decline, 0) + "（消费 ≥" + th.cardDeclineMinSpend + "，按失败金额）</h2>";
    html += muted(decl.length + " 张。paused 卡上的重试风暴会同时抬高用户拒付率和通道拒付率。");
    html += table(
      [
        { l: "卡号" },
        { l: "用户" },
        { l: "通道" },
        { l: "消费", right: true },
        { l: "失败", right: true },
        { l: "拒付率", right: true },
        { l: "失败$", right: true },
        { l: "主因" },
      ],
      decl.slice(0, 30).map(function (c) {
        return [
          dot("danger") + esc(c.cardMask),
          esc(c.user),
          esc(c.chns),
          F().int(c.nSpend),
          F().int(c.nSpendFail),
          F().pct(c.decl, 1),
          F().usd(c.failAmt),
          esc(c.mainFailNote || c.mainFail || ""),
        ];
      }),
      { maxHeight: "360px" }
    );
    html += caption("单卡消费失败/消费 ≥" + F().pct(th.decline, 0) + " 且消费≥" + th.cardDeclineMinSpend + " · " + decl.length + " 张中失败金额头部");
    html += "</div>";
    return html;
  }

  function renderBurst(S) {
    var th = S.th;
    var burstAmt = S.bursts.reduce(function (s, c) {
      return s + c.amt;
    }, 0);
    var burstN = S.bursts.reduce(function (s, c) {
      return s + c.n;
    }, 0);
    var html = '<div class="stack stack-18">';
    html += callout(
      "danger",
      "群充规则（与单卡分开）",
      "同一用户、转入按时间排序，相邻间隔 &lt;" +
        th.intervalSec +
        " 秒归为一簇；簇内卡数 ≥" +
        th.burstMinCards +
        " 即记一笔群充。当天 " +
        S.burstUsers.length +
        " 用户、" +
        S.bursts.length +
        " 簇、" +
        F().int(burstN) +
        " 笔、金额 " +
        F().money(burstAmt) +
        "。单卡次数可以不到 " +
        (th.cardTopupCount + 1) +
        "，只要跨卡连充就会进这张表。"
    );
    html +=
      '<div class="grid g4">' +
      stat(String(S.burstUsers.length), "群充用户", "tone-danger") +
      stat(String(S.bursts.length), "群充簇") +
      stat(F().int(burstN), "簇内转入笔") +
      stat(F().money(burstAmt), "簇内转入金额") +
      "</div>";
    html += "<h2>最大簇</h2>";
    html += table(
      [
        { l: "用户ID" },
        { l: "簇内笔数", right: true },
        { l: "卡数", right: true },
        { l: "金额", right: true },
        { l: "窗口", right: true },
        { l: "最小间隔", right: true },
        { l: "时段" },
        { l: "通道" },
      ],
      S.bursts.slice(0, 20).map(function (c) {
        return [
          dot(c.tone) + esc(c.user),
          F().int(c.n),
          F().int(c.nCards),
          F().usd(c.amt),
          Math.round(c.window) + "s",
          Math.round(c.minGap) + "s",
          esc(c.span),
          esc(c.chns),
        ];
      }),
      { maxHeight: "360px" }
    );
    html += caption("群充簇 · 按卡数、金额排序的前 20 · 窗口=首末转入间隔");

    html += "<h2>用户汇总 · 全量 " + S.burstUsers.length + " 人</h2>";
    html += table(
      [
        { l: "用户ID" },
        { l: "簇数", right: true },
        { l: "簇内笔数", right: true },
        { l: "单簇最多卡", right: true },
        { l: "群充金额", right: true },
        { l: "最小间隔", right: true },
        { l: "通道" },
      ],
      S.burstUsers.map(function (u) {
        return [
          (u.tone ? dot(u.tone) : "") + esc(u.user),
          F().int(u.nClusters),
          F().int(u.n),
          F().int(u.maxCards),
          F().usd(u.amt),
          Math.round(u.minGap) + "s",
          esc(u.chns),
        ];
      }),
      { maxHeight: "480px" }
    );
    html += caption("用户汇总 · 群充金额 = 各簇转入金额之和 · 红=金额≥$5k 或单簇≥10 卡");
    html += "</div>";
    return html;
  }

  function renderMcc(S) {
    var th = S.th;
    var all = S.all;
    var mccBars = S.mcc
      .slice()
      .sort(function (a, b) {
        return b.n - a.n;
      })
      .slice(0, 8)
      .map(function (m) {
        return { label: m.mcc, v: m.n, right: String(m.n), color: "#3d8fd1" };
      });
    var html = '<div class="stack stack-16">';
    html +=
      '<div class="grid g3">' +
      stat(F().pct(all.adsP), "广告成功金额占比") +
      stat(F().pct(all.adsPn), "广告成功笔数占比") +
      stat(F().int(S.facebkSpendN), "FACEBK 消费笔数") +
      "</div>";
    html += muted(
      "广告 = FACEBOOK / META / TIKTOK / FACEBK，以及商户名含 ADS 的 Google。Google One、YouTube、EA Sports、GOOGLE*CHATGPT 记为订阅，不算广告。成功消费 " +
        F().money(all.okAmt) +
        " 中广告 " +
        F().money(all.adsOkAmt) +
        "，非广告 " +
        F().money(all.okAmt - all.adsOkAmt) +
        "。"
    );
    html += " <h2>MCC / 商户簇 · 消费</h2>";
    html += '<div class="chart">' + TX.charts.hbar(mccBars, { color: "#3d8fd1" }) + "</div>";
    html += caption("消费笔数 by 商户簇 · 含失败 · Google Ads 与 Google 订阅拆开");
    html += table(
      [
        { l: "商户簇" },
        { l: "消费笔", right: true },
        { l: "成功笔", right: true },
        { l: "失败笔", right: true },
        { l: "笔数占比", right: true },
        { l: "成功金额", right: true },
        { l: "金额占比", right: true },
        { l: "失败金额", right: true },
      ],
      S.mcc
        .slice()
        .sort(function (a, b) {
          return b.okAmt - a.okAmt;
        })
        .map(function (m) {
          return [
            esc(m.mcc),
            F().int(m.n),
            F().int(m.nOk),
            F().int(m.nFail),
            F().pct(m.shareN, 1),
            F().usd(m.okAmt),
            F().pct(m.shareAmt, 1),
            F().usd(m.failAmt),
          ];
        })
    );
    html += caption("消费 · 成功金额占比分母 = " + F().money(all.okAmt) + " · 失败金额已按账户币种折 USD");

    html += " <h2>小额交易（折美元 &lt; " + F().money(th.smallUsd) + "）</h2>";
    html += callout(
      "info",
      "非 USD 先折汇再套阈值",
      "EURUSD " +
        S.fx.EURUSD +
        "、USDINR " +
        S.fx.USDINR +
        "。USD 账户上的 PHP/TWD 等「金额」已是 USD，不再折。净结果 " +
        F().int(all.smallN) +
        " 笔（笔数占比 " +
        F().pct(all.smallP) +
        "，金额占比 " +
        F().pct(all.smallAmtP) +
        "）。"
    );
    html +=
      '<div class="grid g3">' +
      stat(F().int(all.smallN), "小额消费笔") +
      stat(F().pct(all.smallP), "占消费笔数", "tone-warning") +
      stat(F().pct(all.smallAmtP), "占消费金额") +
      "</div>";
    html += muted("小额只按美元阈值定义，不再另设用户占比门槛。下表是消费≥20 且全部为小额的头部结构，不是额外越线名单。");
    html += table(
      [
        { l: "用户ID" },
        { l: "消费笔", right: true },
        { l: "小额笔", right: true },
        { l: "小额笔%", right: true },
        { l: "成功金额", right: true },
        { l: "小额金额%", right: true },
      ],
      S.smallUsers.slice(0, 10).map(function (u) {
        return [esc(u.user), F().int(u.nSpend), F().int(u.smallN), F().pct(u.smallP, 0), F().usd(u.okAmt), F().pct(u.smallAmtP, 0)];
      })
    );
    html += caption("消费折美元 &lt;" + F().money(th.smallUsd) + " · 消费≥20 且小额笔数 100% 的用户头部（结构参考，非阈值表）");

    html += "<h3>商户国家 · 成功消费金额</h3>";
    html += '<div class="chart">' + TX.charts.vbar(S.countries.slice(0, 8), { yKind: "usdk" }) + "</div>";
    html += caption("成功消费折 USD by 商户国家");
    html += "</div>";
    return html;
  }

  function renderFoot(S) {
    return (
      '<hr class="hr"/>' +
      '<p class="ghost">Source: ' +
      esc(S.fileName || "xlsx") +
      " · 记录时间 " +
      esc(S.dateLabel) +
      " · 金额=账户币种折 USD（EURUSD " +
      S.fx.EURUSD +
      " / USDINR " +
      S.fx.USDINR +
      "） · 规则 v" +
      esc(S.version) +
      "</p>" +
      '<details class="meth"><summary>计算口径</summary><div class="body">' +
      "<p>拒付 = 交易失败。消费拒付率分母为全部消费笔（含已取消 " +
      F().int(S.all.nCancel) +
      "、待处理 " +
      F().int(S.all.nPending) +
      "，不去掉）。全量失败/全量笔 = " +
      F().pct(S.all.declAll) +
      "，消费口径 " +
      F().pct(S.all.decl) +
      "。</p>" +
      "<p>金额用「金额」绝对值，再按账户币种折 USD。USD 账户的外币交易（PHP/TWD 等）金额本身已是 USD，不再折。未用「净金额」。</p>" +
      "<p>小额：折美元后 abs &lt; " +
      F().money(S.th.smallUsd) +
      " 的消费。退款仅交易类型=退款。已取消正金额未计入退款。</p>" +
      "<p>跨日退款：该卡在退款当日无成功消费 → 记入滚动窗口，不进当天退款比分子，也不用当天成功消费当分母。当天退款比分子仅含「该卡当日有成功消费」的退款。滚动 " +
      F().int(S.all.nRefRoll || 0) +
      " 笔 / " +
      F().money(S.all.refAmtRoll || 0) +
      "。</p>" +
      "<p>广告：FACEBOOK / META / TIKTOK / FACEBK + 商户名含 ADS 的 Google。其余 Google 记订阅。群充：同一用户相邻转入 &lt;" +
      S.th.intervalSec +
      " 秒且跨 ≥" +
      S.th.burstMinCards +
      " 张卡；与单卡 &gt;" +
      S.th.cardTopupCount +
      " 次 / 快充规则分表。卡号一律掩码。</p>" +
      "</div></details>"
    );
  }
})(typeof window !== "undefined" ? window : globalThis);
