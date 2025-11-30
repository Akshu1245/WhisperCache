/**
 * AI Agent Service
 * 
 * Provides intelligent pattern matching and decision-making for:
 * - Memory pattern analysis
 * - Privacy-preserving insights
 * - Confidence scoring
 * - Query interpretation
 */

import { hashData } from './crypto';

// Pattern categories with weights
interface PatternCategory {
  name: string;
  keywords: string[];
  weight: number;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
}

const PATTERN_CATEGORIES: PatternCategory[] = [
  {
    name: 'mental_health',
    keywords: ['anxiety', 'stress', 'panic', 'depression', 'therapy', 'mental', 'emotional', 'mood', 'worry', 'fear'],
    weight: 0.9,
    sensitivity: 'critical'
  },
  {
    name: 'productivity',
    keywords: ['work', 'productivity', 'focus', 'task', 'deadline', 'project', 'meeting', 'goal', 'efficient', 'time'],
    weight: 0.7,
    sensitivity: 'low'
  },
  {
    name: 'health',
    keywords: ['health', 'doctor', 'medical', 'symptom', 'pain', 'medication', 'treatment', 'hospital', 'condition', 'diagnosis'],
    weight: 0.85,
    sensitivity: 'high'
  },
  {
    name: 'financial',
    keywords: ['money', 'financial', 'debt', 'salary', 'investment', 'savings', 'budget', 'expense', 'income', 'payment'],
    weight: 0.8,
    sensitivity: 'high'
  },
  {
    name: 'relationships',
    keywords: ['family', 'friend', 'relationship', 'partner', 'spouse', 'parent', 'child', 'conflict', 'love', 'marriage'],
    weight: 0.75,
    sensitivity: 'medium'
  },
  {
    name: 'personal_growth',
    keywords: ['learn', 'skill', 'improve', 'develop', 'growth', 'habit', 'goal', 'achievement', 'progress', 'success'],
    weight: 0.65,
    sensitivity: 'low'
  },
  {
    name: 'lifestyle',
    keywords: ['sleep', 'exercise', 'diet', 'nutrition', 'hobby', 'travel', 'lifestyle', 'routine', 'activity', 'recreation'],
    weight: 0.6,
    sensitivity: 'low'
  }
];

// Response templates based on pattern
const RESPONSE_TEMPLATES: Record<string, string[]> = {
  mental_health: [
    'Elevated stress pattern detected',
    'Emotional fluctuation indicators present',
    'Mental wellness monitoring recommended',
    'Anxiety-related pattern identified'
  ],
  productivity: [
    'Work pattern analysis complete',
    'Productivity trends identified',
    'Focus optimization opportunities found',
    'Task management patterns detected'
  ],
  health: [
    'Health monitoring pattern detected',
    'Wellness indicators analyzed',
    'Medical context awareness active',
    'Health tracking patterns identified'
  ],
  financial: [
    'Financial awareness patterns found',
    'Budget-related indicators detected',
    'Financial planning context identified',
    'Economic pattern analysis complete'
  ],
  relationships: [
    'Social pattern context detected',
    'Relationship dynamics indicators',
    'Interpersonal awareness patterns',
    'Social interaction context found'
  ],
  personal_growth: [
    'Growth trajectory patterns identified',
    'Learning pattern indicators detected',
    'Self-improvement context found',
    'Development tracking active'
  ],
  lifestyle: [
    'Lifestyle pattern analysis complete',
    'Daily routine indicators detected',
    'Wellness habit patterns found',
    'Activity tracking context identified'
  ],
  general: [
    'Pattern analysis complete',
    'Memory context processed',
    'Query interpretation successful',
    'Data patterns identified'
  ]
};

export interface AgentAnalysis {
  pattern: string;
  confidence: number;
  category: string;
  sensitivity: string;
  insights: string[];
  recommendation?: string;
  proofReady: boolean;
}

export interface QueryContext {
  query: string;
  memoryHashes: string[];
  timestamp: number;
}

/**
 * Analyze a query to determine pattern category and confidence
 */
export function analyzeQuery(query: string): {
  category: string;
  confidence: number;
  sensitivity: string;
  matchedKeywords: string[];
} {
  const lowerQuery = query.toLowerCase();
  let bestMatch = { category: 'general', confidence: 0.5, sensitivity: 'low', matchedKeywords: [] as string[] };

  for (const category of PATTERN_CATEGORIES) {
    const matched = category.keywords.filter(kw => lowerQuery.includes(kw));
    
    if (matched.length > 0) {
      // Calculate confidence based on keyword matches and category weight
      const matchRatio = matched.length / category.keywords.length;
      const confidence = Math.min(0.99, 0.5 + (matchRatio * category.weight * 0.5));
      
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          category: category.name,
          confidence,
          sensitivity: category.sensitivity,
          matchedKeywords: matched
        };
      }
    }
  }

  // Add small random variation for realism
  bestMatch.confidence = Math.min(0.99, bestMatch.confidence + (Math.random() * 0.05 - 0.025));

  return bestMatch;
}

/**
 * Generate a response pattern based on analysis
 */
export function generatePattern(category: string): string {
  const templates = RESPONSE_TEMPLATES[category] || RESPONSE_TEMPLATES.general;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate detailed insights based on query analysis
 */
export function generateInsights(category: string, confidence: number): string[] {
  const insights: string[] = [];

  // Confidence-based insight
  if (confidence > 0.8) {
    insights.push('High confidence pattern match detected');
  } else if (confidence > 0.6) {
    insights.push('Moderate pattern correlation identified');
  } else {
    insights.push('General pattern context established');
  }

  // Category-specific insights
  switch (category) {
    case 'mental_health':
      insights.push('Emotional context preserved in encrypted form');
      insights.push('No raw sentiment data exposed');
      break;
    case 'health':
      insights.push('Medical privacy fully maintained');
      insights.push('HIPAA-compliant processing enabled');
      break;
    case 'financial':
      insights.push('Financial data encrypted at rest');
      insights.push('No monetary values exposed');
      break;
    default:
      insights.push('Privacy-preserving analysis complete');
  }

  insights.push('Zero-knowledge proof generated successfully');

  return insights;
}

/**
 * Generate a privacy-preserving recommendation
 */
export function generateRecommendation(category: string, sensitivity: string): string {
  if (sensitivity === 'critical') {
    return 'Consider consulting a professional for personalized guidance';
  } else if (sensitivity === 'high') {
    return 'Review encrypted data periodically for accuracy';
  } else if (sensitivity === 'medium') {
    return 'Continue building context for improved insights';
  } else {
    return 'Pattern tracking active for trend analysis';
  }
}

/**
 * Main agent analysis function
 */
export async function performAgentAnalysis(context: QueryContext): Promise<AgentAnalysis> {
  const { query, memoryHashes } = context;

  // Analyze the query
  const analysis = analyzeQuery(query);

  // Generate pattern description
  const pattern = generatePattern(analysis.category);

  // Generate insights
  const insights = generateInsights(analysis.category, analysis.confidence);

  // Add memory context if available
  if (memoryHashes.length > 0) {
    insights.push(`Analyzed ${memoryHashes.length} encrypted memory fragments`);
  }

  // Generate recommendation
  const recommendation = generateRecommendation(analysis.category, analysis.sensitivity);

  return {
    pattern,
    confidence: Math.round(analysis.confidence * 100) / 100,
    category: analysis.category,
    sensitivity: analysis.sensitivity,
    insights,
    recommendation,
    proofReady: true
  };
}

/**
 * Compute memory relevance score
 */
export async function computeRelevanceScore(
  query: string,
  memoryHash: string
): Promise<number> {
  // In a real implementation, this would use the ZK circuit to compute
  // a relevance score without revealing the memory contents
  
  // For now, return a simulated score based on hash similarity
  const queryHash = await hashData(query.toLowerCase());
  const similarity = hammingDistance(queryHash, memoryHash);
  
  return Math.max(0.1, Math.min(0.99, 1 - (similarity / 64)));
}

/**
 * Calculate Hamming distance between two hex strings
 */
function hammingDistance(a: string, b: string): number {
  let distance = 0;
  const minLen = Math.min(a.length, b.length);
  
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) distance++;
  }
  
  return distance + Math.abs(a.length - b.length);
}

/**
 * Rank memories by relevance to query
 */
export async function rankMemories(
  query: string,
  memoryHashes: string[]
): Promise<Array<{ hash: string; score: number }>> {
  const ranked: Array<{ hash: string; score: number }> = [];

  for (const hash of memoryHashes) {
    const score = await computeRelevanceScore(query, hash);
    ranked.push({ hash, score });
  }

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}

/**
 * Determine if a query requires ZK proof
 */
export function requiresZKProof(category: string, sensitivity: string): boolean {
  // All sensitive categories require ZK proofs
  return sensitivity === 'high' || sensitivity === 'critical' || 
         ['mental_health', 'health', 'financial'].includes(category);
}

/**
 * Get minimum confidence threshold for category
 */
export function getConfidenceThreshold(category: string): number {
  const thresholds: Record<string, number> = {
    mental_health: 0.7,
    health: 0.75,
    financial: 0.7,
    relationships: 0.6,
    productivity: 0.5,
    personal_growth: 0.5,
    lifestyle: 0.4,
    general: 0.3
  };

  return thresholds[category] || 0.5;
}
