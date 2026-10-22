import { levelInfo, type Quest } from '@/lib/progress/quests';
// "Quest board": level, XP and today's / this week's quests. Pure display: everything arrives already computed from the user's own entries.
const Row = ({ q }: { q: Quest }) => (
  <li className={q.done ? 'qrow done' : 'qrow'}>
    <span className="qic" aria-hidden="true">
      {q.done ? '✓' : q.emoji}
    </span>
    <span className="qtxt">
      <b>{q.title}</b>
      <small>{q.done ? 'Done!' : q.hint}</small>
    </span>
    <span
      className="qprog"
      role="progressbar"
      aria-label={`${q.title}: ${q.have} of ${q.need}`}
      aria-valuemin={0}
      aria-valuemax={q.need}
      aria-valuenow={q.have}
    >
      <span className="qbar">
        <i style={{ width: `${Math.round((q.have * 100) / q.need)}%` }} />
      </span>
      <em>
        {q.have}/{q.need}
      </em>
    </span>
  </li>
);
export default function QuestBoard({ quests, xp, tip }: { quests: Quest[]; xp: number; tip: string }) {
  const lv = levelInfo(xp),
    daily = quests.filter((q) => q.kind === 'daily'),
    weekly = quests.filter((q) => q.kind === 'weekly'),
    allDaily = daily.every((q) => q.done);
  return (
    <section className="card quests" aria-label="Quest board">
      <div className="qhead">
        <span className="qbadge" aria-hidden="true">
          {lv.emoji}
        </span>
        <div className="qlevel">
          <b>
            Level {lv.level} · {lv.title}
          </b>
          <div className="qxp" role="progressbar" aria-label="Level progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lv.pct}>
            <i style={{ width: `${lv.pct}%` }} />
          </div>
          <small>{lv.to === null ? `${lv.xp} XP · top level reached` : `${lv.xp} XP · ${lv.toNext} to ${lv.nextTitle}`}</small>
        </div>
      </div>
      {allDaily && (
        <p className="qwin" role="status">
          🎉 Daily quests cleared! Come back tomorrow to keep the streak alive.
        </p>
      )}
      <h3>Today</h3>
      <ul className="qlist">
        {daily.map((q) => (
          <Row key={q.id} q={q} />
        ))}
      </ul>
      <h3>This week</h3>
      <ul className="qlist">
        {weekly.map((q) => (
          <Row key={q.id} q={q} />
        ))}
      </ul>
      <p className="qtip">💡 {tip}</p>
      <p className="qlegend">Earn XP: +5 for every entry, +10 for each day of your streak.</p>
    </section>
  );
}
