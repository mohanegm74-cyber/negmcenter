import { selectEvidence, type SourceEvidence } from "./paper-grounding";

/** Paper-only retrieval: do not change retrieval used by online exams or lesson explanations. */
export async function retrievePaperEvidence(sourceIds: string[], query: string, info: { grade: string; subject: string; term?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = Array.from(new Set(sourceIds));
  const { data: sources, error } = await supabaseAdmin.from("exam_sources")
    .select("id,title,grade,subject,term,mime,status,kind,extracted_text").in("id", ids);
  if (error) throw new Error("تعذر قراءة المصادر المختارة");
  if (!sources || sources.length !== ids.length) throw new Error("أحد المصادر المختارة لم يعد موجوداً؛ أعد الاختيار");
  const items: SourceEvidence[] = [];
  for (const source of sources) {
    if (source.kind !== "source" || source.status !== "indexed") throw new Error(`المصدر «${source.title}» غير جاهز`);
    if ((source.grade && source.grade !== info.grade) || (source.subject && source.subject.trim() !== info.subject.trim()) || (info.term && source.term && source.term !== info.term)) throw new Error(`المصدر «${source.title}» لا يطابق الصف أو المادة أو الفصل المختار`);
    let found = false;
    for (let offset = 0; ; offset += 500) {
      const { data: pages, error: pageError } = await supabaseAdmin.from("exam_source_pages")
        .select("page_no,text").eq("source_id", source.id).order("page_no").range(offset, offset + 499);
      if (pageError) throw new Error("تعذر قراءة صفحات المصدر");
      for (const page of pages || []) {
        if (!page.text.trim()) continue;
        found = true;
        const realPage = source.mime === "application/pdf" || source.mime?.startsWith("image/");
        for (let start = 0, part = 1; start < page.text.length; start += 3200, part++) {
          items.push({ id: `${source.id}:${page.page_no}:${part}`, sourceId: source.id, title: source.title,
            page: realPage ? page.page_no : null, locator: `${realPage ? "صفحة" : "مقطع"} ${page.page_no}`, text: page.text.slice(start, start + 4000) });
        }
      }
      if (!pages || pages.length < 500) break;
    }
    if (!found) {
      const text = source.extracted_text || "";
      for (let start = 0, part = 1; start < text.length; start += 3200, part++) items.push({ id: `${source.id}:legacy:${part}`, sourceId: source.id, title: source.title, page: null, locator: `مقطع ${part}`, text: text.slice(start, start + 4000) });
    }
    if (!items.some(item => item.sourceId === source.id)) throw new Error(`المصدر «${source.title}» لا يحتوي نصاً مقروءاً`);
  }
  return selectEvidence(items, query);
}