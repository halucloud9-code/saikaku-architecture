import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SymmetricMatrix } from '../src/screens/uaam/AllPairsTriangle';
import { multiZoneFixture } from './fixtures/scores-fixture.js';

// GRIFFON CODE セクションの「click! GRIFFON CODE」「▴ 閉じる」は
// このセクション固有の文字列のためグローバル query で安全に取得できる。
// PRO/ACTIVE 等のラベルは凡例にも現れるため、ここでは使わない。
const CLICK_LABEL_RE = /click! GRIFFON CODE/;
const CLOSE_LABEL = '▴ 閉じる';

describe('SymmetricMatrix > GRIFFON CODE カード複数同時展開', () => {
  it('初期状態: 全カードが閉じている', () => {
    render(<SymmetricMatrix scores={multiZoneFixture} />);

    const clickBtns = screen.getAllByText(CLICK_LABEL_RE);
    // fixture が複数ゾーンを生成することの最小保証
    expect(clickBtns.length).toBeGreaterThanOrEqual(2);

    // 「▴ 閉じる」は1つも表示されていない
    expect(screen.queryAllByText(CLOSE_LABEL)).toHaveLength(0);
  });

  it('複数同時展開: 各カードを順次クリックすると全カード同時に開く', async () => {
    const user = userEvent.setup();
    render(<SymmetricMatrix scores={multiZoneFixture} />);

    const clickBtns = screen.getAllByText(CLICK_LABEL_RE);
    const totalCards = clickBtns.length;

    for (const btn of clickBtns) {
      await user.click(btn);
    }

    // 全カードが展開状態 = 「▴ 閉じる」がカード数ぶん表示
    expect(screen.getAllByText(CLOSE_LABEL)).toHaveLength(totalCards);
    // 「click! GRIFFON CODE」は全て消えている
    expect(screen.queryAllByText(CLICK_LABEL_RE)).toHaveLength(0);
  });

  it('独立性回帰: 1カード開いた状態で別カードを開いても、既存の展開は維持される', async () => {
    const user = userEvent.setup();
    render(<SymmetricMatrix scores={multiZoneFixture} />);

    const clickBtns = screen.getAllByText(CLICK_LABEL_RE);
    expect(clickBtns.length).toBeGreaterThanOrEqual(2);

    // 1枚目を展開
    await user.click(clickBtns[0]);
    expect(screen.getAllByText(CLOSE_LABEL)).toHaveLength(1);

    // 2枚目を展開（残った click! ボタンから取り直す: re-render で参照切れのため）
    const remaining = screen.getAllByText(CLICK_LABEL_RE);
    await user.click(remaining[0]);

    // 2枚同時に展開状態
    expect(screen.getAllByText(CLOSE_LABEL)).toHaveLength(2);
  });

  it('個別クローズ: 複数開いた状態で1カードを再クリックすると、そのカードのみ閉じる', async () => {
    const user = userEvent.setup();
    render(<SymmetricMatrix scores={multiZoneFixture} />);

    const clickBtns = screen.getAllByText(CLICK_LABEL_RE);
    const totalCards = clickBtns.length;

    // 全カード展開
    for (const btn of clickBtns) {
      await user.click(btn);
    }
    expect(screen.getAllByText(CLOSE_LABEL)).toHaveLength(totalCards);

    // 1枚目の「▴ 閉じる」をクリック（親カードへ bubble してトグル）
    const closes = screen.getAllByText(CLOSE_LABEL);
    await user.click(closes[0]);

    // 残り N-1 枚は開いたまま、1枚だけ閉じる
    expect(screen.getAllByText(CLOSE_LABEL)).toHaveLength(totalCards - 1);
    expect(screen.getAllByText(CLICK_LABEL_RE)).toHaveLength(1);
  });
});
