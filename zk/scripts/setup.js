/**
 * ZK Trusted Setup Script
 * 
 * This script performs the trusted setup ceremony for generating
 * proving and verification keys using Powers of Tau.
 * 
 * For production: Use a proper multi-party computation ceremony
 * For development: We use a single-party setup (less secure, but faster)
 * 
 * Usage: node scripts/setup.js [circuitName]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const circuitName = process.argv[2] || 'hashVerifier';

console.log('╔════════════════════════════════════════════════════╗');
console.log('║       WhisperCache ZK Trusted Setup                ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log('');

const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);

// Check if R1CS exists
if (!fs.existsSync(r1csPath)) {
    console.error(`❌ R1CS file not found: ${r1csPath}`);
    console.error('   Run "npm run compile" first');
    process.exit(1);
}

console.log(`🔧 Setting up circuit: ${circuitName}`);
console.log('');

// File paths
const ptauPath = path.join(BUILD_DIR, 'pot12_final.ptau');
const zkeyPath = path.join(BUILD_DIR, `${circuitName}.zkey`);
const vkeyPath = path.join(BUILD_DIR, `${circuitName}_verification_key.json`);

try {
    // Step 1: Check if we need to download or generate ptau
    if (!fs.existsSync(ptauPath)) {
        console.log('Step 1/5: Generating Powers of Tau (pot12)...');
        console.log('         This is for development only!');
        console.log('');
        
        // Start new ceremony
        const pot12New = path.join(BUILD_DIR, 'pot12_0000.ptau');
        execSync(`npx snarkjs powersoftau new bn128 12 ${pot12New} -v`, { 
            stdio: 'inherit',
            cwd: BUILD_DIR 
        });
        
        // Contribute
        console.log('');
        console.log('Step 2/5: Contributing to ceremony...');
        const pot12_1 = path.join(BUILD_DIR, 'pot12_0001.ptau');
        execSync(`npx snarkjs powersoftau contribute ${pot12New} ${pot12_1} --name="WhisperCache Dev" -v -e="random entropy for dev"`, {
            stdio: 'inherit',
            cwd: BUILD_DIR
        });
        
        // Prepare phase 2
        console.log('');
        console.log('Step 3/5: Preparing phase 2...');
        execSync(`npx snarkjs powersoftau prepare phase2 ${pot12_1} ${ptauPath} -v`, {
            stdio: 'inherit',
            cwd: BUILD_DIR
        });
        
        // Cleanup intermediate files
        fs.unlinkSync(pot12New);
        fs.unlinkSync(pot12_1);
        
        console.log('   ✅ Powers of Tau generated');
    } else {
        console.log('Step 1-3: Using existing Powers of Tau file');
        console.log(`         ${ptauPath}`);
    }
    
    console.log('');
    console.log('Step 4/5: Generating zkey (proving key)...');
    
    // Generate zkey
    const zkey0Path = path.join(BUILD_DIR, `${circuitName}_0000.zkey`);
    execSync(`npx snarkjs groth16 setup ${r1csPath} ${ptauPath} ${zkey0Path}`, {
        stdio: 'inherit',
        cwd: BUILD_DIR
    });
    
    // Contribute to phase 2
    console.log('');
    console.log('         Contributing to phase 2...');
    execSync(`npx snarkjs zkey contribute ${zkey0Path} ${zkeyPath} --name="WhisperCache Dev" -v -e="more random entropy"`, {
        stdio: 'inherit',
        cwd: BUILD_DIR
    });
    
    // Cleanup
    fs.unlinkSync(zkey0Path);
    
    console.log('   ✅ Proving key generated');
    
    // Export verification key
    console.log('');
    console.log('Step 5/5: Exporting verification key...');
    execSync(`npx snarkjs zkey export verificationkey ${zkeyPath} ${vkeyPath}`, {
        stdio: 'inherit',
        cwd: BUILD_DIR
    });
    console.log('   ✅ Verification key exported');
    
    // Print summary
    console.log('');
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║              Setup Complete!                       ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Generated files:');
    console.log(`  📄 Proving key:      ${zkeyPath}`);
    console.log(`  📄 Verification key: ${vkeyPath}`);
    console.log(`  📄 Powers of Tau:    ${ptauPath}`);
    console.log('');
    console.log('You can now use these in your backend for proof generation!');
    
} catch (error) {
    console.error('');
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
}
