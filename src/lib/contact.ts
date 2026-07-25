export const TEACHER_WHATSAPP = "201015174084";
export const TEACHER_WHATSAPP_DISPLAY = "01015174084";
export const waLink = (msg?: string) =>
  `https://wa.me/${TEACHER_WHATSAPP}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
