export const AXES_DEF = {
  mindset: {
    subs: ['meaning', 'mindfulness', 'mindshift', 'mastery'],
  },
  literacy: {
    subs: ['learning', 'logical', 'life', 'leadership'],
  },
  competency: {
    subs: ['critical', 'creativity', 'communication', 'collaboration'],
  },
  impact: {
    subs: ['idea', 'innovation', 'implementation', 'influence'],
  },
};

export const QUESTIONS = [
  { id: 1,  axis: 'mindset', sub: 'meaning',     text: '今日の行動の多くが、自分の在り方（人生の目的）を起点に選べている。', reverse: false },
  { id: 2,  axis: 'mindset', sub: 'meaning',     text: '目的より、いつもの癖や流れで動くことが多い。', reverse: true },
  { id: 3,  axis: 'mindset', sub: 'meaning',     text: '損得や感情より先に、自分が大切にしている在り方を基準にして選択できている。', reverse: false },
  { id: 4,  axis: 'mindset', sub: 'meaning',     text: '関わりのある人から、目的を持って生きている人だと感じ取られている。', reverse: false },
  { id: 5,  axis: 'mindset', sub: 'mindfulness', text: '防衛反応が出たときに気づき、本来の自分のあり方と行動に立ち戻ることが多い。', reverse: false },
  { id: 6,  axis: 'mindset', sub: 'mindfulness', text: '感情的に反応したまま、その状態を一日中引きずってしまうことがある。', reverse: true },
  { id: 7,  axis: 'mindset', sub: 'mindfulness', text: '急な変化があっても、文句や不安より先に「じゃあどうするか」に意識が向く。', reverse: false },
  { id: 8,  axis: 'mindset', sub: 'mindfulness', text: '周囲の人が、自分との対話を通じて「見えていなかった自分」に気づき始めている。', reverse: false },
  { id: 9,  axis: 'mindset', sub: 'mindshift',   text: '「自分にはどうせ無理」という声が出たとき、それを事実として扱わずにいられる。', reverse: false },
  { id: 10, axis: 'mindset', sub: 'mindshift',   text: '望ましいあり方がわかっていても、つい防衛的な反応で動いてしまうことがある。', reverse: true },
  { id: 11, axis: 'mindset', sub: 'mindshift',   text: '新しいものを生み出すために、あえて今までのやり方を手放すことがある。', reverse: false },
  { id: 12, axis: 'mindset', sub: 'mindshift',   text: '行き詰まった場面で、思考の突破口を求めて最初に相談される立場にいる。', reverse: false },
  { id: 13, axis: 'mindset', sub: 'mastery',     text: '学んだことを、夢に向けた日々の行動に落とし込み、成果につなげられている。', reverse: false },
  { id: 14, axis: 'mindset', sub: 'mastery',     text: '実践しようと決めたことが、気づけば他の優先事項に埋もれてしまうことがある。', reverse: true },
  { id: 15, axis: 'mindset', sub: 'mastery',     text: '意識せず自然にした行動であっても、誰かにプラスの影響を与えている。', reverse: false },
  { id: 16, axis: 'mindset', sub: 'mastery',     text: '自分のやり方や考え方を、周囲が自発的に取り入れている。', reverse: false },
  { id: 17, axis: 'literacy', sub: 'learning',   text: '新しい学びに触れるとき、先入観を除いて学ぶ意識がある。', reverse: false },
  { id: 18, axis: 'literacy', sub: 'learning',   text: '人から聞いたことや学んだことを、そのまま受け売りで使ってしまうことがある。', reverse: true },
  { id: 19, axis: 'literacy', sub: 'learning',   text: '学んでも忘却しては意味がないので、必ず自分に落とし込むための行動をする。', reverse: false },
  { id: 20, axis: 'literacy', sub: 'learning',   text: '学び方そのものについて、周囲から継続的に質問や相談が寄せられている。', reverse: false },
  { id: 21, axis: 'literacy', sub: 'logical',    text: '目的に応じて、論理で伝えるかストーリーで伝えるかを使い分けることが習慣になっている。', reverse: false },
  { id: 22, axis: 'literacy', sub: 'logical',    text: '相手に合わせすぎたり、情報を詰め込みすぎたりして、かえって要点がぼやけてしまうことがある。', reverse: true },
  { id: 23, axis: 'literacy', sub: 'logical',    text: '自分が出した指示や依頼は、相手が追加の確認をほとんど必要とせず動ける形で伝えられている。', reverse: false },
  { id: 24, axis: 'literacy', sub: 'logical',    text: '自分が説明した後に、相手の表情や行動が明確に変わる場面が繰り返されている。', reverse: false },
  { id: 25, axis: 'literacy', sub: 'life',       text: '学んだことを、実際の現場や日常で試してみる行動を自然と繰り返している。', reverse: false },
  { id: 26, axis: 'literacy', sub: 'life',       text: '学んだ知識を溜め込むばかりで、現場のやり方は今までどおりのままになっていることがある。', reverse: true },
  { id: 27, axis: 'literacy', sub: 'life',       text: '自分が学んだことが、具体的な現場の成果や変化として現れている。', reverse: false },
  { id: 28, axis: 'literacy', sub: 'life',       text: '理論を現場に落とし込む役割として、周囲から自然と頼りにされている。', reverse: false },
  { id: 29, axis: 'literacy', sub: 'leadership', text: 'チームや周囲の人が、自分の目的・方向性を理解した上で動いている状態を作れている。', reverse: false },
  { id: 30, axis: 'literacy', sub: 'leadership', text: '自分が方向性を示しても、周囲が様子見のまま動き出すのに時間がかかることがある。', reverse: true },
  { id: 31, axis: 'literacy', sub: 'leadership', text: 'チーム内の人間関係の摩擦をチャンスに変え、関係を築くことができる。', reverse: false },
  { id: 32, axis: 'literacy', sub: 'leadership', text: '自分が関わることで、チーム全体の方向性が定まり、各メンバーの動きに一貫性が生まれている。', reverse: false },
  { id: 33, axis: 'competency', sub: 'critical',      text: '自分の判断について、根拠と仮説を分けて整理しながら説明できている。', reverse: false },
  { id: 34, axis: 'competency', sub: 'critical',      text: '先にネガティブな結論を決めてしまい、その結論に合う理由ばかりを後から集めてしまうことがある。', reverse: true },
  { id: 35, axis: 'competency', sub: 'critical',      text: '周囲が見落としていた論点や本質を、自分が先に整理して言葉にすることがある。', reverse: false },
  { id: 36, axis: 'competency', sub: 'critical',      text: '企画や計画の穴を見つける場面で、自分への検証依頼が真っ先に来ている。', reverse: false },
  { id: 37, axis: 'competency', sub: 'creativity',    text: '問題を解決するとき、自分の専門外からもヒントを取り入れている。', reverse: false },
  { id: 38, axis: 'competency', sub: 'creativity',    text: '新しい発想が必要でも、過去にうまくいったやり方に頼ってしまうことがある。', reverse: true },
  { id: 39, axis: 'competency', sub: 'creativity',    text: '一見関係のない要素を組み合わせて、新しいアイデアや形を生み出すことがある。', reverse: false },
  { id: 40, axis: 'competency', sub: 'creativity',    text: '突破口が見えない状況で、自分の発想を起点にチームが実際に動き出している。', reverse: false },
  { id: 41, axis: 'competency', sub: 'communication', text: '自分の伝え方によって、相手の理解が深まったり、行動が変わったりすることが続いている。', reverse: false },
  { id: 42, axis: 'competency', sub: 'communication', text: '伝えたいことを一方的に話してしまい、相手がどう受け取ったかの確認が後回しになることがある。', reverse: true },
  { id: 43, axis: 'competency', sub: 'communication', text: '動く意志のある相手に対して、自分の言葉をきっかけに、相手が自発的に動き出す場面が繰り返しある。', reverse: false },
  { id: 44, axis: 'competency', sub: 'communication', text: '大切な話を誰かに届ける場面で、伝え手として自分が選ばれている。', reverse: false },
  { id: 45, axis: 'competency', sub: 'collaboration', text: '年齢・立場・専門の異なる人とも、目的を共有しながら協力して成果につなげている。', reverse: false },
  { id: 46, axis: 'competency', sub: 'collaboration', text: '自分と価値観や進め方が違う相手とは、お互いに距離を置いたまま終わることがある。', reverse: true },
  { id: 47, axis: 'competency', sub: 'collaboration', text: '自分一人では出せなかった成果を、他者との協働によって実際に生み出せている。', reverse: false },
  { id: 48, axis: 'competency', sub: 'collaboration', text: '対立や分断が起きた場面で、自分が間に入ることで関係が実際に修復されている。', reverse: false },
  { id: 49, axis: 'impact', sub: 'idea',           text: '他人の評価とは無関係に、強くエネルギーを注げる対象が明確にある。', reverse: false },
  { id: 50, axis: 'impact', sub: 'idea',           text: '力を注ぐ対象がころころ変わり、目先の出来事に振り回されてエネルギーが分散してしまうことがある。', reverse: true },
  { id: 51, axis: 'impact', sub: 'idea',           text: 'まだ世の中にないものを、ゼロから自分の手で立ち上げることがある。', reverse: false },
  { id: 52, axis: 'impact', sub: 'idea',           text: '自分が関わることで、それまで停滞していたプロジェクトや取り組みが前に進んでいる。', reverse: false },
  { id: 53, axis: 'impact', sub: 'innovation',     text: '既存のやり方に限界を感じたとき、それを壊して新しい形を作ることができている。', reverse: false },
  { id: 54, axis: 'impact', sub: 'innovation',     text: '問題があるとわかっていても、慣れたやり方にしがみついて現状維持を選んでしまうことがある。', reverse: true },
  { id: 55, axis: 'impact', sub: 'innovation',     text: '自分が変えた仕組みや方法が、周囲から「以前より格段によくなった」と評価されている。', reverse: false },
  { id: 56, axis: 'impact', sub: 'innovation',     text: '古い枠組みを壊して再構築する役割が、周囲から自然と自分に集まっている。', reverse: false },
  { id: 57, axis: 'impact', sub: 'implementation', text: '自分が生み出したものを自己満足で終わらせず、実際に使われる形まで落とし込んでいる。', reverse: false },
  { id: 58, axis: 'impact', sub: 'implementation', text: '形にしたことで満足し、そこから先の実用化が後回しになってしまうことがある。', reverse: true },
  { id: 59, axis: 'impact', sub: 'implementation', text: 'やると決めたことを、最後までやり抜き、実際に機能する状態まで仕上げることができている。', reverse: false },
  { id: 60, axis: 'impact', sub: 'implementation', text: '自分に託された仕事は確実に形になるという信頼が、周囲の行動に表れている。', reverse: false },
  { id: 61, axis: 'impact', sub: 'influence',      text: '自分が関わった場所では、自分の考え方や取り組みが、組織や場の文化として根づいている。', reverse: false },
  { id: 62, axis: 'impact', sub: 'influence',      text: '自分の言葉や関わりが、相手にとってはその場限りの出来事で終わってしまうことがある。', reverse: true },
  { id: 63, axis: 'impact', sub: 'influence',      text: '自分の存在が、関わった人たちの生き方や選択に、長期的な変化を生み出し続けている。', reverse: false },
  { id: 64, axis: 'impact', sub: 'influence',      text: '自分と関わった人たちの生き方や選択が、出会いの前と後で実際に変化し続けている。', reverse: false },
];

export function calculateScores(answers, questions = QUESTIONS) {
  const result = {};

  for (const [axisKey, axisDef] of Object.entries(AXES_DEF)) {
    const axisQuestions = questions.filter((q) => q.axis === axisKey);
    const subs = {};

    for (const sub of axisDef.subs) {
      const subQuestions = axisQuestions.filter((q) => q.sub === sub);
      let subTotal = 0;

      for (const q of subQuestions) {
        const raw = Number(answers[String(q.id)] ?? answers[q.id]) || 3;
        subTotal += q.reverse ? 6 - raw : raw;
      }

      subs[sub] = subTotal;
    }

    const total = Object.values(subs).reduce((a, b) => a + b, 0);

    result[axisKey] = {
      total,
      max: 80,
      percentage: Math.round((total / 80) * 100),
      subs,
    };
  }

  return result;
}
