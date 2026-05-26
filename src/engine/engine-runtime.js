/**
 * WASMエンジンのロードおよび実行環境を管理するモジュール。
 * 
 * Cross-Origin Isolation (COI) が有効な場合はWeb Workerを用いてマルチスレッドでエンジンを稼働させ、無効な場合はフォールバックとしてシングルスレッドで稼働させる。
 * エンジンの標準入出力のフックや、プロセスの生死監視もここで行う。
 * 
 * 主な役割:
 * - WebAssemblyモジュールの初期化とライフサイクル（起動・終了）の制御
 * - 環境に応じたスレッドモデル（Worker or メイン）の動的切り替え
 */

import { isIOSBrowser } from '../platform/browser.js';
import { reloadForCrossOriginIsolationIfNeeded } from '../platform/coi.js';
import { detectEngineCapabilities, selectEngineURL, createEngineMemoryArgs, locateEngineFile } from './selection.js';
import { createReadyWaiters } from './ready.js';
import { assetURL } from '../config/paths.js';
import { delay } from '../utils/async.js';
import { sendEngineCommand } from './protocol.js';
import { DEBUG_MODE } from '../config/constants.js';

export function createEngineRuntime({ onLine, onStatus, onReady, onExit, onError }) {
    let rapfiProcess = null;
    let rapfiWorker = null;
    let rapfiGeneration = 0;
    
    let isReady = false;
    let isStarting = false;
    let isBusy = false;
    
    let engineIdlePromise = null;
    let engineStopResolver = null;
    
    let currentEngineSupportsThreads = false;
    let currentEngineIsIOS = false;
    
    const readyWaiters = createReadyWaiters();

    function getGeneration() { return rapfiGeneration; }
    function getIsReady() { return isReady; }
    function getIsStarting() { return isStarting; }
    function getIsBusy() { return isBusy; }
    function getSupportsThreads() { return currentEngineSupportsThreads; }
    function getIsIOS() { return currentEngineIsIOS; }

    function markIdle() {
        isBusy = false;
        if (engineStopResolver) {
            engineStopResolver();
            engineStopResolver = null;
        }
    }

    function markIdleAfterSearchOutput() {
        const wasBusy = isBusy;
        markIdle();
        return wasBusy;
    }

    function send(cmd, options = {}) {
        if (!rapfiProcess || !cmd) return;
        const trimmedCmd = cmd.trim();
        if (trimmedCmd === "") return;

        sendEngineCommand(rapfiProcess, trimmedCmd, {
            debugMode: options.debugMode,
            isAnalyzing: options.isAnalyzing,
            onCommand: options.onCommand
        });
    }

    function waitForReady(timeoutMs = 30000) {
        if (isReady) return Promise.resolve(true);
        return readyWaiters.wait(timeoutMs);
    }

    function ensureIdle(timeoutMs = 3000) {
        if (!isBusy) return Promise.resolve(true);
        if (engineIdlePromise) return engineIdlePromise;
        
        if (DEBUG_MODE) console.log("[EngineRuntime DEBUG] Engine is busy, sending YXSTOP and waiting for idle...");
        send("YXSTOP");
        
        engineIdlePromise = new Promise(resolve => {
            engineStopResolver = () => {
                engineIdlePromise = null;
                resolve(true);
            };
            setTimeout(() => {
                if (engineStopResolver) {
                    if (DEBUG_MODE) console.log("[EngineRuntime DEBUG] ensureIdle timed out");
                    engineStopResolver = null;
                    engineIdlePromise = null;
                    resolve(false);
                }
            }, timeoutMs);
        });
        return engineIdlePromise;
    }

    function discard(reason) {
        if (!rapfiProcess && !rapfiWorker && !isStarting) return;
        
        rapfiGeneration++;
        if (DEBUG_MODE) console.log(`[EngineRuntime] Discarding engine: ${reason}`);
        
        if (engineStopResolver) {
            engineStopResolver();
            engineStopResolver = null;
        }
        
        isBusy = false;
        isReady = false;
        isStarting = false;
        
        if (rapfiProcess) {
            try { rapfiProcess.kill(); } catch(e) {}
            rapfiProcess = null;
        } else if (rapfiWorker) {
            try { rapfiWorker.terminate(); } catch(e) {}
            rapfiWorker = null;
        }
    }

    function loadEngineScript(url) {
        return new Promise((resolve, reject) => {
            if (window.Rapfi) return resolve();
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function start() {
        if (isStarting) {
            if (DEBUG_MODE) console.log('[EngineRuntime] start ignored because engine is already starting');
            return;
        }
        isStarting = true;
        isReady = false;

        rapfiGeneration++;
        const currentGeneration = rapfiGeneration;

        if (rapfiWorker) {
            try { rapfiWorker.terminate(); } catch(e) {}
            rapfiWorker = null;
        }
        if (rapfiProcess && typeof rapfiProcess.kill === 'function') {
            rapfiProcess.kill();
        }
        rapfiProcess = null;

        const iosBrowser = isIOSBrowser();
        if (await reloadForCrossOriginIsolationIfNeeded(iosBrowser)) {
            isStarting = false;
            return;
        }

        const capabilities = await detectEngineCapabilities(iosBrowser);
        currentEngineSupportsThreads = capabilities.supportThreads;
        currentEngineIsIOS = iosBrowser;

        const engineURL = selectEngineURL(capabilities);
        if (DEBUG_MODE) console.log(`[EngineRuntime] Using engine: ${engineURL}`);

        const memoryArgs = createEngineMemoryArgs({ supportThreads: currentEngineSupportsThreads, iosBrowser });

        if (currentEngineSupportsThreads) {
            if (DEBUG_MODE) console.log(`[EngineRuntime] Loading engine directly on main thread: ${engineURL}`);
            try {
                await loadEngineScript(engineURL);
            } catch (e) {
                console.error('[Engine error] Failed to load WASM script:', e);
                if (onError) onError('Failed to load script.');
                isStarting = false;
                isReady = false;
                readyWaiters.resolveAll(false);
                return;
            }

            const engineDirURL = engineURL.substring(0, engineURL.lastIndexOf('/') + 1);

            const instantiateSharedWasmMemory = () => {
                let maximum_memory_mb = 2048;
                while (maximum_memory_mb > 512) {
                    try {
                        const memory = new WebAssembly.Memory({
                            initial: 64 * ((1024 * 1024) / 65536),
                            maximum: maximum_memory_mb * ((1024 * 1024) / 65536),
                            shared: true
                        });
                        memory.grow(1);
                        return memory;
                    } catch (e) {
                        maximum_memory_mb /= 2;
                    }
                }
                return new WebAssembly.Memory({
                    initial: 64 * ((1024 * 1024) / 65536),
                    maximum: maximum_memory_mb * ((1024 * 1024) / 65536),
                    shared: true
                });
            };

            let engineInstance;
            try {
                engineInstance = await window.Rapfi({
                    locateFile: (url) => locateEngineFile(url, engineDirURL, engineURL),
                    onReceiveStdout: (o) => {
                        if (currentGeneration !== rapfiGeneration) return;
                        const lines = o.split('\n');
                        for (let line of lines) {
                            line = line.trim();
                            if (line && onLine) onLine(line, currentGeneration);
                        }
                    },
                    onReceiveStderr: (o) => {
                        if (currentGeneration !== rapfiGeneration) return;
                        console.error('[Engine stderr]', o);
                    },
                    onExit: (c) => {
                        if (currentGeneration !== rapfiGeneration) return;
                        if (onExit) onExit(c);
                    },
                    setStatus: (s) => {
                        if (currentGeneration !== rapfiGeneration) return;
                        if (onStatus) onStatus(s);
                    },
                    wasmMemory: instantiateSharedWasmMemory(),
                    mainScriptUrlOrBlob: engineURL,
                });
            } catch (e) {
                console.error('[Engine error] Failed to initialize WASM engine:', e);
                if (onError) onError('Failed to initialize engine.');
                isStarting = false;
                isReady = false;
                readyWaiters.resolveAll(false);
                return;
            }

            rapfiProcess = {
                pid: Date.now(),
                stdin: {
                    write: (cmd) => {
                        const trimmed = cmd.trim();
                        if (trimmed && engineInstance) {
                            engineInstance.sendCommand(trimmed);
                        }
                    }
                },
                kill: () => {
                    engineInstance = null;
                    rapfiProcess = null;
                }
            };

            isBusy = false;
            isStarting = false;
            isReady = true;
            readyWaiters.resolveAll();
            if (onReady) onReady();

        } else {
            if (DEBUG_MODE) console.log(`[EngineRuntime] Loading engine via Web Worker: ${engineURL}`);
            rapfiWorker = new Worker(assetURL('engine-worker.js'));
            rapfiWorker.generation = currentGeneration;

            rapfiProcess = {
                pid: Date.now(),
                stdin: {
                    write: (cmd) => {
                        const trimmed = cmd.trim();
                        if (trimmed && rapfiWorker) {
                            rapfiWorker.postMessage({ type: 'command', data: trimmed });
                        }
                    }
                },
                kill: () => {
                    const workerToKill = rapfiWorker;
                    try { workerToKill?.terminate(); } catch(e) {}
                    if (rapfiWorker === workerToKill) rapfiWorker = null;
                    rapfiProcess = null;
                }
            };

            rapfiWorker.onmessage = (e) => {
                if (currentGeneration !== rapfiGeneration) {
                    if (DEBUG_MODE) console.log(`[EngineRuntime] discard old message from gen ${currentGeneration}`);
                    return;
                }
                const { type, data } = e.data;
                if (type === 'stdout') {
                    const lines = data.split('\n');
                    for (let line of lines) {
                        line = line.trim();
                        if (line && onLine) onLine(line, currentGeneration);
                    }
                } else if (type === 'stderr') {
                    console.error('[Engine stderr]', data);
                } else if (type === 'status') {
                    if (onStatus) onStatus(data);
                } else if (type === 'ready') {
                    isStarting = false;
                    isReady = true;
                    readyWaiters.resolveAll();
                    if (onReady) onReady();
                } else if (type === 'error') {
                    isStarting = false;
                    isReady = false;
                    console.error('[Engine error]', data);
                    readyWaiters.resolveAll(false);
                    if (onError) onError(data);
                } else if (type === 'exit') {
                    isStarting = false;
                    if (onExit) onExit(data);
                }
            };

            rapfiWorker.onerror = (err) => {
                if (currentGeneration !== rapfiGeneration) return;
                isStarting = false;
                isReady = false;
                console.error('[Worker error]', err);
                const detail = err && (err.message || err.type || err.toString()) || 'unknown worker error';
                readyWaiters.resolveAll(false);
                if (onError) onError(detail);
            };

            rapfiWorker.postMessage({
                type: 'engineScriptURL',
                data: { engineURL, memoryArgs }
            });
            isBusy = false;
        }
    }

    async function ensureReady({ fresh = false, reason = "ensure" } = {}) {
        if (fresh) {
            discard(reason);
            await delay(20);
        }

        if (!rapfiProcess || !isReady) {
            if (!isStarting) {
                start();
            }
            const targetGeneration = rapfiGeneration;
            const ready = await waitForReady();
            
            if (!ready) return false;
            
            if (targetGeneration !== rapfiGeneration) {
                if (DEBUG_MODE) console.log(`[EngineRuntime] ensureReady: generation mismatch (expected ${targetGeneration}, got ${rapfiGeneration}). Aborting.`);
                return false;
            }
        }
        return true;
    }

    return {
        getGeneration,
        getIsReady,
        getIsStarting,
        getIsBusy,
        getSupportsThreads,
        getIsIOS,
        setBusy: (val) => { isBusy = val; },
        markIdle,
        markIdleAfterSearchOutput,
        send,
        waitForReady,
        ensureIdle,
        discard,
        start,
        ensureReady
    };
}
