import wasm from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import moduleUrl from '../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';

export function configureWasm(env) {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.wasmPaths = {
    wasm: new URL(wasm, self.location.href).href,
    mjs: new URL(moduleUrl, self.location.href).href
  };
}
