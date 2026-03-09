# MapLibre App

MapLibre GL JS を使ったシンプルなインタラクティブ地図アプリです。

## デモ

https://m3u47ai-lang.github.io/maplibre-app/

## 機能

- 地図スタイルの切り替え（MapLibre Demo / OSM Bright）
- 現在地への移動
- 日本の主要都市（東京・大阪・福岡・札幌）へのジャンプ
- 現在の座標・ズームレベルの表示

## 使い方

ローカルで動かす場合は、ローカルサーバー経由で開いてください。

```bash
npx http-server .
```

または VSCode の [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) 拡張を使用してください。

## 技術スタック

- [MapLibre GL JS](https://maplibre.org/) v4.7.1
- HTML / CSS / JavaScript（ビルドツール不要）

## ライセンス

MIT
