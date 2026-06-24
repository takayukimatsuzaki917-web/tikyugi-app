/**
 * globe.js - こども向けデジタル地球儀アプリのメインスクリプト
 *
 * このファイルが担う役割：
 *   1. Flaskサーバーから国データを取得する
 *   2. globe.gl を使って3D地球儀を初期化・設定する
 *   3. 国境線GeoJSONを読み込み、地球儀上に国境を表示する
 *   4. 各国の位置に国旗マーカーを表示する
 *   5. マーカーをタップしたときに国情報カードを表示する
 *   6. カードの閉じるボタンを動作させる
 */

// ========== DOM要素の取得 ==========
// HTML側で定義した要素を JavaScript から操作するために、id で取得しておく

const loadingEl     = document.getElementById("loading");
const cardEl        = document.getElementById("country-card");
const closeBtnEl    = document.getElementById("close-btn");
const flagImgEl     = document.getElementById("flag-img");
const countryNameEl = document.getElementById("country-name");
const capitalNameEl = document.getElementById("capital-name");


// ========== メイン処理 ==========

/**
 * アプリの初期化。ページが読み込まれたら自動的に呼び出される。
 *
 * 処理の流れ：
 *   1. FlaskのAPIから国データを取得する
 *   2. 国境線のGeoJSONを取得する
 *   3. globe.gl の3D地球儀を初期化する
 *   4. ローディング画面を消す
 */
async function initApp() {
  // --- Step 1: 国データを取得する ---
  let countries = [];
  try {
    const response = await fetch("/api/countries");
    countries = await response.json();
    console.log(`国データを ${countries.length} カ国分取得しました`);
  } catch (error) {
    console.error("国データの取得に失敗しました:", error);
    return;
  }

  // --- Step 2: 国境線GeoJSONを取得する ---
  // Natural Earth の 110m 解像度の国境データ（static/data/countries-borders.geojson）
  // このデータを globe.gl のポリゴンレイヤーとして重ねることで国境線が表示される
  let borderFeatures = [];
  try {
    const bordersRes = await fetch("/static/data/countries-borders.geojson");
    const bordersGeoJSON = await bordersRes.json();
    // GeoJSONの features 配列を取り出す（各要素が1カ国分のポリゴン）
    borderFeatures = bordersGeoJSON.features;
    console.log(`国境データを ${borderFeatures.length} カ国分取得しました`);
  } catch (error) {
    // 国境データが取れなくても地球儀は表示できるので、警告にとどめる
    console.warn("国境データの取得に失敗しました（国境なしで続行します）:", error);
  }

  // --- Step 3: globe.gl の初期化 ---
  const globe = initGlobe(countries, borderFeatures);

  // --- Step 4: ローディング画面を非表示にする ---
  globe.onGlobeReady(() => {
    loadingEl.style.display = "none";
    console.log("地球儀の描画が完了しました");
  });
}


// ========== globe.gl の初期化 ==========

/**
 * globe.gl ライブラリを初期化し、3D地球儀を構築する関数。
 *
 * @param {Array}  countries      - 国データの配列（/api/countries から取得）
 * @param {Array}  borderFeatures - GeoJSONのfeaturesの配列（国境線データ）
 * @returns {Object} - 初期化済みの globe インスタンス
 */
function initGlobe(countries, borderFeatures) {

  // ---- 地球儀の基本設定 ----
  const globe = Globe()
    (document.getElementById("globe-container"))

    // 地球の表面テクスチャ（衛星写真ベース）
    .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")

    // 大気光（地球の縁をぼんやり光らせる）
    .atmosphereColor("#4fc3f7")
    .atmosphereAltitude(0.25)

    // 宇宙背景
    .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png");


  // ---- 国境線ポリゴンレイヤーの設定 ----
  // globe.gl の .polygonsData() を使って、国のGeoJSONポリゴンを地球上に重ねる。
  // 国の内側（cap）と側面（side）は透明にして、境界線（stroke）のみ表示する。
  if (borderFeatures.length > 0) {
    globe
      .polygonsData(borderFeatures)
      // 国の「面」の色 → 完全透明（地球のテクスチャが透けて見えるようにする）
      .polygonCapColor(() => "rgba(0, 0, 0, 0)")
      // 国の「厚み部分」の色 → 完全透明
      .polygonSideColor(() => "rgba(0, 0, 0, 0)")
      // 国境線の色 → 白色・やや半透明（衛星写真に映えるよう白を採用）
      .polygonStrokeColor(() => "rgba(255, 255, 255, 0.65)")
      // ポリゴンのレンダリング解像度（高いほど滑らかだが重い）
      .polygonResolution(3);
  }


  // ---- カメラの初期位置 ----
  globe.pointOfView({ lat: 30, lng: 100, altitude: 2.0 }, 0);


  // ---- 自動回転の設定 ----
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.5;

  // ユーザー操作中は自動回転を止め、3秒後に再開する
  const container = document.getElementById("globe-container");
  let autoRotateTimer = null;

  const stopAutoRotate = () => {
    globe.controls().autoRotate = false;
    clearTimeout(autoRotateTimer);
  };
  const resumeAutoRotate = () => {
    autoRotateTimer = setTimeout(() => {
      globe.controls().autoRotate = true;
    }, 3000);
  };

  container.addEventListener("mousedown",  stopAutoRotate);
  container.addEventListener("touchstart", stopAutoRotate, { passive: true });
  container.addEventListener("mouseup",    resumeAutoRotate);
  container.addEventListener("touchend",   resumeAutoRotate);


  // ---- 国旗マーカーの設定 ----
  globe
    .htmlElementsData(countries)
    .htmlLat(d => d.lat)
    .htmlLng(d => d.lng)
    .htmlAltitude(0.03)              // 地球表面から少し浮かせる
    .htmlElement(d => createFlagMarker(d));


  return globe;
}


// ========== 国旗マーカーの作成 ==========

/**
 * 1つの国に対して、地球儀上に表示する国旗マーカー（HTML要素）を作成する関数。
 *
 * タップ検出の工夫：
 *   - touchstart で開始座標を記録する
 *   - touchend で移動距離を計算し、10px 以内なら「タップ」とみなす
 *   - これにより、地球儀のドラッグ操作と国旗のタップを正しく区別できる
 *
 * @param {Object} country - 国データオブジェクト
 * @returns {HTMLElement} - 地球儀上に表示する img 要素
 */
function createFlagMarker(country) {
  const img = document.createElement("img");
  img.src       = `/static/flags/${country.flag_code}.svg`;
  img.alt       = country.name_ja;
  img.className = "marker-flag";

  // ---- PC（マウス）でのクリック ----
  img.addEventListener("click", (event) => {
    event.stopPropagation();
    showCountryCard(country);
  });

  // ---- スマホ（タッチ）でのタップ ----
  // タップとドラッグを区別するために開始座標を記録する
  let touchStartX = 0;
  let touchStartY = 0;

  img.addEventListener("touchstart", (event) => {
    // passive: true なので preventDefault は呼べないが、座標の記録は可能
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  img.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 移動距離が 10px 以内の場合のみ「タップ」として処理する
    // 10px を超える場合は地球儀の回転操作とみなし、カードを表示しない
    if (dist < 10) {
      event.stopPropagation(); // 地球儀へのイベント伝播を止める
      event.preventDefault();  // タッチ後のマウスイベント発火を防ぐ
      showCountryCard(country);
    }
  }, { passive: false });

  return img;
}


// ========== 国情報カードの表示 ==========

/**
 * 国情報カードを画面下部に表示する関数。
 * マーカーをタップしたときに呼ばれる。
 *
 * @param {Object} country - 選択された国のデータオブジェクト
 */
function showCountryCard(country) {
  // 国旗画像を更新する
  flagImgEl.src = `/static/flags/${country.flag_code}.svg`;
  flagImgEl.alt = `${country.name_ja}のこっき`;

  // 国名・首都名を更新する（ひらがな or カタカナ）
  countryNameEl.textContent      = country.name_ja;
  capitalNameEl.textContent      = country.capital_ja;

  // スクリプト種別をデータ属性として付与する（CSS での追加スタイリングに利用可能）
  countryNameEl.dataset.script  = country.name_script;
  capitalNameEl.dataset.script  = country.capital_script;

  // .hidden クラスを外すと style.css の transition でスライドアップする
  cardEl.classList.remove("hidden");

  console.log(`${country.name_ja}（${country.capital_ja}）を選択しました`);
}


/**
 * 国情報カードを非表示にする関数。
 * 閉じるボタンをタップしたときに呼ばれる。
 */
function hideCountryCard() {
  cardEl.classList.add("hidden");
}


// ========== イベントリスナーの設定 ==========

// 閉じるボタン（×）
closeBtnEl.addEventListener("click", hideCountryCard);
closeBtnEl.addEventListener("touchend", (e) => {
  e.preventDefault();
  hideCountryCard();
});


// ========== アプリ起動 ==========

document.addEventListener("DOMContentLoaded", initApp);
