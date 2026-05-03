import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  let existingParent = {};

  function makeDocRef(path) {
    return {
      path,
      collection(name) {
        return {
          doc(id) {
            return makeDocRef(`${path}/${name}/${id}`);
          },
        };
      },
    };
  }

  const tx = {
    get: vi.fn(async (ref) => ({
      exists: ref.path === 'uaam_results/user-1',
      data: () => existingParent,
    })),
    set: vi.fn(),
    delete: vi.fn(),
  };

  const db = {
    collection: vi.fn((name) => ({
      doc(id) {
        return makeDocRef(`${name}/${id}`);
      },
    })),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };

  return {
    db,
    tx,
    setExistingParent(data) {
      existingParent = data;
    },
  };
});

vi.mock('../../api/lib/firebaseAdmin.js', () => ({
  db: mocks.db,
}));

const { commitAttempt } = await import('../../api/lib/attempts.js');

describe('commitAttempt protected nested fields', () => {
  beforeEach(() => {
    mocks.db.collection.mockClear();
    mocks.db.runTransaction.mockClear();
    mocks.tx.get.mockClear();
    mocks.tx.set.mockClear();
    mocks.tx.delete.mockClear();
  });

  it('preserves analysis.saikaku_integration when a UAAM redo rewrites analysis', async () => {
    mocks.setExistingParent({
      pendingAttemptId: 'attempt-2',
      analysis: {
        type_name: 'Old UAAM type',
        saikaku_integration: { foo: 1 },
      },
    });

    const parentMerge = {
      analysis: {
        type_name: 'New UAAM type',
        narrative: 'new narrative',
      },
    };

    await commitAttempt({
      collection: 'uaam_results',
      uid: 'user-1',
      attemptId: 'attempt-2',
      summary: { typeName: 'New UAAM type', createdAt: null },
      full: { result: null, analysis: parentMerge.analysis, scores: null },
      raw: { input: { answers: {}, vAnswers: {} } },
      parentMerge,
    });

    const parentWrite = mocks.tx.set.mock.calls.find(([ref]) => ref.path === 'uaam_results/user-1');

    expect(parentWrite[1].analysis).toEqual({
      type_name: 'New UAAM type',
      narrative: 'new narrative',
      saikaku_integration: { foo: 1 },
    });
    expect(parentWrite[2]).toEqual({ merge: true });
    expect(parentMerge.analysis).toEqual({
      type_name: 'New UAAM type',
      narrative: 'new narrative',
    });
  });
});
