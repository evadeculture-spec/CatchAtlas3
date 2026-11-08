import type { ReactNode } from 'react'
import { PageHeader } from '../components/ui'
import { PRIVACY_NOTICE_VERSION } from '../state/Auth'

function S({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-[16px] font-extrabold text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-text">{children}</div>
    </section>
  )
}

/** Aviso de privacidade (RGPD). O responsável pelo tratamento tem de ser identificado antes do lançamento público. */
export default function Privacy() {
  return (
    <div>
      <PageHeader title="Aviso de privacidade" back="/" />
      <article className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-muted">Versão {PRIVACY_NOTICE_VERSION}</p>
        <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-800">
          Rascunho técnico: a identificação e o contacto do responsável pelo tratamento (e, se aplicável, do encarregado de proteção de dados) têm de ser preenchidos pelo titular do projeto antes do lançamento público.
        </p>
        <S title="1. Responsável pelo tratamento">
          <p>[Nome / entidade, morada e email de contacto — a definir.]</p>
        </S>
        <S title="2. Que dados tratamos e para quê">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Conta</strong> (email, palavra-passe cifrada, nome ou alcunha, país, idioma, preferências): criar e manter a sua conta. Base legal: execução do contrato (art. 6.º, n.º 1, al. b) RGPD).</li>
            <li><strong>Pins, Pings, capturas, jornadas, notas e equipamento</strong>: guardar e organizar o seu arquivo pessoal de pesca. Base legal: execução do contrato.</li>
            <li><strong>Localização</strong>: só quando a indica (toque no mapa, coordenadas escritas ou botão “Posição atual”). A autorização do sistema operativo não é usada em segundo plano. Base legal: execução do contrato, por ação sua.</li>
            <li><strong>Fotografias e metadados</strong> (data, hora e, se existirem, coordenadas da câmara): mostrar a fotografia, propor a hora e o local do acontecimento e permitir, no futuro e só com a sua autorização, funcionalidades como a identificação de espécies. As versões de visualização são gravadas sem metadados.</li>
            <li><strong>Condições ambientais</strong>: obtidas para o local e a hora de cada Ping e guardadas com a fonte e a natureza do dado.</li>
            <li><strong>Segurança e auditoria</strong> (eliminações, arquivos, exportações, pedidos de eliminação de conta): proteger a conta e demonstrar o cumprimento dos seus pedidos. Base legal: interesse legítimo e obrigação de responsabilidade (art. 5.º, n.º 2).</li>
          </ul>
        </S>
        <S title="3. Quem recebe dados (subcontratantes e fornecedores)">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Supabase</strong> — base de dados, autenticação e armazenamento das fotografias, numa região da União Europeia (Paris, eu-west-3).</li>
            <li><strong>Open-Meteo</strong> — recebe apenas coordenadas arredondadas a 0,01° (~1 km) e a data do acontecimento, sem identificação da conta, para devolver dados meteorológicos.</li>
            <li><strong>Netlify</strong> — alojamento da aplicação web (recebe dados técnicos de ligação, como o endereço IP).</li>
            <li><strong>OpenFreeMap</strong> — cartografia (recebe o endereço IP e a zona do mapa visualizada, como qualquer serviço de mapas).</li>
            <li>Ao carregar em “Navegar”, as coordenadas desse Pin são abertas no Google Maps, por sua iniciativa.</li>
          </ul>
          <p>Os seus dados não são vendidos, não são partilhados com outros utilizadores e não são usados para treinar modelos nem para criar bases de dados públicas.</p>
        </S>
        <S title="4. Privacidade por defeito">
          <p>O perfil, os Pins, os Pings e as fotografias são privados. As fotografias ficam em armazenamento privado e só são mostradas através de links temporários (30 minutos) gerados para a sua sessão. Qualquer partilha futura dependerá de uma escolha explícita sua.</p>
        </S>
        <S title="5. Conservação">
          <p>Os dados são conservados enquanto a conta existir. Ao eliminar um Ping, uma fotografia ou a conta, os dados são apagados de imediato da base de dados e do armazenamento; cópias de segurança do fornecedor podem manter-se pelo período técnico de rotação desses backups. A cache meteorológica não está associada a contas nem a pessoas.</p>
        </S>
        <S title="6. Os seus direitos">
          <p>Pode aceder aos seus dados, retificá-los, exportá-los (Definições → Os seus dados), apagá-los ou eliminar a conta a qualquer momento, e opor-se a tratamentos baseados em interesse legítimo. Pode apresentar reclamação à autoridade de controlo: CNPD (Portugal) ou AEPD (Espanha).</p>
        </S>
        <S title="7. Armazenamento no dispositivo">
          <p>A aplicação guarda no navegador a sessão (token de autenticação) e preferências locais. Não usa cookies de publicidade nem ferramentas de análise de terceiros.</p>
        </S>
        <S title="8. Decisões automatizadas">
          <p>Não existem decisões automatizadas com efeitos jurídicos. As estatísticas e o índice de semelhança são descritivos e calculados apenas com os seus dados, para seu uso.</p>
        </S>
      </article>
    </div>
  )
}
