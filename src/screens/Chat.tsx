import { Crown, SendHorizontal, Users } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Avatar, useAnglerName } from '../components/bits'
import { Paywall } from '../components/Paywall'
import { cx, PageHeader } from '../components/ui'
import { DEMO_USER_ID } from '../data/anglers'
import { relativeDay } from '../lib/format'
import { useApp } from '../state/AppState'

export default function Chat() {
  const { state, allMessages, sendMessage } = useApp()
  const anglerName = useAnglerName()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const subscribed = state.subscription.active

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [allMessages.length, subscribed])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    sendMessage(t.slice(0, 500))
    setText('')
  }

  return (
    <div>
      <PageHeader back="/comunidade" title="Chat global" eyebrow="Subscritores" actions={subscribed ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-extrabold text-amber-800"><Crown className="h-3.5 w-3.5" aria-hidden /> Pro</span> : undefined} />
      <div className="mx-auto max-w-3xl px-4 pt-4 lg:px-8">
        {!subscribed ? (
          <Paywall />
        ) : (
          <>
            <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[12.5px] text-muted shadow-card">
              <Users className="h-4 w-4 shrink-0 text-teal-700" aria-hidden />
              Canal único para Portugal e Espanha. Os outros participantes são fictícios e as suas mensagens ficam apenas neste navegador.
            </p>
            <ol className="mt-4 space-y-2.5 pb-28 lg:pb-24" aria-label="Mensagens">
              {allMessages.map((m, i) => {
                const day = m.at.slice(0, 10)
                const showDay = i === 0 || allMessages[i - 1].at.slice(0, 10) !== day
                const own = m.anglerId === DEMO_USER_ID
                return (
                  <li key={m.id}>
                    {showDay && (
                      <p className="my-4 text-center text-[11.5px] font-bold uppercase tracking-wider text-subtle">{relativeDay(day, state.anchor)}</p>
                    )}
                    <div className={cx('flex items-end gap-2', own && 'flex-row-reverse')}>
                      {!own && <Avatar anglerId={m.anglerId} size={30} />}
                      <div className={cx('max-w-[78%] rounded-[20px] px-3.5 py-2.5 shadow-card', own ? 'rounded-br-md bg-teal text-ink' : 'rounded-bl-md bg-white text-ink')}>
                        {!own && <p className="mb-0.5 text-[12px] font-extrabold text-teal-700">{anglerName(m.anglerId)}</p>}
                        <p className="whitespace-pre-wrap break-words text-[14.5px] leading-snug">{m.text}</p>
                        <p className={cx('tnum mt-1 text-right text-[10.5px] font-semibold', own ? 'text-ink/60' : 'text-subtle')}>{m.at.slice(11, 16)}</p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
            <div ref={endRef} />
            <form
              onSubmit={submit}
              className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-xl lg:left-[264px] lg:bottom-0"
            >
              <div className="mx-auto flex max-w-3xl gap-2 lg:px-4">
                <label htmlFor="chat-input" className="sr-only">Mensagem</label>
                <input
                  id="chat-input"
                  value={text}
                  maxLength={500}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escreva para a comunidade…"
                  autoComplete="off"
                  className="h-12 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-[15px] outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
                />
                <button type="submit" disabled={!text.trim()} className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40" aria-label="Enviar mensagem">
                  <SendHorizontal className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
