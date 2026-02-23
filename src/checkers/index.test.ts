import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkIndex } from './index.js';
import { checkIndexHeuristic } from './heuristic.js';
import { checkIndexGoogleCSE } from './google-cse.js';
import type { HeuristicSignals } from '../types.js';

vi.mock('./heuristic.js', () => ({
  checkIndexHeuristic: vi.fn(),
}));

vi.mock('./google-cse.js', () => ({
  checkIndexGoogleCSE: vi.fn(),
}));

const mockHeuristic = vi.mocked(checkIndexHeuristic);
const mockCSE = vi.mocked(checkIndexGoogleCSE);

beforeEach(() => {
  vi.clearAllMocks();
});

const signals: HeuristicSignals = {
  keywordsTop100: 50,
  traffic: 200,
  backlinks: 10,
};

describe('checkIndex orchestrator', () => {
  it('returns heuristic result when confidence is high (no CSE call)', async () => {
    mockHeuristic.mockReturnValueOnce({
      indexed: true,
      confidence: 'high',
      method: 'heuristic',
      signals,
    });

    const result = await checkIndex({ domain: 'high.com', signals });

    expect(result.indexed).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.method).toBe('heuristic');
    expect(mockHeuristic).toHaveBeenCalledOnce();
    expect(mockCSE).not.toHaveBeenCalled();
  });

  it('returns heuristic result when confidence is medium (no CSE call)', async () => {
    mockHeuristic.mockReturnValueOnce({
      indexed: true,
      confidence: 'medium',
      method: 'heuristic',
      signals,
    });

    const result = await checkIndex({ domain: 'medium.com', signals });

    expect(result.confidence).toBe('medium');
    expect(mockCSE).not.toHaveBeenCalled();
  });

  it('falls through to CSE when heuristic confidence is low', async () => {
    mockHeuristic.mockReturnValueOnce({
      indexed: false,
      confidence: 'low',
      method: 'heuristic',
      signals,
    });
    mockCSE.mockResolvedValueOnce({
      indexed: true,
      confidence: 'high',
      method: 'google-cse',
      indexedPagesCount: 5,
    });

    const result = await checkIndex({ domain: 'low.com', signals });

    expect(result.indexed).toBe(true);
    expect(result.method).toBe('google-cse');
    expect(mockCSE).toHaveBeenCalledWith('low.com');
  });

  it('calls CSE directly when no signals provided', async () => {
    mockCSE.mockResolvedValueOnce({
      indexed: false,
      confidence: 'high',
      method: 'google-cse',
      indexedPagesCount: 0,
    });

    const result = await checkIndex({ domain: 'nosignals.com' });

    expect(result.method).toBe('google-cse');
    expect(mockHeuristic).not.toHaveBeenCalled();
    expect(mockCSE).toHaveBeenCalledWith('nosignals.com');
  });

  it('returns heuristic low-confidence result when CSE throws and signals exist', async () => {
    const lowResult = {
      indexed: false,
      confidence: 'low' as const,
      method: 'heuristic' as const,
      signals,
    };
    mockHeuristic.mockReturnValueOnce(lowResult);
    mockCSE.mockRejectedValueOnce(new Error('CSE API rate limit'));

    const result = await checkIndex({ domain: 'cse-fail.com', signals });

    expect(result.indexed).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.method).toBe('heuristic');
  });

  it('returns safe fallback when CSE throws and no signals exist', async () => {
    mockCSE.mockRejectedValueOnce(new Error('GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX must be set'));

    const result = await checkIndex({ domain: 'no-creds.com' });

    expect(result.indexed).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.method).toBe('heuristic');
  });

  it('calls CSE when forceCSE is true even with high-confidence signals', async () => {
    mockCSE.mockResolvedValueOnce({
      indexed: true,
      confidence: 'high',
      method: 'google-cse',
      indexedPagesCount: 100,
    });

    const result = await checkIndex({ domain: 'forced.com', signals, forceCSE: true });

    expect(result.method).toBe('google-cse');
    expect(mockHeuristic).not.toHaveBeenCalled();
  });
});
