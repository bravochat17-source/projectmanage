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
    label: '蛇紋（綠銀）',
    primary: '#1c5038',
    primaryDeep: '#0c2418',
    metal: '#cdd4d6',
    metalDeep: '#7f8a8d',
    emblem: 'serpent',
    aura: 'rgba(46,138,92,0.34)'
  },
  eagle: {
    label: '鷹紋（藍銅）',
    primary: '#22376e',
    primaryDeep: '#0e1c3e',
    metal: '#c79a5b',
    metalDeep: '#8a6a34',
    emblem: 'eagle',
    aura: 'rgba(74,116,205,0.32)'
  },
  badger: {
    label: '獾紋（金黑）',
    primary: '#2b2417',
    primaryDeep: '#13100a',
    metal: '#cba24c',
    metalDeep: '#8a6e2a',
    emblem: 'badger',
    aura: 'rgba(203,162,76,0.3)'
  },
  lion: {
    label: '獅紋（紅金）',
    primary: '#5e1820',
    primaryDeep: '#2c0a0e',
    metal: '#d3aa50',
    metalDeep: '#8a6a2a',
    emblem: 'lion',
    aura: 'rgba(211,170,80,0.3)'
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
      background: u.primaryColor,
      display: 'inline-block',
      flexShrink: 0,
      boxShadow: `0 0 0 1.5px ${u.secondaryColor}`
    }
  }), u.name);
}

// ── HOUSE EMBLEM（使用者徽章圖 · 後備單線盾形）──────────────────────────────────
function emblemImgFor(house) {
  const found = Object.values(HOUSES).find(h => h.emblem === house);
  return (window.__IMG || {})[house];
}
function HouseEmblem({
  house,
  color = 'currentColor',
  size = 28,
  className = ''
}) {
  const imgSrc = emblemImgFor(house);
  if (imgSrc) {
    return /*#__PURE__*/React.createElement("img", {
      src: imgSrc,
      width: size,
      height: size,
      className: `emblem-img ${className}`,
      alt: "",
      draggable: "false"
    });
  }
  const shield = /*#__PURE__*/React.createElement("path", {
    d: "M12 11Q12 8 15 8L49 8Q52 8 52 11L52 35Q52 55 32 66Q12 55 12 35Z",
    fill: "none",
    stroke: color,
    strokeWidth: "2.1",
    strokeLinejoin: "round"
  });
  const innerRule = /*#__PURE__*/React.createElement("path", {
    d: "M16 13.5Q16 12 17.5 12L46.5 12Q48 12 48 13.5L48 34Q48 51 32 61Q16 51 16 34Z",
    fill: "none",
    stroke: color,
    strokeWidth: "0.9",
    strokeOpacity: "0.55",
    strokeLinejoin: "round"
  });
  if (house === 'eagle') {
    // 鷹（展翼·原創紋章）：頭冠、喙、層疊雙翼、尾羽、爪
    return /*#__PURE__*/React.createElement("svg", {
      className: className,
      width: size,
      height: Math.round(size * 1.12),
      viewBox: "0 0 64 72",
      fill: "none",
      "aria-hidden": "true",
      stroke: color,
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, shield, innerRule, /*#__PURE__*/React.createElement("path", {
      d: "M32 17.6c2 0 3.4 1.5 3.4 3.4 0 1.2-.6 2.2-1.5 2.8l3.6 1.4-3.9.7",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "32",
      cy: "20.6",
      r: "2.4",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M32 24c-1.3 0-2.4.9-2.4 2.2 0 .8.4 1.5 1 1.9l-1.2 13.5L32 48l2.6-6.4-1.2-13.5c.6-.4 1-1.1 1-1.9 0-1.3-1.1-2.2-2.4-2.2z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M30.4 27.6c-6.4-3.2-12.8-3.4-18.4.2 3.8-.2 5.8 1 7 3.4 1.2-2 3-2.8 5.2-2.2-1.6 1.6-2 3.4-1 5.6 2-3 4.6-4 7.8-3.2z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M33.6 27.6c6.4-3.2 12.8-3.4 18.4.2-3.8-.2-5.8 1-7 3.4-1.2-2-3-2.8-5.2-2.2 1.6 1.6 2 3.4 1 5.6-2-3-4.6-4-7.8-3.2z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M31 33.4c-4.8-1.6-9.6-1-13.6 2.4 3-.4 4.8.4 6 2 .8-1.4 2.2-2 4-1.6-1.2 1.2-1.4 2.6-.6 4.2-1.4-2.2-3.4-3-5.8-3z",
      fill: color,
      stroke: "none",
      opacity: "0.92"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M33 33.4c4.8-1.6 9.6-1 13.6 2.4-3-.4-4.8.4-6 2-.8-1.4-2.2-2-4-1.6 1.2 1.2 1.4 2.6.6 4.2 1.4-2.2 3.4-3 5.8-3z",
      fill: color,
      stroke: "none",
      opacity: "0.92"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M28.8 45l3.2 4.6 3.2-4.6-3.2 2z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M29.6 49l-1.3 2.4M34.4 49l1.3 2.4",
      strokeWidth: "1.3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19.5 53.4l11.5-2.2 1 1 1-1 11.5 2.2v4l-11.5-1.9-1 .9-1-.9-11.5 1.9z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M32 52.2v4.3",
      strokeWidth: "0.8",
      stroke: "#0c0c0c",
      strokeOpacity: "0.4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M23 53.6l6.4-1.1M41 53.6l-6.4-1.1",
      strokeWidth: "0.7",
      stroke: "#0c0c0c",
      strokeOpacity: "0.28"
    }));
  }
  if (house === 'badger') {
    // 獸（坑姿侧面·條紋吻）
    return /*#__PURE__*/React.createElement("svg", {
      className: className,
      width: size,
      height: Math.round(size * 1.12),
      viewBox: "0 0 64 72",
      fill: "none",
      "aria-hidden": "true",
      stroke: color,
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, shield, innerRule, /*#__PURE__*/React.createElement("path", {
      d: "M40 55c1.6-1.4 1-3.2-.2-4.6-1.8-2-2-5-1.4-8.4.8-4.6 1.4-8.6-1.2-11.4-2-2.2-5.4-2.8-8.4-1.4-3.8 1.8-5.8 6-6.2 11-.3 4 .2 8 1.6 10.4.8 1.4 1.4 3 .6 4.4z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M30 30c-3.4-.6-6.8.8-9.8 4l-3.4-1 2.2 3.4c-1 1.8-.4 3.6 1.4 4.6 2.8 1.6 6.6.6 8.8-2.2z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19 35.5l6 2.6",
      stroke: color,
      strokeWidth: "2.4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M20 35l5.4 2.4",
      stroke: "#0c0c0c",
      strokeWidth: "1.4",
      strokeOpacity: "0.4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "25",
      cy: "34.4",
      r: "0.95",
      fill: "#0c0c0c",
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M26 53.5l-1.4 2.6M30 53.5l-1.4 2.6M34 53.5l-1.4 2.6",
      strokeWidth: "1.2"
    }));
  }
  if (house === 'lion') {
    // 獅（后立 rampant·朝左）
    return /*#__PURE__*/React.createElement("svg", {
      className: className,
      width: size,
      height: Math.round(size * 1.12),
      viewBox: "0 0 64 72",
      fill: "none",
      "aria-hidden": "true",
      stroke: color,
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, shield, innerRule, /*#__PURE__*/React.createElement("circle", {
      cx: "26.5",
      cy: "27",
      r: "7",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19.6 24l-2.6-2M19 27.4l-3 .4M19.8 31l-2.6 2M26.5 19.8v-2.6M31.4 31l2.4 1.8",
      strokeWidth: "1.3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19.6 27.4l-3 .2 2.2 1.8z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "24.5",
      cy: "26",
      r: "0.9",
      fill: "#0c0c0c",
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M27.5 33.5c-3-1-6.4-2.6-8.8-5.6l1.8-1.8c2.2 2.6 4.8 3.8 7.6 3.8z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M27.4 33.5c-1.2 6.4 .8 13.4 6.4 20.2l4.6-2c-4.2-6-5.8-12-4.6-17.4z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M33.8 52c1.4 2.6 3.6 4.2 6.2 4.6l-.6-2.4c-1.8-.4-3.2-1.6-4-3z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M37.6 41c5.2-1.4 8.2 2.2 6.6 6.8l-2-.8c.5-2.2-.8-4-3.2-3.6z",
      fill: color,
      stroke: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M43.4 47.4l2.6 1.4-.6 3-2.6-2z",
      fill: color,
      stroke: "none"
    }));
  }
  // 蛇（盤繞·原創紋章）：頭、信子、眼、S 雙曲身、捲尾、腹鱗
  return /*#__PURE__*/React.createElement("svg", {
    className: className,
    width: size,
    height: Math.round(size * 1.12),
    viewBox: "0 0 64 72",
    fill: "none",
    "aria-hidden": "true",
    stroke: color,
    strokeWidth: "3.1",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, shield, innerRule, /*#__PURE__*/React.createElement("path", {
    d: "M40 22C31 20 25 25 30 30C34 34 41 33 41 38C41 43 33 43 30 39C33 45 42 46 42 51C42 56 34 57 29 53",
    strokeWidth: "3.2",
    fill: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M29 53c-3.4 1.4-7-.2-6.6-4",
    strokeWidth: "2.4",
    fill: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M34.5 29l-1.8 1.4M37 36l-2 .6M33 44l-1.8-1.2",
    strokeWidth: "1",
    strokeOpacity: "0.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M40 22c5.2-3.4 12-2.4 14.6 2.2-2.2 1-3.4 3-3.4 5.4-3-.4-5.4.6-8-.6-2.6-1.3-3.6-3.8-3.2-7z",
    fill: color,
    stroke: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M50.6 28.6l1.6 2.6M47.6 29.2l1.2 2.6",
    strokeWidth: "1.1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M54 24.5l4.4-1M54 24.5l4.4 1.6",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "46.8",
    cy: "24.6",
    r: "1.4",
    fill: "#0c0c0c",
    stroke: "none"
  }));
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
    color: h.metal,
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
  }, "\u2726 ", msg);
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
  }, "\u269C ", title), /*#__PURE__*/React.createElement("button", {
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
  onSelectDate
}) {
  const cells = getMonthDays(calendarMonth);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const todayKey = toDateKey(new Date());
  const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  return /*#__PURE__*/React.createElement("div", {
    className: "parch-calendar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "parch-cal-header"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    style: {
      color: 'var(--gold-dark)',
      borderColor: 'var(--gold-dark)'
    },
    onClick: prevMonth
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    className: "parch-cal-title"
  }, calendarMonth.getFullYear(), " \u5E74 ", String(calendarMonth.getMonth() + 1).padStart(2, '0'), " \u6708"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-sm",
    style: {
      color: 'var(--gold-dark)',
      borderColor: 'var(--gold-dark)'
    },
    onClick: nextMonth
  }, "\u2192")), /*#__PURE__*/React.createElement("div", {
    className: "parch-cal-grid"
  }, weekdays.map(w => /*#__PURE__*/React.createElement("div", {
    key: w,
    className: "parch-cal-weekday"
  }, w)), cells.map((day, idx) => {
    if (!day) return /*#__PURE__*/React.createElement("div", {
      key: `empty-${idx}`,
      className: "parch-cal-day empty"
    });
    const key = toDateKey(day);
    const dayData = calendarMap[key] || {
      events: [],
      memos: []
    };
    const evs = dayData.events || [];
    const memos = dayData.memos || [];
    const isToday = key === todayKey;
    const calLabels = [];
    evs.forEach(ev => {
      const evStart = ev.startDate || ev.date;
      const info = eventUrgencyInfo(evStart, ev.completedAt);
      const cat = ev.category === '其他' ? ev.customCategory || '其他' : ev.category;
      const label = `${cat}｜${ev.title}`;
      if (!calLabels.some(x => x.key === ev.id)) calLabels.push({
        key: ev.id,
        label,
        status: info.status
      });
    });
    const hasUrgent = calLabels.some(x => x.status === 'red' || x.status === 'darkred');
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      className: `parch-cal-day${isToday ? ' today' : ''}${hasUrgent ? ' has-urgent' : ''}`,
      onClick: () => onSelectDate(key)
    }, memos.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "cal-memo-dot"
    }, "\u2711"), /*#__PURE__*/React.createElement("div", {
      className: "parch-cal-date"
    }, day.getDate()), calLabels.slice(0, 2).map(item => /*#__PURE__*/React.createElement("span", {
      key: item.key,
      className: `cal-chip ev-${item.status}`
    }, item.label)), calLabels.length > 2 && /*#__PURE__*/React.createElement("div", {
      className: "cal-more"
    }, "+", calLabels.length - 2));
  })));
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
  }, "\u269C"), /*#__PURE__*/React.createElement("h1", {
    className: "crest-title"
  }, "\u5DE5\u7A0B\u6A94\u6848\u5EAB"), /*#__PURE__*/React.createElement("p", {
    className: "crest-subtitle"
  }, "\u8ACB\u9078\u64C7\u60A8\u7684\u8EAB\u5206\u4EE5\u7E7C\u7E8C"), users.map(u => {
    const h = getHouse(u);
    return /*#__PURE__*/React.createElement("div", {
      key: u.id,
      className: "user-card",
      onClick: () => pickUser(u),
      style: {
        background: `linear-gradient(155deg, color-mix(in srgb, ${h.primary} 30%, #15151b), #15151b)`
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "id-crest"
    }, /*#__PURE__*/React.createElement(HouseEmblem, {
      house: h.emblem,
      color: h.metal,
      size: 66
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
      fontSize: '1.5rem',
      color: 'var(--gold)'
    }
  }, "\uFF0B"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Cinzel','Noto Serif TC',serif",
      color: 'var(--gold-light)',
      fontSize: '0.95rem',
      marginLeft: '0.5rem'
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
    color: getHouse(pendingAdmin).metal,
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
  }, "\u8B58\u5225\u5716\u9A30"), /*#__PURE__*/React.createElement("select", {
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
  }, "\u5716\u9A30\u9810\u89BD\uFF1A"), /*#__PURE__*/React.createElement(HouseEmblem, {
    house: form.house,
    color: getHouse({
      house: form.house
    }).metal,
    size: 48
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
    const urgent = evs.filter(e => {
      if (e.completedAt) return false;
      const info = eventUrgencyInfo(e.startDate || e.date, e.completedAt);
      return info.status === 'red' || info.status === 'darkred';
    }).length;
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
        '--cover': h.primary,
        '--cover-deep': h.primaryDeep,
        '--spine': h.metal,
        borderWidth: "1px 1px 1px 20px",
        borderRadius: "9px 10px 9px 9px"
      }
    }, /*#__PURE__*/React.createElement(OwnerBookmark, {
      userId: p.mainOwnerId,
      users: users,
      size: 58
    }), /*#__PURE__*/React.createElement("span", {
      className: "book-house-tag"
    }, owner ? owner.name : ''), /*#__PURE__*/React.createElement("div", {
      className: "book-title"
    }, p.name), /*#__PURE__*/React.createElement("div", {
      className: "book-meta"
    }, urgent && /*#__PURE__*/React.createElement("span", {
      className: "badge-urgent"
    }, /*#__PURE__*/React.createElement("span", {
      className: "flame"
    }, "\uD83D\uDD25"), "\u7DCA\u6025 ", stats.urgent), /*#__PURE__*/React.createElement("span", {
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
    className: "header-title"
  }, "\u269C \u5DE5\u7A0B\u6A94\u6848\u5EAB"), /*#__PURE__*/React.createElement("div", {
    className: "header-subtitle"
  }, "\u5DE5\u7A0B\u6848\u4EF6\u7BA1\u7406\u7CFB\u7D71")), /*#__PURE__*/React.createElement("div", {
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
      color: h.metal,
      size: 30
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Cinzel','Noto Serif TC',serif",
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
    category: initial?.category || '木工',
    customCategory: initial?.customCategory || '',
    executorId: initial?.executorId || currentUser.id,
    startDate: initStartDate,
    endDate: initEndDate,
    content: initial?.content || ''
  });
  const f = (k, v) => setForm(prev => ({
    ...prev,
    [k]: v
  }));
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
      category: form.category,
      customCategory: form.customCategory,
      executorId: form.executorId,
      content: form.content,
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
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "\u4E8B\u4EF6\u5167\u5BB9"), /*#__PURE__*/React.createElement("textarea", {
    className: "field-textarea",
    value: form.content,
    onChange: e => f('content', e.target.value),
    placeholder: "\u73FE\u5834\u72C0\u6CC1\u3001\u65BD\u5DE5\u8981\u6C42\u3001\u5DE5\u73ED\u6CE8\u610F\u4E8B\u9805..."
  })));
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
  const isUrgent = !ev.completedAt && (info.status === 'red' || info.status === 'darkred');
  return /*#__PURE__*/React.createElement("div", {
    className: `event-page event-page-${info.status}${ev.completedAt ? ' is-done' : ''}${isUrgent ? ' is-urgent' : ''}`,
    style: {
      borderWidth: "1px 1px 1px 30px",
      borderStyle: "solid"
    }
  }, isUrgent && /*#__PURE__*/React.createElement("img", {
    className: "event-urgent-stamp",
    src: (window.__IMG || {}).seal,
    alt: "\u7DCA\u6025",
    draggable: "false"
  }), /*#__PURE__*/React.createElement("div", {
    className: "event-page-tab"
  }, /*#__PURE__*/React.createElement("span", {
    className: "event-page-days"
  }, info.daysText)), /*#__PURE__*/React.createElement("div", {
    className: "event-page-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "event-page-title",
    style: {
      textDecoration: ev.completedAt ? 'line-through' : 'none'
    }
  }, ev.title), /*#__PURE__*/React.createElement("div", {
    className: "event-page-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag-type"
  }, ev.category === '其他' ? ev.customCategory || '其他' : ev.category), ev.executorId && /*#__PURE__*/React.createElement(UserBadge, {
    userId: ev.executorId,
    users: users
  })), /*#__PURE__*/React.createElement("div", {
    className: "event-page-period"
  }, "\uD83D\uDCC5 ", periodText), ev.content && /*#__PURE__*/React.createElement("div", {
    className: "event-page-content"
  }, ev.content), /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement("img", {
    src: (window.__IMG || {}).owl,
    className: "memo-owl",
    alt: "",
    draggable: "false"
  }), /*#__PURE__*/React.createElement("div", {
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
  }, "\uD83D\uDCC5 ", fmt(memo.date))), memo.content && /*#__PURE__*/React.createElement("div", {
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
  }, "\uD83D\uDC41"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline btn-icon btn-sm",
    style: {
      color: 'var(--gold-dark)',
      borderColor: 'var(--gold-dark)'
    },
    onClick: () => onEdit(memo)
  }, "\u270E"), canManage && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-danger btn-icon btn-sm",
    onClick: () => onDelete(memo.id)
  }, "\uD83D\uDDD1"))));
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
      fontFamily: "'Cinzel','Noto Serif TC',serif",
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
  }, "\uD83D\uDCC5 ", fmt(memo.date))), memo.content && /*#__PURE__*/React.createElement("div", {
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
  const dateRefs = useRef({});
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
    const el = dateRefs.current[dateKey];
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
    showToast(ev.completedAt ? '已取消完成' : '已標記完成 ✦');
  };
  const handleDeleteEvent = id => {
    onDeleteEvent(id);
    showToast('事件已刪除');
  };
  const handleDeleteMemo = id => {
    onDeleteMemo(id);
    showToast('注意事項已刪除');
  };
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const ownName = users.find(u => u.id === project.mainOwnerId)?.name || '';
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['案件名稱', '主要負責人', '狀態', '建立時間', '結案時間'], [project.name, ownName, PROJECT_STATUSES[project.status] || project.status, fmtFull(project.createdAt), fmtFull(project.closedAt)]]), '案件總覽');
    const evRows = [['開始日期', '結束日期', '事件標題', '工程類型', '執行者', '狀態', '事件內容', '建立者', '修改者', '完成者', '建立時間', '修改時間', '完成時間']];
    events.forEach(e => evRows.push([fmt(e.startDate || e.date), fmt(e.endDate || e.startDate || e.date), e.title, e.category === '其他' ? e.customCategory : e.category, users.find(u => u.id === e.executorId)?.name || '', e.completedAt ? '已完成' : '未完成', e.content, users.find(u => u.id === e.createdBy)?.name || '', users.find(u => u.id === e.updatedBy)?.name || '', users.find(u => u.id === e.completedBy)?.name || '', fmtFull(e.createdAt), fmtFull(e.updatedAt), fmtFull(e.completedAt)]));
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
    showToast('案件已封存並匯出 Excel ✦');
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
      background: `linear-gradient(160deg, ${h.primary}, ${h.primaryDeep})`
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "spine-hub top"
  }), /*#__PURE__*/React.createElement("span", {
    className: "spine-hub bot"
  }), /*#__PURE__*/React.createElement("div", {
    className: "spine-emblem"
  }, /*#__PURE__*/React.createElement(HouseEmblem, {
    house: h.emblem,
    color: h.metal,
    size: 60
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
    style: {
      color: '#efe6d2'
    }
  }, PROJECT_STATUSES.closed))))), /*#__PURE__*/React.createElement("div", {
    className: "page page-enter",
    style: {
      paddingBottom: '5rem',
      paddingTop: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-heading"
  }, "\u65E5\u671F\u8868"), /*#__PURE__*/React.createElement(MagicCalendar, {
    calendarMonth: calendarMonth,
    setCalendarMonth: setCalendarMonth,
    calendarMap: calendarMap,
    onSelectDate: handleSelectCalendarDate
  }), selectedDate && calendarMap[selectedDate] && /*#__PURE__*/React.createElement("div", {
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
  }, "\uD83D\uDCC5 ", date.replace(/-/g, '/')), (timelineMap[date].events || []).map(ev => /*#__PURE__*/React.createElement(EventCard, {
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
      fontFamily: "'Cinzel','Noto Serif TC',serif",
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
  })), showEventDetail.content && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(255,248,224,0.5)',
      border: '1px solid var(--border-gold)',
      borderRadius: 4,
      padding: '0.75rem',
      lineHeight: 1.6,
      fontSize: '1rem',
      marginBottom: '1rem',
      color: 'var(--ink)'
    }
  }, showEventDetail.content), /*#__PURE__*/React.createElement("div", {
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
  }, "\uD83D\uDCE6 \u5C01\u5B58\u4E26\u532F\u51FA"), /*#__PURE__*/React.createElement("button", {
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