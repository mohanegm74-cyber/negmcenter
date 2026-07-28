import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    // توجيه تلقائي إلى لوحة التحكم عند الدخول إلى المسار الرئيسي
    throw redirect({ to: "/dashboard" });
  },
});