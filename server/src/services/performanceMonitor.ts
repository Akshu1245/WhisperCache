/**
 * WhisperCache Performance Monitoring
 * 
 * Production-ready metrics collection:
 * - Request latency histograms
 * - Proof generation timing
 * - Memory usage tracking
 * - Circuit breaker state
 * - Custom business metrics
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver, PerformanceEntry } from 'perf_hooks';

// ============================================================================
// Types
// ============================================================================

export interface MetricValue {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface HistogramBucket {
  le: number;
  count: number;
}

export interface Histogram {
  name: string;
  buckets: HistogramBucket[];
  sum: number;
  count: number;
  labels?: Record<string, string>;
}

export interface GaugeMetric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface CounterMetric {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

export interface PerformanceStats {
  requests: {
    total: number;
    successful: number;
    failed: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
  };
  proofs: {
    generated: number;
    verified: number;
    avgGenerationMs: number;
    cacheHitRate: number;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
    rss: number;
  };
  uptime: number;
}

// ============================================================================
// Performance Monitor
// ============================================================================

export class PerformanceMonitor extends EventEmitter {
  private counters: Map<string, CounterMetric> = new Map();
  private gauges: Map<string, GaugeMetric> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private startTime: number;
  private requestLatencies: number[] = [];
  private proofTimes: number[] = [];
  private perfObserver: PerformanceObserver | null = null;

  constructor() {
    super();
    this.startTime = Date.now();
    this.initCounter('requests_total', 0);
    this.initCounter('requests_success', 0);
    this.initCounter('requests_error', 0);
    this.initCounter('proofs_generated', 0);
    this.initCounter('proofs_verified', 0);
    this.initCounter('cache_hits', 0);
    this.initCounter('cache_misses', 0);

    // Set up performance observer for timings
    this.setupPerfObserver();
  }

  private setupPerfObserver(): void {
    try {
      this.perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerfEntry(entry);
        }
      });
      this.perfObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('[PerfMon] Could not set up performance observer:', error);
    }
  }

  private handlePerfEntry(entry: PerformanceEntry): void {
    if (entry.name.startsWith('http:')) {
      this.requestLatencies.push(entry.duration);
      this.keepLastN(this.requestLatencies, 1000);
    } else if (entry.name.startsWith('proof:')) {
      this.proofTimes.push(entry.duration);
      this.keepLastN(this.proofTimes, 1000);
    }
  }

  private keepLastN(arr: number[], n: number): void {
    while (arr.length > n) {
      arr.shift();
    }
  }

  // ============================================================================
  // Counters
  // ============================================================================

  private initCounter(name: string, value: number = 0, labels?: Record<string, string>): void {
    const key = this.metricKey(name, labels);
    this.counters.set(key, { name, value, labels });
  }

  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.metricKey(name, labels);
    const counter = this.counters.get(key);
    
    if (counter) {
      counter.value += value;
    } else {
      this.initCounter(name, value, labels);
    }
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.metricKey(name, labels);
    return this.counters.get(key)?.value || 0;
  }

  // ============================================================================
  // Gauges
  // ============================================================================

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.metricKey(name, labels);
    this.gauges.set(key, {
      name,
      value,
      timestamp: Date.now(),
      labels
    });
  }

  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.metricKey(name, labels);
    return this.gauges.get(key)?.value || 0;
  }

  // ============================================================================
  // Histograms
  // ============================================================================

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.metricKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.keepLastN(values, 1000);
    this.histograms.set(key, values);
  }

  getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.metricKey(name, labels);
    const values = this.histograms.get(key);
    
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };
  }

  private percentile(sorted: number[], p: number): number {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  // ============================================================================
  // Request Tracking
  // ============================================================================

  startRequest(): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.requestLatencies.push(duration);
      this.keepLastN(this.requestLatencies, 1000);
    };
  }

  recordRequest(success: boolean, durationMs?: number): void {
    this.incrementCounter('requests_total');
    if (success) {
      this.incrementCounter('requests_success');
    } else {
      this.incrementCounter('requests_error');
    }
    if (durationMs !== undefined) {
      this.requestLatencies.push(durationMs);
      this.keepLastN(this.requestLatencies, 1000);
    }
  }

  // ============================================================================
  // Proof Tracking
  // ============================================================================

  startProofGeneration(): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.proofTimes.push(duration);
      this.keepLastN(this.proofTimes, 1000);
      this.incrementCounter('proofs_generated');
    };
  }

  recordProofVerification(): void {
    this.incrementCounter('proofs_verified');
  }

  recordCacheHit(): void {
    this.incrementCounter('cache_hits');
  }

  recordCacheMiss(): void {
    this.incrementCounter('cache_misses');
  }

  // ============================================================================
  // Stats & Export
  // ============================================================================

  getStats(): PerformanceStats {
    const memory = process.memoryUsage();
    const sortedLatencies = [...this.requestLatencies].sort((a, b) => a - b);
    const sortedProofTimes = [...this.proofTimes].sort((a, b) => a - b);

    const cacheHits = this.getCounter('cache_hits');
    const cacheMisses = this.getCounter('cache_misses');
    const cacheTotal = cacheHits + cacheMisses;

    return {
      requests: {
        total: this.getCounter('requests_total'),
        successful: this.getCounter('requests_success'),
        failed: this.getCounter('requests_error'),
        avgLatencyMs: sortedLatencies.length > 0
          ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length
          : 0,
        p50LatencyMs: sortedLatencies.length > 0 ? this.percentile(sortedLatencies, 50) : 0,
        p95LatencyMs: sortedLatencies.length > 0 ? this.percentile(sortedLatencies, 95) : 0,
        p99LatencyMs: sortedLatencies.length > 0 ? this.percentile(sortedLatencies, 99) : 0
      },
      proofs: {
        generated: this.getCounter('proofs_generated'),
        verified: this.getCounter('proofs_verified'),
        avgGenerationMs: sortedProofTimes.length > 0
          ? sortedProofTimes.reduce((a, b) => a + b, 0) / sortedProofTimes.length
          : 0,
        cacheHitRate: cacheTotal > 0 ? cacheHits / cacheTotal : 0
      },
      memory: {
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
        externalMB: Math.round(memory.external / 1024 / 1024 * 100) / 100,
        rss: Math.round(memory.rss / 1024 / 1024 * 100) / 100
      },
      uptime: Math.round((Date.now() - this.startTime) / 1000)
    };
  }

  toPrometheusFormat(): string {
    const lines: string[] = [];
    const stats = this.getStats();

    // Request metrics
    lines.push(`# HELP whispercache_requests_total Total requests`);
    lines.push(`# TYPE whispercache_requests_total counter`);
    lines.push(`whispercache_requests_total ${stats.requests.total}`);
    
    lines.push(`whispercache_requests_success ${stats.requests.successful}`);
    lines.push(`whispercache_requests_error ${stats.requests.failed}`);

    // Latency metrics
    lines.push(`# HELP whispercache_request_latency_ms Request latency in milliseconds`);
    lines.push(`# TYPE whispercache_request_latency_ms summary`);
    lines.push(`whispercache_request_latency_ms{quantile="0.5"} ${stats.requests.p50LatencyMs}`);
    lines.push(`whispercache_request_latency_ms{quantile="0.95"} ${stats.requests.p95LatencyMs}`);
    lines.push(`whispercache_request_latency_ms{quantile="0.99"} ${stats.requests.p99LatencyMs}`);

    // Proof metrics
    lines.push(`# HELP whispercache_proofs_generated Total proofs generated`);
    lines.push(`# TYPE whispercache_proofs_generated counter`);
    lines.push(`whispercache_proofs_generated ${stats.proofs.generated}`);
    lines.push(`whispercache_proofs_verified ${stats.proofs.verified}`);
    lines.push(`whispercache_proof_cache_hit_rate ${stats.proofs.cacheHitRate}`);

    // Memory metrics
    lines.push(`# HELP whispercache_memory_heap_used_mb Heap memory used in MB`);
    lines.push(`# TYPE whispercache_memory_heap_used_mb gauge`);
    lines.push(`whispercache_memory_heap_used_mb ${stats.memory.heapUsedMB}`);
    lines.push(`whispercache_memory_heap_total_mb ${stats.memory.heapTotalMB}`);
    lines.push(`whispercache_memory_rss_mb ${stats.memory.rss}`);

    // Uptime
    lines.push(`# HELP whispercache_uptime_seconds Server uptime in seconds`);
    lines.push(`# TYPE whispercache_uptime_seconds gauge`);
    lines.push(`whispercache_uptime_seconds ${stats.uptime}`);

    return lines.join('\n');
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private metricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .sort()
      .join(',');
    return `${name}{${labelStr}}`;
  }

  stop(): void {
    if (this.perfObserver) {
      this.perfObserver.disconnect();
      this.perfObserver = null;
    }
  }
}

// ============================================================================
// Timer Utility
// ============================================================================

export class Timer {
  private start: number;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.start = performance.now();
  }

  stop(): number {
    const duration = performance.now() - this.start;
    return duration;
  }

  stopAndLog(): number {
    const duration = this.stop();
    console.log(`[Timer] ${this.name}: ${duration.toFixed(2)}ms`);
    return duration;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const performanceMonitor = new PerformanceMonitor();

/**
 * Express middleware for request tracking
 */
export function requestTrackingMiddleware() {
  return (req: any, res: any, next: any) => {
    const endTracking = performanceMonitor.startRequest();
    
    res.on('finish', () => {
      endTracking();
      performanceMonitor.recordRequest(res.statusCode < 400);
    });

    next();
  };
}
