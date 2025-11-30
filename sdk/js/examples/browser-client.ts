/**
 * Browser Client Example
 * 
 * This example shows how to use WhisperCache SDK in a browser environment.
 * Can be used with React, Vue, or vanilla JavaScript.
 * 
 * Build and serve with a bundler like Vite or webpack.
 */

import { WhisperCacheClient, WhisperCacheError } from '../src/index';

// Initialize the client
const client = new WhisperCacheClient({
  baseUrl: 'http://localhost:4000', // Or your production URL
  timeout: 15000,
});

// ============================================
// React Hook Example
// ============================================

/**
 * Custom hook for using WhisperCache in React
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { storeMemory, provePolicy, loading, error } = useWhisperCache();
 *   
 *   const handleStore = async () => {
 *     const memory = await storeMemory({
 *       content: 'User clicked the button',
 *       tags: ['interaction']
 *     });
 *     console.log('Stored:', memory.id);
 *   };
 *   
 *   return <button onClick={handleStore}>Store Memory</button>;
 * }
 * ```
 */
export function useWhisperCache() {
  // In a real React app, you'd use useState and useCallback here
  // This is a simplified example
  
  return {
    client,
    
    storeMemory: async (request: Parameters<typeof client.storeMemory>[0]) => {
      return client.storeMemory(request);
    },
    
    provePolicy: async (request: Parameters<typeof client.provePolicy>[0]) => {
      return client.provePolicy(request);
    },
    
    queryAgent: async (request: Parameters<typeof client.queryAgent>[0]) => {
      return client.queryAgent(request);
    },
    
    health: async () => {
      return client.health();
    },
  };
}

// ============================================
// Vanilla JavaScript Example
// ============================================

/**
 * Example: Store a user preference
 */
async function storeUserPreference(preference: string, category: string) {
  try {
    const memory = await client.storeMemory({
      content: preference,
      tags: [category, 'user-preference'],
      confidence: 1.0,
    });
    
    console.log('Stored preference:', memory.id);
    return memory;
  } catch (error) {
    if (error instanceof WhisperCacheError) {
      console.error('API Error:', error.message, error.statusCode);
    } else {
      console.error('Error:', error);
    }
    throw error;
  }
}

/**
 * Example: Verify memory access is privacy-compliant
 */
async function verifyPrivacyCompliance(commitment: string) {
  try {
    const proof = await client.provePolicy({
      commitment,
      policy: 'gdpr_compliant',
      pattern: { finance: false, health: false, personal: true },
    });
    
    if (proof.verified && proof.allowedForAgent) {
      console.log('✅ Memory access is GDPR compliant');
      return true;
    } else {
      console.log('❌ Memory access would violate GDPR');
      return false;
    }
  } catch (error) {
    console.error('Compliance check failed:', error);
    return false;
  }
}

/**
 * Example: Query agent with privacy guarantees
 */
async function askAgent(question: string) {
  try {
    const result = await client.queryAgent({
      query: question,
      policies: ['no_health_data', 'gdpr_compliant'],
      includeProofs: true,
    });
    
    console.log('Agent response:', result.response);
    console.log('Memories used:', result.memoriesUsed.length);
    console.log('Proofs:', result.proofs?.length || 0);
    
    return result;
  } catch (error) {
    console.error('Agent query failed:', error);
    throw error;
  }
}

// ============================================
// UI Integration Example
// ============================================

/**
 * Example: Create a simple memory input UI
 */
function createMemoryUI() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div style="max-width: 400px; margin: 20px auto; font-family: system-ui;">
      <h2>🧠 WhisperCache Memory</h2>
      
      <div style="margin-bottom: 10px;">
        <label>Memory Content:</label>
        <textarea id="memory-content" rows="3" style="width: 100%; padding: 8px;"></textarea>
      </div>
      
      <div style="margin-bottom: 10px;">
        <label>Tags (comma-separated):</label>
        <input id="memory-tags" type="text" style="width: 100%; padding: 8px;" placeholder="work, preferences">
      </div>
      
      <button id="store-btn" style="padding: 10px 20px; background: #00bcd4; color: white; border: none; cursor: pointer;">
        Store Memory
      </button>
      
      <div id="result" style="margin-top: 15px; padding: 10px; border-radius: 4px;"></div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  // Add event listener
  document.getElementById('store-btn')?.addEventListener('click', async () => {
    const content = (document.getElementById('memory-content') as HTMLTextAreaElement)?.value;
    const tagsInput = (document.getElementById('memory-tags') as HTMLInputElement)?.value;
    const resultDiv = document.getElementById('result');
    
    if (!content) {
      if (resultDiv) resultDiv.innerHTML = '<span style="color: red;">Please enter content</span>';
      return;
    }
    
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    
    try {
      const memory = await client.storeMemory({
        content,
        tags,
        confidence: 1.0,
      });
      
      if (resultDiv) {
        resultDiv.innerHTML = `
          <span style="color: green;">✅ Memory stored!</span><br>
          <small>ID: ${memory.id}</small><br>
          <small>Hash: ${memory.contentHash.slice(0, 24)}...</small>
        `;
      }
    } catch (error) {
      if (resultDiv) {
        resultDiv.innerHTML = `<span style="color: red;">❌ Error: ${error}</span>`;
      }
    }
  });
}

// ============================================
// Network Status Component
// ============================================

/**
 * Example: Create a network status indicator
 */
async function createNetworkStatus() {
  const container = document.createElement('div');
  container.id = 'network-status';
  container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 10px; background: #1a1a1a; border-radius: 8px; color: white; font-size: 12px;';
  
  document.body.appendChild(container);
  
  async function updateStatus() {
    try {
      const health = await client.health();
      
      container.innerHTML = `
        <div>🌐 WhisperCache</div>
        <div style="margin-top: 5px;">
          <span style="color: ${health.networks.midnight.connected ? '#4caf50' : '#f44336'}">●</span>
          Midnight ${health.networks.midnight.latency}ms
        </div>
        <div>
          <span style="color: ${health.networks.cardano.connected ? '#4caf50' : '#f44336'}">●</span>
          Cardano ${health.networks.cardano.latency}ms
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div>🌐 WhisperCache</div>
        <div style="color: #f44336;">❌ Disconnected</div>
      `;
    }
  }
  
  // Update every 30 seconds
  updateStatus();
  setInterval(updateStatus, 30000);
}

// Export for use in other modules
export {
  client,
  storeUserPreference,
  verifyPrivacyCompliance,
  askAgent,
  createMemoryUI,
  createNetworkStatus,
};
