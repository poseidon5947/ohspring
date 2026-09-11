import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { messages } from "@/lib/messages";
import Language from "@/components/Language";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!["en", "es"].includes(locale)) notFound();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages(locale)}
      timeZone="America/Bogota"
    >
      <Language />
      {children}
    </NextIntlClientProvider>
  );
}
