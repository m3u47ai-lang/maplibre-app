// ---- 初期設定 ----
const INITIAL_CENTER = [139.6380, 35.4437]; // 横浜
const INITIAL_ZOOM = 14;
const INITIAL_STYLE = 'https://tile.openstreetmap.jp/styles/osm-bright/style.json';

// ---- マップ初期化 ----
const map = new maplibregl.Map({
  container: 'map',
  style: INITIAL_STYLE,
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM,
});

// ---- 標準コントロール ----
map.addControl(new maplibregl.NavigationControl(), 'top-left');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
map.addControl(new maplibregl.FullscreenControl(), 'top-left');

// ---- 座標・ズーム表示 ----
function updateCoords() {
  const center = map.getCenter();
  const zoom = map.getZoom();
  document.getElementById('lng-lat').textContent =
    `Lng: ${center.lng.toFixed(4)}, Lat: ${center.lat.toFixed(4)}`;
  document.getElementById('zoom-level').textContent = zoom.toFixed(2);
}

map.on('move', updateCoords);

// ---- マップ読み込み完了時 ----
map.on('load', () => {
  updateCoords();
  initLayers(map);    // layers.js (F-01/02/03/05)
  initSearch(map);    // search.js (F-04)
  initMeasure(map);   // measure.js (F-06)
  initVehicles(map);   // vehicles.js (F-08)
  initIncidents(map);  // incidents.js (F-09)
  initObstacles(map);  // obstacles.js (F-10)
  initAnalysis(map);   // analysis.js (F-11/12)
  initFireStats(map);  // fire-stats.js (F-13)
  updateObstacleSummary();
});

// ---- スタイル切り替え ----
document.getElementById('style-select').addEventListener('change', (e) => {
  map.setStyle(e.target.value);
});

// ---- 現在地ボタン ----
document.getElementById('btn-geolocate').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('このブラウザは位置情報に対応していません');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      map.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 14,
        speed: 1.5,
      });
    },
    () => alert('位置情報の取得に失敗しました'),
  );
});

// ---- 都市ボタン ----
document.querySelectorAll('.city-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    map.flyTo({
      center: [parseFloat(btn.dataset.lng), parseFloat(btn.dataset.lat)],
      zoom: parseInt(btn.dataset.zoom),
      speed: 1.5,
    });
  });
});

// ---- 水利障害サマリを右パネルに表示 ----
function updateObstacleSummary() {
  const el = document.getElementById('obstacle-summary');
  if (!el) return;
  const active = typeof getActiveObstacles === 'function' ? getActiveObstacles() : [];
  if (active.length === 0) {
    el.textContent = '現在の障害水利: なし';
  } else {
    el.innerHTML = active.map((o) =>
      `<div>${o.hydrantId}: ${o.reason}<br><small>${o.endDate} まで</small></div>`
    ).join('');
  }
}

// ---- モバイル: パネルトグルボタン ----
document.getElementById('layer-toggle-btn').addEventListener('click', () => {
  document.getElementById('layer-panel').classList.toggle('open');
  document.getElementById('panel').classList.remove('open');
});
document.getElementById('panel-toggle-btn').addEventListener('click', () => {
  document.getElementById('panel').classList.toggle('open');
  document.getElementById('layer-panel').classList.remove('open');
});

// ---- 背景クリックでポップアップ（フィーチャーをクリックしていない場合のみ）----
map.on('click', (e) => {
  // フィーチャークリックは layers.js 側で preventDefault() しているが、
  // MapLibre では click イベントは必ず発火するので、featuresAt で判定する
  if (e.defaultPrevented) return;

  const features = map.queryRenderedFeatures(e.point);
  const interactiveLayers = [
    'hydrants-public', 'hydrants-private', 'water-tanks',
    'districts-fill', 'hazard-zones-fill',
    'vehicles-symbol', 'incidents-symbol', 'obstacles-symbol',
    'stations-circle', 'fire-point', 'fire-cluster',
  ];
  const hitFeature = features.find((f) => interactiveLayers.includes(f.layer.id));
  if (hitFeature) return; // フィーチャー上はスキップ

  new maplibregl.Popup({ closeOnClick: true })
    .setLngLat(e.lngLat)
    .setHTML(
      `<strong>クリック地点</strong><br/>
       Lng: ${e.lngLat.lng.toFixed(5)}<br/>
       Lat: ${e.lngLat.lat.toFixed(5)}`,
    )
    .addTo(map);
});
