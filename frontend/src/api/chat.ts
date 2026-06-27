import type { ChatMessage, ChatResponse } from '@/types'

export async function sendChat(
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    }),
  })
  if (!res.ok) throw new Error('Chat request failed')
  return res.json()
}

export async function analyzeResume(text: string) {
  const form = new FormData()
  form.append('resume_text', text)
  const res = await fetch('/api/portal/analyze', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Analysis failed')
  return res.json()
}
