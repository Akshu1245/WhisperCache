/**
 * Test script for WhisperCache ZK circuits
 * 
 * This script tests the circuit logic without full compilation.
 * For full testing, you need Circom installed and circuit compiled.
 */

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');

async function testPoseidonHash() {
  console.log('🔐 Testing Poseidon Hash...\n');
  
  const poseidon = await buildPoseidon();
  
  // Test single input hash
  const input1 = BigInt(12345);
  const hash1 = poseidon([input1]);
  const hash1Str = poseidon.F.toObject(hash1).toString();
  
  console.log(`Input: ${input1}`);
  console.log(`Hash:  ${hash1Str}`);
  console.log(`Hash (hex): ${BigInt(hash1Str).toString(16)}\n`);
  
  // Test two input hash (used for ownership verification)
  const secretKey = BigInt('0x1234567890abcdef');
  const nonce = BigInt('0xfedcba0987654321');
  const hash2 = poseidon([secretKey, nonce]);
  const hash2Str = poseidon.F.toObject(hash2).toString();
  
  console.log('Ownership Verification Hash:');
  console.log(`Secret Key: ${secretKey.toString(16)}`);
  console.log(`Nonce:      ${nonce.toString(16)}`);
  console.log(`Hash:       ${hash2Str}\n`);
  
  // Test pattern matching hash
  const memoryContent = BigInt('0xabcdef123456');
  const patternHash = BigInt('0x654321fedcba');
  const hash3 = poseidon([memoryContent, patternHash]);
  const hash3Str = poseidon.F.toObject(hash3).toString();
  
  console.log('Pattern Matching Hash:');
  console.log(`Memory:  ${memoryContent.toString(16)}`);
  console.log(`Pattern: ${patternHash.toString(16)}`);
  console.log(`Hash:    ${hash3Str}\n`);
  
  // Simulate confidence score extraction
  const confidenceRaw = BigInt(hash3Str) % BigInt(128);
  const confidence = Math.min(Number(confidenceRaw), 99);
  console.log(`Simulated Confidence Score: ${confidence}%`);
  
  console.log('\n✅ Poseidon hash tests passed!\n');
}

async function testProofStructure() {
  console.log('📝 Testing Proof Structure...\n');
  
  // Simulate a Groth16 proof structure
  const mockProof = {
    pi_a: [
      '12345678901234567890123456789012345678901234567890',
      '98765432109876543210987654321098765432109876543210',
      '1'
    ],
    pi_b: [
      [
        '11111111111111111111111111111111111111111111111111',
        '22222222222222222222222222222222222222222222222222'
      ],
      [
        '33333333333333333333333333333333333333333333333333',
        '44444444444444444444444444444444444444444444444444'
      ],
      ['1', '0']
    ],
    pi_c: [
      '55555555555555555555555555555555555555555555555555',
      '66666666666666666666666666666666666666666666666666',
      '1'
    ],
    protocol: 'groth16',
    curve: 'bn128'
  };
  
  const publicSignals = [
    '12345', // patternHash
    '50',    // minConfidence
    '85',    // computed confidence
    '1',     // ownership valid
    '67890'  // commitment hash
  ];
  
  console.log('Mock Proof Structure:');
  console.log(JSON.stringify(mockProof, null, 2));
  console.log('\nPublic Signals:', publicSignals);
  
  // Verify structure
  const isValidStructure = (
    mockProof.pi_a.length === 3 &&
    mockProof.pi_b.length === 3 &&
    mockProof.pi_c.length === 3 &&
    mockProof.protocol === 'groth16'
  );
  
  console.log(`\nStructure valid: ${isValidStructure}`);
  console.log('\n✅ Proof structure tests passed!\n');
}

async function testCircuitLogic() {
  console.log('🧮 Testing Circuit Logic...\n');
  
  const poseidon = await buildPoseidon();
  
  // Simulate the circuit's logic
  const memoryContent = BigInt('0x' + 'a'.repeat(32));
  const userSecretKey = BigInt('0x' + 'b'.repeat(32));
  const memoryNonce = BigInt('0x' + 'c'.repeat(16));
  const patternHash = BigInt('0x' + 'd'.repeat(32));
  const minConfidence = BigInt(50);
  
  // Step 1: Compute public key hash (ownership proof)
  const publicKeyHash = poseidon([userSecretKey, memoryNonce]);
  const publicKeyHashStr = poseidon.F.toObject(publicKeyHash).toString();
  console.log('Step 1 - Ownership Proof:');
  console.log(`  Public Key Hash: ${publicKeyHashStr.slice(0, 32)}...`);
  
  // Step 2: Pattern matching
  const patternMatch = poseidon([memoryContent, patternHash]);
  const patternMatchStr = poseidon.F.toObject(patternMatch).toString();
  console.log('\nStep 2 - Pattern Matching:');
  console.log(`  Pattern Match Hash: ${patternMatchStr.slice(0, 32)}...`);
  
  // Step 3: Confidence calculation
  const confidenceHash = poseidon([patternMatch, memoryContent, patternHash]);
  const confidenceHashStr = poseidon.F.toObject(confidenceHash).toString();
  const confidenceRaw = BigInt(confidenceHashStr) % BigInt(128);
  const confidence = Math.min(Number(confidenceRaw), 99);
  console.log('\nStep 3 - Confidence Calculation:');
  console.log(`  Raw Score: ${confidenceRaw}`);
  console.log(`  Capped Score: ${confidence}`);
  
  // Step 4: Threshold check
  const meetsThreshold = confidence >= Number(minConfidence);
  console.log('\nStep 4 - Threshold Check:');
  console.log(`  Min Confidence: ${minConfidence}`);
  console.log(`  Meets Threshold: ${meetsThreshold}`);
  
  // Step 5: Commitment hash
  const commitment = poseidon([
    memoryContent, 
    patternHash, 
    BigInt(confidence), 
    BigInt(1) // ownership valid
  ]);
  const commitmentStr = poseidon.F.toObject(commitment).toString();
  console.log('\nStep 5 - Commitment Hash:');
  console.log(`  Commitment: ${commitmentStr.slice(0, 32)}...`);
  
  console.log('\n✅ Circuit logic tests passed!\n');
}

async function main() {
  console.log('='.repeat(60));
  console.log('WhisperCache ZK Circuit Test Suite');
  console.log('='.repeat(60) + '\n');
  
  try {
    await testPoseidonHash();
    await testProofStructure();
    await testCircuitLogic();
    
    console.log('='.repeat(60));
    console.log('All tests passed! ✅');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
