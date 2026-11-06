import { Compass } from 'lucide-react'
import { ButtonLink, EmptyState, PageHeader } from '../components/ui'

export default function NotFound() {
  return (
    <>
      <PageHeader back="/" title="Página não encontrada" />
      <div className="mx-auto max-w-md px-4 pt-10">
        <EmptyState icon={Compass} title="Não encontrámos esta página" text="O endereço pode estar incorreto ou o conteúdo foi removido desta demonstração." action={<ButtonLink to="/">Voltar ao início</ButtonLink>} />
      </div>
    </>
  )
}
