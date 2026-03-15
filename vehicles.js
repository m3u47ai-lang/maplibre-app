// ---- vehicles.js ----
// F-08: 車両動態位置のリアルタイム表示（インメモリモック・10秒ポーリング）

// ---- モックデータ ----
const MOCK_VEHICLES = [
  { id: 'V-01', name: '中1-ポ1', type: '消防車', status: '待機中',
    lng: 139.6380, lat: 35.4500, heading: 45,  speed: 0 },
  { id: 'V-02', name: '中1-救1', type: '救急車', status: '出場中',
    lng: 139.6420, lat: 35.4460, heading: 270, speed: 40 },
  { id: 'V-03', name: '中1-はし1', type: 'はしご車', status: '待機中',
    lng: 139.6355, lat: 35.4490, heading: 180, speed: 0 },
  { id: 'V-04', name: '西1-ポ1', type: '消防車', status: '出場中',
    lng: 139.6310, lat: 35.4560, heading: 90,  speed: 35 },
  { id: 'V-05', name: '西1-救1', type: '救急車', status: '帰署中',
    lng: 139.6290, lat: 35.4520, heading: 135, speed: 30 },
  { id: 'V-06', name: '中2-ポ1', type: '消防車', status: '待機中',
    lng: 139.6450, lat: 35.4410, heading: 0,   speed: 0 },
];

// 車両状態を保持（ポーリングで更新）
let vehicleState = MOCK_VEHICLES.map((v) => ({ ...v }));
let pollingTimer = null;
let vehicleMap = null;
let lastUpdated = null;

// ---- モックの位置変化シミュレーション ----
function simulateMovement() {
  vehicleState = vehicleState.map((v) => {
    if (v.status === '待機中') return v;
    // 出場中・帰署中の車両は少しずつ移動
    const rad = (v.heading * Math.PI) / 180;
    const delta = 0.0003 + Math.random() * 0.0002;
    const heading = v.heading + (Math.random() - 0.5) * 20;
    return {
      ...v,
      lng: v.lng + Math.sin(rad) * delta,
      lat: v.lat + Math.cos(rad) * delta,
      heading: ((heading % 360) + 360) % 360,
    };
  });
  lastUpdated = new Date();
}

// ---- GeoJSON 生成 ----
function vehiclesToGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: vehicleState.map((v) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: { ...v },
    })),
  };
}

// ---- 地図上のソースを更新 ----
function updateVehicleLayer() {
  if (!vehicleMap || !vehicleMap.getSource('vehicles')) return;
  vehicleMap.getSource('vehicles').setData(vehiclesToGeoJSON());
  updateVehicleTimestamp();
}

// ---- 最終受信時刻の表示 ----
function updateVehicleTimestamp() {
  const el = document.getElementById('vehicle-updated');
  if (el && lastUpdated) {
    el.textContent = `最終更新: ${lastUpdated.toLocaleTimeString('ja-JP')}`;
  }
}

// ---- 車両アイコン（矢印）を Canvas で生成 ----
function createVehicleIcons(map) {
  // 消防車アイコン（赤矢印）
  map.addImage('icon-fire', makeArrowIcon('#cc2222', '#ffffff'));
  // 救急車アイコン（オレンジ矢印）
  map.addImage('icon-ambulance', makeArrowIcon('#e07020', '#ffffff'));
  // はしご車アイコン（暗赤矢印）
  map.addImage('icon-ladder', makeArrowIcon('#881111', '#ffffff'));
  // デフォルト
  map.addImage('icon-vehicle', makeArrowIcon('#555555', '#ffffff'));
}

function makeArrowIcon(fillColor, strokeColor) {
  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // 丸背景
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 上向き矢印（地図の north=上）
  ctx.fillStyle = strokeColor;
  ctx.beginPath();
  ctx.moveTo(size / 2, 6);         // 先端
  ctx.lineTo(size / 2 + 7, 22);
  ctx.lineTo(size / 2 + 3, 22);
  ctx.lineTo(size / 2 + 3, 34);
  ctx.lineTo(size / 2 - 3, 34);
  ctx.lineTo(size / 2 - 3, 22);
  ctx.lineTo(size / 2 - 7, 22);
  ctx.closePath();
  ctx.fill();

  return { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data };
}

// ---- 車両レイヤの追加 ----
function addVehicleLayers(map) {
  map.addSource('vehicles', {
    type: 'geojson',
    data: vehiclesToGeoJSON(),
  });

  map.addLayer({
    id: 'vehicles-symbol',
    type: 'symbol',
    source: 'vehicles',
    layout: {
      'icon-image': [
        'match', ['get', 'type'],
        '消防車', 'icon-fire',
        '救急車', 'icon-ambulance',
        'はしご車', 'icon-ladder',
        'icon-vehicle',
      ],
      'icon-size': 0.7,
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-offset': [0, 1.6],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#1a1a2e',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
    },
  });

  // カーソル変更 + ポップアップ
  map.on('mouseenter', 'vehicles-symbol', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'vehicles-symbol', () => {
    map.getCanvas().style.cursor = '';
  });
  map.on('click', 'vehicles-symbol', (e) => {
    if (!e.features || !e.features[0]) return;
    e.preventDefault();
    const p = e.features[0].properties;
    const statusClass = p.status === '待機中' ? 'status-ok'
      : p.status === '出場中' ? 'status-warn' : '';
    new maplibregl.Popup({ maxWidth: '220px' })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-content">
          <div class="popup-title">🚒 ${p.name}</div>
          <table class="popup-table">
            <tr><th>種別</th><td>${p.type}</td></tr>
            <tr><th>状況</th><td class="${statusClass}">${p.status}</td></tr>
            <tr><th>速度</th><td>${p.speed} km/h</td></tr>
            <tr><th>方位</th><td>${Math.round(p.heading)}°</td></tr>
          </table>
          ${lastUpdated ? `<div style="font-size:0.72rem;color:#999;margin-top:6px">
            更新: ${lastUpdated.toLocaleTimeString('ja-JP')}</div>` : ''}
        </div>`)
      .addTo(map);
  });
}

// ---- ポーリング開始 ----
function startPolling(intervalMs) {
  simulateMovement(); // 即時1回実行
  updateVehicleLayer();
  pollingTimer = setInterval(() => {
    simulateMovement();
    updateVehicleLayer();
  }, intervalMs);
}

// ---- ポーリング停止 ----
function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

// ---- スタイル変更後の再追加 ----
function readdVehicleLayers() {
  if (!vehicleMap.getSource('vehicles')) {
    createVehicleIcons(vehicleMap);
    addVehicleLayers(vehicleMap);
  }
}

// ---- 公開初期化関数 ----
function initVehicles(map) {
  vehicleMap = map;
  lastUpdated = new Date();

  createVehicleIcons(map);
  addVehicleLayers(map);
  startPolling(10000); // 10秒間隔

  // ポーリング ON/OFF ボタン
  const btn = document.getElementById('vehicle-polling-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      if (pollingTimer) {
        stopPolling();
        btn.textContent = '▶ 更新再開';
        btn.classList.remove('active');
      } else {
        startPolling(10000);
        btn.textContent = '⏸ 更新停止';
        btn.classList.add('active');
      }
    });
  }

  map.on('styledata', readdVehicleLayers);
}
