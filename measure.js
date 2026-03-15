// ---- measure.js ----
// F-06: 距離・面積計測
// turf.js を使用。PC はダブルクリックで終了、モバイルは計測ボタン再押しで終了。

let measuring = false;
let measurePoints = []; // [[lng, lat], ...]
let measureMap = null;

const MEASURE_SOURCE_LINE = 'measure-line-source';
const MEASURE_SOURCE_POINTS = 'measure-points-source';
const MEASURE_LAYER_LINE = 'measure-line-layer';
const MEASURE_LAYER_POINTS = 'measure-points-layer';

// --- 距離・面積の計算と結果表示 ---
function updateMeasureResult() {
  const resultEl = document.getElementById('measure-result');
  if (measurePoints.length < 2) {
    resultEl.style.display = 'none';
    return;
  }

  const lineCoords = measurePoints;
  let totalDistance = 0;
  for (let i = 1; i < lineCoords.length; i++) {
    const from = turf.point(lineCoords[i - 1]);
    const to = turf.point(lineCoords[i]);
    totalDistance += turf.distance(from, to, { units: 'meters' });
  }

  let distText;
  if (totalDistance < 1000) {
    distText = `${totalDistance.toFixed(1)} m`;
  } else {
    distText = `${(totalDistance / 1000).toFixed(3)} km`;
  }

  let areaText = '';
  if (measurePoints.length >= 3) {
    const closed = [...measurePoints, measurePoints[0]];
    const poly = turf.polygon([closed]);
    const areaSqm = turf.area(poly);
    if (areaSqm < 10000) {
      areaText = ` ／ 面積: ${areaSqm.toFixed(1)} m²`;
    } else {
      areaText = ` ／ 面積: ${(areaSqm / 10000).toFixed(4)} ha`;
    }
  }

  resultEl.innerHTML = `📏 距離: <strong>${distText}</strong>${areaText}`;
  resultEl.style.display = 'block';
}

// --- GeoJSON ソースを更新 ---
function updateMeasureLayers() {
  if (!measureMap) return;

  // ライン
  const lineFeature = measurePoints.length >= 2
    ? { type: 'Feature', geometry: { type: 'LineString', coordinates: measurePoints } }
    : { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } };

  // ポイント
  const pointFeatures = measurePoints.map((c, i) => ({
    type: 'Feature',
    properties: { index: i },
    geometry: { type: 'Point', coordinates: c },
  }));

  measureMap.getSource(MEASURE_SOURCE_LINE).setData({
    type: 'FeatureCollection', features: [lineFeature],
  });
  measureMap.getSource(MEASURE_SOURCE_POINTS).setData({
    type: 'FeatureCollection', features: pointFeatures,
  });
}

// --- 計測クリアとリセット ---
function clearMeasure() {
  measurePoints = [];
  updateMeasureLayers();
  document.getElementById('measure-result').style.display = 'none';
}

// --- 計測モード トグル ---
function toggleMeasure() {
  measuring = !measuring;
  const btn = document.getElementById('measure-btn');

  if (measuring) {
    btn.textContent = '✋ 計測終了';
    btn.classList.add('active');
    measureMap.getCanvas().style.cursor = 'crosshair';
  } else {
    btn.textContent = '📏 計測';
    btn.classList.remove('active');
    measureMap.getCanvas().style.cursor = '';
    clearMeasure();
  }
}

// --- クリックハンドラ（計測モード時のみ点を追加）---
function onMapClickMeasure(e) {
  if (!measuring) return;
  measurePoints.push([e.lngLat.lng, e.lngLat.lat]);
  updateMeasureLayers();
  updateMeasureResult();
}

// --- ダブルクリックで計測終了（PC向け）---
function onMapDblClickMeasure(e) {
  if (!measuring) return;
  // ダブルクリック時はブラウザが click を2回発火した後に dblclick が来るため、
  // 最後に追加された重複点を1つ取り除く
  if (measurePoints.length >= 2) {
    measurePoints.pop();
    updateMeasureLayers();
    updateMeasureResult();
  }
  // 計測モードを終了（ボタン再押しと同様の処理）
  measuring = false;
  const btn = document.getElementById('measure-btn');
  btn.textContent = '📏 計測';
  btn.classList.remove('active');
  measureMap.getCanvas().style.cursor = '';
  // 結果は残す（clearMeasure は呼ばない）
}

// --- 初期化：計測用ソース・レイヤを追加 ---
function initMeasure(map) {
  measureMap = map;

  // ソース追加
  map.addSource(MEASURE_SOURCE_LINE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addSource(MEASURE_SOURCE_POINTS, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // ライン レイヤ
  map.addLayer({
    id: MEASURE_LAYER_LINE,
    type: 'line',
    source: MEASURE_SOURCE_LINE,
    paint: {
      'line-color': '#e63946',
      'line-width': 2,
      'line-dasharray': [4, 2],
    },
  });

  // ポイント レイヤ
  map.addLayer({
    id: MEASURE_LAYER_POINTS,
    type: 'circle',
    source: MEASURE_SOURCE_POINTS,
    paint: {
      'circle-radius': 5,
      'circle-color': '#e63946',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  // イベント登録
  map.on('click', onMapClickMeasure);
  map.on('dblclick', onMapDblClickMeasure);

  // 計測ボタン
  document.getElementById('measure-btn').addEventListener('click', toggleMeasure);

  // スタイル変更後にソース・レイヤを再追加
  map.on('styledata', () => {
    if (!map.getSource(MEASURE_SOURCE_LINE)) {
      map.addSource(MEASURE_SOURCE_LINE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource(MEASURE_SOURCE_POINTS, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: MEASURE_LAYER_LINE,
        type: 'line',
        source: MEASURE_SOURCE_LINE,
        paint: { 'line-color': '#e63946', 'line-width': 2, 'line-dasharray': [4, 2] },
      });
      map.addLayer({
        id: MEASURE_LAYER_POINTS,
        type: 'circle',
        source: MEASURE_SOURCE_POINTS,
        paint: {
          'circle-radius': 5,
          'circle-color': '#e63946',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      // 計測中だったら再描画
      if (measurePoints.length > 0) updateMeasureLayers();
    }
  });
}
