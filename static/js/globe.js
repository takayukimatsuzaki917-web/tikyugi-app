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
      .polygonStrokeColor(() => "rgba(255, 255, 255, 0.65)");
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


  // ---- 国旗マーカー（htmlElementsData＋SVG画像オーバーレイ） ----
  //
  // 【なぜ htmlElementsData を使うか】
  //   過去に試した方式と問題点：
  //     1. customThreeObjectsData（外部 THREE.Sprite）
  //        → globe.gl 内蔵 THREE と外部 import THREE の二重インスタンス問題で
  //          スプライトが描画されない
  //     2. labelsData（絵文字国旗）
  //        → Windows には国旗絵文字フォントが無いため Chrome で国旗が表示されない
  //
  //   htmlElementsData は、各データに対応する HTML 要素を生成し、
  //   globe.gl が地球儀上の正しい位置に重ねて表示してくれる方式。
  //   実際の SVG 国旗画像（<img>）をそのまま使えるため、
  //   OS のフォント事情に左右されず、全プラットフォームで本物の国旗が表示される。
  //
  // 【クリック・タップの検出】
  //   生成した HTML 要素に直接 click / touch イベントを付けて検出する。
  globe
    .htmlElementsData(countries)
    .htmlLat(d => d.lat)
    .htmlLng(d => d.lng)
    .htmlAltitude(0.04)                 // 地球表面から 4% 上に配置
    .htmlElement(d => createFlagElement(d));


  return globe;
}


// ========== 国旗 HTML 要素の作成 ==========

/**
 * 1つの国に対して、地球儀上に重ねて表示する国旗の HTML 要素を作成する。
 *
 * globe.gl は返された要素を内部で CSS transform により地球儀上の位置へ移動させる。
 * 要素自体のサイズ・見た目はこの関数で自由に指定できる。
 *
 * @param {Object} country - 国データオブジェクト
 * @returns {HTMLElement} - 地球儀上に表示する国旗の要素
 */
function createFlagElement(country) {
  // 国旗画像（SVG）を表示する img 要素
  const img = document.createElement("img");
  img.src = `/static/flags/${country.flag_code}.svg`;
  img.alt = `${country.name_ja}のこっき`;

  // ---- 見た目のスタイル ----
  img.style.width        = "44px";          // iPhone でも押しやすいサイズ
  img.style.height       = "30px";
  img.style.objectFit    = "cover";
  img.style.border       = "2px solid #ffffff";
  img.style.borderRadius = "4px";
  img.style.boxShadow    = "0 2px 6px rgba(0, 0, 0, 0.5)";
  img.style.cursor       = "pointer";
  // globe.gl が transform で位置を制御するため、自身の中心を基準点にする
  img.style.transform    = "translate(-50%, -50%)";
  // タップ・クリックを確実に受け取れるようにする
  img.style.pointerEvents = "auto";

  // ---- タップ・クリックで国情報カードを表示 ----
  const onSelect = (e) => {
    e.preventDefault();
    e.stopPropagation();
    showCountryCard(country);
  };
  img.addEventListener("click", onSelect);
  img.addEventListener("touchend", onSelect);

  return img;
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
