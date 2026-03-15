// ---- analysis.js ----
// F-11: 出張所ピックアップ（クリック地点から半径2km圏内）
// F-12: 水利密度ヒートマップ（消火栓・防火水槽）

// ---- F-12: ヒートマップ ----

let heatmapMode = false;
let analysisMap = null;

function addHeatmapLayer(map) {
  // 消火栓 + 防火水槽を統合したヒートマップ用ソース
  // hydrants と water-tanks は layers.js でロード済みなので参照する
  map.addLayer({
    id: 'heatmap-water',
    type: 'heatmap',
    source: 'hydrants', // まず消火栓で
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': 1,
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 2],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(0,100,200,0)',
        0.2, 'rgba(0,150,255,0.4)',
        0.5, 'rgba(0,200,200,0.7)',
        0.8, 'rgba(0,220,100,0.9)',
        1,   'rgba(50,255,50,1)',
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 12, 20, 16, 40],
      'heatmap-opacity': 0.75,
    },
  });

  // 防火水槽も追加（別レイヤで重ねる）
  map.addLayer({
    id: 'heatmap-tanks',
    type: 'heatmap',
    source: 'water-tanks',
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': [
        'interpolate', ['linear'], ['get', 'capacity'],
        0, 0.5, 100, 2,
      ],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 2],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(0,0,200,0)',
        0.2, 'rgba(0,100,255,0.4)',
        0.5, 'rgba(0,180,200,0.7)',
        0.8, 'rgba(0,220,150,0.9)',
        1,   'rgba(50,255,50,1)',
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 12, 30, 16, 60],
      'heatmap-opacity': 0.6,
    },
  });
}

function toggleHeatmap() {
  heatmapMode = !heatmapMode;
  const vis = heatmapMode ? 'visible' : 'none';
  const iconVis = heatmapMode ? 'none' : 'visible';
  const btn = document.getElementById('heatmap-btn');

  // ヒートマップ ON/OFF
  if (analysisMap.getLayer('heatmap-water')) {
    analysisMap.setLayoutProperty('heatmap-water', 'visibility', vis);
  }
  if (analysisMap.getLayer('heatmap-tanks')) {
    analysisMap.setLayoutProperty('heatmap-tanks', 'visibility', vis);
  }

  // ヒートマップ ON 時は水利アイコンを非表示
  ['hydrants-public', 'hydrants-private', 'water-tanks'].forEach((id) => {
    if (analysisMap.getLayer(id)) {
      analysisMap.setLayoutProperty(id, 'visibility', iconVis);
    }
  });

  if (btn) {
    btn.textContent = heatmapMode ? '🗺 アイコン表示' : '🔥 水利ヒートマップ';
    btn.classList.toggle('active', heatmapMode);
  }
}

// ---- F-11: 出張所ピックアップ ----

let pickupCircleActive = false;
let pickupMarker = null;

function addStationLayers(map) {
  map.addSource('stations', { type: 'geojson', data: 'data/stations.geojson' });

  map.addLayer({
    id: 'stations-circle',
    type: 'circle',
    source: 'stations',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 14],
      'circle-color': '#cc2222',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  map.addLayer({
    id: 'stations-label',
    type: 'symbol',
    source: 'stations',
    minzoom: 13,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#cc2222',
      'text-halo-color': '#fff',
      'text-halo-width': 2,
    },
  });

  // ハイライト用レイヤ（ピックアップ時に色が変わる）
  map.addLayer({
    id: 'stations-highlight',
    type: 'circle',
    source: 'stations',
    filter: ['in', 'id', ''],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 12, 16, 20],
      'circle-color': '#ff6600',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.85,
    },
  });

  // クリックポップアップ
  map.on('mouseenter', 'stations-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'stations-circle', () => { map.getCanvas().style.cursor = ''; });
  map.on('click', 'stations-circle', (e) => {
    if (!e.features || !e.features[0]) return;
    e.preventDefault();
    const p = e.features[0].properties;
    new maplibregl.Popup({ maxWidth: '220px' })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-content">
          <div class="popup-title">🏫 ${p.name}</div>
          <table class="popup-table">
            <tr><th>所在地</th><td>${p.address}</td></tr>
            <tr><th>車両数</th><td>${p.vehicles} 台</td></tr>
          </table>
        </div>`)
      .addTo(map);
  });
}

// ピックアップモード: クリックで半径2km圏内の出張所を検索
function addPickupSource(map) {
  map.addSource('pickup-circle', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addLayer({
    id: 'pickup-circle-fill',
    type: 'fill',
    source: 'pickup-circle',
    paint: { 'fill-color': '#ff6600', 'fill-opacity': 0.08 },
  });
  map.addLayer({
    id: 'pickup-circle-line',
    type: 'line',
    source: 'pickup-circle',
    paint: { 'line-color': '#ff6600', 'line-width': 2, 'line-dasharray': [4, 2] },
  });
}

function doStationPickup(map, lngLat) {
  const center = turf.point([lngLat.lng, lngLat.lat]);
  const circle = turf.circle(center, 2, { steps: 64, units: 'kilometers' });

  // 円を描画
  map.getSource('pickup-circle').setData({
    type: 'FeatureCollection', features: [circle],
  });

  // 出張所データを取得して圏内を絞り込む
  const stationData = geoJsonData['stations'];
  if (!stationData) return;

  const within = stationData.features.filter((f) =>
    turf.booleanPointInPolygon(f, circle)
  );

  // ハイライト
  const hitIds = within.map((f) => f.properties.id);
  map.setFilter('stations-highlight', ['in', 'id', ...hitIds]);

  // 結果パネル表示
  showPickupResult(lngLat, within);
}

function showPickupResult(lngLat, stations) {
  const panel = document.getElementById('pickup-result');
  if (!panel) return;

  if (stations.length === 0) {
    panel.innerHTML = `
      <div class="pickup-header">半径2km圏内の出張所</div>
      <div class="pickup-empty">該当する出張所なし</div>`;
  } else {
    const rows = stations.map((f) => {
      const p = f.properties;
      const dist = turf.distance(
        turf.point([lngLat.lng, lngLat.lat]),
        turf.point(f.geometry.coordinates),
        { units: 'meters' }
      );
      return `<div class="pickup-row">
        <span class="pickup-name">${p.name}</span>
        <span class="pickup-dist">${Math.round(dist)}m</span>
      </div>`;
    }).join('');
    panel.innerHTML = `
      <div class="pickup-header">半径2km圏内 (${stations.length}署所)</div>
      ${rows}`;
  }
  panel.style.display = 'block';
}

function clearPickup(map) {
  map.getSource('pickup-circle').setData({ type: 'FeatureCollection', features: [] });
  map.setFilter('stations-highlight', ['in', 'id', '']);
  const panel = document.getElementById('pickup-result');
  if (panel) panel.style.display = 'none';
}

function togglePickupMode() {
  pickupCircleActive = !pickupCircleActive;
  const btn = document.getElementById('pickup-btn');
  if (btn) {
    btn.textContent = pickupCircleActive ? '✋ 終了' : '📍 出張所ピックアップ';
    btn.classList.toggle('active', pickupCircleActive);
  }
  analysisMap.getCanvas().style.cursor = pickupCircleActive ? 'crosshair' : '';
  if (!pickupCircleActive) clearPickup(analysisMap);
}

// ---- スタイル変更後の再追加 ----
function readdAnalysisLayers() {
  if (!analysisMap.getSource('stations')) {
    addStationLayers(analysisMap);
    addPickupSource(analysisMap);
    addHeatmapLayer(analysisMap);
  }
}

// ---- 公開初期化関数 ----
function initAnalysis(map) {
  analysisMap = map;

  // 出張所レイヤ追加（GeoJSONキャッシュにも保存）
  fetch('data/stations.geojson')
    .then((r) => r.json())
    .then((data) => { geoJsonData['stations'] = data; });

  addStationLayers(map);
  addPickupSource(map);
  addHeatmapLayer(map);

  // ヒートマップボタン
  document.getElementById('heatmap-btn')?.addEventListener('click', toggleHeatmap);

  // ピックアップボタン
  document.getElementById('pickup-btn')?.addEventListener('click', togglePickupMode);

  // ピックアップ終了ボタン（結果パネル内）
  document.getElementById('pickup-clear-btn')?.addEventListener('click', () => {
    pickupCircleActive = false;
    const btn = document.getElementById('pickup-btn');
    if (btn) { btn.textContent = '📍 出張所ピックアップ'; btn.classList.remove('active'); }
    map.getCanvas().style.cursor = '';
    clearPickup(map);
  });

  // 地図クリック時にピックアップ実行
  map.on('click', (e) => {
    if (!pickupCircleActive) return;
    if (e.defaultPrevented) return;
    doStationPickup(map, e.lngLat);
  });

  map.on('styledata', readdAnalysisLayers);
}
