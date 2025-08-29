/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOV_ADDRESS: string
  readonly VITE_TOKEN_ADDRESS: string
  // add more vars if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
