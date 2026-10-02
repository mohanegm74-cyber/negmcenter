type G = { id: string; name: string; grade: string | null };
type Item = { grade: string | null; group_id: string | null };

export function filterByGradeGroup<T extends Item>(items: T[], f: { grade: string; group: string }) {
  return items.filter((i) => (!f.grade || i.grade === f.grade) && (!f.group || i.group_id === f.group));
}

export function GradeGroupFilter({ items, groups, value, onChange }: { items: Item[]; groups: G[]; value: { grade: string; group: string }; onChange: (v: { grade: string; group: string }) => void }) {
  const grades = Array.from(new Set(items.map((i) => i.grade).filter(Boolean))) as string[];
  const groupIds = new Set(filterByGradeGroup(items, { grade: value.grade, group: "" }).map((i) => i.group_id).filter(Boolean));
  const shownGroups = groups.filter((g) => groupIds.has(g.id));
  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs font-black transition-all ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`;
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-muted-foreground">الصف:</span>
        <button className={chip(!value.grade)} onClick={() => onChange({ grade: "", group: "" })}>الكل ({items.length})</button>
        {grades.map((g) => (
          <button key={g} className={chip(value.grade === g)} onClick={() => onChange({ grade: g, group: "" })}>{g} ({items.filter((i) => i.grade === g).length})</button>
        ))}
      </div>
      {shownGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-muted-foreground">المجموعة:</span>
          <button className={chip(!value.group)} onClick={() => onChange({ ...value, group: "" })}>الكل</button>
          {shownGroups.map((g) => (
            <button key={g.id} className={chip(value.group === g.id)} onClick={() => onChange({ ...value, group: g.id })}>{g.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
