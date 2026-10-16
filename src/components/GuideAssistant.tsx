import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { askTeacherAssistantFn, speakTextFn } from "@/lib/assistant-teacher.functions";
import { Loader2, Mic, MicOff, RotateCcw, Send, Volume2, VolumeX, X } from "lucide-react";
import { askGuideAssistant } from "@/lib/assistant.functions";
import kidAvatar from "@/assets/assistant-kid.png";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content:
    "مستر محمد نِجْم يرحب بكم 👋\nأهلًا بيك! أنا مساعدك على المنصة، اسألني كتابة أو بصوتك عن أي حاجة: التسجيل، الدخول، بوابة الطالب، الدروس، الواجبات، الاختبارات والحضور.",
};
const CLOSING = "مع تحيات مستر محمد نِجْم";

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
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [micSupported, setMicSupported] = useState(false);
  const askFn = useServerFn(askGuideAssistant);
  const teacherFn = useServerFn(askTeacherAssistantFn);
  const router = useRouter();
  const ttsFn = useServerFn(speakTextFn);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const studentArea = pathname.startsWith("/student") || pathname === "/";
  const [teacherMode, setTeacherMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakIdRef = useRef(0);
  const voiceModeRef = useRef(false);
  const messagesRef = useRef<Msg[]>([WELCOME]);
  const sendingRef = useRef(false);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const listRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const w = window as any;
    setMicSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    // تحميل أصوات المتصفح: كثير من الأجهزة تعيد قائمة فارغة أول مرة
    const synth = window.speechSynthesis;
    const loadVoices = () => { if (synth) voicesRef.current = synth.getVoices(); };
    loadVoices();
    if (synth && typeof (synth as any).addEventListener === "function") {
      synth.addEventListener("voiceschanged", loadVoices);
    } else if (synth) {
      (synth as any).onvoiceschanged = loadVoices;
    }
    return () => {
      window.speechSynthesis?.cancel();
      recRef.current?.abort?.();
      if (synth && typeof (synth as any).removeEventListener === "function") {
        synth.removeEventListener("voiceschanged", loadVoices);
      }
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  function pickVoice(): SpeechSynthesisVoice | undefined {
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis?.getVoices() || [];
    voicesRef.current = voices;
    return (
      voices.find((v) => /ar[-_]EG/i.test(v.lang)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("ar")) ||
      voices.find((v) => /ar/i.test(v.lang))
    );
  }

  // تقسيم النص إلى مقاطع قصيرة: بعض المتصفحات تفشل في قراءة النص الطويل دفعة واحدة
  function chunkText(text: string): string[] {
    const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim();
    if (clean.length <= 180) return [clean];
    const chunks: string[] = [];
    const parts = clean.split(/\n+/);
    let cur = "";
    for (const p of parts) {
      if ((cur + "\n" + p).length > 180 && cur) { chunks.push(cur.trim()); cur = p; }
      else cur = cur ? cur + "\n" + p : p;
      while (cur.length > 350) {
        const cut = cur.lastIndexOf(" ", 350);
        chunks.push(cur.slice(0, cut > 0 ? cut : 350).trim());
        cur = cur.slice(cut > 0 ? cut : 350);
      }
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks;
  }

  // صوت طبيعي من الخادم أولًا، ثم صوت المتصفح كاحتياط
  async function speak(text: string) {
    stopSpeak();
    const id = ++speakIdRef.current;
    setSpeaking(true);
    try {
      const res = await ttsFn({ data: { text: text.slice(0, 3500) } });
      if (id !== speakIdRef.current) return;
      if (res.audio) {
        const a = new Audio(res.audio);
        audioRef.current = a;
        a.onended = () => { setSpeaking(false); afterSpeak(); };
        a.onerror = () => { setSpeaking(false); browserSpeak(text); };
        await a.play();
        return;
      }
    } catch { /* احتياط */ }
    if (id !== speakIdRef.current) return;
    browserSpeak(text);
  }

  function afterSpeak() {
    // وضع المحادثة الصوتية: يستمع تلقائيًا بعد انتهاء الرد
    if (voiceModeRef.current && micSupported) setTimeout(() => startMic(), 300);
  }

  function browserSpeak(text: string) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const chunks = chunkText(text);
    const voice = pickVoice();
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = voice?.lang || "ar-EG";
      if (voice) u.voice = voice;
      u.rate = 1;
      u.pitch = 1.15;
      u.volume = 1;
      if (i === 0) u.onstart = () => setSpeaking(true);
      if (i === chunks.length - 1) {
        u.onend = () => { setSpeaking(false); afterSpeak(); };
        u.onerror = () => setSpeaking(false);
      }
      synth.speak(u);
    });
  }

  function stopSpeak() {
    speakIdRef.current++;
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  function toggleMic() {
    if (listening) { voiceModeRef.current = false; recRef.current?.stop(); return; }
    voiceModeRef.current = true;
    startMic();
  }

  function startMic() {
    if (recRef.current && listening) return;
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    stopSpeak();
    const rec = new SR();
    rec.lang = "ar-EG";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      setInput((finalText + interim).slice(0, MAX_LEN));
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) send(finalText);
    };
    rec.onerror = () => { setListening(false); voiceModeRef.current = false; };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_LEN);
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    const next: Msg[] = [...messagesRef.current, { role: "user", content }];
    messagesRef.current = next;
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const history = next.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));
      let res: { reply: string } | null = null;
      if (!studentArea) {
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session) {
          const t = await teacherFn({ data: { messages: history.map((m) => ({ ...m, content: m.content.slice(0, 3500) })) } });
          if (!t.notTeacher) { res = t; setTeacherMode(true); if ((t as any).executed) { router.invalidate(); window.dispatchEvent(new Event("assistant:data-changed")); } }
        }
      }
      if (!res) res = await askFn({ data: { messages: history.map((m) => ({ ...m, content: m.content.slice(0, 500) })) } });
      setMessages((cur) => [...cur, { role: "assistant", content: res.reply }]);
      if (autoSpeak) speak(res.reply);
    } catch {
      setMessages((cur) => [...cur, { role: "assistant", content: "حدث خطأ غير متوقع، حاول مرة أخرى." }]);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function newChat() {
    stopSpeak();
    voiceModeRef.current = false;
    setMessages([WELCOME]);
    setInput("");
  }

  function toggleOpen() {
    if (open) { stopSpeak(); voiceModeRef.current = false; recRef.current?.abort?.(); }
    else if (autoSpeak && messages.length === 1) speak(WELCOME.content);
    setOpen(!open);
  }

  return (
    <>
      <style>{`
        @keyframes kid-float { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-6px) rotate(3deg); } }
        @keyframes kid-talk { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .kid-float { animation: kid-float 3s ease-in-out infinite; }
        .kid-talk { animation: kid-talk .45s ease-in-out infinite; }
      `}</style>

      {/* الزر العائم — طفل مبتسم */}
      <button
        onClick={toggleOpen}
        aria-label="المساعد الإرشادي"
        className="fixed bottom-24 left-4 z-[60] h-16 w-16 rounded-full bg-card shadow-elegant ring-4 ring-gold/80 transition hover:scale-110 active:scale-95 sm:bottom-6 sm:left-6 print:hidden"
      >
        {open ? (
          <X className="mx-auto h-7 w-7 text-primary" />
        ) : (
          <img src={kidAvatar} alt="المساعد" width={64} height={64} className="kid-float h-full w-full rounded-full object-cover" />
        )}
        {!open && <span className="absolute -top-1 -right-1 h-4 w-4 animate-ping rounded-full bg-gold" />}
      </button>

      {open && (
        <div className="fixed bottom-44 left-3 right-3 z-[60] flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border bg-card shadow-elegant sm:bottom-28 sm:left-6 sm:right-auto sm:w-[380px] print:hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <img
              src={kidAvatar}
              alt=""
              width={44}
              height={44}
              className={`h-11 w-11 shrink-0 rounded-full bg-card ring-2 ring-gold ${speaking || sending ? "kid-talk" : "kid-float"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">مساعد مستر محمد نِجْم</div>
              <div className="text-[10px] opacity-90">{speaking ? "يتحدث الآن…" : listening ? "أسمعك… اتكلم" : teacherMode && !studentArea ? "مساعد الأستاذ — صلاحيات كاملة" : "إرشاد استخدام المنصة — بالكتابة أو بالصوت"}</div>
            </div>
            <button
              onClick={() => { if (autoSpeak) stopSpeak(); setAutoSpeak((v) => !v); }}
              title={autoSpeak ? "إيقاف القراءة الصوتية" : "تشغيل القراءة الصوتية"}
              className="rounded-lg p-1.5 hover:bg-white/15"
            >
              {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button onClick={newChat} title="محادثة جديدة" className="rounded-lg p-1.5 hover:bg-white/15">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button onClick={toggleOpen} title="إغلاق" className="rounded-lg p-1.5 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex items-end gap-1.5 ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm font-semibold leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "rounded-tl-sm bg-primary text-primary-foreground"
                      : "rounded-tr-sm border bg-card text-card-foreground"
                  }`}
                >
                  {m.content}
                  {m.role === "assistant" && (
                    <button
                      onClick={() => speak(m.content)}
                      title="استمع"
                      className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    >
                      <Volume2 className="h-3.5 w-3.5" /> استمع
                    </button>
                  )}
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

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t bg-card p-2.5"
          >
            {micSupported && (
              <button
                type="button"
                onClick={toggleMic}
                aria-label={listening ? "إيقاف التسجيل" : "تحدث"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow transition ${
                  listening ? "animate-pulse bg-destructive text-destructive-foreground" : "bg-gold text-primary"
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_LEN}
              placeholder={listening ? "أسمعك… تكلّم الآن" : "اكتب سؤالك أو اضغط المايك…"}
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
          <div className="border-t bg-muted/60 py-1.5 text-center text-[11px] font-black text-primary">
            {CLOSING} 🌟
          </div>
        </div>
      )}
    </>
  );
}
