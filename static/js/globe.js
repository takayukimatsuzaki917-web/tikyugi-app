/**
 * globe.js - こども向けデジタル地球儀アプリのメインスクリプト
 *
 * 【国旗マーカーの描画方式】
 *   globe.gl の labelsData（ラベルレイヤー）に絵文字国旗を使う方式を採用。
 *
 *   過去に試みた方式と問題点：
 *     1. htmlElementsData（CSS2DRenderer）
 *        → iOS Safari で WebGL canvas と HTML overlay の合成に問題があり表示されない
 *     2. customThreeObjectsData（外部 THREE.Sprite）
 *        → globe.gl 内蔵 THREE と外部インポート THREE の二重インスタンス問題で
 *          スプライトが globe.gl のレンダラーに認識されず描画されない
 *
 *   labelsData の利点：
 *     - globe.gl 自身の内蔵 THREE で絵文字をキャンバステクスチャとして描画
 *     - WebGL スプライトとして描画するため CSS2DRenderer 問題が起きない
 *     - iOS・Android・PC 全プラットフォームで確実に動作する
 *     - 絵文字国旗はユーザーのブラウザ（iPhone等）でレンダリングされるため鮮明
 */


// ========== DOM要素の取得 ==========

const loadingEl     = document.getElementById("loading");
const cardEl        = document.getElementById("country-card");
const closeBtnEl    = document.getElementById("close-btn");
const flagImgEl     = document.getElementById("flag-img");
const countryNameEl = document.getElementById("country-name");
const capitalNameEl = document.getElementById("capital-name");


// ========== メイン処理 ==========

async function initApp() {
  // ---- ローディング画面を消す共通関数 ----
  // onGlobeReady・タイムアウト・エラーのいずれからでも呼ばれる。
  // 二重呼び出しを防ぐフラグ付き。
  let loadingHidden = false;
  const hideLoading = () => {
    if (!loadingHidden) {
      loadingHidden = true;
      loadingEl.style.display = "none";
    }
  };

  // タイムアウト保険：onGlobeReady が来なくても 12 秒後に消す
  setTimeout(hideLoading, 12000);

  // --- Step 1: 国データを取得する ---
  let countries = [];
  try {
    const res = await fetch("/api/countries");
    countries = await res.json();
    console.log(`国データを ${countries.length} カ国分取得しました`);
  } catch (err) {
    console.error("国データの取得に失敗しました:", err);
    loadingEl.querySelector(".loading-text").textContent =
      "データの読み込みに失敗しました。ページをリロードしてください。";
    return;
  }

  // --- Step 2: 国境線 GeoJSON を取得する ---
  let borderFeatures = [];
  try {
    const res = await fetch("/static/data/countries-borders.geojson");
    const geoJSON = await res.json();
    borderFeatures = geoJSON.features;
    console.log(`国境データを ${borderFeatures.length} カ国分取得しました`);
  } catch (err) {
    console.warn("国境データの取得に失敗しました（国境なしで続行します）:", err);
  }

  // --- Step 3: Globe ライブラリが利用可能か確認する ---
  // Globe は index.html の <script src="globe.gl"> でグローバルに定義される
  if (typeof Globe === "undefined") {
    console.error("Globe が未定義です。globe.gl の読み込みを確認してください。");
    loadingEl.querySelector(".loading-text").textContent =
      "ライブラリの読み込みに失敗しました。ページをリロードしてください。";
    return;
  }

  // --- Step 4: globe.gl の初期化 ---
  let globe;
  try {
    globe = initGlobe(countries, borderFeatures);
  } catch (err) {
    console.error("地球儀の初期化に失敗しました:", err);
    hideLoading();
    return;
  }

  // --- Step 5: ローディング画面を非表示にする ---
  globe.onGlobeReady(() => {
    console.log("地球儀の描画が完了しました");
    hideLoading();
  });
}


// ========== globe.gl の初期化 ==========

function initGlobe(countries, borderFeatures) {

  // ---- 地球儀の基本設定 ----
  const globe = Globe()
    (document.getElementById("globe-container"))

    // テクスチャ画像はローカルサーバーから配信（CDN依存を排除）
    .globeImageUrl("/static/img/earth-blue-marble.jpg")
    .atmosphereColor("#4fc3f7")
    .atmosphereAltitude(0.25)
    .backgroundImageUrl("/static/img/night-sky.png");


  // ---- 国境線ポリゴンレイヤー ----
  if (borderFeatures.length > 0) {
    globe
      .polygonsData(borderFeatures)
      .polygonCapColor(() => "rgba(0, 0, 0, 0)")
      .polygonSideColor(() => "rgba(0, 0, 0, 0)")
      .polygonStrokeColor(() => "rgba(255, 255, 255, 0.65)")
      .polygonResolution(3);
  }


  // ---- カメラの初期位置 ----
  globe.pointOfView({ lat: 30, lng: 100, altitude: 2.0 }, 0);


  // ---- 自動回転 ----
  const controls = globe.controls();
  if (controls) {
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
  }

  const container = document.getElementById("globe-container");
  let autoRotateTimer = null;
  const stopAutoRotate  = () => { if (controls) controls.autoRotate = false; clearTimeout(autoRotateTimer); };
  const resumeAutoRotate = () => { autoRotateTimer = setTimeout(() => { if (controls) controls.autoRotate = true; }, 3000); };
  container.addEventListener("mousedown",  stopAutoRotate);
  container.addEventListener("touchstart", stopAutoRotate, { passive: true });
  container.addEventListener("mouseup",    resumeAutoRotate);
  container.addEventListener("touchend",   resumeAutoRotate);


  // ---- 国旗マーカー（labelsData＋絵文字国旗 / WebGL スプライト描画） ----
  //
  // 【なぜ labelsData を使うか】
  //   globe.gl の labelsData は、絵文字テキストをキャンバスに描画し、
  //   globe.gl 自身の内蔵 Three.js でスプライトテクスチャとして WebGL 描画する。
  //   外部 THREE を一切使わないため、二重インスタンス問題が起きない。
  //
  // 【絵文字国旗について】
  //   "🇯🇵" のような国旗絵文字はユーザーのデバイス（iPhone等）のシステムフォントで
  //   描画されるため、iPhone では鮮明な国旗として表示される。
  //   絵文字は Unicode の「地域指示シンボル」を2文字組み合わせて表現される。
  //   例: "JP" → 🇯🇵（U+1F1EF U+1F1F5）
  //
  // 【クリック・タップの検出】
  //   globe.gl の onLabelClick が内部でレイキャスト（3D当たり判定）を行い、
  //   タッチ・マウスの両方に対応している。
  globe
    .labelsData(countries)
    .labelLat(d => d.lat)
    .labelLng(d => d.lng)
    .labelAltitude(0.04)                          // 地球表面から 4% 上に配置
    .labelText(d => getFlagEmoji(d.flag_code))     // 国コードを絵文字国旗に変換
    .labelSize(3.5)                               // 表示サイズ（角度換算）
    .labelDotRadius(0.4)                          // マーカードットのサイズ
    .labelDotOrientation(() => "bottom")          // ドットをラベルの下に配置
    .labelColor(() => "rgba(255, 255, 255, 0.9)") // テキスト色（絵文字自体の色は変わらない）
    .labelResolution(8)                           // キャンバス解像度（高いほど鮮明）
    .onLabelClick((country) => {
      // country は labelsData に渡した国データオブジェクト
      showCountryCard(country);
    });


  return globe;
}


// ========== 国コードを絵文字国旗に変換する関数 ==========

/**
 * 2文字の ISO 国コードを絵文字国旗文字に変換する。
 *
 * Unicode の「地域指示シンボル」（U+1F1E6〜U+1F1FF）を2つ並べることで
 * 国旗絵文字を表現する仕組みを利用している。
 *
 * 例: "jp" → 🇯🇵、"us" → 🇺🇸、"gb" → 🇬🇧
 *
 * @param {string} code - 国コード（例: "jp", "us"）小文字でも大文字でも可
 * @returns {string} - 絵文字国旗文字列
 */
function getFlagEmoji(code) {
  // 大文字に変換してから各文字を地域指示シンボルに変換する
  // A=65 に対して U+1F1E6（🇦）は 127462 なので、差は 127462-65=127397
  return code.toUpperCase().split("").map(char =>
    String.fromCodePoint(127397 + char.charCodeAt(0))
  ).join("");
}


// ========== 国情報カードの表示 ==========

function showCountryCard(country) {
  flagImgEl.src = `/static/flags/${country.flag_code}.svg`;
  flagImgEl.alt = `${country.name_ja}のこっき`;

  countryNameEl.textContent     = country.name_ja;
  capitalNameEl.textContent     = country.capital_ja;
  countryNameEl.dataset.script  = country.name_script;
  capitalNameEl.dataset.script  = country.capital_script;

  cardEl.classList.remove("hidden");
  console.log(`${country.name_ja}（${country.capital_ja}）を選択しました`);
}

function hideCountryCard() {
  cardEl.classList.add("hidden");
}


// ========== イベントリスナーの設定 ==========

closeBtnEl.addEventListener("click", hideCountryCard);
closeBtnEl.addEventListener("touchend", (e) => {
  e.preventDefault();
  hideCountryCard();
});


// ========== アプリ起動 ==========
//
// このスクリプトは index.html の </body> 直前に配置されているため、
// HTML の DOM 要素はすべて構築された後に実行される。
// そのため DOMContentLoaded を待たずに直接 initApp() を呼び出してよい。
initApp();
