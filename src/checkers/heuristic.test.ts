import { describe, it, expect } from 'vitest';
import { checkIndexHeuristic } from './heuristic.js';

describe('checkIndexHeuristic', () => {
  it('returns indexed=true with high confidence when keywords > 0', () => {
    const result = checkIndexHeuristic({ keywordsTop100: 42, traffic: 0, backlinks: 0 });
    expect(result.indexed).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('returns indexed=true with high confidence when traffic > 0', () => {
    const result = checkIndexHeuristic({ keywordsTop100: 0, traffic: 500, backlinks: 0 });
    expect(result.indexed).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('returns indexed=true with medium confidence when backlinks>0 and domain age>1yr', () => {
    const result = checkIndexHeuristic({
      keywordsTop100: 0,
      traffic: 0,
      backlinks: 10,
      domainAgeYears: 2,
    });
    expect(result.indexed).toBe(true);
    expect(result.confidence).toBe('medium');
  });

  it('returns indexed=false with low confidence when no positive signals', () => {
    const result = checkIndexHeuristic({ keywordsTop100: 0, traffic: 0, backlinks: 0 });
    expect(result.indexed).toBe(false);
    expect(result.confidence).toBe('low');
  });

  it('returns indexed=false when backlinks>0 but domain is new (<1yr)', () => {
    const result = checkIndexHeuristic({
      keywordsTop100: 0,
      traffic: 0,
      backlinks: 5,
      domainAgeYears: 0.5,
    });
    expect(result.indexed).toBe(false);
    expect(result.confidence).toBe('low');
  });
});
