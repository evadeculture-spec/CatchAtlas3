import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import teaser from '../../data/atlas/teaser.json'

/**
 * Cartão de entrada no Atlas (painel "Prepara a tua jornada"): silhueta real da laje com volume,
 * em SVG estático. Não carrega o mapa nem WebGL; é uma ligação, por isso não entra em conflito
 * com o gesto horizontal das histórias.
 */
export function AtlasTeaser() {
  const layers = 10
  const step = 2.2
  const squash = 0.66
  const h = teaser.height * squash
  return (
    <Link
      to="/atlas"
      className="group relative mt-8 flex items-center gap-3 overflow-hidden rounded-3xl bg-[radial-gradient(120%_100%_at_70%_10%,#123a4b_0%,#0b2433_55%,#071923_100%)] p-5 ring-1 ring-white/10 transition hover:ring-[#83e5ef]/40"
      aria-label="Abrir o Atlas Ibérico 3D: da Península à margem"
    >
      <div className="relative z-10 min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#83e5ef]">Atlas Ibérico 3D</p>
        <p className="font-display mt-1.5 text-[24px] font-semibold leading-tight text-white">Da Península à margem.</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">Albufeiras, rios e barragens com a geometria real. Aproxima, escolhe e prepara a jornada.</p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#83e5ef]">
          Abrir atlas <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
      {/* Vista oblíqua: o contorno achatado na vertical e repetido para baixo dá a espessura da peça. */}
      <svg viewBox={`-6 -6 ${teaser.width + 12} ${h + layers * step + 16}`} className="pointer-events-none w-[40%] max-w-[240px] shrink-0 transition-transform duration-500 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden>
        <g transform={`translate(0 ${layers * step + 4}) scale(1 ${squash})`}>
          <path d={teaser.d} fill="rgba(0,0,0,0.45)" transform={`translate(6 ${(layers * step + 6) / squash})`} />
        </g>
        {Array.from({ length: layers }, (_, i) => (
          <g key={i} transform={`translate(0 ${(layers - i) * step}) scale(1 ${squash})`}>
            <path d={teaser.d} fill={i < 3 ? '#14231f' : '#1f3229'} />
          </g>
        ))}
        <g transform={`scale(1 ${squash})`}>
          <path d={teaser.d} fill="#3b5446" stroke="rgba(214,226,220,0.55)" strokeWidth="1.4" />
          <circle cx={teaser.width * 0.215} cy={teaser.height * 0.73} r="4.5" fill="#38c9d5" />
          <circle cx={teaser.width * 0.3} cy={teaser.height * 0.57} r="3.4" fill="#38c9d5" />
          <circle cx={teaser.width * 0.57} cy={teaser.height * 0.34} r="3" fill="#38c9d5" />
        </g>
      </svg>
    </Link>
  )
}
