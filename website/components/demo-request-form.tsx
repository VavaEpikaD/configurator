"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "../lib/i18n";

const FIREBASE_SDK_VERSION = "12.17.1";
const FIREBASE_APP_MODULE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`;
const FIREBASE_APP_CHECK_MODULE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-check.js`;
const FIREBASE_FUNCTIONS_MODULE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-functions.js`;
const FIREBASE_APP_NAME = "360-demo-request";
const FIREBASE_FUNCTIONS_REGION = "europe-west1";
const FIREBASE_APP_CHECK_SITE_KEY = "6LcJyo8tAAAAAFCdE_-BVDoggyWLSP9N0BM-T8sr";
const ATTACH_DEMO_USER_URL = `https://${FIREBASE_FUNCTIONS_REGION}-configurator-360.cloudfunctions.net/attachDemoRequestUser`;
const SHARED_AUTH_MODULE_URL = "/shared-ui/src/firebaseAuth.js?v=19";
const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyBgS4VLxQYZnqW-YZJPKvuuocf5w_0kRwY",
  authDomain: "configurator-360.firebaseapp.com",
  projectId: "configurator-360",
  appId: "1:719238533149:web:9e0b8a97375731b8eaf6f4",
});

const CONFIGURATORS = ["window", "pergola", "roof", "hall", "solar", "fence", "cardbox"] as const;
type ConfiguratorId = (typeof CONFIGURATORS)[number];
type SubmissionState = "idle" | "submitting" | "success" | "error" | "rate-limited" | "validation";
type RequiredFieldName = "name" | "email" | "company" | "phone";

type SharedAuthModule = {
  getFirebaseIdToken: () => Promise<string>;
  observeGoogleAuth: (callback: (user: { uid?: string } | null) => void) => Promise<() => void>;
};

type DemoCallableContext = {
  submitContact: (payload: Record<string, string | string[]>) => Promise<{ data?: { success?: boolean; delivered?: boolean; requestId?: string } }>;
  attachLoggedInUser: (requestId: string) => Promise<boolean>;
};

let demoCallablePromise: Promise<DemoCallableContext> | null = null;

const productNames: Record<Locale, Record<ConfiguratorId, string>> = {
  en: { window: "Window configurator", pergola: "Pergola configurator", roof: "Roof configurator", hall: "Hall configurator", solar: "Solar configurator", fence: "Fence configurator", cardbox: "Cardbox configurator" },
  ro: { window: "Configurator ferestre", pergola: "Configurator pergole", roof: "Configurator acoperiș", hall: "Configurator hale", solar: "Configurator solar", fence: "Configurator garduri", cardbox: "Configurator cutii din carton" },
  de: { window: "Fenster-Konfigurator", pergola: "Pergola-Konfigurator", roof: "Dach-Konfigurator", hall: "Hallen-Konfigurator", solar: "Solar-Konfigurator", fence: "Zaun-Konfigurator", cardbox: "Kartonbox-Konfigurator" },
};

const copyByLocale = {
  en: {
    configurator: "Configurators of interest",
    sourceConfigurator: "Selected automatically from where you opened this page",
    addConfigurator: "Add configurator",
    selectConfigurator: "Choose another configurator",
    removeConfigurator: "Remove configurator",
    name: "Your name",
    email: "Work email",
    company: "Company name",
    phone: "Phone",
    website: "Company website",
    role: "Job title / role",
    rolePlaceholder: "Select a role",
    roleOptions: { owner: "Owner / founder", executive: "CEO / Managing Director", sales: "Sales / Business Development", design: "Design / Engineering", operations: "Operations / Production", procurement: "Procurement / Purchasing", it: "IT / Software", marketing: "Marketing", other: "Other", private: "Prefer not to say" },
    country: "Country / region",
    timing: "Preferred demo timing",
    timingPlaceholder: "No preference",
    timingOptions: { asap: "As soon as possible", week: "This week", fortnight: "Within two weeks" },
    notes: "What would you like to see in the demo?",
    notesPlaceholder: "Optional: product rules, pricing, BOM, integrations, sales workflow, CAD data…",
    back: "Back",
    submit: "Send request",
    submitting: "Sending request…",
    consent: "By sending this request, you agree that the 360Configurator team may contact you about this demo.",
    ready: "Your demo request was sent successfully. We will contact you shortly.",
    error: "The request could not be sent. Please check your connection and try again.",
    rateLimited: "Too many requests were sent in a short period. Please try again later.",
    missingConfigurator: "Add at least one configurator of interest.",
    missingRequired: "Please complete the required fields highlighted in red.",
  },
  ro: {
    configurator: "Configuratoare de interes",
    sourceConfigurator: "Selectat automat din pagina de unde ai deschis formularul",
    addConfigurator: "Adaugă configurator",
    selectConfigurator: "Alege alt configurator",
    removeConfigurator: "Elimină configuratorul",
    name: "Numele tău",
    email: "Email profesional",
    company: "Numele companiei",
    phone: "Telefon",
    website: "Website companie",
    role: "Funcție / rol",
    rolePlaceholder: "Alege un rol",
    roleOptions: { owner: "Proprietar / fondator", executive: "CEO / Director general", sales: "Vânzări / Business Development", design: "Proiectare / Inginerie", operations: "Operațiuni / Producție", procurement: "Achiziții", it: "IT / Software", marketing: "Marketing", other: "Altul", private: "Prefer să nu spun" },
    country: "Țară / regiune",
    timing: "Perioada preferată pentru demo",
    timingPlaceholder: "Fără preferință",
    timingOptions: { asap: "Cât mai curând", week: "Săptămâna aceasta", fortnight: "În următoarele două săptămâni" },
    notes: "Ce ai dori să vezi în demonstrație?",
    notesPlaceholder: "Opțional: reguli de produs, preț, BOM, integrări, flux comercial, date CAD…",
    back: "Înapoi",
    submit: "Trimite solicitarea",
    submitting: "Se trimite…",
    consent: "Prin trimiterea solicitării ești de acord ca echipa 360Configurator să te contacteze în legătură cu acest demo.",
    ready: "Solicitarea pentru demo a fost trimisă. Te vom contacta în curând.",
    error: "Solicitarea nu a putut fi trimisă. Verifică conexiunea și încearcă din nou.",
    rateLimited: "Au fost trimise prea multe solicitări într-un timp scurt. Încearcă din nou mai târziu.",
    missingConfigurator: "Adaugă cel puțin un configurator de interes.",
    missingRequired: "Completează câmpurile obligatorii evidențiate cu roșu.",
  },
  de: {
    configurator: "Interessante Konfiguratoren",
    sourceConfigurator: "Automatisch anhand der Seite ausgewählt, von der Sie dieses Formular geöffnet haben",
    addConfigurator: "Konfigurator hinzufügen",
    selectConfigurator: "Weiteren Konfigurator auswählen",
    removeConfigurator: "Konfigurator entfernen",
    name: "Ihr Name",
    email: "Geschäftliche E-Mail",
    company: "Unternehmen",
    phone: "Telefon",
    website: "Unternehmenswebsite",
    role: "Position / Rolle",
    rolePlaceholder: "Rolle auswählen",
    roleOptions: { owner: "Inhaber / Gründer", executive: "CEO / Geschäftsführer", sales: "Vertrieb / Business Development", design: "Design / Engineering", operations: "Betrieb / Produktion", procurement: "Einkauf / Beschaffung", it: "IT / Software", marketing: "Marketing", other: "Andere", private: "Keine Angabe" },
    country: "Land / Region",
    timing: "Bevorzugter Demo-Zeitraum",
    timingPlaceholder: "Keine Präferenz",
    timingOptions: { asap: "So bald wie möglich", week: "Diese Woche", fortnight: "Innerhalb von zwei Wochen" },
    notes: "Was möchten Sie in der Demo sehen?",
    notesPlaceholder: "Optional: Produktregeln, Preislogik, Stückliste, Integrationen, Vertriebsworkflow, CAD-Daten…",
    back: "Zurück",
    submit: "Anfrage senden",
    submitting: "Anfrage wird gesendet…",
    consent: "Mit dem Absenden stimmen Sie zu, dass das 360Configurator-Team Sie zu dieser Demo kontaktieren darf.",
    ready: "Ihre Demo-Anfrage wurde erfolgreich gesendet. Wir melden uns in Kürze.",
    error: "Die Anfrage konnte nicht gesendet werden. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
    rateLimited: "In kurzer Zeit wurden zu viele Anfragen gesendet. Bitte versuchen Sie es später erneut.",
    missingConfigurator: "Fügen Sie mindestens einen interessanten Konfigurator hinzu.",
    missingRequired: "Füllen Sie die rot markierten Pflichtfelder aus.",
  },
} as const;

const ROLE_VALUES = [
  ["owner-founder", "owner"],
  ["ceo-managing-director", "executive"],
  ["sales-business-development", "sales"],
  ["design-engineering", "design"],
  ["operations-production", "operations"],
  ["procurement-purchasing", "procurement"],
  ["it-software", "it"],
  ["marketing", "marketing"],
  ["other", "other"],
  ["prefer-not-to-say", "private"],
] as const;

function isLocalDevelopmentHost() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

async function importFirebaseModule(url: string) {
  return import(/* @vite-ignore */ url);
}

async function waitForPersistedAuth(sharedAuth: SharedAuthModule) {
  let token = await sharedAuth.getFirebaseIdToken();
  if (token) return token;

  await new Promise<void>((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      try { unsubscribe?.(); } catch { /* best effort */ }
      resolve();
    };
    const timer = window.setTimeout(finish, 5000);
    sharedAuth.observeGoogleAuth(() => {
      window.clearTimeout(timer);
      finish();
    }).then((stop) => {
      unsubscribe = stop;
      if (settled) stop();
    }).catch(() => {
      window.clearTimeout(timer);
      finish();
    });
  });

  token = await sharedAuth.getFirebaseIdToken();
  return token;
}

async function getDemoCallable(): Promise<DemoCallableContext> {
  if (demoCallablePromise) return demoCallablePromise;
  demoCallablePromise = (async () => {
    if (isLocalDevelopmentHost()) {
      const runtime = globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean };
      if (typeof runtime.FIREBASE_APPCHECK_DEBUG_TOKEN === "undefined") runtime.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    const [appModule, appCheckModule, functionsModule] = await Promise.all([
      importFirebaseModule(FIREBASE_APP_MODULE_URL),
      importFirebaseModule(FIREBASE_APP_CHECK_MODULE_URL),
      importFirebaseModule(FIREBASE_FUNCTIONS_MODULE_URL),
    ]);
    const existingApp = appModule.getApps().find((candidate: { name?: string }) => candidate.name === FIREBASE_APP_NAME);
    const app = existingApp || appModule.initializeApp(FIREBASE_CONFIG, FIREBASE_APP_NAME);
    const appCheck = appCheckModule.initializeAppCheck(app, {
      provider: new appCheckModule.ReCaptchaEnterpriseProvider(FIREBASE_APP_CHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: false,
    });
    await appCheckModule.getToken(appCheck, false);
    const functions = functionsModule.getFunctions(app, FIREBASE_FUNCTIONS_REGION);

    const attachLoggedInUser = async (requestId: string) => {
      const id = String(requestId || "").trim();
      if (!id) return false;
      const sharedAuth = await importFirebaseModule(SHARED_AUTH_MODULE_URL) as SharedAuthModule;
      const idToken = await waitForPersistedAuth(sharedAuth);
      if (!idToken) return false;
      const appCheckToken = await appCheckModule.getToken(appCheck, false);
      const response = await fetch(ATTACH_DEMO_USER_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-Firebase-AppCheck": String(appCheckToken?.token || ""),
        },
        body: JSON.stringify({ data: { requestId: id } }),
      });
      let payload: { error?: { message?: string } } | null = null;
      try { payload = await response.json(); } catch { /* handled below */ }
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error?.message || `Could not record the signed-in user (${response.status}).`);
      }
      return true;
    };

    return {
      submitContact: functionsModule.httpsCallable(functions, "submitContact"),
      attachLoggedInUser,
    };
  })().catch((error) => {
    demoCallablePromise = null;
    throw error;
  });
  return demoCallablePromise;
}

function firebaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code || "").toLowerCase();
}

function normalizeConfigurator(value: string): ConfiguratorId | "" {
  const normalized = value.trim().toLowerCase();
  return CONFIGURATORS.includes(normalized as ConfiguratorId) ? normalized as ConfiguratorId : "";
}

function requiredFieldErrors(form: HTMLFormElement) {
  const result: Partial<Record<RequiredFieldName, boolean>> = {};
  const value = (name: RequiredFieldName) => String(new FormData(form).get(name) || "").trim();
  for (const name of ["name", "company", "phone"] as RequiredFieldName[]) {
    if (!value(name)) result[name] = true;
  }
  const email = value("email");
  const emailElement = form.elements.namedItem("email") as HTMLInputElement | null;
  if (!email || Boolean(emailElement?.validity.typeMismatch)) result.email = true;
  return result;
}

export function DemoRequestForm({ locale }: { locale: Locale }) {
  const copy = copyByLocale[locale];
  const [state, setState] = useState<SubmissionState>("idle");
  const [sourceConfigurator, setSourceConfigurator] = useState<ConfiguratorId | "">("");
  const [selectedConfigurators, setSelectedConfigurators] = useState<ConfiguratorId[]>([]);
  const [configuratorToAdd, setConfiguratorToAdd] = useState<ConfiguratorId | "">("");
  const [sourceConfiguratorPage, setSourceConfiguratorPage] = useState("");
  const [invalidFields, setInvalidFields] = useState<Partial<Record<RequiredFieldName, boolean>>>({});
  const [configuratorMissing, setConfiguratorMissing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = normalizeConfigurator(params.get("configurator") || "");
    setSourceConfigurator(source);
    setSelectedConfigurators(source ? [source] : []);
    setSourceConfiguratorPage((params.get("source") || "").slice(0, 2048));
  }, []);

  const remainingConfigurators = useMemo(
    () => CONFIGURATORS.filter((id) => !selectedConfigurators.includes(id)),
    [selectedConfigurators],
  );

  const statusText = state === "success"
    ? copy.ready
    : state === "rate-limited"
      ? copy.rateLimited
      : state === "validation"
        ? (configuratorMissing ? copy.missingConfigurator : copy.missingRequired)
        : state === "error"
          ? copy.error
          : "";

  const clearInvalidField = (field: RequiredFieldName) => {
    if (!invalidFields[field]) return;
    setInvalidFields((current) => ({ ...current, [field]: false }));
    if (state === "validation") setState("idle");
  };

  const addConfigurator = () => {
    if (!configuratorToAdd || selectedConfigurators.includes(configuratorToAdd)) return;
    setSelectedConfigurators((current) => [...current, configuratorToAdd]);
    setConfiguratorToAdd("");
    setConfiguratorMissing(false);
    if (state === "validation") setState("idle");
  };

  const removeConfigurator = (id: ConfiguratorId) => {
    if (id === sourceConfigurator) return;
    setSelectedConfigurators((current) => current.filter((candidate) => candidate !== id));
  };

  return (
    <form className="demo-request-form" noValidate onSubmit={async (event) => {
      event.preventDefault();
      if (state === "submitting") return;
      const form = event.currentTarget;
      const nextInvalidFields = requiredFieldErrors(form);
      const missingConfigurator = selectedConfigurators.length === 0;
      setInvalidFields(nextInvalidFields);
      setConfiguratorMissing(missingConfigurator);

      if (Object.values(nextInvalidFields).some(Boolean) || missingConfigurator) {
        setState("validation");
        const firstInvalid = (["name", "email", "company", "phone"] as RequiredFieldName[]).find((name) => nextInvalidFields[name]);
        if (firstInvalid) (form.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus();
        return;
      }

      const data = new FormData(form);
      const primaryConfigurator = sourceConfigurator || selectedConfigurators[0];
      setState("submitting");
      try {
        const callable = await getDemoCallable();
        const response = await callable.submitContact({
          requestType: "demo",
          name: String(data.get("name") || ""),
          email: String(data.get("email") || ""),
          company: String(data.get("company") || ""),
          phone: String(data.get("phone") || ""),
          companyWebsite: String(data.get("companyWebsite") || ""),
          jobTitle: String(data.get("jobTitle") || ""),
          country: String(data.get("country") || ""),
          preferredTiming: String(data.get("preferredTiming") || ""),
          message: String(data.get("message") || ""),
          configurator: primaryConfigurator,
          configurators: selectedConfigurators,
          sourceConfigurator: sourceConfigurator || primaryConfigurator,
          language: locale,
          sourcePage: window.location.href,
          sourceConfiguratorPage,
          website: String(data.get("website") || ""),
        });
        if (!response.data?.success) throw new Error("Demo request was not accepted.");

        const requestId = String(response.data.requestId || "");
        if (requestId) {
          // Capture the existing Firebase session in the background. The demo is
          // already accepted at this point, so login metadata must never delay or
          // change the successful form result shown to the visitor.
          void callable.attachLoggedInUser(requestId).catch((attachError) => {
            console.warn("Demo request was sent, but its signed-in Firebase user could not be recorded.", attachError);
          });
        }

        setState("success");
        setInvalidFields({});
        form.reset();
        setConfiguratorToAdd("");
      } catch (error) {
        console.error("Demo request submission failed.", error);
        const code = firebaseErrorCode(error);
        setState(code.includes("resource-exhausted") ? "rate-limited" : "error");
      }
    }}>
      <div className={`demo-request-context ${configuratorMissing ? "is-invalid" : ""}`}>
        <div className="demo-request-context-heading">
          <span>{copy.configurator}</span>
          {sourceConfigurator && <small>{copy.sourceConfigurator}</small>}
        </div>
        <div className="demo-configurator-selection">
          <div className="demo-configurator-chips">
            {selectedConfigurators.map((id) => (
              <span className={`demo-configurator-chip ${id === sourceConfigurator ? "is-source" : ""}`} key={id}>
                <strong>{productNames[locale][id]}</strong>
                {id !== sourceConfigurator && (
                  <button type="button" aria-label={`${copy.removeConfigurator}: ${productNames[locale][id]}`} onClick={() => removeConfigurator(id)}>×</button>
                )}
              </span>
            ))}
          </div>
          {remainingConfigurators.length > 0 && (
            <div className="demo-configurator-add-row">
              <select value={configuratorToAdd} onChange={(event) => setConfiguratorToAdd(normalizeConfigurator(event.target.value))} aria-label={copy.selectConfigurator}>
                <option value="">{copy.selectConfigurator}</option>
                {remainingConfigurators.map((id) => <option key={id} value={id}>{productNames[locale][id]}</option>)}
              </select>
              <button type="button" className="demo-configurator-add" disabled={!configuratorToAdd} onClick={addConfigurator}><span>+</span>{copy.addConfigurator}</button>
            </div>
          )}
        </div>
      </div>

      <div className="demo-request-grid">
        <label className={invalidFields.name ? "is-invalid" : ""}><span>{copy.name} <b>*</b></span><input name="name" autoComplete="name" maxLength={120} aria-required="true" onInput={() => clearInvalidField("name")} placeholder="Ana Beech" /></label>
        <label className={invalidFields.email ? "is-invalid" : ""}><span>{copy.email} <b>*</b></span><input name="email" type="email" autoComplete="email" maxLength={254} aria-required="true" onInput={() => clearInvalidField("email")} placeholder="you@work.com" /></label>
        <label className={invalidFields.company ? "is-invalid" : ""}><span>{copy.company} <b>*</b></span><input name="company" autoComplete="organization" maxLength={160} aria-required="true" onInput={() => clearInvalidField("company")} placeholder="Beech Outdoor Living" /></label>
        <label className={invalidFields.phone ? "is-invalid" : ""}><span>{copy.phone} <b>*</b></span><input name="phone" type="tel" autoComplete="tel" maxLength={60} aria-required="true" onInput={() => clearInvalidField("phone")} placeholder="+40 712 345 678" /></label>
        <label><span>{copy.website}</span><input name="companyWebsite" inputMode="url" maxLength={300} placeholder="company.com" /></label>
        <label><span>{copy.role}</span><select name="jobTitle" defaultValue=""><option value="">{copy.rolePlaceholder}</option>{ROLE_VALUES.map(([value, label]) => <option key={value} value={value}>{copy.roleOptions[label]}</option>)}</select></label>
        <label><span>{copy.country}</span><input name="country" autoComplete="country-name" maxLength={120} placeholder="Romania" /></label>
        <label><span>{copy.timing}</span><select name="preferredTiming" defaultValue=""><option value="">{copy.timingPlaceholder}</option><option value="asap">{copy.timingOptions.asap}</option><option value="week">{copy.timingOptions.week}</option><option value="fortnight">{copy.timingOptions.fortnight}</option></select></label>
      </div>

      <label className="demo-request-notes"><span>{copy.notes}</span><textarea name="message" rows={4} maxLength={3000} placeholder={copy.notesPlaceholder} /></label>
      <label className="demo-request-honeypot" aria-hidden="true"><span>Website</span><input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>

      <div className="demo-request-actions">
        <button className="demo-request-back" type="button" onClick={() => window.history.back()}><span>‹</span>{copy.back}</button>
        <p>{copy.consent}</p>
        <button className="demo-request-submit" type="submit" disabled={state === "submitting"} aria-busy={state === "submitting"}>{state === "submitting" ? copy.submitting : copy.submit}<span>→</span></button>
      </div>
      <p className={`demo-request-status ${state === "success" ? "is-success" : state === "error" || state === "rate-limited" || state === "validation" ? "is-error" : ""}`} aria-live="polite">{statusText}</p>
    </form>
  );
}
