var EngineInstance = null;
var WORKER_DEBUG = false;
var commandQueue = [];

function locateFile(url, engineDirURL, engineURL) {
  if (WORKER_DEBUG) console.log(`[Worker DEBUG] locateFile called for: ${url}`);
  if (/^rapfi-single.*\.data$/.test(url) || /rapfi-single.*\.js$/.test(engineURL)) {
    if (/^rapfi.*\.data$/.test(url)) url = 'rapfi-single.data';
  } else if (/^rapfi.*\.data$/.test(url)) {
    url = 'rapfi.data';
  }
  const finalUrl = engineDirURL + url;
  if (WORKER_DEBUG) console.log(`[Worker DEBUG] locateFile resolved to: ${finalUrl}`);
  return finalUrl;
}

function createWasmMemory(memoryArgs) {
  if (!memoryArgs) return undefined;
  const initial = memoryArgs.initial;
  const shared = !!memoryArgs.shared;
  let maximum = memoryArgs.maximum;

  while (maximum >= initial) {
    try {
      return new WebAssembly.Memory({ initial, maximum, shared });
    } catch (err) {
      if (WORKER_DEBUG) console.warn(`[Worker DEBUG] wasmMemory allocation failed at max=${maximum}:`, err);
      maximum = Math.floor(maximum / 2);
    }
  }

  return new WebAssembly.Memory({ initial, shared });
}

const originalPostMessage = self.postMessage;

self.addEventListener('error', (e) => {
  console.trace('[Worker DEBUG TOP-LEVEL ERROR]', e.message, e.filename, e.lineno);
});
self.addEventListener('unhandledrejection', (e) => {
  console.trace('[Worker DEBUG UNHANDLED REJECTION]', e.reason);
});

self.onmessage = function (e) {
  const { type, data } = e.data;

  if (type === 'command') {
    if (EngineInstance) {
      try {
        if (WORKER_DEBUG) console.log(`[Worker DEBUG] Sending command to WASM: "${data}"`);
        EngineInstance.sendCommand(data);
      } catch (err) {
        console.error(`[Worker error] Error sending command:`, err);
        originalPostMessage({ type: 'error', data: err.toString() });
      }
    } else {
      if (WORKER_DEBUG) console.log(`[Worker DEBUG] Engine not ready, queueing command: "${data}"`);
      commandQueue.push(data);
    }
  } else if (type === 'engineScriptURL') {
    if (WORKER_DEBUG) console.log(`[Worker DEBUG] Loading engine script: ${data.engineURL}`);
    const { engineURL, memoryArgs } = data;
    const engineDirURL = engineURL.substring(0, engineURL.lastIndexOf('/') + 1);

    try {
      importScripts(engineURL);
      if (WORKER_DEBUG) console.log(`[Worker DEBUG] Script loaded successfully.`);
    } catch (err) {
      console.error(`[Worker error] Failed to load engine script:`, err);
      originalPostMessage({ type: 'error', data: 'Failed to load Rapfi: ' + err.message });
      return;
    }

    self['Rapfi']({
      locateFile: (url) => locateFile(url, engineDirURL, engineURL),
      onReceiveStdout: (msg) => {
        if (WORKER_DEBUG) console.log(`[Worker DEBUG STDOUT] ${msg}`);
        originalPostMessage({ type: 'stdout', data: msg });
      },
      onReceiveStderr: (msg) => {
        if (WORKER_DEBUG) console.error(`[Worker DEBUG STDERR] ${msg}`);
        originalPostMessage({ type: 'stderr', data: msg });
      },
      onAbort: (msg) => {
        console.trace(`[Worker DEBUG ABORT SOURCE] WASM Aborted: ${msg}`);
        originalPostMessage({ type: 'error', data: 'WASM Aborted: ' + msg });
      },
      noExitRuntime: true,
      mainScriptUrlOrBlob: engineURL,
      onExit: (c) => {
        console.trace(`[Worker DEBUG EXIT SOURCE] WASM Exit code: ${c}`);
        originalPostMessage({ type: 'exit', data: c });
      },
      setStatus: (s) => originalPostMessage({ type: 'status', data: s }),
      wasmMemory: createWasmMemory(memoryArgs),
    }).then((instance) => {
      if (WORKER_DEBUG) console.log(`[Worker DEBUG] WASM instance initialized.`);
      EngineInstance = instance;

      // Hook sendCommand for tracing
      if (typeof instance.sendCommand === 'function') {
          const origSend = instance.sendCommand;
          instance.sendCommand = function(data) {
              console.log(`[Worker DEBUG TRACE] sendCommand called with: ${data}`);
              return origSend(data);
          };
          console.log("[Worker DEBUG] Hooked sendCommand");
      }

      if (commandQueue.length > 0) {
        if (WORKER_DEBUG) console.log(`[Worker DEBUG] Flushing ${commandQueue.length} queued commands`);
        for (var i = 0; i < commandQueue.length; i++) {
          try { 
            const cmd = commandQueue[i];
            if (WORKER_DEBUG) console.log(`[Worker DEBUG] Flushed command: "${cmd}"`);
            instance.sendCommand(cmd);
          } catch (err) {
            console.error(`[Worker error] Error flushing queued command:`, err);
          }
        }
        commandQueue = [];
      }

      originalPostMessage({ type: 'ready' });
    }).catch((err) => {
      originalPostMessage({ type: 'error', data: 'Rapfi init failed: ' + err.message });
    });
  } else if (type !== undefined) {
    // typeがundefinedの場合はEmscriptenの内部スレッド管理メッセージのため無視する
  }
};
