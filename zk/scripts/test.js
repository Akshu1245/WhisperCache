/**
 * ZK Proof Test Script
 * 
 * Tests the complete ZK proving pipeline:
 * 1. Create a witness (input data)
 * 2. Generate a proof
 * 3. Verify the proof
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const circuitName = process.argv[2] || 'hashVerifier';

async function main() {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║       WhisperCache ZK Proof Test                   ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');
    
    // File paths
    const wasmPath = path.join(BUILD_DIR, `${circuitName}_js`, `${circuitName}.wasm`);
    const zkeyPath = path.join(BUILD_DIR, `${circuitName}.zkey`);
    const vkeyPath = path.join(BUILD_DIR, `${circuitName}_verification_key.json`);
    
    // Check files exist
    if (!fs.existsSync(wasmPath)) {
        console.error(`❌ WASM not found: ${wasmPath}`);
        console.error('   Run "npm run build" first');
        process.exit(1);
    }
    
    if (!fs.existsSync(zkeyPath)) {
        console.error(`❌ Proving key not found: ${zkeyPath}`);
        console.error('   Run "npm run setup" first');
        process.exit(1);
    }
    
    console.log(`Testing circuit: ${circuitName}`);
    console.log('');
    
    try {
        // Prepare test input based on circuit type
        let input;
        
        if (circuitName === 'hashVerifier') {
            // For hashVerifier: we need preimage and its hash
            // First, compute the Poseidon hash of a test value
            const { buildPoseidon } = require('circomlibjs');
            const poseidon = await buildPoseidon();
            
            const preimage = 12345n; // Secret value
            const hashBigInt = poseidon.F.toObject(poseidon([preimage]));
            
            input = {
                preimage: preimage.toString(),
                hash: hashBigInt.toString()
            };
            
            console.log('Test input:');
            console.log(`  preimage (secret): ${preimage}`);
            console.log(`  hash (public):     ${hashBigInt}`);
            
        } else if (circuitName === 'memoryPatternVerifier') {
            // For memoryPatternVerifier
            const { buildPoseidon } = require('circomlibjs');
            const poseidon = await buildPoseidon();
            
            const memoryHash = poseidon.F.toObject(poseidon([BigInt(123456)]));
            const queryHash = poseidon.F.toObject(poseidon([BigInt(789)]));
            
            input = {
                memoryHash: memoryHash.toString(),
                userSecret: "98765",
                salt: "11111",
                queryPatternHash: queryHash.toString(),
                threshold: "50"
            };
            
            console.log('Test input:');
            console.log(`  memoryHash: ${input.memoryHash}`);
            console.log(`  queryPatternHash: ${input.queryPatternHash}`);
            console.log(`  threshold: ${input.threshold}`);
        } else {
            console.error(`Unknown circuit: ${circuitName}`);
            process.exit(1);
        }
        
        console.log('');
        console.log('Step 1/3: Generating proof...');
        const startProve = Date.now();
        
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            wasmPath,
            zkeyPath
        );
        
        const proveTime = Date.now() - startProve;
        console.log(`   ✅ Proof generated in ${proveTime}ms`);
        console.log('');
        console.log('Public signals:', publicSignals);
        
        console.log('');
        console.log('Step 2/3: Loading verification key...');
        const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
        console.log('   ✅ Verification key loaded');
        
        console.log('');
        console.log('Step 3/3: Verifying proof...');
        const startVerify = Date.now();
        
        const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        
        const verifyTime = Date.now() - startVerify;
        console.log(`   ${isValid ? '✅' : '❌'} Proof ${isValid ? 'VALID' : 'INVALID'} (verified in ${verifyTime}ms)`);
        
        console.log('');
        console.log('╔════════════════════════════════════════════════════╗');
        console.log(`║              Test ${isValid ? 'PASSED' : 'FAILED'}!                          ║`);
        console.log('╚════════════════════════════════════════════════════╝');
        console.log('');
        
        if (isValid) {
            console.log('Proof object (can be sent to verifier):');
            console.log(JSON.stringify(proof, null, 2));
        }
        
        process.exit(isValid ? 0 : 1);
        
    } catch (error) {
        console.error('');
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
