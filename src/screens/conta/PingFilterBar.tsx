import { Chip, inputCls } from '../../components/ui'
import { selectCls } from '../../components/lanca/primitives'
import { MODALITIES, PING_KINDS } from '../../lib/lanca/labels'
import type { PingFilter } from './pingFilters'

export function PingFilterBar({ value, onChange, species }: { value: PingFilter; onChange: (f: PingFilter) => void; species: string[] }) {
  return (
    <div className="space-y-2">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Tipo de Ping">
        {PING_KINDS.map((k) => {
          const on = value.kinds.includes(k.id)
          return (
            <Chip key={k.id} active={on} onClick={() => onChange({ ...value, kinds: on ? value.kinds.filter((x) => x !== k.id) : [...value.kinds, k.id] })}>
              <span className="h-2 w-2 rounded-full" style={{ background: k.color }} aria-hidden />
              {k.label}
            </Chip>
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select aria-label="Período" value={value.period} onChange={(e) => onChange({ ...value, period: e.target.value as PingFilter['period'] })} className={`${selectCls} h-11 text-[13.5px]`}>
          <option value="tudo">Todo o histórico</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="12m">Últimos 12 meses</option>
          <option value="ano">Este ano</option>
        </select>
        <select aria-label="Modalidade" value={value.modality} onChange={(e) => onChange({ ...value, modality: e.target.value })} className={`${selectCls} h-11 text-[13.5px]`}>
          <option value="">Todas as modalidades</option>
          {MODALITIES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <input aria-label="Espécie" list="flt-species" value={value.species} onChange={(e) => onChange({ ...value, species: e.target.value })} placeholder="Espécie" className={`${inputCls} h-11 text-[13.5px]`} />
        <datalist id="flt-species">{species.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
    </div>
  )
}
