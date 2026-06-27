import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Loader2, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { sendChat } from '@/api/chat'
import { Button } from '@/components/ui/Button'
import type { ChatMessage } from '@/types'

const SUGGESTIONS = [
  'Why is the top candidate ranked #1?',
  'Show me candidates with FAISS experience',
  'Who has the strongest production ML background?',
  'Explain the confidence score methodology',
  'Which candidates are hidden gems?',
  'Who is most likely to accept an offer quickly?',
]

function Message({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-violet-600' : 'bg-zinc-800 border border-white/[0.08]'
      }`}>
        {isUser ? <User className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-zinc-400" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-violet-600/20 border border-violet-500/25 text-violet-100'
            : 'bg-zinc-900/80 border border-white/[0.06] text-zinc-200'
        }`}>
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              table: ({ children }) => (
                <div className="overflow-x-auto mt-2">
                  <table className="text-xs border-collapse">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="border border-white/10 px-2 py-1 text-left text-zinc-400">{children}</th>,
              td: ({ children }) => <td className="border border-white/[0.06] px-2 py-1 text-zinc-300">{children}</td>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mt-1">{children}</ul>,
              li: ({ children }) => <li className="text-zinc-300">{children}</li>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>

        {/* Candidate links */}
        {msg.candidate_ids && msg.candidate_ids.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {msg.candidate_ids.map((id) => (
              <Link
                key={id}
                to={`/candidates/${id}`}
                className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                {id}
              </Link>
            ))}
          </div>
        )}

        <span className="text-[10px] text-zinc-600 mt-1">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  )
}

export function RecruiterChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your **SkillGraph AI Copilot**. I have full access to the ranked candidate pool — ask me anything about scores, comparisons, skills, hidden gems, or hiring strategy.',
      timestamp: new Date().toISOString(),
      candidate_ids: [],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string = input) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const resp = await sendChat(text, messages)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: resp.response,
          timestamp: new Date().toISOString(),
          candidate_ids: resp.candidate_ids,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error connecting to the backend.',
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-[900px] mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
          <Bot className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">AI Hiring Copilot</p>
          <p className="text-xs text-zinc-500">100 candidates indexed · Semantic search enabled</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-zinc-500">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <Message key={i} msg={msg} />
          ))}
        </AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/[0.08] flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="bg-zinc-900/80 border border-white/[0.06] rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-6 py-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-violet-500/30 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-6 pb-5 pt-3 border-t border-white/[0.06]">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about candidates, scores, skills, or hiring strategy..."
            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          <Button onClick={() => send()} disabled={!input.trim() || loading} className="px-4">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
