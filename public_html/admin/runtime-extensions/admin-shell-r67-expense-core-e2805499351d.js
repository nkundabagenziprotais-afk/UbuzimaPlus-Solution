(function(){
  "use strict";
  if (window.__AQUILA_R215__) { return; }
  window.__AQUILA_R215__ = true;

  var BIZ_TZ = "Africa/Kigali";
  var SURF_KEY = "ubuzima.mobile.surface";
  var DATE_PREFIX = "ubuzima.mobile.dateRange.";
  var DATE_LEGACY = "ubuzima.mobile.dateRange";
  var BIO_KEY = "ubuzima.mobile.webauthn";
  var MORE_KEY = "ubuzima.mobile.moreMod";
  var TAB_KEYS = ["home", "pos", "inventory", "procurement", "more"];
  var SECTION_CLICK = {
    insurance: "Insurance",
    finance: "Finance",
    reports: "Report Center",
    hrm: "HRM",
    admin: "Admin Center",
    messaging: "Messaging"
  };
  var HUBS = {
    more: {
      kicker: "MORE SERVICES",
      title: "OPERATING MODULES",
      landing: true,
      tiles: [
        ["Insurance", "Claims, partners and cover", "insurance"],
        ["Finance", "P&L, cash, payables and targets", "finance"],
        ["Report Center", "Operating and audit reports", "reports"],
        ["HRM", "People, payroll and attendance", "hrm"],
        ["Admin Center", "Users, security and setup", "admin"],
        ["Messaging", "Pharmacist chat and mail", "messaging"]
      ]
    },
    inventory: {
      kicker: "STOCK CONTROL",
      title: "STOCK SERVICES",
      tiles: [
        ["Stock on Hand", "Current pharmaceutical stock"],
        ["Low Stock Watch List", "Products needing reorder"],
        ["Near Expiry Review", "Near-expiry batch control"],
        ["Expired Items", "Expired stock requiring action"],
        ["Product Master", "Medicine catalog and pricing"],
        ["Top Fast Moving Products", "Highest velocity products"],
        ["Slow Moving / Non-Moving Products", "Slow and idle stock"],
        ["High Value – Low Stock Risk", "High-value stock-out risk"]
      ]
    },
    procurement: {
      kicker: "PROCUREMENT",
      title: "SUPPLY SERVICES",
      tiles: [
        ["Approve purchase orders", "Review and approve raised POs"],
        ["Purchase Orders", "Open and receive supplier orders"],
        ["Suppliers", "Vendor master and contacts"],
        ["Goods Received", "Inbound stock against POs"],
        ["Payables", "Supplier balances due"],
        ["Returns", "Purchase returns and credit"],
        ["Price Lists", "Supplier cost updates"]
      ]
    },
    insurance: {
      kicker: "INSURANCE DESK",
      title: "COVER SERVICES",
      tiles: [
        ["Partners", "Insurer contracts and contacts"],
        ["Claims", "Claims processing and review"],
        ["Reconciliation", "Partner settlement control"],
        ["Price Lists", "Partner price list management"],
        ["Product Prices", "Insurance product pricing"],
        ["Contribution Rules", "Patient and cover split"],
        ["Sales Register", "Insurance-related sales"],
        ["Audit", "Insurance audit trail"]
      ]
    },
    finance: {
      kicker: "FINANCE DESK",
      title: "MONEY SERVICES",
      tiles: [
        ["Profit & Loss", "Income and expenditure"],
        ["Balance Sheet", "Assets, liabilities and equity"],
        ["Cash Flow", "Cash movement and liquidity"],
        ["Receivables", "Amounts still due in"],
        ["Payables", "Supplier and other obligations"],
        ["Income", "Manual income and receipts"],
        ["Expenses", "Expense management"],
        ["Banking", "Banking and payment control"],
        ["Accounting", "Journals and controls"],
        ["Planning & Performance", "Targets, BEP and forecast"]
      ]
    },
    reports: {
      kicker: "REPORT CENTER",
      title: "OPERATING REPORTS",
      tiles: [
        ["Sales", "Sales performance reports"],
        ["Inventory", "Stock movement and risk"],
        ["Finance", "P&L, cash and receivables"],
        ["Insurance", "Claims and cover reports"],
        ["Audit", "Activity and control trail"],
        ["Ad hoc", "Custom operating reports"]
      ]
    },
    hrm: {
      kicker: "PEOPLE OPERATIONS",
      title: "WORKFORCE SERVICES",
      tiles: [
        ["People", "Employee records and lifecycle"],
        ["Time & Attendance", "Shifts, attendance and overtime"],
        ["Leave", "Leave policies and requests"],
        ["Payroll", "Payroll operations"],
        ["Organization", "Departments and job grades"],
        ["Performance & Learning", "Goals, reviews and learning"]
      ]
    },
    admin: {
      kicker: "ADMIN CENTER",
      title: "CONTROL SERVICES",
      tiles: [
        ["Users and Security", "Users, access and security"],
        ["POS Session", "Till supervision and controls"],
        ["Business Set-up", "Business configuration"],
        ["Notification", "System notifications"],
        ["Language", "Language and market"],
        ["AI Center", "Controlled AI services"],
        ["Website Content", "Public site pages and copy"]
      ]
    },
    messaging: {
      kicker: "MESSAGING",
      title: "COMMUNICATION",
      tiles: [
        ["Pharmacist Chats", "Professional pharmacy communication"],
        ["Corporate Email", "Corporate communication and inbox"]
      ]
    }
  };

  function isPhone() {
    var ua = String(navigator.userAgent || "");
    if (/iPhone|iPod/i.test(ua)) { return true; }
    if (/SM-F\d|SM-W\d|Fold/i.test(ua)) { return true; }
    if (/iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints >= 2)) { return false; }
    return window.matchMedia("(max-width: 840px)").matches;
  }
  function hashVal(key, fallback) {
    var m = String(location.hash || "").match(new RegExp("(?:^|#|&)" + key + "=([^&]+)"));
    return m ? decodeURIComponent(m[1]) : (fallback || "");
  }
  function section() { return hashVal("section", "overview"); }
  function isLogin() { return !!document.querySelector("input[type=password]"); }
  function sessionBag() {
    var i, raw, x;
    try {
      for (i = 0; i < 2; i += 1) {
        raw = (i ? sessionStorage : localStorage).getItem("ubuzima_admin_session");
        if (!raw) { continue; }
        x = JSON.parse(raw);
        if (x) { return x; }
      }
    } catch (_e) {}
    return null;
  }
  function authToken() {
    var x = sessionBag();
    var g = function(st, k) { try { return st.getItem(k); } catch (_e2) { return null; } };
    return (x && (x.token || x.access_token || x.accessToken)) || g(localStorage, "ubuzima.token") || g(sessionStorage, "ubuzima.token") || "";
  }
  function tenantSlug() {
    var x = sessionBag();
    var g = function(st, k) { try { return st.getItem(k); } catch (_e3) { return null; } };
    var asg = x && x.profile && x.profile.tenant_assignments && x.profile.tenant_assignments[0];
    var ten = asg && asg.tenant && asg.tenant.slug;
    return g(sessionStorage, "ubuzima.currentTenantSlug") || g(localStorage, "ubuzima.currentTenantSlug") || ten || "";
  }
  function apiSend(path, method, body) {
    var t = authToken();
    var s = tenantSlug();
    var opts = {
      method: method || "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + t,
        "X-Tenant-Slug": s,
        "X-Tenant": s
      }
    };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    if (!t || !s) { return Promise.reject(new Error("Not signed in")); }
    return fetch("/api/v1" + path, opts).then(function(r) {
      return r.json().catch(function() { return null; }).then(function(p) {
        if (!r.ok) { throw new Error((p && p.message) || ("HTTP " + r.status)); }
        return p;
      });
    });
  }
  function apiGet(path) { return apiSend(path, "GET"); }
  function jsonArr(p, keys) {
    var i, k;
    if (Array.isArray(p)) { return p; }
    if (!p || typeof p !== "object") { return []; }
    keys = keys || [];
    for (i = 0; i < keys.length; i += 1) {
      k = keys[i];
      if (Array.isArray(p[k])) { return p[k]; }
    }
    if (Array.isArray(p.data)) { return p.data; }
    if (p.data && typeof p.data === "object") {
      for (i = 0; i < keys.length; i += 1) {
        k = keys[i];
        if (Array.isArray(p.data[k])) { return p.data[k]; }
      }
    }
    return Array.isArray(p.items) ? p.items : [];
  }
  function payloadData(p) {
    if (!p) { return null; }
    if (p.data && typeof p.data === "object") { return p.data; }
    return p;
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function fmt(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function money(n) { return fmt(n); }
  var COST_CACHE = null;
  var COST_WAIT = null;
  var RECEIPT_CACHE = null;
  var RECEIPT_WAIT = null;
  function pad2(n) {
    n = String(n);
    return n.length < 2 ? "0" + n : n;
  }
  function shiftMonths(iso, months) {
    var y = parseInt(String(iso).slice(0, 4), 10);
    var m = parseInt(String(iso).slice(5, 7), 10) + months;
    var d = parseInt(String(iso).slice(8, 10), 10);
    var last;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    last = new Date(y, m, 0).getDate();
    if (d > last) { d = last; }
    return y + "-" + pad2(m) + "-" + pad2(d);
  }
  function periodLabel(from, to) {
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var fm = parseInt(from.slice(5, 7), 10);
    var tm = parseInt(to.slice(5, 7), 10);
    var fd = parseInt(from.slice(8, 10), 10);
    var td = parseInt(to.slice(8, 10), 10);
    if (fm === tm && from.slice(0, 4) === to.slice(0, 4)) {
      if (fd === 1 && to.slice(8, 10) === pad2(new Date(parseInt(to.slice(0, 4), 10), tm, 0).getDate())) {
        return months[fm - 1] + " " + from.slice(2, 4);
      }
      return months[fm - 1] + " " + fd + "–" + td;
    }
    return months[fm - 1] + " " + fd + "–" + months[tm - 1] + " " + td;
  }
  function compareWindows(from, to) {
    return [
      { from: shiftMonths(from, -2), to: shiftMonths(to, -2) },
      { from: shiftMonths(from, -1), to: shiftMonths(to, -1) },
      { from: from, to: to }
    ];
  }
  function loadCostMaps() {
    if (COST_CACHE) { return Promise.resolve(COST_CACHE); }
    if (COST_WAIT) { return COST_WAIT; }
    COST_WAIT = Promise.all([
      apiGet("/pharmaco/inventory/batches?per_page=2000&limit=2000").catch(function() { return null; }),
      apiGet("/pharmaco/finance/inventory/read-model?limit=1").catch(function() { return null; })
    ]).then(function(pack) {
      var list = jsonArr(pack[0], ["batches", "items"]);
      var val = payloadData(pack[1]) || {};
      var cur = val.current_inventory_valuation || {};
      var byProduct = {};
      var byBatch = {};
      var live = 0;
      var expired = {};
      var i, b, pid, bid, uc, q, ex, st;
      for (i = 0; i < list.length; i += 1) {
        b = list[i] || {};
        uc = num(b.resolved_unit_cost != null ? b.resolved_unit_cost : b.unit_cost);
        q = num(b.available_quantity != null ? b.available_quantity : b.quantity_on_hand);
        pid = (b.product && b.product.id) || b.product_id;
        bid = b.id;
        ex = b.expiry_date ? String(b.expiry_date).slice(0, 10) : "";
        st = String(b.status || "").toLowerCase();
        if (uc > 0 && pid != null && !byProduct[pid]) { byProduct[pid] = uc; }
        if (uc > 0 && bid != null) { byBatch[bid] = uc; }
        if (q > 0 && uc > 0) { live += uc * q; }
        if (ex && q > 0 && uc > 0 && (/expir|write.?off|damage|adjust|quarantine/.test(st) || ex < bizISODate())) {
          expired[ex] = (expired[ex] || 0) + (uc * q);
        }
      }
      if (num(cur.inventory_at_cost) > 0) { live = num(cur.inventory_at_cost); }
      COST_CACHE = { byProduct: byProduct, byBatch: byBatch, live: live, expired: expired };
      window.__UBZ_COST_MAP__ = COST_CACHE;
      return COST_CACHE;
    }).catch(function() {
      COST_WAIT = null;
      return { byProduct: {}, byBatch: {}, live: 0, expired: {} };
    });
    return COST_WAIT;
  }
  function loadReceiptDays() {
    if (RECEIPT_CACHE) { return Promise.resolve(RECEIPT_CACHE); }
    if (RECEIPT_WAIT) { return RECEIPT_WAIT; }
    RECEIPT_WAIT = Promise.all([
      apiGet("/pharmaco/goods-receipts?per_page=500&limit=500").catch(function() { return null; }),
      apiGet("/pharmaco/sales/returns?per_page=200&limit=200").catch(function() { return null; }),
      apiGet("/pharmaco/purchase-returns?per_page=200&limit=200").catch(function() { return null; })
    ]).then(function(pack) {
      var rec = {};
      var out = {};
      var i, r, d, amt, list;
      list = jsonArr(pack[0], ["goods_receipts", "receipts", "purchase_orders", "orders"]);
      for (i = 0; i < list.length; i += 1) {
        r = list[i] || {};
        d = saleDay(r);
        amt = num(r.total_cost != null ? r.total_cost : (r.cost_amount != null ? r.cost_amount : (r.total_amount != null ? r.total_amount : r.amount)));
        if (d && amt) { rec[d] = (rec[d] || 0) + amt; }
      }
      list = jsonArr(pack[1], ["returns", "sales_returns", "items"]).concat(jsonArr(pack[2], ["returns", "purchase_returns", "items"]));
      for (i = 0; i < list.length; i += 1) {
        r = list[i] || {};
        d = saleDay(r);
        amt = num(r.total_cost != null ? r.total_cost : (r.cost_amount != null ? r.cost_amount : (r.total_amount != null ? r.total_amount : r.amount)));
        if (d && amt) { out[d] = (out[d] || 0) + amt; }
      }
      RECEIPT_CACHE = { in: rec, out: out };
      return RECEIPT_CACHE;
    }).catch(function() {
      RECEIPT_WAIT = null;
      return { in: {}, out: {} };
    });
    return RECEIPT_WAIT;
  }
  function lineCogs(it, maps) {
    var q = num(it && (it.quantity != null ? it.quantity : it.qty));
    var line = num(it && (it.line_cost != null ? it.line_cost : it.cost_amount));
    var uc, bid, pid;
    if (line > 0) { return line; }
    uc = num(it && (it.unit_cost != null ? it.unit_cost : (it.buying_price != null ? it.buying_price : it.cost_price)));
    bid = it && ((it.stock_batch && it.stock_batch.id) || it.stock_batch_id);
    pid = it && ((it.product && it.product.id) || it.product_id);
    if (!(uc > 0) && maps) {
      if (bid && maps.byBatch[bid]) { uc = maps.byBatch[bid]; }
      else if (pid && maps.byProduct[pid]) { uc = maps.byProduct[pid]; }
    }
    if (uc > 0) { return uc * (q || 1); }
    return 0;
  }
  function salesOps(from, to, maps) {
    return apiGet("/pharmaco/sales?per_page=500&limit=500&business_date_from=" + encodeURIComponent(from) + "&business_date_to=" + encodeURIComponent(to) + "&include=items&date_basis=business_date").then(function(p) {
      var list = jsonArr(p, ["sales", "items"]);
      var gross = 0;
      var paid = 0;
      var cogs = 0;
      var byDay = {};
      var i, s, d, items, j, dayCogs, tot, st;
      for (i = 0; i < list.length; i += 1) {
        s = list[i] || {};
        st = String(s.status || s.state || "").toLowerCase();
        if (/void|cancel/.test(st) && !/dispens/.test(st)) { continue; }
        tot = num(s.total_amount);
        gross += tot;
        paid += num(s.paid_amount);
        d = saleDay(s);
        dayCogs = 0;
        items = s.items || s.lines || s.sale_items || [];
        for (j = 0; j < items.length; j += 1) { dayCogs += lineCogs(items[j], maps); }
        cogs += dayCogs;
        if (d) {
          if (!byDay[d]) { byDay[d] = { sales: 0, cogs: 0, n: 0 }; }
          byDay[d].sales += tot;
          byDay[d].cogs += dayCogs;
          byDay[d].n += 1;
        }
      }
      return { gross: gross, paid: paid, cogs: cogs, byDay: byDay, n: list.length };
    }).catch(function() { return { gross: 0, paid: 0, cogs: 0, byDay: {}, n: 0 }; });
  }
  function bookAccounts(p) {
    var d = payloadData(p) || {};
    return d.rows || d.accounts || d.lines || [];
  }
  function sumBy(acc, test) {
    var i, r, n = 0;
    for (i = 0; i < acc.length; i += 1) {
      r = acc[i] || {};
      if (test(r)) { n += num(r.balance != null ? r.balance : r.amount); }
    }
    return n;
  }
  function buildPnL(from, to, maps) {
    return Promise.all([
      apiGet("/pharmaco/finance/commercial/profit-loss?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to) + "&page=1&per_page=200").catch(function() { return null; }),
      salesOps(from, to, maps)
    ]).then(function(pack) {
      var acc = bookAccounts(pack[0]);
      var ops = pack[1];
      var bookSales = 0;
      var bookCogs = 0;
      var bookExp = 0;
      var otherInc = 0;
      var i, r, name, typ, code, bal;
      for (i = 0; i < acc.length; i += 1) {
        r = acc[i] || {};
        name = String(r.name || "");
        typ = String(r.account_type || r.type || "").toLowerCase();
        code = String(r.code || r.account_code || "");
        bal = num(r.balance != null ? r.balance : r.amount);
        if (code === "4000" || /^sales revenue$/i.test(name)) { bookSales += bal; }
        else if (code === "5000" || /cost of goods|cogs|cost of sales/i.test(name)) { bookCogs += Math.abs(bal); }
        else if (typ === "income" && Math.abs(bal) > 0 && !/sales|revenue|return/i.test(name) && code !== "4000" && code !== "4010") { otherInc += bal; }
        else if ((typ.indexOf("exp") === 0 || code === "6000" || code === "6100" || code === "6230" || code === "7000") && code !== "5000" && !/cost of goods|cogs|cost of sales/i.test(name)) { bookExp += Math.abs(bal); }
      }
      var income = ops.gross > 0 ? ops.gross : bookSales;
      var cogs = ops.cogs > 0 ? ops.cogs : bookCogs;
      var gp = income - cogs;
      var net = gp + otherInc - bookExp;
      var rows = [
        { key: "sales", name: "Sales revenue", section: "Revenue", amount: income },
        { key: "other_inc", name: "Other income", amount: otherInc },
        { key: "cogs", name: "Cost of goods sold", section: "Cost of sales", amount: cogs },
        { key: "gp", name: "Gross profit", kind: "is-total", amount: gp },
        { key: "opex", name: "Operating expenses", section: "Expenses", amount: bookExp },
        { key: "net", name: "Profit", kind: "is-net", amount: net }
      ];
      if (bookSales > 0 && Math.abs(bookSales - income) >= 1) {
        rows.push({ key: "books_note", name: "Posted in Books", kind: "is-indent", amount: bookSales });
      }
      return rows;
    });
  }
  function buildBS(from, to, maps) {
    return Promise.all([
      apiGet("/pharmaco/finance/commercial/balance-sheet?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to)).catch(function() { return null; }),
      apiGet("/pharmaco/finance/commercial/receivables?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to)).catch(function() { return null; }),
      salesOps(shiftISO(to, 1), bizISODate(), maps),
      loadReceiptDays()
    ]).then(function(pack) {
      var d = payloadData(pack[0]) || {};
      var sec = (d.sections && (d.sections.assets || d.sections[0] && d.sections[0].assets)) ? d.sections : {};
      var assets = (sec.assets && sec.assets.rows) || [];
      var liab = (sec.liabilities && sec.liabilities.rows) || [];
      var eq = (sec.equity && sec.equity.rows) || [];
      var recSum = payloadData(pack[1]) || {};
      var recOut = 0;
      var later = pack[2] || { cogs: 0 };
      var recDays = pack[3] || {};
      var cash = 0;
      var bank = 0;
      var momo = 0;
      var invBooks = 0;
      var arBooks = 0;
      var pay = 0;
      var earn = 0;
      var invOp = 0;
      var i, r, name, code, bal, dte, today;
      if (recSum.summary && Array.isArray(recSum.summary)) {
        for (i = 0; i < recSum.summary.length; i += 1) {
          if (recSum.summary[i].key === "outstanding") { recOut = num(recSum.summary[i].value); }
        }
      }
      function take(list, into) {
        for (i = 0; i < list.length; i += 1) {
          r = list[i] || {};
          name = String(r.name || "");
          code = String(r.code || "");
          bal = num(r.balance);
          if (code === "1000" || /cash on hand/i.test(name)) { cash += bal; }
          else if (code === "1010" || /^bank/i.test(name)) { bank += bal; }
          else if (code === "1030" || /mobile money/i.test(name)) { momo += bal; }
          else if (code === "1200" || /inventory asset/i.test(name)) { invBooks += bal; }
          else if (code === "1100" || code === "1110" || /receivable/i.test(name)) { arBooks += bal; }
          else if (code === "2000" || /payable/i.test(name)) { pay += bal; }
          else if (/accumulated earnings|retained/i.test(name)) { earn += bal; }
        }
      }
      take(assets);
      take(liab);
      take(eq);
      today = bizISODate();
      invOp = maps && maps.live ? maps.live : 0;
      if (to < today && invOp) {
        invOp = invOp + later.cogs;
        for (dte in (recDays.in || recDays)) {
          if ((recDays.in || recDays).hasOwnProperty(dte) && dte > to) { invOp -= (recDays.in || recDays)[dte]; }
        }
        for (dte in (recDays.out || {})) {
          if (recDays.out.hasOwnProperty(dte) && dte > to) { invOp += recDays.out[dte]; }
        }
      }
      var ar = recOut > 0 ? recOut : arBooks;
      var totA = cash + bank + momo + (invOp > 0 ? invOp : invBooks) + ar;
      var totL = pay;
      var totE = totA - totL;
      return [
        { key: "cash", name: "Cash on hand", section: "Assets", amount: cash },
        { key: "bank", name: "Bank", amount: bank },
        { key: "momo", name: "Mobile money", amount: momo },
        { key: "inv_op", name: "Inventories", amount: invOp > 0 ? invOp : invBooks },
        { key: "ar", name: "Trade and other receivables", amount: ar },
        { key: "ta", name: "Total assets", kind: "is-total", amount: totA },
        { key: "ap", name: "Trade and other payables", section: "Liabilities", amount: pay },
        { key: "tl", name: "Total liabilities", kind: "is-total", amount: totL },
        { key: "eq", name: "Equity", section: "Equity", amount: totE },
        { key: "tle", name: "Total liabilities and equity", kind: "is-net", amount: totL + totE }
      ];
    });
  }
  function buildCF(from, to, maps) {
    return Promise.all([
      apiGet("/pharmaco/finance/commercial/cash-flow?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to)).catch(function() { return null; }),
      salesOps(from, to, maps)
    ]).then(function(pack) {
      var d = payloadData(pack[0]) || {};
      var sum = Array.isArray(d.summary) ? d.summary : [];
      var ops = pack[1];
      var map = {};
      var i;
      for (i = 0; i < sum.length; i += 1) {
        if (sum[i] && sum[i].key) { map[sum[i].key] = num(sum[i].value); }
      }
      var collect = ops.paid > 0 ? ops.paid : map.payments;
      var opening = map.opening_balance || 0;
      var operating = collect;
      var investing = map.investing_activities || 0;
      var financing = map.financing_activities || 0;
      var close = opening + operating + investing + financing;
      return [
        { key: "open", name: "Cash and cash equivalents at beginning of period", section: "Cash position", amount: opening },
        { key: "col", name: "Receipts from customers", section: "Operating activities", amount: collect },
        { key: "op", name: "Net cash from operating activities", kind: "is-total", amount: operating },
        { key: "inv", name: "Net cash from investing activities", section: "Investing activities", amount: investing },
        { key: "fin", name: "Net cash from financing activities", section: "Financing activities", amount: financing },
        { key: "net", name: "Net increase / (decrease) in cash", kind: "is-total", amount: close - opening },
        { key: "close", name: "Cash and cash equivalents at end of period", kind: "is-net", amount: close }
      ];
    });
  }
  function loadCompared(builder) {
    var wins = compareWindows(rangeFrom(), rangeTo());
    return loadCostMaps().then(function(maps) {
      return Promise.all(wins.map(function(w) { return builder(w.from, w.to, maps); }));
    }).then(function(packs) {
      var labels = wins.map(function(w) { return { label: periodLabel(w.from, w.to), from: w.from, to: w.to }; });
      var keys = [];
      var seen = {};
      var i, j, t, k, row, out, values;
      for (i = 0; i < packs.length; i += 1) {
        for (j = 0; j < packs[i].length; j += 1) {
          k = packs[i][j].key || packs[i][j].name;
          if (!seen[k]) { seen[k] = 1; keys.push(packs[i][j]); }
        }
      }
      out = [];
      for (i = 0; i < keys.length; i += 1) {
        k = keys[i].key || keys[i].name;
        values = [];
        for (j = 0; j < packs.length; j += 1) {
          row = null;
          for (t = 0; t < packs[j].length; t += 1) {
            if ((packs[j][t].key || packs[j][t].name) === k) { row = packs[j][t]; break; }
          }
          values.push(row ? num(row.amount) : 0);
        }
        out.push({ name: keys[i].name, section: keys[i].section, kind: keys[i].kind, values: values });
      }
      return { rows: out, periods: labels };
    });
  }
  function bizISODate() { return new Intl.DateTimeFormat("en-CA", { timeZone: BIZ_TZ }).format(new Date()); }
  function monthStart(iso) { iso = iso || bizISODate(); return iso.slice(0, 8) + "01"; }
  function capRange(from, to) {
    var today = bizISODate();
    if (from === monthStart(today) && to === today) { return "This month"; }
    if (from && to && from === to) { return from; }
    if (from && to) { return from + "  to  " + to; }
    return "Selected range";
  }
  function dateModuleKey(kind) {
    kind = String(kind || hubKind() || "hub").toLowerCase().replace(/[^a-z0-9_-]+/g, "");
    if (!kind) { kind = "hub"; }
    return DATE_PREFIX + kind;
  }
  function parseRange(raw) {
    try {
      var x = JSON.parse(raw || "null");
      var today = bizISODate();
      if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x.from) || !/^\d{4}-\d{2}-\d{2}$/.test(x.to)) { return null; }
      if (x.from > x.to) { return null; }
      if (x.to > today) { x.to = today; }
      return x;
    } catch (_e4) { return null; }
  }
  function readSavedRange(kind) {
    var x = parseRange(localStorage.getItem(dateModuleKey(kind)));
    if (x) { return x; }
    /* seed only until this module saves its own range */
    return parseRange(localStorage.getItem(DATE_LEGACY));
  }
  function saveRange(from, to, kind) {
    if (!from || !to) { return; }
    try { localStorage.setItem(dateModuleKey(kind), JSON.stringify({ from: from, to: to })); } catch (_e5) {}
  }
  function rangeFrom() {
    var a = document.getElementById("ubz-r215-from");
    if (a && a.value) { return a.value; }
    var saved = readSavedRange();
    return (saved && saved.from) || monthStart(bizISODate());
  }
  function rangeTo() {
    var b = document.getElementById("ubz-r215-to");
    if (b && b.value) { return b.value; }
    var saved = readSavedRange();
    return (saved && saved.to) || bizISODate();
  }
  function syncHubDates() {
    var kind = hubKind();
    var saved = readSavedRange(kind);
    var today = bizISODate();
    var a = document.getElementById("ubz-r215-from");
    var b = document.getElementById("ubz-r215-to");
    var from = (saved && saved.from) || monthStart(today);
    var to = (saved && saved.to) || today;
    if (to > today) { to = today; }
    if (from > to) { from = to; }
    if (a) {
      a.value = from;
      a.setAttribute("data-ubz-date-mod", kind || "");
    }
    if (b) {
      b.value = to;
      b.setAttribute("data-ubz-date-mod", kind || "");
    }
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function shopName() {
    var brand = document.querySelector(".ubuzima-native-brand");
    var t = brand ? String(brand.textContent || "").replace(/\s+/g, " ").trim() : "";
    t = t.replace(/^Ubuzima\+?\s*/i, "").trim();
    return t || "Pharmacy";
  }
  function hello() {
    var h = parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: BIZ_TZ, hour: "numeric", hour12: false }).format(new Date()), 10);
    if (h < 12) { return "Good morning"; }
    if (h < 17) { return "Good afternoon"; }
    return "Good evening";
  }
  var TILE_CLICK = {
    "Stock on Hand": ["Stock on Hand", "Product inventory", "Product Inventory"],
    "Low Stock Watch List": ["Low Stock Watch List", "Low stock", "Low Stock"],
    "Near Expiry Review": ["Near Expiry Review", "Near expiry", "Expiry"],
    "Expired Items": ["Expired Items", "Expired"],
    "Product Master": ["Product Master", "Products"],
    "Top Fast Moving Products": ["Top Fast Moving Products", "Fast moving", "Fast-Moving"],
    "Slow Moving / Non-Moving Products": ["Slow Moving / Non-Moving Products", "Slow moving", "Non-Moving"],
    "High Value – Low Stock Risk": ["High Value – Low Stock Risk", "High Value", "Low Stock Risk"],
    "Purchase Orders": ["Purchase Orders", "Purchase Order"],
    "Goods Received": ["Goods Received", "GRN", "Receiving"],
    "Payables": ["Payables"],
    "Returns": ["Returns", "Purchase returns"],
    "Price Lists": ["Price Lists", "Price List"],
    "Partners": ["Partners", "Insurance Partners"],
    "Claims": ["Claims"],
    "Reconciliation": ["Reconciliation"],
    "Contribution Rules": ["Contribution Rules", "Copay"],
    "Sales Register": ["Sales Register", "Sales register"],
    "People": ["People", "Employees", "Workforce"],
    "Time & Attendance": ["Time & Attendance", "Attendance"],
    "Users and Security": ["Users and Security", "User Profiles", "Users"],
    "POS Session": ["POS Session", "POS Sessions"],
    "Business Set-up": ["Business Set-up", "Business Setup"],
    "Notification": ["Notification", "Notification Center", "Notification Management"],
    "Language": ["Language", "Localization"],
    "AI Center": ["AI Center"],
    "Website Content": ["Website Content", "Platform Management"],
    "Pharmacist Chats": ["Pharmacist Chats", "Pharmacist Chat"],
    "Corporate Email": ["Corporate Email"]
  };
  function clickNamed(txt) {
    var aliases = TILE_CLICK[txt] || [txt];
    var nodes = document.querySelectorAll("button,a,[role=button]");
    var a, i, t, n, want;
    if (txt === "Website Content" && typeof window.__UBZ_CMS_OPEN__ === "function") {
      try { window.__UBZ_CMS_OPEN__(); return true; } catch (_cms) {}
    }
    for (a = 0; a < aliases.length; a += 1) {
      want = String(aliases[a]).replace(/\s+/g, " ").trim().toLowerCase();
      for (i = 0; i < nodes.length; i += 1) {
        n = nodes[i];
        if (n.closest && n.closest("#ubz-r215-hub, .ubuzima-native-tabbar, #ubz-r188-more, #ubz-cms-root")) { continue; }
        t = String(n.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (t === want || t.indexOf(want) === 0) {
          try { n.click(); return true; } catch (_e) {}
        }
      }
    }
    return false;
  }
  function kpiFromButtons(want) {
    var nodes = document.querySelectorAll("button,[role=button]");
    var i, t;
    for (i = 0; i < nodes.length; i += 1) {
      t = String(nodes[i].textContent || "").replace(/\s+/g, " ").trim();
      if (t.indexOf(want) === 0) {
        return t.replace(want, "").replace(/\s+/g, " ").trim();
      }
    }
    return "—";
  }
  function hideMorePopup() {
    var host = document.getElementById("ubz-r188-more");
    if (host) {
      host.hidden = true;
      host.setAttribute("hidden", "");
      host.style.setProperty("display", "none", "important");
    }
  }
  function rememberSurface(name) {
    try {
      sessionStorage.setItem(SURF_KEY, name);
      localStorage.setItem(SURF_KEY, name);
    } catch (_e) {}
  }
  function recalledSurface() {
    try {
      return sessionStorage.getItem(SURF_KEY) || localStorage.getItem(SURF_KEY) || "";
    } catch (_e2) { return ""; }
  }
  function setSurface(name, child) {
    var html = document.documentElement;
    html.setAttribute("data-ubz-surface", name || "home");
    html.setAttribute("data-ubz-child", child ? "1" : "0");
    rememberSurface(name || "home");
  }
  function flashVeil() {
    var v = document.getElementById("ubz-r215-veil");
    if (!v) {
      v = document.createElement("div");
      v.id = "ubz-r215-veil";
      v.setAttribute("aria-hidden", "true");
      document.body.appendChild(v);
    }
    v.setAttribute("data-on", "1");
    window.setTimeout(function() { v.setAttribute("data-on", "0"); }, 220);
  }
  function safeBottom() {
    var n = document.getElementById("ubz-r215-safe");
    var pad;
    if (!n) {
      n = document.createElement("div");
      n.id = "ubz-r215-safe";
      n.setAttribute("aria-hidden", "true");
      n.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:0;padding-bottom:constant(safe-area-inset-bottom);padding-bottom:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden";
      document.body.appendChild(n);
    }
    pad = parseFloat(window.getComputedStyle(n).paddingBottom);
    return Math.round((isFinite(pad) ? pad : 0) || n.offsetHeight || 0);
  }
  function pinTabbar() {
    var bar = document.querySelector(".ubuzima-native-tabbar");
    if (!bar || !isPhone() || isLogin()) { return; }
    document.documentElement.setAttribute("data-ubz-tabbar-lock", "r215");
    document.documentElement.setAttribute("data-ubz-os", /iPhone|iPod/i.test(navigator.userAgent || "") ? "ios" : "android");
    bar.setAttribute("data-ubz-tabbar-lock", "r215");
    /* Compact dock: height follows icons only. Flush to physical bottom (no safe-area filler band). */
    bar.style.setProperty("position", "fixed", "important");
    bar.style.setProperty("left", "0px", "important");
    bar.style.setProperty("right", "0px", "important");
    bar.style.setProperty("width", "100%", "important");
    bar.style.setProperty("max-width", "none", "important");
    bar.style.setProperty("height", "52px", "important");
    bar.style.setProperty("min-height", "52px", "important");
    bar.style.setProperty("max-height", "52px", "important");
    bar.style.setProperty("padding", "2px 0 2px", "important");
    bar.style.setProperty("padding-bottom", "2px", "important");
    bar.style.setProperty("margin", "0px", "important");
    bar.style.setProperty("bottom", "0px", "important");
    bar.style.setProperty("inset", "auto 0px 0px 0px", "important");
    bar.style.setProperty("z-index", "2147483000", "important");
    bar.style.setProperty("border-radius", "0px", "important");
    bar.style.setProperty("background", "linear-gradient(180deg, #5a6428 0%, #4b5320 42%, #3d4418 100%)", "important");
    bar.style.setProperty("box-shadow", "0 -6px 18px rgba(16, 33, 27, 0.16)", "important");
    bar.style.setProperty("transform", "none", "important");
    bar.style.setProperty("box-sizing", "border-box", "important");
    bar.style.setProperty("backdrop-filter", "none", "important");
    bar.style.setProperty("-webkit-backdrop-filter", "none", "important");
    document.documentElement.style.setProperty("background-color", "#eef3f0", "important");
    if (document.body) { document.body.style.setProperty("background-color", "#eef3f0", "important"); }
    decorateTabs(bar);
  }
  window.__UBZ_PIN_TABBAR__ = pinTabbar;
  function tabLabel(btn) {
    var small = btn.querySelector("small");
    return String((small && small.textContent) || btn.textContent || "").replace(/\s+/g, " ").trim();
  }
  var TAB_SVG = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.1 2.4 11h2.7v9.4h5.4v-5.8h3V20.4h5.4V11h2.7z"/></svg>',
    pos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 3.6h15.6v4.2H4.2zm2.2 5.6h11.2V21H6.4zm2.8 2.2v1.8h5.6v-1.8zm0 3.1v1.8h5.6v-1.8z"/></svg>',
    inventory: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 3.2 7.2v9.6L12 21.2l8.8-4.4V7.2zm0 2.2 6.2 3.1L12 11.3 5.8 8.1zm-6.6 4.6 5.5 2.8v6.2L5.4 16.6zm8.8 9v-6.2l5.5-2.8v5.2z"/></svg>',
    procurement: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.2h11.4V15H3zm12.2 3.2H18l3 3.4V15h-5.8zM6.5 19.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zm11.2 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6.6v6.6H4zm9.4 0H20v6.6h-6.6zM4 13.4h6.6V20H4zm9.4 0H20V20h-6.6z"/></svg>'
  };
  function decorateTabs(bar) {
    var buttons, i, key, ico, lab, ghost;
    bar = bar || document.querySelector(".ubuzima-native-tabbar");
    if (!bar) { return; }
    buttons = bar.querySelectorAll("button");
    for (i = 0; i < buttons.length; i += 1) {
      key = TAB_KEYS[i] || "x";
      buttons[i].setAttribute("data-ubz-tab", key);
      lab = tabLabel(buttons[i]);
      if (lab) { buttons[i].setAttribute("aria-label", lab); }
      ghost = buttons[i].querySelector(".ubuzima-native-icon");
      if (ghost) {
        ghost.setAttribute("hidden", "");
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.setProperty("display", "none", "important");
      }
      ico = buttons[i].querySelector(".ubz-r215-ico");
      if (!ico) {
        ico = document.createElement("i");
        ico.className = "ubz-r215-ico";
        ico.setAttribute("aria-hidden", "true");
        buttons[i].insertBefore(ico, buttons[i].firstChild);
      }
      if (ico.getAttribute("data-ubz-ico") !== key) {
        ico.setAttribute("data-ubz-ico", key);
        ico.innerHTML = TAB_SVG[key] || TAB_SVG.more;
      }
    }
  }
  function ensureHub() {
    var host = document.querySelector(".ubuzima-native-content");
    var root = document.getElementById("ubz-r215-hub");
    if (!host) { return null; }
    if (root) { return root; }
    root = el("div", "ubz-r215-hub");
    root.id = "ubz-r215-hub";
    root.setAttribute("aria-label", "Mobile module hub");
    if (host.firstChild) { host.insertBefore(root, host.firstChild); }
    else { host.appendChild(root); }
    return root;
  }
  function snap() {
    return window.__UBZ_MOBILE_SNAP__ || {};
  }
  function snapVal(path, fallback) {
    var cur = snap();
    var i, k, parts;
    parts = String(path || "").split(".");
    for (i = 0; i < parts.length; i += 1) {
      k = parts[i];
      if (!cur || typeof cur !== "object") { return fallback || "—"; }
      cur = cur[k];
    }
    if (cur && typeof cur === "object" && cur.v != null) { return cur.v || fallback || "—"; }
    if (cur == null || cur === "") { return fallback || "—"; }
    return String(cur);
  }
  function snapCap(path, fallback) {
    var cur = snap();
    var i, k, parts;
    parts = String(path || "").split(".");
    for (i = 0; i < parts.length; i += 1) {
      k = parts[i];
      if (!cur || typeof cur !== "object") { return fallback || ""; }
      cur = cur[k];
    }
    if (cur && typeof cur === "object") { return cur.c || fallback || ""; }
    return fallback || "";
  }
  function moneyNum(s) {
    var t = String(s || "").replace(/[^0-9.-]/g, "");
    var n = Number(t);
    return isFinite(n) ? Math.abs(n) : 0;
  }
  function lastMore() {
    try { return localStorage.getItem(MORE_KEY) || ""; } catch (_e) { return ""; }
  }
  function saveMore(kind) {
    try { if (kind) { localStorage.setItem(MORE_KEY, kind); } } catch (_e2) {}
  }
  function sessionWho() {
    var x, p, u, name, mail, role;
    try {
      x = JSON.parse(sessionStorage.getItem("ubuzima_admin_session") || localStorage.getItem("ubuzima_admin_session") || "null");
    } catch (_e3) { x = null; }
    p = (x && (x.profile || x.user || x)) || {};
    u = (x && x.user) || {};
    name = String(p.full_name || p.display_name || p.name || u.full_name || u.name || "").trim();
    mail = String(p.email || u.email || "").trim();
    role = String(p.role || p.job_title || u.role || "").trim();
    return { name: name || shopName(), mail: mail, role: role };
  }
  function clickProfile(aliases) {
    var btn = document.querySelector(".dashboard-header .profile-avatar-button");
    var i, n, t, nodes, pop;
    function hit() {
      pop = document.querySelector(".dashboard-header .profile-popover, .profile-popover, .aquila-profile-v3-menu");
      nodes = (pop || document).querySelectorAll("button,a,[role=button]");
      for (i = 0; i < nodes.length; i += 1) {
        n = nodes[i];
        if (n.closest && n.closest("#ubz-r215-hub, .ubuzima-native-tabbar")) { continue; }
        t = String(n.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (aliases.indexOf(t) >= 0 || aliases.some(function(a) { return t.indexOf(a) === 0; })) {
          try { n.click(); return true; } catch (_e4) {}
        }
      }
      return false;
    }
    if (hit()) { return true; }
    if (btn) {
      try { btn.click(); } catch (_e5) {}
      window.setTimeout(hit, 80);
      window.setTimeout(hit, 200);
      return true;
    }
    return false;
  }
  function clickLanguage() {
    var n = document.querySelector(".dashboard-header .language-corner-button, .auth-language-row button, [data-language]");
    if (n) { try { n.click(); return true; } catch (_e6) {} }
    return clickNamed("Language") || clickProfile(["language"]);
  }
  function metricCard(id, label) {
    var n = el("article", "ubz-r215-card");
    n.appendChild(el("p", "ubz-r215-l", label));
    n.appendChild(el("p", "ubz-r215-v", "—")).id = id;
    n.appendChild(el("p", "ubz-r215-c", "")).id = id + "-c";
    return n;
  }
  function setTxt(id, text) {
    var n = document.getElementById(id);
    if (n && text != null && n.textContent !== String(text)) { n.textContent = String(text); }
  }
  function mixRow(label, id) {
    var row = el("div", "ubz-r215-mix-row");
    var track, bar;
    row.appendChild(el("span", "", label));
    track = el("div", "ubz-r215-mix-track");
    bar = el("i", "");
    bar.id = id + "-bar";
    track.appendChild(bar);
    row.appendChild(track);
    row.appendChild(el("strong", "", "—")).id = id;
    return row;
  }
  function fillMix(id, value, max) {
    var bar = document.getElementById(id + "-bar");
    var pct = max > 0 ? Math.max(4, Math.min(100, (moneyNum(value) / max) * 100)) : 4;
    setTxt(id, value || "—");
    if (bar) { bar.style.width = pct + "%"; }
  }
  function heroPair(row, aLabel, aId, bLabel, bId) {
    var a = el("div", "");
    a.appendChild(el("p", "ubz-r215-l", aLabel));
    a.appendChild(el("p", "ubz-r215-v", "—")).id = aId;
    a.appendChild(el("p", "ubz-r215-c", "")).id = aId + "-c";
    row.appendChild(a);
    a = el("div", "");
    a.appendChild(el("p", "ubz-r215-l", bLabel));
    a.appendChild(el("p", "ubz-r215-v", "—")).id = bId;
    a.appendChild(el("p", "ubz-r215-c", "")).id = bId + "-c";
    row.appendChild(a);
  }
  function fillHubMetrics(kind) {
    var inv, near, healthy, low, expd, qty, rec, credit, overdue, profit, exp, net, range, max;
    range = snapVal("range", "");
    if (kind === "inventory") {
      inv = snapVal("stock.inv", kpiFromButtons("Total inventory value").replace(/Inventory position.*$/i, "").trim());
      near = snapVal("stock.near", kpiFromButtons("Near expiry value").replace(/Expiry risk.*$/i, "").trim());
      healthy = snapVal("stock.healthy");
      low = snapVal("stock.low");
      expd = snapVal("stock.expd");
      qty = snapVal("stock.qty");
      setTxt("ubz-r215-h-a", inv);
      setTxt("ubz-r215-h-a-c", snapCap("stock.inv", "On hand"));
      setTxt("ubz-r215-h-b", near);
      setTxt("ubz-r215-h-b-c", snapCap("stock.near", "Risk value"));
      setTxt("ubz-r215-m-inv", inv);
      setTxt("ubz-r215-m-healthy", healthy);
      setTxt("ubz-r215-m-low", low);
      setTxt("ubz-r215-m-near", near);
      setTxt("ubz-r215-m-expd", expd);
      setTxt("ubz-r215-m-qty", qty);
      setTxt("ubz-r215-m-qty-c", snapCap("stock.qty", "Batches"));
      max = Math.max(moneyNum(healthy), moneyNum(low), moneyNum(near), moneyNum(expd), 1);
      fillMix("ubz-r215-mix-h", healthy, max);
      fillMix("ubz-r215-mix-l", low, max);
      fillMix("ubz-r215-mix-n", near, max);
      fillMix("ubz-r215-mix-e", expd, max);
    } else if (kind === "insurance") {
      rec = snapVal("insurance.rec");
      credit = snapVal("insurance.credit");
      overdue = snapVal("insurance.overdue");
      setTxt("ubz-r215-h-a", rec);
      setTxt("ubz-r215-h-a-c", "Insurer receivable");
      setTxt("ubz-r215-h-b", overdue);
      setTxt("ubz-r215-h-b-c", "Overdue cover");
      setTxt("ubz-r215-m-rec", rec);
      setTxt("ubz-r215-m-credit", credit);
      setTxt("ubz-r215-m-overdue", overdue);
      setTxt("ubz-r215-m-ins", snapVal("insurance.sales"));
    } else if (kind === "finance") {
      profit = snapVal("finance.profit");
      exp = snapVal("finance.expenses");
      net = snapVal("finance.net");
      setTxt("ubz-r215-h-a", profit);
      setTxt("ubz-r215-h-a-c", range || "Selected period");
      setTxt("ubz-r215-h-b", snapVal("finance.income"));
      setTxt("ubz-r215-h-b-c", range || "Income");
      setTxt("ubz-r215-m-profit", profit);
      setTxt("ubz-r215-m-exp", exp);
      setTxt("ubz-r215-m-net", net);
      setTxt("ubz-r215-m-bep", snapVal("finance.bep"));
      setTxt("ubz-r215-m-profit-c", range);
      setTxt("ubz-r215-m-exp-c", range);
      setTxt("ubz-r215-m-net-c", range);
    } else if (kind === "procurement") {
      setTxt("ubz-r215-h-a", window.__UBZ_R215_PO__ ? String(window.__UBZ_R215_PO__.open || 0) : "—");
      setTxt("ubz-r215-h-a-c", "Open purchase orders");
      setTxt("ubz-r215-h-b", window.__UBZ_R215_PO__ ? String(window.__UBZ_R215_PO__.pending || 0) : "—");
      setTxt("ubz-r215-h-b-c", "Awaiting approval");
      setTxt("ubz-r215-m-po", window.__UBZ_R215_PO__ ? String(window.__UBZ_R215_PO__.open || 0) : "—");
      setTxt("ubz-r215-m-pend", window.__UBZ_R215_PO__ ? String(window.__UBZ_R215_PO__.pending || 0) : "—");
      setTxt("ubz-r215-m-pay", snapVal("finance.expenses") !== "—" ? snapVal("finance.expenses") : "—");
      setTxt("ubz-r215-m-grn", window.__UBZ_R215_PO__ ? String(window.__UBZ_R215_PO__.received || 0) : "—");
    } else if (kind === "reports") {
      setTxt("ubz-r215-h-a", "6");
      setTxt("ubz-r215-h-a-c", "Operating packs");
      setTxt("ubz-r215-h-b", "Audit");
      setTxt("ubz-r215-h-b-c", "Control trail");
      setTxt("ubz-r215-m-rsales", document.getElementById("ubz-r189-gross-sales") ? document.getElementById("ubz-r189-gross-sales").textContent : snapVal("finance.income"));
      setTxt("ubz-r215-m-rstock", snapVal("stock.inv"));
      setTxt("ubz-r215-m-rprofit", snapVal("finance.profit"));
      setTxt("ubz-r215-m-raudit", "6");
      setTxt("ubz-r215-m-rsales-c", range);
      setTxt("ubz-r215-m-rprofit-c", range);
    } else if (kind === "hrm") {
      setTxt("ubz-r215-h-a", "Workforce");
      setTxt("ubz-r215-h-a-c", "People operations");
      setTxt("ubz-r215-h-b", "Payroll");
      setTxt("ubz-r215-h-b-c", "Attendance to pay");
      setTxt("ubz-r215-m-people", "Open records");
      setTxt("ubz-r215-m-att", "Shifts");
      setTxt("ubz-r215-m-leave", "Requests");
      setTxt("ubz-r215-m-payr", "Run payroll");
    } else if (kind === "admin") {
      setTxt("ubz-r215-h-a", "Users");
      setTxt("ubz-r215-h-a-c", "Roles and security");
      setTxt("ubz-r215-h-b", "Setup");
      setTxt("ubz-r215-h-b-c", "Business config");
      setTxt("ubz-r215-m-users", "Access");
      setTxt("ubz-r215-m-tills", "Sessions");
      setTxt("ubz-r215-m-setup", "Config");
      setTxt("ubz-r215-m-note", "Inbox");
    } else if (kind === "messaging") {
      setTxt("ubz-r215-h-a", "Pharmacist");
      setTxt("ubz-r215-h-a-c", "Clinical chat");
      setTxt("ubz-r215-h-b", "Inbox");
      setTxt("ubz-r215-h-b-c", "Corporate mail");
      setTxt("ubz-r215-m-chats", "Open desk");
      setTxt("ubz-r215-m-mail", "Corporate");
    } else if (kind === "more") {
      setTxt("ubz-r215-h-a", "6");
      setTxt("ubz-r215-h-a-c", "Operating desks");
      setTxt("ubz-r215-h-b", sessionWho().name);
      setTxt("ubz-r215-h-b-c", sessionWho().role || "Signed in");
    }
  }
  function analyticsBlock(kind) {
    var wrap, mix;
    if (kind === "inventory") {
      wrap = el("div", "ubz-r215-metrics");
      wrap.appendChild(metricCard("ubz-r215-m-inv", "INVENTORY VALUE"));
      wrap.appendChild(metricCard("ubz-r215-m-healthy", "HEALTHY STOCK"));
      wrap.appendChild(metricCard("ubz-r215-m-low", "LOW STOCK"));
      wrap.appendChild(metricCard("ubz-r215-m-near", "NEAR EXPIRY"));
      wrap.appendChild(metricCard("ubz-r215-m-expd", "EXPIRED STOCK"));
      wrap.appendChild(metricCard("ubz-r215-m-qty", "STOCK QTY"));
      mix = el("div", "ubz-r215-mix");
      mix.appendChild(mixRow("Healthy", "ubz-r215-mix-h"));
      mix.appendChild(mixRow("Low stock", "ubz-r215-mix-l"));
      mix.appendChild(mixRow("Near expiry", "ubz-r215-mix-n"));
      mix.appendChild(mixRow("Expired", "ubz-r215-mix-e"));
      wrap.setAttribute("data-ubz-analytics", "inventory");
      return [wrap, mix];
    }
    if (kind === "insurance") {
      wrap = el("div", "ubz-r215-metrics");
      wrap.appendChild(metricCard("ubz-r215-m-ins", "INSURANCE SALES"));
      wrap.appendChild(metricCard("ubz-r215-m-rec", "INSURER RECEIVABLE"));
      wrap.appendChild(metricCard("ubz-r215-m-credit", "CUSTOMER CREDIT"));
      wrap.appendChild(metricCard("ubz-r215-m-overdue", "OVERDUE"));
      wrap.setAttribute("data-ubz-analytics", "insurance");
      return [wrap];
    }
    if (kind === "finance") {
      wrap = el("div", "ubz-r215-metrics");
      wrap.appendChild(metricCard("ubz-r215-m-profit", "GROSS PROFIT"));
      wrap.appendChild(metricCard("ubz-r215-m-exp", "OPERATING EXPENSES"));
      wrap.appendChild(metricCard("ubz-r215-m-net", "NET POSITION"));
      wrap.appendChild(metricCard("ubz-r215-m-bep", "REQUIRED SALES / DAY"));
      wrap.setAttribute("data-ubz-analytics", "finance");
      return [wrap];
    }
    if (kind === "procurement") {
      wrap = el("div", "ubz-r215-metrics");
      wrap.appendChild(metricCard("ubz-r215-m-po", "OPEN POs"));
      wrap.appendChild(metricCard("ubz-r215-m-pend", "AWAITING APPROVAL"));
      wrap.appendChild(metricCard("ubz-r215-m-pay", "PAYABLES"));
      wrap.appendChild(metricCard("ubz-r215-m-grn", "GOODS RECEIVED"));
      wrap.setAttribute("data-ubz-analytics", "procurement");
      return [wrap];
    }
    if (kind === "reports") {
      wrap = el("div", "ubz-r215-metrics");
      wrap.appendChild(metricCard("ubz-r215-m-rsales", "SALES"));
      wrap.appendChild(metricCard("ubz-r215-m-rstock", "STOCK VALUE"));
      wrap.appendChild(metricCard("ubz-r215-m-rprofit", "GROSS PROFIT"));
      wrap.appendChild(metricCard("ubz-r215-m-raudit", "AUDIT PACKS"));
      wrap.setAttribute("data-ubz-analytics", "reports");
      return [wrap];
    }
    if (kind === "hrm") {
      wrap = el("div", "ubz-r215-metrics");
      wrap.appendChild(metricCard("ubz-r215-m-people", "PEOPLE"));
      wrap.appendChild(metricCard("ubz-r215-m-att", "ATTENDANCE"));
      wrap.appendChild(metricCard("ubz-r215-m-leave", "LEAVE"));
      wrap.appendChild(metricCard("ubz-r215-m-payr", "PAYROLL"));
      wrap.setAttribute("data-ubz-analytics", "hrm");
      return [wrap];
    }
    if (kind === "admin") {
      wrap = el("div", "ubz-r215-metrics");
      wrap.appendChild(metricCard("ubz-r215-m-users", "USERS"));
      wrap.appendChild(metricCard("ubz-r215-m-tills", "POS TILLS"));
      wrap.appendChild(metricCard("ubz-r215-m-setup", "SETUP"));
      wrap.appendChild(metricCard("ubz-r215-m-note", "ALERTS"));
      wrap.setAttribute("data-ubz-analytics", "admin");
      return [wrap];
    }
    if (kind === "messaging") {
      wrap = el("div", "ubz-r215-metrics");
      wrap.appendChild(metricCard("ubz-r215-m-chats", "CHATS"));
      wrap.appendChild(metricCard("ubz-r215-m-mail", "MAIL"));
      wrap.setAttribute("data-ubz-analytics", "messaging");
      return [wrap];
    }
    return [];
  }
  function profileAction(title, hint, fn, danger) {
    var b = el("button", danger ? "ubz-r215-prof ubz-r215-prof--out" : "ubz-r215-prof");
    b.type = "button";
    b.appendChild(el("strong", "", title));
    b.appendChild(el("span", "", hint));
    b.addEventListener("click", fn);
    return b;
  }
  function appendProfile(root) {
    var who = sessionWho();
    var box = el("div", "ubz-r215-who");
    var grid = el("div", "ubz-r215-grid");
    box.appendChild(el("strong", "", who.name));
    box.appendChild(el("span", "", [who.mail, who.role].filter(Boolean).join(" · ") || "Account"));
    root.appendChild(el("h2", "ubz-r215-section", "PROFILE"));
    root.appendChild(box);
    grid.style.gridTemplateColumns = "1fr";
    grid.appendChild(profileAction("Account information", "Name, contact and shop details", function() {
      clickProfile(["edit profile", "profile"]);
    }, false));
    grid.appendChild(profileAction("Language", "Change the interface language", clickLanguage, false));
    grid.appendChild(profileAction("Change password", "Update your account password", function() {
      clickProfile(["change password"]);
    }, false));
    grid.appendChild(profileAction("Face ID / fingerprint", bioRecord() && bioRecord().id ? "Unlock this device with biometrics" : "Enable Face ID or fingerprint on this device", enrollBio, false));
    grid.appendChild(profileAction("Log out", "End this session on this device", function() {
      showBioLock(false);
      clickProfile(["sign out", "log out", "logout"]);
    }, true));
    root.appendChild(grid);
  }
  function appendDates(root) {
    var dates, go, saved, today, a, b;
    if (root.querySelector(".ubz-r215-dates")) { return; }
    dates = el("div", "ubz-r215-dates");
    dates.appendChild(el("span", "ubz-r215-dl", "From"));
    a = el("input", "ubz-r215-di");
    a.type = "date";
    a.id = "ubz-r215-from";
    dates.appendChild(a);
    dates.appendChild(el("span", "ubz-r215-dl", "To"));
    b = el("input", "ubz-r215-di");
    b.type = "date";
    b.id = "ubz-r215-to";
    dates.appendChild(b);
    go = el("button", "ubz-r215-go", "Go");
    go.type = "button";
    dates.appendChild(go);
    saved = readSavedRange(hubKind());
    today = bizISODate();
    a.value = (saved && saved.from) || monthStart(today);
    b.value = (saved && saved.to) || today;
    a.setAttribute("data-ubz-date-mod", hubKind() || "");
    b.setAttribute("data-ubz-date-mod", hubKind() || "");
    function apply() {
      var kind = hubKind();
      if (b.value > today) { b.value = today; }
      if (a.value > b.value) { a.value = b.value; }
      saveRange(a.value, b.value, kind);
      a.setAttribute("data-ubz-date-mod", kind || "");
      b.setAttribute("data-ubz-date-mod", kind || "");
      window.__UBZ_R215_PAINTED__ = "";
      loadHubExtras(kind);
      if (window.__UBZ_R215_DESK__) { loadDesk(kind, window.__UBZ_R215_DESK__); }
    }
    go.addEventListener("click", apply);
    a.addEventListener("change", apply);
    b.addEventListener("change", apply);
    root.appendChild(dates);
  }
  function drawBars(hostId, pts) {
    var host = document.getElementById(hostId);
    var wrap, col, bar, max, min, base, i, pct, out, inn, net, chip;
    if (!host) { return; }
    while (host.firstChild) { host.removeChild(host.firstChild); }
    if (!pts || !pts.length) {
      host.appendChild(el("p", "ubz-r215-empty", "No movement in this range"));
      return;
    }
    max = pts[0].value;
    min = pts[0].value;
    for (i = 1; i < pts.length; i += 1) {
      if (pts[i].value > max) { max = pts[i].value; }
      if (pts[i].value < min) { min = pts[i].value; }
    }
    base = 0;
    if (min > 0 && (max - min) < (max * 0.25)) { base = Math.max(0, min - Math.max(max - min, min * 0.004, 1)); }
    if (!(max > base)) { max = base + 1; }
    wrap = el("div", "ubz-r215-bars");
    for (i = 0; i < pts.length; i += 1) {
      col = el("div", "ubz-r215-barcol");
      pct = Math.max(8, Math.round(((pts[i].value - base) / (max - base)) * 100));
      bar = el("i", "");
      bar.style.height = pct + "%";
      col.appendChild(el("strong", "", fmt(pts[i].value)));
      col.appendChild(bar);
      col.appendChild(el("span", "", pts[i].label));
      out = num(pts[i].out);
      inn = num(pts[i].inn);
      net = pts[i].net != null ? num(pts[i].net) : (inn - out);
      chip = el("em", out > 0 ? "is-down" : "is-mute", out > 0 ? ("▼ " + fmt(out)) : "▼ —");
      chip.title = "Decrease (sales COGS, returns, expired)";
      col.appendChild(chip);
      chip = el("em", inn > 0 ? "is-up" : "is-mute", inn > 0 ? ("▲ " + fmt(inn)) : "▲ —");
      chip.title = "New inventory recorded that day";
      col.appendChild(chip);
      if (Math.abs(net) > 0.5) {
        chip = el("em", net > 0 ? "is-net-up" : "is-net-down", (net > 0 ? "◆ +" : "◆ ") + fmt(Math.abs(net)));
      } else {
        chip = el("em", "is-mute", "◆ —");
      }
      chip.title = "Net change (new stock − decrease)";
      col.appendChild(chip);
      wrap.appendChild(col);
    }
    host.appendChild(wrap);
  }
  function fillStmt(id, rows, emptyText) {
    var host = document.getElementById(id);
    var i, line, left;
    if (!host) { return; }
    while (host.firstChild) { host.removeChild(host.firstChild); }
    if (!rows || !rows.length) {
      host.appendChild(el("p", "ubz-r215-empty", emptyText || "No rows in this range"));
      return;
    }
    for (i = 0; i < rows.length; i += 1) {
      line = el("article", "ubz-r215-line");
      left = el("div", "");
      left.appendChild(el("strong", "", rows[i].name));
      if (rows[i].meta) { left.appendChild(el("span", "", rows[i].meta)); }
      line.appendChild(left);
      line.appendChild(el("em", "", rows[i].value));
      if (rows[i].action) { line.appendChild(rows[i].action); }
      host.appendChild(line);
    }
  }
  function stmtTitle(title) {
    if (title === "Profit & Loss") { return "Statement of Profit or Loss"; }
    if (title === "Balance Sheet") { return "Statement of Financial Position"; }
    if (title === "Cash Flow") { return "Statement of Cash Flows"; }
    if (title === "Receivables") { return "Accounts Receivable"; }
    if (title === "Payables") { return "Accounts Payable"; }
    if (title === "Income") { return "Income Register"; }
    if (title === "Expenses") { return "Expense Statement"; }
    if (title === "Banking") { return "Cash and Bank Position"; }
    if (title === "Accounting") { return "General Ledger Extract"; }
    return title;
  }
  function rowKind(name) {
    var n = String(name || "").toLowerCase();
    if (/^net |profit after|comprehensive income|retained/.test(n)) { return "is-net"; }
    if (/^total |^gross |equity|total assets|total liabilit/.test(n)) { return "is-total"; }
    return "";
  }
  function paintStatement(host, title, rows, emptyText, periods) {
    var paper, head, cols, i, row, sec, cls, lastSec, j, nCols, grid;
    periods = periods || [];
    nCols = periods.length || 1;
    grid = nCols > 1 ? ("minmax(92px, 1.3fr) repeat(" + nCols + ", minmax(48px, 1fr))") : "1fr auto";
    if (!host) { return; }
    while (host.firstChild) { host.removeChild(host.firstChild); }
    paper = el("section", "ubz-r215-stmt-paper");
    head = el("div", "ubz-r215-stmt-head");
    head.appendChild(el("strong", "", shopName()));
    head.appendChild(el("em", "", stmtTitle(title)));
    if (nCols > 1) {
      head.appendChild(el("span", "", "Comparative " + periods[0].label + " · " + periods[1].label + " · " + periods[2].label + " · Amounts in RWF"));
    } else {
      head.appendChild(el("span", "", "Period " + capRange(rangeFrom(), rangeTo()) + " · Amounts in RWF"));
    }
    paper.appendChild(head);
    if (!rows || !rows.length) {
      paper.appendChild(el("p", "ubz-r215-empty", emptyText || "No rows in this range"));
      host.appendChild(paper);
      return;
    }
    cols = el("div", "ubz-r215-stmt-cols");
    cols.style.gridTemplateColumns = grid;
    cols.appendChild(el("span", "", "Description"));
    if (nCols > 1) {
      for (j = 0; j < nCols; j += 1) { cols.appendChild(el("span", "", periods[j].label)); }
    } else {
      cols.appendChild(el("span", "", "Amount"));
    }
    paper.appendChild(cols);
    lastSec = "";
    for (i = 0; i < rows.length; i += 1) {
      sec = String(rows[i].section || rows[i].meta || "").trim();
      if (sec && sec !== lastSec && !/^\d/.test(sec) && sec.length < 28) {
        paper.appendChild(el("p", "ubz-r215-stmt-sec", sec));
        lastSec = sec;
      }
      cls = "ubz-r215-stmt-row " + (rows[i].kind || rowKind(rows[i].name));
      row = el("div", cls);
      row.style.gridTemplateColumns = grid;
      row.appendChild(el("span", "", rows[i].name));
      if (rows[i].values) {
        for (j = 0; j < nCols; j += 1) {
          row.appendChild(el("b", "", rows[i].values[j] == null ? "—" : money(rows[i].values[j])));
        }
      } else {
        row.appendChild(el("b", "", rows[i].value));
      }
      paper.appendChild(row);
    }
    paper.appendChild(el("p", "ubz-r215-stmt-note", nCols > 1
      ? "Comparative periods use the same calendar window shifted by one and two months. Figures are taken from recorded sales, batch costs and the commercial ledger."
      : "Figures are taken from recorded sales, batch costs and the commercial ledger for the selected period."));
    host.appendChild(paper);
  }
  function field(label, type, id, value) {
    var wrap = el("label", "");
    var inp;
    wrap.appendChild(el("span", "", label));
    inp = el("input", "");
    inp.type = type;
    inp.id = id;
    if (value != null) { inp.value = value; }
    if (type === "number") { inp.min = "0"; inp.step = "1"; inp.inputMode = "decimal"; }
    wrap.appendChild(inp);
    return wrap;
  }
  /*
   * AQUILA_R216_MOBILE_EXPENSE_CANONICAL_DELEGATION
   *
   * Mobile Finance -> Expenses must not maintain a second
   * Expense capture or approval implementation.
   *
   * Record Expense delegates to the canonical R29/R18 owner.
   * Approve Expenses delegates to the canonical R29 queue.
   *
   * No API implementation is duplicated here.
   * No auth/session/storage mutation is introduced.
   * Retry is finite and local to a user click.
   */
  function r216ExpenseMessage(text) {
    var body =
      document.getElementById("ubz-r215-desk");
    var msg;

    if (!body) { return; }

    msg =
      document.getElementById("ubz-r216-expense-msg");

    if (!msg) {
      msg =
        el(
          "p",
          "ubz-r215-empty",
          ""
        );

      msg.id =
        "ubz-r216-expense-msg";

      body.appendChild(msg);
    }

    msg.textContent =
      text || "";
  }

  function r216CanonicalExpenseTarget(mode) {
    if (mode === "record") {
      return document.querySelector(
        '.aq-expenses-actions [data-action="record"],'
        + ' [data-aquila-action="open-record"]'
      );
    }

    return document.querySelector(
      '.aq-expenses-actions [data-action="approvals"],'
      + ' [data-aquila-action="open-queue"]'
    );
  }

  function openCanonicalExpenseFromMobile(
    mode,
    button
  ) {
    var tries = 0;
    var maxTries = 12;
    var original =
      mode === "record"
        ? "Record Expense"
        : "Approve Expenses";

    function restoreButton() {
      if (!button) { return; }

      button.disabled = false;
      button.textContent = original;
    }

    function succeeded() {
      restoreButton();
      r216ExpenseMessage("");
    }

    function attempt() {
      var target;
      var r18;
      var bridge;

      tries += 1;

      try {
        target =
          r216CanonicalExpenseTarget(mode);

        /*
         * Do not call R18 until its canonical target
         * actually exists. This prevents a false success.
         */
        if (target) {
          if (mode === "record") {
            r18 =
              window
                .__AQUILA_FINANCE_EXPENSES_R18__;

            if (
              r18
              &&
              typeof r18.openRecordExpense
                === "function"
            ) {
              r18.openRecordExpense();
            } else {
              target.click();
            }

            succeeded();
            return;
          }

          bridge =
            window
              .__AQUILA_FINANCE_EXPENSES_R4B1_1__;

          if (
            bridge
            &&
            typeof bridge.openQueue
              === "function"
          ) {
            bridge.openQueue();
          } else {
            target.click();
          }

          succeeded();
          return;
        }
      } catch (_r216OpenError) {}

      if (tries < maxTries) {
        if (
          typeof window.requestAnimationFrame
            === "function"
        ) {
          window.requestAnimationFrame(
            attempt
          );
        } else {
          window.setTimeout(
            attempt,
            16
          );
        }

        return;
      }

      restoreButton();

      r216ExpenseMessage(
        "The canonical Expense workspace is still loading. Please try again."
      );
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Opening…";
    }

    r216ExpenseMessage("");

    attempt();
  }

  /* AQUILA_R217_FINAL_NATIVE_MOBILE_EXPENSES */

  var r217RefPromise = null;
  var r217ActiveApp = null;

  function r217Escape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function r217Money(value) {
    var n = Number(value || 0);
    try {
      return new Intl.NumberFormat("en-RW", {
        style: "currency",
        currency: "RWF",
        maximumFractionDigits: 0
      }).format(n);
    } catch (_e) {
      return Math.round(n).toLocaleString() + " RWF";
    }
  }

  function r217Data(payload) {
    if (
      payload &&
      payload.data &&
      typeof payload.data === "object" &&
      !Array.isArray(payload.data)
    ) {
      return payload.data;
    }
    return payload || {};
  }

  function r217Array(payload, keys) {
    var root = payload || {};
    var data = r217Data(root);
    var i, key;

    if (Array.isArray(root)) { return root; }
    if (Array.isArray(root.data)) { return root.data; }

    for (i = 0; i < keys.length; i += 1) {
      key = keys[i];
      if (Array.isArray(root[key])) { return root[key]; }
      if (Array.isArray(data[key])) { return data[key]; }
    }

    return [];
  }

  function r217Error(payload, fallback) {
    var data = payload || {};
    var errors, key;

    if (data.message) { return String(data.message); }
    if (data.error) { return String(data.error); }

    errors = data.errors;
    if (errors && typeof errors === "object") {
      for (key in errors) {
        if (Object.prototype.hasOwnProperty.call(errors, key)) {
          if (Array.isArray(errors[key]) && errors[key].length) {
            return String(errors[key][0]);
          }
          if (errors[key]) { return String(errors[key]); }
        }
      }
    }

    return fallback || "Unable to complete this Expense action.";
  }

  function r217Api(path, method, body, extraHeaders) {
    var token =
      typeof authToken === "function"
        ? String(authToken() || "")
        : "";

    var tenant =
      typeof tenantSlug === "function"
        ? String(tenantSlug() || "")
        : "";

    var headers = {
      "Accept": "application/json",
      "Content-Type": "application/json"
    };

    var key;

    if (!token) {
      return Promise.reject(
        new Error("Your authenticated session is required.")
      );
    }

    if (!tenant) {
      return Promise.reject(
        new Error("Your pharmacy tenant context is required.")
      );
    }

    headers.Authorization = "Bearer " + token;
    headers["X-Tenant-Slug"] = tenant;

    if (extraHeaders) {
      for (key in extraHeaders) {
        if (Object.prototype.hasOwnProperty.call(extraHeaders, key)) {
          headers[key] = extraHeaders[key];
        }
      }
    }

    return fetch("/api/v1" + path, {
      method: method || "GET",
      headers: headers,
      credentials: "same-origin",
      cache: "no-store",
      body: body == null ? undefined : JSON.stringify(body)
    }).then(function(response) {
      return response.text().then(function(raw) {
        var payload = {};
        if (raw) {
          try { payload = JSON.parse(raw); }
          catch (_json) { payload = { message: raw }; }
        }

        if (!response.ok) {
          throw new Error(
            r217Error(
              payload,
              "Expense request failed (" + response.status + ")."
            )
          );
        }

        return payload;
      });
    });
  }

  /*
   * AQUILA_R218_EXPENSE_ITEM_NATIVE_PICKER
   * Dedicated presentation owner.
   * No observer, polling, reload or storage mutation.
   */
  function r218EnsurePickerStyle() {
    var id =
      "aquila-r218-expense-item-picker-style";

    if (
      document.getElementById(id)
    ) {
      return;
    }

    var style =
      document.createElement(
        "style"
      );

    style.id = id;

    style.textContent = `
      .r218-item-sheet-panel {
        width: min(430px, 100%);
        height: 92vh;
        max-height: 92vh;
        overflow: auto;
        overscroll-behavior: contain;
        border-radius: 24px 24px 0 0;
      }

      .r218-picker-tools {
        position: sticky;
        top: 0;
        z-index: 4;
        padding: 10px 2px 10px;
        background: #fff;
        border-bottom: 1px solid #eef1f5;
      }

      .r218-picker-search {
        width: 100%;
        min-height: 50px;
        margin: 0;
        padding: 0 15px;
        border: 1px solid #d0d5dd;
        border-radius: 15px;
        background: #f8fafc;
        color: #101828;
        font-size: 16px;
        outline: none;
      }

      .r218-picker-search:focus {
        border-color: #6172f3;
        background: #fff;
        box-shadow:
          0 0 0 3px
          rgba(97, 114, 243, .10);
      }

      .r218-picker-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 3px 0;
        color: #667085;
        font-size: 12px;
      }

      .r218-picker-list {
        padding: 2px 0 22px;
      }

      .r218-item-card {
        width: 100%;
        min-height: 78px;
        display: grid;
        grid-template-columns:
          minmax(0, 1fr) 30px;
        align-items: center;
        gap: 12px;
        margin-top: 10px;
        padding: 14px 12px 14px 15px;
        text-align: left;
        border: 1px solid #e4e7ec;
        border-radius: 17px;
        background: #fff;
        box-shadow:
          0 1px 2px
          rgba(16, 24, 40, .04);
        -webkit-tap-highlight-color:
          transparent;
      }

      .r218-item-card:active {
        transform: scale(.995);
      }

      .r218-item-card[data-selected="true"] {
        border-color: #6172f3;
        background: #f5f7ff;
        box-shadow:
          0 0 0 1px
          rgba(97, 114, 243, .08);
      }

      .r218-item-copy {
        min-width: 0;
        display: grid;
        gap: 8px;
      }

      .r218-item-name {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 15px;
        line-height: 1.3;
        font-weight: 750;
        color: #101828;
      }

      .r218-item-meta {
        min-width: 0;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px 8px;
      }

      .r218-item-category {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        max-width: 100%;
        padding: 3px 9px;
        border-radius: 999px;
        background: #f2f4f7;
        color: #344054;
        font-size: 11px;
        line-height: 1.2;
        font-weight: 700;
      }

      .r218-item-account {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #667085;
        font-size: 12px;
        line-height: 1.35;
      }

      .r218-item-check {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: #6172f3;
        color: #fff;
        font-size: 14px;
        font-weight: 800;
      }

      .r218-item-check[data-empty="true"] {
        border: 1px solid #d0d5dd;
        background: #fff;
        color: transparent;
      }

      @media (max-width: 430px) {
        .r218-item-sheet-panel {
          width: 100%;
          height: 92vh;
          max-height: 92vh;
        }

        .r218-item-card {
          min-height: 80px;
        }
      }
    `;

    (
      document.head
      ||
      document.documentElement
    ).appendChild(style);
  }

  function r217Reference() {
    if (!r217RefPromise) {
      r217RefPromise =
        r217Api(
          "/pharmaco/expenses/reference-data",
          "GET"
        ).then(function(payload) {
          return r217Data(payload);
        }).catch(function(error) {
          r217RefPromise = null;
          throw error;
        });
    }

    return r217RefPromise;
  }

  function r217Items(ref) {
    return r217Array(
      ref,
      ["expense_items", "items"]
    ).filter(function(item) {
      return (
        item &&
        item.id &&
        String(item.name || "").trim() &&
        Number(
          item.finance_chart_of_account_id ||
          (item.account && item.account.id) ||
          0
        ) > 0 &&
        (
          !item.status ||
          String(item.status).toLowerCase() === "active"
        )
      );
    });
  }

  function r217ItemAccountId(item) {
    return Number(
      (item && item.finance_chart_of_account_id) ||
      (item && item.account && item.account.id) ||
      0
    );
  }

  function r217ItemAccount(item) {
    var code =
      String(
        (item && item.account_code) ||
        (item && item.account && item.account.code) ||
        ""
      ).trim();

    var name =
      String(
        (item && item.account_name) ||
        (item && item.account && item.account.name) ||
        ""
      ).trim();

    if (code && name) { return code + " — " + name; }
    return code || name || "Linked expense account";
  }

  function r217Payees(ref) {
    return r217Array(
      ref,
      ["payee_users", "users"]
    ).filter(function(user) {
      return (
        user &&
        (
          !user.status ||
          String(user.status).toLowerCase() === "active"
        )
      );
    }).map(function(user) {
      var name =
        String(
          user.name ||
          user.full_name ||
          user.display_name ||
          ""
        ).trim();

      var email = String(user.email || "").trim();

      return {
        name: name || email,
        label:
          name && email
            ? name + " — " + email
            : (name || email)
      };
    }).filter(function(user) {
      return Boolean(user.name);
    });
  }

  function r217PaymentChoices(ref) {
    var raw =
      ref.payment_sources ||
      ref.payment_source_options ||
      ref.paymentSources ||
      [];

    var rows = [];

    if (Array.isArray(raw)) {
      rows = raw.map(function(row) {
        if (typeof row === "string") {
          return { value: row, label: row.replace(/_/g, " ") };
        }
        return {
          value: String(
            row.value ||
            row.code ||
            row.key ||
            row.id ||
            ""
          ),
          label: String(
            row.label ||
            row.name ||
            row.value ||
            row.code ||
            ""
          )
        };
      });
    } else if (raw && typeof raw === "object") {
      rows = Object.keys(raw).map(function(key) {
        return { value: key, label: String(raw[key] || key) };
      });
    }

    rows = rows.filter(function(row) {
      return Boolean(row.value);
    });

    if (!rows.length) {
      rows = [
        { value: "cash", label: "Cash" },
        { value: "bank", label: "Bank" },
        { value: "mobile_money", label: "Mobile money" }
      ];
    }

    return rows;
  }

  function r217CurrentDate(ref) {
    var value =
      ref.current_business_date ||
      ref.business_date ||
      "";

    if (value) { return String(value).slice(0, 10); }

    return new Date().toISOString().slice(0, 10);
  }

  function r217Key() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return (
      "r217-" +
      Date.now() +
      "-" +
      Math.random().toString(16).slice(2)
    );
  }

  function r217ExpenseFrom(payload) {
    var data = r217Data(payload);
    var expense =
      data.expense ||
      payload.expense ||
      data;

    return (
      expense &&
      typeof expense === "object"
        ? expense
        : {}
    );
  }

  function r217EnsureStyle() {
    if (document.getElementById("aquila-r217-native-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "aquila-r217-native-style";
    style.textContent = `
      .r217-app{position:fixed;inset:0;z-index:2147483000;background:#f4f7fb;color:#172033;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:auto}
      .r217-frame{min-height:100%;max-width:430px;margin:0 auto;background:#f4f7fb;display:flex;flex-direction:column}
      .r217-top{position:sticky;top:0;z-index:8;display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,.97);border-bottom:1px solid #e7ebf1;backdrop-filter:blur(12px)}
      .r217-back,.r217-icon{width:40px;height:40px;border:0;border-radius:12px;background:#eef2f7;color:#1f2937;font-size:20px;font-weight:700}
      .r217-heading h1{margin:0;font-size:18px;line-height:1.2}.r217-heading p{margin:3px 0 0;color:#667085;font-size:12px}
      .r217-main{flex:1;padding:14px 14px 96px}.r217-card{background:#fff;border:1px solid #e5eaf1;border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:0 7px 24px rgba(16,24,40,.04)}
      .r217-card h2{margin:0 0 4px;font-size:15px}.r217-help{margin:0 0 12px;color:#667085;font-size:12px;line-height:1.45}
      .r217-field{display:block;margin:0 0 13px}.r217-field:last-child{margin-bottom:0}.r217-field span{display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#344054}
      .r217-field input,.r217-field select,.r217-field textarea,.r217-item-trigger,.r217-search,.r217-reason{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:13px;background:#fff;color:#101828;font:inherit;font-size:15px;padding:12px 13px;outline:none}
      .r217-field input:focus,.r217-field select:focus,.r217-field textarea:focus,.r217-search:focus,.r217-reason:focus{border-color:#6172f3;box-shadow:0 0 0 3px rgba(97,114,243,.12)}
      .r217-field textarea{min-height:88px;resize:vertical}
      .r217-item-trigger{text-align:left;min-height:54px}.r217-item-trigger strong{display:block;font-size:14px}.r217-item-trigger small{display:block;margin-top:4px;color:#667085;font-size:11px}
      .r217-account{padding:11px 12px;border-radius:12px;background:#f8fafc;border:1px dashed #cbd5e1}.r217-account b{display:block;font-size:12px}.r217-account small{color:#667085}
      .r217-status{display:none;margin:0 0 12px;padding:10px 12px;border-radius:12px;font-size:12px;line-height:1.4}.r217-status[data-kind="ok"]{display:block;background:#ecfdf3;color:#027a48}.r217-status[data-kind="error"]{display:block;background:#fef3f2;color:#b42318}.r217-status[data-kind="busy"]{display:block;background:#eef4ff;color:#3538cd}
      .r217-dock{position:fixed;left:50%;bottom:0;z-index:9;width:min(430px,100%);transform:translateX(-50%);display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:7px;padding:10px 10px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.98);border-top:1px solid #e4e7ec}
      .r217-dock button,.r217-primary,.r217-secondary,.r217-danger{border:0;border-radius:12px;padding:11px 8px;font-size:12px;font-weight:750;line-height:1.15;min-height:44px}.r217-dock button:disabled,.r217-primary:disabled,.r217-secondary:disabled,.r217-danger:disabled{opacity:.45}
      .r217-dock button:nth-child(1),.r217-secondary{background:#eef2f7;color:#344054}.r217-dock button:nth-child(2),.r217-primary{background:#203a73;color:#fff}.r217-dock button:nth-child(3){background:#fff;border:1px solid #d0d5dd;color:#344054}.r217-danger{background:#fee4e2;color:#b42318}
      .r217-sheet-wrap{position:fixed;inset:0;z-index:2147483100;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;padding:0}
      .r217-sheet{width:min(430px,100%);max-height:86vh;overflow:auto;background:#fff;border-radius:24px 24px 0 0;padding:14px 14px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -18px 50px rgba(15,23,42,.2)}
      .r217-grab{width:42px;height:4px;border-radius:99px;background:#d0d5dd;margin:0 auto 12px}.r217-sheet-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.r217-sheet-head h2{margin:0;font-size:17px}.r217-sheet-head p{margin:4px 0 0;color:#667085;font-size:12px}.r217-sheet-close{border:0;border-radius:10px;background:#f2f4f7;width:34px;height:34px;font-size:18px}
      .r217-item-row{width:100%;text-align:left;border:1px solid #eaecf0;border-radius:14px;background:#fff;padding:12px;margin-top:9px}.r217-item-row b{display:block;font-size:13px}.r217-item-row span{display:block;margin-top:3px;color:#475467;font-size:12px}.r217-item-row small{display:block;margin-top:4px;color:#667085;font-size:11px}
      .r217-queue{display:grid;gap:10px}.r217-queue-card{background:#fff;border:1px solid #e4e7ec;border-radius:16px;padding:14px}.r217-queue-card h3{margin:0 0 8px;font-size:15px}.r217-kv{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-top:1px solid #f2f4f7;font-size:12px}.r217-kv span{color:#667085}.r217-kv strong{text-align:right;font-weight:700}
      .r217-review{margin-top:10px;width:100%;border:0;border-radius:12px;padding:11px;background:#eef2ff;color:#3538cd;font-weight:750}.r217-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.r217-actions.three{grid-template-columns:1fr 1fr 1fr}
      .r217-empty{text-align:center;color:#667085;padding:30px 14px;font-size:13px}
      @media (min-width:768px){.r217-app{background:rgba(15,23,42,.22)}.r217-frame{box-shadow:0 0 55px rgba(15,23,42,.18)}}
      @media (max-width:360px){.r217-main{padding-left:10px;padding-right:10px}.r217-dock{gap:5px;padding-left:7px;padding-right:7px}.r217-dock button{font-size:11px;padding-left:5px;padding-right:5px}}
    `;
    document.head.appendChild(style);
  }

  function r217CloseApp() {
    if (r217ActiveApp && r217ActiveApp.parentNode) {
      r217ActiveApp.parentNode.removeChild(r217ActiveApp);
    }
    r217ActiveApp = null;
  }

  function r217App(title, subtitle) {
    r217EnsureStyle();
    r217CloseApp();

    var app = document.createElement("section");
    app.className = "r217-app";
    app.setAttribute("data-r217-native-app", "1");
    app.innerHTML = `
      <div class="r217-frame">
        <header class="r217-top">
          <button type="button" class="r217-back" aria-label="Back">‹</button>
          <div class="r217-heading">
            <h1>${r217Escape(title)}</h1>
            <p>${r217Escape(subtitle || "Finance • Expenses")}</p>
          </div>
          <span></span>
        </header>
        <main class="r217-main" data-r217-main>
          <div class="r217-status" data-r217-status></div>
        </main>
      </div>
    `;

    app.querySelector(".r217-back").addEventListener("click", r217CloseApp);
    document.body.appendChild(app);
    r217ActiveApp = app;
    return app;
  }

  function r217Status(app, message, kind) {
    var node = app && app.querySelector("[data-r217-status]");
    if (!node) { return; }

    if (!message) {
      node.textContent = "";
      node.removeAttribute("data-kind");
      return;
    }

    node.textContent = String(message);
    node.setAttribute("data-kind", kind || "ok");
  }

  function r217Sheet(app, title, subtitle, content) {
    var old = app.querySelector(".r217-sheet-wrap");
    if (old) { old.remove(); }

    var wrap = document.createElement("div");
    wrap.className = "r217-sheet-wrap";
    wrap.innerHTML = `
      <section class="r217-sheet" role="dialog" aria-modal="true">
        <div class="r217-grab"></div>
        <div class="r217-sheet-head">
          <div>
            <h2>${r217Escape(title)}</h2>
            <p>${r217Escape(subtitle || "")}</p>
          </div>
          <button type="button" class="r217-sheet-close" aria-label="Close">×</button>
        </div>
        <div data-r217-sheet-body>${content || ""}</div>
      </section>
    `;

    function close() { wrap.remove(); }

    wrap.querySelector(".r217-sheet-close").addEventListener("click", close);
    wrap.addEventListener("click", function(event) {
      if (event.target === wrap) { close(); }
    });

    app.appendChild(wrap);
    return wrap;
  }

  function r217SyncForm(app, state) {
    var main = app.querySelector("[data-r217-main]");
    var node;

    node = main.querySelector("[name=business_date]");
    if (node) { state.businessDate = node.value; }

    node = main.querySelector("[name=payment_source]");
    if (node) { state.payment = node.value; }

    node = main.querySelector("[name=payee_name]");
    if (node) { state.payee = node.value; }

    node = main.querySelector("[name=reference_number]");
    if (node) { state.reference = node.value; }

    node = main.querySelector("[name=notes]");
    if (node) { state.notes = node.value; }

    node = main.querySelector("[name=amount]");
    if (node) { state.amount = node.value; }
  }

  /*
   * AQUILA_R218_EXPENSE_ITEM_NATIVE_PICKER_LOGIC
   *
   * The Item name is the primary choice.
   * Category and linked account are supporting system metadata.
   * Current form values are synchronized before opening the picker,
   * therefore changing Expense Item does not erase Amount.
   */
  function r217OpenItemPicker(app, state) {
    r217SyncForm(app, state);
    r218EnsurePickerStyle();

    var sheet =
      r217Sheet(
        app,
        "Expense Item",
        "Select the item for this expense.",
        `
          <div class="r218-picker-tools">
            <input
              class="r218-picker-search"
              type="search"
              inputmode="search"
              autocomplete="off"
              placeholder="Search expense items"
              aria-label="Search Expense Items"
              data-r217-item-search
            >
            <div class="r218-picker-summary">
              <span>Expense Items</span>
              <strong data-r218-item-count></strong>
            </div>
          </div>

          <div
            class="r218-picker-list"
            role="listbox"
            aria-label="Expense Items"
            data-r217-item-list
          ></div>
        `
      );

    var panel =
      (
        sheet.matches
        && sheet.matches(".r217-sheet")
      )
        ? sheet
        : sheet.querySelector(
            ".r217-sheet"
          );

    if (panel) {
      panel.classList.add(
        "r218-item-sheet-panel"
      );
    }

    var search =
      sheet.querySelector(
        "[data-r217-item-search]"
      );

    var list =
      sheet.querySelector(
        "[data-r217-item-list]"
      );

    var count =
      sheet.querySelector(
        "[data-r218-item-count]"
      );

    var items =
      r217Items(state.ref);

    function paint() {
      var query =
        String(search.value || "")
          .trim()
          .toLowerCase();

      var filtered =
        items.filter(function(item) {
          if (!query) {
            return true;
          }

          return [
            item.name,
            item.group_name,
            item.code,
            r217ItemAccount(item)
          ].some(function(value) {
            return String(value || "")
              .toLowerCase()
              .indexOf(query) >= 0;
          });
        });

      count.textContent =
        String(filtered.length)
        + (
          filtered.length === 1
            ? " item"
            : " items"
        );

      if (!filtered.length) {
        list.innerHTML =
          '<div class="r217-empty">'
          + 'No Expense Items match this search.'
          + '</div>';

        return;
      }

      var selectedId =
        String(
          state.selectedItem
          && state.selectedItem.id != null
            ? state.selectedItem.id
            : ""
        );

      list.innerHTML =
        filtered
          .map(function(item, index) {
            var selected =
              String(item.id)
              ===
              selectedId;

            var category =
              String(
                item.group_name || ""
              ).trim();

            var account =
              String(
                r217ItemAccount(item)
                || ""
              ).trim();

            return `
              <button
                type="button"
                class="r218-item-card"
                role="option"
                aria-selected="${
                  selected
                    ? "true"
                    : "false"
                }"
                data-selected="${
                  selected
                    ? "true"
                    : "false"
                }"
                data-r217-pick="${index}"
              >
                <span class="r218-item-copy">

                  <strong
                    class="r218-item-name"
                  >${
                    r217Escape(
                      item.name || ""
                    )
                  }</strong>

                  <span
                    class="r218-item-meta"
                  >

                    ${
                      category
                        ? (
                            '<span '
                            + 'class="r218-item-category">'
                            + r217Escape(category)
                            + '</span>'
                          )
                        : ""
                    }

                    ${
                      account
                        ? (
                            '<span '
                            + 'class="r218-item-account">'
                            + r217Escape(account)
                            + '</span>'
                          )
                        : ""
                    }

                  </span>
                </span>

                <span
                  class="r218-item-check"
                  data-empty="${
                    selected
                      ? "false"
                      : "true"
                  }"
                  aria-hidden="true"
                >${
                  selected
                    ? "&#10003;"
                    : ""
                }</span>

              </button>
            `;
          })
          .join("");

      list
        .querySelectorAll(
          "[data-r217-pick]"
        )
        .forEach(function(button) {
          button.addEventListener(
            "click",
            function() {
              var index =
                Number(
                  button.getAttribute(
                    "data-r217-pick"
                  )
                );

              state.selectedItem =
                filtered[index];

              sheet.remove();

              r217RenderRecord(
                app,
                state,
                "",
                ""
              );
            }
          );
        });
    }

    search.addEventListener(
      "input",
      paint
    );

    paint();
    search.focus();
  }

  function r217Payload(app, state) {
    r217SyncForm(app, state);

    var item = state.selectedItem;
    var accountId = r217ItemAccountId(item);
    var itemName =
      String(item && item.name || "").trim();
    var amount = Number(state.amount || 0);

    if (!state.businessDate) {
      throw new Error("Business date is required.");
    }

    if (!state.payment) {
      throw new Error("Payment source is required.");
    }

    if (!item || !itemName || !accountId) {
      throw new Error("Expense Item is required.");
    }

    if (!(amount > 0)) {
      throw new Error("Amount must be greater than zero.");
    }

    return {
      business_date: state.businessDate,
      supplier_id: null,
      payee_name: state.payee || null,
      payment_source: state.payment,
      reference_number: state.reference || null,
      notes: state.notes || null,
      currency_code: "RWF",
      lines: [
        {
          finance_chart_of_account_id: accountId,
          description: String(item.name || "").trim(),
          amount: amount
        }
      ]
    };
  }

  function r217Persist(app, state) {
    var payload = r217Payload(app, state);
    var expense = state.expense || {};
    var uuid = String(expense.uuid || "");

    if (uuid) {
      payload.expected_version =
        Number(expense.version || expense.lock_version || 0);

      return r217Api(
        "/pharmaco/expenses/" + encodeURIComponent(uuid),
        "PUT",
        payload
      ).then(function(response) {
        state.expense = r217ExpenseFrom(response);
        return state.expense;
      });
    }

    if (!state.idempotencyKey) {
      state.idempotencyKey = r217Key();
    }

    return r217Api(
      "/pharmaco/expenses",
      "POST",
      payload,
      {
        "Idempotency-Key": state.idempotencyKey
      }
    ).then(function(response) {
      state.expense = r217ExpenseFrom(response);
      return state.expense;
    });
  }

  function r217Editable(state) {
    var status =
      String(
        state.expense && state.expense.status || "draft"
      ).toLowerCase();

    return (
      !state.expense ||
      !state.expense.uuid ||
      status === "draft" ||
      status === "rejected"
    );
  }

  function r217RenderRecord(app, state, message, kind) {
    var main = app.querySelector("[data-r217-main]");
    var payments = r217PaymentChoices(state.ref);
    var payees = r217Payees(state.ref);
    var item = state.selectedItem;
    var editable = r217Editable(state);

    var status =
      String(
        state.expense && state.expense.status || "New expense"
      );

    main.innerHTML = `
      <div class="r217-status" data-r217-status></div>

      <section class="r217-card" data-r217-native-record>
        <h2>Record Expense</h2>
        <p class="r217-help">Capture one controlled Expense Item, its linked account and the actual amount.</p>

        <label class="r217-field">
          <span>Business date</span>
          <input type="date" name="business_date" value="${r217Escape(state.businessDate)}" ${editable ? "" : "disabled"}>
        </label>

        <label class="r217-field">
          <span>Payment source</span>
          <select name="payment_source" ${editable ? "" : "disabled"}>
            ${payments.map(function(row) {
              return `<option value="${r217Escape(row.value)}" ${row.value === state.payment ? "selected" : ""}>${r217Escape(row.label)}</option>`;
            }).join("")}
          </select>
        </label>

        <label class="r217-field">
          <span>Payee Name</span>
          <select name="payee_name" ${editable ? "" : "disabled"}>
            <option value="">Select payee</option>
            ${payees.map(function(row) {
              return `<option value="${r217Escape(row.name)}" ${row.name === state.payee ? "selected" : ""}>${r217Escape(row.label)}</option>`;
            }).join("")}
          </select>
        </label>

        <label class="r217-field">
          <span>Reference</span>
          <input type="text" name="reference_number" value="${r217Escape(state.reference)}" placeholder="Receipt, invoice or reference" ${editable ? "" : "disabled"}>
        </label>
      </section>

      <section class="r217-card">
        <h2>Expense Item</h2>
        <p class="r217-help">Choose the controlled item. Its account is linked automatically.</p>

        <button type="button" class="r217-item-trigger" data-r217-native-item-picker ${editable ? "" : "disabled"}>
          <strong>${r217Escape(item ? item.name : "Choose Expense Item")}</strong>
          <small>${r217Escape(item ? (item.group_name || "Uncategorized") : "Required")}</small>
        </button>

        <div class="r217-account" style="margin-top:10px">
          <b>Expense account</b>
          <small>${r217Escape(item ? r217ItemAccount(item) : "Select an Expense Item first")}</small>
        </div>

        <label class="r217-field" style="margin-top:13px">
          <span>Amount (RWF)</span>
          <input type="number" inputmode="decimal" min="0.01" step="0.01" name="amount" value="${r217Escape(state.amount)}" placeholder="0" ${editable ? "" : "disabled"}>
        </label>
      </section>

      <section class="r217-card">
        <h2>Business note</h2>
        <label class="r217-field">
          <span>Purpose / notes</span>
          <textarea name="notes" placeholder="Optional operational context" ${editable ? "" : "disabled"}>${r217Escape(state.notes)}</textarea>
        </label>
        <div class="r217-account">
          <b>Status</b>
          <small>${r217Escape(status)}</small>
        </div>
      </section>

      <div class="r217-dock">
        <button type="button" data-r217-save ${editable ? "" : "disabled"}>Save Draft</button>
        <button type="button" data-r217-submit ${editable ? "" : "disabled"}>Submit for Approval</button>
        <button type="button" data-r217-new>+ New Expense</button>
      </div>
    `;

    if (message) {
      r217Status(app, message, kind || "ok");
    }

    var picker = main.querySelector("[data-r217-native-item-picker]");
    if (picker && editable) {
      picker.addEventListener("click", function() {
        r217OpenItemPicker(app, state);
      });
    }

    main.querySelector("[data-r217-save]").addEventListener("click", function() {
      r217Status(app, "Saving draft…", "busy");
      r217Persist(app, state).then(function() {
        r217RenderRecord(app, state, "Draft saved.", "ok");
      }).catch(function(error) {
        r217Status(app, error.message, "error");
      });
    });

    main.querySelector("[data-r217-submit]").addEventListener("click", function() {
      r217Status(app, "Saving and submitting…", "busy");

      r217Persist(app, state)
        .then(function(expense) {
          var uuid = String(expense.uuid || "");
          if (!uuid) {
            throw new Error("Saved Expense UUID was not returned.");
          }

          return r217Api(
            "/pharmaco/expenses/" +
              encodeURIComponent(uuid) +
              "/submit",
            "POST",
            {}
          );
        })
        .then(function(response) {
          state.expense = r217ExpenseFrom(response);
          r217RenderRecord(
            app,
            state,
            "Expense submitted for approval.",
            "ok"
          );
        })
        .catch(function(error) {
          r217Status(app, error.message, "error");
        });
    });

    main.querySelector("[data-r217-new]").addEventListener("click", function() {
      r217SyncForm(app, state);

      var sheet = r217Sheet(
        app,
        "Start a new expense?",
        "A clean Record Expense form will open for the next transaction.",
        `
          <div class="r217-actions">
            <button type="button" class="r217-secondary" data-r217-cancel-new>Cancel</button>
            <button type="button" class="r217-primary" data-r217-start-new>Start New Expense</button>
          </div>
        `
      );

      sheet.querySelector("[data-r217-cancel-new]").addEventListener(
        "click",
        function() { sheet.remove(); }
      );

      sheet.querySelector("[data-r217-start-new]").addEventListener(
        "click",
        function() {
          var payments = r217PaymentChoices(state.ref);

          state.expense = null;
          state.idempotencyKey = r217Key();
          state.selectedItem = null;
          state.amount = "";
          state.businessDate = r217CurrentDate(state.ref);
          state.payment = payments.length ? payments[0].value : "";
          state.payee = "";
          state.reference = "";
          state.notes = "";

          sheet.remove();
          r217RenderRecord(
            app,
            state,
            "Clean Record Expense form ready.",
            "ok"
          );
        }
      );
    });
  }

  function r217OpenRecord() {
    var app = r217App(
      "Record Expense",
      "Finance • Expenses"
    );

    r217Status(app, "Loading Expense controls…", "busy");

    r217Reference().then(function(ref) {
      var payments = r217PaymentChoices(ref);

      var state = {
        ref: ref,
        expense: null,
        idempotencyKey: r217Key(),
        selectedItem: null,
        amount: "",
        businessDate: r217CurrentDate(ref),
        payment: payments.length ? payments[0].value : "",
        payee: "",
        reference: "",
        notes: ""
      };

      r217RenderRecord(app, state, "", "");
    }).catch(function(error) {
      r217Status(app, error.message, "error");
    });
  }

  function r217Denied(ref, action) {
    var denied =
      ref.denied_actions ||
      (ref.capabilities && ref.capabilities.denied_actions) ||
      [];

    return (
      Array.isArray(denied) &&
      denied.map(function(value) {
        return String(value).toLowerCase();
      }).indexOf(String(action).toLowerCase()) >= 0
    );
  }

  function r217QueueRows(payload) {
    return r217Array(
      payload,
      ["queue", "approvals", "expenses", "items", "rows"]
    ).map(function(row) {
      return {
        expense:
          row.expense ||
          row.finance_expense ||
          row,
        approval:
          row.approval ||
          null
      };
    }).filter(function(ctx) {
      return ctx.expense && ctx.expense.uuid;
    });
  }

  function r217ItemMap(ref) {
    var out = {};
    r217Items(ref).forEach(function(item) {
      out[String(item.id)] = item;
    });
    return out;
  }

  function r217ContextItem(ctx, ref) {
    var expense = ctx.expense || {};
    var lines = Array.isArray(expense.lines) ? expense.lines : [];
    var line = lines[0] || {};
    var map = r217ItemMap(ref);

    return (
      line.expense_item ||
      line.expenseItem ||
      map[String(line.finance_expense_item_id || "")] ||
      null
    );
  }

  function r217Review(app, ref, ctx, reload) {
    var expense = ctx.expense || {};
    var lines = Array.isArray(expense.lines) ? expense.lines : [];
    var line = lines[0] || {};
    var item = r217ContextItem(ctx, ref);
    var total =
      Number(expense.total_amount || expense.amount || 0) ||
      lines.reduce(function(sum, row) {
        return sum + Number(row.amount || 0);
      }, 0);

    var submittedBy =
      expense.submitted_by_name ||
      expense.prepared_by_name ||
      expense.submitted_by ||
      expense.prepared_by ||
      "—";

    var allowApprove = !r217Denied(ref, "approve");
    var allowReject = !r217Denied(ref, "reject");

    var sheet = r217Sheet(
      app,
      "Review Expense",
      "Maker-checker and permissions remain enforced by the backend.",
      `
        <div class="r217-kv"><span>Expense Item Category</span><strong>${r217Escape(item && item.group_name || "Uncategorized Expense Item")}</strong></div>
        <div class="r217-kv"><span>Expense Item</span><strong>${r217Escape(item && item.name || line.description || "—")}</strong></div>
        <div class="r217-kv"><span>Expense account</span><strong>${r217Escape(item ? r217ItemAccount(item) : (line.account_name || line.finance_chart_of_account_id || "—"))}</strong></div>
        <div class="r217-kv"><span>Date</span><strong>${r217Escape(expense.business_date || "—")}</strong></div>
        <div class="r217-kv"><span>Amount</span><strong>${r217Escape(r217Money(total))}</strong></div>
        <div class="r217-kv"><span>Submitted by</span><strong>${r217Escape(submittedBy)}</strong></div>
        <div class="r217-kv"><span>Payee</span><strong>${r217Escape(expense.payee_name || "—")}</strong></div>
        <div class="r217-kv"><span>Purpose</span><strong>${r217Escape(expense.purpose || expense.notes || "—")}</strong></div>
        <div class="r217-kv"><span>Reference</span><strong>${r217Escape(expense.reference_number || expense.receipt_number || "—")}</strong></div>

        <div class="r217-actions">
          ${allowReject ? '<button type="button" class="r217-danger" data-r217-reject>Reject</button>' : '<button type="button" class="r217-secondary" disabled>Reject</button>'}
          ${allowApprove ? '<button type="button" class="r217-primary" data-r217-approve>Approve</button>' : '<button type="button" class="r217-secondary" disabled>Approve</button>'}
        </div>
        <div class="r217-status" data-r217-review-status></div>
      `
    );

    function reviewStatus(message, kind) {
      var node = sheet.querySelector("[data-r217-review-status]");
      node.textContent = message || "";
      if (message) { node.setAttribute("data-kind", kind || "ok"); }
      else { node.removeAttribute("data-kind"); }
    }

    var approve = sheet.querySelector("[data-r217-approve]");
    if (approve) {
      approve.addEventListener("click", function() {
        reviewStatus("Approving…", "busy");
        r217Api(
          "/pharmaco/expenses/" +
            encodeURIComponent(expense.uuid) +
            "/approve",
          "POST",
          { comment: null }
        ).then(function() {
          sheet.remove();
          return reload("Expense approved.");
        }).catch(function(error) {
          reviewStatus(error.message, "error");
        });
      });
    }

    var reject = sheet.querySelector("[data-r217-reject]");
    if (reject) {
      reject.addEventListener("click", function() {
        var reason = sheet.querySelector("[data-r217-reason]");

        if (!reason) {
          var actions = sheet.querySelector(".r217-actions");
          actions.insertAdjacentHTML(
            "beforebegin",
            `
              <label class="r217-field">
                <span>Rejection reason</span>
                <textarea class="r217-reason" data-r217-reason placeholder="Reason is required"></textarea>
              </label>
            `
          );
          reject.textContent = "Confirm Reject";
          return;
        }

        var value = String(reason.value || "").trim();

        if (!value) {
          reviewStatus("Rejection reason is required.", "error");
          reason.focus();
          return;
        }

        reviewStatus("Rejecting…", "busy");

        r217Api(
          "/pharmaco/expenses/" +
            encodeURIComponent(expense.uuid) +
            "/reject",
          "POST",
          { comment: value }
        ).then(function() {
          sheet.remove();
          return reload("Expense rejected.");
        }).catch(function(error) {
          reviewStatus(error.message, "error");
        });
      });
    }
  }

  function r217PaintQueue(app, ref, payload, message) {
    var main = app.querySelector("[data-r217-main]");
    var rows = r217QueueRows(payload);

    main.innerHTML = `
      <div class="r217-status" data-r217-status></div>
      <section class="r217-card">
        <h2>Pending Expense approvals</h2>
        <p class="r217-help">Review the controlled Expense Item, account and amount before deciding.</p>
        <div class="r217-queue" data-r217-queue></div>
      </section>
    `;

    if (message) {
      r217Status(app, message, "ok");
    }

    var queue = main.querySelector("[data-r217-queue]");

    if (!rows.length) {
      queue.innerHTML =
        '<div class="r217-empty">No submitted Expenses are waiting for approval.</div>';
      return;
    }

    queue.innerHTML = rows.map(function(ctx, index) {
      var expense = ctx.expense || {};
      var item = r217ContextItem(ctx, ref);
      var amount =
        expense.total_amount ||
        expense.amount ||
        (
          Array.isArray(expense.lines)
            ? expense.lines.reduce(function(sum, line) {
                return sum + Number(line.amount || 0);
              }, 0)
            : 0
        );

      return `
        <article class="r217-queue-card">
          <h3>${r217Escape(item && item.name || expense.number || expense.uuid)}</h3>
          <div class="r217-kv"><span>Category</span><strong>${r217Escape(item && item.group_name || "Uncategorized Expense Item")}</strong></div>
          <div class="r217-kv"><span>Date</span><strong>${r217Escape(expense.business_date || "—")}</strong></div>
          <div class="r217-kv"><span>Amount</span><strong>${r217Escape(r217Money(amount))}</strong></div>
          <div class="r217-kv"><span>Payee</span><strong>${r217Escape(expense.payee_name || "—")}</strong></div>
          <button type="button" class="r217-review" data-r217-review="${index}">Review</button>
        </article>
      `;
    }).join("");

    function reload(nextMessage) {
      return r217Api(
        "/pharmaco/expenses/approval-queue",
        "GET"
      ).then(function(next) {
        r217PaintQueue(app, ref, next, nextMessage);
      });
    }

    queue.querySelectorAll("[data-r217-review]").forEach(function(button) {
      button.addEventListener("click", function() {
        var index = Number(button.getAttribute("data-r217-review"));
        r217Review(app, ref, rows[index], reload);
      });
    });
  }

  function r217OpenApprovals() {
    var app = r217App(
      "Approve Expenses",
      "Finance • Approval queue"
    );

    r217Status(app, "Loading approval queue…", "busy");

    Promise.all([
      r217Reference(),
      r217Api(
        "/pharmaco/expenses/approval-queue",
        "GET"
      )
    ]).then(function(pack) {
      r217PaintQueue(app, pack[0], pack[1], "");
    }).catch(function(error) {
      r217Status(app, error.message, "error");
    });
  }

  /*
   * AQUILA_R218_EXPENSE_STATEMENT_ITEM_NAME
   *
   * Statement Description: canonical Expense Item category (group_name).
   * Statement Amount: actual stored finance_expense_lines.amount.
   * Legacy unlinked line: exact stored line.description only.
   * Linked Expense lines aggregate by Expense Item group_name.
   * No invented Uncategorized reporting row.
   */
  function r217Expenses(payload) {
    var root = payload || {};
    var data = r217Data(root);
    var node =
      root.expenses ||
      data.expenses ||
      root.items ||
      data.items ||
      root.rows ||
      data.rows ||
      null;

    if (Array.isArray(node)) { return node; }

    if (node && typeof node === "object") {
      if (Array.isArray(node.data)) { return node.data; }
      if (Array.isArray(node.items)) { return node.items; }
      if (Array.isArray(node.rows)) { return node.rows; }
    }

    return r217Array(
      payload,
      ["expenses", "items", "rows"]
    );
  }

  /*
   * R218 Statement data authority:
   *
   * Linked line:
   *   finance_expense_item_id
   *   -> system Expense Item
   *   -> Expense Item category (group_name)
   *
   * Legacy unlinked line:
   *   exact stored line.description only
   *
   * Amount:
   *   exact stored line.amount
   *
   * Linked Expense lines aggregate by Expense Item group_name.
   * No assumed "Uncategorized" reporting row.
   */
  function r217ExpenseStatement(
    body,
    from,
    to,
    title,
    show,
    fail
  ) {
    var windows =
      compareWindows(
        from,
        to
      );

    Promise.all(
      [r217Reference()]
        .concat(
          windows.map(
            function(windowRow) {
              return r217Api(
                "/pharmaco/expenses?per_page=200"
                + "&from="
                + encodeURIComponent(
                    windowRow.from
                  )
                + "&to="
                + encodeURIComponent(
                    windowRow.to
                  ),
                "GET"
              );
            }
          )
        )
    )
    .then(function(pack) {
      var ref = pack[0];

      var itemMap =
        r217ItemMap(ref);

      var periodMaps =
        pack
          .slice(1)
          .map(function(payload) {
            var result = {};

            r217Expenses(payload)
              .forEach(
                function(expense) {
                  var lines =
                    Array.isArray(
                      expense.lines
                    )
                      ? expense.lines
                      : [];

                  lines.forEach(
                    function(line) {
                      var item =
                        line.expense_item
                        ||
                        line.expenseItem
                        ||
                        itemMap[
                          String(
                            line
                              .finance_expense_item_id
                            || ""
                          )
                        ]
                        ||
                        null;

                      var description =
                        (
                          item
                          &&
                          String(
                            item.group_name || ""
                          ).trim()
                        )
                        ||
                        String(
                          line.description
                          || ""
                        ).trim();

                      if (!description) {
                        throw new Error(
                          "Expense Statement found "
                          + "a stored expense line "
                          + "without an Expense Item "
                          + "or stored description."
                        );
                      }

                      var amount =
                        Number(
                          line.amount || 0
                        );

                      if (
                        !Number.isFinite(
                          amount
                        )
                      ) {
                        throw new Error(
                          "Expense Statement found "
                          + "an invalid stored "
                          + "expense amount."
                        );
                      }

                      result[description] =
                        (
                          result[description]
                          || 0
                        )
                        +
                        amount;
                    }
                  );
                }
              );

            return result;
          });

      var descriptions = {};

      periodMaps.forEach(
        function(row) {
          Object
            .keys(row)
            .forEach(
              function(description) {
                descriptions[
                  description
                ] = true;
              }
            );
        }
      );

      var rows =
        Object
          .keys(descriptions)
          .sort(
            function(a, b) {
              return a.localeCompare(b);
            }
          )
          .map(
            function(
              description,
              index
            ) {
              return {
                name: description,

                section:
                  index === 0
                    ? "Expense Items"
                    : "",

                values:
                  periodMaps.map(
                    function(row) {
                      return (
                        row[description]
                        || 0
                      );
                    }
                  )
              };
            }
          );

      show(
        rows,
        "No expenses in this range",
        title,
        windows.map(
          function(windowRow) {
            return {
              label:
                periodLabel(
                  windowRow.from,
                  windowRow.to
                )
            };
          }
        )
      );
    })
    .catch(fail);
  }

  /*
   * Window-capture bridge is intentionally narrow.
   * R217 replaces R216 at the same early script position, so this
   * runs before the later R29 document-capture Expense owner.
   */
  window.addEventListener(
    "click",
    function(event) {
      var target =
        event.target &&
        typeof event.target.closest === "function"
          ? event.target.closest(
              "[data-aquila-r217-expense-action]"
            )
          : null;

      if (!target) { return; }

      var action =
        target.getAttribute(
          "data-aquila-r217-expense-action"
        );

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (action === "record") {
        r217OpenRecord();
        return;
      }

      if (action === "approval") {
        r217OpenApprovals();
      }
    },
    true
  );

  function appendEntryActions(root, kind) {
    var bar, add, ok;

    bar = el("div", "ubz-r215-actions");

    if (kind === "Expenses") {
      r217EnsureStyle();

      add =
        el(
          "button",
          "ubz-r215-add",
          "Record Expense"
        );

      ok =
        el(
          "button",
          "ubz-r215-ok",
          "Approve Expenses"
        );

      add.type = "button";
      ok.type = "button";

      add.setAttribute(
        "data-aquila-r217-expense-action",
        "record"
      );

      ok.setAttribute(
        "data-aquila-r217-expense-action",
        "approval"
      );

      r217Reference().catch(function() {});
    } else {
      add =
        el(
          "button",
          "ubz-r215-add",
          "Add"
        );

      ok =
        el(
          "button",
          "ubz-r215-ok",
          "Approve"
        );

      add.type = "button";
      ok.type = "button";

      add.addEventListener(
        "click",
        function() {
          showEntryForm(kind);
        }
      );

      ok.addEventListener(
        "click",
        function() {
          approvePending(kind);
        }
      );
    }

    bar.appendChild(add);
    bar.appendChild(ok);
    root.appendChild(bar);
  }

  function showEntryForm(kind) {
    var body = document.getElementById("ubz-r215-desk");
    var form, msg, save;
    if (!body || body.querySelector(".ubz-r215-form")) { return; }
    form = el("form", "ubz-r215-form");
    form.appendChild(field("Date", "date", "ubz-ent-date", rangeTo()));
    form.appendChild(field(kind === "Income" ? "Source / payer" : "Payee", "text", "ubz-ent-payee", ""));
    form.appendChild(field("Description / purpose", "text", "ubz-ent-desc", ""));
    form.appendChild(field("Amount (RWF)", "number", "ubz-ent-amt", ""));
    msg = el("p", "ubz-r215-empty", "Drafts post to the books after approval.");
    msg.id = "ubz-ent-msg";
    form.appendChild(msg);
    save = el("button", "ubz-r215-add", "Save");
    save.type = "submit";
    form.appendChild(save);
    form.addEventListener("submit", function(ev) {
      ev.preventDefault();
      postEntry(kind);
    });
    if (body.firstChild) { body.insertBefore(form, body.firstChild); }
    else { body.appendChild(form); }
  }
  function entryRoot(kind) {
    if (kind === "Income") { return "/pharmaco/receipts"; }
    return "/pharmaco/expenses";
  }
  function postEntry(kind) {
    var date = (document.getElementById("ubz-ent-date") || {}).value;
    var desc = String((document.getElementById("ubz-ent-desc") || {}).value || "").trim();
    var amt = Number((document.getElementById("ubz-ent-amt") || {}).value);
    var payee = String((document.getElementById("ubz-ent-payee") || {}).value || "").trim();
    var msg = document.getElementById("ubz-ent-msg");
    var payload;
    if (msg) { msg.textContent = "Saving…"; }
    if (!date || !desc || !(amt > 0)) {
      if (msg) { msg.textContent = "Date, description and a positive amount are required."; }
      return;
    }
    if (kind === "Income") {
      payload = { business_date: date, amount: amt, description: desc, payee_name: payee || null, currency_code: "RWF", purpose: desc };
    } else {
      payload = {
        business_date: date,
        purpose: desc,
        payee_name: payee || null,
        payment_source: "cash",
        currency_code: "RWF",
        notes: desc,
        lines: [{ description: desc, amount: amt }]
      };
    }
    apiSend(entryRoot(kind), "POST", payload).then(function() {
      if (msg) { msg.textContent = "Saved. Use Approve to post pending items."; }
      window.setTimeout(function() { loadDesk(hubKind(), window.__UBZ_R215_DESK__); }, 400);
    }).catch(function(e) {
      if (msg) { msg.textContent = (e && e.message) || "Could not save. An expense account on the chart of accounts may be required."; }
    });
  }
  function approvePending(kind) {
    var root = entryRoot(kind);
    var keys = kind === "Income" ? ["receipts", "incomes", "items"] : ["expenses", "items"];
    apiGet(root + "?per_page=40&limit=40").then(function(p) {
      var list = jsonArr(p, keys);
      var jobs = [];
      var i, r, id, st;
      for (i = 0; i < list.length; i += 1) {
        r = list[i] || {};
        st = String(r.status || r.state || "").toLowerCase();
        if (st && !/(draft|pend|submit|await)/.test(st)) { continue; }
        id = r.uuid || r.id;
        if (!id) { continue; }
        jobs.push(
          apiSend(root + "/" + encodeURIComponent(String(id)) + "/approve", "POST", { comment: null })
            .catch(function() { return apiSend(root + "/" + encodeURIComponent(String(id)) + "/submit", "POST", {}); })
        );
      }
      if (!jobs.length) { window.alert("No draft or pending " + kind.toLowerCase() + " items to approve."); return; }
      return Promise.all(jobs);
    }).then(function(done) {
      if (done) { loadDesk(hubKind(), window.__UBZ_R215_DESK__); }
    }).catch(function(e) {
      window.alert((e && e.message) || "Unable to approve from this desk.");
    });
  }
  function walkRows(payload, out) {
    var seen = out || [];
    function walk(node, depth) {
      var k, name, amt, i;
      if (!node || depth > 7) { return; }
      if (Array.isArray(node)) {
        for (i = 0; i < node.length; i += 1) { walk(node[i], depth + 1); }
        return;
      }
      if (typeof node !== "object") { return; }
      name = String(node.name || node.account_name || node.label || node.title || "").trim();
      amt = node.balance != null ? node.balance : (node.amount != null ? node.amount : (node.net != null ? node.net : node.value));
      if (name && amt != null && isFinite(Number(amt))) {
        seen.push({ name: name, value: money(amt), meta: String(node.account_type || node.type || node.code || "") });
      }
      for (k in node) {
        if (node.hasOwnProperty(k) && k !== "parent") { walk(node[k], depth + 1); }
      }
    }
    walk(payload, 0);
    return seen.slice(0, 40);
  }
  function financeRows(p, want) {
    var d = payloadData(p) || {};
    var rows = [];
    var i, list, r, name, typ, amt;
    list = Array.isArray(d.summary) ? d.summary : [];
    for (i = 0; i < list.length; i += 1) {
      r = list[i] || {};
      if (r.format === "number") { continue; }
      rows.push({ name: String(r.label || r.key || "Line"), value: money(r.value), meta: String(r.helper || r.format || "") });
    }
    list = d.accounts || d.lines || d.items || d.rows || [];
    for (i = 0; i < list.length; i += 1) {
      r = list[i] || {};
      name = String(r.name || r.account_name || r.label || "").trim();
      typ = String(r.account_type || r.type || r.group || "").toLowerCase();
      amt = r.balance != null ? r.balance : (r.amount != null ? r.amount : r.value);
      if (!name || amt == null) { continue; }
      if (want && typ && typ.indexOf(want) < 0 && String(name).toLowerCase().indexOf(want) < 0) { continue; }
      rows.push({ name: name, value: money(amt), meta: String(r.account_type || r.code || "") });
    }
    if (rows.length < 2) { rows = rows.concat(walkRows(p)); }
    return rows.slice(0, 40);
  }
  function firstOk(paths) {
    var i = 0;
    function next() {
      if (i >= paths.length) { return Promise.reject(new Error("No records")); }
      i += 1;
      return apiGet(paths[i - 1]).catch(function() { return next(); });
    }
    return next();
  }
  function mapNamed(list, nameKeys, valueKeys, metaKeys) {
    var i, r, name, value, meta, out = [];
    list = list || [];
    for (i = 0; i < list.length && out.length < 40; i += 1) {
      r = list[i] || {};
      name = pick(r, nameKeys) || ("Record " + (i + 1));
      value = pick(r, valueKeys);
      meta = pick(r, metaKeys);
      out.push({ name: name, value: value == null || value === "" ? "—" : String(value), meta: meta || "" });
    }
    return out;
  }
  function pick(r, keys) {
    var i, k, cur, parts, j;
    if (!r || !keys) { return ""; }
    for (i = 0; i < keys.length; i += 1) {
      parts = String(keys[i]).split(".");
      cur = r;
      for (j = 0; j < parts.length; j += 1) {
        k = parts[j];
        if (cur && typeof cur === "object" && cur[k] != null && cur[k] !== "") { cur = cur[k]; }
        else { cur = null; break; }
      }
      if (cur != null && typeof cur !== "object") { return String(cur); }
      if (cur && typeof cur === "object" && (cur.name || cur.label)) { return String(cur.name || cur.label); }
    }
    return "";
  }
  function batchName(r) {
    return pick(r, ["product.name", "product.product_name", "product_name", "name", "sku"]) || ("Batch " + (r.batch_number || r.batch_no || r.id || ""));
  }
  function batchQty(r) {
    var q = r.available_quantity != null ? r.available_quantity : (r.quantity_on_hand != null ? r.quantity_on_hand : r.quantity);
    return q != null ? String(q) : "—";
  }
  function batchValue(r) {
    var amt = r.amount != null ? r.amount : (num(r.selling_price) * num(r.available_quantity || r.quantity_on_hand));
    return amt ? money(amt) : "—";
  }
  function expiryDays(r) {
    var d = r.expiry_date || r.expiry;
    var t;
    if (!d) { return null; }
    t = Date.parse(String(d).length === 10 ? d + "T12:00:00" : d);
    if (!isFinite(t)) { return null; }
    return Math.round((t - Date.now()) / 86400000);
  }
  function loadStockOnHand() {
    return firstOk(["/pharmaco/products?per_page=200&limit=200", "/pharmaco/inventory/products?per_page=200"]).then(function(p) {
      var list = jsonArr(p, ["products", "items"]);
      var rows = [];
      var i, r, qty, val;
      for (i = 0; i < list.length && rows.length < 80; i += 1) {
        r = list[i] || {};
        qty = r.quantity_on_hand != null ? r.quantity_on_hand : (r.available_quantity != null ? r.available_quantity : r.quantity);
        val = r.inventory_value != null ? r.inventory_value : (num(r.selling_price) * num(qty));
        rows.push({
          name: pick(r, ["name", "product_name", "sku"]) || ("Product " + (r.id || (i + 1))),
          value: qty == null ? "—" : String(qty),
          meta: [pick(r, ["sku", "product.sku"]), val ? money(val) : ""].filter(Boolean).join(" · ")
        });
      }
      return rows;
    }).catch(function() { return loadBatches("Stock on Hand"); });
  }
  function loadBatches(title) {
    return apiGet("/pharmaco/inventory/batches?per_page=200&limit=200").then(function(p) {
      var list = jsonArr(p, ["batches", "items"]);
      var rows = [];
      var i, r, days, qty, seen, key;
      seen = {};
      for (i = 0; i < list.length; i += 1) {
        r = list[i] || {};
        days = expiryDays(r);
        qty = num(r.available_quantity != null ? r.available_quantity : r.quantity_on_hand);
        if (title === "Low Stock Watch List" && qty > 15 && !/low|reorder/i.test(String(r.status || ""))) { continue; }
        if (title === "Near Expiry Review" && (days == null || days < 0 || days > 90)) { continue; }
        if (title === "Expired Items" && (days == null || days >= 0)) { continue; }
        if (title === "High Value – Low Stock Risk" && !(qty <= 20 && num(r.selling_price) >= 5000)) { continue; }
        if (title === "Product Master") {
          key = String((r.product && (r.product.id || r.product.sku)) || r.product_id || batchName(r));
          if (seen[key]) { continue; }
          seen[key] = 1;
          rows.push({ name: batchName(r), value: pick(r, ["product.sku", "sku"]) || "SKU", meta: pick(r, ["product.unit", "product.selling_unit"]) || "" });
          continue;
        }
        rows.push({
          name: batchName(r),
          value: title.indexOf("High Value") === 0 ? batchValue(r) : batchQty(r),
          meta: [r.batch_number || r.batch_no, r.expiry_date || r.expiry, qty <= 15 ? "Low" : ""].filter(Boolean).join(" · ")
        });
      }
      if (title === "Top Fast Moving Products") {
        rows.sort(function(a, b) { return moneyNum(b.value) - moneyNum(a.value); });
      }
      if (title === "Slow Moving / Non-Moving Products") {
        rows = rows.filter(function(x) { return moneyNum(x.value) <= 5; });
      }
      return rows.slice(0, 40);
    });
  }
  function openDesk(title) {
    window.__UBZ_R215_DESK__ = title;
    window.__UBZ_R215_CHILD__ = title;
    window.__UBZ_R215_PAINTED__ = "";
    setSurface(hubKind() || "more", true);
    paintHub(hubKind());
  }
  function closeDesk() {
    window.__UBZ_R215_DESK__ = "";
    window.__UBZ_R215_CHILD__ = "";
    window.__UBZ_R215_PAINTED__ = "";
    setSurface(hubKind() || "more", false);
    paintHub(hubKind());
  }
  function paintDesk(kind, title) {
    var root = ensureHub();
    var back, body;
    if (!root) { return; }
    while (root.firstChild) { root.removeChild(root.firstChild); }
    root.setAttribute("data-ubz-kind", kind);
    root.setAttribute("data-ubz-desk", title);
    root.setAttribute("data-r223", "1");
    back = el("button", "ubz-r215-back", "‹ Back");
    back.type = "button";
    back.addEventListener("click", closeDesk);
    root.appendChild(back);
    (function() {
      var head = el("header", "ubz-r215-header");
      var copy = el("div", "ubz-r215-header-copy");
      var mark = el("div", "ubz-r215-logo", "U+");
      mark.setAttribute("aria-hidden", "true");
      copy.appendChild(el("p", "ubz-r215-hello", hello()));
      copy.appendChild(el("h1", "ubz-r215-shop", title));
      head.appendChild(copy);
      head.appendChild(mark);
      root.appendChild(head);
    }());
    appendDates(root);
    if (/^(Expenses|Income|Accounting|Payables|Banking)$/.test(title)) {
      appendEntryActions(root, title);
    }
    body = el("div", "");
    body.id = "ubz-r215-desk";
    root.appendChild(body);
    root.hidden = false;
    loadDesk(kind, title);
  }
  function loadDesk(kind, title) {
    var body = document.getElementById("ubz-r215-desk");
    var from = rangeFrom();
    var to = rangeTo();
    var q = "from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to);
    if (!body) { return; }
    while (body.firstChild) { body.removeChild(body.firstChild); }
    body.appendChild(el("p", "ubz-r215-empty", "Loading " + title + "…"));
    function show(rows, empty, paper, periods) {
      while (body.firstChild) { body.removeChild(body.firstChild); }
      if (paper) {
        paintStatement(body, paper, rows, empty, periods);
        return;
      }
      body.appendChild(el("div", "ubz-r215-stmt")).id = "ubz-r215-stmt";
      fillStmt("ubz-r215-stmt", rows, empty);
    }
    function fail(e) { show([], (e && e.message) || ("Unable to load " + title)); }
    if (title === "Website Content" && typeof window.__UBZ_CMS_OPEN__ === "function") {
      try { window.__UBZ_CMS_OPEN__(); } catch (_cms) {}
      show([{ name: "Website CMS", value: "Open", meta: "Public pages and copy" }], "CMS");
      return;
    }
    if (title === "Profit & Loss") {
      loadCompared(buildPnL).then(function(pack) {
        show(pack.rows, "No P&L rows in this range", title, pack.periods);
      }).catch(fail);
      return;
    }
    if (title === "Balance Sheet") {
      loadCompared(buildBS).then(function(pack) {
        show(pack.rows, "No balance-sheet rows in this range", title, pack.periods);
      }).catch(fail);
      return;
    }
    if (title === "Cash Flow") {
      loadCompared(buildCF).then(function(pack) {
        show(pack.rows, "No cash-flow rows in this range", title, pack.periods);
      }).catch(fail);
      return;
    }
    if (title === "Banking") {
      loadCompared(buildBS).then(function(pack) {
        var rows = pack.rows.filter(function(r) { return /cash|bank|mobile|total assets/i.test(r.name); });
        show(rows, "No banking rows in this range", title, pack.periods);
      }).catch(fail);
      return;
    }
    if (title === "Receivables") {
      Promise.all(compareWindows(from, to).map(function(w) {
        return apiGet("/pharmaco/finance/commercial/receivables?from=" + encodeURIComponent(w.from) + "&to=" + encodeURIComponent(w.to)).catch(function() { return null; });
      })).then(function(packs) {
        var wins = compareWindows(from, to);
        var keys = [
          { key: "original", name: "Sales value", section: "Receivables" },
          { key: "collected", name: "Already paid" },
          { key: "outstanding", name: "Outstanding", kind: "is-net" }
        ];
        var rows = keys.map(function(k) {
          return {
            name: k.name,
            section: k.section,
            kind: k.kind,
            values: packs.map(function(p) {
              var sum = ((payloadData(p) || {}).summary) || [];
              var i;
              for (i = 0; i < sum.length; i += 1) { if (sum[i].key === k.key) { return num(sum[i].value); } }
              return 0;
            })
          };
        });
        show(rows.concat(mapNamed(jsonArr(packs[2], ["receivables", "customers", "rows", "items", "sales"]), ["sale_number", "name", "customer_name"], ["balance_amount", "balance", "amount"], ["payment_status", "status"])), "No receivables in this range", title, wins.map(function(w) { return { label: periodLabel(w.from, w.to) }; }));
      }).catch(fail);
      return;
    }
    if (title === "Payables") {
      Promise.all(compareWindows(from, to).map(function(w) {
        return apiGet("/pharmaco/finance/commercial/flow?from=" + encodeURIComponent(w.from) + "&to=" + encodeURIComponent(w.to)).catch(function() { return null; });
      })).then(function(packs) {
        var wins = compareWindows(from, to);
        var keys = [
          { key: "payables_balance", name: "Supplier balance", section: "Payables" },
          { key: "supplier_paid", name: "Supplier payments" },
          { key: "customer_paid", name: "Customer collections", kind: "is-total" }
        ];
        var rows = keys.map(function(k) {
          return {
            name: k.name,
            section: k.section,
            kind: k.kind,
            values: packs.map(function(p) {
              var sum = ((payloadData(p) || {}).summary) || [];
              var i;
              for (i = 0; i < sum.length; i += 1) { if (sum[i].key === k.key) { return num(sum[i].value); } }
              return 0;
            })
          };
        });
        show(rows, "No payables in this range", title, wins.map(function(w) { return { label: periodLabel(w.from, w.to) }; }));
      }).catch(fail);
      return;
    }
    if (title === "Income") {
      loadCompared(buildPnL).then(function(pack) {
        var rows = pack.rows.filter(function(r) { return /sales revenue|other income|gross profit|cost of goods/i.test(r.name); });
        show(rows, "No income rows in this range", title, pack.periods);
      }).catch(fail);
      return;
    }
    if (title === "Expenses") {
      r217ExpenseStatement(body, from, to, title, show, fail);
      return;
    }
    if (title === "Accounting") {
      loadCompared(buildPnL).then(function(pack) {
        show(pack.rows, "No ledger rows in this range", title, pack.periods);
      }).catch(fail);
      return;
    }
    if (title === "Planning & Performance") {
      Promise.all([
        apiGet("/pharmaco/finance/planning/overview").catch(function() { return null; }),
        apiGet("/pharmaco/finance/planning/forecast").catch(function() { return null; })
      ]).then(function(pack) {
        var d = payloadData(pack[0]) || {};
        var f = payloadData(pack[1]) || {};
        var x = d.daily_business_target || {};
        show([
          { name: "Average daily sales", value: money(f.average_daily_sales), meta: "Trailing" },
          { name: "Required sales / day", value: money(x.required_sales_today), meta: "Margin target" },
          { name: "Daily expense requirement", value: money(x.daily_expense_requirement), meta: "BEP basis" },
          { name: "Gross profit", value: snapVal("finance.profit"), meta: capRange(from, to) }
        ], "Planning figures need an expense basis");
      }).catch(fail);
      return;
    }
    if (title === "Approve purchase orders" || title === "Purchase Orders") {
      loadPOs(body, title === "Approve purchase orders");
      return;
    }
    if (kind === "inventory") {
      if (title === "Stock on Hand") {
        loadStockOnHand().then(function(rows) {
          show(rows, "No stock on hand in this range");
        }).catch(fail);
        return;
      }
      loadBatches(title).then(function(rows) {
        show(rows, "No " + title.toLowerCase() + " rows in this range");
      }).catch(fail);
      return;
    }
    if (title === "Suppliers") {
      firstOk(["/pharmaco/suppliers?per_page=80", "/pharmaco/procurement/suppliers?per_page=80"]).then(function(p) {
        show(mapNamed(jsonArr(p, ["suppliers", "items"]), ["name", "supplier_name"], ["balance", "payables", "phone"], ["email", "status"]), "No suppliers on file");
      }).catch(fail);
      return;
    }
    if (title === "Goods Received") {
      firstOk(["/pharmaco/goods-receipts?per_page=80", "/pharmaco/purchase-orders?per_page=80"]).then(function(p) {
        show(mapNamed(jsonArr(p, ["goods_receipts", "receipts", "purchase_orders", "orders"]), ["grn_number", "number", "po_number", "reference"], ["total_amount", "amount", "total"], ["status", "supplier_name"]), "No goods received in this range");
      }).catch(fail);
      return;
    }
    if (title === "Returns") {
      firstOk(["/pharmaco/purchase-returns?per_page=80", "/pharmaco/sales/returns?per_page=80"]).then(function(p) {
        show(mapNamed(jsonArr(p, ["returns", "items"]), ["number", "reference", "product_name"], ["amount", "total_amount", "quantity"], ["status"]), "No returns in this range");
      }).catch(fail);
      return;
    }
    if (title === "Price Lists" || title === "Product Prices") {
      firstOk(["/pharmaco/price-lists?per_page=80", "/pharmaco/insurance/price-lists?per_page=80"]).then(function(p) {
        show(mapNamed(jsonArr(p, ["price_lists", "items", "prices"]), ["name", "product_name", "title"], ["price", "selling_price", "amount"], ["status", "partner_name"]), "No price lists to show");
      }).catch(fail);
      return;
    }
    if (kind === "insurance") {
      firstOk(["/pharmaco/insurance/partners?per_page=80", "/pharmaco/insurance/claims?per_page=80", "/pharmaco/finance/commercial/receivables?" + q]).then(function(p) {
        show(financeRows(p).concat(mapNamed(jsonArr(p, ["partners", "claims", "receivables", "items"]), ["name", "partner_name", "claim_number"], ["balance", "amount", "total"], ["status"])), "No " + title.toLowerCase() + " records");
      }).catch(fail);
      return;
    }
    if (kind === "hrm") {
      firstOk(["/pharmaco/hrm/employees?per_page=80", "/hrm/employees?per_page=80", "/pharmaco/users?per_page=80"]).then(function(p) {
        show(mapNamed(jsonArr(p, ["employees", "people", "users", "items"]), ["full_name", "name", "display_name"], ["job_title", "role", "department"], ["status", "email"]), "No workforce records available on phone yet");
      }).catch(fail);
      return;
    }
    if (kind === "admin") {
      if (title === "POS Session") {
        apiGet("/pharmaco/pos/sessions/admin?limit=80").then(function(p) {
          show(mapNamed(jsonArr(p, ["sessions", "items"]), ["opened_by_name", "cashier_name", "user_name", "id"], ["status", "total_amount"], ["opened_at", "business_date"]), "No till sessions in this range");
        }).catch(fail);
        return;
      }
      firstOk(["/pharmaco/users?per_page=80", "/users?per_page=80"]).then(function(p) {
        show(mapNamed(jsonArr(p, ["users", "items"]), ["full_name", "name", "email"], ["role", "status"], ["email"]), "No admin records to show");
      }).catch(fail);
      return;
    }
    if (kind === "reports") {
      show([
        { name: "Gross sales", value: snapVal("finance.income") || (document.getElementById("ubz-r189-gross-sales") && document.getElementById("ubz-r189-gross-sales").textContent) || "—", meta: capRange(from, to) },
        { name: "Gross profit", value: snapVal("finance.profit"), meta: capRange(from, to) },
        { name: "Inventory value", value: snapVal("stock.inv"), meta: "As-at" },
        { name: "Insurer receivable", value: snapVal("insurance.rec"), meta: "" }
      ], "Report pack for " + title);
      return;
    }
    if (kind === "messaging") {
      show([
        { name: title, value: "Desk ready", meta: "Conversations stay on the signed-in session" }
      ], "No messages to preview in this range");
      return;
    }
    show([{ name: title, value: capRange(from, to), meta: "Native desk" }], "No rows in this range");
  }
  function loadPOs(body, approveOnly) {
    apiGet("/pharmaco/purchase-orders?per_page=80&limit=80").then(function(p) {
      var list = jsonArr(p, ["purchase_orders", "orders"]);
      var pending = [];
      var i, r, st, line, left, btn;
      window.__UBZ_R215_PO__ = { open: 0, pending: 0, received: 0 };
      while (body.firstChild) { body.removeChild(body.firstChild); }
      for (i = 0; i < list.length; i += 1) {
        r = list[i] || {};
        st = String(r.status || r.state || "").toLowerCase();
        if (/(open|draft|pending|raised|submitted|await)/.test(st) || !st) { window.__UBZ_R215_PO__.open += 1; }
        if (/(pending|raised|submitted|await|to_approve|to-approve)/.test(st) || (!st && approveOnly)) { window.__UBZ_R215_PO__.pending += 1; pending.push(r); }
        if (/(receiv|complete|close)/.test(st)) { window.__UBZ_R215_PO__.received += 1; }
      }
      if (approveOnly && !pending.length) { pending = list.filter(function(x) { return !/(approv|receiv|cancel|void|close)/i.test(String(x.status || x.state || "")); }); }
      if (!pending.length) {
        body.appendChild(el("p", "ubz-r215-empty", approveOnly ? "No purchase orders awaiting approval" : "No purchase orders in this range"));
        return;
      }
      for (i = 0; i < pending.length && i < 25; i += 1) {
        r = pending[i] || {};
        line = el("article", "ubz-r215-line");
        left = el("div", "");
        left.appendChild(el("strong", "", String(r.po_number || r.number || r.reference || ("PO " + (r.id || "")))));
        left.appendChild(el("span", "", [r.supplier_name || (r.supplier && r.supplier.name), r.status || r.state].filter(Boolean).join(" · ")));
        line.appendChild(left);
        line.appendChild(el("em", "", money(r.total_amount || r.amount || r.total || 0)));
        btn = el("button", "ubz-r215-approve", "Approve");
        btn.type = "button";
        (function(id, node) {
          btn.addEventListener("click", function() {
            node.textContent = "…";
            apiSend("/pharmaco/purchase-orders/" + encodeURIComponent(String(id)) + "/approve", "POST", {})
              .then(function() { node.textContent = "Approved"; node.disabled = true; })
              .catch(function() {
                apiSend("/pharmaco/purchase-orders/" + encodeURIComponent(String(id)) + "/status", "POST", { status: "approved" })
                  .then(function() { node.textContent = "Approved"; node.disabled = true; })
                  .catch(function(err) { node.textContent = (err && err.message) ? "Retry" : "Retry"; });
              });
          });
        }(r.id || r.uuid || r.po_id, btn));
        line.appendChild(btn);
        body.appendChild(line);
      }
    }).catch(function(e) {
      while (body.firstChild) { body.removeChild(body.firstChild); }
      body.appendChild(el("p", "ubz-r215-empty", e.message || "Unable to load purchase orders"));
    });
  }
  function shiftISO(iso, days) {
    var p = String(iso || "").split("-").map(Number);
    var dt = new Date(p[0], (p[1] || 1) - 1, (p[2] || 1) + days);
    var y = dt.getFullYear();
    var m = String(dt.getMonth() + 1);
    var d = String(dt.getDate());
    if (m.length < 2) { m = "0" + m; }
    if (d.length < 2) { d = "0" + d; }
    return y + "-" + m + "-" + d;
  }
  function sampleDays(from, to, maxPts) {
    var out = [];
    var n, step, i, d;
    d = from;
    n = 0;
    while (d <= to && n < 62) {
      out.push(d);
      d = shiftISO(d, 1);
      n += 1;
    }
    if (!out.length) { return [to || from]; }
    if (out.length <= maxPts) { return out; }
    step = (out.length - 1) / (maxPts - 1);
    d = [];
    for (i = 0; i < maxPts; i += 1) { d.push(out[Math.round(i * step)]); }
    return d;
  }
  function invFromBooks(p) {
    var rows = walkRows(p);
    var i, n, sum = 0, hit = 0;
    for (i = 0; i < rows.length; i += 1) {
      n = String(rows[i].name || "").toLowerCase();
      if (/inventor|stock on hand|merchandise|goods for resale/.test(n) && !/expense|cogs|cost of|change in/.test(n)) {
        sum += moneyNum(rows[i].value);
        hit += 1;
      }
    }
    return hit ? sum : 0;
  }
  function dayLabel(iso) {
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var m = parseInt(String(iso).slice(5, 7), 10);
    var d = parseInt(String(iso).slice(8, 10), 10);
    return (months[m - 1] || iso.slice(5, 7)) + " " + d;
  }
  function saleDay(s) {
    var d = s && (s.business_date || s.sold_at || s.created_at || s.updated_at || s.received_at);
    if (!d) { return ""; }
    d = String(d);
    return d.length >= 10 ? d.slice(0, 10) : "";
  }
  function loadMove() {
    var host = document.getElementById("ubz-r215-move");
    var from;
    var to;
    var today;
    var end;
    var walkEnd;
    var days;
    var closeSnap;
    syncHubDates();
    from = rangeFrom();
    to = rangeTo();
    today = bizISODate();
    closeSnap = moneyNum(snapVal("stock.inv"));
    if (!host) { return; }
    host.setAttribute("aria-label", "Inventory position by day");
    if (from > to) { days = from; from = to; to = days; }
    end = to > today ? today : to;
    walkEnd = today > end ? today : end;
    days = sampleDays(from, end, 31);
    loadCostMaps().then(function(maps) {
      return Promise.all([Promise.resolve(maps || {}), salesOps(from, walkEnd, maps), loadReceiptDays()]);
    }).then(function(pack) {
      var maps = pack[0] || { live: 0, byProduct: {}, byBatch: {}, expired: {} };
      var ops = pack[1] || { byDay: {} };
      var flow = pack[2] || { in: {}, out: {} };
      var rec = flow.in || flow;
      var ret = flow.out || {};
      var expired = maps.expired || {};
      var live = maps.live || closeSnap;
      var all = sampleDays(from, walkEnd, 62);
      var pos = {};
      var pts = [];
      var i, d, next, v, outflow, inflow, net;
      pos[walkEnd] = live;
      for (i = all.length - 2; i >= 0; i -= 1) {
        d = all[i];
        next = all[i + 1];
        outflow = ((ops.byDay[next] && ops.byDay[next].cogs) || 0) + (ret[next] || 0) + (expired[next] || 0);
        v = (pos[next] || 0) - (rec[next] || 0) + outflow;
        pos[d] = v > 0 ? v : 0;
      }
      for (i = 0; i < days.length; i += 1) {
        d = days[i];
        v = pos[d] != null ? pos[d] : live;
        outflow = ((ops.byDay[d] && ops.byDay[d].cogs) || 0) + (ret[d] || 0) + (expired[d] || 0);
        inflow = rec[d] || 0;
        net = inflow - outflow;
        pts.push({ label: dayLabel(d), value: v, out: outflow, inn: inflow, net: net });
      }
      drawBars("ubz-r215-move", pts);
    }).catch(function() {
      var pts = [];
      var i;
      for (i = 0; i < days.length; i += 1) {
        pts.push({ label: dayLabel(days[i]), value: closeSnap });
      }
      drawBars("ubz-r215-move", pts);
    });
  }
  function loadHubExtras(kind) {
    if (kind === "inventory") { loadMove(); }
    if (kind === "procurement") {
      apiGet("/pharmaco/purchase-orders?per_page=80&limit=80").then(function(p) {
        var list = jsonArr(p, ["purchase_orders", "orders"]);
        var i, st, open = 0, pending = 0, received = 0;
        for (i = 0; i < list.length; i += 1) {
          st = String((list[i] && (list[i].status || list[i].state)) || "").toLowerCase();
          if (/(open|draft|pending|raised|submitted|await)/.test(st) || !st) { open += 1; }
          if (/(pending|raised|submitted|await|to_approve)/.test(st)) { pending += 1; }
          if (/(receiv|complete|close)/.test(st)) { received += 1; }
        }
        window.__UBZ_R215_PO__ = { open: open, pending: pending, received: received };
        fillHubMetrics("procurement");
      }).catch(function() {});
    }
  }
  function bioRecord() {
    try { return JSON.parse(localStorage.getItem(BIO_KEY) || "null"); } catch (_e6) { return null; }
  }
  function saveBio(rec) {
    try { localStorage.setItem(BIO_KEY, JSON.stringify(rec)); } catch (_e7) {}
  }
  function b64(buf) {
    var u = new Uint8Array(buf);
    var s = "";
    var i;
    for (i = 0; i < u.length; i += 1) { s += String.fromCharCode(u[i]); }
    return btoa(s);
  }
  function fromB64(s) {
    var bin = atob(s);
    var u = new Uint8Array(bin.length);
    var i;
    for (i = 0; i < bin.length; i += 1) { u[i] = bin.charCodeAt(i); }
    return u.buffer;
  }
  function bioSupported() {
    return !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
  }
  function enrollBio() {
    var who = sessionWho();
    var chal = new Uint8Array(32);
    if (!bioSupported()) { window.alert("This device does not support Face ID or fingerprint sign-in."); return; }
    window.crypto.getRandomValues(chal);
    navigator.credentials.create({
      publicKey: {
        challenge: chal,
        rp: { name: "Ubuzima+", id: location.hostname },
        user: { id: new TextEncoder().encode(who.mail || who.name || "user"), name: who.mail || who.name, displayName: who.name },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60000
      }
    }).then(function(cred) {
      saveBio({ id: b64(cred.rawId), lock: true });
      window.alert("Face ID / fingerprint is on for this device.");
    }).catch(function() {});
  }
  function assertBio() {
    var rec = bioRecord();
    var chal = new Uint8Array(32);
    if (!rec || !rec.id || !bioSupported()) { return Promise.reject(new Error("not enrolled")); }
    window.crypto.getRandomValues(chal);
    return navigator.credentials.get({
      publicKey: {
        challenge: chal,
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: fromB64(rec.id) }],
        userVerification: "required",
        timeout: 60000
      }
    });
  }
  function showBioLock(on) {
    var n = document.getElementById("ubz-r215-bio-lock");
    var card, b;
    if (!on) {
      if (n) { n.setAttribute("data-on", "0"); }
      return;
    }
    if (!n) {
      n = el("div", "");
      n.id = "ubz-r215-bio-lock";
      card = el("div", "ubz-r215-bio-card");
      card.appendChild(el("h2", "", "Unlock Ubuzima+"));
      card.appendChild(el("p", "", "Use Face ID or fingerprint to open this device session."));
      b = el("button", "", "Unlock");
      b.type = "button";
      b.addEventListener("click", function() {
        assertBio().then(function() { showBioLock(false); }).catch(function() {});
      });
      card.appendChild(b);
      n.appendChild(card);
      document.body.appendChild(n);
    }
    n.setAttribute("data-on", "1");
  }
  function wireBio() {
    var rec = bioRecord();
    var card, btn;
    if (!isPhone()) { return; }
    if (isLogin() && rec && rec.id) {
      card = document.querySelector(".login-card, .auth-form-panel");
      if (card && !document.getElementById("ubz-r215-bio-btn")) {
        btn = el("button", "", "Sign in with Face ID / fingerprint");
        btn.type = "button";
        btn.id = "ubz-r215-bio-btn";
        btn.addEventListener("click", function() {
          assertBio().then(function() {
            if (sessionBag() && authToken()) { location.reload(); }
          }).catch(function() {});
        });
        card.appendChild(btn);
      }
    }
    if (!isLogin() && rec && rec.lock && rec.id && !window.__AQUILA_R215_BIO_VIS__) {
      window.__AQUILA_R215_BIO_VIS__ = true;
      document.addEventListener("visibilitychange", function() {
        if (document.visibilityState === "hidden") { window.__UBZ_R215_BIO_HIDE__ = true; }
        if (document.visibilityState === "visible" && window.__UBZ_R215_BIO_HIDE__) {
          window.__UBZ_R215_BIO_HIDE__ = false;
          showBioLock(true);
        }
      });
    }
  }
  function serviceTile(title, hint) {
    var b = el("button", "ubz-r215-tile");
    b.type = "button";
    b.appendChild(el("strong", "", title));
    b.appendChild(el("span", "", hint));
    b.addEventListener("click", function() { openDesk(title); });
    return b;
  }
  function landingTile(title, hint, kind) {
    var b = el("button", "ubz-r215-tile ubz-r215-tile-mod");
    var chip = "";
    b.type = "button";
    if (lastMore() === kind) { b.className += " is-last"; }
    if (kind === "insurance") { chip = snapVal("insurance.rec") !== "—" ? ("Receivable " + snapVal("insurance.rec")) : ""; }
    if (kind === "finance") { chip = snapVal("finance.profit") !== "—" ? ("Gross profit " + snapVal("finance.profit")) : ""; }
    if (kind === "reports") { chip = "Operating reports"; }
    if (kind === "hrm") { chip = "Workforce desk"; }
    if (kind === "admin") { chip = "Users and setup"; }
    if (kind === "messaging") { chip = "Chats and mail"; }
    b.appendChild(el("strong", "", title));
    b.appendChild(el("span", "", hint));
    if (chip) { b.appendChild(el("em", "", chip)); }
    b.addEventListener("click", function() {
      window.__UBZ_R215_MORE_MOD__ = kind;
      window.__UBZ_R215_CHILD__ = "";
      saveMore(kind);
      hideMorePopup();
      flashVeil();
      setSurface(kind, false);
      paintHub(kind);
    });
    return b;
  }
  function paintHub(kind) {
    var spec = HUBS[kind];
    var root = ensureHub();
    var i, hero, row, grid, tiles, extras, move;
    var desk = window.__UBZ_R215_DESK__ || "";
    if (!root || !spec) { return; }
    if (desk) {
      if (root.getAttribute("data-ubz-desk") === desk && root.getAttribute("data-r223") === "1" && !root.hidden) { return; }
      paintDesk(kind, desk);
      return;
    }
    if (root.getAttribute("data-ubz-kind") === kind && root.getAttribute("data-r223") === "1" && !root.hidden && !root.getAttribute("data-ubz-desk")) {
      syncHubDates();
      fillHubMetrics(kind);
      loadHubExtras(kind);
      return;
    }
    while (root.firstChild) { root.removeChild(root.firstChild); }
    root.setAttribute("data-ubz-kind", kind);
    root.removeAttribute("data-ubz-desk");
    root.setAttribute("data-r223", "1");
    (function() {
      var head = el("header", "ubz-r215-header");
      var copy = el("div", "ubz-r215-header-copy");
      var mark = el("div", "ubz-r215-logo", "U+");
      mark.setAttribute("aria-hidden", "true");
      copy.appendChild(el("p", "ubz-r215-hello", hello()));
      copy.appendChild(el("h1", "ubz-r215-shop", shopName()));
      head.appendChild(copy);
      head.appendChild(mark);
      root.appendChild(head);
    }());
    if (kind !== "more") { appendDates(root); syncHubDates(); }
    hero = el("section", "ubz-r215-hero");
    hero.appendChild(el("p", "ubz-r215-kicker", spec.kicker));
    row = el("div", "ubz-r215-hero-row");
    if (kind === "inventory") { heroPair(row, "INVENTORY VALUE", "ubz-r215-h-a", "NEAR EXPIRY", "ubz-r215-h-b"); }
    else if (kind === "more") { heroPair(row, "MODULES", "ubz-r215-h-a", "SIGNED IN", "ubz-r215-h-b"); }
    else if (kind === "insurance") { heroPair(row, "INSURER RECEIVABLE", "ubz-r215-h-a", "OVERDUE", "ubz-r215-h-b"); }
    else if (kind === "finance") { heroPair(row, "GROSS PROFIT", "ubz-r215-h-a", "INCOME", "ubz-r215-h-b"); }
    else if (kind === "reports") { heroPair(row, "REPORTS", "ubz-r215-h-a", "AUDIT", "ubz-r215-h-b"); }
    else if (kind === "hrm") { heroPair(row, "PEOPLE", "ubz-r215-h-a", "PAYROLL", "ubz-r215-h-b"); }
    else if (kind === "admin") { heroPair(row, "ACCESS", "ubz-r215-h-a", "SETUP", "ubz-r215-h-b"); }
    else if (kind === "messaging") { heroPair(row, "CHATS", "ubz-r215-h-a", "MAIL", "ubz-r215-h-b"); }
    else { heroPair(row, "OPEN POs", "ubz-r215-h-a", "AWAITING APPROVAL", "ubz-r215-h-b"); }
    hero.appendChild(row);
    root.appendChild(hero);
    extras = analyticsBlock(kind);
    if (extras.length) {
      root.appendChild(el("h2", "ubz-r215-section", kind === "inventory" ? "STOCK POSITION" : (kind === "finance" ? "PERIOD ANALYTICS" : (kind === "procurement" ? "SUPPLY POSITION" : "OPERATING POSITION"))));
      for (i = 0; i < extras.length; i += 1) { root.appendChild(extras[i]); }
    }
    if (kind === "inventory") {
      root.appendChild(el("h2", "ubz-r215-section", "INVENTORY POSITION MOVEMENT"));
      move = el("div", "");
      move.id = "ubz-r215-move";
      root.appendChild(move);
      root.appendChild(el("p", "ubz-r215-empty", "Daily inventory at cost. Under each date: decrease, new stock in, then net of the two."));
    }
    root.appendChild(el("h2", "ubz-r215-section", spec.title));
    grid = el("div", "ubz-r215-grid");
    tiles = spec.tiles;
    for (i = 0; i < tiles.length; i += 1) {
      if (spec.landing) { grid.appendChild(landingTile(tiles[i][0], tiles[i][1], tiles[i][2])); }
      else { grid.appendChild(serviceTile(tiles[i][0], tiles[i][1])); }
    }
    root.appendChild(grid);
    if (kind === "more") { appendProfile(root); }
    fillHubMetrics(kind);
    loadHubExtras(kind);
    root.hidden = false;
  }
  function activeTab() {
    var b = document.querySelector(".ubuzima-native-tabbar button.active");
    return (b && b.getAttribute("data-ubz-tab")) || "";
  }
  function hubKind() {
    var tab = activeTab();
    var sec = section();
    var more = window.__UBZ_R215_MORE_MOD__ || "";
    if (tab === "inventory" || sec === "inventory") { return "inventory"; }
    if (tab === "procurement" || sec === "suppliers" || sec === "procurement") { return "procurement"; }
    if (tab === "home" || tab === "pos") { return ""; }
    if (more && HUBS[more]) { return more; }
    if (sec === "insurance") { return "insurance"; }
    if (sec === "finance") { return "finance"; }
    if (sec === "reports") { return "reports"; }
    if (sec === "admin-management" || sec === "admin-center") { return "admin"; }
    if (sec === "pharmacist-chat" || sec === "messaging") { return "messaging"; }
    if (sec === "hrm") { return "hrm"; }
    if (tab === "more") { return "more"; }
    return "";
  }
  function childParam(kind) {
    if (kind === "inventory") { return hashVal("inventory", "overview"); }
    if (kind === "procurement") { return hashVal("supplier", "overview"); }
    if (kind === "insurance") { return hashVal("insurance", "overview"); }
    if (kind === "finance") { return hashVal("finance", "overview"); }
    if (kind === "reports") { return hashVal("reports", "overview"); }
    return "overview";
  }
  function surfaceName(kind, tab) {
    if (kind) { return kind; }
    if (tab === "pos") { return "pos"; }
    if (tab === "home") { return "home"; }
    return recalledSurface() || "home";
  }
  function buryOldUi() {
    var sel = ".dashboard-title-card,.bo-pro-shell,.ubuzima-native-business-hero,.ubuzima-native-section,.ubuzima-native-topbar,.ubuzima-mobile-topbar,.ubuzima-mobile-quick-grid,.ubuzima-mobile-action-strip,.inventory-module-home,.inventory-workspace-shell,.procurement-module-home,.finance-overview,.section-page,.tree-nav--principal,.ubuzima-native-balance-grid,.business-overview-card,.dashboard-header";
    var keep = "#ubz-r189-home, #ubz-r196-pos, #ubz-r215-hub, #ubz-r208-session, #ubz-r208-approval";
    var nodes, i, n;
    if (!isPhone() || isLogin()) { return; }
    if (document.documentElement.classList.contains("ubuzima-r215-hub") || document.documentElement.getAttribute("data-ubz-child") === "1") {
      sel += ",#aquila-mobile-sales-trend-r7,#ubz-r190-trend,#ubz-r191-trend,.bo-pro-card--trend";
    }
    nodes = document.querySelectorAll(sel);
    for (i = 0; i < nodes.length; i += 1) {
      n = nodes[i];
      if (n.closest && n.closest(keep)) { continue; }
      if (n.querySelector && n.querySelector(keep)) { continue; }
      n.setAttribute("hidden", "");
      n.setAttribute("aria-hidden", "true");
      n.setAttribute("data-ubz-buried", "1");
      n.style.setProperty("display", "none", "important");
      n.style.setProperty("height", "0px", "important");
      n.style.setProperty("max-height", "0px", "important");
      n.style.setProperty("overflow", "hidden", "important");
      n.style.setProperty("visibility", "hidden", "important");
      n.style.setProperty("pointer-events", "none", "important");
      n.style.setProperty("margin", "0px", "important");
      n.style.setProperty("padding", "0px", "important");
    }
  }
  function markLoginChrome() {
    var shell = document.querySelector("main.auth-shell, .auth-shell");
    if (isLogin()) {
      document.documentElement.setAttribute("data-ubz-auth", "login");
      if (shell) { shell.classList.add("auth-shell--identity"); }
      return;
    }
    if (shell) { shell.classList.remove("auth-shell--identity"); }
  }
  function boot() {
    var kind, showHub, hub, root, tab, child;
    pinTabbar();
    markLoginChrome();
    buryOldUi();
    hideMorePopup();
    wireBio();
    root = document.documentElement;
    if (!isPhone() || isLogin()) {
      root.classList.remove("ubuzima-r215-inv", "ubuzima-r215-proc", "ubuzima-r215-ins", "ubuzima-r215-fin", "ubuzima-r215-rep", "ubuzima-r215-hub", "ubuzima-r215-more", "ubuzima-r215-hrm", "ubuzima-r215-admin", "ubuzima-r215-msg");
      hub = document.getElementById("ubz-r215-hub");
      if (hub) { hub.hidden = true; }
      return;
    }
    loadCostMaps();
    tab = activeTab();
    kind = hubKind();
    window.__UBZ_R215_SEC__ = section();
    child = !!(window.__UBZ_R215_DESK__ || window.__UBZ_R215_CHILD__);
    showHub = !!kind;
    setSurface(surfaceName(kind, tab), child);
    root.classList.toggle("ubuzima-r215-inv", kind === "inventory");
    root.classList.toggle("ubuzima-r215-proc", kind === "procurement");
    root.classList.toggle("ubuzima-r215-ins", kind === "insurance");
    root.classList.toggle("ubuzima-r215-fin", kind === "finance");
    root.classList.toggle("ubuzima-r215-rep", kind === "reports");
    root.classList.toggle("ubuzima-r215-hrm", kind === "hrm");
    root.classList.toggle("ubuzima-r215-admin", kind === "admin");
    root.classList.toggle("ubuzima-r215-msg", kind === "messaging");
    root.classList.toggle("ubuzima-r215-more", kind === "more");
    root.classList.toggle("ubuzima-r215-hub", showHub);
    if (showHub) { paintHub(kind); }
    else {
      hub = document.getElementById("ubz-r215-hub");
      if (hub) { hub.hidden = true; }
    }
  }
  function onTabClick(ev) {
    var btn, key;
    if (!isPhone() || isLogin()) { return; }
    btn = ev.target && ev.target.closest && ev.target.closest(".ubuzima-native-tabbar button");
    if (!btn) { return; }
    key = btn.getAttribute("data-ubz-tab") || "";
    flashVeil();
    hideMorePopup();
    window.__UBZ_R215_CHILD__ = "";
    window.__UBZ_R215_DESK__ = "";
    if (key === "more") {
      window.__UBZ_R215_MORE_MOD__ = "";
      setSurface("more", false);
    } else {
      window.__UBZ_R215_MORE_MOD__ = "";
      setSurface(key || "home", false);
    }
  }
  function wireViewport() {
    if (window.__AQUILA_R215_VV__) { return; }
    window.__AQUILA_R215_VV__ = true;
    window.addEventListener("resize", pinTabbar, { passive: true });
    window.addEventListener("orientationchange", pinTabbar, { passive: true });
    document.addEventListener("click", onTabClick, true);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", pinTabbar, { passive: true });
      window.visualViewport.addEventListener("scroll", pinTabbar, { passive: true });
    }
  }
  if (!document.documentElement.getAttribute("data-ubz-surface")) {
    setSurface(recalledSurface() || "home", false);
  }
  wireViewport();
  boot();
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); }
  window.addEventListener("hashchange", boot);
  window.setInterval(boot, 900);
})();

