import { Waves } from 'lucide-react'
import { Link } from 'react-router'
import { ExploreTabs } from '../components/ExploreTabs'
import { Card, Tag } from '../components/ui'
import { DAMS } from '../data/dams'
import { RIVERS } from '../data/rivers'
import { ZONES } from '../data/zones'

export default function Rivers() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-8">
      <header className="pt-safe pt-5 lg:pt-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Explorar</p>
        <h1 className="font-display mt-1 text-[30px] font-semibold leading-tight text-ink sm:text-[36px]">Rios e bacias</h1>
        <div className="mt-4">
          <ExploreTabs />
        </div>
      </header>
      <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-muted">
        Principais rios com barragens na app, agrupados por bacia. Cada rio mostra as albufeiras e as zonas de pesca associadas.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {RIVERS.map((r) => {
          const dams = DAMS.filter((d) => r.match.includes(d.river))
          const zones = ZONES.filter((z) => z.river && r.match.some((m) => z.river!.includes(m.replace(/^(Rio|Ribeira( de| da| do)?) /, ''))))
          return (
            <Card key={r.id} className="p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                  <Waves className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-extrabold text-ink">{r.name}</h2>
                  <p className="text-[13px] text-muted">Bacia: {r.basin} · Foz: {r.mouth}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.countries.map((c) => <Tag key={c}>{c === 'PT' ? 'Portugal' : 'Espanha'}</Tag>)}
                    {zones.length > 0 && <Tag tone="amber">{zones.length} zonas de pesca</Tag>}
                  </div>
                </div>
              </div>
              {r.notes && <p className="mt-3 text-[13.5px] leading-relaxed text-text">{r.notes}</p>}
              <p className="mt-4 text-[11.5px] font-bold uppercase tracking-wider text-subtle">Barragens na app ({dams.length})</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dams.map((d) => (
                  <Link key={d.id} to={`/barragens/${d.id}`} className="press rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-ink hover:border-ink/30">
                    {d.name}
                  </Link>
                ))}
              </div>
              {zones.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {zones.map((z) => (
                    <Link key={z.id} to={`/zonas?pais=${z.country}`} className="press rounded-full bg-amber-50 px-3 py-1.5 text-[12.5px] font-bold text-amber-800 hover:bg-[#fbebc6]">
                      {z.name.replace(/^(Zona de Pesca Lúdica( e Desportiva)?|Concessão de Pesca)( d[aoe]s?| no| na)? /, '')}
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
