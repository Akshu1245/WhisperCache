/**
 * WhisperCache Shared Types
 */

export interface MemoryEntry {
  id: string
  content: string
  tag: string
}

export interface ZKResponse {
  result: string
  confidence: number
  proofHash: string
  pattern?: string
  query?: string
  timestamp?: string
}

export interface ZKProveRequest {
  query: string
  memoryHashes: string[]
}

export interface EncryptedMemoryBlob {
  ciphertext: string
  nonce: string
  encryptedAt: string
  version: number
}

export interface AnchorRequest {
  memoryHash: string
  proofHash: string
  keyId: string
}

export interface AnchorResponse {
  txId: string
  status: 'pending' | 'confirmed' | 'failed'
  blockHeight?: number
  timestamp: string
}

export interface ComplianceLog {
  id: string
  action: 'create' | 'access' | 'delete' | 'proof' | 'rotate_key'
  memoryId?: string
  keyId: string
  timestamp: string
  metadata?: Record<string, unknown>
}
