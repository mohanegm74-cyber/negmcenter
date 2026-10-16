import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, RotateCcw, Send, X } from "lucide-react";
import { askGuideAssistant } from "@/lib/assistant.functions";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content: "أهلًا بك! أنا المساعد الإرشادي للمنصة. اسألني عن كيفية استخدام المنصة: التسجيل، الدخول، بوابة الطالب، الدروس، الواجبات، الاختبارات والحضور.",
};

const SUGGESTIONS = [
  "كيف أسجّل كطالب جديد؟",
  "أين أرى الدروس المنشورة؟",
  "كيف أسلّم الواجب؟",
  "كيف أدخل الاختبار وأسلّمه؟",
];

const MAX_LEN = 500;
const MAX_HISTORY = 10;

export function GuideAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const askFn = useServerFn(askGuideAssistant);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_LEN);
    if (!content || sending) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const history = next.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));
      const res = await askFn({ data: { messages: history } });
      setMessages((cur) => [...cur, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((cur) => [...cur, { role: "assistant", content: "حدث خطأ غير متوقع، حاول مرة أخرى." }]);
    } finally {
      setSending(false);
    }
  }

  function newChat() {
    setMessages([WELCOME]);
    setInput("");
  }

  return (
    <>
      {/* الزر العائم — أسفل اليسار بعيدًا عن شريط الاختبار العائم، مخفي عند الطباعة */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="المساعد الإرشادي"
        className="fixed bottom-24 left-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elegant ring-2 ring-gold/70 transition hover:scale-105 active:scale-95 sm:bottom-6 sm:left-6 print:hidden"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7" />}
      </button>

      {open && (
        <div className="fixed bottom-40 left-3 right-3 z-[60] flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border bg-card shadow-elegant sm:bottom-24 sm:left-6 sm:right-auto sm:w-[380px] print:hidden">
          {/* الرأس */}
          <div className="flex items-center gap-2 bg-primary px-4 py-3 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <Bot className="h-6 w-6 shrink-0" style={{ color: "var(--color-gold)" }} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">المساعد الإرشادي</div>
              <div className="text-[10px] opacity-90">إرشاد استخدام المنصة فقط — بدون بيانات شخصية</div>
            </div>
            <button onClick={newChat} title="محادثة جديدة" className="rounded-lg p-1.5 hover:bg-white/15">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button onClick={() => setOpen(false)} title="إغلاق" className="rounded-lg p-1.5 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* الرسائل */}
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm font-semibold leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "rounded-tl-sm bg-primary text-primary-foreground"
                      : "rounded-tr-sm border bg-card text-card-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-primary/30 bg-card px-3 py-1.5 text-[11px] font-bold text-primary shadow-sm transition hover:bg-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {sending && (
              <div className="flex justify-end">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tr-sm border bg-card px-3.5 py-2.5 text-xs font-bold text-muted-foreground shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> يكتب…
                </div>
              </div>
            )}
          </div>

          {/* الإدخال */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t bg-card p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_LEN}
              placeholder="اكتب سؤالك هنا…"
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="إرسال"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4 -scale-x-100" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
