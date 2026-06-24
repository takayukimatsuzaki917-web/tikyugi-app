# app.py - こども向けデジタル地球儀アプリのFlaskサーバー
#
# このファイルの役割：
#   1. 国データ（data/countries.json）を読み込み、APIとして提供する
#   2. フロントエンド（HTML/CSS/JS）を配信するWebサーバーとして機能する
#
# 国を追加・編集したい場合は、このファイルを変更する必要はありません。
# data/countries.json を編集するだけで反映されます。

import json
import os
from flask import Flask, jsonify, render_template, send_from_directory

# Flaskアプリのインスタンスを作成する
# __name__ を渡すことで、Flaskがテンプレートや静的ファイルの
# 場所を自動的に判断できるようになる
app = Flask(__name__)

# 国データファイルのパスを定数として定義しておく
# このファイルを変更するだけで、データの場所を変えられる
COUNTRIES_FILE = os.path.join(os.path.dirname(__file__), "data", "countries.json")


def load_countries():
    """
    国データをJSONファイルから読み込む関数。

    Returns:
        list: 国データの辞書（dict）を格納したリスト。
              ファイルが見つからない場合は空リストを返す。
    """
    # ファイルが存在するか確認してから読み込む
    if not os.path.exists(COUNTRIES_FILE):
        print(f"警告: 国データファイルが見つかりません: {COUNTRIES_FILE}")
        return []

    # JSONファイルをUTF-8で開いて読み込む
    # encoding='utf-8' を指定しないと、日本語（ひらがな・カタカナ）が
    # 文字化けする可能性があるため、必ず指定する
    with open(COUNTRIES_FILE, encoding="utf-8") as f:
        return json.load(f)


# --- ルーティング定義 ---
# @app.route(...) はURLとPython関数を紐付けるデコレータ。
# ブラウザがそのURLにアクセスすると、対応する関数が実行される。


@app.route("/")
def index():
    """
    トップページ（/）へのアクセスを処理するルート。
    templates/index.html をレンダリングして返す。
    """
    return render_template("index.html")


@app.route("/api/countries")
def get_countries():
    """
    国データをJSON形式で返すAPIエンドポイント（/api/countries）。

    フロントエンドのJavaScriptがこのURLにリクエストを送ると、
    countries.jsonの内容がJSON形式で返ってくる。

    Returns:
        JSON: 全国データのリスト
    """
    countries = load_countries()
    # jsonify はPythonのリスト/辞書をJSON形式のHTTPレスポンスに変換する
    # ensure_ascii=False で日本語がそのまま（文字化けなしで）出力される
    response = jsonify(countries)
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    return response


@app.route("/static/flags/<path:filename>")
def serve_flag(filename):
    """
    国旗SVGファイルを配信するルート。

    例: /static/flags/jp.svg にアクセスすると
        static/flags/jp.svg ファイルが返される。

    Args:
        filename (str): 国旗のファイル名（例: jp.svg）
    """
    flags_dir = os.path.join(app.root_path, "static", "flags")
    return send_from_directory(flags_dir, filename)


# このファイルを直接実行したとき（python app.py）だけサーバーを起動する
# （他のファイルからimportされたときは起動しない）
if __name__ == "__main__":
    print("=" * 50)
    print("こども向けデジタル地球儀アプリを起動します")
    print("=" * 50)
    print("PCのブラウザでアクセス: http://localhost:5000")
    print()
    print("iPhoneでアクセスする場合:")
    print("  1. このPCのIPアドレスを確認してください（例: 192.168.1.10）")
    print("  2. iPhoneのSafariで http://192.168.1.10:5000 にアクセスしてください")
    print("  ※ PCとiPhoneが同じWi-Fiに接続されている必要があります")
    print("=" * 50)

    # debug=True にすると、コードを変更したとき自動でサーバーが再起動する
    # host="0.0.0.0" にすると、同じWi-Fi内のiPhoneからもアクセスできるようになる
    app.run(debug=True, host="0.0.0.0", port=5000)
