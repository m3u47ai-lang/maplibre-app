// ---- fire-stats.js ----
// F-13: 火災調査データの簡易分析
//   - クラスタリング表示（MapLibre GL JS built-in cluster）
//   - 期間フィルター（月・年単位）
//   - Chart.js によるサイドパネルグラフ

let statsMap = null;
let allFireRecords = [];
let fireChart = null;
let filterYear = 'all';
let filterMonth = 'all';

// ---- GeoJSON 読み込み ----
function loadFireRecords(map) {
  fetch('data/fire-records.geojson')
    .then((r) => r.json())
    .then((data) => {
      allFireRecords = data.features;
      geoJsonData['fire-records'] = data;
      map.getSource('fire-records').setData(filteredFireGeoJSON());
      updateChart();
      updateFireSummary();
    });
}

// ---- フィルタ適用後の GeoJSON ----
function filteredFireGeoJSON() {
  const filtered = allFireRecords.filter((f) => {
    const d = f.properties.date || '';
    const [y, m] = d.split('-');
    if (filterYear !== 'all' && y !== filterYear) return false;
    if (filterMonth !== 'all' && m !== filterMonth) return false;
    return true;
  });
  return { type: 'FeatureCollection', features: filtered };
}

// ---- クラスタ・個別点レイヤ追加 ----
function addFireLayers(map) {
  map.addSource('fire-records', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  // クラスタ円（件数が多いほど大きく）
  map.addLayer({
    id: 'fire-cluster',
    type: 'circle',
    source: 'fire-records',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#ffb703', 5,
        '#fb8500', 10,
        '#e63946',
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        18, 5, 24, 10, 32,
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.85,
    },
  });

  // クラスタ件数ラベル
  map.addLayer({
    id: 'fire-cluster-count',
    type: 'symbol',
    source: 'fire-records',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 13,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(0,0,0,0.3)',
      'text-halo-width': 1,
    },
  });

  // 個別点（クラスタに含まれないもの）
  map.addLayer({
    id: 'fire-point',
    type: 'circle',
    source: 'fire-records',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': 7,
      'circle-color': [
        'match', ['get', 'type'],
        '建物火災', '#e63946',
        '車両火災', '#fb8500',
        '林野火災', '#4caf50',
        '#888',
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  // クラスタクリック → ズームイン
  map.on('click', 'fire-cluster', (e) => {
    e.preventDefault();
    const features = map.queryRenderedFeatures(e.point, { layers: ['fire-cluster'] });
    if (!features.length) return;
    const clusterId = features[0].properties.cluster_id;
    map.getSource('fire-records').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });
  });

  // 個別点クリック → ポップアップ
  map.on('mouseenter', 'fire-cluster', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'fire-cluster', () => { map.getCanvas().style.cursor = ''; });
  map.on('mouseenter', 'fire-point', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'fire-point', () => { map.getCanvas().style.cursor = ''; });
  map.on('click', 'fire-point', (e) => {
    if (!e.features || !e.features[0]) return;
    e.preventDefault();
    const p = e.features[0].properties;
    const damageClass = p.damage === '大' ? 'status-warn' : '';
    new maplibregl.Popup({ maxWidth: '240px' })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-content">
          <div class="popup-title">🔥 ${p.type}</div>
          <table class="popup-table">
            <tr><th>事案番号</th><td>${p.id}</td></tr>
            <tr><th>発生日</th><td>${p.date}</td></tr>
            <tr><th>原因</th><td>${p.cause}</td></tr>
            <tr><th>損害程度</th><td class="${damageClass}">${p.damage}</td></tr>
            <tr><th>場所</th><td>${p.address}</td></tr>
          </table>
        </div>`)
      .addTo(map);
  });
}

// ---- Chart.js グラフ描画 ----
function updateChart() {
  const canvas = document.getElementById('fire-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const filtered = filteredFireGeoJSON().features;

  // 月別集計（フィルタが「全期間」のとき）または 原因別集計
  let labels, values, chartTitle;

  if (filterYear === 'all') {
    // 年別集計
    const byYear = {};
    filtered.forEach((f) => {
      const y = (f.properties.date || '').slice(0, 4);
      byYear[y] = (byYear[y] || 0) + 1;
    });
    labels = Object.keys(byYear).sort();
    values = labels.map((y) => byYear[y]);
    chartTitle = '年別 火災件数';
  } else {
    // 月別集計
    const byMonth = {};
    for (let m = 1; m <= 12; m++) {
      byMonth[String(m).padStart(2, '0')] = 0;
    }
    filtered.forEach((f) => {
      const m = (f.properties.date || '').slice(5, 7);
      if (m) byMonth[m] = (byMonth[m] || 0) + 1;
    });
    labels = Object.keys(byMonth).map((m) => `${parseInt(m)}月`);
    values = Object.values(byMonth);
    chartTitle = `${filterYear}年 月別 火災件数`;
  }

  // 原因別ドーナツチャート
  const byCause = {};
  filtered.forEach((f) => {
    const c = f.properties.cause || '不明';
    byCause[c] = (byCause[c] || 0) + 1;
  });

  const causeCanvas = document.getElementById('fire-cause-chart');

  if (fireChart) {
    fireChart.data.labels = labels;
    fireChart.data.datasets[0].data = values;
    fireChart.options.plugins.title.text = chartTitle;
    fireChart.update();
  } else {
    fireChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '件数',
          data: values,
          backgroundColor: 'rgba(230, 57, 70, 0.7)',
          borderColor: '#e63946',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: chartTitle, font: { size: 12 } },
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    });
  }

  // 原因別ドーナツ
  if (causeCanvas) {
    const existingChart = Chart.getChart(causeCanvas);
    if (existingChart) existingChart.destroy();
    new Chart(causeCanvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(byCause),
        datasets: [{
          data: Object.values(byCause),
          backgroundColor: ['#e63946','#fb8500','#ffb703','#4caf50','#0077cc','#9c27b0'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: '原因別内訳', font: { size: 12 } },
          legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } },
        },
      },
    });
  }
}

// ---- サマリ更新 ----
function updateFireSummary() {
  const el = document.getElementById('fire-summary-count');
  if (!el) return;
  const count = filteredFireGeoJSON().features.length;
  el.textContent = `${count} 件`;
}

// ---- フィルタ適用 ----
function applyFireFilter() {
  if (!statsMap || !statsMap.getSource('fire-records')) return;
  statsMap.getSource('fire-records').setData(filteredFireGeoJSON());
  updateChart();
  updateFireSummary();
}

// ---- フィルタ UI の年選択肢を動的生成 ----
function buildFilterUI() {
  const yearSel = document.getElementById('fire-filter-year');
  if (!yearSel) return;

  const years = [...new Set(
    allFireRecords.map((f) => (f.properties.date || '').slice(0, 4)).filter(Boolean)
  )].sort();

  years.forEach((y) => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y}年`;
    yearSel.appendChild(opt);
  });
}

// ---- パネル開閉 ----
function toggleStatsPanel() {
  const panel = document.getElementById('stats-panel');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  const btn = document.getElementById('stats-btn');
  if (btn) btn.textContent = isOpen ? '📊 グラフを閉じる' : '📊 火災分析';
}

// ---- スタイル変更後の再追加 ----
function readdFireLayers() {
  if (!statsMap.getSource('fire-records')) {
    addFireLayers(statsMap);
    statsMap.getSource('fire-records').setData(filteredFireGeoJSON());
  }
}

// ---- 公開初期化関数 ----
function initFireStats(map) {
  statsMap = map;

  addFireLayers(map);
  loadFireRecords(map);

  // フィルタ UI
  document.getElementById('fire-filter-year')?.addEventListener('change', (e) => {
    filterYear = e.target.value;
    filterMonth = 'all';
    const monthSel = document.getElementById('fire-filter-month');
    if (monthSel) monthSel.value = 'all';
    applyFireFilter();
  });

  document.getElementById('fire-filter-month')?.addEventListener('change', (e) => {
    filterMonth = e.target.value;
    applyFireFilter();
  });

  // グラフパネル開閉
  document.getElementById('stats-btn')?.addEventListener('click', toggleStatsPanel);

  map.on('styledata', readdFireLayers);
}
