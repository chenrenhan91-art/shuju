/**
 * TX DESK 规则与分类。
 *
 * 后期改规则 / 加规则：
 * 1. 改 DEFAULT_THRESHOLDS / DEFAULT_FX —— 页面「高级选项」会覆盖阈值。
 * 2. 改 isAds / mccCluster / failBucket / toUsd —— 分类口径。
 * 3. 在 RULE_DEFS 追加一条 { id, title, dim, test } —— 越线名单自动多一张表。
 * 4. 在 render.js 的 RULE_VIEWS 里为新 id 补表格列（没有视图则只进「异常台账」计数）。
 * 5. 需要全新指标时，把函数挂到 TX.extraRules（analyze 末尾调用）。
 */
(function (g) {
  var TX = (g.TX = g.TX || {});

  TX.RULES_VERSION = "1.1";

  TX.DEFAULT_THRESHOLDS = {
    decline: 0.2,
    refund: 0.1,
    smallUsd: 30,
    cardTopupCount: 3,
    intervalSec: 120,
    userDeclineMinSpend: 5,
    cardDeclineMinSpend: 5,
    burstMinCards: 2,
    accountUserMinSpend: 8,
  };

  TX.DEFAULT_FX = {
    EURUSD: 1.1579,
    USDINR: 95.61,
  };

  TX.TZ = "Asia/Shanghai";

  TX.REQUIRED_COLUMNS = [
    "用户 id",
    "卡号",
    "api类型",
    "记录时间",
    "币种",
    "金额",
    "交易状态",
    "交易类型",
    "商户名称",
    "商户主体名",
    "帐户名",
  ];

  TX.COL_ALIASES = {
    用户id: "用户 id",
    userid: "用户 id",
    用户ID: "用户 id",
    apitype: "api类型",
    api类型: "api类型",
    通道: "api类型",
    账户名: "帐户名",
    账户: "帐户名",
    帐户: "帐户名",
    卡號: "卡号",
    商户名: "商户名称",
    商户: "商户名称",
  };

  TX.CHN_SHORT = {
    s通道: "s通道",
    "2号通道-共享": "2号共享",
    "2号通道": "2号",
    px银行: "px银行",
    香港y通道: "香港y",
    "i银行-共享": "i共享",
    "i银行-储值": "i储值",
    "1号通道": "1号通道",
    "3号通道": "3号通道",
    "3号通道-共享": "3号共享",
  };

  TX.FAIL_LABEL = {
    paused: "Card paused",
    limit: "额度/限额",
    status: "卡状态无效",
    noset: "未设限额",
    invalid: "Invalid card",
    funds: "余额不足",
    cvv: "CVV",
    sys: "系统/未知",
    mcc: "MCC 拦截",
    fraud: "疑似欺诈",
    exp: "有效期",
    empty: "(空)",
    other: "其他",
  };

  TX.normHeader = function (s) {
    return String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  TX.compactHeader = function (s) {
    return TX.normHeader(s).replace(/\s+/g, "").toLowerCase();
  };

  TX.resolveHeader = function (raw) {
    var n = TX.normHeader(raw);
    if (TX.REQUIRED_COLUMNS.indexOf(n) >= 0 || n === "失败原因" || n === "商户国家" || n === "卡片 id" || n === "id" || n === "交易币种") {
      return n;
    }
    var c = TX.compactHeader(raw);
    if (TX.COL_ALIASES[c]) return TX.COL_ALIASES[c];
    if (TX.COL_ALIASES[n]) return TX.COL_ALIASES[n];
    return n;
  };

  TX.str = function (v) {
    if (v == null || v === "") return "";
    if (v instanceof Date) return "";
    return String(v).trim();
  };

  TX.num = function (v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    var n = parseFloat(String(v).replace(/,/g, ""));
    return isFinite(n) ? n : 0;
  };

  TX.idStr = function (v) {
    if (v == null || v === "") return "";
    if (typeof v === "number") {
      if (!isFinite(v)) return "";
      if (Math.abs(v) >= 1e15) return String(Math.round(v));
      return String(Math.trunc(v));
    }
    return String(v).replace(/\.0$/, "").trim();
  };

  TX.cardStr = function (v) {
    var s = TX.idStr(v).replace(/\s+/g, "");
    return s;
  };

  TX.maskCard = function (v) {
    var s = TX.cardStr(v);
    if (!s) return "—";
    if (s.length <= 4) return "····";
    var head = s.slice(0, 4);
    var tail = s.slice(-4);
    return head + " ··· " + tail;
  };

  TX.shortChn = function (chn) {
    var s = TX.str(chn);
    return TX.CHN_SHORT[s] || s;
  };

  TX.toUsd = function (absAmt, accountCcy, fx) {
    var a = Math.abs(Number(absAmt) || 0);
    var c = TX.str(accountCcy).toUpperCase();
    fx = fx || TX.DEFAULT_FX;
    if (c === "EUR") return a * (fx.EURUSD || TX.DEFAULT_FX.EURUSD);
    if (c === "INR") return a / (fx.USDINR || TX.DEFAULT_FX.USDINR);
    return a;
  };

  TX.isAds = function (merchant, entity) {
    var n = TX.str(merchant).toUpperCase();
    var e = TX.str(entity).toUpperCase();
    if (e === "FACEBOOK" || e === "META" || e === "TIKTOK") return true;
    if (n.indexOf("FACEBK") >= 0 || n.indexOf("FACEBOOK") >= 0) return true;
    if (n.indexOf("METAPAY") >= 0) return true;
    if (n.indexOf("TIKTOK") >= 0) return true;
    if (n.indexOf("GOOGLE") >= 0 && /ADS/.test(n)) return true;
    return false;
  };

  TX.isGoogleAds = function (merchant) {
    var n = TX.str(merchant).toUpperCase();
    return n.indexOf("GOOGLE") >= 0 && /ADS/.test(n);
  };

  TX.isGoogleSub = function (merchant, entity) {
    var n = TX.str(merchant).toUpperCase();
    var e = TX.str(entity).toUpperCase();
    if (TX.isGoogleAds(merchant)) return false;
    return n.indexOf("GOOGLE") >= 0 || e === "GOOGLE";
  };

  TX.mccCluster = function (merchant, entity) {
    var n = TX.str(merchant).toUpperCase();
    var e = TX.str(entity).toUpperCase();
    if (TX.isGoogleAds(merchant)) return "Google Ads";
    if (TX.isGoogleSub(merchant, entity)) return "Google 订阅";
    if (n.indexOf("FACEBK") >= 0 || n.indexOf("FACEBOOK") >= 0 || e === "FACEBOOK") return "FACEBK / Facebook";
    if (n.indexOf("METAPAY") >= 0 || e === "META") return "META";
    if (n.indexOf("TIKTOK") >= 0 || e === "TIKTOK") return "TikTok Ads";
    if (n.indexOf("OPENAI") >= 0 || n.indexOf("CHATGPT") >= 0 || e === "OPENAI" || e === "OPEN AI") return "OpenAI";
    if (n.indexOf("ANTHROPIC") >= 0 || n.indexOf("CLAUDE") >= 0) return "Anthropic";
    if (e === "AMAZON" || n.indexOf("AMAZON") >= 0) return "Amazon";
    if (e === "APPLE" || n.indexOf("APPLE") >= 0) return "Apple";
    return "Other";
  };

  TX.failBucket = function (reason) {
    var raw = TX.str(reason);
    if (!raw) return "empty";
    var t = raw.toLowerCase();
    if (t.indexOf("paused") >= 0) return "paused";
    if (
      t.indexOf("spending limit") >= 0 ||
      t.indexOf("exceeded the spending") >= 0 ||
      t.indexOf("amount limit") >= 0 ||
      t.indexOf("限额") >= 0 ||
      t.indexOf("life_time_amount") >= 0 ||
      t.indexOf("payment amount limit") >= 0
    ) {
      return "limit";
    }
    if (t.indexOf("no available transaction amount") >= 0 || t.indexOf("set the limit") >= 0) return "noset";
    if (
      t.indexOf("invalid card status") >= 0 ||
      t.indexOf("卡片状态") >= 0 ||
      t.indexOf("not_activated") >= 0 ||
      t.indexOf("not active") >= 0 ||
      t.indexOf("卡已冻结") >= 0 ||
      t.indexOf("card closed") >= 0
    ) {
      return "status";
    }
    if (t.indexOf("invalid card") >= 0 || t.indexOf("卡片无效") >= 0) return "invalid";
    if (t.indexOf("insufficient") >= 0 || t.indexOf("no sufficient") >= 0 || t.indexOf("余额") >= 0) return "funds";
    if (t.indexOf("cvv") >= 0) return "cvv";
    if (t.indexOf("expiration") >= 0 || t.indexOf("有效期") >= 0) return "exp";
    if (t.indexOf("fraud") >= 0) return "fraud";
    if (t.indexOf("unauthorized mcc") >= 0 || (t.indexOf("mcc") >= 0 && t.indexOf("blocked") >= 0)) return "mcc";
    if (t.indexOf("unknown") >= 0 || t.indexOf("something went wrong") >= 0 || t.indexOf("try again") >= 0) return "sys";
    return "other";
  };

  TX.failLabel = function (bucket) {
    return TX.FAIL_LABEL[bucket] || bucket;
  };

  /**
   * dim 对应 analyze 产出的数组名。
   * test(row, th) 为 true 则进入该规则的越线名单。
   */
  TX.RULE_DEFS = [
    {
      id: "book_decline",
      title: "拒付 ≥ 阈值 · 通道 × 帐户名",
      dim: "books",
      test: function (row, th) {
        return row.nSpend > 0 && row.decl >= th.decline;
      },
    },
    {
      id: "book_refund",
      title: "退款 ≥ 阈值 · 通道 × 帐户名",
      dim: "books",
      test: function (row, th) {
        return row.okAmt > 0 && row.rAmt >= th.refund;
      },
    },
    {
      id: "user_decline",
      title: "拒付 ≥ 阈值 · 用户",
      dim: "users",
      test: function (row, th) {
        return row.nSpend >= th.userDeclineMinSpend && row.decl >= th.decline;
      },
    },
    {
      id: "user_refund",
      title: "退款 ≥ 阈值 · 用户（当天可归因）",
      dim: "users",
      test: function (row, th) {
        return row.okAmt > 0 && row.rAmt >= th.refund;
      },
    },
    {
      id: "roll_refund",
      title: "跨日退款 · 滚动窗口",
      dim: "rollRefunds",
      test: function (row) {
        return row.nRefRoll > 0;
      },
    },
    {
      id: "card_dual_topup",
      title: "单卡转入双规则命中",
      dim: "cardTopups",
      test: function (row, th) {
        return row.nTopup > th.cardTopupCount && row.hasFast;
      },
    },
    {
      id: "card_count_only",
      title: "单卡转入仅次数越线",
      dim: "cardTopups",
      test: function (row, th) {
        return row.nTopup > th.cardTopupCount && !row.hasFast;
      },
    },
    {
      id: "card_fast_only",
      title: "单卡转入仅快充",
      dim: "cardTopups",
      test: function (row, th) {
        return row.nTopup <= th.cardTopupCount && row.hasFast;
      },
    },
    {
      id: "card_decline",
      title: "单卡消费拒付越线",
      dim: "cards",
      test: function (row, th) {
        return row.nSpend >= th.cardDeclineMinSpend && row.decl >= th.decline;
      },
    },
    {
      id: "burst",
      title: "群充簇",
      dim: "bursts",
      test: function (row, th) {
        return row.nCards >= th.burstMinCards;
      },
    },
  ];

  TX.extraRules = TX.extraRules || [];
})(typeof window !== "undefined" ? window : globalThis);
