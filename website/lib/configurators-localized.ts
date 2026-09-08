import { configurators, type Configurator, type ConfiguratorSlug } from "./configurators";
import { configuratorUrl, type Locale } from "./i18n";

type Translation = Pick<Configurator, "category" | "title" | "shortTitle" | "statement" | "description" | "controls" | "features" | "outputs" | "seoH1" | "seoTitle" | "seoDescription">;

const ro: Record<ConfiguratorSlug, Translation> = {
  pergola: {
    category: "Amenajări exterioare", title: "Pergole bioclimatice 3D", shortTitle: "Pergole",
    statement: "Configurează pergola. Vezi imediat lumina și umbra.",
    description: "Configurează direct în browser dimensiunile pergolei, montajul autoportant sau la perete, lamelele, închiderile laterale, iluminatul, accesoriile și prețul estimativ.",
    controls: ["Lamele 0°", "Lamele 48°", "Noapte + LED"],
    features: [
      { title: "Structură parametrică", short: "Structură", body: "Definește amprenta, înălțimea și tipul de montaj, iar stâlpii, grinzile, deschiderile și drenajul ascuns se reconstruiesc ca un ansamblu coordonat. Dimensiunile rămân conectate la produsul fabricabil, nu la o simplă reprezentare decorativă." },
      { title: "Controlul lamelelor și al luminii", short: "Lamele", body: "Schimbă orientarea și unghiul lamelelor în raport cu poziția soarelui. Scena arată imediat efectul asupra deschiderii, umbrei, luminii directe și protecției la ploaie, înainte ca structura să fie produsă sau instalată." },
      { title: "Închideri configurabile pe fiecare latură", short: "Închideri", body: "Alege separat pentru fiecare segment: latură deschisă, rulou textil manual, rulou ZIP motorizat, perete cu lamele sau panouri glisante din sticlă. Modelul 3D arată poziția și gradul de deschidere." },
      { title: "Confort și iluminat", short: "Iluminat", body: "Comută între zi și noapte, apoi configurează banda LED perimetrală, temperatura de culoare, spoturile și încălzitoarele cu infraroșu. Previzualizarea arată efectul luminii și al umbrelor." },
      { title: "Automatizare și senzori", short: "Automatizare", body: "Alege comandă manuală, telecomandă sau întrerupător și stabilește pozițiile componentelor automatizate. Senzorii de ploaie și vânt intră în aceeași configurație, conectând opțiunile vizibile cu funcționarea reală după instalare." },
      { title: "Preț estimativ actualizat", short: "Preț", body: "Dimensiunile, închiderile, automatizarea, iluminatul și accesoriile recalculează totalul după fiecare alegere. Configurația văzută de client rămâne legată de estimarea comercială." },
    ],
    outputs: ["Ofertă actualizată", "Geometrie configurată", "Listă de accesorii", "Rezumat pentru client"],
    seoH1: "Configurator pergolă 3D online",
    seoTitle: "Configurator Pergolă 3D Online | Proiectare Pergole",
    seoDescription: "Configurează o pergolă online în 3D. Alege dimensiunile, lamelele, închiderile laterale, iluminatul, automatizarea, accesoriile și vezi prețul estimativ.",
  },
  roof: {
    category: "Acoperișuri", title: "Acoperișuri configurabile 3D", shortTitle: "Acoperișuri",
    statement: "Configurează forma. Obține cantitățile necesare.",
    description: "Alege forma, dimensiunile și învelitoarea acoperișului, apoi obține geometria, cantitățile și lista de materiale necesare pentru estimare.",
    controls: ["Două ape", "Metal", "Formă L"],
    features: [
      { title: "Cinci forme de acoperiș", short: "Forme", body: "Alege un acoperiș în două ape, patru ape, o apă, în formă de L sau cu lucarnă. Geometria se generează din dimensiunile introduse, nu dintr-un model fix." },
      { title: "Preluarea planurilor personalizate", short: "Planuri", body: "Încarcă referințe PDF, imagine, DWG sau DXF pentru proiectele care depășesc familiile parametrice standard. Fluxul creează o punte clară între documentația arhitecturală convențională și un acoperiș configurabil și măsurabil." },
      { title: "Cinci dimensiuni reglabile", short: "Dimensiuni", body: "Reglează lungimea, adâncimea, înălțimea pereților, panta și streașina. Modelul se reconstruiește în timp real și păstrează toate măsurătorile corelate." },
      { title: "Geometrie adaptată învelitorii", short: "Materiale", body: "Aplică finisaje metalice și minerale cu comportamente de suprafață și limite proprii de pantă. Materialul influențează nu doar aspectul, ci și compatibilitatea geometrică, cantitățile și interpretarea comercială." },
      { title: "Cantități măsurate", short: "Cantități", body: "Calculează suprafața, coamele, streșinile, doliile, șorțurile, jgheaburile și componentele asociate direct din geometria generată. Formele complexe rămân conectate la date măsurabile pe măsură ce dimensiunile se schimbă." },
      { title: "Listă de materiale și export CSV", short: "Export CSV", body: "Vezi cantitatea și prețul estimativ pentru fiecare componentă, apoi exportă lista de materiale în format CSV pentru ofertare, achiziție sau producție." },
    ],
    outputs: ["Listă de materiale", "Ofertă CSV", "Tabel dimensional", "Geometria acoperișului"],
    seoH1: "Configurator acoperiș 3D online",
    seoTitle: "Configurator Acoperiș 3D Online | Proiectare & BOM",
    seoDescription: "Configurează un acoperiș online în 3D. Alege forma, dimensiunile, panta și materialele și obține cantități, BOM și ofertă CSV.",
  },
  window: {
    category: "Ferestre și tâmplărie", title: "Ferestre și sisteme de profile", shortTitle: "Ferestre",
    statement: "Configurează fereastra până la ultima componentă.",
    description: "Un configurator tehnic pentru profile de tâmplărie, vitraj, finisaje interioare și exterioare, mecanisme de deschidere și vedere explodată.",
    controls: ["Asamblat", "Bicolor", "Explodat"],
    features: [
      { title: "Componentele reale ale sistemului", short: "AW CT 65", body: "Configurează sistemul Schüco AW CT 65 B2-6 cu profilele, vitrajul, garniturile, baghetele și componentele de feronerie compatibile. Previzualizarea folosește construcția tehnică a sistemului." },
      { title: "Dimensiuni parametrice", short: "Dimensiuni", body: "Modifică lățimea și înălțimea în limitele sistemului, iar rama, cerceveaua, vitrajul și feroneria se reconstruiesc împreună. Dimensionarea comercială rămâne astfel conectată la produsul arhitectural real." },
      { title: "Compatibilitatea pachetului de sticlă", short: "Pachet sticlă", body: "Schimbă grosimea vitrajului și vezi imediat codurile compatibile pentru garnitură și baghetă. Secțiunile lor reale se actualizează lângă comenzi, făcând vizibilă o dependență tehnică altfel greu de explicat." },
      { title: "Mecanismul de deschidere", short: "Deschidere", body: "Alege deschiderea batantă sau oscilo-batantă și reglează unghiul cercevelei. Clientul vede direct cum funcționează fereastra configurată." },
      { title: "Finisaje independente", short: "Finisaje", body: "Alege un finisaj uniform sau tratamente diferite la interior și exterior—brut, anodizat ori vopsit în câmp electrostatic. Decizia bicoloră rămâne atașată aceleiași configurații și răspunde cerințelor fațadei și interiorului." },
      { title: "Inspecția ansamblului", short: "Inspecție", body: "Folosește vederea explodată, culorile tehnice sau secțiunea de profil pentru a inspecta extruziunile, etanșările, vitrajul și componentele termoizolante." },
    ],
    outputs: ["Ansamblu configurat", "Structură de componente", "Specificație de finisaje", "Rezumat tehnic"],
    seoH1: "Configurator ferestre 3D online",
    seoTitle: "Configurator Ferestre 3D Online | Profile & Vitraj",
    seoDescription: "Configurează ferestre online în 3D cu dimensiuni parametrice, profile, vitraj, finisaje bicolore, simularea deschiderii și vedere explodată.",
  },
  hall: {
    category: "Construcții industriale", title: "Hale industriale și depozite", shortTitle: "Hale industriale",
    statement: "Configurează clădirea. Verifică structura.",
    description: "Configurează dimensiunile halei, cadrele portal, structura secundară, închiderile, golurile și instalațiile într-un singur model 3D.",
    controls: ["Travei", "Anvelopă", "Explodat"],
    features: [
      { title: "Anvelopă parametrică", short: "Anvelopă", body: "Lungimea, deschiderea, înălțimea la streașină și panta reconstruiesc întregul volum industrial, menținând coerente cadrele portal, coama și gabaritul interior utilizabil." },
      { title: "Travei structurale calculate", short: "Cadre", body: "O distanță țintă între cadre este transformată automat într-un număr practic de travei egale, astfel încât ritmul structural să rămână sincronizat cu lungimea clădirii." },
      { title: "Variante structurale", short: "Structură", body: "Compară variantele de structură ușoară, standard și grea. Profilele principale și aspectul structurii se actualizează împreună." },
      { title: "Uși, ferestre și goluri", short: "Goluri", body: "Adaugă și dimensionează uși industriale, uși pietonale și ferestre în limitele fiecărui perete. Configuratorul semnalează suprapunerile înainte de calcul." },
      { title: "Vizibilitatea straturilor", short: "Straturi", body: "Afișează sau ascunde independent închiderile și structura secundară pentru a trece de la clădirea finisată la logica portantă din interiorul ei." },
      { title: "Ansamblu explodat", short: "Explodat", body: "Separă anvelopa, elementele secundare și cadrele principale într-o secvență constructivă lizibilă, apoi reasamblează clădirea printr-o singură acțiune." },
    ],
    outputs: ["Geometrie configurată", "Plan de cadre", "Cantități pentru închideri", "Specificația golurilor"],
    seoH1: "Configurator hală industrială 3D",
    seoTitle: "Configurator Hală Industrială 3D | Hale & Depozite",
    seoDescription: "Configurează o hală industrială sau un depozit în 3D. Modifică dimensiunile, cadrele portal, traveile, închiderile și golurile de acces.",
  },
  solar: {
    category: "Energie fotovoltaică", title: "Panouri fotovoltaice și analiză energetică", shortTitle: "Sisteme fotovoltaice",
    statement: "Configurează panourile. Estimează producția și consumul.",
    description: "Configurează un sistem fotovoltaic în funcție de adresă, forma acoperișului, poziția soarelui, consumul locuinței și capacitatea bateriei.",
    controls: ["Locație", "Poziția soarelui", "Analiză energetică"],
    features: [
      { title: "Analiză solară pe baza adresei", short: "Locație", body: "Caută adresa proiectului din România și folosește coordonatele confirmate pentru poziția soarelui, orele de răsărit și apus și estimarea regională a producției." },
      { title: "Poziția reală a soarelui", short: "Soare", body: "Reglează ora, data, anotimpul și orientarea acoperișului. Lumina din model și profilul estimat de producție se actualizează pentru aceleași condiții." },
      { title: "Acoperiș configurabil", short: "Acoperiș", body: "Alege un acoperiș în două ape, patru ape sau o apă, apoi modifică dimensiunile și panta. Suprafețele disponibile pentru panouri se recalculează automat." },
      { title: "Amplasare fizică a panourilor", short: "Panouri", body: "Alege numărul de module și versantul; previzualizarea distribuie panouri rezidențiale la dimensiuni reale și calculează puterea din numărul care încape efectiv." },
      { title: "Consum și stocare", short: "Stocare", body: "Compară profiluri de consum, activează stocarea LiFePO₄ și reglează capacitatea bateriei pentru a vedea efectul asupra autoconsumului și schimbului cu rețeaua." },
      { title: "Producție, consum și autonomie", short: "Analiză", body: "Compară producția zilnică estimată cu necesarul locuinței. Vezi autoconsumul, energia preluată din rețea, surplusul livrat și efectul bateriei." },
    ],
    outputs: ["Estimare sistem", "Putere instalată", "Profil energetic zilnic", "Scenariu de stocare"],
    seoH1: "Configurator sistem fotovoltaic 3D",
    seoTitle: "Configurator Panouri Fotovoltaice 3D | Sistem Fotovoltaic",
    seoDescription: "Configurează un sistem fotovoltaic rezidențial în 3D cu geometria acoperișului, panouri, poziția soarelui, consum, baterie și analiză energetică.",
  },
  fence: {
    category: "Garduri și împrejmuiri", title: "Garduri și sisteme de împrejmuire", shortTitle: "Garduri",
    statement: "Configurează perimetrul. Dimensionează fiecare panou.",
    description: "Configurează traseul gardului, modulele, panourile, finisajele, porțile și fundațiile într-un singur model 3D măsurabil.",
    controls: ["Traseu", "Panouri", "Acces"],
    features: [
      { title: "Traseu perimetral parametric", short: "Traseu", body: "Construiește garduri drepte, în L, în U sau perimetre închise din lungimi și unghiuri măsurabile. Fiecare schimbare reconstruiește traseul complet și păstrează relația corectă dintre capete, colțuri și geometria de montaj." },
      { title: "Module dimensionate automat", short: "Module", body: "Alege lățimea dorită, iar fiecare latură este împărțită în panouri egale. Stâlpii, golurile și lățimile panourilor se recalculează când perimetrul se schimbă." },
      { title: "Construcția panourilor", short: "Panouri", body: "Compară lamele verticale, lamele orizontale, panouri pline și plasă sudată în aceeași structură. Distanțele și geometria umpluturii rămân vizibile, astfel încât alegerea exprimă construcția și gradul de intimitate." },
      { title: "Specificația finisajului", short: "Finisaje", body: "Aplică finisaje vopsite și efect de lemn pe stâlpi, traverse, panouri și porți ca o singură selecție de sistem. Finisajul rămâne conectat la geometrie și la lista comercială de materiale." },
      { title: "Acces și fundații", short: "Acces", body: "Poziționează porți pietonale sau auto în travei valide, stabilește sensul de deschidere și coordonează golul cu stâlpii adiacenți. Fundațiile din beton și plăcile de bază fac parte din configurație." },
      { title: "Cantități și preț estimativ", short: "Materiale", body: "Calculează lungimea totală, suprafața panourilor, numărul de module și stâlpi, porțile și componentele de montaj. Lista de materiale și prețul pornesc din configurația prezentată clientului." },
    ],
    outputs: ["Listă de materiale", "Plan de travei", "Specificație porți", "Perimetru configurat"],
    seoH1: "Configurator garduri 3D online",
    seoTitle: "Configurator Garduri 3D | Panouri, Porți & Perimetru",
    seoDescription: "Configurează un gard online în 3D. Alege traseul, dimensiunile, modulele, panourile, finisajele, porțile și fundațiile și obține lista de materiale și prețul estimativ.",
  },
};

const de: Record<ConfiguratorSlug, Translation> = {
  pergola: {
    category: "Outdoor-Architektur", title: "Pergola & Outdoor-Architektur", shortTitle: "Pergola",
    statement: "Tageslicht planen. Atmosphäre konfigurieren.",
    description: "Ein browserbasierter 3D Pergola-Konfigurator für freistehende und wandmontierte Systeme mit parametrischen Maßen, Lamellensteuerung, Seitenabschlüssen, Umgebungsvorschau, Zubehör und live geschätzter Preisberechnung.",
    controls: ["Lamellen 0°", "Lamellen 48°", "Nacht + LED"],
    features: [
      { title: "Parametrische Struktur", short: "Struktur", body: "Definieren Sie Grundfläche, Gesamthöhe und Montageart; Pfosten, Träger, Spannweiten und verdeckte Entwässerung werden als koordiniertes System neu aufgebaut. Maßänderungen bleiben mit dem realen Aufbau verbunden, statt nur ein dekoratives Modell zu skalieren." },
      { title: "Lamellen- und Tageslichtsteuerung", short: "Lamellen", body: "Ändern Sie Ausrichtung und Winkel der Lamellen relativ zum Sonnenstand. Die Szene zeigt unmittelbar, wie sich Öffnung, Verschattung, direktes Licht und Regenschutz verändern—noch bevor die Struktur gefertigt oder montiert wird." },
      { title: "Vierseitiges Schließsystem", short: "Seiten", body: "Behandeln Sie jede Seite als eigenständige Zone: offen, mit Screen, motorisiertem ZIP-Screen, Sichtschutzlamellen oder rahmenloser Schiebeverglasung. Position und Öffnungsgrad erscheinen direkt am räumlichen Modell." },
      { title: "Klima und integriertes Licht", short: "Licht", body: "Wechseln Sie zwischen Tag und Nacht und konfigurieren Sie umlaufende LEDs, Farbtemperatur, integrierte Spots und Infrarotstrahler. Licht und Schatten reagieren gemeinsam mit dem Produkt und vermitteln Atmosphäre und Komfort realistisch." },
      { title: "Automatisierung und Sensorik", short: "Automation", body: "Wählen Sie manuelle, Funk- oder Wandschaltersteuerung und koordinieren Sie die Montagepositionen automatisierter Komponenten. Regen- und Windsensoren werden Teil desselben Zustands und verbinden sichtbare Optionen mit dem späteren Verhalten." },
      { title: "Kaufmännische Auflösung", short: "Live-Preis", body: "Abmessungen, Seitenabschlüsse, Automation, Beleuchtung und Zubehör speisen das Preismodell kontinuierlich. Jede gültige Entscheidung aktualisiert den Gesamtpreis und hält Produktdarstellung und Verkaufsgespräch ohne Tabellenbruch synchron." },
    ],
    outputs: ["Live-Angebot", "Konfigurierte Geometrie", "Zubehörliste", "Kundenübersicht"],
    seoH1: "3D Pergola-Konfigurator online",
    seoTitle: "3D Pergola-Konfigurator Online | Pergola planen",
    seoDescription: "Planen und konfigurieren Sie Ihre Pergola online in 3D. Passen Sie Maße, Lamellen, Seitenabschlüsse, Beleuchtung, Automatisierung und Zubehör an.",
  },
  roof: {
    category: "Parametrisches Bauen", title: "Architekturdach & Tragwerk", shortTitle: "Dachsysteme",
    statement: "Komplexe Geometrie. Baubare Antworten.",
    description: "Ein regelbasierter Architekturkonfigurator, der Dachform, Maße und Materialsysteme in messbare Geometrie und produktionsfähige Ergebnisse übersetzt.",
    controls: ["Satteldach", "Metall", "L-Form"],
    features: [
      { title: "Fünf Dachtypologien", short: "Dachformen", body: "Wechseln Sie zwischen Sattel-, Walm-, Pult-, L-förmigem und Gaubendach in einer regelbasierten Szene. Jede Typologie wird als aussagekräftige Geometrie erzeugt, sodass unterschiedliche Situationen ohne starre Modellbibliothek gelöst werden." },
      { title: "Übernahme individueller Pläne", short: "Planimport", body: "Führen Sie PDF-, Bild-, DWG- oder DXF-Referenzen zu, wenn ein Projekt außerhalb parametrischer Standardfamilien liegt. So entsteht eine klare Verbindung zwischen klassischer Architekturdokumentation und einem künftig konfigurierbaren, messbaren Dachzustand." },
      { title: "Fünfachsige Maßsteuerung", short: "Abmessungen", body: "Regeln Sie Länge, Tiefe, Wandhöhe, Dachneigung und Traufüberstand unabhängig voneinander, während sich die gesamte Hülle in Echtzeit neu aufbaut. Die Maßfindung bleibt visuell kohärent und technisch belastbar." },
      { title: "Materialgerechte Geometrie", short: "Material", body: "Wenden Sie metallische und mineralische Deckungssysteme mit eigenem Oberflächenverhalten und Mindestneigungen an. Die Materialwahl beeinflusst Erscheinung, kompatible Geometrie, Mengenlogik und kaufmännische Auswertung." },
      { title: "Messbare Bauausgabe", short: "Mengen", body: "Ermitteln Sie Dachfläche, First, Traufen, Kehlen, Anschlüsse, Rinnen und zugehörige Bauteilmengen direkt aus der generierten Geometrie. Auch komplexe Formen bleiben bei jeder Maßänderung mit belastbaren Mengen verbunden." },
      { title: "Stückliste und CSV-Übergabe", short: "BOM-Export", body: "Prüfen Sie das Dach als bepreiste Positionen auf Komponentenebene und exportieren Sie die Stückliste als CSV. Die Konfiguration gelangt ohne manuelle Neuerfassung von der visuellen Exploration in Kalkulation, Einkauf oder Produktion." },
    ],
    outputs: ["Stückliste", "CSV-Angebot", "Maßübersicht", "Dachgeometrie"],
    seoH1: "3D Dach-Konfigurator online",
    seoTitle: "3D Dach-Konfigurator Online | Dach planen & Stückliste",
    seoDescription: "Konfigurieren Sie Ihr Dach online in 3D. Wählen Sie Dachform, Maße, Neigung und Material und ermitteln Sie Mengen, Stückliste und CSV-Angebot.",
  },
  window: {
    category: "Hochpräzise Systeme", title: "Fenster & Architekturprofile", shortTitle: "Profilsysteme",
    statement: "Die Technik im Produkt sichtbar machen.",
    description: "Eine hochpräzise technische Konfigurationsumgebung für Architekturprofile, zweifarbige Oberflächen, Öffnungsmechanik und explodierte Baugruppenanalysen.",
    controls: ["Montiert", "Bicolor", "Explodiert"],
    features: [
      { title: "Exakter Systemaufbau", short: "AW CT 65", body: "Konfigurieren Sie das Schüco-System AW CT 65 B2-6 aus realen Extrusionsprofilen, Verglasung, Dichtungen, Glasleisten und Beschlagbeziehungen. Die Vorschau erhält die Konstruktionslogik des Systems, statt sie durch ein generisches Fensterobjekt zu ersetzen." },
      { title: "Parametrische Abmessungen", short: "Abmessungen", body: "Verändern Sie Breite und Höhe innerhalb definierter Systemgrenzen; Rahmen, Flügel, Verglasung und Beschläge bauen sich gemeinsam neu auf. So bleibt die kaufmännische Größenfindung mit dem realen Profilsystem verbunden." },
      { title: "Kompatibilität des Glasaufbaus", short: "Glasaufbau", body: "Ändern Sie die Glasstärke und sehen Sie sofort, welche Dichtungs- und Glasleistencodes kompatibel bleiben. Die realen Querschnittsbilder aktualisieren sich neben der Steuerung und machen eine sonst unsichtbare technische Abhängigkeit verständlich." },
      { title: "Öffnungsmechanik", short: "Öffnung", body: "Wechseln Sie zwischen Dreh- und Kippöffnung und steuern Sie anschließend den Öffnungswinkel. Das Bewegungsverhalten des Flügels wird Teil der Vertriebserfahrung, statt in Zeichnungen oder ein späteres Technikgespräch ausgelagert zu werden." },
      { title: "Unabhängige Oberflächen", short: "Oberflächen", body: "Definieren Sie eine einheitliche Oberfläche oder getrennte Innen- und Außenbehandlungen—roh, eloxiert oder pulverbeschichtet. Bicolor-Entscheidungen bleiben am selben Zustand und beantworten Fassaden- und Innenraumanforderungen gleichzeitig." },
      { title: "Baugruppendiagnose", short: "Diagnose", body: "Explodieren Sie das komplette Fenster, zeigen Sie Materialfamilien in technischen Farben oder isolieren Sie einen Profilquerschnitt. Extrusionen, Dichtungen, Verglasung und thermische Beziehungen werden sichtbar, ohne das konfigurierte Produkt zu verlassen." },
    ],
    outputs: ["Konfigurierte Baugruppe", "Komponentenstruktur", "Oberflächenspezifikation", "Technische Übersicht"],
    seoH1: "3D Fenster-Konfigurator online",
    seoTitle: "3D Fenster-Konfigurator Online | Profile & Verglasung",
    seoDescription: "Konfigurieren Sie Fenster online in 3D mit parametrischen Maßen, Profilsystemen, Verglasung, Bicolor-Oberflächen, Öffnung und Explosionsansicht.",
  },
  hall: {
    category: "Industriebau", title: "Industriehalle & Lagergebäude", shortTitle: "Hallensysteme",
    statement: "Hülle konfigurieren. Tragwerk auflösen.",
    description: "Ein parametrisches Industriebau-System, das Portalrahmen, Sekundärstahl, Gebäudehülle und Zugangsgeometrie in einem räumlichen Modell koordiniert.",
    controls: ["Rahmenabstand", "Hülle", "Explodiert"],
    features: [
      { title: "Parametrische Gebäudehülle", short: "Hülle", body: "Länge, Spannweite, Traufhöhe und Dachneigung bauen das Industrievolumen neu auf und halten Portalrahmen, Firstgeometrie und nutzbare Innenhöhe konsistent." },
      { title: "Berechnetes Rahmenraster", short: "Rahmen", body: "Ein Zielabstand wird automatisch in eine praktikable Zahl gleichmäßiger Felder übersetzt, sodass der Tragwerksrhythmus mit der Gebäudelänge synchron bleibt." },
      { title: "Tragwerksklassen", short: "Klasse", body: "Wechseln Sie zwischen leichter, standardmäßiger und schwerer Ausführung, um Hauptprofile, visuelles Gewicht und vorgesehene betriebliche Beanspruchung gemeinsam zu vermitteln." },
      { title: "Zugangsgeometrie", short: "Zugang", body: "Konfigurieren Sie Breite und Höhe des Industrietors innerhalb der Fassadengrenzen; die Öffnung bleibt an Spannweite und Traufhöhe gekoppelt." },
      { title: "Sichtbare Bauebenen", short: "Ebenen", body: "Blenden Sie Hülle und Sekundärtragwerk unabhängig ein oder aus und wechseln Sie so vom fertigen Gebäude zur konstruktiven Logik darunter." },
      { title: "Explodierte Baugruppe", short: "Explosion", body: "Trennen Sie Hülle, Sekundärstahl und primäre Portalrahmen zu einer verständlichen Montagesequenz und führen Sie alles mit einer Aktion wieder zusammen." },
    ],
    outputs: ["Konfigurierte Geometrie", "Rahmenplan", "Hüllenmengen", "Zugangsspezifikation"],
    seoH1: "3D Hallen-Konfigurator",
    seoTitle: "3D Hallen-Konfigurator | Industriehalle & Lagerhalle",
    seoDescription: "Konfigurieren Sie Industriehallen und Lagerhallen in 3D. Passen Sie Maße, Portalrahmen, Raster, Gebäudehülle und Zugangsöffnungen interaktiv an.",
  },
  solar: {
    category: "Energiesysteme", title: "Solardach & Energiesystem", shortTitle: "Solarsysteme",
    statement: "Das Dach modellieren. Den Energietag simulieren.",
    description: "Ein standortbezogener PV-Konfigurator, der Dachgeometrie, Modulbelegung, realen Sonnenstand, Haushaltslast und Batteriespeicher in einem visuellen Energiemodell verbindet.",
    controls: ["Standort", "Sonnenzeit", "Energiemodell"],
    features: [
      { title: "Solarer Kontext per Adresse", short: "Standort", body: "Lösen Sie eine rumänische Projektadresse in Koordinaten auf und nutzen Sie diesen Standort für Sonnenstand, Auf- und Untergang sowie regionale Ertragsannahmen." },
      { title: "Reale Sonne und Jahreszeiten", short: "Sonne", body: "Steuern Sie Uhrzeit, Datum, Jahreszeit und die Ausrichtung der Dachfront; sichtbares Licht und Ertragsprofil reagieren auf denselben Umgebungszustand." },
      { title: "Parametrisches Solardach", short: "Dach", body: "Wechseln Sie zwischen Sattel-, Walm- und Pultdach und verändern Sie Maße und Neigung, während Gebäude und nutzbare Modulflächen gemeinsam neu entstehen." },
      { title: "Physische PV-Belegung", short: "PV-Feld", body: "Wählen Sie Modulzahl und Dachseite; die Vorschau ordnet reale Wohnmodule an und bindet die installierte Leistung an die tatsächlich passende Anzahl." },
      { title: "Last- und Speichermodell", short: "Speicher", body: "Vergleichen Sie Verbrauchsprofile, aktivieren Sie LiFePO₄-Speicher und justieren Sie die Kapazität, um Eigenverbrauch und Netzaustausch über den Tag zu untersuchen." },
      { title: "Energieanalyse", short: "Analyse", body: "Öffnen Sie einen fokussierten Arbeitsbereich für Erzeugung und Verbrauch mit Tagesertrag, Haushaltsbedarf, Autarkie, Netzbezug und Einspeisung in einer Ansicht." },
    ],
    outputs: ["Systemschätzung", "Installierte kWp", "Tagesenergieprofil", "Speicherszenario"],
    seoH1: "3D Photovoltaik-Konfigurator",
    seoTitle: "3D Solar-Konfigurator | Photovoltaik-Anlage planen",
    seoDescription: "Konfigurieren Sie eine Photovoltaik-Anlage in 3D mit Dachgeometrie, Modulbelegung, Sonnenstand, Verbrauch, Batteriespeicher und Energieanalyse.",
  },
  fence: {
    category: "Perimetersysteme", title: "Zaun & Perimetersystem", shortTitle: "Zaunsysteme",
    statement: "Die Grenze definieren. Jedes Feld auflösen.",
    description: "Ein parametrischer Zaun-Konfigurator, der Verlauf, Feldteilung, Paneelbauweise, Oberflächen, Tore und Fundamente in einem messbaren 3D-System koordiniert.",
    controls: ["Verlauf", "Paneele", "Zugang"],
    features: [
      { title: "Parametrischer Perimeter", short: "Verlauf", body: "Bauen Sie gerade, L- und U-förmige oder geschlossene Zaunverläufe aus messbaren Längen und Winkeln. Jede Änderung erzeugt den gesamten Verlauf neu und hält Endpunkte, Ecken und Montagegeometrie konsistent." },
      { title: "Aufgelöstes Feldraster", short: "Felder", body: "Definieren Sie eine Zielfeldbreite; jeder Lauf wird in praktische, gleichmäßige Paneele geteilt. Pfosten, lichte Öffnungen und Paneelbreiten bleiben bei Änderungen koordiniert, ohne verzerrte Restfelder am Ende." },
      { title: "Paneelkonstruktion", short: "Paneele", body: "Vergleichen Sie vertikale und horizontale Lamellen, geschlossene Sichtschutzpaneele und Schweißgitter im selben Rahmen. Abstände und Füllgeometrie bleiben sichtbar und erklären Konstruktion und Privatsphäre statt nur Farbe." },
      { title: "Oberflächenspezifikation", short: "Oberfläche", body: "Wenden Sie Pulverbeschichtungen und Holzoptik auf Pfosten, Riegel, Paneele und Tore als gemeinsame Systemauswahl an. Die Oberfläche bleibt mit Geometrie und kaufmännischer Materialliste verbunden." },
      { title: "Zugang und Fundamente", short: "Zugang", body: "Positionieren Sie Personen- oder Einfahrtstore in gültigen Feldern, wählen Sie den Anschlag und koordinieren Sie die Öffnung mit benachbarten Pfosten. Betonfundamente und Fußplatten sind Teil des Produktzustands." },
      { title: "Messbarer kaufmännischer Output", short: "BOM", body: "Ermitteln Sie Gesamtlänge, Paneelfläche, Felder, Pfosten, Tore und Montagekomponenten aus dem aktiven Verlauf. Stückliste und Preis werden aus derselben Geometrie aktualisiert, die der Kunde sieht." },
    ],
    outputs: ["Stückliste", "Feldplan", "Torspezifikation", "Konfigurierter Perimeter"],
    seoH1: "3D Zaun-Konfigurator online",
    seoTitle: "3D Zaun-Konfigurator | Paneele, Tore & Verlauf",
    seoDescription: "Konfigurieren Sie einen Zaun online in 3D. Wählen Sie Verlauf, Maße, Feldbreite, Paneele, Oberflächen, Tore und Fundamente mit Stückliste und Preislogik.",
  },
};

export function getLocalizedConfigurators(locale: Locale): Configurator[] {
  const translations = locale === "ro" ? ro : locale === "de" ? de : null;
  return configurators.map((item) => ({
    ...item,
    ...(translations ? translations[item.slug] : {}),
    launchUrl: configuratorUrl(locale, item.slug),
  }));
}

export function getLocalizedConfigurator(locale: Locale, slug: string) {
  return getLocalizedConfigurators(locale).find((item) => item.slug === slug);
}


export function requireLocalizedConfigurator(locale: Locale, slug: string): Configurator {
  const item = getLocalizedConfigurator(locale, slug);
  if (!item) {
    throw new Error(`Unknown configurator slug "${slug}" for locale "${locale}".`);
  }
  return item;
}
