# 3D Gyro Maze Game

スマートフォンをコントローラーとして使用する、ブラウザベースの3D迷路アクションゲームです。
p5.js（WEBGL）による3D描画と、Socket.ioによるリアルタイム通信を組み合わせ、直感的かつ没入感のある操作体験を実現しています。

---

## Overview

本プロジェクトは「デバイス間連携」と「リアルタイム物理シミュレーション」をテーマに開発しました。

PCで表示される3D迷路を、スマートフォンのジャイロセンサーで操作します。
プレイヤーは迷路全体を傾けることでボールを転がし、ゴールを目指します。

---

## Features

### ジャイロ操作

* スマートフォンの `deviceorientation` を利用
* 傾き（Beta / Gamma）を取得し、リアルタイムでゲームに反映
* コントローラー不要の直感的操作

### 3Dレンダリング

* p5.js（WEBGL）による3D描画
* ライティング（環境光・指向性光・点光源）を実装
* 奥行きと質感を持つ迷路表現

### リアルタイム通信

* Socket.io による双方向通信
* センサーデータを低遅延でPCに送信
* マルチデバイス連携を実現

### 物理挙動シミュレーション

* 傾きに応じた加速度計算
* 摩擦・慣性を考慮した移動
* 壁との衝突判定（配列ベース）

### ゲーム演出

* 「Ready... → Go!」の開始演出
* ゴール時のアニメーション表示
* プレイ体験を意識したUI設計

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Run Server

```bash
node server.js
```

### 3. Access

* PC: http://localhost:3000
* スマートフォン: 同一ネットワーク内で同URLにアクセス

※ スマホ側ではセンサーの使用許可が必要です

---

## Architecture

### データフロー

```
[ Smartphone ]
  ↓ deviceorientation
[ Socket.io (emit) ]
  ↓
[ Node.js Server ]
  ↓ broadcast
[ PC Browser (p5.js) ]
```

### 各役割

| コンポーネント | 役割        |
| ------- | --------- |
| スマートフォン | 傾きセンサーの取得 |
| Node.js | データの中継    |
| PCブラウザ  | 3D描画・物理演算 |

---

## Technical Details

### 座標管理

* 迷路は **2次元配列（0:床 / 1:壁）** で管理
* 配列インデックスと3D空間座標を相互変換

### 衝突判定

```js
if (isWall(nextX + margin, y)) {
  vx = 0;
}
```

* 次フレームの位置を予測
* 壁との接触を検知して速度制御

### 物理処理

* 傾き → 加速度へ変換
* 摩擦係数による減速処理

```js
vx *= friction;
```

### ゴール判定

```js
let d = dist(x, y, goalX, goalY);
if (d < r + goalSize / 2)
```

* 距離ベースの当たり判定
* 半径＋ゴールサイズで精密判定

---

## Tech Stack

| Category      | Technology        |
| ------------- | ----------------- |
| Frontend      | JavaScript, p5.js |
| Backend       | Node.js, Express  |
| Communication | Socket.io         |
| Rendering     | WEBGL             |
| Styling       | CSS3              |
| Storage       | LocalStorage      |

---

## Project Structure

```
3d-gyro-maze/
├── server.js
├── package.json
├── public/
│   ├── index.html
│   ├── sketch.js
│   ├── style.css
│   └── assets/
└── README.md
```

---

## Highlights

### UX設計

* ゲーム開始のカウントダウン演出
* ゴール時のフィードバック
* シンプルで直感的な操作設計

### パフォーマンス

* 描画負荷を抑えたライティング設計
* 軽量な物理計算ロジック

### 拡張性

* 配列ベースの迷路構造
* ステージ追加や自動生成が容易

---

## Future Improvements

* ステージ自動生成アルゴリズム
* タイムアタックランキング（サーバー保存）
* モバイルUIの強化
* マルチプレイヤー対応

---

## License

MIT License


