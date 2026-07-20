"""
消火栓カバレッジ分析スクリプト
================================

このアプリの data/ にある GeoJSON を読み込み、各防火対象物(ホテル・施設など)から
最寄りの消火栓・消防署までの距離を計算して、消防水利の基準(全国的にはおおむね
半径140m以内に消火栓が必要とされる)を満たしているかをチェックするツールです。

Python学習用に、以下の要素を意識して書いています。
  - dataclass         : 座標や結果をまとめる小さな入れ物
  - 型ヒント           : 引数・戻り値の型を明示
  - 関数分割           : 「読み込む」「距離を測る」「探す」「集計する」を分離
  - 内包表記           : リスト/辞書内包表記でループを簡潔に
  - argparse           : コマンドライン引数の受け取り方
  - f-string           : 文字列フォーマット

実行方法:
    python python/hydrant_coverage.py
    python python/hydrant_coverage.py --threshold 100 --json-out report.json
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path

# 消防水利の基準の目安(メートル)。実際の基準は地域や用途地域によって異なる。
DEFAULT_THRESHOLD_M = 140.0

# このファイル(python/hydrant_coverage.py)から見た data/ ディレクトリの場所
DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@dataclass
class Point:
    """緯度経度の1点を表す小さなデータクラス。"""

    lat: float
    lon: float


def load_feature_collection(path: Path) -> list[dict]:
    """GeoJSON(FeatureCollection)を読み込み、features のリストを返す。"""
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    return data["features"]


def feature_point(feature: dict) -> Point:
    """Point geometry を持つ feature から Point を取り出す。"""
    lon, lat = feature["geometry"]["coordinates"][:2]
    return Point(lat=lat, lon=lon)


def haversine_distance_m(a: Point, b: Point) -> float:
    """2点間の距離をメートルで返す(球面上の距離: 大円距離)。

    緯度経度は「角度」なので、そのまま引き算しても距離にはならない。
    地球を半径 R の球とみなし、球面三角法の公式(ハーバサイン公式)で
    弧の長さを求める。
    """
    r = 6371_000  # 地球の半径(メートル)

    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)

    d_lat = lat2 - lat1
    d_lon = lon2 - lon1

    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(h))


def find_nearest(origin: Point, candidates: list[dict]) -> tuple[dict, float]:
    """candidates の中から origin に最も近い feature と距離(m)を返す。"""
    best_feature: dict | None = None
    best_distance = math.inf

    for feature in candidates:
        distance = haversine_distance_m(origin, feature_point(feature))
        if distance < best_distance:
            best_feature = feature
            best_distance = distance

    assert best_feature is not None, "candidates が空です"
    return best_feature, best_distance


def build_report(
    targets: list[dict],
    hydrants: list[dict],
    stations: list[dict],
    threshold_m: float,
) -> list[dict]:
    """防火対象物ごとに、最寄り消火栓・最寄り消防署との距離をまとめる。"""
    report = []
    for target in targets:
        origin = feature_point(target)

        nearest_hydrant, hydrant_dist = find_nearest(origin, hydrants)
        nearest_station, station_dist = find_nearest(origin, stations)

        report.append(
            {
                "target_id": target["properties"]["id"],
                "target_name": target["properties"]["name"],
                "nearest_hydrant_id": nearest_hydrant["properties"]["id"],
                "hydrant_distance_m": round(hydrant_dist, 1),
                "within_threshold": hydrant_dist <= threshold_m,
                "nearest_station_name": nearest_station["properties"]["name"],
                "station_distance_m": round(station_dist, 1),
            }
        )
    return report


def summarize(report: list[dict], hydrants: list[dict], threshold_m: float) -> dict:
    """report 全体からサマリ情報を作る。"""
    distances = [row["hydrant_distance_m"] for row in report]
    out_of_range = [row for row in report if not row["within_threshold"]]
    needs_inspection = [
        h for h in hydrants if h["properties"]["inspection"] != "正常"
    ]

    return {
        "target_count": len(report),
        "threshold_m": threshold_m,
        "avg_hydrant_distance_m": round(sum(distances) / len(distances), 1),
        "max_hydrant_distance_m": round(max(distances), 1),
        "out_of_range_count": len(out_of_range),
        "out_of_range_targets": [row["target_name"] for row in out_of_range],
        "hydrants_needing_inspection": [
            h["properties"]["id"] for h in needs_inspection
        ],
    }


def print_report(report: list[dict], summary: dict) -> None:
    """結果を読みやすい表形式でコンソールに出力する。"""
    print("=== 防火対象物ごとの最寄り消火栓/消防署 ===")
    header = f"{'対象物':<18}{'最寄消火栓':<10}{'距離(m)':>8}  {'基準内':<6}{'最寄消防署':<12}{'距離(m)':>8}"
    print(header)
    print("-" * len(header))
    for row in report:
        ok = "OK" if row["within_threshold"] else "NG"
        print(
            f"{row['target_name']:<18}{row['nearest_hydrant_id']:<10}"
            f"{row['hydrant_distance_m']:>8.1f}  {ok:<6}"
            f"{row['nearest_station_name']:<12}{row['station_distance_m']:>8.1f}"
        )

    print()
    print("=== サマリ ===")
    print(f"対象物件数         : {summary['target_count']}")
    print(f"基準距離           : {summary['threshold_m']} m")
    print(f"平均消火栓距離     : {summary['avg_hydrant_distance_m']} m")
    print(f"最大消火栓距離     : {summary['max_hydrant_distance_m']} m")
    print(f"基準超過件数       : {summary['out_of_range_count']}")
    if summary["out_of_range_targets"]:
        print(f"  → {', '.join(summary['out_of_range_targets'])}")
    print(f"要点検の消火栓     : {', '.join(summary['hydrants_needing_inspection']) or 'なし'}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="消火栓カバレッジ分析")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help="GeoJSON が置かれているディレクトリ(既定: data/)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD_M,
        help=f"消火栓カバレッジの基準距離(m)。既定は {DEFAULT_THRESHOLD_M}",
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=None,
        help="詳細レポートをJSONファイルにも書き出す場合、出力先パスを指定",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    stations = load_feature_collection(args.data_dir / "fire_stations.geojson")
    hydrants = load_feature_collection(args.data_dir / "hydrants.geojson")
    targets = load_feature_collection(args.data_dir / "fire_prevention_targets.geojson")

    report = build_report(targets, hydrants, stations, args.threshold)
    summary = summarize(report, hydrants, args.threshold)

    print_report(report, summary)

    if args.json_out:
        args.json_out.write_text(
            json.dumps({"report": report, "summary": summary}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\nJSONレポートを書き出しました: {args.json_out}")


if __name__ == "__main__":
    main()