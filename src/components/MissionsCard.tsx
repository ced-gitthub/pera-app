import Link from 'next/link';
import type { Mission } from '@/lib/missions';
// "Getting started" tutorial card: the first steps for a new user, with the NEXT one highlighted and a button that takes them straight there.
export default function MissionsCard({ missions, doneCount }: { missions: Mission[]; doneCount: number }) {
  const total = missions.length;
  return (
    <section className="card missions" aria-label="Getting started">
      <div className="mhead">
        <h2>Getting started</h2>
        <span className="chip mango">
          {doneCount}/{total} done
        </span>
      </div>
      <div
        className="mbar"
        role="progressbar"
        aria-label="Getting started progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={doneCount}
      >
        <i style={{ width: `${Math.round((doneCount * 100) / total)}%` }} />
      </div>
      <ol className="mlist">
        {missions.map((m) => (
          <li key={m.id} className={m.done ? 'mrow done' : m.next ? 'mrow next' : 'mrow'}>
            <span className="mic" aria-hidden="true">
              {m.done ? '✓' : m.emoji}
            </span>
            <div className="mtxt">
              <b>{m.title}</b>
              <small>{m.done ? 'Done!' : m.hint}</small>
            </div>
            {m.next && (
              <div className="mgo">
                <span className="mtag">Do this next</span>
                {m.href.startsWith('#') ? (
                  <a className="btn p" href={m.href}>
                    {m.cta}
                  </a>
                ) : (
                  <Link className="btn p" href={m.href}>
                    {m.cta}
                  </Link>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
