/**
 * globe.js - こども向けデジタル地球儀アプリのメインスクリプト
 *
 * 【国旗マーカーの描画方式】
 *   以前は globe.gl の htmlElementsData（CSS2DRenderer）を使っていたが、
 *   iOS Safari では WebGL キャンバスと HTML オーバーレイが正しく合成されず
 *   国旗が表示されない問題があった。
 *   そのため customThreeObjectsData（Three.js Sprite / WebGL直接描画）に変更。
 *   WebGL で描画するため iOS を含む全プラットフォームで確実に表示される。
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

  // --- Step 3: THREE が利用可能か確認する ---
  // THREE は index.html で three.min.js から読み込んだグローバル変数
  if (typeof THREE === "undefined") {
    console.error("THREE が未定義です。three.min.js の読み込みを確認してください。");
    loadingEl.querySelector(".loading-text").textContent =
      "ライブラリの読み込みに失敗しました。ページをリロードしてください。";
    return;
  }
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


  // ---- 国旗マーカー（Three.js Sprite / WebGL描画） ----
  //
  // 【なぜ customThreeObjectsData を使うか】
  //   htmlElementsData は CSS2DRenderer でHTMLを重ねる方式。
  //   iOS Safari では WebGL canvas と HTML overlay の合成に問題があり、
  //   国旗が表示されないケースがある。
  //   customThreeObjectsData は WebGL で直接スプライトを描画するため
  //   iOS を含む全環境で確実に動作する。
  //
  // 【クリック・タップの検出】
  //   globe.gl の onCustomObjectClick が内部でレイキャスト（3D当たり判定）を行い、
  //   タッチ・マウスの両方に対応している。
  globe
    .customThreeObjectsData(countries)
    .customThreeObjectLat(d => d.lat)
    .customThreeObjectLng(d => d.lng)
    .customThreeObjectAltitude(0.04)        // 地球表面から 4% 上に配置
    .customThreeObject(d => createFlagSprite(d))
    .onCustomObjectClick((obj) => {
      // obj は createFlagSprite が返した THREE.Sprite
      // userData に国データを保存しているので取り出す
      if (obj && obj.userData && obj.userData.country) {
        showCountryCard(obj.userData.country);
      }
    });


  return globe;
}


// ========== 国旗スプライトの作成（Three.js Sprite） ==========

/**
 * 1つの国に対して Three.js Sprite を作成する関数。
 *
 * 処理の流れ：
 *   1. Canvas を作成して初期状態（白背景）でテクスチャを生成する
 *   2. SVG 画像を非同期で読み込み、Canvas に描画する
 *   3. texture.needsUpdate = true で Three.js に再アップロードを指示する
 *
 * @param {Object} country - 国データオブジェクト
 * @returns {THREE.Sprite} - 地球儀上に表示する Sprite オブジェクト
 */
function createFlagSprite(country) {
  // Canvas を作成して国旗の画像を描く（4:3 の比率）
  const canvas = document.createElement("canvas");
  canvas.width  = 240;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  // ---- 読み込み中の仮表示（白背景＋薄いグレー枠） ----
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(200, 200, 200, 0.8)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

  // ---- Three.js テクスチャを Canvas から生成する ----
  // CanvasTexture は Canvas の内容を GPU テクスチャとして使うクラス
  const texture = new THREE.CanvasTexture(canvas);

  // ---- SVG 国旗を非同期で読み込んで Canvas に描画する ----
  const img = new Image();
  img.onload = () => {
    // Canvas をクリアして国旗を描く
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 白背景（国旗の透過部分を白にする）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 国旗の SVG を Canvas に描画する
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Three.js に「テクスチャが更新されたので GPU に再アップロードしてほしい」と伝える
    texture.needsUpdate = true;
  };
  img.onerror = () => {
    // 国旗が読み込めなかった場合、グレーの × 印を表示する
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#cccccc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#999999";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(20, 20); ctx.lineTo(canvas.width - 20, canvas.height - 20);
    ctx.moveTo(canvas.width - 20, 20); ctx.lineTo(20, canvas.height - 20);
    ctx.stroke();
    texture.needsUpdate = true;
  };
  // 国旗SVGのパス（Flaskサーバーからローカル配信）
  img.src = `/static/flags/${country.flag_code}.svg`;

  // ---- SpriteMaterial：スプライトの外見を定義するマテリアル ----
  const material = new THREE.SpriteMaterial({
    map: texture,
    // depthTest: true → 地球の裏側にある国旗は地球に隠れて見えなくなる
    //   （false にすると裏側の国旗が地球を透過して見えてしまう）
    depthTest: true,
    // transparent: true → 国旗の半透明部分を正しく描画する
    transparent: true,
  });

  // ---- Sprite オブジェクトを作成する ----
  const sprite = new THREE.Sprite(material);

  // スプライトのサイズを設定する（globe.gl の Three.js 座標系での単位）
  // グローブ半径は約 100 なので、scale(14, 9) は半径の 14% × 9% 程度の大きさ
  sprite.scale.set(14, 9, 1);

  // タップ・クリック時に国データを参照するために userData に保存する
  // globe.gl の onCustomObjectClick がこの Sprite を渡してくるので、
  // sprite.userData.country から国データを取り出せる
  sprite.userData = { country };

  return sprite;
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

document.addEventListener("DOMContentLoaded", initApp);
