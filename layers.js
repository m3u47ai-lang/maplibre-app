// ---- layers.js ----
// F-01: レイヤ表示制御パネル
// F-02: 水利アイコン表示・スタイリング
// F-03: ポップアップ詳細表示
// F-05: 静的 GeoJSON レイヤ読み込み

// GeoJSON データをメモリに保持（キーワード検索で使用）
const geoJsonData = {};

// レイヤグループ定義
const LAYER_GROUPS = [
  {
    label: '水利情報',
    layers: [
      {
        id: 'hydrants-public',
        label: '公設消火栓',
        sourceId: 'hydrants',
        filter: ['==', ['get', 'type'], '公設消火栓'],
        type: 'circle',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 15, 8, 18, 12],
          'circle-color': '#0077cc',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      },
      {
        id: 'hydrants-private',
        label: '私設消火栓',
        sourceId: 'hydrants',
        filter: ['==', ['get', 'type'], '私設消火栓'],
        type: 'circle',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 15, 8, 18, 12],
          'circle-color': '#ffffff',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#0077cc',
        },
      },
      {
        id: 'water-tanks',
        label: '公設防火水槽',
        sourceId: 'water-tanks',
        filter: null,
        type: 'circle',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 15, 9, 18, 14],
          'circle-color': '#003399',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#99bbff',
        },
      },
    ],
  },
  {
    label: '区域情報',
    layers: [
      {
        id: 'districts-fill',
        label: '管轄署区域',
        sourceId: 'districts',
        filter: null,
        type: 'fill',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.15,
        },
      },
      {
        id: 'districts-line',
        label: null, // 同グループの fill に紐づく境界線（個別トグル不要）
        sourceId: 'districts',
        filter: null,
        type: 'line',
        linkedTo: 'districts-fill',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-dasharray': [4, 2],
        },
      },
      {
        id: 'hazard-zones-fill',
        label: '災害危険箇所',
        sourceId: 'hazard-zones',
        filter: null,
        type: 'fill',
        paint: {
          'fill-color': [
            'match', ['get', 'risk_level'],
            '高', '#e63946',
            '中', '#f4a261',
            '#ffb703',
          ],
          'fill-opacity': 0.3,
        },
      },
      {
        id: 'hazard-zones-line',
        label: null,
        sourceId: 'hazard-zones',
        filter: null,
        type: 'line',
        linkedTo: 'hazard-zones-fill',
        paint: {
          'line-color': [
            'match', ['get', 'risk_level'],
            '高', '#c1121f',
            '中', '#e07020',
            '#e09000',
          ],
          'line-width': 1.5,
        },
      },
    ],
  },
];

// GeoJSON ソース定義
const SOURCES = [
  { id: 'hydrants',     url: 'data/hydrants.geojson' },
  { id: 'water-tanks',  url: 'data/water-tanks.geojson' },
  { id: 'districts',    url: 'data/districts.geojson' },
  { id: 'hazard-zones', url: 'data/hazard-zones.geojson' },
];

// --- ポップアップ HTML 生成 ---

function buildPopupHTML(props) {
  if (!props) return '';
  const type = props.type || '';

  if (type === '公設消火栓' || type === '私設消火栓') {
    return `
      <div class="popup-content">
        <div class="popup-title">${type}</div>
        <table class="popup-table">
          <tr><th>管理番号</th><td>${props.id || '―'}</td></tr>
          <tr><th>所在地</th><td>${props.address || '―'}</td></tr>
          <tr><th>配管口径</th><td>${props.diameter != null ? props.diameter + ' mm' : '―'}</td></tr>
          <tr><th>設置年度</th><td>${props.year != null ? props.year + ' 年' : '―'}</td></tr>
          <tr><th>点検状況</th><td class="${props.inspection === '正常' ? 'status-ok' : 'status-warn'}">${props.inspection || '―'}</td></tr>
          ${props.note ? `<tr><th>備考</th><td>${props.note}</td></tr>` : ''}
        </table>
      </div>`;
  }

  if (type === '公設防火水槽') {
    return `
      <div class="popup-content">
        <div class="popup-title">${type}</div>
        <table class="popup-table">
          <tr><th>管理番号</th><td>${props.id || '―'}</td></tr>
          <tr><th>所在地</th><td>${props.address || '―'}</td></tr>
          <tr><th>容量</th><td>${props.capacity != null ? props.capacity + ' m³' : '―'}</td></tr>
          <tr><th>設置年度</th><td>${props.year != null ? props.year + ' 年' : '―'}</td></tr>
          <tr><th>点検状況</th><td class="${props.inspection === '正常' ? 'status-ok' : 'status-warn'}">${props.inspection || '―'}</td></tr>
          ${props.note ? `<tr><th>備考</th><td>${props.note}</td></tr>` : ''}
        </table>
      </div>`;
  }

  // ポリゴン系（区域・危険箇所）
  const name = props.name || '';
  const riskLevel = props.risk_level ? `<tr><th>危険度</th><td>${props.risk_level}</td></tr>` : '';
  return `
    <div class="popup-content">
      <div class="popup-title">${name}</div>
      <table class="popup-table">${riskLevel}</table>
    </div>`;
}

// --- レイヤの追加 ---

function addLayersToMap(map) {
  SOURCES.forEach(({ id, url }) => {
    // データをメモリにも保持
    fetch(url)
      .then((r) => r.json())
      .then((data) => { geoJsonData[id] = data; })
      .catch(() => {});

    map.addSource(id, { type: 'geojson', data: url });
  });

  LAYER_GROUPS.forEach(({ layers }) => {
    layers.forEach((layerDef) => {
      const layerSpec = {
        id: layerDef.id,
        type: layerDef.type,
        source: layerDef.sourceId,
        paint: layerDef.paint,
        layout: { visibility: getInitialVisibility(layerDef.id) },
      };
      if (layerDef.filter) {
        layerSpec.filter = layerDef.filter;
      }
      map.addLayer(layerSpec);
    });
  });
}

// --- ポップアップ登録 ---

function registerPopupHandlers(map) {
  const clickableLayers = LAYER_GROUPS
    .flatMap((g) => g.layers)
    .filter((l) => l.label !== null); // linkedTo の境界線レイヤは除外

  clickableLayers.forEach(({ id }) => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });

    map.on('click', id, (e) => {
      const feature = e.features && e.features[0];
      if (!feature) return;
      e.preventDefault(); // 背景クリックポップアップを抑制
      new maplibregl.Popup({ maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setHTML(buildPopupHTML(feature.properties))
        .addTo(map);
    });
  });
}

// --- レイヤ visibility の localStorage 管理 ---

function getInitialVisibility(layerId) {
  const saved = localStorage.getItem(`layer-vis-${layerId}`);
  return saved === 'none' ? 'none' : 'visible';
}

function setLayerVisibility(map, layerId, visible) {
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  localStorage.setItem(`layer-vis-${layerId}`, visible ? 'visible' : 'none');
}

// --- レイヤパネル UI の構築 ---

function buildLayerPanel(map) {
  const container = document.getElementById('layer-groups');
  if (!container) return;

  LAYER_GROUPS.forEach(({ label, layers }) => {
    const group = document.createElement('div');
    group.className = 'layer-group';

    const groupLabel = document.createElement('div');
    groupLabel.className = 'layer-group-label';
    groupLabel.textContent = label;
    group.appendChild(groupLabel);

    // label が null のレイヤ（境界線など）は UI に出さない
    layers.filter((l) => l.label !== null).forEach((layerDef) => {
      const row = document.createElement('label');
      row.className = 'layer-row';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = getInitialVisibility(layerDef.id) === 'visible';
      checkbox.addEventListener('change', () => {
        setLayerVisibility(map, layerDef.id, checkbox.checked);
        // 境界線レイヤが紐づいている場合は連動
        const linked = LAYER_GROUPS
          .flatMap((g) => g.layers)
          .find((l) => l.linkedTo === layerDef.id);
        if (linked) {
          setLayerVisibility(map, linked.id, checkbox.checked);
        }
      });

      const dot = document.createElement('span');
      dot.className = 'layer-dot';
      dot.style.background = getLayerColor(layerDef);

      const text = document.createElement('span');
      text.textContent = layerDef.label;

      row.appendChild(checkbox);
      row.appendChild(dot);
      row.appendChild(text);
      group.appendChild(row);
    });

    container.appendChild(group);
  });
}

// レイヤの代表色を取得（パネルのドット表示用）
function getLayerColor(layerDef) {
  const paint = layerDef.paint || {};
  if (layerDef.id === 'hydrants-public')  return '#0077cc';
  if (layerDef.id === 'hydrants-private') return '#ffffff';
  if (layerDef.id === 'water-tanks')      return '#003399';
  if (layerDef.id === 'districts-fill')   return '#3388ff';
  if (layerDef.id === 'hazard-zones-fill') return '#e63946';
  return '#888';
}

// --- スタイル変更時の再追加 ---

function onStyleChange(map) {
  map.on('styledata', () => {
    // ソース・レイヤが存在しない場合だけ再追加
    if (!map.getSource('hydrants')) {
      addLayersToMap(map);
    }
  });
}

// --- 公開初期化関数 ---

function initLayers(map) {
  addLayersToMap(map);
  registerPopupHandlers(map);
  buildLayerPanel(map);
  onStyleChange(map);
}
