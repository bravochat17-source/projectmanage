const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;

// ── STORAGE ───────────────────────────────────────────────────────────────────
const db = {
  get: (k, def = []) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : def;
    } catch {
      return def;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  }
};

// ── CLOUD SYNC（Supabase 即時同步）─────────────────────────────────────────────
const SUPA_URL = 'https://swhbfzqfumrktszusexq.supabase.co';
const SUPA_KEY = 'sb_publishable_DylARZqP6xNC7K0tOQmqGw_Tb41_hZq';
const TABLES = {
  users: 'app_users',
  projects: 'projects',
  events: 'events',
  memos: 'memos',
  memoItems: 'memo_items'
};
let supaClient = null;
try {
  if (window.supabase && window.supabase.createClient) {
    supaClient = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  }
} catch (e) {
  console.warn('Supabase init failed', e);
}
async function cloudFetchAll() {
  const out = {};
  let successfulTables = 0;
  for (const [key, table] of Object.entries(TABLES)) {
    try {
      const {
        data,
        error
      } = await supaClient.from(table).select('id,data');
      if (error) throw error;
      out[key] = (data || []).map(r => r.data).filter(Boolean);
      successfulTables += 1;
    } catch (e) {
      console.warn('cloud fetch', table, e);
      out[key] = null;
    }
  }
  out.__ok = successfulTables === Object.keys(TABLES).length;
  return out;
}
async function cloudPushDiff(key, prevArr, nextArr) {
  if (!supaClient) return false;
  const table = TABLES[key];
  const prevMap = new Map((prevArr || []).map(x => [x.id, x]));
  const nextMap = new Map((nextArr || []).map(x => [x.id, x]));
  const ups = [];
  for (const [id, obj] of nextMap) {
    const p = prevMap.get(id);
    if (!p || JSON.stringify(p) !== JSON.stringify(obj)) ups.push({
      id,
      data: obj,
      updated_at: new Date().toISOString()
    });
  }
  const dels = [];
  for (const id of prevMap.keys()) if (!nextMap.has(id)) dels.push(id);
  try {
    if (ups.length) {
      const {
        error
      } = await supaClient.from(table).upsert(ups);
      if (error) throw error;
    }
    if (dels.length) {
      const {
        error
      } = await supaClient.from(table).delete().in('id', dels);
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.warn('cloud push', table, e);
    return false;
  }
}

// ── 連線狀態指示 ──────────────────────────────────────────────────────────────
function ConnDot({
  status
}) {
  const [spin, setSpin] = useState(false);
  const map = {
    online: {
      c: '#1c8a56',
      t: '已連線'
    },
    connecting: {
      c: '#c79a5b',
      t: '連線中…'
    },
    offline: {
      c: '#9a3527',
      t: '離線（僅本機）'
    }
  };
  const s = map[status] || map.connecting;
  const refresh = () => {
    if (spin) return;
    setSpin(true);
    try {
      window.__refetchCloud && window.__refetchCloud();
    } catch (e) {}
    setTimeout(() => setSpin(false), 1200);
  };
  return /*#__PURE__*/React.createElement("button", {
    className: "conn-dot",
    onClick: refresh,
    title: "\u9EDE\u4E00\u4E0B\u91CD\u65B0\u6574\u7406"
  }, /*#__PURE__*/React.createElement("span", {
    className: "conn-led",
    style: {
      background: s.c
    }
  }), s.t, /*#__PURE__*/React.createElement("span", {
    className: `conn-refresh${spin ? ' spin' : ''}`
  }, "\u27F3"));
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => new Date().toISOString();
const fmt = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};
const fmtFull = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const darken = (c, pct = 45) => `color-mix(in srgb, ${c} ${pct}%, #160d04)`;

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
// ── HOUSES（原創徽記 · 非商標）────────────────────────────────────────────────
const HOUSES = {
  serpent: {
    label: '綠色',
    primary: '#178A50',
    primaryDeep: '#178A50',
    metal: '#178A50',
    emblem: 'serpent'
  },
  eagle: {
    label: '藍色',
    primary: '#2F6BFF',
    primaryDeep: '#2F6BFF',
    metal: '#2F6BFF',
    emblem: 'eagle'
  },
  badger: {
    label: '琥珀色',
    primary: '#C27C0E',
    primaryDeep: '#C27C0E',
    metal: '#C27C0E',
    emblem: 'badger'
  },
  lion: {
    label: '紫色',
    primary: '#7A4DE0',
    primaryDeep: '#7A4DE0',
    metal: '#7A4DE0',
    emblem: 'lion'
  }
};
const getHouse = u => HOUSES[u && u.house] || HOUSES.serpent;
const DEFAULT_USERS = [{
  id: 'user-jan',
  name: 'Jan',
  house: 'serpent',
  primaryColor: HOUSES.serpent.primary,
  secondaryColor: HOUSES.serpent.metal,
  themeName: '蛇之家',
  role: '管理者',
  createdAt: now()
}, {
  id: 'user-joyce',
  name: 'Joyce',
  house: 'eagle',
  primaryColor: HOUSES.eagle.primary,
  secondaryColor: HOUSES.eagle.metal,
  themeName: '鷹之家',
  role: '管理者',
  createdAt: now()
}];
const EVENT_KINDS = {
  work: { label: '施工', hint: '工程正常進行' },
  urgent: { label: '緊急', hint: '臨時採買、聯絡廠商等' },
  scheduled: { label: '預定', hint: '丈量、驗收、約見等' }
};
const evKind = e => (e && EVENT_KINDS[e.kind]) ? e.kind : 'work';
const CAT_COLORS = {
  '拆除': '#9A6B4F', '冷氣': '#3B82C4', '水電': '#2A9D8F', '木工': '#C08A2E', '油漆': '#8A6FD1',
  '系統櫃': '#4F6BED', '木地板': '#C2647A', '鐵件': '#5F6B7A', '玻璃': '#3BAFD9', '其他': '#8A919B'
};
const catColor = e => CAT_COLORS[e && e.category] || CAT_COLORS['其他'];
const catLabel = e => e.category === '其他' ? e.customCategory || '其他' : e.category;
// 事件詳細資訊：說明＋廠商／聯絡人＋電話
function EventDetails({
  ev,
  clamp
}) {
  if (!ev || !(ev.details || ev.vendor || ev.phone)) return null;
  const tel = (ev.phone || '').replace(/[^0-9+#]/g, '');
  return /*#__PURE__*/React.createElement("div", {
    className: `ev-details${clamp ? ' clamp' : ''}`
  }, ev.details && /*#__PURE__*/React.createElement("p", {
    className: "ev-details-text"
  }, ev.details), (ev.vendor || ev.phone) && /*#__PURE__*/React.createElement("div", {
    className: "ev-contact"
  }, ev.vendor && /*#__PURE__*/React.createElement("span", null, "\u5EE0\u5546\uFF1A", ev.vendor), ev.phone && /*#__PURE__*/React.createElement("a", {
    href: `tel:${tel}`,
    onClick: e => e.stopPropagation()
  }, "\u260E ", ev.phone)));
}
const CATEGORIES = ['拆除', '冷氣', '水電', '木工', '油漆', '系統櫃', '木地板', '鐵件', '玻璃', '其他'];
const ROLES = ['管理者', '學生'];
const isAdmin = u => !!u && u.role === '管理者';
const PROJECT_STATUSES = {
  active: '進行中',
  wait_owner: '等待屋主回復',
  wait_builder: '等待建商回復',
  building: '等待建商完工中',
  paused: '暫停',
  closed: '已結案'
};
const ACTIVE_STATUS_OPTIONS = ['active', 'wait_owner', 'wait_builder', 'building', 'paused'];
const STATUS_CLASS = {
  active: 'status-active',
  wait_owner: 'status-wait',
  wait_builder: 'status-wait',
  building: 'status-build',
  paused: 'status-paused',
  closed: 'status-closed'
};
const statusClass = s => STATUS_CLASS[s] || 'status-active';

// ── DATE HELPERS ──────────────────────────────────────────────────────────────
const startOfDay = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const parseDateOnly = dateStr => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toDateKey = d => {
  const o = typeof d === 'string' ? parseDateOnly(d) : d;
  if (!o) return '';
  return `${o.getFullYear()}-${String(o.getMonth() + 1).padStart(2, '0')}-${String(o.getDate()).padStart(2, '0')}`;
};
const getDateRangeKeys = (startDate, endDate) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate || startDate);
  if (!start || !end) return [];
  const safeEnd = end < start ? start : end;
  const result = [];
  const cur = new Date(start);
  while (cur <= safeEnd) {
    result.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
};
// ── EVENT URGENCY (based on startDate, not deadline) ─────────────────────────
const eventUrgencyInfo = (startDate, done) => {
  if (done) return {
    status: 'done',
    label: '完成',
    daysText: '完成',
    days: null
  };
  if (!startDate) return {
    status: 'blue',
    label: '未設定日期',
    daysText: '未定',
    days: null
  };
  const today = startOfDay(new Date());
  const start = parseDateOnly(startDate);
  if (!start) return {
    status: 'blue',
    label: '未設定日期',
    daysText: '未定',
    days: null
  };
  const diff = Math.ceil((start - today) / 86400000);
  if (diff < 0) return {
    status: 'darkred',
    label: '已開始',
    daysText: `已開始${Math.abs(diff)}天`,
    days: diff
  };
  if (diff === 0) return {
    status: 'red',
    label: '今日開始',
    daysText: '今日',
    days: 0
  };
  if (diff < 5) return {
    status: 'red',
    label: '即將開始',
    daysText: `${diff}天`,
    days: diff
  };
  if (diff <= 10) return {
    status: 'yellow',
    label: '接近開始',
    daysText: `${diff}天`,
    days: diff
  };
  return {
    status: 'blue',
    label: '時間充裕',
    daysText: `${diff}天`,
    days: diff
  };
};
const getMonthDays = monthDate => {
  const y = monthDate.getFullYear(),
    m = monthDate.getMonth();
  const first = new Date(y, m, 1),
    last = new Date(y, m + 1, 0);
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

// ── USER BADGE ────────────────────────────────────────────────────────────────
function UserBadge({
  userId,
  users
}) {
  const u = users.find(x => x.id === userId);
  if (!u) return null;
  const hc = getHouse(u).primary;
  return /*#__PURE__*/React.createElement("span", {
    className: "user-badge",
    style: {
      background: u.primaryColor + '26',
      borderColor: u.primaryColor + '88',
      color: u.primaryColor
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: hc,
      display: 'inline-block',
      flexShrink: 0
    }
  }), u.name);
}

// ── USER ICON（簡易圓形圖示：代表色 + 名字首字）────────────────────────────────
function HouseEmblem({
  house,
  name,
  size = 28,
  className = ''
}) {
  const h = HOUSES[house] || HOUSES.serpent;
  const letter = (name || '').trim().charAt(0).toUpperCase();
  return /*#__PURE__*/React.createElement("span", {
    className: `user-icon ${className}`,
    "aria-hidden": "true",
    style: {
      width: size,
      height: size,
      fontSize: Math.round(size * 0.46),
      background: `color-mix(in srgb, ${h.primary} 15%, transparent)`,
      color: h.primary
    }
  }, letter || /*#__PURE__*/React.createElement("svg", {
    width: Math.round(size * 0.56),
    height: Math.round(size * 0.56),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 21c0-4 3.6-6 8-6s8 2 8 6"
  })));
}

// ── OWNER MARK（負責人盾形紋章）───────────────────────────────────────────────
function OwnerBookmark({
  userId,
  users,
  inline,
  size
}) {
  const u = users.find(x => x.id === userId);
  if (!u) return null;
  const h = getHouse(u);
  const s = size || (inline ? 34 : 28);
  return /*#__PURE__*/React.createElement("span", {
    className: `owner-crest${inline ? ' inline' : ''}`
  }, /*#__PURE__*/React.createElement(HouseEmblem, {
    house: h.emblem,
    name: u.name,
    size: s
  }));
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function Toast({
  msg,
  onDone
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "toast"
  }, msg);
}

// ── CHECKBOX ──────────────────────────────────────────────────────────────────
function CheckBox({
  checked,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `check-box${checked ? ' checked' : ''}`,
    onClick: onChange
  });
}

// ── MODAL SHEET ───────────────────────────────────────────────────────────────
function ModalSheet({
  title,
  onClose,
  children,
  footer,
  centered
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: `modal-backdrop${centered ? ' centered' : ''}`,
    onClick: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: `modal-sheet${centered ? ' centered-sheet' : ''}`,
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-header"
  }, /*#__PURE__*/React.createElement("span", {
    className: "modal-title"
  }, title), /*#__PURE__*/React.createElement("button", {
    className: "close-btn",
    onClick: onClose
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "modal-footer"
  }, footer)));
}

// ── PARCHMENT CALENDAR (書頁月曆) ───────────────────────────────────────────────
function MagicCalendar({
  calendarMonth,
  setCalendarMonth,
  calendarMap,
  onSelectDate,
  selectedDate
}) {
  const cells = getMonthDays(calendarMonth);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const todayKey = toDateKey(new Date());
  const MAX_LANES = 3;
  const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  const goToday = () => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const renderWeek = (week, wi) => {
    const keys = week.map(d => d ? toDateKey(d) : null);
    // 這一週的施工事件 → 分配車道，畫成跨日橫條
    const seen = {};
    keys.forEach(k => {
      if (!k) return;
      ((calendarMap[k] || {}).events || []).forEach(ev => {
        if (evKind(ev) === 'work') seen[ev.id] = ev;
      });
    });
    const segs = Object.values(seen).map(ev => {
      const cols = keys.map((k, i) => k && ((calendarMap[k] || {}).events || []).some(x => x.id === ev.id) ? i : -1).filter(i => i >= 0);
      const st = ev.startDate || ev.date;
      const en = ev.endDate || st;
      return {
        ev,
        c0: cols[0],
        c1: cols[cols.length - 1],
        head: keys[cols[0]] === st,
        tail: keys[cols[cols.length - 1]] === en
      };
    }).sort((x, y) => x.c0 - y.c0 || y.c1 - y.c0 - (x.c1 - x.c0));
    const laneEnd = [];
    segs.forEach(sg => {
      let lane = laneEnd.findIndex(e => e < sg.c0);
      if (lane === -1) lane = laneEnd.length;
      laneEnd[lane] = sg.c1;
      sg.lane = lane;
    });
    const lanesUsed = Math.min(MAX_LANES, laneEnd.length);
    return /*#__PURE__*/React.createElement("div", {
      key: wi,
      className: "cal-week",
      style: {
        '--lanes': lanesUsed
      }
    }, week.map((day, i) => {
      if (!day) return /*#__PURE__*/React.createElement("div", {
        key: `e${i}`,
        className: "cal-cell empty",
        style: {
          gridColumn: i + 1
        }
      });
      const key = keys[i];
      const dayData = calendarMap[key] || {};
      const evs = dayData.events || [];
      const memos = dayData.memos || [];
      const urgents = evs.filter(ev => evKind(ev) === 'urgent' && !ev.completedAt);
      const scheds = evs.filter(ev => evKind(ev) === 'scheduled' && !ev.completedAt);
      const hidden = segs.filter(sg => sg.lane >= MAX_LANES && i >= sg.c0 && i <= sg.c1).length;
      const isToday = key === todayKey;
      return /*#__PURE__*/React.createElement("button", {
        key: key,
        type: "button",
        className: `cal-cell${isToday ? ' today' : ''}${urgents.length ? ' has-urgent' : ''}${key === selectedDate ? ' selected' : ''}${i === 0 || i === 6 ? ' weekend' : ''}`,
        style: {
          gridColumn: i + 1
        },
        "aria-label": `${day.getMonth() + 1}/${day.getDate()}${evs.length ? `，${evs.length} 件事項` : ''}${urgents.length ? `，${urgents.length} 件緊急` : ''}`,
        onClick: () => onSelectDate(key)
      }, /*#__PURE__*/React.createElement("span", {
        className: "cal-num"
      }, day.getDate()), /*#__PURE__*/React.createElement("span", {
        className: "cal-flags"
      }, urgents.length > 0 && /*#__PURE__*/React.createElement("span", {
        className: "cal-flag urgent"
      }, "緊急", urgents.length > 1 ? ` ${urgents.length}` : ''), scheds.length > 0 && /*#__PURE__*/React.createElement("span", {
        className: "cal-flag sched"
      }, "預定", scheds.length > 1 ? ` ${scheds.length}` : ''), memos.length > 0 && /*#__PURE__*/React.createElement("span", {
        className: "cal-flag memo"
      }, "注意"), hidden > 0 && /*#__PURE__*/React.createElement("span", {
        className: "cal-flag more"
      }, "+", hidden, " 項施工")));
    }), segs.filter(sg => sg.lane < MAX_LANES).map(sg => /*#__PURE__*/React.createElement("span", {
      key: sg.ev.id,
      className: `cal-bar${sg.head ? ' head' : ''}${sg.tail ? ' tail' : ''}${sg.ev.completedAt ? ' done' : ''}`,
      style: {
        gridColumn: `${sg.c0 + 1} / ${sg.c1 + 2}`,
        gridRow: sg.lane + 2,
        '--c': catColor(sg.ev)
      },
      title: `${catLabel(sg.ev)}｜${sg.ev.title}`
    }, !sg.ev.title.includes(catLabel(sg.ev)) && /*#__PURE__*/React.createElement("b", null, catLabel(sg.ev), " "), sg.ev.title)));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "parch-calendar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "parch-cal-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "parch-cal-title"
  }, calendarMonth.getFullYear(), " 年 ", calendarMonth.getMonth() + 1, " 月"), /*#__PURE__*/React.createElement("div", {
    className: "cal-nav"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: goToday
  }, "今天"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    "aria-label": "上個月",
    onClick: prevMonth
  }, "←"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    "aria-label": "下個月",
    onClick: nextMonth
  }, "→"))), /*#__PURE__*/React.createElement("div", {
    className: "cal-weekdays"
  }, weekdays.map((w, i) => /*#__PURE__*/React.createElement("span", {
    key: w,
    className: i === 0 || i === 6 ? 'weekend' : ''
  }, w))), weeks.map(renderWeek));
}

// ── 工期表匯入（Excel 甘特表：每月一區塊、每列一工種、塗色＝施工日）──────────────
const SCHED_SCHEDULED_WORDS = ['丈量', '驗收', '會勘', '放樣', '量測', '複丈', '估價', '交屋'];
function scheduleCategory(name) {
  const n = String(name || '');
  const rules = [['木地板', '木地板'], ['系統櫃', '系統櫃'], ['木工', '木工'], ['木作', '木工'], ['空調', '冷氣'], ['冷氣', '冷氣'], ['水電', '水電'], ['油漆', '油漆'], ['玻璃', '玻璃'], ['鐵件', '鐵件'], ['鐵工', '鐵件'], ['拆除', '拆除']];
  for (const [k, c] of rules) if (n.includes(k)) return { category: c, customCategory: '' };
  return { category: '其他', customCategory: n.replace(/工程$/, '') || '其他' };
}
function parseScheduleWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws['!ref']) throw new Error('讀不到工作表內容');
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
  const text = (r, c) => {
    const x = cell(r, c);
    return x && x.t === 's' ? String(x.v).trim() : '';
  };
  const fill = (r, c) => {
    const x = cell(r, c);
    const s = x && x.s;
    if (!s || s.patternType !== 'solid' || !s.fgColor || !s.fgColor.rgb) return null;
    const rgb = String(s.fgColor.rgb).slice(-6).toUpperCase();
    return rgb === 'FFFFFF' ? null : rgb;
  };
  const pad = n => String(n).padStart(2, '0');
  const serialToKey = v => {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  };
  const addYear = key => `${Number(key.slice(0, 4)) + 1}${key.slice(4)}`;
  const mergeText = (r, c) => {
    const m = (ws['!merges'] || []).find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
    return m ? text(m.s.r, m.s.c) : text(r, c);
  };
  let title = '';
  const blocks = [];
  let cur = null;
  for (let r = range.s.r; r <= range.e.r; r++) {
    // 日期列：同一列有 7 格以上的日期序號
    const dateCols = {};
    let count = 0;
    for (let c = 1; c <= range.e.c; c++) {
      const x = cell(r, c);
      if (x && x.t === 'n' && x.v > 30000 && x.v < 80000) {
        const k = serialToKey(x.v);
        if (k) { dateCols[c] = k; count++; }
      }
    }
    if (count >= 7) {
      cur = { dateCols, rows: [], holidayRows: [], weekendCols: new Set() };
      blocks.push(cur);
      continue;
    }
    const head = text(r, 0);
    if (!cur) {
      if (head && !title) title = head.replace(/[-－]?\s*室內工程進度表$|[-－]?\s*工程進度表$|[-－]?\s*進度表$/, '');
      continue;
    }
    if (head === '工種') {
      Object.keys(cur.dateCols).forEach(c => {
        const w = text(r, Number(c));
        if (w === '六' || w === '日') cur.weekendCols.add(Number(c));
      });
      continue;
    }
    if (!head) {
      // 沒有工種名稱、但有塗色的列＝假日列（例如「雙十連假」）
      const cols = Object.keys(cur.dateCols).map(Number).filter(c => fill(r, c));
      if (cols.length) cur.holidayRows.push({ r, cols });
      continue;
    }
    cur.rows.push(r);
  }
  if (!blocks.length) throw new Error('找不到日期列，請確認是工期表格式');
  // 區塊日期若比上一區塊早（年份沒改），自動往後補一年
  let lastKey = '';
  blocks.forEach(b => {
    let keys = Object.values(b.dateCols);
    let guard = 0;
    while (lastKey && keys[0] <= lastKey && guard++ < 5) {
      Object.keys(b.dateCols).forEach(c => { b.dateCols[c] = addYear(b.dateCols[c]); });
      keys = Object.values(b.dateCols);
    }
    lastKey = keys[keys.length - 1];
  });
  // 非工作日（週末、連假）與假日名稱
  const offDays = new Set();
  const holidays = {};
  blocks.forEach(b => {
    b.weekendCols.forEach(c => b.dateCols[c] && offDays.add(b.dateCols[c]));
    b.holidayRows.forEach(h => h.cols.forEach(c => {
      const k = b.dateCols[c];
      if (!k) return;
      offDays.add(k);
      const name = mergeText(h.r, c);
      if (name) holidays[k] = name;
    }));
  });
  // 每個工種的施工日
  const trades = {};
  blocks.forEach(b => b.rows.forEach(r => {
    const name = text(r, 0);
    const nameFill = fill(r, 0);
    Object.entries(b.dateCols).forEach(([c, key]) => {
      c = Number(c);
      const f = fill(r, c);
      const note = text(r, c);
      const on = f && f !== 'DDDDDD';
      if (!on) return;
      (trades[name] = trades[name] || {})[key] = note || (trades[name][key] || '');
    });
  }));
  const dayAfter = key => {
    const d = parseDateOnly(key);
    d.setDate(d.getDate() + 1);
    return toDateKey(d);
  };
  const md = k => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`;
  const runsText = days => {
    const runs = [];
    days.forEach(k => {
      const last = runs[runs.length - 1];
      if (last && dayAfter(last[1]) === k) last[1] = k; else runs.push([k, k]);
    });
    return runs.map(([a, b]) => a === b ? md(a) : `${md(a)}–${md(b)}`).join('、');
  };
  const events = [];
  Object.entries(trades).forEach(([name, dayMap]) => {
    const days = Object.keys(dayMap).sort();
    const groups = [];
    days.forEach(k => {
      const g = groups[groups.length - 1];
      if (g) {
        // 中間只隔週末／連假就視為同一段工程
        let x = dayAfter(g.days[g.days.length - 1]);
        let onlyOff = true;
        let guard = 0;
        while (x < k && guard++ < 40) {
          if (!offDays.has(x)) { onlyOff = false; break; }
          x = dayAfter(x);
        }
        // 有新的文字備註（例如「收尾」）時另開一段
        if (onlyOff && !(dayMap[k] && dayMap[k] !== g.notes[g.notes.length - 1])) {
          g.days.push(k);
          if (dayMap[k] && !g.notes.includes(dayMap[k])) g.notes.push(dayMap[k]);
          return;
        }
      }
      groups.push({ days: [k], notes: dayMap[k] ? [dayMap[k]] : [] });
    });
    groups.forEach(g => {
      const st = g.days[0];
      const en = g.days[g.days.length - 1];
      const cat = scheduleCategory(name);
      const note = g.notes.join('、');
      const isSched = SCHED_SCHEDULED_WORDS.some(w => note.includes(w));
      const offIn = Object.entries(holidays).filter(([k]) => k >= st && k <= en).map(([k, n]) => `${md(k)} ${n}`);
      const detailLines = [`施工日：${runsText(g.days)}（共 ${g.days.length} 天）`];
      if (offIn.length) detailLines.push(`期間假日：${[...new Set(offIn)].join('、')}`);
      events.push({
        trade: name,
        title: note && !name.includes(note) ? `${name}－${note}` : name,
        kind: isSched ? 'scheduled' : 'work',
        category: cat.category,
        customCategory: cat.customCategory,
        startDate: st,
        endDate: en,
        workDays: g.days.length,
        details: detailLines.join('\n')
      });
    });
  });
  events.sort((a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.title.localeCompare(b.title));
  return { title, events, holidays };
}

// 匯入預覽視窗
function ScheduleImport({
  result,
  existing,
  users,
  currentUser,
  onCancel,
  onImport
}) {
  const md = k => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`;
  const isDup = ev => existing.some(x => x.title === ev.title && (x.startDate || x.date) === ev.startDate && (x.endDate || x.startDate || x.date) === ev.endDate);
  const [checked, setChecked] = useState(() => result.events.map(ev => !isDup(ev)));
  const [executorId, setExecutorId] = useState(currentUser.id);
  const n = checked.filter(Boolean).length;
  const first = result.events[0], last = result.events[result.events.length - 1];
  const toggle = i => setChecked(c => c.map((v, j) => j === i ? !v : v));
  return /*#__PURE__*/React.createElement(ModalSheet, {
    title: "匯入工期表",
    onClose: onCancel,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      onClick: onCancel
    }, "取消"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-gold",
      disabled: n === 0,
      onClick: () => onImport(result.events.filter((_, i) => checked[i]), executorId)
    }, `匯入 ${n} 項`))
  }, /*#__PURE__*/React.createElement("p", {
    className: "imp-summary"
  }, result.title ? `「${result.title}」` : '', "找到 ", result.events.length, " 項工程", first ? `，${md(first.startDate)} – ${md(result.events.reduce((m, e) => e.endDate > m ? e.endDate : m, first.endDate))}` : ''), /*#__PURE__*/React.createElement("p", {
    className: "imp-hint"
  }, "中間只隔週末或連假的會合併成同一段，實際施工日寫在詳細說明。含「丈量」等字的會標為預定。"), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "執行者（全部套用，匯入後可個別修改）"), /*#__PURE__*/React.createElement("select", {
    className: "field-select",
    value: executorId,
    onChange: e => setExecutorId(e.target.value)
  }, users.map(u => /*#__PURE__*/React.createElement("option", {
    key: u.id,
    value: u.id
  }, u.name)))), /*#__PURE__*/React.createElement("div", {
    className: "imp-list"
  }, result.events.map((ev, i) => {
    const dup = isDup(ev);
    return /*#__PURE__*/React.createElement("label", {
      key: i,
      className: `imp-row${checked[i] ? '' : ' off'}`,
      style: {
        '--cat': catColor(ev)
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: checked[i],
      onChange: () => toggle(i)
    }), /*#__PURE__*/React.createElement("span", {
      className: "imp-line"
    }), /*#__PURE__*/React.createElement("span", {
      className: "imp-main"
    }, /*#__PURE__*/React.createElement("span", {
      className: "imp-title"
    }, ev.title, ev.kind === 'scheduled' && /*#__PURE__*/React.createElement("span", {
      className: "imp-tag sched"
    }, "預定"), dup && /*#__PURE__*/React.createElement("span", {
      className: "imp-tag dup"
    }, "已存在")), /*#__PURE__*/React.createElement("span", {
      className: "imp-meta"
    }, ev.startDate === ev.endDate ? md(ev.startDate) : `${md(ev.startDate)} – ${md(ev.endDate)}`, "　施工 ", ev.workDays, " 天")));
  })));
}

// ── 單日放大檢視（點月曆日期後跳出）──────────────────────────────────────────
function DaySheet({
  dateKey,
  dayData,
  users,
  onClose,
  onView,
  onComplete,
  canEdit
}) {
  const evs = dayData && dayData.events || [];
  const memos = dayData && dayData.memos || [];
  const d = parseDateOnly(dateKey);
  const wk = ['日', '一', '二', '三', '四', '五', '六'][d ? d.getDay() : 0];
  const md = iso => {
    const x = parseDateOnly(iso);
    return x ? `${x.getMonth() + 1}/${x.getDate()}` : '';
  };
  const dayIndex = (st, en) => {
    const a = parseDateOnly(st), b = parseDateOnly(en), c = d;
    if (!a || !b || !c) return '';
    const total = Math.round((b - a) / 86400000) + 1;
    const n = Math.round((c - a) / 86400000) + 1;
    return total > 1 ? `第 ${n} 天／共 ${total} 天` : '';
  };
  const order = { urgent: 0, scheduled: 1, work: 2 };
  const sorted = [...evs].sort((x, y) => (x.completedAt ? 1 : 0) - (y.completedAt ? 1 : 0) || order[evKind(x)] - order[evKind(y)]);
  const total = evs.length + memos.length;
  const item = ev => {
    const kind = evKind(ev);
    const st = ev.startDate || ev.date;
    const en = ev.endDate || st;
    const notes = (ev.contentEntries || []).filter(c => c.date === dateKey && c.content);
    return /*#__PURE__*/React.createElement("div", {
      key: ev.id,
      className: `day-item kind-${kind}${ev.completedAt ? ' is-done' : ''}`,
      style: {
        '--cat': catColor(ev)
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "day-item-top"
    }, kind === 'work' ? /*#__PURE__*/React.createElement("span", {
      className: "day-item-line"
    }) : /*#__PURE__*/React.createElement("span", {
      className: `day-item-flag kind-${kind}`
    }, EVENT_KINDS[kind].label), /*#__PURE__*/React.createElement("span", {
      className: "day-item-title"
    }, ev.title), ev.completedAt && /*#__PURE__*/React.createElement("span", {
      className: "day-item-done"
    }, "\u5DF2\u5B8C\u6210")), /*#__PURE__*/React.createElement("div", {
      className: "day-item-meta"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tag-type"
    }, catLabel(ev)), /*#__PURE__*/React.createElement("span", null, st === en ? md(st) : `${md(st)} – ${md(en)}`), dayIndex(st, en) && /*#__PURE__*/React.createElement("span", null, dayIndex(st, en)), /*#__PURE__*/React.createElement(UserBadge, {
      userId: ev.executorId,
      users: users
    })), /*#__PURE__*/React.createElement(EventDetails, {
      ev: ev
    }), notes.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "day-item-notes"
    }, notes.map(c => /*#__PURE__*/React.createElement("p", {
      key: c.id
    }, c.content))), /*#__PURE__*/React.createElement("div", {
      className: "day-item-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline btn-sm",
      onClick: () => onView(ev)
    }, "\u8A73\u60C5"), canEdit && /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline btn-sm",
      onClick: () => onComplete(ev)
    }, ev.completedAt ? '\u53D6\u6D88\u5B8C\u6210' : '\u2713 \u5B8C\u6210')));
  };
  return /*#__PURE__*/React.createElement(ModalSheet, {
    title: d ? `${d.getMonth() + 1} 月 ${d.getDate()} 日（${wk}）・${total} 件` : dateKey,
    onClose: onClose
  }, total === 0 && /*#__PURE__*/React.createElement("div", {
    className: "day-empty"
  }, "\u9019\u5929\u6C92\u6709\u5B89\u6392\u4E8B\u9805"), /*#__PURE__*/React.createElement("div", {
    className: "day-list"
  }, sorted.map(item), memos.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    className: "day-item kind-memo"
  }, /*#__PURE__*/React.createElement("div", {
    className: "day-item-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "day-item-flag kind-memo"
  }, "\u6CE8\u610F"), /*#__PURE__*/React.createElement("span", {
    className: "day-item-title"
  }, m.title)), m.content && /*#__PURE__*/React.createElement("div", {
    className: "day-item-notes"
  }, /*#__PURE__*/React.createElement("p", null, m.content))))));
}

// ── IDENTITY SCREEN ───────────────────────────────────────────────────────────
const ADMIN_PASSWORDS = {
  'user-jan': '1717',
  'user-joyce': '2525'
};
function IdentityScreen({
  users,
  onSelect,
  onAddUser
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    house: 'serpent'
  });
  const [pendingAdmin, setPendingAdmin] = useState(null);
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState(false);
  const handleAdd = () => {
    if (!form.name.trim()) return;
    const h = HOUSES[form.house] || HOUSES.serpent;
    const u = {
      id: uid(),
      name: form.name.trim(),
      house: form.house,
      primaryColor: h.primary,
      secondaryColor: h.metal,
      themeName: h.label,
      role: '學生',
      createdAt: now()
    };
    onAddUser(u);
    setShowAdd(false);
    setForm({
      name: '',
      house: 'serpent'
    });
  };
  const pickUser = u => {
    if (isAdmin(u)) {
      setPendingAdmin(u);
      setPwd('');
      setPwdErr(false);
    } else onSelect(u);
  };
  const submitPwd = () => {
    if (pwd === ADMIN_PASSWORDS[pendingAdmin.id]) {
      const u = pendingAdmin;
      setPendingAdmin(null);
      setPwd('');
      onSelect(u);
    } else {
      setPwdErr(true);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "identity-screen",
    style: {
      textAlign: "justify"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "crest-mark"
  }, "\u5DE5"), /*#__PURE__*/React.createElement("h1", {
    className: "crest-title"
  }, "\u5DE5\u7A0B\u6A94\u6848\u5EAB"), /*#__PURE__*/React.createElement("p", {
    className: "crest-subtitle"
  }, "\u8ACB\u9078\u64C7\u60A8\u7684\u8EAB\u5206\u4EE5\u7E7C\u7E8C"), users.map(u => {
    const h = getHouse(u);
    return /*#__PURE__*/React.createElement("div", {
      key: u.id,
      className: "user-card",
      onClick: () => pickUser(u),
    }, /*#__PURE__*/React.createElement("span", {
      className: "id-crest"
    }, /*#__PURE__*/React.createElement(HouseEmblem, {
      house: h.emblem,
      name: u.name,
      size: 52
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        marginLeft: '0.6rem'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "user-info-name"
    }, u.name, isAdmin(u) && /*#__PURE__*/React.createElement("span", {
      className: "lock-mark"
    }, "\uD83D\uDD12")), /*#__PURE__*/React.createElement("div", {
      className: "user-info-role"
    }, u.role)));
  }), /*#__PURE__*/React.createElement("div", {
    className: "user-card dashed",
    onClick: () => setShowAdd(true)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '1.2rem'
    }
  }, "\uFF0B"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: '0.4rem'
    }
  }, "\u65B0\u589E\u4F7F\u7528\u8005")), pendingAdmin && /*#__PURE__*/React.createElement(ModalSheet, {
    title: `管理者登入 · ${pendingAdmin.name}`,
    onClose: () => setPendingAdmin(null),
    centered: true,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      onClick: () => setPendingAdmin(null)
    }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-gold",
      onClick: submitPwd
    }, "\u767B\u5165"))
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center gap-3 mb-3"
  }, /*#__PURE__*/React.createElement(HouseEmblem, {
    house: getHouse(pendingAdmin).emblem,
    name: pendingAdmin.name,
    size: 52
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u7BA1\u7406\u8005\u5BC6\u78BC"), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    type: "password",
    inputMode: "numeric",
    autoFocus: true,
    value: pwd,
    onChange: e => {
      setPwd(e.target.value);
      setPwdErr(false);
    },
    onKeyDown: e => e.key === 'Enter' && submitPwd(),
    placeholder: "\u8ACB\u8F38\u5165\u5BC6\u78BC"
  }), pwdErr && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: '#c0271a',
      marginTop: '0.4rem'
    }
  }, "\u5BC6\u78BC\u932F\u8AA4\uFF0C\u8ACB\u518D\u8A66\u4E00\u6B21\u3002"))), showAdd && /*#__PURE__*/React.createElement(ModalSheet, {
    title: "\u65B0\u589E\u4F7F\u7528\u8005",
    onClose: () => setShowAdd(false),
    centered: true,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      onClick: () => setShowAdd(false)
    }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-gold",
      onClick: handleAdd
    }, "\u5EFA\u7ACB"))
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u4F7F\u7528\u8005\u540D\u7A31"), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    value: form.name,
    onChange: e => setForm({
      ...form,
      name: e.target.value
    }),
    placeholder: "\u8F38\u5165\u540D\u7A31"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u6B0A\u9650"), /*#__PURE__*/React.createElement("div", {
    className: "role-fixed"
  }, "\u5B78\u751F"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-mute",
    style: {
      marginTop: '0.35rem',
      lineHeight: 1.5
    }
  }, "\u65B0\u589E\u5E33\u865F\u7686\u70BA\u300C\u5B78\u751F\u300D\uFF1A\u53EF\u7DE8\u8F2F\u53CA\u65B0\u589E\u4E8B\u4EF6\u3001\u6CE8\u610F\u4E8B\u9805\uFF0C\u4F46\u7121\u6CD5\u522A\u9664\u6216\u7D50\u6848\u3002\uFF08\u7BA1\u7406\u8005\u50C5 Jan\u3001Joyce\uFF09")), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u4EE3\u8868\u8272"), /*#__PURE__*/React.createElement("select", {
    className: "field-select",
    value: form.house,
    onChange: e => setForm({
      ...form,
      house: e.target.value
    })
  }, Object.keys(HOUSES).map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, HOUSES[k].label)))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center gap-3 mt-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-mute"
  }, "\u9810\u89BD\uFF1A"), /*#__PURE__*/React.createElement(HouseEmblem, {
    house: form.house,
    name: form.name,
    size: 40
  }))));
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
function HomeScreen({
  currentUser,
  users,
  projects,
  events,
  onOpenProject,
  onAddProject,
  onSwitchUser,
  onDeleteUser
}) {
  const admin = isAdmin(currentUser);
  const [showAdd, setShowAdd] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [form, setForm] = useState({
    name: '',
    mainOwnerId: currentUser.id,
    note: ''
  });
  const getStats = pid => {
    const evs = events.filter(e => e.projectId === pid && !e.deletedAt);
    const urgent = evs.filter(e => !e.completedAt && evKind(e) === 'urgent').length;
    return {
      total: evs.length,
      undone: evs.filter(e => !e.completedAt).length,
      urgent
    };
  };
  const handleAdd = () => {
    if (!form.name.trim()) return;
    const p = {
      id: uid(),
      name: form.name.trim(),
      mainOwnerId: form.mainOwnerId,
      status: 'active',
      note: form.note,
      createdBy: currentUser.id,
      updatedBy: currentUser.id,
      createdAt: now(),
      updatedAt: now(),
      closedAt: null
    };
    onAddProject(p);
    setShowAdd(false);
    setForm({
      name: '',
      mainOwnerId: currentUser.id,
      note: ''
    });
  };
  const activeProjects = projects.filter(p => p.status !== 'closed');
  const closedProjects = projects.filter(p => p.status === 'closed');
  const renderBook = (p, closed) => {
    const stats = getStats(p.id);
    const owner = users.find(u => u.id === p.mainOwnerId);
    const h = getHouse(owner);
    const urgent = !closed && stats.urgent > 0;
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: `project-book${closed ? ' is-closed' : ''}${urgent ? ' is-urgent' : ''}`,
      onClick: () => onOpenProject(p),
      style: {
        '--bar': h.primary
      }
    }, owner && /*#__PURE__*/React.createElement("span", {
      className: "book-owner"
    }, /*#__PURE__*/React.createElement(UserBadge, {
      userId: owner.id,
      users: users
    })), /*#__PURE__*/React.createElement("div", {
      className: "book-title"
    }, p.name), /*#__PURE__*/React.createElement("div", {
      className: "book-meta"
    }, urgent && /*#__PURE__*/React.createElement("span", {
      className: "badge-urgent"
    }, /*#__PURE__*/React.createElement("span", {
      className: "flame"
    }, ""), "\u7DCA\u6025 ", stats.urgent), /*#__PURE__*/React.createElement("span", {
      className: `pill ${statusClass(p.status)}`
    }, PROJECT_STATUSES[p.status]), !closed && stats.undone > 0 && /*#__PURE__*/React.createElement("span", {
      className: "pill pill-undone"
    }, "\u5F85\u8FA6 ", stats.undone)), /*#__PURE__*/React.createElement("div", {
      className: "book-foot"
    }, closed ? `結案 ${fmtFull(p.closedAt)}` : `更新於 ${fmtFull(p.updatedAt)}`));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "parchment-bg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "header-title brand"
  }, "\u5DE5\u7A0B\u6A94\u6848\u5EAB")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(UserBadge, {
    userId: currentUser.id,
    users: users
  }), admin && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: () => setShowUsers(true)
  }, "\u4F7F\u7528\u8005"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: onSwitchUser
  }, "\u5207\u63DB")))), /*#__PURE__*/React.createElement("div", {
    className: "page page-enter",
    style: {
      paddingTop: '1.25rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-heading",
    style: {
      flex: 1,
      marginBottom: 0
    }
  }, "\u9032\u884C\u4E2D\u6848\u4EF6"), admin && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold btn-sm",
    style: {
      marginLeft: '1rem',
      whiteSpace: 'nowrap'
    },
    onClick: () => setShowAdd(true)
  }, "\uFF0B \u65B0\u589E\u6848\u4EF6")), activeProjects.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty-state",
    style: {
      marginTop: '1rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "empty-state-icon"
  }, "\uD83D\uDCDA"), /*#__PURE__*/React.createElement("div", {
    className: "empty-state-text"
  }, "\u684C\u4E0A\u5C1A\u7121\u9032\u884C\u4E2D\u7684\u5DE5\u7A0B\u6848\u4EF6")), /*#__PURE__*/React.createElement("div", {
    className: "book-shelf"
  }, activeProjects.map(p => renderBook(p, false))), closedProjects.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "gold-divider",
    style: {
      marginTop: '2rem'
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "closed-toggle",
    onClick: () => setShowClosed(v => !v)
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-heading",
    style: {
      marginBottom: 0,
      flex: 1
    }
  }, showClosed ? '收合案件庫' : '展開案件庫', "\uFF08", closedProjects.length, "\uFF09"), /*#__PURE__*/React.createElement("span", {
    className: "closed-caret",
    style: {
      fontSize: "30px"
    }
  }, showClosed ? '▾' : '▸')), showClosed && /*#__PURE__*/React.createElement("div", {
    className: "book-shelf",
    style: {
      marginTop: '0.85rem'
    }
  }, closedProjects.map(p => renderBook(p, true))))), showAdd && /*#__PURE__*/React.createElement(ModalSheet, {
    title: "\u65B0\u589E\u5DE5\u7A0B\u6848\u4EF6",
    onClose: () => setShowAdd(false),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      onClick: () => setShowAdd(false)
    }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-gold",
      onClick: handleAdd
    }, "\u5EFA\u7ACB"))
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u6848\u4EF6\u540D\u7A31 *"), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    value: form.name,
    onChange: e => setForm({
      ...form,
      name: e.target.value
    }),
    placeholder: "\u4F8B\uFF1A\u5317\u6295\u9673\u516C\u9928\u5DE5\u7A0B"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u4E3B\u8981\u8CA0\u8CAC\u4EBA"), /*#__PURE__*/React.createElement("select", {
    className: "field-select",
    value: form.mainOwnerId,
    onChange: e => setForm({
      ...form,
      mainOwnerId: e.target.value
    })
  }, users.map(u => /*#__PURE__*/React.createElement("option", {
    key: u.id,
    value: u.id
  }, u.name, " (", u.role, ")")))), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u5099\u8A3B\uFF08\u9078\u586B\uFF09"), /*#__PURE__*/React.createElement("textarea", {
    className: "field-textarea",
    style: {
      minHeight: 70
    },
    value: form.note,
    onChange: e => setForm({
      ...form,
      note: e.target.value
    }),
    placeholder: "\u6848\u4EF6\u8AAA\u660E..."
  }))), showUsers && /*#__PURE__*/React.createElement(ModalSheet, {
    title: "\u4F7F\u7528\u8005\u7BA1\u7406",
    onClose: () => setShowUsers(false),
    centered: true,
    footer: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-gold",
      onClick: () => setShowUsers(false)
    }, "\u95DC\u9589")
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-mute",
    style: {
      marginBottom: '0.75rem',
      lineHeight: 1.5
    }
  }, "\u7BA1\u7406\u8005\u53EF\u522A\u9664\u5B78\u751F\u5E33\u865F\u3002\u7BA1\u7406\u8005\u8207\u672C\u4EBA\u7121\u6CD5\u522A\u9664\u3002"), users.map(u => {
    const h = getHouse(u);
    const canDelete = u.role !== '管理者' && u.id !== currentUser.id;
    return /*#__PURE__*/React.createElement("div", {
      key: u.id,
      className: "user-manage-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "id-crest",
      style: {
        width: 34,
        height: 38
      }
    }, /*#__PURE__*/React.createElement(HouseEmblem, {
      house: h.emblem,
      name: u.name,
      size: 30
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        color: 'var(--ink)'
      }
    }, u.name), /*#__PURE__*/React.createElement("div", {
      className: "text-xs",
      style: {
        color: u.role === '管理者' ? 'var(--gold-dark)' : 'var(--ink-mute)'
      }
    }, u.role, u.id === currentUser.id ? '（本人）' : '')), canDelete && /*#__PURE__*/React.createElement("button", {
      className: "btn btn-danger btn-sm",
      onClick: () => {
        if (confirm(`確認刪除學生「${u.name}」？`)) onDeleteUser(u.id);
      }
    }, "\u522A\u9664"));
  })));
}

// ── EVENT FORM ────────────────────────────────────────────────────────────────
function EventForm({
  projectId,
  currentUser,
  users,
  onSave,
  onClose,
  initial
}) {
  const initStartDate = initial?.startDate || initial?.date || '';
  const initEndDate = initial?.endDate || initial?.startDate || initial?.date || '';
  const [form, setForm] = useState({
    title: initial?.title || '',
    kind: initial?.kind || 'work',
    details: initial?.details || '',
    vendor: initial?.vendor || '',
    phone: initial?.phone || '',
    category: initial?.category || '木工',
    customCategory: initial?.customCategory || '',
    executorId: initial?.executorId || currentUser.id,
    startDate: initStartDate,
    endDate: initEndDate,
    contentEntries: initial?.contentEntries?.length ? initial.contentEntries : initial?.content ? [{
      id: uid(),
      date: initStartDate,
      content: initial.content
    }] : [{
      id: uid(),
      date: initStartDate,
      content: ''
    }]
  });
  const f = (k, v) => setForm(prev => ({
    ...prev,
    [k]: v
  }));
  const updateContentEntry = (id, key, value) => {
    f('contentEntries', form.contentEntries.map(entry => entry.id === id ? {
      ...entry,
      [key]: value
    } : entry));
  };
  const addContentEntry = () => {
    f('contentEntries', [...form.contentEntries, {
      id: uid(),
      date: form.startDate,
      content: ''
    }]);
  };
  const removeContentEntry = id => {
    const next = form.contentEntries.filter(entry => entry.id !== id);
    f('contentEntries', next.length ? next : [{
      id: uid(),
      date: form.startDate,
      content: ''
    }]);
  };
  const handleSave = () => {
    if (!form.title.trim() || !form.startDate) return alert('請填寫標題與開始日期');
    const start = parseDateOnly(form.startDate);
    const end = parseDateOnly(form.endDate || form.startDate);
    const safeEnd = end && start && end >= start ? form.endDate || form.startDate : form.startDate;
    onSave({
      id: initial?.id || uid(),
      projectId,
      startDate: form.startDate,
      endDate: safeEnd,
      date: form.startDate,
      title: form.title.trim(),
      kind: form.kind,
      details: (form.details || '').trim(),
      vendor: (form.vendor || '').trim(),
      phone: (form.phone || '').trim(),
      category: form.category,
      customCategory: form.customCategory,
      executorId: form.executorId,
      contentEntries: form.contentEntries.filter(entry => entry.content.trim()).map(entry => ({
        ...entry,
        date: entry.date || form.startDate,
        content: entry.content.trim()
      })),
      content: form.contentEntries.filter(entry => entry.content.trim()).map(entry => `${entry.date || form.startDate}：${entry.content.trim()}`).join('\n'),
      status: initial?.completedAt ? 'done' : 'pending',
      createdBy: initial?.createdBy || currentUser.id,
      updatedBy: currentUser.id,
      completedBy: initial?.completedBy || null,
      createdAt: initial?.createdAt || now(),
      updatedAt: now(),
      completedAt: initial?.completedAt || null
    });
    onClose();
  };
  return /*#__PURE__*/React.createElement(ModalSheet, {
    title: initial?.id ? '編輯事件' : '新增事件',
    onClose: onClose,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      onClick: onClose
    }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-gold",
      onClick: handleSave
    }, "\u5132\u5B58"))
  }, /*#__PURE__*/React.createElement("div", {
    className: "date-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u958B\u59CB\u65E5\u671F *"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "field-input",
    value: form.startDate,
    onChange: e => f('startDate', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u7D50\u675F\u65E5\u671F"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "field-input",
    value: form.endDate || form.startDate,
    onChange: e => f('endDate', e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u4E8B\u4EF6\u6A19\u984C *"), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    value: form.title,
    onChange: e => f('title', e.target.value),
    placeholder: "\u4E8B\u4EF6\u540D\u7A31..."
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u4E8B\u4EF6\u6027\u8CEA"), /*#__PURE__*/React.createElement("div", {
    className: "kind-picker",
    role: "radiogroup"
  }, Object.entries(EVENT_KINDS).map(([k, v]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    type: "button",
    role: "radio",
    "aria-checked": form.kind === k,
    className: `kind-opt kind-${k}${form.kind === k ? ' on' : ''}`,
    onClick: () => f('kind', k)
  }, /*#__PURE__*/React.createElement("span", {
    className: "kind-opt-label"
  }, v.label), /*#__PURE__*/React.createElement("span", {
    className: "kind-opt-hint"
  }, v.hint))))), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u8A73\u7D30\u8AAA\u660E"), /*#__PURE__*/React.createElement("textarea", {
    className: "field-textarea",
    rows: 4,
    value: form.details,
    onChange: e => f('details', e.target.value),
    placeholder: form.kind === 'urgent' ? '\u4F8B\uFF1A\u8981\u8CB7\u4EC0\u9EBC\u3001\u898F\u683C\u6578\u91CF\u3001\u4F55\u6642\u8981\u5230\u73FE\u5834' : form.kind === 'scheduled' ? '\u4F8B\uFF1A\u6642\u9593\u3001\u5730\u9EDE\u3001\u8981\u6E96\u5099\u7684\u6771\u897F' : '\u4F8B\uFF1A\u65BD\u5DE5\u7BC4\u570D\u3001\u6750\u6599\u898F\u683C\u3001\u6CE8\u610F\u4E8B\u9805'
  })), /*#__PURE__*/React.createElement("div", {
    className: "date-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u5EE0\u5546\uFF0F\u806F\u7D61\u4EBA"), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    value: form.vendor,
    onChange: e => f('vendor', e.target.value),
    placeholder: "\u9078\u586B"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u96FB\u8A71"), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    type: "tel",
    inputMode: "tel",
    value: form.phone,
    onChange: e => f('phone', e.target.value),
    placeholder: "\u9078\u586B"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u5DE5\u7A0B\u985E\u578B"), /*#__PURE__*/React.createElement("select", {
    className: "field-select",
    value: form.category,
    onChange: e => f('category', e.target.value)
  }, CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c
  }, c)))), form.category === '其他' && /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u81EA\u8A02\u985E\u578B"), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    value: form.customCategory,
    onChange: e => f('customCategory', e.target.value),
    placeholder: "\u8ACB\u8F38\u5165\u985E\u578B"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u57F7\u884C\u8005"), /*#__PURE__*/React.createElement("select", {
    className: "field-select",
    value: form.executorId,
    onChange: e => f('executorId', e.target.value)
  }, users.map(u => /*#__PURE__*/React.createElement("option", {
    key: u.id,
    value: u.id
  }, u.name)))), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "event-content-editor-heading"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u6BCF\u65E5\u73FE\u5834\u7D00\u9304"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn btn-outline btn-sm",
    onClick: addContentEntry
  }, "\uFF0B \u65B0\u589E\u65E5\u671F\u5167\u5BB9")), /*#__PURE__*/React.createElement("div", {
    className: "event-content-editor-list"
  }, form.contentEntries.map(entry => /*#__PURE__*/React.createElement("div", {
    className: "event-content-editor-row",
    key: entry.id
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "field-input event-content-date",
    value: entry.date || '',
    onChange: e => updateContentEntry(entry.id, 'date', e.target.value)
  }), /*#__PURE__*/React.createElement("textarea", {
    className: "field-textarea event-content-text",
    value: entry.content,
    onChange: e => updateContentEntry(entry.id, 'content', e.target.value),
    placeholder: "\u586B\u5BEB\u7576\u65E5\u73FE\u5834\u72C0\u6CC1\u3001\u65BD\u5DE5\u8981\u6C42\u6216\u6CE8\u610F\u4E8B\u9805..."
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "event-content-remove",
    onClick: () => removeContentEntry(entry.id),
    "aria-label": "\u522A\u9664\u6B64\u65E5\u671F\u5167\u5BB9"
  }, "\xD7"))))));
}

// ── MEMO FORM ─────────────────────────────────────────────────────────────────
function MemoForm({
  projectId,
  currentUser,
  onSave,
  onClose,
  initial
}) {
  const [form, setForm] = useState(initial || {
    title: '',
    content: '',
    category: '木工',
    customCategory: '',
    date: '',
    isPinned: true
  });
  const f = (k, v) => setForm({
    ...form,
    [k]: v
  });
  const handleSave = () => {
    if (!form.title.trim()) return alert('請填寫注意事項主旨');
    onSave({
      id: initial?.id || uid(),
      projectId,
      date: form.date || null,
      title: form.title.trim(),
      content: form.content,
      category: form.category,
      customCategory: form.customCategory,
      isPinned: true,
      createdBy: initial?.createdBy || currentUser.id,
      updatedBy: currentUser.id,
      createdAt: initial?.createdAt || now(),
      updatedAt: now()
    });
    onClose();
  };
  return /*#__PURE__*/React.createElement(ModalSheet, {
    title: initial ? '編輯注意事項' : '新增注意事項',
    onClose: onClose,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-outline",
      onClick: onClose
    }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-gold",
      onClick: handleSave
    }, "\u5132\u5B58"))
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u6CE8\u610F\u4E8B\u9805\u4E3B\u65E8 *"), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    value: form.title,
    onChange: e => f('title', e.target.value),
    placeholder: "\u4E3B\u65E8..."
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u6CE8\u610F\u4E8B\u9805\u5167\u5BB9"), /*#__PURE__*/React.createElement("textarea", {
    className: "field-textarea",
    value: form.content,
    onChange: e => f('content', e.target.value),
    placeholder: "\u8A73\u7D30\u8AAA\u660E\u3001\u8A0E\u8AD6\u7D00\u9304\u3001\u6CE8\u610F\u4E8B\u9805..."
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u5DE5\u7A0B\u985E\u578B"), /*#__PURE__*/React.createElement("select", {
    className: "field-select",
    value: form.category,
    onChange: e => f('category', e.target.value)
  }, CATEGORIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c
  }, c)))), form.category === '其他' && /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u81EA\u8A02\u985E\u578B"), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    value: form.customCategory,
    onChange: e => f('customCategory', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-group"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u65E5\u671F\uFF08\u9078\u586B\uFF09"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "field-input",
    value: form.date || '',
    onChange: e => f('date', e.target.value)
  })));
}

// ── EVENT CARD (工程書頁 · parchment page) ──────────────────────────────────────
function EventCard({
  ev,
  users,
  onEdit,
  onComplete,
  onDelete,
  onView,
  canManage
}) {
  const evStart = ev.startDate || ev.date;
  const evEnd = ev.endDate || ev.startDate || ev.date;
  const info = eventUrgencyInfo(evStart, ev.completedAt);
  const isRange = evStart && evEnd && evStart !== evEnd;
  const periodText = isRange ? `${fmt(evStart)} ～ ${fmt(evEnd)}` : fmt(evStart);
  const kind = evKind(ev);
  const isUrgent = !ev.completedAt && kind === 'urgent';
  return /*#__PURE__*/React.createElement("div", {
    className: `event-page kind-${kind}${ev.completedAt ? ' is-done' : ''}${kind !== 'work' && !ev.completedAt ? ' is-flagged' : ''}`,
    style: {
      '--cat': catColor(ev)
    }
  }, kind !== 'work' && !ev.completedAt && /*#__PURE__*/React.createElement("span", {
    className: `event-urgent-stamp kind-${kind}`
  }, EVENT_KINDS[kind].label), /*#__PURE__*/React.createElement("div", {
    className: "event-page-tab"
  }, /*#__PURE__*/React.createElement("span", {
    className: "event-page-days"
  }, info.daysText)), /*#__PURE__*/React.createElement("div", {
    className: "event-page-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "event-page-heading"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag-type"
  }, ev.category === '其他' ? ev.customCategory || '其他' : ev.category), /*#__PURE__*/React.createElement("div", {
    className: "event-page-title",
    style: {
      textDecoration: ev.completedAt ? 'line-through' : 'none'
    }
  }, ev.title)), /*#__PURE__*/React.createElement("div", {
    className: "event-page-meta"
  }, ev.executorId && /*#__PURE__*/React.createElement(UserBadge, {
    userId: ev.executorId,
    users: users
  })), /*#__PURE__*/React.createElement("div", {
    className: "event-page-period"
  }, periodText), /*#__PURE__*/React.createElement(EventDetails, {
    ev: ev,
    clamp: true
  }), (ev.contentEntries?.length || ev.content) && /*#__PURE__*/React.createElement("div", {
    className: "event-content-list"
  }, (ev.contentEntries?.length ? ev.contentEntries : [{
    id: 'legacy',
    date: evStart,
    content: ev.content
  }]).map(entry => /*#__PURE__*/React.createElement("div", {
    className: "event-content-item",
    key: entry.id || `${entry.date}-${entry.content}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "event-content-bullet"
  }, "\u2022"), /*#__PURE__*/React.createElement("span", {
    className: "event-content-item-date"
  }, fmt(entry.date || evStart)), /*#__PURE__*/React.createElement("span", {
    className: "event-content-item-text"
  }, entry.content)))), /*#__PURE__*/React.createElement("div", {
    className: "event-page-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: () => onView(ev)
  }, "\u8A73\u60C5"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: () => onEdit(ev)
  }, "\u7DE8\u8F2F"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: () => onComplete(ev)
  }, ev.completedAt ? '取消' : '✓ 完成'), canManage && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-danger btn-sm",
    onClick: () => onDelete(ev.id)
  }, "\u522A\u9664")), /*#__PURE__*/React.createElement("div", {
    className: "event-page-credit"
  }, "\u5EFA\u7ACB ", /*#__PURE__*/React.createElement(UserBadge, {
    userId: ev.createdBy,
    users: users
  }))));
}

// ── MEMO CARD (羊皮紙註記) ───────────────────────────────────────────────────────
function MemoCard({
  memo,
  users,
  onEdit,
  onDelete,
  onView,
  canManage
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `memo-card${memo.isPinned ? ' memo-pinned' : ''}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "memo-owl",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v6"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => onView(memo),
    style: {
      flex: 1,
      cursor: 'pointer',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "memo-title"
  }, memo.title), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-1 flex-wrap items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag-type"
  }, memo.category === '其他' ? memo.customCategory || '其他' : memo.category), memo.date && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-mute"
  }, fmt(memo.date))), memo.content && /*#__PURE__*/React.createElement("div", {
    className: "memo-preview mt-1"
  }, memo.content)), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-1"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-icon btn-sm",
    style: {
      color: 'var(--gold-dark)',
      borderColor: 'var(--gold-dark)'
    },
    onClick: () => onView(memo)
  }, "\u67E5\u770B"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-icon btn-sm",
    style: {
      color: 'var(--gold-dark)',
      borderColor: 'var(--gold-dark)'
    },
    onClick: () => onEdit(memo)
  }, "\u7DE8\u8F2F"), canManage && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-danger btn-icon btn-sm",
    onClick: () => onDelete(memo.id)
  }, "\u522A\u9664"))));
}

// ── MEMO DETAIL ───────────────────────────────────────────────────────────────
function MemoDetail({
  memo,
  users,
  currentUser,
  memoItems,
  onClose,
  onSaveMemo,
  onSaveItems
}) {
  const [editingMemo, setEditingMemo] = useState(false);
  const [items, setItems] = useState(memoItems.filter(i => i.memoId === memo.id));
  const [newItem, setNewItem] = useState('');
  const addItem = () => {
    if (!newItem.trim()) return;
    const item = {
      id: uid(),
      memoId: memo.id,
      content: newItem.trim(),
      isDone: false,
      sortOrder: items.length,
      createdBy: currentUser.id,
      updatedBy: currentUser.id,
      createdAt: now(),
      updatedAt: now()
    };
    const next = [...items, item];
    setItems(next);
    onSaveItems(memo.id, next);
    setNewItem('');
  };
  const toggleItem = id => {
    const next = items.map(i => i.id === id ? {
      ...i,
      isDone: !i.isDone,
      updatedBy: currentUser.id,
      updatedAt: now()
    } : i);
    setItems(next);
    onSaveItems(memo.id, next);
  };
  const deleteItem = id => {
    const next = items.filter(i => i.id !== id);
    setItems(next);
    onSaveItems(memo.id, next);
  };
  const updateItemContent = (id, content) => {
    const next = items.map(i => i.id === id ? {
      ...i,
      content,
      updatedBy: currentUser.id,
      updatedAt: now()
    } : i);
    setItems(next);
    onSaveItems(memo.id, next);
  };
  return /*#__PURE__*/React.createElement(ModalSheet, {
    title: "\u6CE8\u610F\u4E8B\u9805\u8A73\u60C5",
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '1rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: '1.05rem',
      color: 'var(--ink-mid)',
      fontWeight: 700
    }
  }, memo.title), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    style: {
      color: 'var(--gold-dark)',
      borderColor: 'var(--gold-dark)'
    },
    onClick: () => setEditingMemo(true)
  }, "\u270E \u7DE8\u8F2F")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag-type"
  }, memo.category === '其他' ? memo.customCategory || '其他' : memo.category), memo.date && /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      background: 'rgba(200,169,81,0.18)',
      borderColor: 'var(--border-gold)',
      color: 'var(--ink-mid)'
    }
  }, fmt(memo.date))), memo.content && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,248,224,0.5)',
      border: '1px solid var(--border-gold)',
      borderRadius: 4,
      padding: '0.75rem',
      lineHeight: 1.6,
      fontSize: '1rem',
      color: 'var(--ink)',
      marginBottom: '0.75rem'
    }
  }, memo.content), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3 text-xs text-mute flex-wrap"
  }, /*#__PURE__*/React.createElement("span", null, "\u5EFA\u7ACB ", /*#__PURE__*/React.createElement(UserBadge, {
    userId: memo.createdBy,
    users: users
  }), " ", fmtFull(memo.createdAt)), /*#__PURE__*/React.createElement("span", null, "\u4FEE\u6539 ", /*#__PURE__*/React.createElement(UserBadge, {
    userId: memo.updatedBy,
    users: users
  }), " ", fmtFull(memo.updatedAt)))), /*#__PURE__*/React.createElement("div", {
    className: "gold-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "section-heading gold-on-parch"
  }, "\u7D30\u9805\u6E05\u55AE"), items.map(item => /*#__PURE__*/React.createElement("div", {
    key: item.id,
    className: "memo-item-row"
  }, /*#__PURE__*/React.createElement(CheckBox, {
    checked: item.isDone,
    onChange: () => toggleItem(item.id)
  }), /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    style: {
      flex: 1,
      fontSize: '1rem',
      textDecoration: item.isDone ? 'line-through' : 'none',
      opacity: item.isDone ? 0.6 : 1
    },
    value: item.content,
    onChange: e => updateItemContent(item.id, e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-danger btn-icon btn-sm",
    onClick: () => deleteItem(item.id)
  }, "\u2715"))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-3"
  }, /*#__PURE__*/React.createElement("input", {
    className: "field-input",
    style: {
      flex: 1
    },
    value: newItem,
    onChange: e => setNewItem(e.target.value),
    placeholder: "\u65B0\u589E\u7D30\u9805...",
    onKeyDown: e => e.key === 'Enter' && addItem()
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold btn-sm",
    onClick: addItem
  }, "\u65B0\u589E")), editingMemo && /*#__PURE__*/React.createElement(MemoForm, {
    projectId: memo.projectId,
    currentUser: currentUser,
    onSave: m => {
      onSaveMemo(m);
      setEditingMemo(false);
    },
    onClose: () => setEditingMemo(false),
    initial: memo
  }));
}

// ── PROJECT DETAIL ────────────────────────────────────────────────────────────
function ProjectDetail({
  project,
  currentUser,
  users,
  allEvents,
  allMemos,
  allMemoItems,
  onUpdateProject,
  onDeleteProject,
  onSaveEvent,
  onSaveEvents,
  onDeleteEvent,
  onSaveMemo,
  onDeleteMemo,
  onSaveMemoItems,
  onBack
}) {
  const admin = isAdmin(currentUser);
  const [showEventForm, setShowEventForm] = useState(null);
  const [showMemoForm, setShowMemoForm] = useState(null);
  const [showMemoDetail, setShowMemoDetail] = useState(null);
  const [showEventDetail, setShowEventDetail] = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const importInputRef = useRef(null);
  const dateRefs = useRef({});
  const handleImportFile = e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(reader.result), {
          type: 'array',
          cellStyles: true
        });
        const res = parseScheduleWorkbook(wb);
        if (!res.events.length) throw new Error('表裡沒有塗色的施工日');
        setImportResult(res);
      } catch (err) {
        alert(`無法讀取這份工期表：${err.message || err}\n\n需要的格式：每月一個區塊、第一列是日期、每列一個工種、用底色標出施工日。`);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  const doImport = (list, executorId) => {
    const stamp = now();
    const created = list.map(ev => ({
      id: uid(),
      projectId: project.id,
      startDate: ev.startDate,
      endDate: ev.endDate,
      date: ev.startDate,
      title: ev.title,
      kind: ev.kind,
      details: ev.details,
      vendor: '',
      phone: '',
      category: ev.category,
      customCategory: ev.customCategory,
      executorId,
      contentEntries: [],
      content: '',
      status: 'pending',
      source: 'schedule-import',
      createdBy: currentUser.id,
      updatedBy: currentUser.id,
      completedBy: null,
      createdAt: stamp,
      updatedAt: stamp,
      completedAt: null
    }));
    setImportResult(null);
    Promise.resolve(onSaveEvents(created)).then(ok => {
      if (ok === false) return;
      if (created[0]) {
        const d = parseDateOnly(created[0].startDate);
        if (d) setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
      showToast(`已匯入 ${created.length} 項工程`);
    });
  };
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2300);
  };
  const events = allEvents.filter(e => e.projectId === project.id && !e.deletedAt);
  const memos = allMemos.filter(m => m.projectId === project.id && !m.deletedAt);

  // calendarMap: events expanded over full date range (for calendar display only)
  const calendarMap = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const startDate = e.startDate || e.date;
      const endDate = e.endDate || e.startDate || e.date;
      const rangeKeys = getDateRangeKeys(startDate, endDate);
      rangeKeys.forEach(dateKey => {
        if (!map[dateKey]) map[dateKey] = {
          events: [],
          memos: []
        };
        if (!map[dateKey].events.some(x => x.id === e.id)) map[dateKey].events.push(e);
      });
    });
    memos.forEach(m => {
      if (m.date) {
        if (!map[m.date]) map[m.date] = {
          events: [],
          memos: []
        };
        map[m.date].memos.push(m);
      }
    });
    return map;
  }, [events, memos]);

  // timelineMap: events only on startDate (no duplication in timeline)
  const timelineMap = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const startDate = e.startDate || e.date;
      if (!startDate) return;
      if (!map[startDate]) map[startDate] = {
        events: [],
        memos: []
      };
      if (!map[startDate].events.some(x => x.id === e.id)) map[startDate].events.push(e);
    });
    return map;
  }, [events, memos]);
  const sortedDates = Object.keys(timelineMap).sort((a, b) => a.localeCompare(b));
  const pinnedMemos = memos;
  const handleSelectCalendarDate = dateKey => {
    setSelectedDate(dateKey);
  };
  const jumpToEvent = ev => {
    const el = dateRefs.current[ev.startDate || ev.date];
    if (el) el.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };
  const handleComplete = ev => {
    const updated = {
      ...ev,
      completedAt: ev.completedAt ? null : now(),
      completedBy: ev.completedAt ? null : currentUser.id,
      status: ev.completedAt ? 'pending' : 'done',
      updatedBy: currentUser.id,
      updatedAt: now()
    };
    onSaveEvent(updated);
    showToast(ev.completedAt ? '已取消完成' : '已標記完成');
  };
  const handleDeleteEvent = id => {
    const ev = events.find(e => e.id === id);
    if (!confirm(`確定要刪除「${ev ? ev.title : '這個事件'}」？刪除後無法復原。`)) return;
    onDeleteEvent(id);
    showToast('事件已刪除');
  };
  const handleDeleteMemo = id => {
    const m = memos.find(x => x.id === id);
    if (!confirm(`確定要刪除注意事項「${m ? m.title : ''}」？刪除後無法復原。`)) return;
    onDeleteMemo(id);
    showToast('注意事項已刪除');
  };
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const ownName = users.find(u => u.id === project.mainOwnerId)?.name || '';
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['案件名稱', '主要負責人', '狀態', '建立時間', '結案時間'], [project.name, ownName, PROJECT_STATUSES[project.status] || project.status, fmtFull(project.createdAt), fmtFull(project.closedAt)]]), '案件總覽');
    const evRows = [['開始日期', '結束日期', '事件標題', '性質', '詳細說明', '廠商／聯絡人', '電話', '工程類型', '執行者', '狀態', '事件內容', '建立者', '修改者', '完成者', '建立時間', '修改時間', '完成時間']];
    events.forEach(e => evRows.push([fmt(e.startDate || e.date), fmt(e.endDate || e.startDate || e.date), e.title, EVENT_KINDS[evKind(e)].label, e.details || '', e.vendor || '', e.phone || '', e.category === '其他' ? e.customCategory : e.category, users.find(u => u.id === e.executorId)?.name || '', e.completedAt ? '已完成' : '未完成', e.content, users.find(u => u.id === e.createdBy)?.name || '', users.find(u => u.id === e.updatedBy)?.name || '', users.find(u => u.id === e.completedBy)?.name || '', fmtFull(e.createdAt), fmtFull(e.updatedAt), fmtFull(e.completedAt)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(evRows), '事件清單');
    const memoRows = [['日期', '主旨', '工程類型', '是否置頂', '注意事項內容', '建立者', '修改者', '建立時間', '修改時間']];
    memos.forEach(m => memoRows.push([fmt(m.date), m.title, m.category === '其他' ? m.customCategory : m.category, m.isPinned ? '是' : '否', m.content, users.find(u => u.id === m.createdBy)?.name || '', users.find(u => u.id === m.updatedBy)?.name || '', fmtFull(m.createdAt), fmtFull(m.updatedAt)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(memoRows), '注意事項清單');
    const itemRows = [['注意事項主旨', '細項內容', '是否完成', '排序', '建立者', '修改者', '建立時間', '修改時間']];
    memos.forEach(m => {
      allMemoItems.filter(i => i.memoId === m.id).forEach(i => itemRows.push([m.title, i.content, i.isDone ? '是' : '否', i.sortOrder, users.find(u => u.id === i.createdBy)?.name || '', users.find(u => u.id === i.updatedBy)?.name || '', fmtFull(i.createdAt), fmtFull(i.updatedAt)]));
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), '注意事項細項');
    XLSX.writeFile(wb, `${project.name}_結案報告.xlsx`);
  };
  const handleCloseProject = async () => {
    // 直接封存（不讓匯出失敗中斷結案）
    const saved = await onUpdateProject({
      ...project,
      status: 'closed',
      closedAt: now(),
      updatedAt: now(),
      updatedBy: currentUser.id
    });
    if (!saved) {
      setShowCloseConfirm(false);
      showToast('結案同步失敗，案件尚未封存');
      return;
    }
    try {
      exportExcel();
    } catch (e) {
      console.warn('Excel 匯出失敗', e);
    }
    setShowCloseConfirm(false);
    showToast('案件已封存並匯出 Excel');
    setTimeout(() => onBack(), 900);
  };
  const owner = users.find(u => u.id === project.mainOwnerId);
  const h = getHouse(owner);
  const changeStatus = s => {
    onUpdateProject({
      ...project,
      status: s,
      updatedAt: now(),
      updatedBy: currentUser.id
    });
    showToast('狀態已更新');
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "parchment-bg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back-btn",
    onClick: onBack
  }, "\u2190 \u8FD4\u56DE"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "header-title",
    style: {
      fontSize: '1rem',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, project.name), /*#__PURE__*/React.createElement("div", {
    className: "header-subtitle"
  }, /*#__PURE__*/React.createElement(UserBadge, {
    userId: project.mainOwnerId,
    users: users
  }), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 4
    }
  }, PROJECT_STATUSES[project.status]))), admin && project.status !== 'closed' && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-danger btn-sm",
    onClick: () => setShowCloseConfirm(true)
  }, "\u7D50\u6848"))), /*#__PURE__*/React.createElement("div", {
    className: "opened-book"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spine-plate",
    style: {
      '--bar': h.primary
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "spine-hub top"
  }), /*#__PURE__*/React.createElement("span", {
    className: "spine-hub bot"
  }), /*#__PURE__*/React.createElement("div", {
    className: "spine-emblem"
  }, /*#__PURE__*/React.createElement(HouseEmblem, {
    house: h.emblem,
    name: owner && owner.name,
    size: 52
  })), /*#__PURE__*/React.createElement("div", {
    className: "spine-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spine-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spine-label",
    style: {
      borderColor: `color-mix(in srgb, ${h.metal} 50%, transparent)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "spine-eyebrow",
    style: {
      color: h.metal
    }
  }, "\u5DE5\u7A0B\u6848\u4EF6 \xB7 \u4E3B\u7406 ", owner ? owner.name : ''), /*#__PURE__*/React.createElement("div", {
    className: "spine-title"
  }, project.name))), project.status !== 'closed' ? /*#__PURE__*/React.createElement("div", {
    className: "status-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "status-lbl"
  }, "\u76EE\u524D\u72C0\u614B"), /*#__PURE__*/React.createElement("select", {
    className: "status-select",
    value: project.status,
    onChange: e => changeStatus(e.target.value)
  }, ACTIVE_STATUS_OPTIONS.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, PROJECT_STATUSES[s])))) : /*#__PURE__*/React.createElement("div", {
    className: "status-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: `pill ${statusClass('closed')}`,
  }, PROJECT_STATUSES.closed))))), /*#__PURE__*/React.createElement("div", {
    className: "page page-enter",
    style: {
      paddingBottom: '5rem',
      paddingTop: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-heading with-action"
  }, /*#__PURE__*/React.createElement("span", null, "\u65E5\u671F\u8868"), project.status !== 'closed' && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    onClick: () => importInputRef.current && importInputRef.current.click()
  }, "\u532F\u5165\u5DE5\u671F\u8868"), /*#__PURE__*/React.createElement("input", {
    ref: importInputRef,
    type: "file",
    accept: ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    style: {
      display: 'none'
    },
    onChange: handleImportFile
  })), importResult && /*#__PURE__*/React.createElement(ScheduleImport, {
    result: importResult,
    existing: events,
    users: users,
    currentUser: currentUser,
    onCancel: () => setImportResult(null),
    onImport: doImport
  }), /*#__PURE__*/React.createElement("div", {
    className: "cal-wrap"
  }, /*#__PURE__*/React.createElement(MagicCalendar, {
    calendarMonth: calendarMonth,
    setCalendarMonth: setCalendarMonth,
    calendarMap: calendarMap,
    onSelectDate: handleSelectCalendarDate,
    selectedDate: selectedDate
  }), /*#__PURE__*/React.createElement("div", {
    className: "cal-legend"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "lg-bar"
  }), "\u65BD\u5DE5\u671F\u9593\uFF08\u984F\u8272\uFF1D\u5DE5\u7A2E\uFF09"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "cal-flag urgent"
  }, "\u7DCA\u6025")), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "cal-flag sched"
  }, "\u9810\u5B9A")), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "cal-flag memo"
  }, "\u6CE8\u610F")), /*#__PURE__*/React.createElement("span", null, "\u9EDE\u65E5\u671F\u770B\u7576\u5929\u5168\u90E8"))), selectedDate && /*#__PURE__*/React.createElement(DaySheet, {
    dateKey: selectedDate,
    dayData: calendarMap[selectedDate],
    users: users,
    canEdit: project.status !== 'closed',
    onClose: () => setSelectedDate(null),
    onView: ev => {
      setSelectedDate(null);
      setShowEventDetail(ev);
    },
    onComplete: handleComplete
  }), false && /*#__PURE__*/React.createElement("div", {
    className: "selected-date-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-heading gold-on-parch",
    style: {
      marginBottom: '0.5rem'
    }
  }, selectedDate.replace(/-/g, '/'), " \u7576\u65E5\u4E8B\u9805"), (calendarMap[selectedDate].events || []).map(ev => {
    const cat = ev.category === '其他' ? ev.customCategory || '其他' : ev.category;
    return /*#__PURE__*/React.createElement("div", {
      key: ev.id,
      className: "selected-date-item"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tag-type"
    }, cat), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, ev.title));
  }), (calendarMap[selectedDate].memos || []).map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    className: "selected-date-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag-type"
  }, "\u6CE8\u610F\u4E8B\u9805"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, m.title)))), pinnedMemos.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "pinned-zone"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-heading",
    style: {
      marginBottom: '0.5rem'
    }
  }, "\u6CE8\u610F\u4E8B\u9805"), pinnedMemos.map(m => /*#__PURE__*/React.createElement(MemoCard, {
    key: m.id,
    memo: m,
    users: users,
    canManage: admin,
    onEdit: () => setShowMemoForm(m),
    onDelete: handleDeleteMemo,
    onView: () => setShowMemoDetail(m)
  }))), sortedDates.length === 0 && pinnedMemos.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, /*#__PURE__*/React.createElement("div", {
    className: "empty-state-icon"
  }, "\uD83D\uDCCB"), /*#__PURE__*/React.createElement("div", {
    className: "empty-state-text"
  }, "\u6B64\u6848\u4EF6\u5C1A\u7121\u4E8B\u4EF6\u6216\u6CE8\u610F\u4E8B\u9805"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-mute mt-2"
  }, "\u9EDE\u9078\u4E0B\u65B9\u6309\u9215\u65B0\u589E")), sortedDates.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "section-heading"
  }, "\u4E8B\u4EF6\u6642\u9593\u7DDA"), sortedDates.map(date => /*#__PURE__*/React.createElement("div", {
    key: date,
    className: "date-block",
    ref: el => dateRefs.current[date] = el
  }, /*#__PURE__*/React.createElement("div", {
    className: "date-label"
  }, date.replace(/-/g, '/')), (timelineMap[date].events || []).map(ev => /*#__PURE__*/React.createElement(EventCard, {
    key: ev.id,
    ev: ev,
    users: users,
    canManage: admin,
    onEdit: () => project.status !== 'closed' && setShowEventForm(ev),
    onComplete: handleComplete,
    onDelete: () => project.status !== 'closed' && handleDeleteEvent(ev.id),
    onView: () => setShowEventDetail(ev)
  })))), project.status !== 'closed' && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-4"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold btn-full",
    onClick: () => setShowEventForm({})
  }, "\uFF0B \u65B0\u589E\u4E8B\u4EF6"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-full",
    onClick: () => setShowMemoForm({})
  }, "\uFF0B \u6CE8\u610F\u4E8B\u9805"))), showEventForm !== null && /*#__PURE__*/React.createElement(EventForm, {
    projectId: project.id,
    currentUser: currentUser,
    users: users,
    initial: showEventForm?.id ? showEventForm : null,
    onSave: ev => {
      onSaveEvent(ev);
      showToast(showEventForm?.id ? '事件已更新' : '事件已新增');
    },
    onClose: () => setShowEventForm(null)
  }), showMemoForm !== null && /*#__PURE__*/React.createElement(MemoForm, {
    projectId: project.id,
    currentUser: currentUser,
    initial: showMemoForm?.id ? showMemoForm : null,
    onSave: m => {
      onSaveMemo(m);
      showToast(showMemoForm?.id ? '注意事項已更新' : '注意事項已新增');
    },
    onClose: () => setShowMemoForm(null)
  }), showMemoDetail && /*#__PURE__*/React.createElement(MemoDetail, {
    memo: showMemoDetail,
    users: users,
    currentUser: currentUser,
    memoItems: allMemoItems,
    onClose: () => setShowMemoDetail(null),
    onSaveMemo: m => {
      onSaveMemo(m);
      setShowMemoDetail(m);
    },
    onSaveItems: onSaveMemoItems
  }), showEventDetail && /*#__PURE__*/React.createElement(ModalSheet, {
    title: "\u4E8B\u4EF6\u8A73\u60C5",
    onClose: () => setShowEventDetail(null)
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: '1.05rem',
      color: 'var(--ink-mid)',
      marginBottom: '0.75rem',
      fontWeight: 700
    }
  }, showEventDetail.title), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag-type"
  }, showEventDetail.category === '其他' ? showEventDetail.customCategory || '其他' : showEventDetail.category), showEventDetail.executorId && /*#__PURE__*/React.createElement(UserBadge, {
    userId: showEventDetail.executorId,
    users: users
  })), /*#__PURE__*/React.createElement(EventDetails, {
    ev: showEventDetail
  }), (showEventDetail.contentEntries?.length || showEventDetail.content) && /*#__PURE__*/React.createElement("div", {
    className: "event-content-list event-content-list-detail"
  }, (showEventDetail.contentEntries?.length ? showEventDetail.contentEntries : [{
    id: 'legacy',
    date: showEventDetail.startDate || showEventDetail.date,
    content: showEventDetail.content
  }]).map(entry => /*#__PURE__*/React.createElement("div", {
    className: "event-content-item",
    key: entry.id || `${entry.date}-${entry.content}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "event-content-bullet"
  }, "\u2022"), /*#__PURE__*/React.createElement("span", {
    className: "event-content-item-date"
  }, fmt(entry.date || showEventDetail.startDate || showEventDetail.date)), /*#__PURE__*/React.createElement("span", {
    className: "event-content-item-text"
  }, entry.content)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.9rem',
      color: 'var(--ink-mute)',
      lineHeight: 1.9
    }
  }, (() => {
    const s = showEventDetail.startDate || showEventDetail.date;
    const e = showEventDetail.endDate || showEventDetail.startDate || showEventDetail.date;
    const isRange = s && e && s !== e;
    return /*#__PURE__*/React.createElement("div", null, "\u671F\u9593\uFF1A", isRange ? `${fmt(s)} ～ ${fmt(e)}` : fmt(s));
  })(), showEventDetail.completedAt && /*#__PURE__*/React.createElement("div", null, "\u5B8C\u6210\u6642\u9593\uFF1A", fmtFull(showEventDetail.completedAt))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-mute"
  }, "\u5EFA\u7ACB ", /*#__PURE__*/React.createElement(UserBadge, {
    userId: showEventDetail.createdBy,
    users: users
  })), showEventDetail.completedBy && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-mute"
  }, "\u5B8C\u6210 ", /*#__PURE__*/React.createElement(UserBadge, {
    userId: showEventDetail.completedBy,
    users: users
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold btn-sm",
    onClick: () => {
      setShowEventForm(showEventDetail);
      setShowEventDetail(null);
    }
  }, "\u270E \u7DE8\u8F2F"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    style: {
      color: 'var(--gold-dark)',
      borderColor: 'var(--gold-dark)'
    },
    onClick: () => {
      handleComplete(showEventDetail);
      setShowEventDetail(null);
    }
  }, showEventDetail.completedAt ? '取消完成' : '✓ 標記完成'))), showCloseConfirm && /*#__PURE__*/React.createElement(ModalSheet, {
    title: "\u6848\u4EF6\u7D50\u6848",
    onClose: () => setShowCloseConfirm(false),
    centered: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "confirm-dialog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "confirm-icon"
  }, "\uD83D\uDCE6"), /*#__PURE__*/React.createElement("div", {
    className: "confirm-title"
  }, "\u78BA\u8A8D\u5C01\u5B58\u300C", project.name, "\u300D\uFF1F"), /*#__PURE__*/React.createElement("div", {
    className: "confirm-desc"
  }, "\u5C01\u5B58\u5F8C\u6848\u4EF6\u6703\u79FB\u81F3\u4E0B\u65B9\u300C\u6848\u4EF6\u5EAB\u300D\uFF0C\u4E26\u81EA\u52D5\u532F\u51FA Excel \u5831\u544A\uFF08\u5305\u542B\u6240\u6709\u4E8B\u4EF6\u3001\u6CE8\u610F\u4E8B\u9805\u8207\u7D30\u9805\uFF09\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold btn-full",
    onClick: () => handleCloseProject()
  }, "\u5C01\u5B58\u4E26\u532F\u51FA"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-full",
    onClick: () => setShowCloseConfirm(false)
  }, "\u53D6\u6D88")))), toast && /*#__PURE__*/React.createElement(Toast, {
    msg: toast,
    onDone: () => setToast(null)
  }));
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
function App() {
  const [currentUser, setCurrentUser] = useState(null); // 每次進入都需重新選擇使用者
  const [users, setUsers] = useState(() => {
    const saved = db.get('users', []);
    if (!saved.length) {
      db.set('users', DEFAULT_USERS);
      return DEFAULT_USERS;
    }
    return saved;
  });
  const [projects, setProjects] = useState(() => db.get('projects', []));
  const [events, setEvents] = useState(() => db.get('events', []));
  const [memos, setMemos] = useState(() => db.get('memos', []));
  const [memoItems, setMemoItems] = useState(() => db.get('memoItems', []));
  const [currentProject, setCurrentProject] = useState(null);
  const [conn, setConn] = useState(supaClient ? 'connecting' : 'offline');
  const lastWriteRef = useRef(0); // 本機剛寫入的時間戳：避免輪詢覆蓋未推送完成的變更

  // 雲端初次載入 + 即時訂閱
  useEffect(() => {
    if (!supaClient) return;
    let active = true;
    const setters = {
      users: setUsers,
      projects: setProjects,
      events: setEvents,
      memos: setMemos,
      memoItems: setMemoItems
    };
    const cacheKey = {
      users: 'users',
      projects: 'projects',
      events: 'events',
      memos: 'memos',
      memoItems: 'memoItems'
    };
    const applyRealtime = (key, payload) => {
      setters[key](prev => {
        let next;
        if (payload.eventType === 'DELETE') {
          const id = payload.old && payload.old.id;
          next = prev.filter(x => x.id !== id);
        } else {
          const obj = payload.new && payload.new.data;
          if (!obj) return prev;
          next = prev.some(x => x.id === obj.id) ? prev.map(x => x.id === obj.id ? obj : x) : [...prev, obj];
        }
        db.set(cacheKey[key], next);
        return next;
      });
    };
    (async () => {
      const all = await cloudFetchAll();
      if (!active) return;
      if (all.users && all.users.length === 0) {
        await cloudPushDiff('users', [], DEFAULT_USERS);
        all.users = DEFAULT_USERS;
      }
      for (const key of Object.keys(TABLES)) {
        if (all[key]) {
          setters[key](all[key]);
          db.set(cacheKey[key], all[key]);
        }
      }
      setConn(all.__ok ? 'online' : 'offline');
    })();

    // 重新整理：把雲端資料整批拉回（前景／輪詢／手動 共用）
    const refetchAll = async force => {
      if (!supaClient) return;
      // 本機 4 秒內剛寫入 → 跳過覆蓋，避免蓋掉尚未推送完成的變更（手動刷新除外）
      if (!force && Date.now() - lastWriteRef.current < 4000) return;
      const all = await cloudFetchAll();
      if (!active) return;
      if (!force && Date.now() - lastWriteRef.current < 4000) return;
      let ok = false;
      for (const key of Object.keys(TABLES)) {
        if (all[key]) {
          setters[key](all[key]);
          db.set(cacheKey[key], all[key]);
          ok = true;
        }
      }
      setConn(ok ? 'online' : 'offline');
    };
    window.__refetchCloud = () => refetchAll(true);
    const ch = supaClient.channel('rt-all');
    for (const [key, table] of Object.entries(TABLES)) {
      ch.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table
      }, payload => applyRealtime(key, payload));
    }
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') setConn('online');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConn('offline');
    });

    // 保險 1：回到前景／重新取得焦點時，重抓一次（手機切回 App、解鎖）
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetchAll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refetchAll);
    // 保險 2：每 15 秒輪詢一次，即時連線斷了也能補上
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') refetchAll();
    }, 15000);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refetchAll);
      clearInterval(poll);
      try {
        supaClient.removeChannel(ch);
      } catch (e) {}
    };
  }, []);
  const stampWrite = () => {
    lastWriteRef.current = Date.now();
  };
  const saveCloud = async (key, cacheName, prev, next, setter) => {
    stampWrite();
    setter(next);
    db.set(cacheName, next);
    const ok = await cloudPushDiff(key, prev, next);
    if (!ok) {
      setter(prev);
      db.set(cacheName, prev);
      setConn('offline');
      alert('沒有存到：目前連不上雲端，剛才的修改已還原。\n請確認網路後再操作一次。');
    }
    return ok;
  };
  const saveUsers = u => saveCloud('users', 'users', users, u, setUsers);
  const saveProjects = p => saveCloud('projects', 'projects', projects, p, setProjects);
  const saveEvents = e => saveCloud('events', 'events', events, e, setEvents);
  const saveMemos = m => saveCloud('memos', 'memos', memos, m, setMemos);
  const saveMemoItems = i => saveCloud('memoItems', 'memoItems', memoItems, i, setMemoItems);
  const handleAddUser = u => {
    saveUsers([...users, u]);
  };
  const handleDeleteUser = id => {
    const target = users.find(u => u.id === id);
    if (!target || target.role === '管理者' || id === currentUser.id) return;
    saveUsers(users.filter(u => u.id !== id));
  };
  const handleSelectUser = u => {
    setCurrentUser(u);
    db.set('currentUserId', u.id);
  };
  const handleAddProject = p => {
    saveProjects([...projects, p]);
  };
  const handleUpdateProject = async p => {
    const next = projects.map(x => x.id === p.id ? p : x);
    const ok = await saveProjects(next);
    if (ok && currentProject?.id === p.id) setCurrentProject(p);
    return ok;
  };
  const handleDeleteProject = id => {
    saveProjects(projects.filter(x => x.id !== id));
    saveEvents(events.filter(e => e.projectId !== id));
    saveMemos(memos.filter(m => m.projectId !== id));
    const removeMemoIds = memos.filter(m => m.projectId === id).map(m => m.id);
    if (removeMemoIds.length) saveMemoItems(memoItems.filter(i => !removeMemoIds.includes(i.memoId)));
  };
  const handleSaveEvent = ev => {
    const next = events.find(e => e.id === ev.id) ? events.map(e => e.id === ev.id ? ev : e) : [...events, ev];
    saveEvents(next);
    const p = projects.find(x => x.id === ev.projectId);
    if (p) handleUpdateProject({
      ...p,
      updatedAt: now(),
      updatedBy: currentUser.id
    });
  };
  const handleDeleteEvent = id => {
    saveEvents(events.filter(e => e.id !== id));
  };
  const handleSaveEvents = list => {
    if (!list.length) return Promise.resolve(true);
    const p = projects.find(x => x.id === list[0].projectId);
    return saveEvents([...events, ...list]).then(ok => {
      if (ok && p) handleUpdateProject({
        ...p,
        updatedAt: now(),
        updatedBy: currentUser.id
      });
      return ok;
    });
  };
  const handleSaveMemo = m => {
    const next = memos.find(x => x.id === m.id) ? memos.map(x => x.id === m.id ? m : x) : [...memos, m];
    saveMemos(next);
    const p = projects.find(x => x.id === m.projectId);
    if (p) handleUpdateProject({
      ...p,
      updatedAt: now(),
      updatedBy: currentUser.id
    });
  };
  const handleDeleteMemo = id => {
    saveMemos(memos.filter(m => m.id !== id));
    const orphanItems = memoItems.filter(i => i.memoId === id);
    if (orphanItems.length) saveMemoItems(memoItems.filter(i => i.memoId !== id));
  };
  const handleSaveMemoItems = (memoId, items) => {
    saveMemoItems([...memoItems.filter(i => i.memoId !== memoId), ...items]);
  };
  let screen;
  if (!currentUser) {
    screen = /*#__PURE__*/React.createElement(IdentityScreen, {
      users: users,
      onSelect: handleSelectUser,
      onAddUser: handleAddUser
    });
  } else if (currentProject) {
    const proj = projects.find(p => p.id === currentProject.id) || currentProject;
    screen = /*#__PURE__*/React.createElement(ProjectDetail, {
      project: proj,
      currentUser: currentUser,
      users: users,
      allEvents: events,
      allMemos: memos,
      allMemoItems: memoItems,
      onUpdateProject: handleUpdateProject,
      onDeleteProject: handleDeleteProject,
      onSaveEvent: handleSaveEvent,
      onSaveEvents: handleSaveEvents,
      onDeleteEvent: handleDeleteEvent,
      onSaveMemo: handleSaveMemo,
      onDeleteMemo: handleDeleteMemo,
      onSaveMemoItems: handleSaveMemoItems,
      onBack: () => setCurrentProject(null)
    });
  } else {
    screen = /*#__PURE__*/React.createElement(HomeScreen, {
      currentUser: currentUser,
      users: users,
      projects: projects,
      events: events,
      onOpenProject: setCurrentProject,
      onAddProject: handleAddProject,
      onSwitchUser: () => {
        setCurrentUser(null);
        db.set('currentUserId', null);
      },
      onDeleteUser: handleDeleteUser
    });
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, screen, /*#__PURE__*/React.createElement(ConnDot, {
    status: conn
  }));
}

// ── 清除舊版示範資料（只執行一次，保留使用者自建資料）────────────────────────
// 正式版首次開啟時清除裝置上的測試工作資料，保留使用者帳號。
(function cleanupProductionData() {
  if (localStorage.getItem('production_clean_v1')) return;
  try {
    db.set('projects', []);
    db.set('events', []);
    db.set('memos', []);
    db.set('memoItems', []);
  } catch (e) {}
  localStorage.setItem('production_clean_v1', '1');
})();
(function cleanupDemo() {
  if (localStorage.getItem('demo_cleared_v1')) return;
  const demoP = ['p1', 'p2', 'p3', 'p4'];
  const demoE = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'];
  const demoM = ['m1', 'm2', 'm3'];
  try {
    db.set('projects', db.get('projects', []).filter(x => !demoP.includes(x.id)));
    db.set('events', db.get('events', []).filter(x => !demoE.includes(x.id)));
    db.set('memos', db.get('memos', []).filter(x => !demoM.includes(x.id)));
  } catch (e) {}
  localStorage.removeItem('seeded_v2');
  localStorage.setItem('demo_cleared_v1', '1');
})();

// ── 家族風格遷移（一次性：為 Jan/Joyce 設定家族與配色）──────────────────────────
(function houseMigrate() {
  if (localStorage.getItem('house_v1')) return;
  try {
    const us = db.get('users', []).map(u => {
      if (u.id === 'user-jan') return {
        ...u,
        house: 'serpent',
        primaryColor: HOUSES.serpent.primary,
        secondaryColor: HOUSES.serpent.metal,
        themeName: '蛇之家'
      };
      if (u.id === 'user-joyce') return {
        ...u,
        house: 'eagle',
        primaryColor: HOUSES.eagle.primary,
        secondaryColor: HOUSES.eagle.metal,
        themeName: '鷹之家'
      };
      return u.house ? u : {
        ...u,
        house: 'serpent'
      };
    });
    if (us.length) db.set('users', us);
  } catch (e) {}
  localStorage.setItem('house_v1', '1');
})();
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));