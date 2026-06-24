# 🌍 こども向けデジタル地球儀アプリ

指で地球儀をくるくる回して、国旗・国名・首都を覚えるこども向けWebアプリです。  
もうすぐ3歳のお子さんでも楽しめるよう、**ひらがな・カタカナのみ**で表示します。

---

## 📋 アプリの概要

- **3D地球儀**を指（またはマウス）でドラッグして自由に回転できます
- 国の位置にある**国旗アイコン**をタップすると、カードが表示されます
- カードには「**国旗・国名・首都名**」がひらがな・カタカナで大きく表示されます
- **iPhone の Safari** でタッチ操作ができます（PCのブラウザでも動作します）

---

## 🚀 セットアップ・起動方法

### 1. 必要なもの

- Python 3.9 以上
- pip（Pythonパッケージ管理ツール）
- インターネット接続（初回起動時に globe.gl などのライブラリをCDNから読み込むため）

### 2. インストール

```bash
# リポジトリをクローン（またはダウンロード）してフォルダに移動する
cd tikyugi-app

# 仮想環境を作成してアクティベートする（推奨）
python -m venv venv

# Windows の場合
venv\Scripts\activate

# Mac / Linux の場合
source venv/bin/activate

# 必要なパッケージをインストールする
pip install -r requirements.txt
```

### 3. アプリを起動する

```bash
python app.py
```

起動に成功すると、以下のようなメッセージが表示されます：

```
==================================================
こども向けデジタル地球儀アプリを起動します
==================================================
PCのブラウザでアクセス: http://localhost:5000
```

### 4. ブラウザでアクセスする

PCのブラウザで以下のURLを開いてください：

```
http://localhost:5000
```

---

## 📱 iPhone（Safari）で確認する方法

iPhoneとPCが**同じWi-Fi**に接続されている必要があります。

### 手順

1. **PCのIPアドレスを確認する**

   **Windows の場合：**
   ```
   スタートメニュー → 「cmd」と入力 → コマンドプロンプトを起動
   ipconfig と入力 → 「IPv4 アドレス」の欄を確認（例: 192.168.1.10）
   ```

   **Mac の場合：**
   ```
   システム設定 → Wi-Fi → 詳細 → TCP/IP → IPv4アドレス を確認
   ```

2. **Flaskサーバーを起動する**（まだ起動していない場合）
   ```bash
   python app.py
   ```

3. **iPhoneの Safari で以下のURLにアクセスする**
   ```
   http://[PCのIPアドレス]:5000
   例: http://192.168.1.10:5000
   ```

---

## 🗺️ 国を追加する手順

新しい国を追加するには、**3つのステップ**だけで完了します。

### ステップ 1：`data/countries.json` に国データを追加する

ファイルを開き、末尾の `]` の前に以下の形式で1エントリを追加します。

```json
{
  "id": "fr",
  "name_ja": "フランス",
  "name_script": "katakana",
  "capital_ja": "パリ",
  "capital_script": "katakana",
  "lat": 48.8566,
  "lng": 2.3522,
  "flag_code": "fr"
}
```

**各フィールドの説明：**

| フィールド | 説明 | 例 |
|---|---|---|
| `id` | 国コード（ISO 3166-1 alpha-2） | `"fr"` |
| `name_ja` | 国名（ひらがな or カタカナ） | `"フランス"` |
| `name_script` | 表記種別 | `"hiragana"` or `"katakana"` |
| `capital_ja` | 首都名（ひらがな or カタカナ） | `"パリ"` |
| `capital_script` | 表記種別 | `"hiragana"` or `"katakana"` |
| `lat` | 緯度（国の中心付近） | `48.8566` |
| `lng` | 経度（国の中心付近） | `2.3522` |
| `flag_code` | 国旗ファイル名（拡張子なし） | `"fr"` |

> **ひらがな・カタカナのルール：**
> - 日本語の訓読みに近い国（例：日本、中国、韓国）→ `"hiragana"`
> - 外来語として読む国（それ以外のほとんどの国）→ `"katakana"`

### ステップ 2：国旗SVGファイルを `static/flags/` フォルダに追加する

[flag-icons リポジトリ](https://github.com/lipis/flag-icons) から該当国のSVGファイルをダウンロードして、`static/flags/` フォルダに置きます。

ファイル名は `[国コード].svg`（例：`fr.svg`）にしてください。

**ダウンロードURL（フランスの例）：**
```
https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3/fr.svg
```

### ステップ 3：アプリを再起動する（またはブラウザをリロードする）

```bash
python app.py
```

ブラウザで `http://localhost:5000` を開き直すと、追加した国のマーカーが表示されます。

---

## 📁 プロジェクト構成

```
tikyugi-app/
├── app.py                 # Flaskサーバー（APIと静的ファイル配信）
├── data/
│   └── countries.json     # 国データ（←ここを編集して国を追加する）
├── static/
│   ├── flags/             # 国旗SVGファイル（flag-iconsより）
│   │   ├── jp.svg
│   │   ├── us.svg
│   │   └── ...
│   ├── css/
│   │   └── style.css      # スタイルシート
│   └── js/
│       └── globe.js       # 地球儀の表示・操作処理
├── templates/
│   └── index.html         # メインのHTMLページ
├── requirements.txt       # 必要なPythonパッケージ
├── .gitignore
└── README.md              # このファイル
```

---

## 🌐 外出先でiPhoneから使う方法（Render.com への無料デプロイ）

自宅のWi-Fi以外でも子供にアプリを見せたい場合は、インターネット上にアプリを公開（デプロイ）してください。
**Render.com** を使えば無料で公開できます。

### 手順

1. **GitHubにリポジトリを作成してプッシュする**
   ```bash
   git remote add origin https://github.com/あなたのユーザー名/tikyugi-app.git
   git push -u origin main
   ```

2. **Render.com にサインアップする**
   - [https://render.com](https://render.com) にアクセスし、GitHubアカウントでサインアップ

3. **新しいWebサービスを作成する**
   - ダッシュボードで「New → Web Service」をクリック
   - GitHubリポジトリ（tikyugi-app）を選択

4. **設定を入力する**
   | 項目 | 設定値 |
   |---|---|
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `python app.py` |
   | Environment | `Python 3` |
   | Plan | `Free` |

5. **「Create Web Service」をクリックしてデプロイ完了**

数分後に `https://tikyugi-app.onrender.com` のようなURLが発行され、世界中のどこからでもアクセスできます。

> **注意：** 無料プランでは15分間アクセスがないとスリープ状態になります。
> 次のアクセス時に起動まで30〜40秒ほどかかる場合があります。

---

## 🛠 使用技術・ライセンス

| 技術 | 用途 | ライセンス |
|---|---|---|
| [Flask](https://flask.palletsprojects.com/) | Pythonバックエンド | BSD-3-Clause |
| [globe.gl](https://github.com/vasturiano/globe.gl) | 3D地球儀描画 | MIT |
| [flag-icons](https://github.com/lipis/flag-icons) | 国旗SVGファイル | MIT |
| [Three.js](https://threejs.org/) | 3Dレンダリング（globe.gl が内部で使用） | MIT |
| [Natural Earth](https://www.naturalearthdata.com/) | 国境線GeoJSONデータ | Public Domain |
