import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ConfirmSheet } from '../components/Dialog'
import { TripSummary } from '../components/TripSummary'
import { ButtonLink, IconButton, PageHeader } from '../components/ui'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'
import NotFound from './NotFound'

export default function TripDetail() {
  const { id } = useParams()
  const { state, toggleTripItem, deleteTrip } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const trip = state.trips.find((t) => t.id === id)
  if (!trip) return <NotFound />
  return (
    <div>
      <PageHeader back="/perfil" title="Jornada guardada" actions={<IconButton icon={Trash2} label="Eliminar jornada" tone="plain" onClick={() => setConfirm(true)} />} />
      <div className="mx-auto max-w-3xl px-4 pt-4 lg:px-8">
        <TripSummary damId={trip.damId} date={trip.date} speciesId={trip.speciesId} modality={trip.modality} checked={trip.checked} onToggle={(item) => toggleTripItem(trip.id, item)} />
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink to={`/capturas/nova?barragem=${trip.damId}&especie=${trip.speciesId}&data=${trip.date}`}>Registar captura desta jornada</ButtonLink>
          <ButtonLink to={`/barragens/${trip.damId}`} variant="outline">
            Ver barragem
          </ButtonLink>
        </div>
      </div>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Eliminar jornada?"
        text="A jornada guardada e o progresso da checklist serão removidos deste navegador."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          deleteTrip(trip.id)
          toast('Jornada eliminada', { tone: 'info' })
          navigate('/perfil', { replace: true })
        }}
      />
    </div>
  )
}
