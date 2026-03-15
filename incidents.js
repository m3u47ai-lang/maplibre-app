// ---- incidents.js ----
// F-09: 災害受信票アイコンの表示・ステータス管理・活動記録入力フォーム

// ---- モックデータ ----
const MOCK_INCIDENTS_INIT = [
  {
    id: 'INC-001', type: '火災', subtype: '建物火災',
    address: '横浜市中区山下町3-1', lng: 139.6392, lat: 35.4428,
    status: '対応中', reportedAt: '2026-03-15T09:12:00',
    records: [
      { time: '09:12', author: '指令センター', content: '119番通報受信。建物火災の模様。' },
      { time: '09:14', author: '中1-ポ1', content: '出場命令受信。現場へ向かう。' },
    ],
  },
  {
    id: 'INC-002', type: '救急', subtype: '急病',
    address: '横浜市中区本町2-15', lng: 139.6345, lat: 35.4462,
    status: '対応中', reportedAt: '2026-03-15T09:45:00',
    records: [
      { time: '09:45', author: '指令センター', content: '救急要請。意識不明の60代男性。' },
    ],
  },
  {
    id: 'INC-003', type: '救急', subtype: '交通事故',
    address: '横浜市中区海岸通1', lng: 139.6408, lat: 35.4405,
    status: '完了', reportedAt: '2026-03-15T08:30:00',
    records: [
      { time: '08:30', author: '指令センター', content: '交通事故。負傷者2名。' },
      { time: '08:52', author: '中1-救1', content: '病院搬送完了。' },
    ],
  },
  {
    id: 'INC-004', type: '風水害', subtype: '冠水',
    address: '横浜市中区新港2', lng: 139.6448, lat: 35.4475,
    status: '未対応', reportedAt: '2026-03-15T10:01:00',
    records: [],
  },
  {
    id: 'INC-005', type: '火災', subtype: '車両火災',
    address: '横浜市西区みなとみらい3', lng: 139.6298, lat: 35.4515,
    status: '対応中', reportedAt: '2026-03-15T09:58:00',
    records: [
      { time: '09:58', author: '指令センター', content: '車両火災。炎上中。' },
    ],
  },
];

// 受信票データ（localStorage で永続化）
const INCIDENTS_STORAGE_KEY = 'fdmap-incidents';

function loadIncidents() {
  try {
    const saved = localStorage.getItem(INCIDENTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : MOCK_INCIDENTS_INIT.map((i) => ({ ...i }));
  } catch {
    return MOCK_INCIDENTS_INIT.map((i) => ({ ...i }));
  }
}

function saveIncidents(incidents) {
  localStorage.setItem(INCIDENTS_STORAGE_KEY, JSON.stringify(incidents));
}

let incidents = loadIncidents();
let incidentMap = null;
let showCompleted = true;

// ---- GeoJSON 生成 ----
function incidentsToGeoJSON() {
  const filtered = showCompleted ? incidents : incidents.filter((i) => i.status !== '完了');
  return {
    type: 'FeatureCollection',
    features: filtered.map((inc) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [inc.lng, inc.lat] },
      properties: { ...inc, recordCount: inc.records.length },
    })),
  };
}

// ---- アイコン生成（円 + 文字）----
function createIncidentIcons(map) {
  const icons = [
    { key: 'inc-fire',      label: '火', color: '#c1121f', text: '#fff' },
    { key: 'inc-ambulance', label: '救', color: '#e07020', text: '#fff' },
    { key: 'inc-flood',     label: '水', color: '#0077cc', text: '#fff' },
    { key: 'inc-other',     label: '他', color: '#555',    text: '#fff' },
  ];
  icons.forEach(({ key, label, color, text }) => {
    map.addImage(key, makeIncidentIcon(color, text, label));
  });
}

function makeIncidentIcon(bgColor, textColor, label) {
  const size = 36;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 外側の点滅効果用の薄い円
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = bgColor + '40'; // 透明度25%
  ctx.fill();

  // 内側の塗り円
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 中の文字
  ctx.fillStyle = textColor;
  ctx.font = `bold ${size * 0.42}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2);

  return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

// ---- レイヤ追加 ----
function addIncidentLayers(map) {
  map.addSource('incidents', {
    type: 'geojson',
    data: incidentsToGeoJSON(),
  });

  // 未対応・対応中：点滅させるためにレイヤを2枚重ねる
  map.addLayer({
    id: 'incidents-symbol',
    type: 'symbol',
    source: 'incidents',
    layout: {
      'icon-image': [
        'match', ['get', 'type'],
        '火災', 'inc-fire',
        '救急', 'inc-ambulance',
        '風水害', 'inc-flood',
        'inc-other',
      ],
      'icon-size': [
        'match', ['get', 'status'],
        '未対応', 1.1,
        '対応中', 1.0,
        0.8,
      ],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'subtype'],
      'text-size': 10,
      'text-offset': [0, 1.8],
      'text-anchor': 'top',
    },
    paint: {
      'icon-opacity': [
        'match', ['get', 'status'],
        '完了', 0.45,
        1.0,
      ],
      'text-color': '#1a1a2e',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
      'text-opacity': [
        'match', ['get', 'status'],
        '完了', 0.5,
        1.0,
      ],
    },
  });

  // クリックでモーダル表示
  map.on('mouseenter', 'incidents-symbol', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'incidents-symbol', () => {
    map.getCanvas().style.cursor = '';
  });
  map.on('click', 'incidents-symbol', (e) => {
    if (!e.features || !e.features[0]) return;
    e.preventDefault();
    const incId = e.features[0].properties.id;
    openIncidentModal(incId);
  });
}

// ---- モーダル：活動記録表示 + 入力フォーム ----
function openIncidentModal(incId) {
  const inc = incidents.find((i) => i.id === incId);
  if (!inc) return;

  const modal = document.getElementById('incident-modal');
  const body = document.getElementById('incident-modal-body');

  const statusOptions = ['未対応', '対応中', '完了']
    .map((s) => `<option value="${s}"${inc.status === s ? ' selected' : ''}>${s}</option>`)
    .join('');

  const recordsHTML = inc.records.map((r) => `
    <div class="record-row">
      <span class="record-time">${r.time}</span>
      <span class="record-author">${r.author}</span>
      <span class="record-content">${r.content}</span>
    </div>`).join('') || '<div class="record-empty">記録なし</div>';

  const reportedTime = new Date(inc.reportedAt).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  body.innerHTML = `
    <div class="modal-section">
      <div class="modal-header-row">
        <span class="incident-badge incident-${inc.type}">${inc.type}</span>
        <strong>${inc.subtype}</strong>
        <span class="incident-id">${inc.id}</span>
      </div>
      <div class="modal-meta">
        <span>📍 ${inc.address}</span>
        <span>🕐 受信: ${reportedTime}</span>
      </div>
    </div>

    <div class="modal-section">
      <label class="modal-label">対応状況</label>
      <select id="modal-status" class="modal-select">
        ${statusOptions}
      </select>
    </div>

    <div class="modal-section">
      <label class="modal-label">活動記録</label>
      <div class="records-list">${recordsHTML}</div>
    </div>

    <div class="modal-section">
      <label class="modal-label">記録追加</label>
      <div class="record-form">
        <div class="record-form-row">
          <input id="rec-time"   type="time"  class="modal-input"
                 value="${new Date().toTimeString().slice(0, 5)}" />
          <input id="rec-author" type="text"  class="modal-input" placeholder="担当者" />
        </div>
        <textarea id="rec-content" class="modal-textarea"
                  placeholder="活動内容を入力..." rows="3"></textarea>
        <button id="rec-submit" class="modal-btn-primary">記録を追加</button>
      </div>
    </div>`;

  modal.dataset.incidentId = incId;
  modal.style.display = 'flex';

  // ステータス変更
  document.getElementById('modal-status').addEventListener('change', (e) => {
    inc.status = e.target.value;
    saveIncidents(incidents);
    updateIncidentLayer();
  });

  // 記録追加
  document.getElementById('rec-submit').addEventListener('click', () => {
    const time = document.getElementById('rec-time').value;
    const author = document.getElementById('rec-author').value.trim() || '不明';
    const content = document.getElementById('rec-content').value.trim();
    if (!content) return;
    inc.records.push({ time, author, content });
    saveIncidents(incidents);
    updateIncidentLayer();
    openIncidentModal(incId); // 再描画
  });
}

// ---- ソース更新 ----
function updateIncidentLayer() {
  if (!incidentMap || !incidentMap.getSource('incidents')) return;
  incidentMap.getSource('incidents').setData(incidentsToGeoJSON());
}

// ---- 完了事案トグル ----
function toggleCompleted() {
  showCompleted = !showCompleted;
  const btn = document.getElementById('toggle-completed-btn');
  if (btn) {
    btn.textContent = showCompleted ? '完了事案を非表示' : '完了事案を表示';
  }
  updateIncidentLayer();
}

// ---- スタイル変更後の再追加 ----
function readdIncidentLayers() {
  if (!incidentMap.getSource('incidents')) {
    createIncidentIcons(incidentMap);
    addIncidentLayers(incidentMap);
  }
}

// ---- 公開初期化関数 ----
function initIncidents(map) {
  incidentMap = map;

  createIncidentIcons(map);
  addIncidentLayers(map);

  // モーダルの閉じるボタン
  document.getElementById('incident-modal-close')?.addEventListener('click', () => {
    document.getElementById('incident-modal').style.display = 'none';
  });
  // モーダル外クリックで閉じる
  document.getElementById('incident-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.style.display = 'none';
    }
  });

  // 完了事案トグル
  document.getElementById('toggle-completed-btn')?.addEventListener('click', toggleCompleted);

  map.on('styledata', readdIncidentLayers);
}
