// 全スコアを0にリセット — dotenv不要版
// 実行: node reset-scores.mjs

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: 'saikaku-architecture',
      privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDBpBf01wQs4I6l
BwlEwQ+pPDSwWCwJ6mirxkpqr9kZsPS8DLJvCvS9vnOZvz7DE06I7bYHcerbcMUx
5oHoQiMjsRd0qJlstWElZd6QOzRC1OFX6VtkbqGJCvdrQX9w4co4fYJ37gEm4Cx2
67luTn47U7jWmz/B5rVntgj1+KIP4T+6JnBfbFOSihRCyZwq8EODNn/y10l8QUgj
BDy7/YQhGg1QAzoup+pXHgVzRU8z+b7D4AGJeqginDlajhKrvntp7xx2XeE1VcwX
BT+zK9ojvuHK9BNECeZVJYjYShtznO+xHoJzbgSm2TsWtCa5j+9m0+vWcbQLMSTp
JLwoNy5tAgMBAAECggEAWWg+JW63v07JnfnTNjsb04x4WWnEn6lrPdC24G6kA2A4
h7EnG+1HlmpersDmJiT+cGutTd+zzDFT41fmaEpNNjgYt+T2vgI7Qgy4iAjF9wua
pkAZUhRgokl9drjNsl2WRKHywRQT1RLRhPEO85brYtIjuHcDJ7Cx1ppupb9weHq/
Gh47Tgyct6qm0Jadtr1sj0/rDsi3yvTLUNH5Zr246OaX1XiNZLpv+zpflsg80hH8
qJyMjMY5VthN5Pw/aK73pgj1GG1j1F11zqfbgjqVqMBnfY5doCqRMHgq4LVSh+yN
1E3yfVKflIotadWFtvlL/ICUng83sCUjivAZAUszAwKBgQDf2xgIkHdee7VW0ZHP
gwk8QZ/8cc8KRJ4KfnhGG0Wd04q1+u1DlzKTBqbO8Bj0sxQ6dwAyDwr1TYT/c08z
VmrjZ33/eMPYUM0H2u4JWwY/5Rek9BbekiZw0uPeOEQfW1rf7VxYHeNUNRt3L2TV
C6v2onEB3GESQYtUQ1CXIr+sMwKBgQDdck6AEdxG4Bc4VRjVLSyQZK5L2OJkLrhM
z5OsRiBBG+YYAwX1MX5prg6uS03KmibYGxFNDcap60WkCrwXjktFOheCuqtYpPh9
Z8TgbkT3GtHbnIDAcqfbxDEh5s/gNUASQM9TrkztPNIiKp6OctWV6XVNFQQkiDSm
guZWsjEa3wKBgFVYWI9bVMdG7toMyESPNsQsWOyMD11gz8g8c2p3F1GWxzmeUzsD
uBpp3Mrkqv8QD1RC7mYnagwf4+bodXejKNlOKbFuv2wHUkP+aeZTN8zAcQVIsjdl
DRbSsGGWnhI+aCUbf6twqaz/GluUTCMVchhz0hXdiXzGVHJpv53/d4gVAoGAUxJT
YnXQxYHBFC/QHgBRTGWIgQl+fAiOuLnR8vlnliUqHu3baUzE2E4kUbwMFanYUo9s
4RP+57VLrasdPlTx5alSModmSd2xHhI0Z+DV3EDiYtkF76vTTnz91XLpnnk7bN2F
KSYk04ZSaeDFFDj96Lvodh8hK7cw0Rof4Hv+Mc8CgYA83JReMeazvNhlqO4nfXiS
UIktpo8H8YIPyeXSRKghjhwXfrL3l/RPkLZxatbSwGWN/a77hLBTMFfOakWFi/C2
ayl1iRfgJR84aFrAT2PZGKf6GRpQcxV/xtmBzmwkhRhko5HihZlaRd++4i7f0n4Y
dicmcfKD2KsTw+NVIRBDZw==
-----END PRIVATE KEY-----`,
      clientEmail: 'firebase-adminsdk-fbsvc@saikaku-architecture.iam.gserviceaccount.com',
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

const zeroScores = {
  mindset:    { total: 0, max: 80, percentage: 0, domainTotal: 0, subs: { meaning: 0, mindfulness: 0, mindshift: 0, mastery: 0 } },
  literacy:   { total: 0, max: 80, percentage: 0, domainTotal: 0, subs: { learning: 0, logical: 0, life: 0, leadership: 0 } },
  competency: { total: 0, max: 80, percentage: 0, domainTotal: 0, subs: { critical: 0, creativity: 0, communication: 0, collaboration: 0 } },
  impact:     { total: 0, max: 80, percentage: 0, domainTotal: 0, subs: { idea: 0, innovation: 0, implementation: 0, influence: 0 } },
};

console.log('Firebase接続中...');
const user = await auth.getUserByEmail('halu.cloud9@gmail.com');
console.log(`UID: ${user.uid}`);

await db.collection('uaam_results').doc(user.uid).set({ scores: zeroScores }, { merge: true });
console.log('✅ 全16スコアを0にリセット完了');
