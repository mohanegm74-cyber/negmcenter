import { callAi, parseJson } from "./ai.server";
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

export async function askTeacherAssistant(history: { role: string; content: string }[]): Promise<{ reply: string; executed: boolean }> {
  const ctx = await buildTeacherContext();
  const system = `أنت «مساعد مستر محمد نِجْم» الشخصي داخل لوحة الأستاذ. المستخدم هو الأستاذ صاحب المنصة نفسه وله كامل الصلاحيات.
أجب عن أي سؤال بالكامل: الماليات والمبالغ والمتأخرات والإعفاءات، أعداد الطلاب والمجموعات، الحضور والغياب، الدرجات والاختبارات والواجبات، وطريقة استخدام أي صفحة.
اعتمد على «بيانات المركز الحالية» أدناه فقط في الأرقام، واحسب منها بدقة. لا تخترع أرقامًا؛ إن لم تتوفر معلومة قل ذلك.
ردّ باللهجة المصرية الودودة باختصار ووضوح. المبالغ بالجنيه المصري.

تنفيذ الأوامر: تقدر تنفذ أوامر الأستاذ في كل تبويبات لوحته: الحضور، الماليات، الملاحظات والتقييمات، إضافة/تعديل/نقل/تفعيل/إيقاف/حذف طالب، إضافة/تعديل مجموعة، إضافة واجب، كتابة اختبار إلكتروني (يتحفظ مسودة).
لو الرسالة فيها أكتر من أمر، نفّذها كلها مرة واحدة بوضع كل الأوامر في actions بالترتيب.
ردّك لازم يكون JSON فقط بالشكل: {"reply":"نص الرد","actions":[...]}
أنواع actions (استخدم أسماء الطلاب أو أكوادهم وأسماء المجموعات كما في البيانات):
{"type":"attendance","status":"present|absent|late","students":["اسم"],"group":"اسم مجموعة اختياري","except":["اسم"],"date":"YYYY-MM-DD اختياري"}
{"type":"payment","student":"اسم","amount":100,"kind":"payment|exempt|charge","month":"YYYY-MM اختياري"}
{"type":"note","body":"النص","title":"اختياري","students":["اسم"],"group":"اختياري","all":false}
{"type":"record","student":"اسم","exam_level":"نص أو درجة","recitation_level":"ممتاز|جيد جدا|جيد|مقبول|ضعيف","note":"اختياري","date":"اختياري"}
{"type":"add_student","full_name":"الاسم الثلاثي","phone":"اختياري","parent_phone":"اختياري","grade":"اختياري","group":"اختياري","school":"اختياري"}
{"type":"update_student","student":"اسم أو كود","full_name":"اختياري","phone":"","parent_phone":"","grade":"","group":"للنقل لمجموعة","school":"","active":true}
{"type":"delete_student","student":"اسم أو كود"}
{"type":"add_group","name":"","grade":"","monthly_fee":0,"days":"","time":"","max_students":0}
{"type":"update_group","group":"الاسم الحالي","name":"","grade":"","monthly_fee":0,"days":"","time":"","max_students":0}
{"type":"homework","title":"","description":"","due_date":"YYYY-MM-DD","group":"","grade":"","max_score":10}
{"type":"exam","title":"","grade":"","subject":"","lesson":"","group":"","question_count":10,"total_score":10,"difficulty":"سهل|متوسط|صعب","duration_minutes":30}
{"type":"grade_homework","homework":"عنوان الواجب","student":"اسم","score":8,"level":"اختياري","note":"اختياري"}
{"type":"delete_homework","homework":"العنوان بالظبط"}
{"type":"delete_group","group":"اسم"}
{"type":"publish_exam","exam":"عنوان الاختبار","publish":true}
{"type":"certificate","student":"اسم","title":"شهادة تقدير","reason":"اختياري"}
{"type":"restore_student","student":"اسم أو كود طالب مؤرشف"}
الحذف: نفّذه فقط لو الأستاذ قال صراحة احذف وحدد الطالب/المجموعة/الواجب بوضوح. نشر الاختبار فقط لو قال انشر صراحة.
اكتب reply دائمًا باللهجة المصرية العامية بجمل قصيرة مناسبة للقراءة بالصوت، بدون رموز أو جداول.
لو الأمر ناقص معلومة أساسية (مثلاً المبلغ أو اسم الطالب) أو الاسم غامض، اسأل ولا تضع actions. لو مجرد سؤال، اجعل actions فارغة.
في reply عند التنفيذ اكتب جملة قصيرة إنك نفذت (النتيجة التفصيلية هتتضاف تلقائيًا).

دليل استخدام المنصة:
${ASSISTANT_KNOWLEDGE}

بيانات المركز الحالية:
${ctx}`;
  const transcript = history.map((m) => (m.role === "user" ? `الأستاذ: ${m.content}` : `المساعد: ${m.content}`)).join("\n");
  const raw = await callAi(system, `المحادثة:\n${transcript}\n\nأجب على آخر رسالة من الأستاذ بصيغة JSON.`, true);
  let reply = raw;
  let actions: any[] = [];
  try {
    const j = parseJson(raw);
    reply = String(j?.reply || "");
    actions = Array.isArray(j?.actions) ? j.actions : [];
  } catch { /* رد نصي عادي */ }
  let executed = false;
  if (actions.length) {
    const { executeActions } = await import("./assistant-actions.server");
    const res = await executeActions(actions);
    executed = res.some((r) => r.startsWith("✅"));
    reply = `${reply}\n${res.join("\n")}`.trim();
  }
  reply = reply.replace(/\*\*/g, "").replace(/^\s*\*\s+/gm, "• ");
  return { reply: reply.length > 3000 ? reply.slice(0, 3000) + "…" : reply, executed };
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
  // احتياطي: صوت عربي طبيعي عبر Lovable AI (لما مفتاح جيميناي يوصل للحد)
  const lk = process.env.LOVABLE_API_KEY;
  if (!lk) return null;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${lk}` },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-tts-preview",
        stream_format: "audio",
        contents: [{ role: "user", parts: [{ text: `اقرأ النص التالي بصوت طفل مصري مرح وودود باللهجة المصرية العامية:\n${clean}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } },
      }),
    });
    if (!r.ok) { console.error("[tts] gateway", r.status, await r.text()); return null; }
    const buf = new Uint8Array(await r.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${r.headers.get("content-type") || "audio/wav"};base64,${btoa(s)}`;
  } catch (e) { console.error("[tts] gateway failed", e); return null; }
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
