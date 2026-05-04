import { describe, expect, it } from 'vitest';
import { db } from '../../api/lib/firebaseAdmin.js';
import { clearUserState, getParent } from './_helpers.js';

// firebase-admin Node SDK の set({'a.b': v}, {merge: true}) と
// {a: {b: v}}, {merge:true} の挙動を実 emulator で確定させる

describe('Firestore admin SDK merge semantics', () => {
  it('demonstrates how dotted keys in set() are interpreted', async () => {
    const uid = 'u-merge-debug';
    await clearUserState('uaam_results', uid);
    const ref = db.collection('uaam_results').doc(uid);

    // step 1: nested object 経由で書く
    await ref.set({
      analysis: {
        type_name: 'V1',
        narrative: 'first',
      },
    }, { merge: true });

    const after1 = await getParent('uaam_results', uid);
    console.log('AFTER STEP 1 (nested obj write):', JSON.stringify(after1, null, 2));

    // step 2: dotted key で書く
    await ref.set({
      'analysis.saikaku_integration': { score: 88, marker: 'dotted' },
    }, { merge: true });

    const after2 = await getParent('uaam_results', uid);
    console.log('AFTER STEP 2 (dotted-key write):', JSON.stringify(after2, null, 2));
    console.log('  analysis:', JSON.stringify(after2.analysis));
    console.log('  ["analysis.saikaku_integration"]:', JSON.stringify(after2['analysis.saikaku_integration']));

    // step 3: nested 全体上書き
    await ref.set({
      analysis: {
        type_name: 'V2',
        narrative: 'second',
      },
    }, { merge: true });

    const after3 = await getParent('uaam_results', uid);
    console.log('AFTER STEP 3 (nested obj overwrite):', JSON.stringify(after3, null, 2));
    console.log('  analysis.saikaku_integration?:', after3.analysis?.saikaku_integration);

    // 何が残ったかを確認するassertion (どのみち失敗してもログで判明する)
    expect(after3.analysis?.type_name).toBe('V2');
  });

  it('demonstrates nested object set vs dotted-key set on a fresh doc', async () => {
    const uid = 'u-merge-debug-2';
    await clearUserState('uaam_results', uid);
    const ref = db.collection('uaam_results').doc(uid);

    // Pattern A: nested object 直接 (api/uaam.js の commitAttempt 経由相当)
    await ref.set({
      analysis: { type_name: 'X', saikaku_integration: { from: 'uaam-mock' } },
    }, { merge: true });

    // Pattern B: dotted key (api/integrate.js のパターン)
    await ref.set({
      'analysis.saikaku_integration': { from: 'integrate', score: 88 },
      hasSaikakuIntegration: true,
    }, { merge: true });

    const after = await getParent('uaam_results', uid);
    console.log('FRESH DOC after Pattern A then B:', JSON.stringify(after, null, 2));
    console.log('  analysis:', JSON.stringify(after.analysis));
    console.log('  analysis.saikaku_integration:', JSON.stringify(after.analysis?.saikaku_integration));
    console.log('  literal "analysis.saikaku_integration":', JSON.stringify(after['analysis.saikaku_integration']));

    // Pattern C: もう一度 nested で全置換
    await ref.set({
      analysis: { type_name: 'Y' },
    }, { merge: true });

    const afterC = await getParent('uaam_results', uid);
    console.log('AFTER Pattern C (nested overwrite):', JSON.stringify(afterC, null, 2));
    console.log('  analysis.saikaku_integration?:', afterC.analysis?.saikaku_integration);
    console.log('  literal "analysis.saikaku_integration"?:', afterC['analysis.saikaku_integration']);
  });

  it('verifies update() treats dotted keys as field paths', async () => {
    const uid = 'u-merge-debug-3';
    await clearUserState('uaam_results', uid);
    const ref = db.collection('uaam_results').doc(uid);

    // 初期状態を作る
    await ref.set({
      analysis: { type_name: 'Initial', narrative: 'init narrative' },
    }, { merge: true });

    // update() で dotted-key 書き込み
    await ref.update({
      'analysis.saikaku_integration': { score: 99, marker: 'via-update' },
      hasSaikakuIntegration: true,
    });

    const afterUpdate = await getParent('uaam_results', uid);
    console.log('=== AFTER update() with dotted key ===');
    console.log('analysis.type_name:', afterUpdate.analysis?.type_name);
    console.log('analysis.narrative:', afterUpdate.analysis?.narrative);
    console.log('analysis.saikaku_integration:', JSON.stringify(afterUpdate.analysis?.saikaku_integration));
    console.log('top-level dotted key exists?:', JSON.stringify(afterUpdate['analysis.saikaku_integration']));

    // その後 set() で nested 全置換 (UAAM 2nd commit 相当)
    await ref.set({
      analysis: { type_name: 'V2-after-update', narrative: 'new narrative' },
    }, { merge: true });

    const afterSet = await getParent('uaam_results', uid);
    console.log('=== AFTER set({analysis:{...}}, {merge:true}) ===');
    console.log('analysis.type_name:', afterSet.analysis?.type_name);
    console.log('analysis.narrative:', afterSet.analysis?.narrative);
    console.log('analysis.saikaku_integration:', JSON.stringify(afterSet.analysis?.saikaku_integration));
    console.log('CRITICAL: did set() with merge replace the whole analysis map, or did saikaku_integration survive?');
    console.log('  → if undefined: Plan was right (nested map fully replaced)');
    console.log('  → if {score:99, ...}: Plan was wrong (Firestore deep-merges)');
  });
});
