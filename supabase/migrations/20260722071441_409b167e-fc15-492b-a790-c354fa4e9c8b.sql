
-- Groups
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  teacher_name TEXT,
  color TEXT DEFAULT '#1e40af',
  days TEXT,
  time TEXT,
  room TEXT,
  max_students INT DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups read all" ON public.groups FOR SELECT USING (true);
CREATE POLICY "groups write auth" ON public.groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Students
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE DEFAULT ('STU-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  full_name TEXT NOT NULL,
  gender TEXT,
  birth_date DATE,
  national_id TEXT,
  phone TEXT,
  parent_phone TEXT,
  address TEXT,
  governorate TEXT,
  education_dept TEXT,
  school TEXT,
  grade TEXT,
  section TEXT,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  subject TEXT,
  teacher_name TEXT,
  photo_url TEXT,
  notes TEXT,
  registration_date DATE DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.students TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students public read" ON public.students FOR SELECT USING (true);
CREATE POLICY "students public insert" ON public.students FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "students auth all" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Attendance
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
GRANT SELECT ON public.attendance TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance public read" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "attendance auth all" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
