// ---- obstacles.js ----
// F-10: 水利障害オーバーレイ（障害消火栓に×マーク・期間管理）

// ---- モックデータ ----
// hydrant_id は hydrants.geojson の "id" プロパティと対応
const MOCK_OBSTACLES = [
  {
    id: 'OBS-001',
    hydrantId: 'H-004',
    reason: '工事による断水',
    startDate: '2026-03-10',
    endDate: '2026-03-20',
    reportedBy: '中区土木事務所',
    note: '配管修繕工事。完了次第復旧予定。',
  },
  {
    id: 'OBS-002',
    hydrantId: 'H-009',
    reason: '弁不良',
    startDate: '2026-03-14',
    endDate: '2026-03-25',
    reportedBy: '西消防署',
    note: '弁の開閉不良。部品交換対応中。',
  },
  {
    id: 'OBS-003',
    hydrantId: 'P-002',
    reason: '施設改修',
    startDate: '2026-02-01',
    endDate: '2026-03-01', // 終了済み（表示されないはず）
    reportedBy: '施設管理者',
    note: '改修完了。',
  },
];

let obstacleMap = null;

// ---- 今日の日付で有効な障害を抽出 ----
function getActiveObstacles() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return MOCK_OBSTACLES.filter(
    (obs) => obs.startDate <= today && obs.endDate >= today,
  );
}

// ---- 障害対象の消火栓座標を hydrants GeoJSON から取得 ----
function getObstacleGeoJSON() {
  const active = getActiveObstacles();
  const hydrantData = geoJsonData['hydrants']; // layers.js が保持するキャッシュ
  if (!hydrantData) return { type: 'FeatureCollection', features: [] };

  const features = [];
  active.forEach((obs) => {
    const hydrant = hydrantData.features.find(
      (f) => f.properties.id === obs.hydrantId,
    );
    if (!hydrant) return;
    features.push({
      type: 'Feature',
      geometry: hydrant.geometry,
      properties: {
        obsId: obs.id,
        hydrantId: obs.hydrantId,
        reason: obs.reason,
        startDate: obs.startDate,
        endDate: obs.endDate,
        reportedBy: obs.reportedBy,
        note: obs.note,
      },
    });
  });
  return { type: 'FeatureCollection', features };
}

// ---- × アイコンを Canvas で生成 ----
function createObstacleIcon(map) {
  const size = 28;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 赤い円背景
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = '#ff0000cc';
  ctx.fill();
  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // × を描画
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const m = 7;
  ctx.beginPath();
  ctx.moveTo(m, m);
  ctx.lineTo(size - m, size - m);
  ctx.moveTo(size - m, m);
  ctx.lineTo(m, size - m);
  ctx.stroke();

  map.addImage('icon-obstacle', {
    width: size, height: size,
    data: ctx.getImageData(0, 0, size, size).data,
  });
}

// ---- レイヤ追加 ----
function addObstacleLayers(map) {
  map.addSource('obstacles', {
    type: 'geojson',
    data: getObstacleGeoJSON(),
  });

  // × アイコンのシンボルレイヤ（消火栓アイコンの上に重ねる）
  map.addLayer({
    id: 'obstacles-symbol',
    type: 'symbol',
    source: 'obstacles',
    layout: {
      'icon-image': 'icon-obstacle',
      'icon-size': 0.85,
      'icon-anchor': 'top-right',
      'icon-offset': [8, -8], // 消火栓アイコンの右上にずらす
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  // ポップアップ
  map.on('mouseenter', 'obstacles-symbol', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'obstacles-symbol', () => {
    map.getCanvas().style.cursor = '';
  });
  map.on('click', 'obstacles-symbol', (e) => {
    if (!e.features || !e.features[0]) return;
    e.preventDefault();
    const p = e.features[0].properties;
    new maplibregl.Popup({ maxWidth: '260px' })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-content">
          <div class="popup-title" style="color:#cc0000">⚠ 水利障害</div>
          <table class="popup-table">
            <tr><th>水利番号</th><td>${p.hydrantId}</td></tr>
            <tr><th>障害原因</th><td>${p.reason}</td></tr>
            <tr><th>障害期間</th><td>${p.startDate} 〜 ${p.endDate}</td></tr>
            <tr><th>届出者</th><td>${p.reportedBy}</td></tr>
            ${p.note ? `<tr><th>備考</th><td>${p.note}</td></tr>` : ''}
          </table>
        </div>`)
      .addTo(map);
  });
}

// ---- 障害件数バッジを更新 ----
function updateObstacleBadge() {
  const count = getActiveObstacles().length;
  const badge = document.getElementById('obstacle-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// ---- スタイル変更後の再追加 ----
function readdObstacleLayers() {
  if (!obstacleMap.getSource('obstacles')) {
    createObstacleIcon(obstacleMap);
    addObstacleLayers(obstacleMap);
  }
}

// ---- 公開初期化関数 ----
function initObstacles(map) {
  obstacleMap = map;

  // hydrants のデータが fetch されてから実行（少し遅延）
  setTimeout(() => {
    createObstacleIcon(map);
    addObstacleLayers(map);
    updateObstacleBadge();
  }, 500);

  map.on('styledata', readdObstacleLayers);
}
