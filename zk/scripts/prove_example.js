/**
 * Memory Pattern Proof Example
 * 
 * Demonstrates generating and verifying a real ZK proof
 * for the memory pattern policy circuit.
 * 
 * Usage: node scripts/prove_example.js
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts', 'memory_pattern');

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║       WhisperCache Memory Pattern Proof Example                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Check if artifacts exist
    const wasmPath = path.join(ARTIFACTS_DIR, 'memory_pattern_js', 'memory_pattern.wasm');
    const zkeyPath = path.join(ARTIFACTS_DIR, 'memory_pattern.zkey');
    const vkeyPath = path.join(ARTIFACTS_DIR, 'memory_pattern_verification_key.json');

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        console.error('❌ Circuit artifacts not found!');
        console.error('   Run "npm run build:zk" first.');
        process.exit(1);
    }

    // Initialize Poseidon
    const { buildPoseidon } = await import('circomlibjs');
    const poseidon = await buildPoseidon();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('EXAMPLE 1: Non-personal memory (should be ALLOWED)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Example 1: Non-personal financial memory
    const memoryContent1 = BigInt('12345678901234567890'); // Simulated memory hash
    const salt1 = BigInt('98765432109876543210');
    
    // Compute the Poseidon commitment
    const commitment1 = poseidon.F.toObject(poseidon([memoryContent1, salt1]));
    
    console.log('');
    console.log('Input (private):');
    console.log(`   memoryContent: ${memoryContent1}`);
    console.log(`   salt: ${salt1}`);
    console.log('');
    console.log('Input (public):');
    console.log(`   memoryCommitment: ${commitment1}`);
    console.log(`   isFinance: 1`);
    console.log(`   isHealth: 0`);
    console.log(`   isPersonal: 0`);
    
    const input1 = {
        memoryContent: memoryContent1.toString(),
        salt: salt1.toString(),
        memoryCommitment: commitment1.toString(),
        isFinance: "1",
        isHealth: "0",
        isPersonal: "0"
    };
    
    console.log('');
    console.log('Generating proof...');
    const startTime1 = Date.now();
    
    const { proof: proof1, publicSignals: signals1 } = await snarkjs.groth16.fullProve(
        input1,
        wasmPath,
        zkeyPath
    );
    
    const proofTime1 = Date.now() - startTime1;
    console.log(`   ✅ Proof generated in ${proofTime1}ms`);
    
    console.log('');
    console.log('Public signals:');
    console.log(`   allowedForAgent: ${signals1[0]}`);
    console.log(`   commitment: ${signals1[1]}`);
    console.log(`   memoryCommitment (input): ${signals1[2]}`);
    console.log(`   isFinance: ${signals1[3]}`);
    console.log(`   isHealth: ${signals1[4]}`);
    console.log(`   isPersonal: ${signals1[5]}`);
    
    // Verify
    console.log('');
    console.log('Verifying proof...');
    const vkey1 = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    const valid1 = await snarkjs.groth16.verify(vkey1, signals1, proof1);
    console.log(`   ${valid1 ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`   Result: Agent access is ${signals1[0] === '1' ? 'ALLOWED ✓' : 'BLOCKED ✗'}`);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('EXAMPLE 2: Personal memory (should be BLOCKED)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Example 2: Personal memory
    const memoryContent2 = BigInt('55555555555555555555');
    const salt2 = BigInt('11111111111111111111');
    const commitment2 = poseidon.F.toObject(poseidon([memoryContent2, salt2]));
    
    console.log('');
    console.log('Input (private):');
    console.log(`   memoryContent: ${memoryContent2}`);
    console.log(`   salt: ${salt2}`);
    console.log('');
    console.log('Input (public):');
    console.log(`   memoryCommitment: ${commitment2}`);
    console.log(`   isFinance: 0`);
    console.log(`   isHealth: 0`);
    console.log(`   isPersonal: 1  <-- Personal flag set!`);
    
    const input2 = {
        memoryContent: memoryContent2.toString(),
        salt: salt2.toString(),
        memoryCommitment: commitment2.toString(),
        isFinance: "0",
        isHealth: "0",
        isPersonal: "1"
    };
    
    console.log('');
    console.log('Generating proof...');
    const startTime2 = Date.now();
    
    const { proof: proof2, publicSignals: signals2 } = await snarkjs.groth16.fullProve(
        input2,
        wasmPath,
        zkeyPath
    );
    
    const proofTime2 = Date.now() - startTime2;
    console.log(`   ✅ Proof generated in ${proofTime2}ms`);
    
    console.log('');
    console.log('Public signals:');
    console.log(`   allowedForAgent: ${signals2[0]}  <-- Should be 0 (blocked)`);
    console.log(`   commitment: ${signals2[1]}`);
    
    // Verify
    console.log('');
    console.log('Verifying proof...');
    const valid2 = await snarkjs.groth16.verify(vkey1, signals2, proof2);
    console.log(`   ${valid2 ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`   Result: Agent access is ${signals2[0] === '1' ? 'ALLOWED ✓' : 'BLOCKED ✗'}`);

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    EXAMPLES COMPLETE! ✅                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Summary:');
    console.log('  • Example 1 (non-personal): allowedForAgent = 1 (ALLOWED)');
    console.log('  • Example 2 (personal):     allowedForAgent = 0 (BLOCKED)');
    console.log('');
    console.log('The ZK proof proves the policy was applied correctly');
    console.log('WITHOUT revealing the actual memory content!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
