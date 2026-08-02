# 相性診断：1人モード追加 ＋ 受講者さがしの点数化・順位づけ

作成: 2026-08-01 / リポ: saikaku-architecture / 依頼: つかさ（1人モード＋レコメンド順位づけ、sol相談指定）
sol相談: `sol-20260801T190821-12104-4f239b`（gpt-5.6-sol / xhigh）— 回答を受領し、一次検証のうえ採否を判断済み（§5）

## 0. 過去の決定との関係（接地・最重要）

**今回の依頼は、8日前に自分たちで決めた方針の反転にあたる。**

`plans/compat-matrix-names-20260724.md`（PR #117としてマージ済み・本番稼働中）の「やらないこと」に、明示的にこう書かれている:

> - 相性の数値スコア・**順位付け**・有用度ソート・評価コピー

さらに受講者さがし（D2）の設計にも:

> - **数値・評価表現の禁止**: 有用度ソート・埋まるセル数等の集計数値・「話すと発見が多そう」等の評価コピーを出さない。UIには機械的基準を明記（「…16点以上で持っている人を、**名前の順で**表示します」）
> - impl-2 の Constraints: **順位付け・有用度ソート・集計数値表示・評価コピー禁止。スコア/ランク系フィールド名禁止**

つまり「名前の順で並べる（順位をつけない）」は実装の都合ではなく、つかさ承認済みの**意図的な設計判断**だった。今回の「点数かして順位がつくように」はこれを覆す指示であり、覆す権限はつかさにある。ただし**黙って上書きせず、方針転換として明示的に承認を取る**（§6）。

もう1点、同プランのD2には「不足軸の定義（**R2確定**・マップと同一ルール）: チーム内の軸最高値が12未満、**または担い手ゼロ（データなし）**の軸」という確定決定がある。solはこの「データなし軸からの推薦」を廃止すべきと指摘したが、これも既存の確定決定なので**今回は変更しない**（§5）。

関連: `~/Development/tsukasa-brain/deals/04-saikaku-app.md` の受入条件に「アプリ受講者の中からおすすめの相手が出る」（2026-07-12〜）。今回の依頼はその発展形。

## 1. 今どうなっているか

- 相性診断は管理者専用。モードは **ペア（ちょうど2名）** と **チーム（3〜10名・目的必須）** の2つ（`api/admin/compat-analyze.js:27-31`）。
- レポートは3層: ①LLM生成の2レンズ（似ているところ／違いで補い合えるところ。証拠ID必須・点数と順位は契約で禁止 `api/lib/validateCompatOutput.js`）②マンダラ ③**16×16の力マップ**（16軸×各0〜20点、全組み合わせ120マスを5段階のゾーンに色分け `src/lib/uaamZones.js`）。
- **受講者さがし**（`api/lib/compatRecommend.js` 77行）は「選択メンバー全員が12点未満、またはデータなしの軸」を「16点以上で持つ人」を五十音順に並べるだけ。点数も順位もない。氏名は二段階開示（人数のみ→個別同意→氏名、sha256スナップショットで整合検証）。

## 2. 実データで先に確かめたこと（本番UAAM 51名・全16軸完備・1275ペア）

つかさの指定は「**能力値が近い、かつ 16×16が一番離れている**」。この2条件が両立するかを `firestore_export.json` で先に測った。

| 「地図の遠さ」の測り方 | 平均点差との相関 | 帯（平均点差2以内）での広がり |
|---|---|---|
| ゾーン階級差の平均（＝素直な距離。sol推奨） | **r = 0.89** | 0.09〜0.25（狭い） |
| ゾーンが違うマスの割合 | r = 0.74 | — |
| **片方だけが発動しているマスの割合** | **r = 0.23** | **0.06〜0.61（広い）** |

**判明した罠**: 素直に「ゾーンの階級差」で距離を測ると、それは事実上「平均点の差」の言い換えになる（r=0.89）。つまり「能力値が近い、かつ地図が遠い」を素直に実装すると2条件が打ち消し合い、**100点満点なのに全員が0〜26点（中央10点）に潰れる**。

**採用する測り方**: 「**120マスのうち、片方だけが発動しているマスの数**」。平均点差との相関が0.23と低く、広がりも大きい。意味も明快で「あなたが眠っている領域を、この人は動かしている（またはその逆）」とそのまま日本語になる。

## 3. 採用する式

対象 S（1人、またはチームの軸ごと平均）と候補者 C について:

1. **水準の近さ L** = `max(0, 1 − 平均点の差 / 4.0)` → 平均点の差が4点以上なら0点＝候補から外れる（実データで全ペアの30%が除外）。
2. **地図の違い D** = 120マスで「発動している／していない」が食い違ったマスの割合を rate として `min(1, rate / 0.6)` → 72マス（60%）食い違えば満点。
3. **指標** = `round(100 × √(L × D))`（0〜100の整数）。掛け算なのでどちらかが0なら0＝つかさの「かつ」を満たす。√ は**順位を一切変えない単調変換**で、表示される数字を読みやすくするためだけに使う。

**実データでの見え方**: 中央55点・p90=81点・最大98点。1人の視点では「94点（平均点差0.5・片方だけ発動76/120）」〜「18点（平均点差3.8・片方だけ発動52/120）」と順位が明確につく。

**既知のクセ（先に開示）**: 平均点が非常に高い人（17点台）はほぼ全マスが発動済みのため「片方だけ発動」が構造的に少なく、最高点が57点程度で頭打ちになる。「上級者ほど点が伸びない」という見え方になる（実態としては正しい＝補い合う余地が少ない）。対策案は「対象者自身の未発動マス数を分母にした相対正規化」だが、数字の意味が変わるため**まず絶対値で出し、実データを見てから判断**する。

## 4. 実装プラン

### Phase 1 — 受講者さがしの点数化・順位づけ（本丸）

| # | ファイル | 内容 |
|---|---|---|
| 1-1 | `api/lib/compatRecommend.js` | `buildCompatRanking(profiles, selectedIds)` を追加。16軸合計と120マスの発動ベクトルから §3 の式で整数指標を算出。**浮動小数を一切payloadに入れない**（チーム軸平均は人数1〜10の最小公倍数2520を固定スケールにした整数演算。solの指摘を採用）。既存の `findCompatShortages` / `findCompatCandidates` は**残す**（別の問い＝「誰も持っていない力」に答えているため）。 |
| 1-2 | 同上 | 並び順は「指標降順 → 地図の違い降順 → 平均点差昇順 → profileIdのコードポイント昇順」。**`localeCompare('ja')` は最終tie-breakに使わない**（ICUバージョン差で順位が揺れるため。solの指摘を採用）。 |
| 1-3 | 同上 | データ不足の扱い: 候補者は「16軸すべて計測済み」を条件にし、部分データは減点でなく**対象外**（欠測軸を除外すると不都合な軸が欠けた人ほど高得点になるため。solの指摘を採用）。除外人数は表示する。 |
| 1-4 | `api/admin/compat-recommend.js` | 選択人数の下限を 2 → **1** に拡張（上限10は維持）。レスポンスに `ranking` を追加。二段階開示は維持し、**stage1（search）では指標も氏名も返さない**（該当人数と分布のみ）。stage2（show_names）で初めて氏名＋指標＋順位。監査に `algorithmVersion` / `rankingShown` / `displayedCandidateCount` を追加。上位10件までに制限。 |
| 1-5 | `src/compat/CompatScreen.jsx` | ランキングUI。各候補に「◯点／片方だけ発動 ◯/120マス／平均点の差 ◯点」と、該当する不足軸バッジ（既存ロジックの結果を**説明として**併記）。ラベルは「この組み合わせの学び合い指標」。 |
| 1-6 | `tests/unit/compatRecommend.test.js` | 境界値（平均点差ちょうど4.0＝0点／同一プロフィール＝0点／16軸未満は対象外／スナップショット安定性／並び順の決定論／stage1に氏名とprofileIdと指標が含まれないこと）。 |

### Phase 2 — 1人モード（solの推奨A′を採用）

**`api/admin/compat-analyze.js` には一切手を入れない**。LLMの2レンズ契約・共有契約・発行済み共有URLへの影響をゼロにするため。

| # | ファイル | 内容 |
|---|---|---|
| 2-1 | `api/admin/compat-recommend.js` | 選択1名のとき、対象者本人の決定論データ（16軸スコア＝`uaamMatrix` 形式、診断で見つかった軸、データ充足状況）を `subject` として返す。**新規エンドポイントは作らない**（この関数が既に全プロフィールを読んでいるため。Vercel Function数も増やさない）。 |
| 2-2 | `src/compat/CompatScreen.jsx` | モード切替に「1人」を追加。1人モードでは **LLM分析を呼ばず**、自分の16×16マップ＋相性ランキングを表示。候補から「この人とペア分析する」でペアモードへ引き継ぐ動線を付ける。 |
| 2-3 | `src/compat/CompatReport.jsx` | `lenses` が無い結果でも描画できるようにする（現状 `result.lenses.map` で落ちる）。1人結果は `reportForCompatShare()` に絶対に入らないよう state を分離。 |
| 2-4 | 共有URL | **1人モードは共有対象外**。共有側は `['pair','team']` が3箇所（`api/compat-share.js:29` / `api/lib/compatShare.js:557` / 表示名の件数検証）に固定で入っており、レポート契約も2レンズ必須。ここを緩めると発行済みURLの検証に影響するため触らない。 |

**なぜ1人でLLMを使わないか**: 「似ているところ／違いで補い合えるところ」は2人以上でしか成立しない。1名だと証拠台帳が「診断で見つかった軸」だけになり、2レンズとも「データ不足」の空レポートになる（コストだけかかって中身が出ない）。1人にとっての価値は**自分の16×16マップと相性ランキング**にある。※「自分の地図の特徴を文章で解説する」は別機能として起票可能。

## 5. solの指摘の採否（一次検証つき）

| solの指摘 | 判定 | 根拠 |
|---|---|---|
| soloは compat-analyze に足さず、決定論の別契約にする | **採用** | 既存共有URL・LLM契約への影響がゼロになる。僕の初案（mode:'solo'を追加）より安全 |
| 整数演算（スケール2520）でスナップショットを安定させる | **採用** | float混入はNode版差でハッシュが揺れうる |
| 最終tie-breakに `localeCompare('ja')` を使わない | **採用** | ICU差で順位が揺れる |
| 「データなし軸」からの推薦をやめる（不足ではなく不明） | **不採用（既存決定の維持）** | 指摘の理屈は妥当だが、これは2026-07-24プランで「R2確定」として承認された挙動（§0）。今回の依頼の範囲外なので勝手に覆さない。変えるなら別途つかさ判断。※新設のランキング側では、対象者に欠測がある軸を含むマスを計算対象から外す（欠測を「発動していない」と誤って扱わないため） |
| チーム基準は軸ごと平均（maxではない） | **採用** | 画面のチーム地図と一致する。maxだと軸ごとに別人の最高値を寄せた架空の超人になる |
| 距離は「ゾーン階級差」 | **不採用** | 実測で平均点差と r=0.89 の交絡。点数が0〜26点（中央10点）に潰れる。「片方だけ発動」（r=0.23）へ差し替え |
| 「不足軸を持つ人だけ候補」を必須ゲートにする | **不採用（説明バッジへ降格）** | 実測: **51人中17人（33%）が候補ゼロ**になる（力量の高い人ほど不足軸が無い）。候補数も平均34.8人→8.3人に激減し、つかさの依頼（近い×遠いの順位）が動かなくなる |
| 実名＋点数の順位表示は実質的な人物ランキングなので承認なしにリリースすべきでない | **指摘は正しい／つかさ判断へ**（§6） | 出典を一次検証した結果、solが言う「standing rule」＝グローバル規則 `evaluation-ethics.md` の6原則には人物ランキング禁止の条文は無い（あるのは人事・採用・配属への流用禁止など）。**正しい出典は2026-07-24プランの明示決定と画面見出し「点数はつけません。」**（`CompatScreen.jsx:367`）だった。出典は違うが指摘の実質は正しい |

## 6. 倫理まわりで必ず入れるガードレール（点数を出す場合）

- フィールド名は `score` / `rank` / `rating` を使わず `combinationLearningIndex`。画面ラベルは「この組み合わせの学び合い指標」。
- 注記を併記: 「人物の能力や優劣を評価する点数ではありません。選ぶ相手が変わると値も変わります。人事・採用・配属の判断には使いません。」
- 指標は**stage2（個別同意チェック後）でのみ**返す。stage1は人数のみ。
- 共有ページ・印刷・CSV・APIエクスポートに**絶対に載せない**（共有側は0〜20の生値と score系キーを機械的に拒否する既存ガードをそのまま維持）。
- 監査ログに `algorithmVersion` / `displayedCandidateCount` / `consentConfirmed` を残す。氏名・生スコア・指標そのものは監査に重複保存しない。
- 画面見出し「点数はつけません。」を「**人物には点数をつけません。組み合わせにだけ指標を出します。**」に改める（約束と実装を一致させる）。

## 7. やらないこと

- LLM出力への点数・順位の導入（契約で禁止のまま）。
- 共有ページへの指標表示。
- 候補者本人のオプトインフラグ（既存の保留 H2 のまま）。
- stage1の軸別人数のk匿名化（1〜9人でも実数を返す既存の不整合。今回の変更以前からある論点なので別issueで起票）。

## 8. つかさの承認（2026-08-01）

**①を承認**。方針転換として点数と順位を出す。根拠として本人から示された事実:

> 受験してる人たちは内部のコミュニティで同意済み。コミュニティの中でチームを作っていくために必要。

したがって用途は「**コミュニティ内のチームづくりと相互理解**」と確定する。これは雇用関係の人事評価・合否判定・配属判定ではないため、グローバル倫理規則の禁止対象に当たらない。画面注記は「人事・採用・配属の判断には使いません」から「**コミュニティ内のチームづくりと相互理解のための機能です。雇用・人事・採用・査定の判断には使いません**」へ更新する（用途を正直に書き、禁止領域は維持）。

`docs/design-rationale.md` の「なぜ相性スコアを持たないか」は**必ず更新**する。当時の理由（説明可能性の低下／人事流用の誘発）と、今回それをどう解いたか（内訳の全表示で説明可能性を確保／用途確定とガードレールで流用を抑止）を残す。黙って書き換えず、方針転換として記録する。

## 9. 完了基準

1. `npx vitest run tests/unit/compat*` が全緑（既存＋新規）。
2. 本番51名の実データで代表3名分のランキングを出力し、§3の分布（中央55・上位90台）と一致することを目視確認。
3. stage1応答に氏名・profileId・指標が含まれないことをテストで固定。
4. 1人モードで LLM呼び出しが0件であることを確認（`generateCompatOutput` が呼ばれない経路であることをテストで固定）。
5. 既存のペア／チーム分析と共有URL発行が無変更で通ること（回帰）。

---

## Phase 0: 作業準備

- [x] [id:setup] [required] worktree作成（`feature/compat-solo-ranking`）＋ `npm install --force` ＋ 既存テストのベースライン取得

## Phase 1: 実装 `depends-on: setup`

- [x] [id:impl-1] ランキング純ロジック（`api/lib/compatRecommend.js`）
- **Goal**: `buildCompatRanking(profiles, selectedProfileIds)` を追加。対象S（選択1名、または選択2〜10名の軸ごと平均）と各候補Cについて、①水準の近さ `L = max(0, 1 - |平均点差| / 4.0)` ②地図の違い `D = min(1, rate / 0.6)`（rate = 120マス中「発動している/していない」が食い違うマスの割合。発動 = ゾーンが natural/pro/active）③指標 `= round(100 * sqrt(L * D))` の0〜100整数を計算して返す。既存の `findCompatShortages` / `findCompatCandidates` / `buildCompatRecommendation` は**シグネチャも挙動も変えない**（本番稼働中の二段階開示がこれに依存）。
- **Success**: 返り値に浮動小数を含めない（スナップショットのsha256安定性のため、チーム軸平均は人数1〜10の最小公倍数2520を固定スケールにした整数演算で保持し、payloadには整数のみ）。並び順は「指標降順 → 食い違いマス数降順 → 平均点差の絶対値昇順 → profileIdのコードポイント昇順」。**`localeCompare` を最終tie-breakに使わない**（ICU差で順位が揺れる）。候補資格は「選択されていない内部プロフィール」かつ「16軸すべて計測済み」。対象Sに欠測がある軸を含むマスは計算対象から除外する。対象SにUAAMが無い場合は `{ eligible: false, reason }` を返しランキングを生成しない。除外した候補の人数を `excludedForMissingAxes` として返す。上位10件に切り詰め、切り詰めた件数を `truncated` で返す。
- **Constraints**: フィールド名に `score` / `rank` / `ranking` / `rating` を使わない（`api/lib/validateCompatOutput.js` の禁止キー正規表現と将来の混線を避けるため）。指標のキーは `combinationLearningIndex`、内訳は `levelGapTenths`（平均点差×10の整数）と `distinctCells`（食い違いマス数・0〜120）。LLMを呼ばない。Firestoreスキーマを変えない。`src/lib/uaamZones.js` の `getZone` を使う（ゾーン判定を再実装しない）。`api/lib/compatEvidence.js` の `COMPAT_VISUAL_UAAM_AXES` を軸の正本として使う。
- **Files**: `api/lib/compatRecommend.js`、`tests/unit/compatRecommend.test.js`
- **Verify**: `npx vitest run tests/unit/compatRecommend.test.js`。新規unitで境界を固定すること: 平均点差ちょうど4.0で0点／同一スコアの候補は食い違い0で0点／16軸未満の候補は対象外／入力順を変えてもスナップショットが一致／`localeCompare` 非依存の並び（表示名が同一で profileId だけ違う2件で順序が決定的）／既存4テストが無改変で通ること
- **Assignee**: codex (reasoning: xhigh)

- [x] [id:impl-2] API拡張（`api/admin/compat-recommend.js`）`depends-on: impl-1`
- **Goal**: 選択人数の下限を2→1に拡張（上限10は維持）。`action:'search'` の応答に、氏名もprofileIdも指標も含めずに `rankingSummary`（該当人数・除外人数・ランキング可否）を追加。`action:'show_names'` の応答に上位10件の `ranking`（displayName・combinationLearningIndex・levelGapTenths・distinctCells・該当不足軸チップ）を追加。選択1名のとき、対象者本人の決定論データ `subject`（`uaamMatrix` 形式の16軸スコア＋診断で見つかった軸＋データ充足状況）を返す。
- **Success**: スナップショットは `buildCompatRecommendation` と `buildCompatRanking` の両方を含めて計算し、`show_names` での不一致は既存どおり409。監査 `compat_audits` に `algorithmVersion: 'combination-learning-v1'` / `rankingShown`（真偽）/ `displayedCandidateCount` を追加。氏名・生スコア・指標そのものは監査に保存しない。応答ヘッダに `Cache-Control: private, no-store` を付ける。
- **Constraints**: 新規エンドポイントを作らない（Vercel Function数を増やさない）。`requireAdmin` と `consent === true` の必須チェックを維持。内部メンバー限定の既存制約を維持。`api/admin/compat-analyze.js`・`api/lib/compatShare.js`・`api/compat-share.js`・`api/lib/validateCompatOutput.js` は**1文字も変更しない**（発行済み共有URLの検証に影響するため）。
- **Files**: `api/admin/compat-recommend.js`、`tests/api/admin-compat.test.js`
- **Verify**: `npm run test:api`。テストで固定すること: 1名選択が200になる／0名と11名が400／`search` 応答に displayName・profileId・combinationLearningIndex が含まれない／`show_names` が11件以上返さない／UAAM無しの対象者でランキングが `eligible:false` になる
- **Assignee**: codex (reasoning: xhigh)

- [x] [id:impl-3] UI（1人モード＋ランキング表示）`depends-on: impl-2`
- **Goal**: `src/compat/CompatScreen.jsx` のモード切替に「1人」を追加。1人モードは **`/api/admin/compat-analyze` を呼ばず**、`compat-recommend` から得た `subject` で16×16マップを描き、その下にランキングを出す。ランキング各件に「◯点／120マス中◯マスが片方だけ発動／平均点の差◯点」と該当不足軸チップを表示し、「この人とペア分析する」ボタンでペアモードへ引き継ぐ。`src/compat/CompatReport.jsx` を `lenses` が無い結果でも落ちないようにする。
- **Success**: 1人モードの結果が `reportForCompatShare()` に渡らないよう state を分離する（共有発行ボタンは1人モードで非表示）。指標は個別同意チェックの後にのみ描画する。画面の見出し「点数はつけません。」を「人物には点数をつけません。組み合わせにだけ指標を出します。」へ、受講者さがしの注記を「コミュニティ内のチームづくりと相互理解のための機能です。雇用・人事・採用・査定の判断には使いません。」へ更新。指標の直下に「相手が変われば値も変わります」を常時表示。
- **Constraints**: 共有・印刷・CSV・コピーの導線を指標に付けない。ペア／チームの既存挙動を変えない。`compat.css` の既存クラス設計に合わせる。
- **Files**: `src/compat/CompatScreen.jsx`、`src/compat/CompatReport.jsx`、`src/compat/compat.css`、`tests/unit/compatScreen.test.jsx`
- **Verify**: `npm run test:unit` と `npm test`。テストで固定すること: 1人モードで analyze API が呼ばれない／同意チェック前に指標が描画されない／1人モードで共有UIが出ない／ペア・チームの既存テストが無改変で通る
- **Assignee**: codex (reasoning: xhigh)

## Phase 2: 品質ゲート `depends-on: impl-1, impl-2, impl-3`

- [x] [id:quality] 全テスト green ＋ 実データ照合
- 実データ51名（`firestore_export.json`）で `buildCompatRanking` を回し、§3の分布（中央55点・上位90点台・平均点差4以上が0点）と一致することを確認する。一致しなければ実装が式どおりでない。
- 1人モードで LLM 呼び出しが0件であることを確認する。

## Phase 3: ドキュメント同期 `depends-on: quality`

- [x] [id:docs] [required] `docs/design-rationale.md` の「なぜ相性スコアを持たないか」に方針転換を追記（当時の理由2点／今回の解き方／用途の確定／ガードレール）。§0で引用した2026-07-24プランの「やらないこと」との関係も明記する。

## Phase 4: PR `depends-on: docs`

- [x] [id:pr] PR #122 作成 https://github.com/halucloud9-code/saikaku-architecture/pull/122 （マージはつかさの人間ゲート）
- [x] [id:codex-loop] [required] Codex bot レビューループ完了（3周・採用8件/棄却0件・最終 👍 @ 2026-08-02T01:58:52Z）

## Deviations

- [impl-1] 仕様に「既存テスト5件」と書いたが実際は6件（僕の数え違い。実害なし、Codexは6件すべて維持）。ベースラインのファイル数も `npm run test:unit`（25ファイル/src/screens込み）と `npx vitest run tests/unit`（23ファイル）で食い違い、Codexが後者で報告。テスト総数は一致しており実害なし。
- [quality] E2Eスクリーンショットで実画面を見たところ、1人モードなのにマトリックスの見出しが「チーム発動領域Matrix」、説明文も「チーム平均から判定」だった。ユニットテストでは検出できない種類の欠陥。`CompatMatrix.jsx` に単独表示の文言分岐を追加（保守的: 2名以上の文言は byte 一致で維持し、回帰テストで固定）。
- [quality] 上記を1件直して終わらせず同型を全数掃引したところ、受講者さがし側にも「チームにない力を持つ受講者を探す」「チームで12点未満」等が5箇所残っていた。まとめて1人モード用の文言へ分岐させ、2名以上は無変更のまま回帰テストで固定した。
- [quality] E2Eスペック追加を委任した際、Codex は `CompatMatrix` 文言修正時に E2E 側の期待値2行を更新しなかった（verify-cmd に e2e を含めていなかったため機械検出できず）。僕が手で更新し、solo E2E を再実行して緑を確認した。
- [impl-2] Codex が既存の409回帰テスト `returns 409 without a names audit when a profile changes after search` を**置き換えた**（不足軸経由の失効検証が消え、ランキング経由のみになっていた）。受け入れ検査で検出し `--resume` で差し戻し、両方を並存させた（+224/-0、`it(` 33件 = 既存27 + 新規6）。以後の委任には verify-cmd に「tests/ の削除行数が0であること」を機械条件として追加した（保守的: 既存契約の暗黙削除を機械で止める）。
- [codex-loop] 2周目のP1指摘は、1周目で直した「部分データ時に分母が比較可能な集合へ揃っていない」問題の**地図距離側の見落とし**だった。同じクラスを片側だけ直していたため、参照側にも候補者と同じ16項目必須を課して構造的に閉じた（保守的: 分母を可変にして薄いデータで指標を出し続けるより、出さない方を選択）。
- [codex-loop] 
> saikaku-ryoiki@1.0.0 test:api
> PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH firebase emulators:exec --only auth,firestore --project demo-saikaku 'cross-env NODE_ENV=test MOCK_ANTHROPIC=1 TEST_BYPASS_AUTH=1 vitest run tests/api'

i  emulators: Starting emulators: auth, firestore
i  emulators: Detected demo project ID "demo-saikaku", emulated services will use a demo configuration and attempts to access non-emulated services for this project will fail.
i  firestore: Firestore Emulator logging to firestore-debug.log
✔  firestore: Firestore Emulator was started in standard edition.
✔  firestore: Firestore Emulator UI websocket is running on 9150.
i  Running script: cross-env NODE_ENV=test MOCK_ANTHROPIC=1 TEST_BYPASS_AUTH=1 vitest run tests/api

 RUN  v4.1.6 /Users/altis/Development/saikaku-architecture


 Test Files  24 passed (24)
      Tests  185 passed (185)
   Start at  10:59:45
   Duration  38.26s (transform 833ms, setup 1.43s, import 11.61s, tests 21.64s, environment 1ms)

✔  Script exited successfully (code 0)
i  emulators: Shutting down emulators.
i  firestore: Stopping Firestore Emulator
i  auth: Stopping Authentication Emulator
i  hub: Stopping emulator hub
i  logging: Stopping Logging Emulator は共有エミュレータ起因で単発1件が間欠的に落ちる（本セッションで2回発生／その後4回連続green）。失敗テスト名は再現できず未特定。本変更由来ではないが、特定できていないことを明記して残す。
