/**
 * Memory Pattern V2 Circuit Build Script
 * 
 * Compiles the enhanced memory_pattern_v2.circom circuit with:
 *   - Memory status validation (ACTIVE/DELETED/REVOKED)
 *   - Key version range validation
 *   - Improved security policies
 * 
 * Usage: node scripts/build_memory_pattern_v2.js
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CIRCUITS_DIR = path.join(__dirname, '..', 'circuits');
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts', 'memory_pattern_v2');

const circuitName = 'memory_pattern_v2';
const circuitPath = path.join(CIRCUITS_DIR, `${circuitName}.circom`);

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║       WhisperCache Memory Pattern V2 Circuit Builder               ║');
console.log('║       (Status + Key Version Validation)                            ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('');

// Create artifacts directory
if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    console.log(`📁 Created artifacts directory: ${ARTIFACTS_DIR}`);
}

// Check if circuit exists
if (!fs.existsSync(circuitPath)) {
    console.error(`❌ Circuit not found: ${circuitPath}`);
    process.exit(1);
}

console.log(`🔧 Building circuit: ${circuitName}`);
console.log(`   Source: ${circuitPath}`);
console.log(`   Output: ${ARTIFACTS_DIR}`);
console.log('');
console.log('📋 Circuit Features:');
console.log('   • Memory status validation (0=DELETED, 1=ACTIVE, 2=REVOKED)');
console.log('   • Key version range validation (minKeyVersion <= keyVersion <= currentKeyVersion)');
console.log('   • Privacy pattern flags (isFinance, isHealth, isPersonal)');
console.log('');

// Find circom compiler
function findCircom() {
    const locations = [
        'circom',
        'circom.exe',
        path.join(process.env.HOME || process.env.USERPROFILE, '.cargo', 'bin', 'circom'),
        path.join(process.env.HOME || process.env.USERPROFILE, '.cargo', 'bin', 'circom.exe'),
        path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'bin', 'circom.exe'),
        path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'bin', 'circom'),
        'C:\\circom\\circom.exe',
        'C:\\Program Files\\circom\\circom.exe',
    ];
    
    for (const loc of locations) {
        try {
            const result = spawnSync(loc, ['--version'], { encoding: 'utf8', shell: true });
            if (result.status === 0 && result.stdout.includes('circom')) {
                console.log(`   Found circom: ${result.stdout.trim()}`);
                return loc;
            }
        } catch {}
    }
    return null;
}

const circomPath = findCircom();

if (!circomPath) {
    console.log('');
    console.log('⚠️  circom2 compiler not found!');
    console.log('');
    console.log('To install circom2:');
    console.log('  Option 1: Download from https://github.com/iden3/circom/releases');
    console.log('  Option 2: Install via Rust: cargo install --git https://github.com/iden3/circom.git');
    console.log('');
    
    // Create a marker file for mock mode
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '.mock_mode'), 'true');
    console.log('Created .mock_mode marker - system will use mock proofs.');
    
    // Also create schema file for the prover to know the expected interface
    const schemaInfo = {
        version: 2,
        circuitName: 'memory_pattern_v2',
        privateInputs: ['memoryContent', 'salt', 'memoryStatus', 'keyVersion'],
        publicInputs: ['memoryCommitment', 'isFinance', 'isHealth', 'isPersonal', 'currentKeyVersion', 'minKeyVersion'],
        outputs: ['allowedForAgent', 'commitment', 'statusValid', 'keyVersionValid'],
        statusValues: { DELETED: 0, ACTIVE: 1, REVOKED: 2 },
        mockMode: true
    };
    fs.writeFileSync(
        path.join(ARTIFACTS_DIR, 'circuit_schema.json'),
        JSON.stringify(schemaInfo, null, 2)
    );
    console.log('Created circuit_schema.json for mock mode operation.');
    
    process.exit(0);
}

try {
    // ========== STEP 1: Compile Circuit ==========
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1/4: Compiling Circom circuit...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const circomCmd = [
        circomPath,
        `"${circuitPath}"`,
        '--r1cs',
        '--wasm',
        '--sym',
        `-o "${ARTIFACTS_DIR}"`,
        `-l "${path.join(__dirname, '..', 'node_modules')}"`
    ].join(' ');
    
    console.log(`   Running: ${circomCmd}`);
    console.log('');
    execSync(circomCmd, { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: true });
    
    console.log('');
    console.log('   ✅ Circuit compiled successfully');

    // ========== STEP 2: Generate Powers of Tau ==========
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2/4: Generating Powers of Tau (trusted setup)...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const ptauPath = path.join(ARTIFACTS_DIR, 'pot14_final.ptau');
    
    // Check if we can reuse ptau from v1
    const v1PtauPath = path.join(__dirname, '..', 'artifacts', 'memory_pattern', 'pot14_final.ptau');
    
    if (fs.existsSync(v1PtauPath)) {
        console.log(`   Reusing ptau from v1: ${v1PtauPath}`);
        fs.copyFileSync(v1PtauPath, ptauPath);
    } else if (!fs.existsSync(ptauPath)) {
        // Start new ceremony (power 14 to handle larger circuits)
        const pot14New = path.join(ARTIFACTS_DIR, 'pot14_0000.ptau');
        console.log('   Starting new Powers of Tau ceremony (bn128, power 14)...');
        execSync(`npx snarkjs powersoftau new bn128 14 "${pot14New}" -v`, { 
            stdio: 'inherit',
            cwd: ARTIFACTS_DIR 
        });
        
        // Contribute
        const pot14_1 = path.join(ARTIFACTS_DIR, 'pot14_0001.ptau');
        console.log('');
        console.log('   Contributing to ceremony...');
        execSync(`npx snarkjs powersoftau contribute "${pot14New}" "${pot14_1}" --name="WhisperCache V2" -v -e="whispercache v2 random entropy"`, {
            stdio: 'inherit',
            cwd: ARTIFACTS_DIR
        });
        
        // Prepare phase 2
        console.log('');
        console.log('   Preparing phase 2...');
        execSync(`npx snarkjs powersoftau prepare phase2 "${pot14_1}" "${ptauPath}" -v`, {
            stdio: 'inherit',
            cwd: ARTIFACTS_DIR
        });
        
        // Cleanup
        if (fs.existsSync(pot14New)) fs.unlinkSync(pot14New);
        if (fs.existsSync(pot14_1)) fs.unlinkSync(pot14_1);
        
        console.log('   ✅ Powers of Tau generated');
    } else {
        console.log(`   Using existing ptau: ${ptauPath}`);
    }

    // ========== STEP 3: Generate zkey (proving key) ==========
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3/4: Generating proving key (zkey)...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const r1csPath = path.join(ARTIFACTS_DIR, `${circuitName}.r1cs`);
    const zkey0Path = path.join(ARTIFACTS_DIR, `${circuitName}_0000.zkey`);
    const zkeyPath = path.join(ARTIFACTS_DIR, `${circuitName}.zkey`);
    
    // Initial zkey setup
    console.log('   Running groth16 setup...');
    execSync(`npx snarkjs groth16 setup "${r1csPath}" "${ptauPath}" "${zkey0Path}"`, {
        stdio: 'inherit',
        cwd: ARTIFACTS_DIR
    });
    
    // Contribute to phase 2
    console.log('');
    console.log('   Contributing to phase 2...');
    execSync(`npx snarkjs zkey contribute "${zkey0Path}" "${zkeyPath}" --name="WhisperCache V2" -v -e="v2 random entropy"`, {
        stdio: 'inherit',
        cwd: ARTIFACTS_DIR
    });
    
    // Cleanup intermediate zkey
    if (fs.existsSync(zkey0Path)) fs.unlinkSync(zkey0Path);
    
    console.log('   ✅ Proving key generated');

    // ========== STEP 4: Export verification key ==========
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4/4: Exporting verification key...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const vkeyPath = path.join(ARTIFACTS_DIR, `${circuitName}_verification_key.json`);
    execSync(`npx snarkjs zkey export verificationkey "${zkeyPath}" "${vkeyPath}"`, {
        stdio: 'inherit',
        cwd: ARTIFACTS_DIR
    });
    
    console.log('   ✅ Verification key exported');

    // Create schema file
    const schemaInfo = {
        version: 2,
        circuitName: 'memory_pattern_v2',
        privateInputs: ['memoryContent', 'salt', 'memoryStatus', 'keyVersion'],
        publicInputs: ['memoryCommitment', 'isFinance', 'isHealth', 'isPersonal', 'currentKeyVersion', 'minKeyVersion'],
        outputs: ['allowedForAgent', 'commitment', 'statusValid', 'keyVersionValid'],
        statusValues: { DELETED: 0, ACTIVE: 1, REVOKED: 2 },
        mockMode: false,
        compiledAt: new Date().toISOString()
    };
    fs.writeFileSync(
        path.join(ARTIFACTS_DIR, 'circuit_schema.json'),
        JSON.stringify(schemaInfo, null, 2)
    );

    // Remove mock mode marker if it exists
    const mockMarker = path.join(ARTIFACTS_DIR, '.mock_mode');
    if (fs.existsSync(mockMarker)) {
        fs.unlinkSync(mockMarker);
    }

    // ========== Summary ==========
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                    BUILD COMPLETE! ✅                               ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Generated artifacts:');
    
    const files = [
        `${circuitName}.r1cs`,
        `${circuitName}.sym`,
        `${circuitName}_js/${circuitName}.wasm`,
        `${circuitName}.zkey`,
        `${circuitName}_verification_key.json`,
        'circuit_schema.json',
        'pot14_final.ptau'
    ];
    
    for (const file of files) {
        const fullPath = path.join(ARTIFACTS_DIR, file);
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            console.log(`   📄 ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        }
    }
    
    console.log('');
    console.log('Memory Pattern V2 Features:');
    console.log('   ✅ Status validation (only ACTIVE memories allowed)');
    console.log('   ✅ Key version range validation');
    console.log('   ✅ Privacy pattern enforcement (isPersonal blocks agent access)');
    console.log('');
    console.log('Next: Update memoryPatternProver.ts to use v2 circuit');
    
} catch (error) {
    console.error('');
    console.error('❌ Build failed:', error.message);
    
    // Create mock mode marker
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '.mock_mode'), 'true');
    
    // Also create schema file for mock mode
    const schemaInfo = {
        version: 2,
        circuitName: 'memory_pattern_v2',
        privateInputs: ['memoryContent', 'salt', 'memoryStatus', 'keyVersion'],
        publicInputs: ['memoryCommitment', 'isFinance', 'isHealth', 'isPersonal', 'currentKeyVersion', 'minKeyVersion'],
        outputs: ['allowedForAgent', 'commitment', 'statusValid', 'keyVersionValid'],
        statusValues: { DELETED: 0, ACTIVE: 1, REVOKED: 2 },
        mockMode: true,
        buildError: error.message
    };
    fs.writeFileSync(
        path.join(ARTIFACTS_DIR, 'circuit_schema.json'),
        JSON.stringify(schemaInfo, null, 2)
    );
    
    console.log('Created mock mode artifacts for development.');
    process.exit(1);
}
