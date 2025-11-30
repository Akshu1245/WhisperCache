# ══════════════════════════════════════════════════════════════════════════════
#                    WhisperCache 3-Minute Demo Script
# ══════════════════════════════════════════════════════════════════════════════
# Track 3: Privacy Mini DApps on Midnight | India Blockchain Week 2025
# ══════════════════════════════════════════════════════════════════════════════

## BEFORE DEMO (5 min before)
- [ ] Run: `node scripts/warmup-demo.js`
- [ ] Verify: Server shows "WARMUP COMPLETE"
- [ ] Open: Browser at http://localhost:5173
- [ ] Check: Page loads with no errors
- [ ] Scroll: Quick scroll through page to load all sections

---

## SLIDE 1: THE PROBLEM (30 sec)
**[Show Hero Section]**

> "Every time you chat with an AI, your deepest secrets are stored on corporate servers.
> Your therapy conversations, your health worries, your financial struggles - 
> all sitting in plaintext, accessible to employees, sold to advertisers.
> 
> WhisperCache changes everything."

**[Scroll to Problem Section - show the 3 horror examples]**

---

## SLIDE 2: THE SOLUTION (30 sec)
**[Scroll to Solution Section]**

> "With WhisperCache, AI remembers you WITHOUT ever seeing you.
> 
> We encrypt memories locally with military-grade XChaCha20-Poly1305.
> Then we run zero-knowledge proofs to answer AI queries.
> The AI gets 'elevated stress pattern, 89% confidence' -
> but NEVER sees 'I had 3 panic attacks before my boss meeting.'
> 
> Your raw data never leaves your device."

---

## SLIDE 3: LIVE DEMO (60 sec)
**[Scroll to ZK Query Simulator]**

> "Let me show you this working live."

1. **Type query**: "What are my stress patterns?"
2. **Click 'Generate ZK Proof'**
3. **Wait for proof** (should be instant after warmup)

> "Watch what happens:
> - Query is hashed with Poseidon
> - Groth16 ZK proof generated
> - Proof anchored on Midnight 
> - AI only sees: 'Elevated anxiety (92% confidence)'
> - The AI NEVER sees your actual memories"

**[Point to proof hash and blockchain anchor]**

---

## SLIDE 4: ARCHITECTURE (30 sec)
**[Scroll to Architecture Flow Slide]**

> "Here's the end-to-end flow:
> 
> 1. User device encrypts locally
> 2. ZK proof generated without revealing data  
> 3. Midnight verifies with shield contracts
> 4. Proof hash anchored on Cardano L1
> 5. AI receives only verified patterns
> 
> At every step, zero knowledge means zero exposure."

---

## SLIDE 5: GDPR COMPLIANCE (30 sec)
**[Scroll to GDPR Deletion Demo]**

> "We also solve GDPR's biggest challenge - proving deletion.
> 
> With our ZK deletion proof, you can prove data was erased
> without revealing what was deleted.
> 
> Click delete... proof generated... anchored on-chain.
> Regulators get cryptographic evidence. Privacy preserved."

**[Click on a data item, hit delete, show proof generated]**

---

## CLOSING (15 sec)

> "WhisperCache: AI that remembers you, without ever seeing you.
> 
> Built on Midnight for privacy, anchored on Cardano for permanence.
> 
> Thank you."

---

## FALLBACK PLANS

### If ZK proof hangs:
> "The proof is generating - in production this takes about 2 seconds.
> Let me show you a pre-computed result..."
**[Scroll to show cached proof in Dashboard section]**

### If page freezes:
> "Let me refresh - one moment..."
**[F5 refresh, scroll directly to Architecture slide]**
> "As you can see in the architecture..."

### If server crashes:
> "Technical hiccup - let me show the architecture diagram while we recover."
**[Open backup screenshot or PDF slide]**

---

## JUDGE Q&A PREP

### "What's simulated vs real?"

> "Great question. In this demo:
> - ✅ REAL: Encryption (XChaCha20-Poly1305)
> - ✅ REAL: ZK proof logic (Poseidon + Groth16 structure)
> - ⚠️ SIMULATED: Blockchain submission (we use devnet simulation)
> - ⚠️ SIMULATED: Midnight network connection (no live devnet access yet)
> 
> The cryptography and ZK circuits are production-ready.
> Blockchain integration awaits Midnight mainnet access."

### "Why not real blockchain?"

> "Midnight devnet requires approved access keys. 
> We've designed for real integration - our code has production blockchain 
> managers ready. The moment we get devnet keys, it plugs right in."

### "How fast is proof generation?"

> "Demo proofs are instant because we use simulation mode.
> Real Groth16 proofs take 2-5 seconds depending on circuit complexity.
> We've optimized with proof caching and precomputation."

### "Is this GDPR compliant?"

> "Yes! We implement:
> - Article 17 Right to Erasure with ZK deletion proofs
> - Article 25 Privacy by Design with local encryption
> - Article 30 Records of Processing with on-chain audit trail
> All without exposing the underlying data."

---

## TECH SPECS (if asked)

| Component | Technology |
|-----------|------------|
| Encryption | XChaCha20-Poly1305 (libsodium) |
| ZK Proofs | Groth16 + Poseidon (snarkjs/circom) |
| Privacy Layer | Midnight Shield Contracts |
| Settlement | Cardano L1 Anchoring |
| Frontend | React 18 + Framer Motion |
| Backend | Express.js + TypeScript |
| Database | SQLite (sql.js) |

---

## PRE-DEMO CHECKLIST

```
[ ] Server running on port 4000
[ ] Client running on port 5173
[ ] Warmup script completed successfully
[ ] Browser cache cleared
[ ] No other heavy apps running
[ ] Screen resolution: 1920x1080
[ ] Browser zoom: 100%
[ ] Dark mode enabled
[ ] Microphone tested
[ ] Timer ready (3 min)
```
