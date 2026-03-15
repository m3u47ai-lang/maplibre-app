// ---- search.js ----
// F-04: 住所・キーワード検索
// 国土地理院ジオコーディング API + GeoJSON 属性の前方一致検索

let searchMarker = null; // 検索結果マーカー

// --- GSI ジオコーディング API で住所→座標変換 ---
async function geocodeAddress(query) {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return {
    coords: data[0].geometry.coordinates, // [lng, lat]
    label: data[0].properties.title || query,
  };
}

// --- GeoJSON 属性のキーワード検索（前方一致・部分一致） ---
function searchGeoJsonFeatures(query) {
  const q = query.toLowerCase();
  const results = [];

  Object.entries(geoJsonData).forEach(([sourceId, featureCollection]) => {
    if (!featureCollection || !featureCollection.features) return;
    featureCollection.features.forEach((feature) => {
      const props = feature.properties || {};
      const matched = Object.values(props).some((v) => {
        return String(v).toLowerCase().includes(q);
      });
      if (matched && feature.geometry) {
        results.push({ feature, sourceId });
      }
    });
  });

  return results;
}

// --- 検索結果マーカーを表示し、その地点に飛ぶ ---
function showSearchResult(map, coords, label) {
  if (searchMarker) {
    searchMarker.remove();
    searchMarker = null;
  }

  const el = document.createElement('div');
  el.className = 'search-marker';
  el.title = label;

  searchMarker = new maplibregl.Marker({ element: el })
    .setLngLat(coords)
    .setPopup(
      new maplibregl.Popup({ offset: 28 }).setHTML(
        `<div class="popup-content"><div class="popup-title">🔍 検索結果</div><p>${label}</p></div>`
      )
    )
    .addTo(map);

  map.flyTo({ center: coords, zoom: 15, speed: 1.5 });
  searchMarker.togglePopup();
}

// --- 検索実行 ---
async function executeSearch(map, query) {
  const q = query.trim();
  if (!q) return;

  const searchBtn = document.getElementById('search-btn');
  searchBtn.textContent = '検索中...';
  searchBtn.disabled = true;

  try {
    // 1. まず GeoJSON 属性を検索
    const geoResults = searchGeoJsonFeatures(q);
    if (geoResults.length > 0) {
      const first = geoResults[0].feature;
      let coords;
      if (first.geometry.type === 'Point') {
        coords = first.geometry.coordinates;
      } else {
        // ポリゴンなどは centroid を使う
        const center = turf.centroid(first);
        coords = center.geometry.coordinates;
      }
      const label = Object.values(first.properties || {}).slice(0, 2).join(' ');
      showSearchResult(map, coords, label);
      return;
    }

    // 2. GeoJSON に見つからなければ GSI で住所検索
    const result = await geocodeAddress(q);
    if (result) {
      showSearchResult(map, result.coords, result.label);
      return;
    }

    alert(`「${q}」は見つかりませんでした`);
  } catch (err) {
    console.error('検索エラー:', err);
    alert('検索中にエラーが発生しました');
  } finally {
    searchBtn.textContent = '検索';
    searchBtn.disabled = false;
  }
}

// --- 公開初期化関数 ---
function initSearch(map) {
  const input = document.getElementById('search-input');
  const btn = document.getElementById('search-btn');
  const clearBtn = document.getElementById('search-clear-btn');

  btn.addEventListener('click', () => executeSearch(map, input.value));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeSearch(map, input.value);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    if (searchMarker) {
      searchMarker.remove();
      searchMarker = null;
    }
    input.focus();
  });
}
