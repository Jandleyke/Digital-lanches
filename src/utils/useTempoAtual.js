import { useEffect, useState } from 'react'

export function useTempoAtual(intervaloMs = 60000) {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const atualizar = () => setAgora(Date.now())
    atualizar()
    const timer = setInterval(atualizar, intervaloMs)
    return () => clearInterval(timer)
  }, [intervaloMs])

  return agora
}
