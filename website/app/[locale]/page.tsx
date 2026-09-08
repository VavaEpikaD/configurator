import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalizedHome } from "../../components/localized-home";
import { isLocale } from "../../lib/i18n";
import { pageMetadata } from "../../lib/seo";

type Props = { params: Promise<{ locale: string }> };
export function generateStaticParams() { return [{ locale: "ro" }, { locale: "de" }]; }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") return {};
  return locale === "ro"
    ? pageMetadata({ locale, title: "Configuratoare 3D pentru produse industriale", description: "Configuratoare 3D cu reguli tehnice, prețuri actualizate și liste de materiale." })
    : pageMetadata({ locale, title: "3D-Konfiguration für Industrieprodukte", description: "Räumliche 3D-Konfiguratoren mit dynamischer Preisbildung, Stücklisten und Echtzeit-Rendering." });
}
export default async function LocaleHome({ params }: Props) { const { locale } = await params; if (!isLocale(locale) || locale === "en") notFound(); return <LocalizedHome locale={locale} />; }
