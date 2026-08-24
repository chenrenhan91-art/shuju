(function (g) {
  var TX = (g.TX = g.TX || {});

  function wallParts(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    var s = d.toLocaleString("sv-SE", { timeZone: TX.TZ || "Asia/Shanghai" });
    var bits = s.replace("T", " ").split(" ");
    var date = bits[0];
    var time = bits[1] || "00:00:00";
    var hm = time.slice(0, 5);
    var hms = time.slice(0, 8);
    var hh = parseInt(time.slice(0, 2), 10) || 0;
    var mm = parseInt(time.slice(3, 5), 10) || 0;
    var ss = parseInt(time.slice(6, 8), 10) || 0;
    return { date: date, time: time, hm: hm, hms: hms, hh: hh, mm: mm, ss: ss };
  }

  function parseTime(v) {
    if (v == null || v === "") return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    if (typeof v === "number" && isFinite(v)) {
      var ms = Math.round((v - 25569) * 86400 * 1000);
      var utc = new Date(ms);
      return new Date(
        utc.getUTCFullYear(),
        utc.getUTCMonth(),
        utc.getUTCDate(),
        utc.getUTCHours(),
        utc.getUTCMinutes(),
        utc.getUTCSeconds()
      );
    }
    if (typeof v === "string") {
      var t = v.trim().replace("T", " ");
      var m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
      if (m) {
        return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
      }
      var d = new Date(v);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  function mapRow(raw) {
    var out = {};
    Object.keys(raw).forEach(function (k) {
      out[TX.resolveHeader(k)] = raw[k];
    });
    return out;
  }

  TX.readExcel = function (arrayBuffer) {
    if (typeof XLSX === "undefined") throw new Error("缺少本地表格解析库 vendor/xlsx.full.min.js");
    var wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, cellNF: false, cellText: false });
    if (!wb.SheetNames || !wb.SheetNames.length) throw new Error("Excel 里没有工作表");
    var name = wb.SheetNames.indexOf("数据") >= 0 ? "数据" : wb.SheetNames[0];
    var sheet = wb.Sheets[name];
    var rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
    if (!rows.length) throw new Error("工作表「" + name + "」没有数据行");
    return { sheetName: name, rows: rows.map(mapRow) };
  };

  TX.validateColumns = function (rows) {
    var keys = {};
    Object.keys(rows[0] || {}).forEach(function (k) {
      keys[k] = true;
    });
    var miss = TX.REQUIRED_COLUMNS.filter(function (c) {
      return !keys[c];
    });
    if (miss.length) throw new Error("缺少必填列：" + miss.join("、") + "。请使用现有交易记录列名。");
  };

  function blankAgg() {
    return {
      n: 0,
      nFailAll: 0,
      nSpend: 0,
      nSpendOk: 0,
      nSpendFail: 0,
      nRef: 0,
      nRefRoll: 0,
      nTopup: 0,
      nWithdraw: 0,
      nAuth: 0,
      nCancel: 0,
      nPending: 0,
      nCancelPos: 0,
      cancelAbs: 0,
      pendingAbs: 0,
      okAmt: 0,
      failAmt: 0,
      refAmt: 0,
      refAmtRoll: 0,
      topupAmt: 0,
      wdAmt: 0,
      spendAmt: 0,
      smallN: 0,
      smallAmt: 0,
      adsOkAmt: 0,
      adsOkN: 0,
      users: {},
      cards: {},
      chnN: {},
      acctN: {},
      ctyN: {},
      ctySpend: {},
    };
  }

  function bumpSet(obj, k) {
    if (!k) return;
    obj[k] = (obj[k] || 0) + 1;
  }

  function addTo(a, r) {
    a.n++;
    bumpSet(a.users, r.user);
    bumpSet(a.cards, r.card);
    bumpSet(a.chnN, r.chn);
    bumpSet(a.acctN, r.acct);
    if (r.status === "交易失败") a.nFailAll++;
    if (r.status === "已取消") {
      a.nCancel++;
      a.cancelAbs += r.usd;
      if (r.amt > 0) a.nCancelPos++;
    }
    if (r.status === "待处理") {
      a.nPending++;
      a.pendingAbs += r.usd;
    }
    if (r.type === "消费") {
      a.nSpend++;
      a.spendAmt += r.usd;
      if (r.country) bumpSet(a.ctySpend, r.country);
      if (r.small) {
        a.smallN++;
        a.smallAmt += r.usd;
      }
      if (r.status === "交易成功") {
        a.nSpendOk++;
        a.okAmt += r.usd;
        if (r.ads) {
          a.adsOkAmt += r.usd;
          a.adsOkN++;
        }
        if (r.country) bumpSet(a.ctyN, r.country);
        else bumpSet(a.ctyN, "(blank)");
      }
      if (r.status === "交易失败") {
        a.nSpendFail++;
        a.failAmt += r.usd;
      }
    } else if (r.type === "退款") {
      // 仅「交易类型=退款」；已取消正金额不走这里。
      // 跨日退款（该卡当天无成功消费）进滚动窗口，不进当天退款比分子。
      if (r.roll) {
        a.nRefRoll++;
        a.refAmtRoll += r.usd;
      } else {
        a.nRef++;
        a.refAmt += r.usd;
      }
    } else if (r.type === "转入") {
      a.nTopup++;
      a.topupAmt += r.usd;
    } else if (r.type === "转出") {
      a.nWithdraw++;
      a.wdAmt += r.usd;
    } else if (r.type === "验证") {
      a.nAuth++;
    }
  }

  function nKeys(obj) {
    return Object.keys(obj).length;
  }

  function joinTop(obj, mapFn, sep) {
    sep = sep || " / ";
    return Object.keys(obj)
      .sort(function (a, b) {
        return obj[b] - obj[a];
      })
      .map(mapFn || function (x) { return x; })
      .join(sep);
  }

  function acctLabel(obj) {
    var keys = Object.keys(obj);
    if (keys.length === 1) return keys[0];
    var hasDef = keys.indexOf("default") >= 0;
    var others = keys.filter(function (k) {
      return k !== "default";
    });
    if (hasDef && others.length) return others.join("+") + "+def";
    return keys.join("+");
  }

  function finalize(a) {
    a.nUsers = nKeys(a.users);
    a.nCards = nKeys(a.cards);
    a.decl = a.nSpend ? a.nSpendFail / a.nSpend : 0;
    // 当天退款比：分子只用当天可归因退款（该卡当天有成功消费）；跨日进滚动窗口。
    a.rAmt = a.okAmt > 0 ? a.refAmt / a.okAmt : 0;
    a.rCnt = a.nSpendOk > 0 ? a.nRef / a.nSpendOk : 0;
    a.nRefAll = a.nRef + a.nRefRoll;
    a.refAmtAll = a.refAmt + a.refAmtRoll;
    a.smallP = a.nSpend ? a.smallN / a.nSpend : 0;
    a.smallAmtP = a.spendAmt ? a.smallAmt / a.spendAmt : 0;
    a.adsP = a.okAmt > 0 ? a.adsOkAmt / a.okAmt : null;
    a.adsPn = a.nSpendOk > 0 ? a.adsOkN / a.nSpendOk : null;
    a.chns = joinTop(a.chnN, TX.shortChn);
    a.accts = acctLabel(a.acctN);
    return a;
  }

  function toneDecl(decl, th) {
    if (decl >= th.decline) return "danger";
    if (decl >= th.decline * 0.75) return "warning";
    return "";
  }

  function toneBurst(b) {
    if (b.amt >= 5000 || b.nCards >= 10) return "danger";
    if (b.nCards >= 6 || b.amt >= 1000) return "warning";
    return "info";
  }

  function topReason(counter) {
    var best = "";
    var n = -1;
    Object.keys(counter).forEach(function (k) {
      if (counter[k] > n) {
        n = counter[k];
        best = k;
      }
    });
    return best;
  }

  function noteRefund(g) {
    var names = g.refMerchants || [];
    var openai = names.filter(function (n) {
      return /OPENAI|CHATGPT/i.test(n);
    }).length;
    if (names.length && openai / names.length >= 0.5) return "OpenAI 订阅退款簇";
    var hotel = names.filter(function (n) {
      return /HOTEL|BOOKING|AIRBNB|HILTON|MARRIOTT|酒店/i.test(n);
    });
    if (hotel.length) return "含酒店等";
    if (g.nRefRoll > 0 && g.nRef === 0) return "仅有跨日退款（已进滚动窗口）";
    if (g.nRefRoll > 0) return "另有跨日退款 " + TX.fmt.money(g.refAmtRoll) + " 进滚动窗口";
    if (names[0]) return names[0].slice(0, 28);
    return "";
  }

  function userStatus(u, th) {
    if (u.okAmt > 0 && u.rAmt != null && u.rAmt >= th.refund) return "退款越线";
    if (u.nSpend >= th.userDeclineMinSpend && u.decl >= th.decline) return "拒付越线";
    if ((u.adsP || 0) >= 0.95 && u.decl < th.decline) return "广告核心 · 干净";
    if (u.failAmt > u.okAmt * 0.3 && u.decl < th.decline) return "失败金额高但未破阈值";
    return "干净";
  }

  TX.normalizeRows = function (rawRows, fx, th) {
    fx = fx || TX.DEFAULT_FX;
    th = th || TX.DEFAULT_THRESHOLDS;
    var rows = [];
    var skipped = 0;
    rawRows.forEach(function (raw, i) {
      var t = parseTime(raw["记录时间"]);
      if (!t) {
        skipped++;
        return;
      }
      var wall = wallParts(t);
      var amt = TX.num(raw["金额"]);
      var usd = TX.toUsd(Math.abs(amt), raw["币种"], fx);
      var merchant = TX.str(raw["商户名称"]);
      var entity = TX.str(raw["商户主体名"]);
      var type = TX.str(raw["交易类型"]);
      var status = TX.str(raw["交易状态"]);
      var r = {
        i: i,
        id: TX.idStr(raw["id"]),
        user: TX.idStr(raw["用户 id"]),
        card: TX.cardStr(raw["卡号"]) || TX.idStr(raw["卡片 id"]),
        cardId: TX.idStr(raw["卡片 id"]),
        chn: TX.str(raw["api类型"]) || "—",
        acct: TX.str(raw["帐户名"]) || "—",
        t: t,
        ts: t.getTime(),
        wall: wall,
        date: wall ? wall.date : "",
        hh: wall ? wall.hh : 0,
        hm: wall ? wall.hm : "",
        ccy: TX.str(raw["币种"]),
        amt: amt,
        usd: usd,
        type: type,
        status: status,
        merchant: merchant,
        entity: entity,
        country: TX.str(raw["商户国家"]),
        reason: TX.str(raw["失败原因"]),
        ads: TX.isAds(merchant, entity),
        mcc: TX.mccCluster(merchant, entity),
        failB: status === "交易失败" ? TX.failBucket(raw["失败原因"]) : "",
        small: type === "消费" && usd < th.smallUsd,
      };
      r.cardMask = TX.maskCard(r.card);
      r.book = r.chn + " | " + r.acct;
      rows.push(r);
    });
    return { rows: rows, skipped: skipped };
  };

  function groupBy(rows, keyFn) {
    var m = {};
    rows.forEach(function (r) {
      var k = keyFn(r);
      if (!m[k]) m[k] = [];
      m[k].push(r);
    });
    return m;
  }

  function aggRows(list) {
    var a = blankAgg();
    a.refMerchants = [];
    a.rollMerchants = [];
    a.failReasons = {};
    list.forEach(function (r) {
      addTo(a, r);
      if (r.type === "退款" && !r.roll) a.refMerchants.push(r.merchant);
      if (r.type === "退款" && r.roll) a.rollMerchants.push(r.merchant);
      if (r.status === "交易失败") bumpSet(a.failReasons, r.reason || "(empty)");
    });
    finalize(a);
    a.mainFail = topReason(a.failReasons);
    a.note = noteRefund(a);
    return a;
  }

  function cardTopupStats(list, th) {
    var top = list
      .filter(function (r) {
        return r.type === "转入";
      })
      .sort(function (a, b) {
        return a.ts - b.ts;
      });
    var n = top.length;
    var amt = 0;
    top.forEach(function (r) {
      amt += r.usd;
    });
    var minGap = null;
    var fastN = 0;
    var streak = 1;
    var best = n ? 1 : 0;
    for (var i = 1; i < n; i++) {
      var g = (top[i].ts - top[i - 1].ts) / 1000;
      if (minGap == null || g < minGap) minGap = g;
      if (g < th.intervalSec) {
        fastN++;
        streak++;
        if (streak > best) best = streak;
      } else {
        streak = 1;
      }
    }
    var span = "";
    if (n) span = top[0].hm + "–" + top[n - 1].hm;
    return {
      nTopup: n,
      topupAmt: amt,
      minGap: minGap,
      fastN: fastN,
      hasFast: fastN > 0,
      maxStreak: best,
      span: span,
    };
  }

  function burstClusters(rows, th) {
    var byUser = groupBy(
      rows.filter(function (r) {
        return r.type === "转入";
      }),
      function (r) {
        return r.user;
      }
    );
    var clusters = [];
    Object.keys(byUser).forEach(function (uid) {
      var list = byUser[uid].slice().sort(function (a, b) {
        return a.ts - b.ts;
      });
      var cur = [];
      function flush() {
        if (cur.length < 2) {
          cur = [];
          return;
        }
        var cards = {};
        var amt = 0;
        var chnN = {};
        var minGap = null;
        for (var i = 0; i < cur.length; i++) {
          bumpSet(cards, cur[i].card);
          amt += cur[i].usd;
          bumpSet(chnN, cur[i].chn);
          if (i) {
            var g = (cur[i].ts - cur[i - 1].ts) / 1000;
            if (minGap == null || g < minGap) minGap = g;
          }
        }
        var nCards = nKeys(cards);
        if (nCards >= th.burstMinCards) {
          clusters.push({
            user: uid,
            n: cur.length,
            nCards: nCards,
            amt: amt,
            window: (cur[cur.length - 1].ts - cur[0].ts) / 1000,
            minGap: minGap,
            span: cur[0].hm + "–" + cur[cur.length - 1].hm,
            chnN: chnN,
            chns: joinTop(chnN, TX.shortChn),
            date: cur[0].date,
          });
        }
        cur = [];
      }
      list.forEach(function (r) {
        if (!cur.length) {
          cur = [r];
          return;
        }
        var gap = (r.ts - cur[cur.length - 1].ts) / 1000;
        if (gap < th.intervalSec) cur.push(r);
        else {
          flush();
          cur = [r];
        }
      });
      flush();
    });
    clusters.forEach(function (c) {
      c.tone = toneBurst(c);
    });
    clusters.sort(function (a, b) {
      return b.nCards - a.nCards || b.amt - a.amt;
    });
    return clusters;
  }

  TX.analyze = function (rawRows, opts) {
    opts = opts || {};
    var th = Object.assign({}, TX.DEFAULT_THRESHOLDS, opts.thresholds || {});
    var fx = Object.assign({}, TX.DEFAULT_FX, opts.fx || {});
    TX.validateColumns(rawRows);
    var norm = TX.normalizeRows(rawRows, fx, th);
    var rows = norm.rows;
    if (!rows.length) throw new Error("没有可解析的记录时间，无法统计");

    // 跨日退款判定：该卡在退款当日无成功消费 → 滚动窗口（不算进当天成功消费分母上的退款比）
    var cardOkDate = {};
    rows.forEach(function (r) {
      if (r.type === "消费" && r.status === "交易成功" && r.card && r.date) {
        cardOkDate[r.card + "\t" + r.date] = true;
      }
    });
    rows.forEach(function (r) {
      if (r.type === "退款") {
        r.roll = !(r.card && r.date && cardOkDate[r.card + "\t" + r.date]);
      } else {
        r.roll = false;
      }
    });

    var all = aggRows(rows);
    all.declAll = all.n ? all.nFailAll / all.n : 0;

    var dates = {};
    rows.forEach(function (r) {
      if (r.date) dates[r.date] = true;
    });
    var dateList = Object.keys(dates).sort();
    var dateLabel = dateList.length === 1 ? dateList[0] : dateList[0] + " ~ " + dateList[dateList.length - 1];
    var multiDay = dateList.length > 1;

    var hours = [];
    for (var h = 0; h < 24; h++) {
      hours.push({
        h: h,
        label: String(h).padStart(2, "0"),
        n: 0,
        fail: 0,
        spendOk: 0,
      });
    }
    rows.forEach(function (r) {
      var hh = r.hh;
      if (hh < 0 || hh > 23) return;
      hours[hh].n++;
      if (r.status === "交易失败") hours[hh].fail++;
      if (r.type === "消费" && r.status === "交易成功") hours[hh].spendOk += r.usd;
    });
    hours.forEach(function (x) {
      x.decl = x.n ? x.fail / x.n : 0;
    });

    var typeN = {};
    rows.forEach(function (r) {
      bumpSet(typeN, r.type || "(空)");
    });

    var booksMap = groupBy(rows, function (r) {
      return r.book;
    });
    var books = Object.keys(booksMap).map(function (k) {
      var g = aggRows(booksMap[k]);
      var sample = booksMap[k][0];
      g.chn = sample.chn;
      g.acct = sample.acct;
      g.book = k;
      g.tone = g.decl >= th.decline || (g.rAmt != null && g.rAmt >= th.refund) ? "danger" : toneDecl(g.decl, th);
      return g;
    });
    books.sort(function (a, b) {
      return b.decl - a.decl || b.okAmt - a.okAmt;
    });

    var acctMap = groupBy(rows, function (r) {
      return r.acct;
    });
    var accts = Object.keys(acctMap).map(function (k) {
      var g = aggRows(acctMap[k]);
      g.acct = k;
      g.tone = g.rAmt != null && g.rAmt >= th.refund ? "danger" : toneDecl(g.decl, th);
      return g;
    });
    accts.sort(function (a, b) {
      return b.n - a.n;
    });

    var userMap = groupBy(rows, function (r) {
      return r.user;
    });
    var users = Object.keys(userMap).map(function (uid) {
      var g = aggRows(userMap[uid]);
      g.user = uid;
      g.statusLabel = userStatus(g, th);
      g.tone =
        (g.nSpend >= th.userDeclineMinSpend && g.decl >= th.decline) || (g.okAmt > 0 && g.rAmt >= th.refund)
          ? "danger"
          : "";
      g.nCty = nKeys(g.ctySpend);
      return g;
    });
    users.sort(function (a, b) {
      return b.okAmt - a.okAmt;
    });

    var auMap = groupBy(rows, function (r) {
      return r.acct + "\t" + r.user;
    });
    var accountUsers = Object.keys(auMap)
      .map(function (k) {
        var g = aggRows(auMap[k]);
        var bits = k.split("\t");
        g.acct = bits[0];
        g.user = bits[1];
        g.tone = g.decl >= th.decline ? "danger" : "";
        return g;
      })
      .filter(function (g) {
        return g.nSpend >= th.accountUserMinSpend && g.decl >= th.decline;
      });
    accountUsers.sort(function (a, b) {
      return b.decl - a.decl || b.failAmt - a.failAmt;
    });

    var cardMap = groupBy(rows, function (r) {
      return r.card || r.cardId;
    });
    var cards = [];
    var cardTopups = [];
    Object.keys(cardMap).forEach(function (cid) {
      var list = cardMap[cid];
      var g = aggRows(list);
      var sample = list[0];
      g.card = sample.card;
      g.cardMask = sample.cardMask;
      g.user = sample.user;
      if (nKeys(g.users) > 1) {
        g.user = Object.keys(g.users)
          .sort(function (a, b) {
            return g.users[b] - g.users[a];
          })
          .join(",");
      }
      g.chns = joinTop(g.chnN, TX.shortChn);
      g.accts = acctLabel(g.acctN);
      g.mainFail = g.mainFail || "";
      if (g.nSpendFail >= 20 && /paused/i.test(g.mainFail)) g.mainFailNote = "card paused · 重试风暴";
      else g.mainFailNote = (g.mainFail || "").slice(0, 42);
      g.tone = g.nSpend >= th.cardDeclineMinSpend && g.decl >= th.decline ? "danger" : "";
      cards.push(g);

      var tp = cardTopupStats(list, th);
      if (tp.nTopup >= 2) {
        cardTopups.push({
          card: g.card,
          cardMask: g.cardMask,
          user: g.user,
          chns: g.chns,
          nTopup: tp.nTopup,
          topupAmt: tp.topupAmt,
          minGap: tp.minGap,
          fastN: tp.fastN,
          hasFast: tp.hasFast,
          maxStreak: tp.maxStreak,
          span: tp.span,
        });
      }
    });
    cards.sort(function (a, b) {
      return b.failAmt - a.failAmt;
    });
    cardTopups.sort(function (a, b) {
      return b.nTopup - a.nTopup || b.topupAmt - a.topupAmt;
    });

    var bursts = burstClusters(rows, th);
    var burstUserMap = {};
    bursts.forEach(function (c) {
      if (!burstUserMap[c.user]) {
        burstUserMap[c.user] = {
          user: c.user,
          nClusters: 0,
          n: 0,
          maxCards: 0,
          amt: 0,
          minGap: null,
          chnN: {},
        };
      }
      var u = burstUserMap[c.user];
      u.nClusters++;
      u.n += c.n;
      u.amt += c.amt;
      if (c.nCards > u.maxCards) u.maxCards = c.nCards;
      if (c.minGap != null && (u.minGap == null || c.minGap < u.minGap)) u.minGap = c.minGap;
      Object.keys(c.chnN || {}).forEach(function (k) {
        bumpSet(u.chnN, k);
      });
    });
    var burstUsers = Object.keys(burstUserMap)
      .map(function (uid) {
        var u = burstUserMap[uid];
        u.chns = joinTop(u.chnN, TX.shortChn);
        u.tone = u.amt >= 5000 || u.maxCards >= 10 ? "danger" : u.amt >= 1000 || u.maxCards >= 6 ? "warning" : "";
        return u;
      })
      .sort(function (a, b) {
        return b.amt - a.amt;
      });

    var failB = {};
    rows.forEach(function (r) {
      if (r.status === "交易失败") bumpSet(failB, r.failB || "other");
    });
    var failBuckets = Object.keys(failB)
      .map(function (k) {
        return { id: k, label: TX.failLabel(k), n: failB[k] };
      })
      .sort(function (a, b) {
        return b.n - a.n;
      });

    var mccMap = {};
    rows.forEach(function (r) {
      if (r.type !== "消费") return;
      if (!mccMap[r.mcc]) mccMap[r.mcc] = { mcc: r.mcc, n: 0, nOk: 0, nFail: 0, okAmt: 0, failAmt: 0 };
      var m = mccMap[r.mcc];
      m.n++;
      if (r.status === "交易成功") {
        m.nOk++;
        m.okAmt += r.usd;
      }
      if (r.status === "交易失败") {
        m.nFail++;
        m.failAmt += r.usd;
      }
    });
    var mcc = Object.keys(mccMap)
      .map(function (k) {
        var m = mccMap[k];
        m.shareN = all.nSpend ? m.n / all.nSpend : 0;
        m.shareAmt = all.okAmt ? m.okAmt / all.okAmt : 0;
        return m;
      })
      .sort(function (a, b) {
        return b.okAmt - a.okAmt;
      });

    var cty = Object.keys(all.ctyN)
      .map(function (k) {
        return { label: k, n: all.ctyN[k], v: 0 };
      })
      .sort(function (a, b) {
        return b.n - a.n;
      });
    var ctyAmt = {};
    rows.forEach(function (r) {
      if (r.type === "消费" && r.status === "交易成功") {
        var k = r.country || "(blank)";
        ctyAmt[k] = (ctyAmt[k] || 0) + r.usd;
      }
    });
    var countries = Object.keys(ctyAmt)
      .map(function (k) {
        return { label: k === "" ? "(blank)" : k, v: ctyAmt[k] };
      })
      .sort(function (a, b) {
        return b.v - a.v;
      });

    var smallUsers = users
      .filter(function (u) {
        return u.nSpend >= 20 && u.smallP >= 0.999;
      })
      .sort(function (a, b) {
        return b.nSpend - a.nSpend;
      });

    function clipName(s, n) {
      s = TX.str(s).replace(/\s+/g, " ");
      if (s.length <= n) return s;
      return s.slice(0, n) + "…";
    }

    var spendFails = rows
      .filter(function (r) {
        return r.type === "消费" && r.status === "交易失败";
      })
      .sort(function (a, b) {
        return b.usd - a.usd;
      });
    var hotspots = [];
    var skipFailUser = "";
    if (spendFails[0]) {
      var f = spendFails[0];
      skipFailUser = f.user;
      var mer = clipName(f.merchant, 28);
      var hitTitle = /amazon/i.test(f.merchant) || /amazon/i.test(f.entity) ? "Amazon 单笔击穿" : mer;
      var bk = books.filter(function (b) {
        return b.chn === f.chn && b.acct === f.acct;
      })[0];
      hotspots.push({
        title: TX.shortChn(f.chn) + " · " + hitTitle,
        tag: TX.fmt.money(f.usd) + " fail",
        body:
          "用户 " +
          f.user +
          "，" +
          clipName(f.reason || "", 42) +
          "。" +
          mer +
          " −" +
          TX.fmt.usd(f.usd) +
          "。" +
          (bk ? "该通道当天消费 " + bk.nSpend + " 笔，拒付 " + TX.fmt.pct(bk.decl, 1) + "。" : ""),
      });
    }
    var topFailUser = users
      .slice()
      .sort(function (a, b) {
        return b.failAmt - a.failAmt;
      })
      .filter(function (u) {
        return u.user !== skipFailUser && u.failAmt > 0;
      })[0];
    if (topFailUser) {
      hotspots.push({
        title: "用户 " + topFailUser.user + " · 失败金额第一",
        tag: "DECL " + TX.fmt.pct(topFailUser.decl, 0),
        body:
          "成功 " +
          TX.fmt.money(topFailUser.okAmt) +
          " / 失败 " +
          TX.fmt.money(topFailUser.failAmt) +
          "。通道 " +
          topFailUser.chns +
          "。商户国家 " +
          topFailUser.nCty +
          " 个。",
      });
    }
    var topRefUser = users.slice().sort(function (a, b) {
      return b.refAmt - a.refAmt || b.refAmtRoll - a.refAmtRoll;
    })[0];
    if (topRefUser && (topRefUser.refAmt > 0 || topRefUser.refAmtRoll > 0)) {
      hotspots.push({
        title: (topRefUser.accts || "") + " · 退款簇",
        tag:
          topRefUser.refAmt > 0
            ? "REF " + TX.fmt.pct(topRefUser.rAmt, 1)
            : "ROLL " + TX.fmt.money(topRefUser.refAmtRoll),
        body:
          "用户 " +
          topRefUser.user +
          " 当天可归因退款 " +
          topRefUser.nRef +
          " 笔 " +
          TX.fmt.money(topRefUser.refAmt) +
          "；跨日滚动 " +
          topRefUser.nRefRoll +
          " 笔 " +
          TX.fmt.money(topRefUser.refAmtRoll) +
          "。" +
          (topRefUser.note || ""),
      });
    }

    // 跨日退款 · 滚动窗口：按用户汇总（该卡退款当日无成功消费）
    var rollRefunds = users
      .filter(function (u) {
        return u.nRefRoll > 0;
      })
      .map(function (u) {
        return {
          user: u.user,
          accts: u.accts,
          chns: u.chns,
          nRefRoll: u.nRefRoll,
          refAmtRoll: u.refAmtRoll,
          nSpendOk: u.nSpendOk,
          okAmt: u.okAmt,
          nRef: u.nRef,
          refAmt: u.refAmt,
          note: u.nSpendOk === 0 ? "当天无成功消费" : "部分退款卡当天无成功消费",
        };
      })
      .sort(function (a, b) {
        return b.refAmtRoll - a.refAmtRoll;
      });

    // 卡维度滚动明细（头部）
    var rollCards = [];
    Object.keys(cardMap).forEach(function (cid) {
      var list = cardMap[cid].filter(function (r) {
        return r.type === "退款" && r.roll;
      });
      if (!list.length) return;
      var sample = list[0];
      var amt = 0;
      list.forEach(function (r) {
        amt += r.usd;
      });
      rollCards.push({
        cardMask: sample.cardMask,
        user: sample.user,
        chns: TX.shortChn(sample.chn),
        nRefRoll: list.length,
        refAmtRoll: amt,
        merchants: list
          .map(function (r) {
            return r.merchant;
          })
          .filter(Boolean)
          .slice(0, 2)
          .join(" / "),
        date: sample.date,
      });
    });
    rollCards.sort(function (a, b) {
      return b.refAmtRoll - a.refAmtRoll;
    });

    var alerts = {};
    TX.RULE_DEFS.forEach(function (rule) {
      var dim = {
        books: books,
        users: users,
        cards: cards,
        cardTopups: cardTopups,
        bursts: bursts,
        rollRefunds: rollRefunds,
      }[rule.dim];
      alerts[rule.id] = (dim || []).filter(function (row) {
        return rule.test(row, th);
      });
    });

    var extras = [];
    (TX.extraRules || []).forEach(function (fn) {
      try {
        var x = fn(rows, { th: th, fx: fx, all: all, books: books, users: users, cards: cards, bursts: bursts, rollRefunds: rollRefunds });
        if (x) extras.push(x);
      } catch (e) {}
    });

    var fileMeta = opts.fileName || "";

    return {
      version: TX.RULES_VERSION,
      th: th,
      fx: fx,
      fileName: fileMeta,
      sheetName: opts.sheetName || "",
      dateLabel: dateLabel,
      dateList: dateList,
      multiDay: multiDay,
      skipped: norm.skipped,
      rowsN: rows.length,
      all: all,
      hours: hours,
      typeN: typeN,
      books: books,
      accts: accts,
      users: users,
      accountUsers: accountUsers,
      cards: cards,
      cardTopups: cardTopups,
      bursts: bursts,
      burstUsers: burstUsers,
      rollRefunds: rollRefunds,
      rollCards: rollCards,
      failBuckets: failBuckets,
      mcc: mcc,
      countries: countries,
      smallUsers: smallUsers,
      hotspots: hotspots.slice(0, 3),
      alerts: alerts,
      extras: extras,
      facebkSpendN: rows.filter(function (r) {
        return r.type === "消费" && /FACEBK/i.test(r.merchant);
      }).length,
      nCty3: users.filter(function (u) {
        return u.nCty >= 3;
      }).length,
      maxCtyUser: users.slice().sort(function (a, b) {
        return b.nCty - a.nCty;
      })[0],
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
