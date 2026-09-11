import { getRequestConfig } from "next-intl/server";
import { messages } from "@/lib/messages";
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested === "en" ? "en" : "es";
  return { locale, messages: messages(locale), timeZone: "America/Bogota" };
});
