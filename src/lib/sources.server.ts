/** Server-only: retrieve the most relevant pages across ALL parts of the selected sources. */
export async function retrieveSourceText(sourceIds: string[], query: string, budget = 40000): Promise<string> {
  if (!sourceIds?.length) return "";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = sourceIds.slice(0, 20);
  const { data: srcs } = await supabaseAdmin.from("exam_sources").select("id,title,lesson,extracted_text,page_count").in("id", ids);
  const terms = String(query || "")
    .split(/[\s,،؛;\-–]+/).map((t) => t.trim()).filter((t) => t.length >= 3).slice(0, 12);
  const per = Math.floor(budget / Math.max(1, srcs?.length || 1));
  const out: string[] = [];
  for (const s of srcs || []) {
    let picked = "";
    if ((s as any).page_count > 0) {
      let rows: any[] = [];
      if (terms.length) {
        const or = terms.map((t) => `text.ilike.%${t.replace(/[%,()]/g, "")}%`).join(",");
        const { data } = await supabaseAdmin.from("exam_source_pages").select("page_no,text").eq("source_id", s.id).or(or).limit(400);
        rows = (data || []).map((r: any) => ({ ...r, hits: terms.reduce((a, t) => a + (r.text.split(t).length - 1), 0) }))
          .sort((a, b) => b.hits - a.hits);
      }
      if (!rows.length) {
        const { data } = await supabaseAdmin.from("exam_source_pages").select("page_no,text").eq("source_id", s.id).order("page_no").limit(60);
        rows = data || [];
      }
      const chosen: any[] = [];
      let len = 0;
      for (const r of rows) { if (len >= per) break; chosen.push(r); len += r.text.length; }
      chosen.sort((a, b) => a.page_no - b.page_no);
      picked = chosen.map((r) => `[صفحة ${r.page_no}]\n${r.text}`).join("\n").slice(0, per);
    } else {
      picked = String(s.extracted_text || "").slice(0, per);
    }
    out.push(`### المصدر: ${s.title}${s.lesson ? ` (${s.lesson})` : ""}\n${picked}`);
  }
  return out.join("\n\n");
}
