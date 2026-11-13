interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_BUILD?: string
}

// package.json's version, put in by vite.config.ts.
declare const __APP_VERSION__: string

// Where LiteRT.js's WASM files are served, /litert/<its version>/, put in by vite.config.ts.
declare const __LITERT_WASM_DIR__: string
