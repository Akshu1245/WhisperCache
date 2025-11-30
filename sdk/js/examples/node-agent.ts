/**
 * Node.js Agent Example
 * 
 * This example shows how to build an AI agent that uses WhisperCache
 * for privacy-preserving memory management.
 * 
 * Run with: npx ts-node examples/node-agent.ts
 */

import { WhisperCacheClient } from '../src/index';

// Configuration
const WHISPERCACHE_URL = process.env.WHISPERCACHE_URL || 'http://localhost:4000';
const API_KEY = process.env.WHISPERCACHE_API_KEY;

async function main() {
  console.log('🧠 WhisperCache Node.js Agent Example\n');

  // Initialize the client
  const client = new WhisperCacheClient({
    baseUrl: WHISPERCACHE_URL,
    apiKey: API_KEY,
    timeout: 30000,
  });

  // Check API health
  console.log('📡 Checking API health...');
  const health = await client.health();
  console.log(`   Status: ${health.status}`);
  console.log(`   Midnight: ${health.networks.midnight.connected ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`   Cardano: ${health.networks.cardano.connected ? '✅ Connected' : '❌ Disconnected'}\n`);

  // Store some memories
  console.log('💾 Storing memories...');
  
  const memories = [
    {
      content: 'User prefers dark mode and minimal UI',
      tags: ['preferences', 'ui'],
      confidence: 0.95,
    },
    {
      content: 'User works in fintech industry',
      tags: ['finance', 'work'],
      confidence: 0.9,
    },
    {
      content: 'User has quarterly health checkups',
      tags: ['health', 'schedule'],
      confidence: 0.85,
    },
  ];

  const storedMemories = [];
  for (const mem of memories) {
    const result = await client.storeMemory(mem);
    storedMemories.push(result);
    console.log(`   ✅ Stored: ${result.id.slice(0, 16)}... [${mem.tags?.join(', ')}]`);
  }
  console.log();

  // Generate ZK proofs
  console.log('🔐 Generating ZK proofs...');
  
  // Prove the fintech memory can be accessed (finance=true, health=false)
  const financeProof = await client.provePolicy({
    commitment: storedMemories[1].commitment,
    policy: 'finance_only',
    pattern: { finance: true, health: false, personal: false },
  });
  
  console.log(`   Finance-only proof: ${financeProof.verified ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`   Allowed for agent: ${financeProof.allowedForAgent ? '✅ Yes' : '❌ No'}`);
  console.log(`   Proof type: ${financeProof.proofData.proofType}`);
  console.log(`   Proof hash: ${financeProof.proofHash.slice(0, 24)}...\n`);

  // Try to prove health memory with no_health_data policy (should deny)
  const healthProof = await client.provePolicy({
    commitment: storedMemories[2].commitment,
    policy: 'no_health_data',
    pattern: { finance: false, health: true, personal: false },
  });
  
  console.log(`   No-health-data proof: ${healthProof.verified ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`   Allowed for agent: ${healthProof.allowedForAgent ? '✅ Yes (unexpected!)' : '❌ No (correct)'}\n`);

  // Query the agent
  console.log('🤖 Querying agent with ZK verification...');
  
  try {
    const queryResult = await client.queryAgent({
      query: 'What are the user preferences and work details?',
      policies: ['no_health_data'],
      includeProofs: true,
    });
    
    console.log(`   Response: ${queryResult.response}`);
    console.log(`   Memories used: ${queryResult.memoriesUsed.length}`);
    console.log(`   Latency: ${queryResult.metadata.latencyMs}ms\n`);
  } catch (error) {
    console.log(`   Query failed (expected if agent endpoint not fully configured)\n`);
  }

  // Anchor a proof to the blockchain
  console.log('⛓️ Anchoring proof to blockchain...');
  
  try {
    const anchor = await client.anchorProof(financeProof.proofHash, {
      network: 'both',
    });
    
    console.log(`   Transaction ID: ${anchor.txId}`);
    console.log(`   Status: ${anchor.status}`);
    console.log(`   Network: ${anchor.network}`);
    if (anchor.explorerUrl) {
      console.log(`   Explorer: ${anchor.explorerUrl}`);
    }
  } catch (error) {
    console.log(`   Anchoring failed (expected in simulation mode)\n`);
  }

  // Get available policies
  console.log('\n📋 Available policies:');
  
  try {
    const policies = await client.getPolicies();
    for (const policy of policies) {
      console.log(`   - ${policy.name}: ${policy.description}`);
    }
  } catch (error) {
    console.log(`   Could not fetch policies\n`);
  }

  console.log('\n✅ Example complete!');
}

// Run the example
main().catch(console.error);
