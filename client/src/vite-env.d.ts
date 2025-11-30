/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_ENABLE_DEBUG: string
  readonly VITE_ENABLE_MOCK_MODE: string
  readonly VITE_KEY_STORAGE_MODE: 'memory' | 'session' | 'persistent'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
