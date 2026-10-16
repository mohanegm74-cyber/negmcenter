import { callAi } from "./ai.server";
import { ASSISTANT_KNOWLEDGE } from "./assistant-knowledge";
import { academicMonths, autoFee } from "./fees";

/** يبني ملخصًا شاملاً لبيانات المركز للأستاذ فقط (يُستدعى بعد التحقق من الصلاحية) */
export async function buildTeacherContext(): Promise<string> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const month = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [st, gr, pay, att, ex, at, hw, hs] = await Promise.all([
    db.from("students").select("id,full_name,code,grade,group_id,active,archived").limit(3000),
    db.from("groups").select("id,name,grade,monthly_fee,days,time,max_students").limit(500),
    db.from("payments").select("student_id,amount,kind,month").limit(20000),
    db.from("attendance").select("student_id,date,status").gte("date", since).limit(20000),
    db.from("exams").select("id,title,grade,status,total_score").limit(300),
    db.from("exam_attempts").select("exam_id,student_id,percentage,status").limit(10000),
    db.from("homework").select("id,title,due_date,group_id").limit(300),
    db.from("homework_submissions").select("homework_id,student_id,score,status").limit(10000),
  ]);
  const students = (st.data || []).filter((s: any) => !s.archived);
  const groups = gr.data || [];
  const payments = pay.data || [];
  const gMap = new Map(groups.map((g: any) => [g.id, g]));
  const months = academicMonths();

  const calc = (s: any, ms: string[]) => {
    let due = 0, paid = 0, exempt = 0, late = 0;
    const fee = Number((gMap.get(s.group_id) as any)?.monthly_fee || 0);
    for (const m of ms) {
      const sp = payments.filter((p: any) => p.student_id === s.id && p.month === m);
      const sum = (k: string) => sp.filter((p: any) => p.kind === k).reduce((a: number, b: any) => a + Number(b.amount), 0);
      const c = sum("charge"); const d = c > 0 ? c : autoFee(m, fee, s.active !== false);
      const pd = sum("payment"), e = sum("exempt");
      due += d; paid += pd; exempt += e; late += Math.max(0, d - pd - e);
    }
    return { due, paid, exempt, late };
  };

  const attBy = new Map<string, { p: number; a: number }>();
  for (const r of att.data || []) {
    const o = attBy.get(r.student_id) || { p: 0, a: 0 };
    if (r.status === "absent") o.a++; else o.p++;
    attBy.set(r.student_id, o);
  }
  const examBy = new Map<string, number[]>();
  for (const r of at.data || []) if (r.percentage != null) { const a = examBy.get(r.student_id) || []; a.push(Number(r.percentage)); examBy.set(r.student_id, a); }

  const tot = { due: 0, paid: 0, exempt: 0, late: 0 }, totM = { due: 0, paid: 0, exempt: 0, late: 0 };
  const lines: string[] = [];
  for (const s of students) {
    const all = calc(s, months), m = calc(s, [month]);
    (Object.keys(tot) as (keyof typeof tot)[]).forEach((k) => { tot[k] += all[k]; totM[k] += m[k]; });
    const g: any = gMap.get(s.group_id);
    const a = attBy.get(s.id); const ex2 = examBy.get(s.id);
    const status = m.due === 0 ? "-" : m.paid >= m.due ? "دفع" : m.exempt > 0 && m.paid + m.exempt >= m.due ? "معفى" : m.paid > 0 ? "جزئي" : "لم يسدد";
    lines.push(`${s.full_name}|${s.code}|${s.grade || ""}|${g?.name || "بدون"}|${s.active === false ? "غير نشط" : "نشط"}|شهر:${status} مستحق${m.due} مدفوع${m.paid} معفى${m.exempt} متأخر${m.late}|إجمالي متأخر${all.late}|حضور30يوم:${a?.p || 0}/غياب${a?.a || 0}|متوسط اختبارات:${ex2 ? Math.round(ex2.reduce((x, y) => x + y, 0) / ex2.length) + "%" : "-"}`);
  }
  const groupLines = groups.map((g: any) => {
    const n = students.filter((s: any) => s.group_id === g.id).length;
    return `${g.name}|${g.grade || ""}|طلاب:${n}/${g.max_students || "-"}|اشتراك:${g.monthly_fee} جنيه|${g.days || ""} ${g.time || ""}`;
  });
  const todayAtt = (att.data || []).filter((r: any) => r.date === today);
  const hwLines = (hw.data || []).slice(0, 40).map((h: any) => {
    const subs = (hs.data || []).filter((x: any) => x.homework_id === h.id);
    return `${h.title}|تسليم:${h.due_date || "-"}|سلّم:${subs.length}`;
  });
  const exLines = (ex.data || []).slice(0, 40).map((e: any) => {
    const ats = (at.data || []).filter((x: any) => x.exam_id === e.id && x.percentage != null);
    const avg = ats.length ? Math.round(ats.reduce((a: number, b: any) => a + Number(b.percentage), 0) / ats.length) : null;
    return `${e.title}|${e.grade || ""}|${e.status}|محاولات:${ats.length}|متوسط:${avg ?? "-"}%`;
  });

  return `تاريخ اليوم: ${today} — الشهر الحالي: ${month} — العملة: جنيه مصري
عدد الطلاب (غير المؤرشفين): ${students.length} — النشطون: ${students.filter((s: any) => s.active !== false).length} — المجموعات: ${groups.length}
ماليات الشهر الحالي: مستحق ${totM.due} | مدفوع ${totM.paid} | إعفاءات ${totM.exempt} | متأخرات ${totM.late}
ماليات كل الشهور منذ سبتمبر: مستحق ${tot.due} | مدفوع ${tot.paid} | إعفاءات ${tot.exempt} | متأخرات ${tot.late}
حضور اليوم: حاضر ${todayAtt.filter((r: any) => r.status !== "absent").length} | غائب ${todayAtt.filter((r: any) => r.status === "absent").length}

المجموعات (الاسم|الصف|العدد|الاشتراك|المواعيد):
${groupLines.join("\n")}

الطلاب (الاسم|الكود|الصف|المجموعة|الحالة|ماليات الشهر|إجمالي المتأخر|الحضور|الاختبارات):
${lines.join("\n").slice(0, 60000)}

الواجبات:
${hwLines.join("\n")}

الاختبارات الإلكترونية:
${exLines.join("\n")}`;
}

export async function askTeacherAssistant(history: { role: string; content: string }[]): Promise<string> {
  const ctx = await buildTeacherContext();
  const system = `أنت «مساعد مستر محمد نِجْم» الشخصي داخل لوحة الأستاذ. المستخدم هو الأستاذ صاحب المنصة نفسه وله كامل الصلاحيات.
أجب عن أي سؤال بالكامل: الماليات والمبالغ والمتأخرات والإعفاءات، أعداد الطلاب والمجموعات، الحضور والغياب، الدرجات والاختبارات والواجبات، وطريقة استخدام أي صفحة.
اعتمد على «بيانات المركز الحالية» أدناه فقط في الأرقام، واحسب منها بدقة (جمع، عدّ، ترتيب، تصفية حسب مجموعة أو صف). لا تخترع أرقامًا؛ إن لم تتوفر معلومة قل ذلك.
ردّ باللهجة المصرية الودودة باختصار ووضوح، واستخدم قوائم مرقمة عند ذكر أكثر من عنصر. المبالغ بالجنيه المصري.

دليل استخدام المنصة:
${ASSISTANT_KNOWLEDGE}

بيانات المركز الحالية:
${ctx}`;
  const transcript = history.map((m) => (m.role === "user" ? `الأستاذ: ${m.content}` : `المساعد: ${m.content}`)).join("\n");
  let raw = await callAi(system, `المحادثة:\n${transcript}\n\nأجب على آخر رسالة من الأستاذ.`);
  raw = raw.replace(/\*\*/g, "").replace(/^\s*\*\s+/gm, "• ");
  return raw.length > 3000 ? raw.slice(0, 3000) + "…" : raw;
}

/** تحويل النص إلى صوت عربي طبيعي عبر Gemini TTS — يعيد data URL */
export async function synthesizeSpeech(text: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").slice(0, 1500);
  for (const model of ["gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts"]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `اقرأ النص التالي بصوت طفل مصري مرح وودود باللهجة المصرية:\n${clean}` }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } },
        }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const d = j?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
      if (!d?.data) continue;
      const mime = String(d.mimeType || "");
      if (/wav|mpeg|mp3|ogg/i.test(mime) && !/L16|pcm/i.test(mime)) return `data:${mime};base64,${d.data}`;
      const rate = Number(/rate=(\d+)/.exec(mime)?.[1] || 24000);
      return `data:audio/wav;base64,${pcmToWavBase64(d.data, rate)}`;
    } catch { /* جرّب النموذج التالي */ }
  }
  return null;
}

function pcmToWavBase64(b64: string, rate: number): string {
  const pcm = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const buf = new Uint8Array(44 + pcm.length);
  const v = new DataView(buf.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, pcm.length, true); buf.set(pcm, 44);
  let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
