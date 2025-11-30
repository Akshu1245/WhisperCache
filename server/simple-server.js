const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ZK Proof endpoint
app.post('/api/zk/prove', (req, res) => {
  const query = req.body.query || 'default query';
  
  // Simulate ZK proof generation delay
  setTimeout(() => {
    // Generate different responses based on query keywords
    let result = 'Pattern analysis complete';
    let confidence = 0.85 + Math.random() * 0.14;
    
    if (query.toLowerCase().includes('health') || query.toLowerCase().includes('stress') || query.toLowerCase().includes('anxiety')) {
      result = 'Elevated stress pattern detected';
      confidence = 0.89 + Math.random() * 0.10;
    } else if (query.toLowerCase().includes('spending') || query.toLowerCase().includes('money') || query.toLowerCase().includes('financial')) {
      result = 'Unusual spending pattern identified';
      confidence = 0.82 + Math.random() * 0.15;
    } else if (query.toLowerCase().includes('relationship') || query.toLowerCase().includes('personal')) {
      result = 'Interpersonal stress signals detected';
      confidence = 0.78 + Math.random() * 0.18;
    }
    
    res.json({
      result: 'ok',
      confidence: Math.min(confidence, 0.99),
      proofHash: 'mn_' + Math.random().toString(36).slice(2, 14),
      pattern: result,
      query: query,
      timestamp: new Date().toISOString()
    });
  }, 800);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    networks: {
      midnight: { connected: true, latency: 45 },
      cardano: { connected: true, latency: 120 }
    }
  });
});

// Anchor endpoint
app.post('/api/anchor', (req, res) => {
  setTimeout(() => {
    res.json({
      txId: 'cardano_' + Math.random().toString(36).slice(2, 14),
      status: 'confirmed',
      blockHeight: 8294721 + Math.floor(Math.random() * 100)
    });
  }, 500);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🔒 WhisperCache API Server running on port ${PORT}`);
  console.log(`🌙 Midnight Devnet: Connected`);
  console.log(`⚡ Cardano Preprod: Connected`);
});
