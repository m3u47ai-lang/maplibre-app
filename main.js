// ---- 初期設定 ----
const INITIAL_CENTER = [139.6380, 35.4437]; // 横浜
const INITIAL_ZOOM = 14;
const INITIAL_STYLE = 'https://demotiles.maplibre.org/style.json';

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
  initLayers(map);  // layers.js
  initSearch(map);  // search.js
  initMeasure(map); // measure.js
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

// ---- 背景クリックでポップアップ（フィーチャーをクリックしていない場合のみ）----
map.on('click', (e) => {
  // フィーチャークリックは layers.js 側で preventDefault() しているが、
  // MapLibre では click イベントは必ず発火するので、featuresAt で判定する
  if (e.defaultPrevented) return;

  const features = map.queryRenderedFeatures(e.point);
  const interactiveLayers = [
    'hydrants-public', 'hydrants-private', 'water-tanks',
    'districts-fill', 'hazard-zones-fill',
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
