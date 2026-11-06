import { ImagePlus, Info, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button, Chip, cx, Field, inputCls, PageHeader } from '../components/ui'
import { CONDITIONS, LISTING_CATEGORIES, REGIONS } from '../data/catalog'
import type { Listing, ListingCategory, RegionId } from '../data/types'
import { compressPhoto, PhotoError, savePhoto, validatePhoto } from '../lib/photos'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23566a73' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundSize: '16px',
  backgroundPosition: 'right 16px center',
  backgroundRepeat: 'no-repeat',
}

export default function ListingForm() {
  const { state, addListing, updateListing, bumpPhotos } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ListingCategory | ''>('')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState<Listing['condition']>('usado')
  const [region, setRegion] = useState<RegionId>(state.profile.region)
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (title.trim().length < 4) err.title = 'Escreva um título com pelo menos 4 caracteres.'
    if (!category) err.category = 'Escolha a categoria.'
    const p = Number(price.replace(',', '.'))
    if (!price || !Number.isFinite(p) || p < 0 || p > 20000) err.price = 'Indique o preço em euros (0 a 20 000).'
    if (description.trim().length < 10) err.description = 'Descreva o estado do material (mínimo 10 caracteres).'
    setErrors(err)
    if (Object.keys(err).length || !category) return
    setSaving(true)
    let blob: Blob | null = null
    if (photo) {
      try {
        blob = await compressPhoto(photo.file)
      } catch (er) {
        setSaving(false)
        setErrors({ photo: er instanceof PhotoError ? er.message : 'Não foi possível processar a fotografia.' })
        return
      }
    }
    const l = addListing({ title: title.trim(), category, priceEur: Math.round(p), condition, region, description: description.trim(), date: state.anchor, hasPhoto: !!blob })
    if (blob) {
      try {
        await savePhoto(`mk-${l.id}`, blob)
      } catch {
        updateListing(l.id, { hasPhoto: false })
        toast('Anúncio publicado sem fotografia', { tone: 'warning', detail: 'Não houve espaço para guardar a imagem neste navegador.' })
      }
    }
    bumpPhotos()
    setSaving(false)
    toast('Anúncio publicado', { detail: 'Visível no marketplace deste navegador.' })
    navigate(`/mercado/${l.id}`, { replace: true })
  }

  return (
    <div>
      <PageHeader back="/mercado" title="Novo anúncio" eyebrow="Marketplace" />
      <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-5 px-4 pt-4 lg:px-8">
        <div>
          <input ref={fileRef} id="l-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const v = validatePhoto(f)
            if (v) return setErrors({ ...errors, photo: v })
            setErrors({ ...errors, photo: '' })
            setPhoto({ file: f, url: URL.createObjectURL(f) })
          }} />
          {photo ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] bg-ink">
              <img src={photo.url} alt="Pré-visualização do anúncio" className="h-full w-full object-cover" />
              <Button type="button" size="sm" variant="ghost" icon={Trash2} className="absolute bottom-3 left-3 bg-black/35 text-white hover:bg-black/50" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = '' }}>
                Remover
              </Button>
            </div>
          ) : (
            <label htmlFor="l-photo" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()} className="press flex aspect-[16/7] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed border-[#c9d6d9] bg-white text-center hover:border-teal">
              <ImagePlus className="h-6 w-6 text-teal-700" aria-hidden />
              <span className="mt-2 font-extrabold text-ink">Adicionar fotografia</span>
              <span className="text-[12.5px] text-muted">Opcional · JPEG, PNG ou WebP até 15 MB</span>
            </label>
          )}
          {errors.photo && <p className="mt-2 text-[12.5px] font-semibold text-danger" role="alert">{errors.photo}</p>}
        </div>
        <Field label="Título" htmlFor="l-title" error={errors.title}>
          <input id="l-title" value={title} maxLength={70} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Carreto spinning 2500" className={inputCls} />
        </Field>
        <Field label="Categoria" error={errors.category}>
          <div className="flex flex-wrap gap-2">
            {LISTING_CATEGORIES.map((c) => <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</Chip>)}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preço (€)" htmlFor="l-price" error={errors.price}>
            <input id="l-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="45" className={cx(inputCls, 'tnum font-bold')} />
          </Field>
          <Field label="Estado" htmlFor="l-cond">
            <select id="l-cond" value={condition} onChange={(e) => setCondition(e.target.value as Listing['condition'])} className={cx(inputCls, 'appearance-none pr-10')} style={selectStyle}>
              {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Região" htmlFor="l-region">
          <select id="l-region" value={region} onChange={(e) => setRegion(e.target.value as RegionId)} className={cx(inputCls, 'appearance-none pr-10')} style={selectStyle}>
            <optgroup label="Portugal">{REGIONS.filter((r) => r.country === 'PT').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
            <optgroup label="Espanha">{REGIONS.filter((r) => r.country === 'ES').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
          </select>
        </Field>
        <Field label="Descrição" htmlFor="l-desc" error={errors.description}>
          <textarea id="l-desc" rows={4} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Estado, uso, o que inclui…" className={cx(inputCls, 'h-auto py-3 leading-relaxed')} />
        </Field>
        <p className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Na demonstração o anúncio fica apenas neste navegador e não há pagamentos nem mensagens privadas.
        </p>
        <div className="sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-xl lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
          <Button type="submit" size="lg" className="w-full lg:w-auto lg:min-w-[240px]" disabled={saving}>{saving ? 'A publicar…' : 'Publicar anúncio'}</Button>
        </div>
      </form>
    </div>
  )
}
