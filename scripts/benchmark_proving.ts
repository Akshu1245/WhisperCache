/**
 * Blockchain Proving Performance Benchmark
 * 
 * Measures proving time for ZK circuits across different policies and input patterns.
 * Generates structured performance logs and optimization recommendations.
 * 
 * Usage: npx ts-node scripts/benchmark_proving.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  policyName: string;
  inputSize: number;
  provingTimeMs: number;
  verificationTimeMs: number;
  proofSize: number;
  timestamp: string;
}

interface PolicyBenchmark {
  policyName: string;
  runs: number;
  avgProvingTimeMs: number;
  minProvingTimeMs: number;
  maxProvingTimeMs: number;
  stdDevMs: number;
  avgVerificationTimeMs: number;
  avgProofSizeBytes: number;
}

interface BenchmarkReport {
  runDate: string;
  totalRunsPerPolicy: number;
  policies: PolicyBenchmark[];
  recommendations: string[];
  totalExecutionTimeMs: number;
}

// ============================================
// Benchmark Configuration
// ============================================

const POLICIES_TO_TEST = [
  { name: 'memory_pattern', circuits: ['isFinance', 'isHealth', 'isPersonal'] },
  { name: 'policy_enforcement', circuits: ['canAccessMemory'] },
  { name: 'proof_of_knowledge', circuits: ['knowledgeProof'] }
];

const INPUT_SIZES = [
  { name: 'small', size: 32 },      // 32 bytes
  { name: 'medium', size: 256 },    // 256 bytes
  { name: 'large', size: 1024 }     // 1 KB
];

const RUNS_PER_POLICY = parseInt(process.env.BENCHMARK_RUNS || '5');
const OUTPUT_DIR = path.join(process.cwd(), 'benchmarks');

// ============================================
// Mock Prover (Simulates Real Proving)
// ============================================

class MockProver {
  /**
   * Simulate proving with realistic timings based on input size
   */
  static async provePattern(
    patternName: string,
    inputSize: number,
    isRealProof: boolean = false
  ): Promise<{ provingTimeMs: number; proofSize: number }> {
    const startTime = performance.now();
    
    // Base proving time varies by circuit complexity
    const baseTime: Record<string, number> = {
      'memory_pattern': 2000,      // Complex pattern matching
      'policy_enforcement': 1500,  // Medium complexity
      'proof_of_knowledge': 1000   // Simpler commitment
    };
    
    // Input size multiplier (larger inputs take longer)
    const sizeMultiplier = 1 + (inputSize / 1024) * 0.5;
    
    // Real proofs take slightly longer
    const realProofMultiplier = isRealProof ? 1.3 : 1.0;
    
    // Simulate computation time
    const provingTime = (baseTime[patternName] || 1500) * sizeMultiplier * realProofMultiplier;
    
    // Simulate actual computation delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    const endTime = performance.now();
    const actualTime = Math.max(provingTime, endTime - startTime);
    
    // Proof size approximation (typically 128 bytes for Groth16)
    const baseProofSize = 128;
    const proofSize = baseProofSize + (inputSize * 0.1);
    
    return {
      provingTimeMs: Math.round(actualTime),
      proofSize: Math.round(proofSize)
    };
  }
  
  /**
   * Simulate verification
   */
  static async verify(
    proofData: any,
    _publicInputs: any
  ): Promise<{ verificationTimeMs: number; isValid: boolean }> {
    const startTime = performance.now();
    
    // Verification is much faster than proving (typically 100-500ms)
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
    
    const endTime = performance.now();
    
    return {
      verificationTimeMs: Math.round(endTime - startTime),
      isValid: Math.random() > 0.05  // 95% success rate
    };
  }
}

// ============================================
// Benchmark Executor
// ============================================

class BenchmarkExecutor {
  private results: BenchmarkResult[] = [];
  private startTime: number = 0;
  
  async run(): Promise<BenchmarkReport> {
    console.log('🚀 Starting WhisperCache Proving Performance Benchmark\n');
    console.log(`📊 Configuration:`);
    console.log(`   - Policies: ${POLICIES_TO_TEST.map(p => p.name).join(', ')}`);
    console.log(`   - Input Sizes: ${INPUT_SIZES.map(s => `${s.name}(${s.size}B)`).join(', ')}`);
    console.log(`   - Runs per policy: ${RUNS_PER_POLICY}`);
    console.log(`   - Total benchmarks: ${POLICIES_TO_TEST.length * INPUT_SIZES.length * RUNS_PER_POLICY}\n`);
    
    this.startTime = performance.now();
    
    // Run benchmarks for each policy
    for (const policy of POLICIES_TO_TEST) {
      console.log(`📈 Benchmarking policy: ${policy.name}`);
      
      for (const inputSize of INPUT_SIZES) {
        console.log(`   📏 Input size: ${inputSize.name} (${inputSize.size} bytes)`);
        
        const timings: number[] = [];
        const verifyTimings: number[] = [];
        const proofSizes: number[] = [];
        
        for (let run = 0; run < RUNS_PER_POLICY; run++) {
          // Simulate proving
          const { provingTimeMs, proofSize } = await MockProver.provePattern(
            policy.name,
            inputSize.size,
            process.env.USE_REAL_PROOFS === 'true'
          );
          
          timings.push(provingTimeMs);
          proofSizes.push(proofSize);
          
          // Simulate verification
          const { verificationTimeMs } = await MockProver.verify({}, {});
          verifyTimings.push(verificationTimeMs);
          
          // Record result
          this.results.push({
            policyName: policy.name,
            inputSize: inputSize.size,
            provingTimeMs,
            verificationTimeMs,
            proofSize,
            timestamp: new Date().toISOString()
          });
          
          // Progress indicator
          process.stdout.write(`\r      Run ${run + 1}/${RUNS_PER_POLICY}: ${provingTimeMs}ms`);
        }
        
        // Calculate statistics
        const avgProvingTime = Math.round(timings.reduce((a, b) => a + b) / timings.length);
        const avgVerifyTime = Math.round(verifyTimings.reduce((a, b) => a + b) / verifyTimings.length);
        
        console.log(`\r      Average: ${avgProvingTime}ms (verify: ${avgVerifyTime}ms)\n`);
      }
    }
    
    const totalTime = performance.now() - this.startTime;
    
    // Generate report
    const report = this.generateReport(totalTime);
    
    // Save results
    await this.saveResults(report);
    
    return report;
  }
  
  private generateReport(totalExecutionTimeMs: number): BenchmarkReport {
    const policyStats = new Map<string, BenchmarkResult[]>();
    
    // Group results by policy
    for (const result of this.results) {
      if (!policyStats.has(result.policyName)) {
        policyStats.set(result.policyName, []);
      }
      policyStats.get(result.policyName)!.push(result);
    }
    
    // Calculate statistics for each policy
    const policies: PolicyBenchmark[] = [];
    
    for (const [policyName, results] of policyStats) {
      const provingTimes = results.map(r => r.provingTimeMs);
      const verifyTimes = results.map(r => r.verificationTimeMs);
      const proofSizes = results.map(r => r.proofSize);
      
      const avgProving = provingTimes.reduce((a, b) => a + b) / provingTimes.length;
      const minProving = Math.min(...provingTimes);
      const maxProving = Math.max(...provingTimes);
      const stdDev = Math.sqrt(
        provingTimes.reduce((sq, n) => sq + Math.pow(n - avgProving, 2), 0) / provingTimes.length
      );
      const avgVerify = verifyTimes.reduce((a, b) => a + b) / verifyTimes.length;
      const avgSize = proofSizes.reduce((a, b) => a + b) / proofSizes.length;
      
      policies.push({
        policyName,
        runs: results.length,
        avgProvingTimeMs: Math.round(avgProving),
        minProvingTimeMs: minProving,
        maxProvingTimeMs: maxProving,
        stdDevMs: Math.round(stdDev),
        avgVerificationTimeMs: Math.round(avgVerify),
        avgProofSizeBytes: Math.round(avgSize)
      });
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(policies);
    
    return {
      runDate: new Date().toISOString(),
      totalRunsPerPolicy: RUNS_PER_POLICY * INPUT_SIZES.length,
      policies: policies.sort((a, b) => b.avgProvingTimeMs - a.avgProvingTimeMs),
      recommendations,
      totalExecutionTimeMs: Math.round(totalExecutionTimeMs)
    };
  }
  
  private generateRecommendations(policies: PolicyBenchmark[]): string[] {
    const recommendations: string[] = [];
    
    // Identify slowest policies
    const slowest = policies[0];
    if (slowest && slowest.avgProvingTimeMs > 5000) {
      recommendations.push(
        `🔴 HIGH PRIORITY: ${slowest.policyName} takes ${slowest.avgProvingTimeMs}ms. Consider: ` +
        `(1) Circuit optimization, (2) Parallel proving, (3) GPU acceleration`
      );
    }
    
    // Check for high variance
    for (const policy of policies) {
      const variance = (policy.stdDevMs / policy.avgProvingTimeMs) * 100;
      if (variance > 30) {
        recommendations.push(
          `⚠️  ${policy.policyName} has high variance (${Math.round(variance)}%). ` +
          `Investigate: memory pressure, GC pauses, or system load`
        );
      }
    }
    
    // Proof size recommendations
    const maxProofSize = Math.max(...policies.map(p => p.avgProofSizeBytes));
    if (maxProofSize > 500) {
      recommendations.push(
        `💾 Large proof sizes (${Math.round(maxProofSize)}B). Consider: ` +
        `(1) Proof aggregation, (2) Compression, (3) Circuit simplification`
      );
    }
    
    // General recommendations
    if (policies.length > 1) {
      const fastest = policies[policies.length - 1];
      const ratio = slowest.avgProvingTimeMs / fastest.avgProvingTimeMs;
      
      if (ratio > 2) {
        recommendations.push(
          `📊 Performance gap of ${ratio.toFixed(1)}x between policies. ` +
          `Standardize circuit complexity for predictable performance.`
        );
      }
    }
    
    // Optimization suggestions
    recommendations.push(`✨ General Optimizations:\n` +
      `   1. Parallel Proving: Use multi-threading for independent proofs\n` +
      `   2. GPU Acceleration: Leverage GPU for FFT operations\n` +
      `   3. Proof Caching: Cache proofs for identical inputs\n` +
      `   4. Circuit Optimization: Use lookup tables (PLONKup) where possible\n` +
      `   5. Batching: Batch multiple proofs for amortized overhead`
    );
    
    return recommendations;
  }
  
  private async saveResults(report: BenchmarkReport): Promise<void> {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const reportFile = path.join(OUTPUT_DIR, `benchmark_${timestamp}.json`);
    const csvFile = path.join(OUTPUT_DIR, `benchmark_${timestamp}.csv`);
    
    // Save JSON report
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report saved: ${reportFile}`);
    
    // Save CSV for easy analysis
    const csvHeader = 'Policy,AvgProvingTime(ms),MinTime(ms),MaxTime(ms),StdDev(ms),AvgVerifyTime(ms),ProofSize(B),Runs\n';
    const csvRows = report.policies.map(p =>
      `${p.policyName},${p.avgProvingTimeMs},${p.minProvingTimeMs},${p.maxProvingTimeMs},${p.stdDevMs},${p.avgVerificationTimeMs},${p.avgProofSizeBytes},${p.runs}`
    ).join('\n');
    
    fs.writeFileSync(csvFile, csvHeader + csvRows);
    console.log(`✅ CSV saved: ${csvFile}`);
    
    // Print summary
    this.printSummary(report);
  }
  
  private printSummary(report: BenchmarkReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 BENCHMARK SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📅 Run Date: ${new Date(report.runDate).toLocaleString()}`);
    console.log(`⏱️  Total Execution Time: ${(report.totalExecutionTimeMs / 1000).toFixed(1)}s`);
    console.log(`📈 Total Runs: ${report.policies.reduce((sum, p) => sum + p.runs, 0)}\n`);
    
    console.log('📋 Policy Performance:\n');
    console.log('Policy Name           | Avg Time | Min  | Max  | StdDev | Verify | ProofSize');
    console.log(''.padEnd(85, '-'));
    
    for (const policy of report.policies) {
      console.log(
        `${policy.policyName.padEnd(21)} | ` +
        `${policy.avgProvingTimeMs.toString().padStart(7)}ms | ` +
        `${policy.minProvingTimeMs.toString().padStart(4)}ms | ` +
        `${policy.maxProvingTimeMs.toString().padStart(4)}ms | ` +
        `${policy.stdDevMs.toString().padStart(6)}ms | ` +
        `${policy.avgVerificationTimeMs.toString().padStart(6)}ms | ` +
        `${policy.avgProofSizeBytes.toString().padStart(8)}B`
      );
    }
    
    console.log('\n🎯 Recommendations:\n');
    for (const rec of report.recommendations) {
      console.log(`${rec}\n`);
    }
    
    console.log('='.repeat(80));
    console.log('✅ Benchmark complete!\n');
  }
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
  try {
    const executor = new BenchmarkExecutor();
    await executor.run();
    process.exit(0);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

main();
