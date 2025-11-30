/**
 * ZK Circuit Compilation Script
 * 
 * This script compiles Circom circuits and generates the necessary
 * WASM and R1CS files for proof generation.
 * 
 * Usage: node scripts/compile.js [circuitName]
 * Default: compiles hashVerifier (simpler circuit for testing)
 * 
 * NOTE: Requires circom2 to be installed globally:
 *   - Windows: Download from https://github.com/iden3/circom/releases
 *   - Or: cargo install circom (requires Rust)
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CIRCUITS_DIR = path.join(__dirname, '..', 'circuits');
const BUILD_DIR = path.join(__dirname, '..', 'build');

// Circuit to compile (default to simpler one for testing)
const circuitName = process.argv[2] || 'hashVerifier';
const circuitPath = path.join(CIRCUITS_DIR, `${circuitName}.circom`);

console.log('╔════════════════════════════════════════════════════╗');
console.log('║       WhisperCache ZK Circuit Compiler             ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log('');

// Create build directory
if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
    console.log('📁 Created build directory');
}

// Check if circuit exists
if (!fs.existsSync(circuitPath)) {
    console.error(`❌ Circuit not found: ${circuitPath}`);
    process.exit(1);
}

console.log(`🔧 Compiling circuit: ${circuitName}`);
console.log(`   Source: ${circuitPath}`);
console.log('');

// Check if circom2 is available
function findCircom() {
    // Try different locations for circom2
    const locations = [
        'circom',                           // In PATH
        'circom.exe',                       // Windows
        path.join(process.env.HOME || process.env.USERPROFILE, '.cargo', 'bin', 'circom'),
        path.join(process.env.HOME || process.env.USERPROFILE, '.cargo', 'bin', 'circom.exe'),
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
    console.log('For now, the ZK system will use MOCK proofs.');
    console.log('This is fine for development and demos!');
    console.log('');
    
    // Create a marker file to indicate we're using mock mode
    fs.writeFileSync(path.join(BUILD_DIR, '.mock_mode'), 'true');
    
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║              Using Mock ZK Mode                    ║');
    console.log('╚════════════════════════════════════════════════════╝');
    process.exit(0);
}

try {
    // Step 1: Compile circuit with circom2
    console.log('Step 1/3: Compiling Circom circuit...');
    
    const circomCmd = [
        circomPath,
        `"${circuitPath}"`,
        '--r1cs',
        '--wasm',
        '--sym',
        `-o "${BUILD_DIR}"`,
        // Include circomlib from node_modules
        `-l "${path.join(__dirname, '..', 'node_modules')}"`
    ].join(' ');
    
    console.log(`   Running: ${circomCmd}`);
    execSync(circomCmd, { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: true });
    
    console.log('   ✅ Circuit compiled successfully');
    console.log('');
    
    // Verify outputs exist
    const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);
    const wasmDir = path.join(BUILD_DIR, `${circuitName}_js`);
    
    if (fs.existsSync(r1csPath)) {
        const stats = fs.statSync(r1csPath);
        console.log(`   📄 R1CS file: ${r1csPath} (${stats.size} bytes)`);
    }
    
    if (fs.existsSync(wasmDir)) {
        console.log(`   📄 WASM directory: ${wasmDir}`);
    }
    
    console.log('');
    console.log('Step 2/3: Circuit info...');
    
    // Get circuit info
    const infoCmd = `npx snarkjs r1cs info "${r1csPath}"`;
    console.log(`   Running: ${infoCmd}`);
    execSync(infoCmd, { stdio: 'inherit', shell: true });
    
    console.log('');
    console.log('Step 3/3: Exporting R1CS to JSON...');
    
    const jsonPath = path.join(BUILD_DIR, `${circuitName}.r1cs.json`);
    const exportCmd = `npx snarkjs r1cs export json "${r1csPath}" "${jsonPath}"`;
    execSync(exportCmd, { stdio: 'inherit', shell: true });
    console.log(`   ✅ Exported to: ${jsonPath}`);
    
    // Remove mock mode marker if it exists
    const mockMarker = path.join(BUILD_DIR, '.mock_mode');
    if (fs.existsSync(mockMarker)) {
        fs.unlinkSync(mockMarker);
    }
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║              Compilation Complete!                 ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Next step: Run "npm run setup" to generate proving/verification keys');
    
} catch (error) {
    console.error('');
    console.error('❌ Compilation failed:', error.message);
    console.error('');
    console.error('The ZK system will use mock proofs for now.');
    
    // Create mock mode marker
    fs.writeFileSync(path.join(BUILD_DIR, '.mock_mode'), 'true');
    
    process.exit(0);
}
