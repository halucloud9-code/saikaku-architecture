import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

export async function setupRulesTest() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-saikaku',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
  await testEnv.clearFirestore();
  return testEnv;
}

export async function cleanupRulesTest(testEnv) {
  await testEnv?.cleanup();
}

export function authedDb(testEnv, uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

export async function seedDoc(testEnv, path, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}
