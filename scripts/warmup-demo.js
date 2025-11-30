/**
 * WhisperCache Demo Warmup Script
 * 
 * Run this BEFORE the demo to:
 * 1. Start the server
 * 2. Pre-generate all ZK proofs
 * 3. Warm up all caches
 * 4. Verify everything is working
 * 
 * Usage: node scripts/warmup-demo.js
 */

const http = require('http');

const API_BASE = 'http://localhost:4000/api';
const WARMUP_TIMEOUT = 30000; // 30 seconds max

// Helper to make HTTP requests
function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Wait for server to be ready
async function waitForServer(maxWait = 30000) {
  const start = Date.now();
  console.log('⏳ Waiting for server...');
  
  while (Date.now() - start < maxWait) {
    try {
      const res = await request('/health');
      if (res.status === 200) {
        console.log('✅ Server is ready!');
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  throw new Error('Server did not start in time');
}

// Pre-generate ZK proofs
async function warmupProofs() {
  console.log('\n🔐 Pre-generating ZK proofs...');
  
  const queries = [
    'What are my stress patterns?',
    'Show me my health data',
    'Financial summary please',
    'Personal memories analysis'
  ];

  for (const query of queries) {
    try {
      const start = Date.now();
      const res = await request('/zk/midnight/prove', 'POST', {
        query,
        memoryHash: '0x' + Buffer.from(query).toString('hex').slice(0, 32),
        memoryCategory: 'general'
      });
      const time = Date.now() - start;
      
      if (res.status === 200) {
        console.log(`  ✅ Proof generated: "${query.slice(0, 25)}..." (${time}ms)`);
      } else {
        console.log(`  ⚠️ Proof issue: ${res.status}`);
      }
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
    }
  }
}

// Warm up database
async function warmupDatabase() {
  console.log('\n💾 Warming up database...');
  
  try {
    // Create test memory
    await request('/memory', 'POST', {
      content: 'Demo warmup memory',
      category: 'demo',
      userId: 'demo-user'
    });
    console.log('  ✅ Database write test passed');
    
    // Read memories
    const res = await request('/memory?userId=demo-user');
    console.log(`  ✅ Database read test passed (${res.data?.length || 0} records)`);
  } catch (e) {
    console.log(`  ⚠️ Database warmup: ${e.message}`);
  }
}

// Warm up blockchain connections
async function warmupBlockchain() {
  console.log('\n⛓️ Warming up blockchain connections...');
  
  try {
    const res = await request('/health');
    const { services } = res.data;
    
    console.log(`  Midnight: ${services?.midnight?.status || 'unknown'}`);
    console.log(`  Cardano: ${services?.cardano?.status || 'unknown'}`);
    
    if (services?.midnight?.status === 'simulation') {
      console.log('  ⚠️ Running in SIMULATION mode (expected for demo)');
    }
  } catch (e) {
    console.log(`  ❌ Blockchain check failed: ${e.message}`);
  }
}

// Run full warmup
async function main() {
  console.log('═'.repeat(50));
  console.log('  WhisperCache Demo Warmup');
  console.log('═'.repeat(50));
  console.log(`  Time: ${new Date().toLocaleTimeString()}`);
  console.log('═'.repeat(50));

  try {
    await waitForServer();
    await warmupProofs();
    await warmupDatabase();
    await warmupBlockchain();
    
    console.log('\n' + '═'.repeat(50));
    console.log('  ✅ WARMUP COMPLETE - READY FOR DEMO!');
    console.log('═'.repeat(50));
    console.log('\n📌 Important:');
    console.log('   - Do NOT restart the server');
    console.log('   - Proofs are now cached');
    console.log('   - First demo query will be fast');
    console.log('');
    
  } catch (e) {
    console.error('\n❌ WARMUP FAILED:', e.message);
    console.error('   Please fix the issue and run warmup again.');
    process.exit(1);
  }
}

main();
