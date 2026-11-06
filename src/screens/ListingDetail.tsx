import { CheckCircle2, MapPin, MessageCircle, RotateCcw, Tag as TagIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Avatar, useAnglerName } from '../components/bits'
import { ConfirmSheet, Sheet } from '../components/Dialog'
import { ListingVisual } from '../components/ListingVisual'
import { Button, Card, PageHeader, Tag } from '../components/ui'
import { DEMO_USER_ID } from '../data/anglers'
import { categoryName, CONDITIONS, regionName } from '../data/catalog'
import { formatDateLong } from '../lib/format'
import { formatEur } from '../lib/money'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'
import NotFound from './NotFound'

export default function ListingDetail() {
  const { id } = useParams()
  const { allListings, updateListing, deleteListing, state } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const anglerName = useAnglerName()
  const [contact, setContact] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const l = allListings.find((x) => x.id === id)
  if (!l) return <NotFound />
  const own = l.sellerId === DEMO_USER_ID

  return (
    <div>
      <PageHeader back="/mercado" title={l.title} eyebrow="Marketplace" />
      <div className="mx-auto max-w-5xl px-4 pt-4 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] shadow-card lg:aspect-square">
            <ListingVisual l={l} iconSize={64} />
            {!l.hasPhoto && <span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-bold text-muted">Sem fotografia</span>}
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap gap-1.5">
                {l.sold ? <Tag tone="ink">Vendido</Tag> : <Tag tone="teal">Disponível</Tag>}
                <Tag>{categoryName(l.category)}</Tag>
                <Tag>{CONDITIONS[l.condition]}</Tag>
                {!own && <Tag tone="amber">Anúncio fictício</Tag>}
              </div>
              <h1 className="font-display mt-3 text-[28px] font-semibold leading-tight text-ink">{l.title}</h1>
              <p className="tnum mt-2 text-[32px] font-extrabold text-ink">{formatEur(l.priceEur)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted">
                <MapPin className="h-4 w-4" aria-hidden /> {regionName(l.region)} · publicado {formatDateLong(l.date).toLowerCase()}
              </p>
            </div>
            <Card className="p-5">
              <p className="text-[12px] font-bold uppercase tracking-wider text-subtle">Descrição</p>
              <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{l.description}</p>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <Avatar anglerId={l.sellerId} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-extrabold text-ink">{anglerName(l.sellerId)}{own && ' (tu)'}</p>
                <p className="text-[12.5px] text-muted">{own ? 'O seu anúncio' : 'Vendedor fictício'}</p>
              </div>
            </Card>
            {own ? (
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Button
                  size="lg"
                  variant={l.sold ? 'outline' : 'dark'}
                  icon={l.sold ? RotateCcw : CheckCircle2}
                  className="sm:flex-1"
                  onClick={() => {
                    updateListing(l.id, { sold: !l.sold })
                    toast(l.sold ? 'Anúncio reativado' : 'Marcado como vendido')
                  }}
                >
                  {l.sold ? 'Reativar anúncio' : 'Marcar como vendido'}
                </Button>
                <Button size="lg" variant="outline" icon={Trash2} className="sm:flex-1" onClick={() => setConfirm(true)}>
                  Eliminar
                </Button>
              </div>
            ) : (
              <Button size="lg" icon={MessageCircle} className="w-full" disabled={l.sold} onClick={() => setContact(true)}>
                Contactar vendedor
              </Button>
            )}
            <p className="flex gap-2 text-[12.5px] text-muted">
              <TagIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              O marketplace só liga compradores e vendedores. Pagamento e entrega são combinados entre as partes.
            </p>
          </div>
        </div>
      </div>

      <Sheet
        open={contact}
        onClose={() => setContact(false)}
        title="Mensagens privadas"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setContact(false)}>Fechar</Button>
            <Button variant="dark" className="flex-1" onClick={() => navigate('/comunidade/chat')}>
              {state.subscription.active ? 'Abrir chat' : 'Ver chat'}
            </Button>
          </div>
        }
      >
        <p className="text-[14.5px] leading-relaxed text-muted">
          As mensagens privadas entre comprador e vendedor ainda não fazem parte da demonstração e este vendedor é fictício. No produto real, a conversa abriria aqui. Entretanto, pode ver como funciona o chat global de subscritores.
        </p>
      </Sheet>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Eliminar anúncio?"
        text="O anúncio e a fotografia serão removidos deste navegador."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          deleteListing(l.id)
          toast('Anúncio eliminado', { tone: 'info' })
          navigate('/mercado', { replace: true })
        }}
      />
    </div>
  )
}
