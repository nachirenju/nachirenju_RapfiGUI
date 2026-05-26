/**
 * ドラッグ可能なフローティングウィンドウのレイアウト・移動制御モジュール。
 * 
 * マウスやタッチイベントによるドラッグ＆ドロップ実装を提供し、境界チェックや最小化アクションを処理する。
 * 
 * 主な役割:
 * - カスタムウィンドウUIの位置・サイズ状態の管理
 * - ドラッグ操作時のパフォーマンス最適化
 */

// Floating window drag/resize helpers extracted from the former inline frontend script.

export function initializeFloatingWindows() {
    function initTouchDragWindow(winId, headerId) {
        const win = document.getElementById(winId);
        const header = document.getElementById(headerId);
        if (!win || !header) return;

        let dragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;

        header.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            if (win.dataset.maximized === 'true') return;
            const touch = e.touches[0];
            if (!touch) return;
            dragging = true;
            startX = touch.clientX;
            startY = touch.clientY;
            const rect = win.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            win.style.left = `${initialLeft}px`;
            win.style.top = `${initialTop}px`;
            win.style.right = 'auto';
            win.style.bottom = 'auto';
            e.preventDefault();
        }, { passive: false });

        header.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const touch = e.touches[0];
            if (!touch) return;
            win.style.left = `${initialLeft + touch.clientX - startX}px`;
            win.style.top = `${initialTop + touch.clientY - startY}px`;
            e.preventDefault();
        }, { passive: false });

        header.addEventListener('touchend', () => {
            dragging = false;
        });
    }

    initTouchDragWindow('graph-container', 'graph-header');
    initTouchDragWindow('stats-container', 'stats-window-header');
    initTouchDragWindow('pv-container', 'pv-header');
    
    // --- Window Draggable / Resizable Logic ---

    // --- 読み筋プレビューウィンドウのドラッグ機能 ---
function initDraggablePvWindow() {
    const win = document.getElementById("pv-container");
    const header = document.getElementById("pv-header");
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.onmousedown = function(e) {
        if (e.target.tagName === 'BUTTON') return; // 閉じるボタン誤爆防止
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = win.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        document.onmouseup = stopDrag;
        document.onmousemove = doDrag;
    };

    function doDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        win.style.left = (initialLeft + dx) + "px";
        win.style.top = (initialTop + dy) + "px";
        win.style.bottom = "auto"; // ドラッグ時はbottom指定を解除
        win.style.right = "auto";
    }

    function stopDrag() {
        isDragging = false;
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// --- 読み筋プレビューウィンドウのリサイズ機能 ---
function initResizablePvWindow() {
    const win = document.getElementById("pv-container");
    const resizers = win.querySelectorAll(".g-resizer");
    
    let currentDir = null; 
    let startX, startY, startWidth, startHeight, startTop, startLeft;

    resizers.forEach(r => {
        r.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation(); // ドラッグ移動を防止

            if (e.target.classList.contains("g-resizer-t")) currentDir = "t";
            else if (e.target.classList.contains("g-resizer-r")) currentDir = "r";
            else if (e.target.classList.contains("g-resizer-tr")) currentDir = "tr";

            startX = e.clientX;
            startY = e.clientY;

            const rect = win.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            startTop = rect.top;
            startLeft = rect.left;

            // 位置を top/left で固定
            win.style.top = startTop + "px";
            win.style.left = startLeft + "px";
            win.style.bottom = "auto";
            win.style.right = "auto";
            win.style.width = startWidth + "px";
            win.style.height = startHeight + "px";

            document.addEventListener("mousemove", performResize);
            document.addEventListener("mouseup", stopResize);
        });
    });

    function performResize(e) {
        if (!currentDir) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // 右方向への拡大（幅変更）
        if (currentDir === "r" || currentDir === "tr") {
            const newWidth = Math.max(250, startWidth + dx); // 最小幅250px
            win.style.width = newWidth + "px";
        }

        // 上方向への拡大（高さ変更 + Top位置変更）
        if (currentDir === "t" || currentDir === "tr") {
            const newHeight = Math.max(150, startHeight - dy); // 最小高さ150px
            const effectiveChange = newHeight - startHeight;
            const newTop = startTop - effectiveChange;

            win.style.height = newHeight + "px";
            win.style.top = newTop + "px";
        }
    }

    function stopResize() {
        currentDir = null;
        document.removeEventListener("mousemove", performResize);
        document.removeEventListener("mouseup", stopResize);
    }
}

// 実行
if (document.getElementById("pv-container")) {
    initDraggablePvWindow();
    initResizablePvWindow();
}

    function initDraggableWindow() {
        const win = document.getElementById("stats-container");
        const header = document.getElementById("stats-window-header");
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        header.onmousedown = function(e) {
            if (e.target.tagName === 'BUTTON') return;
            if (win.dataset.maximized === 'true') return;
            e.preventDefault(); isDragging = true; startX = e.clientX; startY = e.clientY;
            const rect = win.getBoundingClientRect();
            initialLeft = rect.left; initialTop = rect.top;
            document.onmouseup = stopDrag; document.onmousemove = doDrag;
        };
        function doDrag(e) {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.clientX - startX; const dy = e.clientY - startY;
            win.style.left = (initialLeft + dx) + "px"; win.style.top = (initialTop + dy) + "px"; win.style.right = 'auto';
        }
        function stopDrag() { isDragging = false; document.onmouseup = null; document.onmousemove = null; }
    }
    if (document.getElementById("stats-container")) { initDraggableWindow(); }

    function initResizableWindow() {
        const win = document.getElementById("stats-container");
        const resizers = win.querySelectorAll(".resizer");
        let startX, startY, startWidth, startHeight, startLeft, startTop;
        for (let resizer of resizers) { resizer.addEventListener("mousedown", initResize); }
        function initResize(e) {
            if (win.dataset.maximized === 'true') return;
            e.preventDefault(); e.stopPropagation(); 
            startX = e.clientX; startY = e.clientY;
            const rect = win.getBoundingClientRect();
            startWidth = rect.width; startHeight = rect.height; startLeft = rect.left; startTop = rect.top;
            const isLeft = e.target.classList.contains("resizer-l");
            const isTop = e.target.classList.contains("resizer-t");
            const isCorner = e.target.classList.contains("resizer-tl");
            const isBottom = e.target.classList.contains("resizer-b"); 
            const doResize = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                if (isLeft || isCorner) {
                    const newWidth = Math.max(250, startWidth - dx);
                    const widthChange = startWidth - newWidth;
                    const newLeft = startLeft + widthChange; 
                    win.style.width = newWidth + "px"; win.style.left = newLeft + "px";
                }
                if (isTop || isCorner) {
                    const newHeight = Math.max(150, startHeight - dy);
                    const heightChange = startHeight - newHeight;
                    const newTop = startTop + heightChange;
                    win.style.height = newHeight + "px"; win.style.top = newTop + "px";
                }
                if (isBottom) {
                    const newHeight = Math.max(150, startHeight + dy);
                    win.style.height = newHeight + "px";
                }
                win.style.right = 'auto';
            };
            const stopResize = () => { document.removeEventListener("mousemove", doResize); document.removeEventListener("mouseup", stopResize); };
            document.addEventListener("mousemove", doResize); document.addEventListener("mouseup", stopResize);
        }
    }
    if (document.getElementById("stats-container")) { initResizableWindow(); }

    window.onclick = function(event) {
        const modals = [
            document.getElementById('loadModal'),
            document.getElementById('engineModal'),
            document.getElementById('quizModal'),
            document.getElementById('pvReviewModal'),
            document.getElementById('analysisModal') 
        ];
        modals.forEach(modal => { if (event.target === modal) { modal.style.display = "none"; } });
    }
    
    // --- 評価値グラフのドラッグ機能 ---
    function initDraggableGraph() {
        const win = document.getElementById("graph-container");
        const header = document.getElementById("graph-header");
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.onmousedown = function(e) {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // 現在の位置を取得（初回はCSSの値、移動後はstyle属性の値）
            const rect = win.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            document.onmouseup = stopDrag;
            document.onmousemove = doDrag;
        };

        function doDrag(e) {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            win.style.left = (initialLeft + dx) + "px";
            win.style.top = (initialTop + dy) + "px";
            // bottom指定を解除してtop指定で動くようにする
            win.style.bottom = "auto";
        }

        function stopDrag() {
            isDragging = false;
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // 初期化実行 (要素が存在すれば)
    if (document.getElementById("graph-container")) {
        initDraggableGraph();
    }
    
    // --- 評価値グラフのリサイズ機能 ---
function initResizableGraph() {
    const win = document.getElementById("graph-container");
    const resizers = win.querySelectorAll(".g-resizer");
    let startX, startY, startWidth, startHeight, startTop, startLeft;

    for (let resizer of resizers) {
        resizer.addEventListener("mousedown", initResize);
    }

    function initResize(e) {
        e.preventDefault();
        e.stopPropagation(); // ドラッグ移動と競合しないように止める

        startX = e.clientX;
        startY = e.clientY;

        // 計算のために現在のスタイルを取得
        const rect = win.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        startTop = rect.top;
        startLeft = rect.left;

        // bottom指定などで固定されている場合、スムーズに動かないため top/left 指定に固定化する
        win.style.top = startTop + "px";
        win.style.left = startLeft + "px";
        win.style.bottom = "auto";
        win.style.right = "auto";

        window.addEventListener("mousemove", doResize);
        window.addEventListener("mouseup", stopResize);
    }

    function doResize(e) {
        // どのハンドルを持っているか判定
        // (イベントリスナーはwindowに付いているため、e.targetは使わずクラス変数やクロージャで管理もできますが、
        //  ここでは簡易的にアクティブなリサイザーを特定する仕組みにするか、
        //  initResizeで押された要素を記憶するのが一般的です)
        // 今回はシンプルにするため、マウスダウン時のターゲット要素をクロージャで参照します。
        // ※実装の都合上、initResize内でリスナー定義をラップします。
    }

    // 上記だと引数が渡せないので、構造を変えます
}

// ★修正版の実装はこちらを使用してください★
function initResizableGraphFixed() {
    const win = document.getElementById("graph-container");
    const resizers = win.querySelectorAll(".g-resizer");
    
    // 現在操作中のリサイズ方向
    let currentDir = null; 
    let startX, startY, startWidth, startHeight, startTop, startLeft;

    resizers.forEach(r => {
        r.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation(); // ドラッグ移動を防止

            // 方向の特定
            if (e.target.classList.contains("g-resizer-t")) currentDir = "t";
            else if (e.target.classList.contains("g-resizer-r")) currentDir = "r";
            else if (e.target.classList.contains("g-resizer-tr")) currentDir = "tr";

            startX = e.clientX;
            startY = e.clientY;

            const rect = win.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            startTop = rect.top;
            startLeft = rect.left;

            // 位置を top/left で固定（bottom依存を解除）
            win.style.top = startTop + "px";
            win.style.left = startLeft + "px";
            win.style.bottom = "auto";
            win.style.width = startWidth + "px";
            win.style.height = startHeight + "px";

            document.addEventListener("mousemove", performResize);
            document.addEventListener("mouseup", stopResize);
        });
    });

    function performResize(e) {
        if (!currentDir) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // 右方向への拡大（幅変更）
        if (currentDir === "r" || currentDir === "tr") {
            const newWidth = Math.max(300, startWidth + dx); // 最小幅300
            win.style.width = newWidth + "px";
        }

        // 上方向への拡大（高さ変更 + Top位置変更）
        if (currentDir === "t" || currentDir === "tr") {
            // 上に伸ばす = 高さが増える & Topが減る
            // dyがマイナス（上移動）なら高さは増える
            const newHeight = Math.max(200, startHeight - dy); // 最小高さ200
            
            // 高さが変わった分だけTopをずらす（底辺を固定したように見せるため）
            // 最小サイズ制限にかかった場合はTopを動かさないように計算が必要
            const effectiveChange = newHeight - startHeight;
            const newTop = startTop - effectiveChange;

            win.style.height = newHeight + "px";
            win.style.top = newTop + "px";
        }
        
        // Chart.jsはコンテナサイズ変更を検知して自動リサイズされます（responsive: trueのため）
    }

    function stopResize() {
        currentDir = null;
        document.removeEventListener("mousemove", performResize);
        document.removeEventListener("mouseup", stopResize);
    }
}

// 実行
if (document.getElementById("graph-container")) {
    initResizableGraphFixed();
}
    //詳細設定の初期値戻し

}
