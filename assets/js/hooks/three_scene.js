import * as THREE from 'three';

const ThreeScene = {
    mounted() {
        // ---- 定数 ----
        const cameraHeight = 20;

        // ---- 変数 ----
        let cellsWidth = 0;
        let cellsHeight = 0;
        let allCellObjectMap = {};

        // ---- ワールド作成 ----

        // シーン作成
        const createScene = (background) => {
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(background); // 背景色
            return scene;
        };

        // カメラの作成
        const createCamera = (x, y, z) => {
            // PerspectiveCamera(視野角, アスペクト比, 近クリップ面, 遠クリップ面)
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            // カメラ位置（X、Y、Z）
            camera.position.set(x, y, z);
            return camera;
        };

        // レンダラーの作成
        const createRenderer = () => {
            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(this.el.offsetWidth, this.el.offsetHeight);
            this.el.appendChild(renderer.domElement);
            return renderer;
        };

        // ライトの作成
        // 環境光
        const setAmbientLight = (scene, color, intensity) => {
            // （色、強さ）
            const ambientLight = new THREE.AmbientLight(color, intensity);
            scene.add(ambientLight);
        };
        // 平行光源
        const setDirectionalLight = (scene, color, intensity, x, y, z) => {
            // （色、強さ）
            const directionalLight = new THREE.DirectionalLight(color, intensity);
            // 位置（X軸、Y軸、Z軸）
            directionalLight.position.set(x, y, z);
            scene.add(directionalLight);
        };

        // ウィンドウリサイズ対応
        const setResizeEvent = (camera, renderer) => {
            window.addEventListener("resize", () => {
                camera.aspect = this.el.offsetWidth / this.el.offsetHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(this.el.offsetWidth, this.el.offsetHeight);
            });
        }

        // グリッド表示
        const setGridAndHelper = (scene, gridX, gridZ, axesSize) => {
            // グリッド線を追加（X軸長さ、Z軸長さ）
            const gridHelper = new THREE.GridHelper(gridX, gridZ);
            scene.add(gridHelper);
            // XYZ軸を追加（長さ）
            const axesHelper = new THREE.AxesHelper(axesSize);
            scene.add(axesHelper);
        };

        // ワールドの初期化
        const worldScene = createScene(0x1f1f2f);
        const worldCamera = createCamera(1, cameraHeight, 6);
        const renderer = createRenderer();
        setResizeEvent(worldCamera, renderer);
        setGridAndHelper(worldScene, 50, 50, 50);
        setAmbientLight(worldScene, 0xafafaf, 1);
        setDirectionalLight(worldScene, 0xffffff, 1, 1, 15, 1);

        // ---- オブジェクト作成 ----

        // セルのマテリアル色を更新
        const updateCellMaterialColor = (material, h, alive) => {
            // （色相、彩度、輝度）
            material.color.setHSL(h, .95, alive ? .7 : .5);
            // 透明度
            material.opacity = alive ? .9 : .5;
        };

        // 立方体の作成
        const createCube = (geometry, x, y, z, alive, edges, lineMaterial) => {
            const material = new THREE.MeshStandardMaterial({
                transparent: true,      // 透明度を有効
                alphaToCoverage: true,  // α値を有効
                opacity: .5,            // 不透明度
                side: THREE.DoubleSide, // 裏面描画
                roughness: .2,          // ツヤ
                metalness: .4,          // 金属感
            });
            // 初期の輝度
            updateCellMaterialColor(material, 0.0, alive);
            // 立方体
            const cube = new THREE.Mesh(geometry, material);
            cube.userData.currentHue = 0.0;
            // 配置
            cube.position.x = x;
            cube.position.y = y;
            cube.position.z = z;
            // エッジの追加
            const wireframe = new THREE.LineSegments(edges, lineMaterial);
            cube.add(wireframe);
            // 返す
            return cube;
        };

        // 連想配列キー取得
        // X軸値とY軸値を座標表現で文字列化
        const cellKey = (x, y) => `${x},${y}`;

        // X値とY値を取得
        const getXYFromKey = (key) => {
            const pos = key.split(",");
            if (pos.length < 2) {
                return { 'x': 0, 'y': 0 };
            }
            const x = parseInt(pos[0]);
            const y = parseInt(pos[1]);
            return { 'x': x, 'y': y };
        }

        // 立方体群の生成
        const createCubeMap = (scene, w, h) => {
            const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const edges = new THREE.EdgesGeometry(geometry);
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0x7f7f7f });
            const cells = {};
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let cell = {};
                    const shapeX = x - (w / 2);
                    const shapeZ = y - (h / 2);
                    let alive = true;
                    cell.alive = alive;
                    cell.shape = createCube(geometry, shapeX, 0, shapeZ, alive, edges, lineMaterial);
                    scene.add(cell.shape);
                    // 変数追加
                    cell.shape.userData.timer = 0.0;
                    cell.shape.userData.cellX = x;
                    cell.shape.userData.cellY = y;
                    // 登録
                    const key = cellKey(x, y);
                    cells[key] = cell;
                }
            }
            return cells;
        };

        // ---- Elixirイベント定義 ----

        // セルの縦横個数を取得
        this.handleEvent("sendCellCount", (size) => {
            cellsWidth = size.w;
            cellsHeight = size.h;
            allCellObjectMap = createCubeMap(worldScene, cellsWidth, cellsHeight);
        });

        // セルの生死状態マップを取得
        this.handleEvent("sendCellAliveMap", (cells) => {
            aliveMap = cells.cells;
            // キューブのループ
            for (let key in allCellObjectMap) {
                if (allCellObjectMap.hasOwnProperty(key)) {
                    // 生死状態
                    let cell = allCellObjectMap[key];
                    if (aliveMap.hasOwnProperty(key)) {
                        // キーが一致するセルの生死状態を更新
                        cell.alive = aliveMap[key];
                    }
                }
            }
        });

        // ---- アニメーション ----

        let frames = 0;
        let prevTime = performance.now();
        // FPSをscene_live.exに送信
        const sendNowFps = () => {
            frames += 1;
            const time = performance.now();
            // 秒ごとに実行
            if (time >= prevTime + 1000) {
                const fpsFloat = (frames * 1000) / (time - prevTime);
                const fps = Math.round(fpsFloat * 100) / 100;
                // Elixir側にイベントを送信
                this.pushEvent("updateFps", { fps: fps });
                // リセット
                frames = 0;
                prevTime = time;
            }
        }

        // カメラアニメーション
        const animateCamera = (camera, radius, elapsed, speed, height) => {
            // 円運動の計算 (三角関数)
            // z = 半径 * cos(時間 * 速度)
            // x = 半径 * sin(時間 * 速度)
            camera.position.z = radius * Math.cos(elapsed * speed);
            camera.position.x = radius * Math.sin(elapsed * speed);
            camera.position.y = height + Math.sin(elapsed * 0.5) * 2; // 上下揺らし
            // 常に中心を向くようにする
            camera.lookAt(0, 0, 0);
        }

        const clock = new THREE.Clock();
        // アニメーションループ
        const animate = () => {
            this.animationFrame = requestAnimationFrame(animate);
            // 立方体の更新
            for (let key in allCellObjectMap) {
                if (allCellObjectMap.hasOwnProperty(key)) {
                    let cell = allCellObjectMap[key];
                    let cube = cell.shape;
                    // 色更新
                    cube.userData.currentHue += 0.002;
                    updateCellMaterialColor(cube.material, cube.userData.currentHue, cell.alive);
                    // 座標変換
                    if (cell.alive) {
                        const keyPos = getXYFromKey(key);
                        const distance = Math.abs(keyPos.x - cellsWidth / 2) + Math.abs(keyPos.y - cellsHeight / 2);
                        const posY = (cellsHeight / 2 - distance) / 2.5;
                        cube.position.y = posY;
                    } else {
                        cube.position.y = 0.0;
                    }
                }
            }
            // カメラ更新
            const elapsed = clock.getElapsedTime(); // 起動からの総経過時間を取得
            animateCamera(worldCamera, 10, elapsed, .25, cameraHeight);
            // FPS送信
            sendNowFps();
            // 描画実行
            renderer.render(worldScene, worldCamera);
        };
        animate();
    },

    destroyed() {
        // メモリリーク防止のため、要素が削除されたらアニメーションを停止
        cancelAnimationFrame(this.animationFrame);
    }
};

export default ThreeScene;