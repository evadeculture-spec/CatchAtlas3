import { Plus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { cx, inputCls } from '../ui'

/** Lista de etiquetas de texto livre com sugestões. */
export function TagInput({ value, onChange, suggestions = [], placeholder, id, max = 20 }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string; id?: string; max?: number }) {
  const [text, setText] = useState('')
  const listId = useId()
  const add = (raw: string) => {
    const t = raw.trim().slice(0, 40)
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase()) || value.length >= max) return setText('')
    onChange([...value, t])
    setText('')
  }
  const quick = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8)
  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v}>
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="press inline-flex h-8 items-center gap-1 rounded-full bg-ink pl-3 pr-2 text-[12.5px] font-bold text-white" aria-label={`Remover ${v}`}>
                {v} <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          list={listId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(text)
            }
          }}
          onBlur={() => text && add(text)}
          placeholder={placeholder}
          className={inputCls}
        />
        <button type="button" onClick={() => add(text)} className="press grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line bg-white text-ink" aria-label="Adicionar">
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {quick.length > 0 && (
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
          {quick.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className={cx('press h-8 shrink-0 rounded-full border border-line bg-white px-3 text-[12.5px] font-bold text-muted hover:text-ink')}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
