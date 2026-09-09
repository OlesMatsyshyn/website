import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "packages");
const packageVersion = 12;

const meta = {
  "english-starter": ["British English", "en-GB", "General", "British English · Starter", "British English vocabulary, short texts, and common forms.", {}],
  "english-medical-starter": [
    "English",
    "en-med",
    "Medical",
    "Medical English · Starter",
    "Practical medical and scientific English with plain definitions.",
    {},
    { preferredTranslateDirection: "translation-to-term" },
  ],
  "english-literature-starter": [
    "English",
    "en-lit",
    "Literary",
    "Literary English · Starter",
    "Formal and literary English often encountered in classic prose.",
    {},
    { preferredTranslateDirection: "translation-to-term" },
  ],
  "german-starter": ["German", "de", "General", "German · Starter", "Useful German vocabulary, short texts, and core grammar forms.", { "ä": ["a"], "ö": ["o"], "ü": ["u"], "ß": ["ss"] }],
  "french-starter": ["French", "fr", "General", "French · Starter", "Useful French vocabulary, short texts, and core grammar forms.", { "é": ["e"], "è": ["e"], "ê": ["e"], "ç": ["c"], "à": ["a"], "ù": ["u"], "î": ["i"], "ô": ["o"] }],
  "polish-starter": ["Polish", "pl", "General", "Polish · Starter", "Useful Polish vocabulary, short texts, and core grammar forms.", { "ą": ["a"], "ć": ["c"], "ę": ["e"], "ł": ["l"], "ń": ["n"], "ó": ["o"], "ś": ["s"], "ż": ["z"], "ź": ["z"] }],
  "ukrainian-starter": ["Ukrainian", "uk", "General", "Ukrainian · Starter", "Useful Ukrainian vocabulary, short Cyrillic texts, and core grammar forms.", {}],
  "norwegian-bokmal-starter": ["Norwegian (Bokmål)", "nb", "General", "Norwegian (Bokmål) · Starter", "Useful Norwegian Bokmål vocabulary, short texts, and core grammar forms.", { "æ": ["ae"], "ø": ["o"], "å": ["a"] }],
  "romanian-starter": ["Romanian", "ro", "General", "Romanian · Starter", "A substantial Romanian learning pack for everyday, grammar, and civic practice.", { "ă": ["a"], "â": ["a"], "î": ["i"], "ș": ["s"], "ş": ["s"], "ț": ["t"], "ţ": ["t"] }],
};

const paths = {
  "english-starter": "english/starter.json",
  "english-medical-starter": "english-medical/starter.json",
  "english-literature-starter": "english-literature/starter.json",
  "german-starter": "german/starter.json",
  "french-starter": "french/starter.json",
  "polish-starter": "polish/starter.json",
  "ukrainian-starter": "ukrainian/starter.json",
  "norwegian-bokmal-starter": "norwegian-bokmal/starter.json",
  "romanian-starter": "romanian/starter.json",
};

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function words(prefix, text) {
  return text.trim().split(/\n+/).map((line) => {
    const [term, translation] = line.split("|").map((part) => part.trim());
    return { id: `${prefix}_${slug(term)}`, term, translation };
  });
}

function form(prefix, type, prompt, before, answer, after, note) {
  return { id: `${prefix}_${slug(type)}_${slug(prompt)}_${slug(before + answer + after)}`, type, prompt, before, answer, after, result: `${before}${answer}${after}`, note };
}

function text(id, title, body, translation) {
  return { id, title, text: body, translation, translationLanguage: "English" };
}

function romanianReference() {
  return {
    title: "Romania",
    country: "Romania",
    citizenshipPledge: {
      title: "Jurământul de credință",
      text: "Jur să fiu devotat patriei și poporului român, să apăr drepturile și interesele naționale, să respect Constituția și legile României.",
      translation: "I swear to be devoted to the homeland and the Romanian people, to defend national rights and interests, and to respect the Constitution and the laws of Romania.",
    },
    anthem: {
      title: "Imnul național",
      name: "Deșteaptă-te, române!",
      nameTranslation: "Awaken thee, Romanian!",
      description: "The national anthem of Romania is “Deșteaptă-te, române!”",
      lyrics: `Deșteaptă-te, române, din somnul cel de moarte,
În care te-adânciră barbarii de tirani!
Acum ori niciodată croiește-ți altă soarte,
La care să se-nchine și cruzii tăi dușmani!

Acum ori niciodată să dăm dovezi la lume
Că-n aste mâni mai curge un sânge de român,
Și că-n a noastre piepturi păstrăm cu fală-un nume
Triumfător în lupte, un nume de Traian!

Înalță-ți lata frunte și caută-n giur de tine,
Cum stau ca brazi în munte voinici sute de mii;
Un glas ei mai așteaptă și sar ca lupi în stâne,
Bătrâni, bărbați, juni, tineri, din munți și din câmpii!

Priviți, mărețe umbre, Mihai, Ștefan, Corvine,
Româna națiune, ai voștri strănepoți,
Cu brațele armate, cu focul vostru-n vine,
"Viață-n libertate ori moarte!" strigă toți.

Pre voi vă nimiciră a pizmei răutate
Și oarba neunire la Milcov și Carpați!
Dar noi, pătrunși la suflet de sfânta libertate,
Jurăm că vom da mâna, să fim pururea frați!

O mamă văduvită de la Mihai cel Mare
Pretinde de la fii-și azi mână d-ajutori,
Și blastămă cu lacrămi în ochi pe orișicare,
În astfel de pericul s-ar face vânzători!

De fulgere să piară, de trăsnet și pucioasă,
Oricare s-ar retrage din gloriosul loc,
Când patria sau mama, cu inima duioasă,
Va cere ca să trecem prin sabie și foc!

N-ajunse iataganul barbarei semilune,
A cărui plăgi fatale și azi le mai simțim;
Acum se vâră cnuta în vetrele străbune,
Dar martor ne e Domnul că vii nu o primim!

N-ajunse despotismul cu-ntreaga lui orbie,
Al cărui jug din seculi ca vitele-l purtăm;
Acum se-ncearcă cruzii, în oarba lor trufie,
Să ne răpească limba, dar morți numai o dăm!

Români din patru unghiuri, acum ori niciodată
Uniți-vă în cuget, uniți-vă-n simțiri!
Strigați în lumea largă că Dunărea-i furată
Prin intrigă și silă, viclene uneltiri!

Preoți, cu crucea-n frunte! căci oastea e creștină,
Deviza-i libertate și scopul ei preasfânt.
Murim mai bine-n luptă, cu glorie deplină,
Decât să fim sclavi iarăși în vechiul nost'pământ!`,
      translation: `Wake up, Romanian, from the sleep of death
Into which barbaric tyrants sank you!
Now or never, make yourself another fate,
Before which even your cruel enemies will bow!

Now or never, let us show the world
That Roman blood still flows in these hands,
And that in our chests we proudly keep a name
Triumphant in battle, the name of Trajan!

Raise your broad forehead and look around you,
How hundreds of thousands stand like fir trees in the mountains;
They await only one voice and leap like wolves into the folds:
Old men, men, young men, youths, from mountains and plains!

Look, great shadows, Michael, Stephen, Corvinus,
The Romanian nation, your great-grandchildren,
With armed hands, with your fire in their veins,
All cry: "Life in freedom or death!"

You were destroyed by the malice of envy
And blind disunity at Milcov and the Carpathians!
But we, pierced in our souls by holy liberty,
Swear that we will join hands and be brothers forever!

A widowed mother from the time of Michael the Great
Now asks her sons for a helping hand,
And with tears in her eyes curses anyone
Who, in such danger, would become a traitor!

May lightning, thunder, and brimstone destroy
Anyone who withdraws from the glorious place,
When the homeland or mother, with tender heart,
Asks us to pass through sword and fire!

The yataghan of the barbarous crescent was not enough,
Whose fatal wounds we still feel today;
Now the knout enters the ancestral hearths,
But God is our witness that we will not receive it alive!

Despotism with all its blindness was not enough,
Whose yoke we have borne like cattle for centuries;
Now the cruel ones, in their blind arrogance, try
To take our language, but only dead will we surrender it!

Romanians from the four corners, now or never,
Unite in thought, unite in feeling!
Proclaim to the wide world that the Danube is stolen
Through intrigue and force, treacherous plots!

Priests, with the cross in front! for the army is Christian,
Its motto is liberty and its purpose most holy.
Better to die in battle, in full glory,
Than to be slaves again in our old land!`,
    },
    facts: [
      {
        id: "national-day",
        label: "Ziua Națională",
        value: "Ziua Națională a României: 1 Decembrie",
        translation: "Romania's National Day is 1 December.",
      },
      {
        id: "capital",
        label: "Capitala",
        value: "Capitala României: București",
        translation: "The capital of Romania is Bucharest.",
      },
      {
        id: "official-language",
        label: "Limba oficială",
        value: "Limba oficială: limba română",
      },
      {
        id: "european-union",
        label: "Uniunea Europeană",
        value: "România este stat membru al Uniunii Europene.",
        translation: "Romania is a member state of the European Union.",
      },
    ],
    flag: {
      title: "Drapelul României",
      asset: "packages/romanian/assets/flag.svg",
      colorsLocal: "Albastru · Galben · Roșu",
      translationLabel: "Blue · Yellow · Red",
      label: "Steagul României: albastru, galben și roșu",
      descriptionLocal: "Drapelul României este albastru, galben și roșu.",
      translation: "The Romanian flag is blue, yellow and red.",
    },
  };
}

function germanReference() {
  return {
    title: "Germany",
    country: "Germany",
    flag: {
      title: "Flagge Deutschlands",
      asset: "packages/german/assets/flag.svg",
      colorsLocal: "Schwarz · Rot · Gold",
      translationLabel: "Black · Red · Gold",
      label: "Flagge Deutschlands: schwarz, rot und gold",
      descriptionLocal: "Die Flagge Deutschlands ist schwarz, rot und gold.",
      translation: "The German flag is black, red and gold.",
    },
    anthem: {
      title: "Nationalhymne",
      name: "Das Lied der Deutschen",
      description: "Germany's national anthem is the third stanza of “Das Lied der Deutschen”.",
    },
    citizenshipPledge: {
      title: "Bekenntnis zur freiheitlichen demokratischen Grundordnung",
      text: "Einbürgerungsbewerber müssen sich zur freiheitlichen demokratischen Grundordnung des Grundgesetzes bekennen.",
      translation: "Applicants for naturalisation must commit to the free democratic basic order of the Basic Law.",
    },
    facts: [
      {
        id: "capital",
        label: "Hauptstadt",
        value: "Die Hauptstadt Deutschlands ist Berlin.",
        translation: "The capital of Germany is Berlin.",
      },
      {
        id: "national-day",
        label: "Nationalfeiertag",
        value: "Der Tag der Deutschen Einheit ist der 3. Oktober.",
        translation: "German Unity Day is 3 October.",
      },
      {
        id: "official-language",
        label: "Amtssprache",
        value: "Die Amtssprache ist Deutsch.",
        translation: "The official language is German.",
      },
      {
        id: "european-union",
        label: "Europäische Union",
        value: "Deutschland ist Mitgliedstaat der Europäischen Union.",
        translation: "Germany is a member state of the European Union.",
      },
    ],
  };
}

function frenchReference() {
  return {
    title: "France",
    country: "France",
    flag: {
      title: "Drapeau de la France",
      asset: "packages/french/assets/flag.svg",
      colorsLocal: "Bleu · Blanc · Rouge",
      translationLabel: "Blue · White · Red",
      label: "Drapeau de la France: bleu, blanc et rouge",
      descriptionLocal: "Le drapeau français est bleu, blanc et rouge.",
      translation: "The French flag is blue, white and red.",
    },
    anthem: {
      title: "Hymne national",
      name: "La Marseillaise",
      description: "The national anthem of France is “La Marseillaise”.",
    },
    facts: [
      {
        id: "capital",
        label: "Capitale",
        value: "La capitale de la France est Paris.",
        translation: "The capital of France is Paris.",
      },
      {
        id: "national-day",
        label: "Fête nationale",
        value: "La fête nationale française est le 14 juillet.",
        translation: "France's national day is 14 July.",
      },
      {
        id: "official-language",
        label: "Langue officielle",
        value: "La langue de la République est le français.",
        translation: "The language of the Republic is French.",
      },
      {
        id: "european-union",
        label: "Union européenne",
        value: "La France est un État membre de l'Union européenne.",
        translation: "France is a member state of the European Union.",
      },
    ],
  };
}

function polishReference() {
  return {
    title: "Poland",
    country: "Poland",
    flag: {
      title: "Flaga Polski",
      asset: "packages/polish/assets/flag.svg",
      colorsLocal: "Biały · Czerwony",
      translationLabel: "White · Red",
      label: "Flaga Polski: biały i czerwony",
      descriptionLocal: "Flaga Polski jest biało-czerwona.",
      translation: "The Polish flag is white and red.",
    },
    anthem: {
      title: "Hymn państwowy",
      name: "Mazurek Dąbrowskiego",
      description: "The national anthem of Poland is “Mazurek Dąbrowskiego”.",
    },
    facts: [
      {
        id: "capital",
        label: "Stolica",
        value: "Stolicą Polski jest Warszawa.",
        translation: "The capital of Poland is Warsaw.",
      },
      {
        id: "national-day",
        label: "Święto narodowe",
        value: "Narodowe Święto Niepodległości przypada 11 listopada.",
        translation: "Poland's National Independence Day is 11 November.",
      },
      {
        id: "constitution-day",
        label: "Święto Konstytucji",
        value: "Święto Narodowe Trzeciego Maja przypada 3 maja.",
        translation: "Constitution Day is observed on 3 May.",
      },
      {
        id: "official-language",
        label: "Język urzędowy",
        value: "Językiem urzędowym jest język polski.",
        translation: "The official language is Polish.",
      },
      {
        id: "european-union",
        label: "Unia Europejska",
        value: "Polska jest państwem członkowskim Unii Europejskiej.",
        translation: "Poland is a member state of the European Union.",
      },
    ],
  };
}

function ukrainianReference() {
  return {
    title: "Ukraine",
    country: "Ukraine",
    flag: {
      title: "Прапор України",
      asset: "packages/ukrainian/assets/flag.svg",
      colorsLocal: "Синій · Жовтий",
      translationLabel: "Blue · Yellow",
      label: "Прапор України: синій і жовтий",
      descriptionLocal: "Державний Прапор України має синю і жовту смуги.",
      translation: "The State Flag of Ukraine has blue and yellow bands.",
    },
    anthem: {
      title: "Державний Гімн України",
      name: "Ще не вмерла України і слава, і воля",
      nameTranslation: "Ukraine's glory and freedom have not yet perished",
      description: "The State Anthem of Ukraine uses the first verse and refrain of Pavlo Chubynskyi's text with music by Mykhailo Verbytskyi.",
      lyrics: `Ще не вмерла України і слава, і воля,
Ще нам, браття молодії, усміхнеться доля.
Згинуть наші воріженьки, як роса на сонці,
Запануєм і ми, браття, у своїй сторонці.

Душу й тіло ми положим за нашу свободу,
І покажем, що ми, браття, козацького роду.`,
      translation: `Ukraine's glory and freedom have not yet perished,
Still upon us, young brothers, fate will smile.
Our enemies will vanish like dew in the sun,
And we too, brothers, shall rule in our own land.

We will lay down soul and body for our freedom,
And show that we, brothers, are of Cossack kin.`,
    },
    facts: [
      {
        id: "capital",
        label: "Столиця",
        value: "Столиця України — Київ.",
        translation: "The capital of Ukraine is Kyiv.",
      },
      {
        id: "independence-day",
        label: "День Незалежності",
        value: "День Незалежності України — 24 серпня.",
        translation: "Ukraine's Independence Day is 24 August.",
      },
      {
        id: "official-language",
        label: "Державна мова",
        value: "Державна мова України — українська мова.",
        translation: "The state language of Ukraine is Ukrainian.",
      },
      {
        id: "european-union",
        label: "Європейський Союз",
        value: "Україна є країною-кандидатом на вступ до Європейського Союзу; переговори про вступ тривають.",
        translation: "Ukraine is an EU candidate country; accession negotiations are ongoing.",
      },
    ],
  };
}

function norwayReference() {
  return {
    title: "Norway",
    country: "Norway",
    flag: {
      title: "Norges flagg",
      asset: "packages/norwegian-bokmal/assets/flag.svg",
      colorsLocal: "Rødt · Hvitt · Blått",
      translationLabel: "Red · White · Blue",
      label: "Norges flagg",
      descriptionLocal: "Norges flagg er rødt med et blått kors med hvit kant.",
      translation: "Norway's flag is red with a blue cross bordered in white.",
    },
    anthem: {
      title: "Nasjonalsang",
      name: "Ja, vi elsker dette landet",
      nameTranslation: "Yes, we love this country",
      description: "Norway's national anthem is “Ja, vi elsker dette landet”.",
    },
    facts: [
      {
        id: "country",
        label: "Land",
        value: "Norge",
        translation: "Norway",
      },
      {
        id: "capital",
        label: "Hovedstad",
        value: "Hovedstaden i Norge er Oslo.",
        translation: "The capital of Norway is Oslo.",
      },
      {
        id: "constitution-day",
        label: "Grunnlovsdag",
        value: "Norges grunnlovsdag er 17. mai.",
        translation: "Norway's Constitution Day is 17 May.",
      },
      {
        id: "language",
        label: "Språk",
        value: "Norsk har to offisielle skriftspråk: bokmål og nynorsk.",
        translation: "Norwegian has two official written standards: Bokmål and Nynorsk.",
      },
      {
        id: "currency",
        label: "Valuta",
        value: "Valutaen er norsk krone.",
        translation: "The currency is the Norwegian krone.",
      },
      {
        id: "government",
        label: "Styreform",
        value: "Norge er et konstitusjonelt monarki og et parlamentarisk demokrati.",
        translation: "Norway is a constitutional monarchy and parliamentary democracy.",
      },
    ],
  };
}

function unitedKingdomReference() {
  return {
    title: "United Kingdom",
    country: "United Kingdom",
    flag: {
      title: "Flag of the United Kingdom",
      asset: {
        src: "packages/english/assets/flag-v2.svg",
        alt: "Union Flag of the United Kingdom",
      },
      aspectRatio: "5 / 3",
      colorsLocal: "Red · White · Blue",
      label: "Union Flag of the United Kingdom",
      descriptionLocal: "The Union Flag is the national flag of the United Kingdom.",
    },
    anthem: {
      title: "National anthem",
      name: "God Save the King",
      description: "The British National Anthem is “God Save the King”. On official occasions, only the first verse is usually sung.",
    },
    facts: [
      {
        id: "country",
        label: "Country",
        value: "United Kingdom",
      },
      {
        id: "capital",
        label: "Capital",
        value: "The capital of the United Kingdom is London.",
      },
      {
        id: "constituent-countries",
        label: "Constituent countries",
        value: "England, Scotland, Wales and Northern Ireland.",
      },
      {
        id: "language",
        label: "Language",
        value: "English is the predominant language of the United Kingdom.",
      },
      {
        id: "recognized-languages",
        label: "Recognized languages",
        value: "Welsh, Scottish Gaelic, Irish, Scots, Ulster Scots and Cornish are among the recognized regional or minority languages.",
      },
      {
        id: "currency",
        label: "Currency",
        value: "The currency is pound sterling.",
      },
      {
        id: "national-day",
        label: "National day",
        value: "The United Kingdom has no single official national day; its constituent nations have their own patron-saint days.",
      },
      {
        id: "government",
        label: "Government",
        value: "The United Kingdom is a constitutional monarchy and parliamentary democracy.",
      },
    ],
  };
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function savePackage(id, additions) {
  const [language, languageCode, variant, title, description, characterSubstitutions, extraMetadata = {}] = meta[id];
  const pkg = {
    metadata: {
      id,
      language,
      languageCode,
      variant,
      level: 0,
      title,
      description,
      version: packageVersion,
      wordCount: 0,
      textCount: 0,
      formCount: 0,
      ...(Object.keys(characterSubstitutions).length ? { characterSubstitutions } : {}),
      ...extraMetadata,
    },
    words: uniqueById(additions.words),
    texts: uniqueById(additions.texts),
    forms: uniqueById(additions.forms),
    ...(additions.reference ? { reference: additions.reference } : {}),
  };
  pkg.metadata.wordCount = pkg.words.length;
  pkg.metadata.textCount = pkg.texts.length;
  pkg.metadata.formCount = pkg.forms.length;
  mkdirSync(path.dirname(path.join(root, paths[id])), { recursive: true });
  writeFileSync(path.join(root, paths[id]), `${JSON.stringify(pkg, null, 2)}\n`);
  return pkg;
}

function englishForms(prefix, entries) {
  return entries.map(([type, prompt, before, answer, after, note]) => form(prefix, type, prompt, before, answer, after, note));
}

function termPairs(text) {
  return text
    .trim()
    .split(/\n+/)
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([term, definition]) => term && definition);
}

function generatedWords(prefix, pairs, target, label) {
  const seenTerms = new Set();
  const seenIds = new Set();
  const result = [];
  for (const [term, translation] of pairs) {
    const normalized = term.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    const id = `${prefix}_${slug(term)}`;
    if (!normalized || !translation || seenTerms.has(normalized) || seenIds.has(id)) continue;
    seenTerms.add(normalized);
    seenIds.add(id);
    result.push({ id, term, translation });
    if (result.length === target) return result;
  }
  throw new Error(`${label} generated ${result.length} words, expected ${target}.`);
}

function addTerm(pairs, term, definition) {
  pairs.push([term, definition]);
}

function addLines(pairs, text) {
  pairs.push(...termPairs(text));
}

function medicalEnglishWords() {
  const pairs = [];
  addLines(pairs, `
abdominal palpation|clinical examination of the abdomen to assess uterine size, tenderness, presentation or masses
active management of the third stage|use of uterotonic medication and controlled cord traction to reduce postpartum bleeding
adnexal mass|mass arising near the uterus, usually from the ovary, tube or surrounding tissues
advanced maternal age|pregnancy at an older maternal age, usually associated with increased obstetric risk
adverse incident|event during care that caused or could have caused harm
amniocentesis|procedure in which amniotic fluid is sampled for fetal testing
amniotic fluid embolism|rare obstetric emergency caused by maternal collapse linked to amniotic fluid entering the circulation
antenatal corticosteroids|steroids given before preterm birth to improve fetal lung maturity
antenatal screening|tests offered in pregnancy to identify maternal or fetal risk
apgar score|newborn assessment score based on appearance, pulse, grimace, activity and respiration
assisted vaginal birth|vaginal birth helped by forceps or vacuum
audit cycle|quality-improvement process of measuring practice, changing care and remeasuring results
bimanual examination|pelvic examination using one hand internally and one hand externally
birth plan|documented preferences for labour and birth
booking visit|first comprehensive antenatal assessment
caesarean section|surgical birth through abdominal and uterine incisions
cervical cerclage|suture placed around the cervix to reduce risk of preterm birth in selected cases
cervical screening|testing programme to detect cervical precancerous change
chorionic villus sampling|placental tissue sampling for fetal genetic testing
clinical governance|systems for maintaining and improving quality and safety of healthcare
clinical negligence|failure to provide reasonable care causing avoidable harm
clinical risk management|identifying, reducing and responding to risks in patient care
colposcopy|magnified examination of the cervix, vagina or vulva after abnormal screening
confidentiality|professional duty to protect private patient information
consent discussion|conversation ensuring a patient understands benefits, risks and alternatives before agreeing
controlled cord traction|gentle traction on the umbilical cord during placental delivery with uterine support
critical incident|serious event requiring urgent review and learning
debriefing|structured explanation after a difficult event or outcome
diagnostic laparoscopy|keyhole operation used to inspect pelvic or abdominal organs
disclosure of risk|clear explanation of material risks relevant to patient choice
domestic abuse enquiry|sensitive questioning about intimate partner or household abuse
early pregnancy unit|service assessing pain, bleeding and complications in early pregnancy
emergency contraception|contraception used after unprotected intercourse or contraceptive failure
endometrial biopsy|sampling of the uterine lining for diagnosis
enhanced recovery|perioperative care pathway designed to speed safe recovery
episiotomy|surgical cut in the perineum during vaginal birth when clinically indicated
external cephalic version|manual attempt to turn a breech fetus to cephalic presentation
fetal anomaly scan|ultrasound examination assessing fetal anatomy
fetal blood sampling|sampling fetal blood, historically used to assess fetal condition in labour
fetal growth restriction|failure of a fetus to reach expected growth potential
fetal medicine|specialist care for fetal disorders and high-risk pregnancies
forceps delivery|assisted vaginal birth using obstetric forceps
fragility fracture|fracture after low-energy trauma, relevant to osteoporosis assessment
gynaecological oncology|specialist field dealing with cancers of the female reproductive tract
hysteroscopy|endoscopic inspection of the uterine cavity
incident reporting|formal recording of patient-safety events
induction of labour|planned starting of labour using medication or mechanical methods
informed consent|voluntary agreement after understanding relevant information and choices
intrauterine contraception|contraceptive device or system placed inside the uterus
laparoscopic surgery|keyhole surgery performed through small abdominal incisions
maternal collapse|sudden severe deterioration or unconsciousness in a pregnant or recently postpartum patient
maternal medicine|specialist care for medical disorders in pregnancy
medical optimisation|improving health status before pregnancy, surgery or treatment
menopause counselling|discussion of menopausal symptoms, treatment options and risk-benefit balance
multidisciplinary team|professionals from different specialties working together
neonatal resuscitation|immediate support for a newborn with inadequate breathing or circulation
operative vaginal birth|birth assisted with forceps or vacuum
patient-centred care|care that respects patient values, needs and informed choices
pelvic floor dysfunction|problems with pelvic support, continence or pelvic muscle function
perineal repair|suturing and management of birth-related perineal trauma
postpartum haemorrhage|excessive bleeding after childbirth
preconception counselling|advice before pregnancy to reduce risk and plan care
quality improvement|systematic work to make healthcare safer, more effective or more reliable
risk assessment|structured judgement of likelihood and severity of harm
safeguarding referral|referral made to protect a vulnerable adult, child or unborn baby
shared decision-making|clinical decision process combining evidence and patient preferences
shoulder dystocia|obstetric emergency when the fetal shoulders do not deliver easily after the head
stillbirth review|structured review after fetal death to identify cause and learning
trial of labour|planned attempt at vaginal birth in a defined clinical context
uterine artery embolisation|procedure blocking uterine blood supply, often for fibroid treatment or bleeding control
uterine evacuation|removal of pregnancy tissue from the uterus
vacuum delivery|assisted vaginal birth using a suction cup
venous thromboembolism|blood clot in the venous system, including deep vein thrombosis and pulmonary embolism
waterbirth|birth in water after appropriate risk assessment
`);

  const conditions = termPairs(`
placental abruption|premature separation of the placenta from the uterine wall
placenta praevia|placenta implanted low in the uterus near or over the cervical os
vasa praevia|fetal vessels crossing near the cervix and at risk of rupture
uterine rupture|full-thickness tear of the uterine wall, usually an obstetric emergency
uterine atony|failure of the uterus to contract adequately after delivery
retained placenta|placenta not delivered within the expected time after birth
retained products of conception|pregnancy tissue remaining inside the uterus
postpartum sepsis|infection causing maternal illness after childbirth
puerperal pyrexia|fever occurring after birth
preeclampsia|pregnancy disorder with hypertension and maternal organ or placental involvement
eclampsia|seizure associated with preeclampsia
HELLP syndrome|haemolysis, elevated liver enzymes and low platelets in pregnancy
gestational hypertension|new hypertension arising in pregnancy without preeclampsia features
chronic hypertension in pregnancy|pre-existing or early-pregnancy hypertension continuing in pregnancy
gestational diabetes|glucose intolerance first recognised during pregnancy
pre-existing diabetes in pregnancy|type 1 or type 2 diabetes present before pregnancy
obstetric cholestasis|pregnancy liver disorder causing itching and raised bile acids
hyperemesis gravidarum|severe nausea and vomiting in pregnancy causing dehydration or weight loss
preterm prelabour rupture of membranes|rupture of membranes before labour and before 37 weeks
preterm labour|labour occurring before 37 completed weeks of pregnancy
cervical insufficiency|painless cervical shortening or dilation causing pregnancy loss or preterm birth
multiple pregnancy|pregnancy with more than one fetus
twin-to-twin transfusion syndrome|unbalanced placental blood flow affecting monochorionic twins
selective fetal growth restriction|growth restriction affecting one fetus in a multiple pregnancy
breech presentation|fetus presenting bottom or feet first
transverse lie|fetus lying sideways in the uterus
unstable lie|repeated change of fetal lie late in pregnancy
cord prolapse|umbilical cord descending below the presenting part after membrane rupture
fetal distress|non-specific term for suspected fetal compromise
non-reassuring fetal status|signs suggesting possible fetal compromise
meconium-stained liquor|amniotic fluid containing fetal stool
oligohydramnios|reduced amniotic fluid volume
polyhydramnios|excess amniotic fluid volume
small for gestational age|fetus or baby below the expected size centile
large for gestational age|fetus or baby above the expected size centile
macrosomia|excessive fetal or newborn size
intrauterine fetal death|death of a fetus before birth
miscarriage|spontaneous pregnancy loss before viability
threatened miscarriage|vaginal bleeding in early pregnancy with a closed cervix
missed miscarriage|non-viable pregnancy retained in the uterus
ectopic pregnancy|pregnancy implanted outside the uterine cavity
pregnancy of unknown location|positive pregnancy test without pregnancy seen inside or outside the uterus
molar pregnancy|abnormal gestational trophoblastic disease with abnormal placental tissue
antepartum haemorrhage|bleeding from the genital tract after viability and before birth
primary postpartum haemorrhage|excessive bleeding within 24 hours of birth
secondary postpartum haemorrhage|abnormal bleeding from 24 hours to 12 weeks after birth
third-degree tear|perineal tear involving the anal sphincter complex
fourth-degree tear|perineal tear involving the anal sphincter and rectal mucosa
obstetric anal sphincter injury|third- or fourth-degree perineal tear
postpartum urinary retention|inability to void adequately after birth
postnatal depression|depressive illness after childbirth
postpartum psychosis|severe psychiatric illness soon after birth
mastitis|inflammation or infection of breast tissue
breast abscess|collection of pus in breast tissue
endometritis|infection or inflammation of the uterine lining
pelvic inflammatory disease|infection of the upper female genital tract
endometriosis|endometrial-like tissue outside the uterus causing pain or infertility
adenomyosis|endometrial tissue within the uterine muscle
uterine fibroid|benign smooth-muscle tumour of the uterus
endometrial polyp|localised overgrowth of the uterine lining
ovarian cyst|fluid-filled or complex sac arising from the ovary
ovarian torsion|twisting of the ovary compromising blood supply
premature ovarian insufficiency|loss of ovarian function before age 40
polycystic ovary syndrome|endocrine disorder with ovulatory dysfunction and androgen excess
heavy menstrual bleeding|excessive menstrual blood loss affecting quality of life
intermenstrual bleeding|bleeding between periods
postcoital bleeding|bleeding after sexual intercourse
postmenopausal bleeding|vaginal bleeding after menopause
amenorrhoea|absence of menstrual periods
dysmenorrhoea|painful menstruation
dyspareunia|pain with sexual intercourse
chronic pelvic pain|pelvic pain lasting for at least six months
vulvodynia|persistent vulval pain without an obvious cause
vaginal atrophy|thinning and dryness of vaginal tissue due to low oestrogen
genitourinary syndrome of menopause|urinary and genital symptoms related to menopausal oestrogen deficiency
pelvic organ prolapse|descent of pelvic organs into or beyond the vagina
stress urinary incontinence|urine leakage with cough, effort or exertion
overactive bladder|urgency with frequency and nocturia, with or without urge incontinence
urge urinary incontinence|urine leakage associated with urgency
recurrent urinary tract infection|repeated bacterial infections of the urinary tract
vulval lichen sclerosus|chronic inflammatory vulval skin condition causing itch and scarring
vulval intraepithelial neoplasia|precancerous change in vulval skin
cervical intraepithelial neoplasia|precancerous change in cervical cells
endometrial hyperplasia|abnormal thickening of the uterine lining
endometrial cancer|malignancy of the uterine lining
cervical cancer|malignancy arising from the cervix
ovarian cancer|malignancy arising from ovarian or related tubal/peritoneal tissue
vulval cancer|malignancy arising from vulval tissue
gestational trophoblastic neoplasia|malignant or persistent trophoblastic disease after pregnancy
infertility|inability to conceive after regular unprotected intercourse
subfertility|reduced fertility or delayed conception
anovulation|absence of ovulation
male factor infertility|infertility related to sperm production or function
tubal factor infertility|infertility caused by blocked or damaged fallopian tubes
unexplained infertility|infertility without an identified cause after assessment
recurrent miscarriage|repeated pregnancy loss
menopausal vasomotor symptoms|hot flushes and night sweats related to menopause
`);
  for (const [term, definition] of conditions) {
    addTerm(pairs, term, definition);
    addTerm(pairs, `${term} risk factors`, `factors that increase the likelihood of ${term}`);
    addTerm(pairs, `${term} diagnosis`, `clinical recognition of ${term} using appropriate history, examination and tests`);
    addTerm(pairs, `${term} management`, `care planning and treatment for ${term}`);
  }

  const investigations = termPairs(`
cardiotocography|continuous recording of fetal heart rate and uterine contractions
non-stress test|fetal heart rate assessment without inducing contractions
biophysical profile|ultrasound-based assessment of fetal wellbeing
umbilical artery Doppler|ultrasound blood-flow assessment of placental resistance
middle cerebral artery Doppler|ultrasound blood-flow assessment used in fetal anaemia or redistribution
ductus venosus Doppler|fetal venous Doppler used in selected high-risk monitoring
crown-rump length|early ultrasound measurement used for pregnancy dating
nuchal translucency|first-trimester ultrasound measurement used in aneuploidy screening
anomaly scan|mid-trimester ultrasound assessment of fetal anatomy
growth scan|ultrasound assessment of fetal size and growth
liquor volume assessment|ultrasound estimation of amniotic fluid amount
cervical length scan|ultrasound measurement of cervical length
transvaginal ultrasound|ultrasound performed with a vaginal probe
saline infusion sonography|ultrasound with saline in the uterine cavity to show intracavity lesions
hysterosalpingography|radiographic test assessing uterine cavity and tubal patency
pelvic MRI|magnetic resonance imaging of pelvic structures
CT abdomen and pelvis|cross-sectional imaging of abdominal and pelvic structures
serum beta-hCG|blood measurement of pregnancy hormone
progesterone level|blood test sometimes used in early pregnancy assessment
full blood count|blood test measuring haemoglobin, white cells and platelets
group and save|blood-bank sample for blood group and antibody screen
crossmatch|blood-bank preparation of compatible blood for transfusion
coagulation screen|blood tests assessing clotting function
liver function tests|blood tests assessing liver injury or bile-flow problems
renal function tests|blood tests assessing kidney function
thyroid function tests|blood tests assessing thyroid hormone status
oral glucose tolerance test|blood glucose test used to diagnose gestational diabetes
HbA1c|blood test reflecting average glucose control over recent months
urine protein-creatinine ratio|urine test estimating proteinuria
midstream urine culture|urine culture to diagnose urinary infection
high vaginal swab|sample from the vagina to test for infection
endocervical swab|sample from the cervix to test for infection
HPV test|test for high-risk human papillomavirus
liquid-based cytology|cervical cell sampling method used in screening
CA125|tumour marker often used in ovarian cancer assessment
ROMA score|risk score using tumour markers for adnexal mass assessment
endometrial thickness|ultrasound measurement of the uterine lining
pipelle biopsy|outpatient endometrial sampling with a suction device
colposcopic biopsy|small tissue sample taken during colposcopy
punch biopsy|small circular tissue sample from skin or mucosa
sentinel lymph node biopsy|sampling first draining lymph node to assess spread
semen analysis|laboratory assessment of sperm count, motility and morphology
anti-Müllerian hormone|blood marker used as an estimate of ovarian reserve
day-21 progesterone|mid-luteal progesterone test used to confirm ovulation
follicle-stimulating hormone|pituitary hormone measured in fertility or menopause assessment
luteinising hormone|pituitary hormone involved in ovulation and reproductive function
prolactin|pituitary hormone that can affect ovulation when raised
rubella immunity test|blood test checking immunity to rubella
hepatitis B surface antigen|screening marker for hepatitis B infection
HIV screening test|test offered in pregnancy and sexual health care
syphilis serology|blood test for syphilis infection
group B streptococcus culture|test for carriage of group B streptococcus
fetal fibronectin|test used to help assess risk of preterm birth
placental growth factor|blood marker used in assessment of suspected preeclampsia
sFlt-1/PlGF ratio|angiogenic marker ratio used in suspected preeclampsia assessment
Kleihauer test|test estimating fetal blood cells in maternal circulation
arterial blood gas|blood test assessing oxygenation, carbon dioxide and acid-base status
venous blood gas|venous sample assessing acid-base and lactate status
serum lactate|marker of tissue hypoperfusion or sepsis severity
C-reactive protein|blood marker of inflammation
blood cultures|blood samples taken to identify bloodstream infection
`);
  for (const [term, definition] of investigations) {
    addTerm(pairs, term, definition);
    addTerm(pairs, `${term} interpretation`, `clinical meaning and limitations of a ${term} result`);
  }

  const procedures = termPairs(`
manual removal of placenta|removal of a retained placenta by hand, usually under anaesthesia
balloon tamponade|uterine balloon used to compress bleeding after postpartum haemorrhage
B-Lynch suture|uterine compression suture used to control postpartum haemorrhage
uterine artery ligation|surgical tying of uterine arteries to reduce bleeding
peripartum hysterectomy|emergency hysterectomy around childbirth, usually for life-threatening bleeding
laparoscopic salpingectomy|keyhole removal of a fallopian tube
laparoscopic cystectomy|keyhole removal of an ovarian cyst while preserving ovarian tissue
oophorectomy|surgical removal of an ovary
salpingo-oophorectomy|surgical removal of a fallopian tube and ovary
myomectomy|surgical removal of fibroids with uterine preservation
hysterectomy|surgical removal of the uterus
subtotal hysterectomy|removal of the uterine body while leaving the cervix
total abdominal hysterectomy|open abdominal removal of uterus and cervix
vaginal hysterectomy|removal of the uterus through the vagina
laparoscopic hysterectomy|keyhole hysterectomy
hysteroscopic polypectomy|removal of an endometrial polyp using hysteroscopy
hysteroscopic myomectomy|hysteroscopic removal of a submucosal fibroid
endometrial ablation|destruction of the uterine lining to treat heavy menstrual bleeding
loop excision of the transformation zone|excision of abnormal cervical tissue using a wire loop
cold knife cone biopsy|surgical cone-shaped excision of cervical tissue
vulval biopsy|sampling vulval tissue for diagnosis
pelvic floor repair|surgery to repair pelvic organ prolapse
sacrocolpopexy|surgical suspension of the vaginal vault or uterus using mesh
mid-urethral sling|surgical tape procedure for stress urinary incontinence
colpocleisis|obliterative prolapse surgery closing the vaginal canal
perineorrhaphy|surgical repair of the perineal body
ovulation induction|medication treatment to stimulate ovulation
intrauterine insemination|placement of prepared sperm into the uterus
in vitro fertilisation|fertilisation of eggs outside the body with embryo transfer
intracytoplasmic sperm injection|injection of a single sperm into an egg during IVF
embryo transfer|placement of an embryo into the uterus
oocyte retrieval|collection of eggs from the ovaries
fertility preservation|storage of eggs, sperm or embryos before fertility-threatening treatment
medical termination of pregnancy|termination using medication
surgical termination of pregnancy|termination using a surgical procedure
manual vacuum aspiration|uterine evacuation using suction
electric vacuum aspiration|uterine evacuation using powered suction
dilation and evacuation|surgical evacuation of the uterus in later pregnancy
perineal tear repair|suturing a perineal tear after birth
external anal sphincter repair|surgical repair of damaged external anal sphincter
internal anal sphincter repair|surgical repair of damaged internal anal sphincter
epidural analgesia|regional pain relief delivered into the epidural space
spinal anaesthesia|regional anaesthesia injected into cerebrospinal fluid
general anaesthesia|anaesthesia causing unconsciousness
`);
  for (const [term, definition] of procedures) {
    addTerm(pairs, term, definition);
    addTerm(pairs, `${term} consent`, `discussion of benefits, risks and alternatives before ${term}`);
    addTerm(pairs, `${term} complications`, `recognised harms or adverse outcomes associated with ${term}`);
  }

  const treatments = termPairs(`
oxytocin infusion|intravenous oxytocin used to stimulate contractions or treat uterine atony
ergometrine|uterotonic drug that contracts the uterus
carboprost|prostaglandin uterotonic used for postpartum haemorrhage
misoprostol|prostaglandin medication used for cervical ripening or uterine contraction
mifepristone|antiprogestogen used in medical termination and miscarriage management
tranexamic acid|antifibrinolytic drug used to reduce bleeding
magnesium sulfate|medicine used for eclampsia treatment or seizure prophylaxis
labetalol|beta-blocker used to treat hypertension in pregnancy
nifedipine|calcium-channel blocker used for hypertension or tocolysis
methyldopa|centrally acting antihypertensive used in pregnancy
low-dose aspirin|antiplatelet medication used to reduce preeclampsia risk in selected patients
low-molecular-weight heparin|anticoagulant used for thrombosis prevention or treatment
anti-D immunoglobulin|immunoglobulin given to prevent rhesus sensitisation
betamethasone|corticosteroid used for fetal lung maturation
dexamethasone|corticosteroid used for fetal lung maturation or other indications
atosiban|oxytocin receptor antagonist used as a tocolytic
terbutaline|beta-agonist sometimes used for acute uterine relaxation
metformin|glucose-lowering drug used in diabetes and sometimes PCOS
insulin therapy|injectable treatment to control blood glucose
iron infusion|intravenous treatment for iron deficiency anaemia
folic acid|vitamin supplement used before and during pregnancy
vitamin D supplementation|replacement used for deficiency or prevention in pregnancy
broad-spectrum antibiotics|antibiotics covering a wide range of organisms
sepsis six|bundle of urgent actions for suspected sepsis
hormone replacement therapy|oestrogen-based treatment for menopausal symptoms
combined oral contraceptive pill|pill containing oestrogen and progestogen
progestogen-only pill|contraceptive pill containing progestogen only
etonogestrel implant|long-acting progestogen contraceptive implant
levonorgestrel intrauterine system|hormonal intrauterine system used for contraception or bleeding control
copper intrauterine device|non-hormonal intrauterine contraception
depot medroxyprogesterone acetate|injectable progestogen contraception
gonadotrophin-releasing hormone agonist|drug suppressing ovarian hormone production
aromatase inhibitor|drug reducing oestrogen production
selective oestrogen receptor modulator|drug acting differently on oestrogen receptors in different tissues
ulipristal acetate|selective progesterone receptor modulator used in emergency contraception
clomifene citrate|ovulation induction medicine
letrozole|aromatase inhibitor used for ovulation induction
gonadotrophin stimulation|injectable hormone stimulation of ovarian follicles
progesterone support|progesterone given to support luteal phase or selected pregnancies
topical oestrogen|local oestrogen treatment for genitourinary symptoms
vaginal pessary|device placed in the vagina to support prolapse
pelvic floor muscle training|exercises to strengthen pelvic floor muscles
bladder training|behavioural therapy to improve urgency and frequency
`);
  for (const [term, definition] of treatments) {
    addTerm(pairs, term, definition);
    addTerm(pairs, `${term} counselling`, `patient discussion about indications, benefits, risks and practical use of ${term}`);
  }

  const communication = termPairs(`
breaking bad news|structured, sensitive communication of serious or unexpected information
capacity assessment|assessment of whether a patient can make a specific decision
best interests decision|decision made for a patient lacking capacity according to their welfare and wishes
Gillick competence|ability of a young person to consent based on maturity and understanding
Fraser guidelines|guidance on contraceptive advice and treatment for young people
chaperone offer|offer of an appropriate observer during intimate examination
intimate examination|examination of genital, breast or rectal areas requiring privacy and consent
open question|question inviting a patient to answer in their own words
closed question|question seeking a specific or limited answer
ICE framework|exploration of ideas, concerns and expectations
safety-netting advice|information about warning symptoms and when to seek help
shared management plan|plan agreed by clinician and patient after discussion
duty of candour|professional duty to be open and honest when care causes harm
root cause analysis|structured investigation into underlying causes of an incident
serious incident review|formal review of a serious patient-safety event
never event|serious, preventable patient-safety incident that should not occur
near miss|event that could have caused harm but did not
human factors|study of how systems, people and environments affect safety
situational awareness|understanding current clinical circumstances and likely developments
closed-loop communication|communication style confirming that instructions are heard and acted on
handover|transfer of clinical information and responsibility
SBAR|structured communication using situation, background, assessment and recommendation
escalation|seeking senior or specialist help as clinical risk increases
clinical prioritisation|deciding order of care according to urgency and risk
documentation|clear written record of assessment, decisions and care
contemporaneous note|record written at or soon after the event
material risk|risk a reasonable patient would consider important to a decision
reasonable alternative|clinically reasonable option that should be discussed
patient autonomy|right of a patient to make informed choices
beneficence|ethical principle of acting for patient benefit
non-maleficence|ethical principle of avoiding harm
justice|ethical principle of fairness in care and resource use
conflict of interest|situation where another interest may affect professional judgement
professional boundary|appropriate limit in clinician-patient relationships
advocacy|supporting a patient's needs, rights or interests
interpreting service|professional language support for communication
cultural competence|ability to provide respectful care across cultural contexts
trauma-informed care|care that recognises the effect of trauma and avoids retraumatisation
safeguarding concern|worry that a child or adult may be at risk of harm
female genital mutilation|non-medical cutting or injury of female genital organs
honour-based abuse|abuse linked to perceived family or community honour
coercive control|pattern of controlling behaviour in an intimate or family relationship
sexual assault disclosure|patient disclosure of sexual assault requiring sensitive support
mandatory reporting|legal or policy duty to report specific concerns
confidential enquiry|systematic confidential review of adverse outcomes to improve care
maternal mortality|death of a woman during pregnancy or within a defined period after birth
perinatal mortality|death of a baby around the time of birth
morbidity|illness or complications caused by a condition or care
prevalence|proportion of a population with a condition at a point or period
incidence|rate of new cases in a population over time
relative risk|risk ratio comparing probability between groups
odds ratio|measure comparing odds of an outcome between groups
confidence interval|range expressing uncertainty around an estimate
number needed to treat|number of patients needing treatment for one additional benefit
number needed to harm|number of patients exposed for one additional harm
sensitivity|ability of a test to detect disease when disease is present
specificity|ability of a test to exclude disease when disease is absent
positive predictive value|chance that a positive test reflects true disease
negative predictive value|chance that a negative test reflects absence of disease
randomised controlled trial|study randomly assigning participants to compare interventions
systematic review|structured review of evidence using predefined methods
meta-analysis|statistical combination of results from multiple studies
cohort study|observational study following groups over time
case-control study|observational study comparing people with and without an outcome
confounding|distortion of an association by another related factor
bias|systematic error affecting study validity
intention-to-treat analysis|analysis according to original trial allocation
non-inferiority trial|trial testing whether a treatment is not unacceptably worse
clinical guideline|evidence-informed recommendation for clinical practice
standard operating procedure|local written process for consistent practice
patient information leaflet|written explanation designed for patients
`);
  for (const [term, definition] of communication) addTerm(pairs, term, definition);

  const prefixes = ["antenatal", "intrapartum", "postpartum", "postnatal", "preoperative", "perioperative", "fertility", "menopause", "contraception", "oncology"];
  const activities = [
    ["assessment", "structured clinical evaluation"],
    ["counselling", "discussion of options, risks and patient preferences"],
    ["documentation", "written recording of relevant clinical information"],
    ["follow-up", "planned review after assessment or treatment"],
    ["risk stratification", "grouping patients by clinical risk"],
    ["safety-netting", "advice about warning signs and when to seek urgent help"],
  ];
  for (const prefix of prefixes) {
    for (const [activity, definition] of activities) {
      addTerm(pairs, `${prefix} ${activity}`, `${definition} in ${prefix} care`);
    }
  }

  addLines(pairs, `
acute abdomen in pregnancy|urgent abdominal pain in pregnancy requiring assessment for obstetric and non-obstetric causes
advanced laparoscopic skills|specialist keyhole surgical skills for complex gynaecological procedures
anaesthetic review|assessment by an anaesthetist before surgery, birth or high-risk obstetric care
antenatal anaemia management|assessment and treatment of low haemoglobin during pregnancy
antibiotic prophylaxis|preventive antibiotics given to reduce infection risk
asymptomatic bacteriuria|bacteria in urine without symptoms, important in pregnancy because treatment reduces complications
birth after caesarean counselling|discussion of planned vaginal birth or repeat caesarean after previous caesarean
bladder care protocol|planned catheterisation and voiding management to prevent urinary complications
blood loss estimation|clinical assessment of measured or estimated bleeding volume
blood product transfusion|administration of blood components to treat bleeding or coagulopathy
body mass index counselling|discussion of weight-related risks and management in pregnancy or surgery
caesarean scar pregnancy|ectopic pregnancy implanted in a previous caesarean scar
cancer fast-track referral|urgent referral pathway for suspected gynaecological cancer
capacity assessment|evaluation of whether a patient can make a specific informed decision
cardiac disease in pregnancy|maternal heart condition requiring specialist risk assessment during pregnancy
cervical ripening|preparation of the cervix before induction of labour
clinical escalation|prompt referral to senior or specialist help when risk increases
complex consent|consent process for decisions with significant uncertainty, alternatives or serious risk
compound presentation|presentation in labour where an extremity presents alongside the main presenting part
contraceptive eligibility criteria|structured guidance on medical suitability for contraceptive methods
conversion to laparotomy|change from keyhole surgery to open surgery when clinically required
cord blood gas analysis|measurement of newborn umbilical blood acid-base status after birth
critical haemorrhage protocol|emergency pathway for major bleeding requiring coordinated transfusion and treatment
decreased fetal movements|maternal perception of reduced fetal movement requiring assessment
delayed cord clamping|waiting briefly before clamping the umbilical cord when safe
differential diagnosis|list of possible causes for a clinical presentation
emergency theatre access|rapid availability of an operating theatre for urgent surgery
endometriosis excision|surgical removal of endometriotic lesions
epidural analgesia counselling|discussion of benefits, risks and alternatives of epidural pain relief
failed induction|induction of labour that does not achieve established labour or safe progress
fetal anomaly counselling|communication about suspected or confirmed fetal structural abnormality
fetal medicine referral|specialist referral for complex fetal, placental or pregnancy problems
fibroid mapping|imaging description of fibroid number, size and location for treatment planning
frailty assessment|structured assessment of vulnerability and reserve, especially before major surgery
genetic counselling|specialist discussion of inherited risk, testing options and implications
group B streptococcus prophylaxis|intrapartum antibiotics to reduce neonatal group B streptococcal disease risk
high-dependency care|enhanced monitoring and treatment for patients needing more support than standard ward care
human factors|team, communication and system factors influencing clinical performance and safety
hysterectomy consent|consent discussion for removal of the uterus including fertility and surgical risks
intraoperative complication|unexpected adverse event occurring during surgery
intrauterine transfusion|fetal blood transfusion given inside the uterus for severe fetal anaemia
labour ward coordinator|senior clinician coordinating activity, prioritisation and safety on labour ward
laparoscopic entry technique|method used to enter the abdomen safely during keyhole surgery
major obstetric haemorrhage drill|simulated practice for coordinated response to severe obstetric bleeding
maternal early warning score|observation chart score prompting escalation for maternal deterioration
maternal request caesarean|caesarean birth requested without a standard medical indication
medication reconciliation|checking current medicines accurately at admission, transfer or discharge
mesh complication|pain, erosion, infection or dysfunction related to implanted surgical mesh
minimum dataset|core information required for a clinical audit, registry or referral
near-miss review|analysis of a serious event that almost caused major harm
neonatal hypoglycaemia risk|risk of low newborn blood glucose after birth
neuroprotection with magnesium sulphate|magnesium sulphate given before early preterm birth to reduce cerebral palsy risk
obesity in pregnancy|pregnancy affected by high body mass index and associated maternal-fetal risks
operative findings|documented observations made during surgery
outpatient hysteroscopy|hysteroscopy performed without hospital admission
patient safety huddle|brief team meeting to identify current risks and actions
pelvic abscess|collection of pus within the pelvis
postoperative ileus|temporary bowel inactivity after surgery
postpartum contraception counselling|discussion of contraceptive options after childbirth
pregnancy after loss|antenatal care following previous miscarriage, stillbirth or neonatal death
preterm birth prevention clinic|specialist service assessing and reducing risk of preterm birth
prophylactic tranexamic acid|tranexamic acid used preventively in selected bleeding-risk situations
raised body mass index pathway|care pathway for patients with high BMI during pregnancy or surgery
reduced fetal growth velocity|slowing of fetal growth across serial measurements
reproductive coercion|control or pressure affecting a person's reproductive choices
robson classification|system classifying caesarean births by obstetric characteristics
second-stage delay|slow progress during the pushing or descent phase of labour
sepsis six|urgent bundle of actions for recognising and treating sepsis
shared care protocol|agreed pathway dividing care between services or clinicians
simulation training|practice of clinical scenarios to improve technical and team performance
skin-to-skin contact|placing the newborn against the parent's bare chest after birth when safe
speculum examination|visual examination of the cervix and vagina using a speculum
submucosal fibroid|fibroid projecting into or distorting the uterine cavity
surgical safety checklist|structured checks before, during and after surgery to reduce avoidable harm
third-stage complication|problem occurring between birth of the baby and completion of placental delivery
thromboprophylaxis|treatment to reduce risk of venous thromboembolism
tocolysis|medication used to suppress uterine contractions temporarily
trauma-informed care|care that recognises the impact of trauma and avoids re-traumatisation
uterine cavity assessment|investigation of the inside of the uterus
uterine inversion|rare emergency in which the uterus turns inside out after birth
vaginal birth after caesarean|planned vaginal birth in a patient with a previous caesarean
venous thromboembolism prophylaxis|measures to reduce risk of deep vein thrombosis or pulmonary embolism
vicarious trauma|emotional impact on staff from repeated exposure to distressing clinical events
vulval pain mapping|systematic assessment of vulval pain location and triggers
ward round documentation|written record of clinical review, decisions and plans
water immersion in labour|use of water for comfort and pain relief during labour
wrong-site surgery prevention|systems preventing operation on the wrong patient, side or procedure
`);

  return generatedWords("enmed", pairs, 1000, "Medical English");
}

function literaryEnglishWords() {
  const pairs = [];
  addLines(pairs, `
abashed|embarrassed, ashamed or made uneasy
abate|to become less intense or severe
abhor|to hate or regard with disgust
abide|to remain, endure or tolerate
abject|miserable, degraded or without pride
abjure|to formally reject or renounce
abode|a dwelling or place of residence
abridge|to shorten a text or account
abroad|away from home or in a foreign country
abscond|to leave secretly or hurriedly
accede|to agree to a request or assume a position
acquaintance|a person one knows but not intimately
acquiesce|to accept without protest
admonish|to warn or reprimand seriously
affability|friendly ease and politeness
affectation|artificial behaviour meant to impress
affliction|great suffering, trouble or distress
aggrieved|feeling wronged or treated unfairly
alacrity|cheerful readiness or eagerness
alienate|to make distant, unfriendly or estranged
allay|to calm or reduce fear, anger or pain
amendment|correction, improvement or change
amiable|pleasant, kind and friendly
amity|peaceful friendship
amorous|showing romantic or sexual feeling
anon|soon, shortly or at another time
antiquated|old-fashioned or outdated
apparition|a ghostly or unexpected figure
appellation|a name or title
apprehension|anxiety or fearful expectation
ardent|passionate, eager or intense
ardour|intense feeling, enthusiasm or passion
artifice|clever trickery or contrivance
ascertain|to find out with certainty
asperity|harshness of tone or manner
assiduous|showing steady care and effort
asunder|apart or into separate pieces
attire|clothing or dress
audacious|bold, daring or impudent
aught|anything at all
austere|severe, plain or strict
aversion|strong dislike
avow|to declare openly
baneful|harmful or destructive
behold|to look at or see
behoove|to be proper, necessary or fitting
benediction|a blessing
benevolence|kindness and goodwill
beseech|to ask urgently or earnestly
bestow|to give or confer
betide|to happen to someone
betimes|early or in good time
betrothal|formal engagement to marry
betwixt|between
bewail|to lament or express sorrow over
bier|stand or frame for a coffin
bivouac|temporary camp without tents or shelter
blithe|cheerful and carefree
boon|a blessing, benefit or favour
bosom|chest, heart or inner feelings
bough|a main branch of a tree
bridegroom|a man on his wedding day
brocade|rich fabric woven with a raised pattern
brook|to tolerate or endure
buffet|to strike repeatedly or struggle against
burthen|archaic spelling of burden
cabal|secret political group or intrigue
candour|honesty and openness
caprice|sudden change of mood or whim
carriage|a horse-drawn vehicle or one's manner of bearing
casement|a window that opens on hinges
castigate|to reprimand severely
celerity|swiftness or speed
chagrin|distress or annoyance from disappointment
chamber|a room, especially a bedroom or private room
charitable|kind, generous or forgiving
chasten|to discipline, humble or restrain
chide|to scold mildly
chivalry|courteous or knightly conduct
circumspect|careful and cautious
clamour|loud outcry or demand
clandestine|secret or concealed
clemency|mercy or leniency
coffer|a strong chest for valuables
cogent|clear, logical and convincing
comely|pleasant-looking or attractive
commiseration|sympathetic pity
compunction|guilt or regret for wrongdoing
conceit|excessive pride or a fanciful idea
concord|agreement or harmony
condescension|patronising behaviour or gracious lowering of rank
confound|to confuse, astonish or frustrate
conjecture|a guess based on incomplete evidence
conjugal|relating to marriage
consternation|sudden shock or alarm
countenance|a person's face or facial expression
courtesy|polite and considerate behaviour
covert|hidden or secret
covet|to desire what belongs to another
cowardice|lack of courage
cravat|a neckcloth worn by men
credulity|readiness to believe too easily
dearth|scarcity or lack
decorum|proper behaviour and social restraint
deference|respectful submission to another's judgement
deign|to do something considered beneath one's dignity
delicacy|sensitivity, refinement or tact
dell|a small wooded valley
demeanour|outward behaviour or manner
demure|reserved, modest or shy in manner
denizen|inhabitant or frequent presence
deplorable|very bad or deserving regret
deportment|manner of standing, moving and behaving
desolate|empty, lonely or devastated
despondency|state of low spirits or hopelessness
destitute|without basic necessities
diffidence|shyness or lack of self-confidence
disapprobation|moral disapproval
discomfit|to defeat, embarrass or unsettle
disconsolate|unable to be comforted
discourse|formal speech or conversation
disdain|contempt or scorn
disinterested|impartial rather than self-seeking
disposition|temperament or usual character
diversion|entertainment or distraction
domestic felicity|happiness in home and family life
dowager|widow with a title or property from her late husband
duenna|older woman acting as a chaperone
duress|constraint or pressure
edifice|large impressive building
efface|to erase, remove or make oneself unnoticed
effusion|unrestrained expression of feeling
egress|way out or act of going out
elopement|secret departure to marry
emolument|salary, profit or payment from office
encomium|formal praise
endeavour|serious attempt or effort
entreat|to ask earnestly
equanimity|calmness under difficulty
ere|before; earlier than
erelong|before long
erstwhile|former or in former times
esteem|respect and admiration
evince|to show clearly
exceedingly|to a very great degree
execrable|extremely bad or detestable
exertion|physical or mental effort
expostulate|to reason earnestly against an action
extol|to praise highly
faculties|mental powers or abilities
fain|gladly or willingly
fair countenance|beautiful or pleasing facial expression
falter|to hesitate, stumble or lose confidence
fastidious|hard to please or very attentive to detail
fathom|to understand after thought
felicity|happiness or apt expression
fervour|intense feeling or zeal
fickle|changeable in loyalty or affection
fie|exclamation of disapproval or disgust
filial|relating to a son or daughter
florid|reddish, ornate or overly elaborate
forbear|to refrain from doing something
forbearance|patient self-control
foreboding|fearful sense that something bad will happen
foregoing|already mentioned or preceding
forlorn|pitifully sad, lonely or abandoned
forsake|to abandon or leave
fortitude|courage in pain or difficulty
fortnight|a period of two weeks
frivolous|not serious or lacking proper weight
frock|dress or outer garment
gait|manner of walking
gallantry|courteous bravery or attention to women
garret|small attic room
gaunt|thin, bleak or grim
genteel|polite, refined or socially respectable
gentry|people of good social position below nobility
gloom|darkness, sadness or melancholy atmosphere
gratification|pleasure or satisfaction
hauteur|haughty pride or arrogance
hearth|fireplace or home
hence|from here or from this time
henceforth|from this time onward
heretofore|until now
hither|to this place
impertinence|rudeness or improper boldness
impetuous|acting quickly without thought
importune|to ask repeatedly and urgently
impropriety|socially improper action or remark
indignation|anger at injustice or insult
indolence|laziness or avoidance of effort
ineffable|too great to be expressed in words
inexorable|impossible to persuade or stop
infamy|public disgrace or evil reputation
ingenuous|innocent, open or sincere
injudicious|unwise or showing poor judgement
insensibility|unconsciousness or lack of feeling
interpose|to intervene or place between
intimation|hint or indirect suggestion
irksome|annoying or tiresome
judicious|showing good judgement
kinsman|male relative
lamentation|expression of grief
languid|weak, slow or lacking energy
laudanum|opium tincture formerly used as medicine
lest|to avoid the risk that
levity|inappropriate lightness or lack of seriousness
mien|appearance, bearing or manner
misgiving|feeling of doubt or anxiety
mirth|joy or amusement
modish|fashionable
morose|sullen and ill-tempered
mortification|deep embarrassment or humiliation
nay|no, or more strongly, not only that
notwithstanding|despite
obeisance|gesture of respect or submission
obliging|helpful and eager to please
odious|hateful or extremely unpleasant
oft|often
opprobrium|public disgrace or harsh criticism
palpable|able to be felt or obvious
parlour|sitting room for receiving guests
patronage|support or favour from a powerful person
pecuniary|relating to money or financial matters
penury|extreme poverty
perchance|perhaps
peril|serious danger
perturbation|anxiety or disturbance
physiognomy|facial features seen as revealing character
pinion|to bind the arms or wings
piteous|deserving pity
placid|calm and peaceful
portent|sign or warning of future event
presently|soon or after a short time
presumption|overconfidence or improper boldness
procure|to obtain, often with effort
prodigious|remarkably great or impressive
propensity|natural tendency or inclination
propriety|social correctness or proper behaviour
prospect|view, expectation or possibility
provender|food for livestock, or food generally in humorous use
prudence|careful good judgement
quoth|said
rapture|intense delight or ecstatic feeling
recompense|repayment, reward or compensation
redress|remedy or compensation for a wrong
rejoinder|reply, especially a sharp one
remonstrance|forceful protest or objection
repose|rest, calm or dignified bearing
reproof|expression of blame or correction
repugnance|strong dislike or opposition
reverie|daydream or absorbed musing
ruinous|causing ruin or in a ruined state
sagacity|wisdom and good judgement
salutation|greeting
scarcely|almost not
scruple|moral hesitation or doubt
sedate|calm, dignified and serious
semblance|outward appearance or likeness
sentiment|feeling, opinion or refined emotion
servitude|state of being a servant or slave
slumber|sleep
solicitude|anxious care or concern
sojourn|temporary stay
solemnity|seriousness or formal ceremony
solitude|state of being alone
spectre|ghost or frightening apparition
staid|serious, settled and respectable
succour|help or relief in distress
supplication|humble earnest request
surmise|to guess or infer
tarry|to delay or stay longer
thence|from that place or time
thereafter|after that
thereby|by that means
therein|in that place or matter
thither|to that place
tidings|news
transgression|wrongdoing or violation
tremulous|shaking or timid
trifling|of little importance
tumult|confusion, uproar or emotional agitation
unbecoming|improper or unsuitable
unbidden|not invited or requested
unfeigned|genuine or sincere
vexation|annoyance or distress
visage|face or facial appearance
vouchsafe|to grant or reveal graciously
wainscot|wooden panelling on walls
wan|pale and weak-looking
whereupon|immediately after which
whence|from where
wherefore|why or for what reason
whilst|while
wistful|longing or sadly thoughtful
wretched|miserable or deeply unhappy
yonder|over there
`);

  const settings = termPairs(`
ancestral hall|large old family room or residence associated with lineage
ancient manor|old country house belonging to a family estate
blasted heath|bleak open land suggesting desolation or supernatural danger
boarding house|lodging house where residents pay for rooms and meals
coaching inn|inn serving travellers and horse-drawn coaches
country seat|large country residence of a wealthy family
drawing room|formal sitting room for receiving guests
gloomy corridor|dark passage suggesting suspense or unease
gothic abbey|old religious building used as a Gothic setting
haunted chamber|room associated with ghostly fear or memory
lonely moor|open uncultivated land evoking isolation
market town|town serving as a local centre of trade
posting house|inn where horses could be changed for travel
ruined castle|decaying fortified building common in Gothic fiction
secluded cottage|small isolated rural dwelling
servants' hall|room where household servants ate or gathered
sickroom|room where an ill person is cared for
tenant farm|farm rented from a landowner
wayside inn|inn beside a road used by travellers
widow's lodging|modest rooms occupied by a widow
`);
  const adjectives = termPairs(`
bleak|cold, bare or hopeless in mood
melancholy|sad, reflective or gloomy
forbidding|unfriendly, threatening or difficult to approach
desolate|lonely, empty or abandoned
dilapidated|fallen into disrepair
venerable|respected because of age or dignity
sequestered|isolated or withdrawn
tempestuous|stormy or emotionally turbulent
oppressive|weighing heavily on mind or body
sepulchral|relating to tombs or sounding deathly
`);
  for (const [term, definition] of settings) addTerm(pairs, term, definition);
  for (const [adjective, adjectiveDefinition] of adjectives) {
    for (const [setting] of settings) {
      addTerm(pairs, `${adjective} ${setting}`, `${adjectiveDefinition}; used of ${setting}`);
    }
  }

  const socialNouns = termPairs(`
acquaintance|a person known socially but not closely
benefactor|person who gives help, money or patronage
chaperone|person supervising unmarried young people in social settings
clergyman|male member of the clergy
confidante|woman trusted with private thoughts
coxcomb|vain, foolishly fashionable man
curate|assistant clergyman
debutante|young woman making formal entrance into society
governess|woman employed to teach children in a household
guardian|person legally or morally responsible for another
heiress|woman who inherits wealth or property
landlord|owner who rents property to tenants
matron|older married woman or woman in charge of a household
patron|person who supports or advances another
suitor|person pursuing marriage or courtship
ward|person under the care of a guardian
widower|man whose spouse has died
`);
  const socialActions = termPairs(`
pay court to|to seek someone's favour or affection
take one's leave|to say farewell and depart
make one's bow|to greet or depart with formal courtesy
keep company with|to spend time socially with someone
fall into disgrace|to lose social approval or reputation
preserve decorum|to maintain socially proper behaviour
offer one's hand|to propose marriage or offer formal support
receive visitors|to welcome callers at home
pay a call|to make a short formal visit
give offence|to insult or upset someone
`);
  for (const [term, definition] of socialNouns) addTerm(pairs, term, definition);
  for (const [term, definition] of socialActions) addTerm(pairs, term, definition);
  for (const [person] of socialNouns) {
    addTerm(pairs, `${person}'s countenance`, `the facial expression or appearance of a ${person}`);
    addTerm(pairs, `${person}'s station`, `the social rank or position of a ${person}`);
  }

  const abstractNouns = termPairs(`
affection|tender feeling or attachment
ambition|strong desire for success or advancement
anguish|severe mental or physical pain
apprehension|fearful expectation or anxiety
constancy|faithfulness or steadiness
contrition|sincere remorse for wrongdoing
disquietude|uneasy anxiety
esteem|respect and admiration
felicity|happiness or aptness of expression
gratitude|thankfulness
imprudence|lack of wise caution
melancholy|deep sadness or reflective gloom
perplexity|confusion or uncertainty
resentment|bitter indignation at a wrong
sensibility|capacity for refined feeling
solicitude|anxious care or concern
tranquillity|calmness and peace
vexation|annoyance or distress
`);
  const verbs = termPairs(`
awaken|to wake or stir into awareness
betray|to reveal, deceive or be disloyal
cherish|to hold dear or protect affectionately
contemplate|to think about deeply
discern|to perceive or recognise
endeavour|to try earnestly
entreat|to ask earnestly
evince|to show clearly
forsake|to abandon
implore|to beg urgently
lament|to mourn or express grief
perceive|to notice or understand
recollect|to remember
repine|to complain or fret discontentedly
reproach|to blame or express disapproval
shudder|to tremble from fear or disgust
surmise|to infer or guess
withhold|to keep back or refuse to give
`);
  for (const [term, definition] of abstractNouns) addTerm(pairs, term, definition);
  for (const [term, definition] of verbs) addTerm(pairs, term, definition);
  for (const [verb] of verbs) {
    for (const [noun] of abstractNouns.slice(0, 12)) {
      addTerm(pairs, `${verb} ${noun}`, `to ${verb} or express ${noun} in a literary context`);
    }
  }

  const legalEconomic = termPairs(`
annuity|fixed yearly payment
bequest|property left in a will
creditor|person or institution owed money
deed|formal legal document
dower|property or provision for a widow
entail|legal settlement limiting inheritance of property
executor|person responsible for carrying out a will
jointure|financial provision for a widow
legacy|gift left in a will
mortgage|loan secured on property
pecuniary embarrassment|financial difficulty or debt
portion|inheritance or dowry assigned to someone
settlement|legal arrangement of property or money
solicitor|lawyer handling legal affairs
surety|person or guarantee responsible for another's debt
tenancy|right to occupy rented property
testament|will or formal declaration
trustee|person managing property for another
`);
  const legalQualifiers = ["family", "private", "ruinous", "considerable", "modest", "disputed", "secret", "generous"];
  for (const [term, definition] of legalEconomic) addTerm(pairs, term, definition);
  for (const qualifier of legalQualifiers) {
    for (const [term] of legalEconomic) {
      addTerm(pairs, `${qualifier} ${term}`, `${term} described as ${qualifier} in social or legal narration`);
    }
  }

  const connectors = termPairs(`
accordingly|as a result
albeit|although
by and by|after a short while
forasmuch as|because or since
hereafter|from now on or after this
in consequence|as a result
in sooth|in truth
in the meanwhile|during the same interval
nevertheless|despite that
peradventure|perhaps
thereupon|immediately after that
to wit|namely
whereby|by which
wherein|in which
whereof|of which
wherewith|with which
`);
  for (const [term, definition] of connectors) addTerm(pairs, term, definition);
  for (const [term] of connectors) {
    addTerm(pairs, `${term},`, `${term}; often used as a formal narrative connector`);
  }

  addLines(pairs, `
abominable conduct|behaviour described as morally shocking or hateful
affected civility|politeness that seems artificial or insincere
ancient lineage|old family descent or ancestry
arduous journey|difficult or exhausting journey
benevolent patron|supportive person of higher status who offers help
blighted hope|hope spoiled or destroyed by events
ceremonious greeting|very formal greeting
chequered fortune|life or luck marked by alternating success and trouble
cloistered life|secluded or sheltered way of living
confidential avowal|private open declaration of feeling or fact
constrained smile|smile showing discomfort or restraint
declining health|health growing gradually worse
delicate constitution|physically sensitive or fragile health
domestic economy|management of household money and affairs
dreadful presentiment|strong feeling that something terrible will happen
earnest remonstrance|serious protest or objection
elegant accomplishments|refined skills expected in polite society
embarrassed circumstances|financial difficulty or social disadvantage
exquisite sensibility|highly refined capacity for feeling
false delicacy|over-refined restraint that prevents honest action
fashionable assembly|social gathering of fashionable people
filial duty|duty owed by a child to a parent
gallant officer|military man presented as brave and courteous
grave aspect|serious expression or appearance
hasty avowal|quick confession or declaration
hereditary estate|property passed down through a family
imprudent attachment|romantic bond considered unwise
melancholy reflection|sad or thoughtful consideration
peculiar circumstance|particular or unusual situation
polished manners|refined and socially skilled behaviour
private mortification|personal embarrassment or humiliation
rank impropriety|clear breach of proper conduct
reserved manner|restrained or distant social behaviour
romantic attachment|strong idealised romantic feeling
solemn assurance|serious promise or declaration
unaccountable impulse|urge or action whose cause is hard to explain
unfortunate connexion|social or family connection causing difficulty
virtuous indignation|anger felt on moral grounds
worldly prudence|practical caution about money, status or advantage
`);

  return generatedWords("enlit", pairs, 1000, "Literary English");
}

const packData = {
  "english-starter": {
    words: words("en", `
house|a place where people live
apartment|a home inside a larger building
kitchen|room for cooking
bedroom|room for sleeping
bathroom|room for washing
window|opening with glass in a wall
door|entrance that opens and closes
table|furniture for meals or work
chair|seat for one person
bed|furniture for sleeping
lamp|light for a room
phone|device for calls and messages
computer|machine for digital work
bag|container carried by hand or shoulder
wallet|small holder for money and cards
key|object used to open a lock
book|written pages bound together
paper|thin material for writing
pen|tool for writing with ink
water|clear liquid people drink
bread|basic baked food
rice|small white or brown grains eaten as food
meat|animal food protein
fish|animal from water eaten as food
egg|oval food from a bird
cheese|food made from milk
apple|round fruit
banana|long yellow fruit
coffee|hot dark drink
tea|hot drink made with leaves
breakfast|morning meal
lunch|midday meal
dinner|evening meal
shop|place where people buy things
market|place with many sellers
money|coins, notes, or digital payment
price|amount of money something costs
ticket|paper or digital proof for travel or entry
train|vehicle that runs on rails
bus|large road vehicle for passengers
station|place where trains or buses stop
airport|place where planes arrive and leave
street|road in a town or city
city|large town
village|small settlement
map|drawing that shows places
left|opposite of right
right|opposite of left
near|not far away
far|a long distance away
today|this day
tomorrow|the day after today
yesterday|the day before today
morning|early part of the day
afternoon|part of the day after noon
evening|late part of the day
night|dark part of the day
week|seven days
month|part of a year
year|twelve months
weather|condition of air outside
rain|water falling from clouds
wind|moving air
sun|bright star seen in daytime
cold|low in temperature
warm|pleasantly hot
person|human being
friend|person you like and know well
family|parents, children, and relatives
child|young person
teacher|person who helps students learn
doctor|person who treats illness
worker|person who does a job
student|person who studies
happy|feeling good
sad|feeling unhappy
tired|needing rest
busy|having many things to do
ready|prepared
important|having great value
easy|not difficult
difficult|not easy
new|not old
old|not new or not young
good|positive or useful
bad|negative or harmful
small|not large
large|big
to be|to exist or have a state
to have|to own or hold
to go|to move to another place
to come|to move toward here
to make|to create or produce
to do|to perform an action
to see|to notice with the eyes
to say|to speak words
to know|to have information
to want|to wish for something
to need|to require something
to eat|to take food
to drink|to take liquid
to buy|to get something by paying
to work|to do a job
to learn|to gain knowledge
because|for the reason that
but|used to contrast ideas
also|in addition
maybe|perhaps
always|every time
often|many times
sometimes|on some occasions
never|not ever
`),
    texts: [
      text("en_morning", "Morning routine", "I {wake} up early and make {coffee}. After breakfast I check my {calendar} and leave the house before eight.", "I wake up early and make coffee. After breakfast I check my calendar and leave the house before eight."),
      text("en_shopping", "At the shop", "At the {shop}, I buy bread, apples, and a small bottle of {water}. The price is clear, and I pay by {card}.", "At the shop, I buy bread, apples, and a small bottle of water. The price is clear, and I pay by card."),
      text("en_work_day", "A work day", "My work day starts with a short {meeting}. I write notes, answer {messages}, and finish one important {task}.", "My work day starts with a short meeting. I write notes, answer messages, and finish one important task."),
      text("en_travel", "Travelling", "Tomorrow I take the {train} to another city. I need a ticket, a small {bag}, and the address of the {hotel}.", "Tomorrow I take the train to another city. I need a ticket, a small bag, and the address of the hotel."),
      text("en_friend", "Meeting a friend", "In the evening I meet a {friend} near the station. We talk about work, family, and our plans for the {weekend}.", "In the evening I meet a friend near the station. We talk about work, family, and our plans for the weekend."),
      text("en_cooking", "Cooking dinner", "I cook rice and vegetables in the {kitchen}. The meal is simple, warm, and ready before my family comes {home}.", "I cook rice and vegetables in the kitchen. The meal is simple, warm, and ready before my family comes home."),
      text("en_weather", "Weather", "Today the {weather} is cold and windy. I wear a coat because heavy {rain} may come in the afternoon.", "Today the weather is cold and windy. I wear a coat because heavy rain may come in the afternoon."),
      text("en_transport", "Public transport", "The bus is late, so I wait at the {station}. When it arrives, I find a seat near the {window}.", "The bus is late, so I wait at the station. When it arrives, I find a seat near the window."),
      text("en_weekend", "Weekend plans", "On Saturday we want to visit a {market}, cook dinner, and watch a film at {home}. It is a quiet plan.", "On Saturday we want to visit a market, cook dinner, and watch a film at home. It is a quiet plan."),
      text("en_home", "My home", "My apartment has a small {kitchen}, a bright bedroom, and a table beside the {window}. It feels comfortable.", "My apartment has a small kitchen, a bright bedroom, and a table beside the window. It feels comfortable."),
    ],
    forms: englishForms("en", [
      ["plural", "one child, two ___", "", "children", "", "irregular plural"],
      ["plural", "one person, two ___", "", "people", "", "irregular plural"],
      ["plural", "one city, two cit___", "", "ies", "", "city → cities"],
      ["plural", "one box, two box___", "", "es", "", "box → boxes"],
      ["plural", "one house, two house___", "", "s", "", "regular plural"],
      ["plural", "one woman, two ___", "", "women", "", "irregular plural"],
      ["plural", "one man, two ___", "", "men", "", "irregular plural"],
      ["plural", "one tooth, two ___", "", "teeth", "", "irregular plural"],
      ["third person", "he work___ every day", "he work", "s", " every day", "third-person singular"],
      ["third person", "she watch___ TV", "she watch", "es", " TV", "verb ending after ch"],
      ["third person", "he stud___ English", "he stud", "ies", " English", "study → studies"],
      ["third person", "she go___ home", "she go", "es", " home", "go → goes"],
      ["third person", "it rain___ often", "it rain", "s", " often", "regular third-person singular"],
      ["past", "Yesterday I walk___", "Yesterday I walk", "ed", "", "regular past"],
      ["past", "Yesterday I arriv___ late", "Yesterday I arriv", "ed", " late", "arrive → arrived"],
      ["past", "Yesterday I stud___", "Yesterday I stud", "ied", "", "study → studied"],
      ["past", "Yesterday I stop___", "Yesterday I stop", "ped", "", "stop → stopped"],
      ["past", "Yesterday I went there", "Yesterday I ", "went", " there", "go → went"],
      ["past", "Yesterday I saw it", "Yesterday I ", "saw", " it", "see → saw"],
      ["past", "Yesterday I made dinner", "Yesterday I ", "made", " dinner", "make → made"],
      ["past", "Yesterday I ate lunch", "Yesterday I ", "ate", " lunch", "eat → ate"],
      ["past participle", "I have written a note", "I have ", "written", " a note", "write → written"],
      ["past participle", "I have taken the train", "I have ", "taken", " the train", "take → taken"],
      ["past participle", "I have seen the film", "I have ", "seen", " the film", "see → seen"],
      ["past participle", "I have bought bread", "I have ", "bought", " bread", "buy → bought"],
      ["comparative", "small → small___", "small", "er", "", "regular comparative"],
      ["comparative", "large → larg___", "larg", "er", "", "drop final e in spelling"],
      ["comparative", "happy → happ___", "happ", "ier", "", "y → ier"],
      ["comparative", "good → ___", "", "better", "", "irregular comparative"],
      ["superlative", "good → the ___", "the ", "best", "", "irregular superlative"],
      ["superlative", "easy → the eas___", "the eas", "iest", "", "easy → easiest"],
      ["gerund", "run → run___", "run", "ning", "", "double consonant"],
      ["gerund", "make → mak___", "mak", "ing", "", "drop final e"],
      ["gerund", "study → study___", "study", "ing", "", "regular ing form"],
      ["negative", "I ___ not know", "I ", "do", " not know", "present negative helper"],
      ["negative", "He ___ not know", "He ", "does", " not know", "third-person helper"],
      ["question", "___ you speak English?", "", "Do", " you speak English?", "present simple question"],
      ["question", "___ she work here?", "", "Does", " she work here?", "third-person question"],
      ["modal", "I ___ go now", "I ", "must", " go now", "necessity"],
      ["modal", "I ___ like coffee", "I ", "would", " like coffee", "polite request"],
      ["pronoun", "This is my book. It is ___", "It is ", "mine", "", "possessive pronoun"],
      ["pronoun", "This is her bag. It is ___", "It is ", "hers", "", "possessive pronoun"],
      ["pronoun", "I saw John. I saw ___", "I saw ", "him", "", "object pronoun"],
      ["pronoun", "I saw Anna. I saw ___", "I saw ", "her", "", "object pronoun"],
      ["article", "___ apple is on the table", "", "An", " apple is on the table", "an before vowel sound"],
      ["article", "___ book is on the table", "", "A", " book is on the table", "a before consonant sound"],
      ["preposition", "I live ___ a city", "I live ", "in", " a city", "place preposition"],
      ["preposition", "I go ___ work", "I go ", "to", " work", "movement preposition"],
      ["preposition", "The meeting is ___ Monday", "The meeting is ", "on", " Monday", "day preposition"],
      ["preposition", "The meeting is ___ nine", "The meeting is ", "at", " nine", "time preposition"],
    ]),
  },
  "english-medical-starter": {
    words: words("enmed", `
symptom|a sign of illness felt or noticed
diagnosis|identification of a disease or condition
treatment|care given to improve health
medication|medicine used for treatment
prescription|doctor's written order for medicine
dosage|amount of medicine to take
tablet|small solid piece of medicine
capsule|medicine in a small shell
injection|medicine given with a needle
vaccine|substance that helps prevent disease
infection|illness caused by germs
inflammation|redness, heat, swelling, or pain
swelling|enlargement caused by fluid or irritation
fever|body temperature higher than normal
cough|sudden push of air from the throat
headache|pain in the head
nausea|feeling that you may vomit
fatigue|strong tiredness
pain|unpleasant body feeling
chronic|lasting for a long time
acute|starting suddenly or lasting a short time
recovery|return to health
appointment|arranged time to see a clinician
clinic|place for outpatient medical care
hospital|place for serious medical care
ward|hospital area with patient beds
patient|person receiving medical care
nurse|health worker who cares for patients
doctor|medically trained clinician
surgeon|doctor who performs operations
procedure|medical action or operation
examination|careful medical check
blood pressure|force of blood against artery walls
pulse|heartbeat felt in an artery
temperature|measurement of body heat
breathing|taking air in and out
oxygen|gas needed for breathing
heart|organ that pumps blood
lung|organ used for breathing
stomach|organ that receives food
liver|large organ that processes blood and chemicals
kidney|organ that filters blood
skin|outer covering of the body
blood|red fluid in the body
tissue|group of similar body cells
cell|smallest living unit of the body
sample|small amount taken for testing
laboratory|place where tests are performed
blood test|laboratory test using blood
urine test|laboratory test using urine
screening|test used to look for possible disease
result|information produced by a test
normal range|expected test-value interval
risk|chance of harm or illness
prevention|action that reduces risk
monitoring|regular checking over time
follow-up|later check after care
referral|sending a patient to another specialist
discharge|release from hospital care
admission|entry into hospital care
allergy|harmful reaction to a substance
side effect|unwanted effect of treatment
dose|single amount of medicine
antibiotic|medicine used against bacterial infection
analgesic|medicine used to reduce pain
sedation|medicine-induced calm or sleepiness
anesthesia|loss of feeling for a procedure
wound|injury where skin is damaged
fracture|broken bone
sprain|injury to a joint ligament
bruise|dark mark from bleeding under skin
rash|area of irritated skin
dehydration|too little water in the body
nutrition|food and nourishment
diet|usual food pattern
mobility|ability to move
therapy|treatment to improve a condition
physical therapy|exercise-based rehabilitation
mental health|emotional and psychological wellbeing
anxiety|strong worry or fear
depression|persistent low mood
sleep|resting state of body and mind
research|systematic study to answer questions
trial|planned study of a treatment
participant|person taking part in a study
consent|permission given after explanation
data|recorded information
analysis|careful study of data
evidence|information supporting a conclusion
measurement|act or result of measuring
observation|noticing and recording something
protocol|planned method for a study or treatment
outcome|measured result after care or study
`),
    texts: [
      text("enmed_symptoms", "Describing symptoms", "The patient reports a {cough}, mild fever, and unusual {fatigue}. The doctor asks when the symptoms began and whether the pain is {acute} or chronic.", "The patient reports a cough, mild fever, and unusual fatigue. The doctor asks when the symptoms began and whether the pain is acute or chronic."),
      text("enmed_admission", "Hospital admission", "During hospital {admission}, a nurse checks blood pressure, pulse, temperature, and {breathing}. The information is recorded before the patient goes to the ward.", "During hospital admission, a nurse checks blood pressure, pulse, temperature, and breathing. The information is recorded before the patient goes to the ward."),
      text("enmed_medication", "Taking medication", "The prescription says to take one {tablet} twice a day. The pharmacist explains the dosage and mentions possible {side} effects.", "The prescription says to take one tablet twice a day. The pharmacist explains the dosage and mentions possible side effects."),
      text("enmed_lab", "Blood test", "A small blood {sample} is sent to the laboratory. The result is compared with the normal {range} and discussed at the next appointment.", "A small blood sample is sent to the laboratory. The result is compared with the normal range and discussed at the next appointment."),
      text("enmed_appointment", "Medical appointment", "At the clinic, the doctor performs an {examination}, reviews the test results, and suggests a simple treatment {plan}.", "At the clinic, the doctor performs an examination, reviews the test results, and suggests a simple treatment plan."),
      text("enmed_recovery", "Recovery", "After the procedure, recovery is slow but steady. The patient monitors the {wound}, rests, drinks water, and attends a {follow-up} visit.", "After the procedure, recovery is slow but steady. The patient monitors the wound, rests, drinks water, and attends a follow-up visit."),
      text("enmed_research", "Research experiment", "The research team follows a clear {protocol}. Each participant gives consent, and the data are stored for later {analysis}.", "The research team follows a clear protocol. Each participant gives consent, and the data are stored for later analysis."),
      text("enmed_summary", "Clinical summary", "The clinical summary lists the diagnosis, current medication, allergies, and main {risk} factors. It also describes the expected {outcome}.", "The clinical summary lists the diagnosis, current medication, allergies, and main risk factors. It also describes the expected outcome."),
    ],
    forms: englishForms("enmed", [
      ["derivation", "diagnose → ___", "", "diagnosis", "", "noun form"],
      ["derivation", "treat → treat___", "treat", "ment", "", "noun form"],
      ["derivation", "recover → recover___", "recover", "y", "", "noun form"],
      ["derivation", "infect → infect___", "infect", "ion", "", "noun form"],
      ["derivation", "inflame → inflamm___", "inflamm", "ation", "", "noun form"],
      ["derivation", "analyse → analys___", "analys", "is", "", "noun form"],
      ["derivation", "observe → observ___", "observ", "ation", "", "noun form"],
      ["derivation", "measure → measure___", "measure", "ment", "", "noun form"],
      ["derivation", "prevent → prevent___", "prevent", "ion", "", "noun form"],
      ["derivation", "monitor → monitor___", "monitor", "ing", "", "gerund noun"],
      ["plural", "one diagnosis, two diagnos___", "diagnos", "es", "", "diagnosis → diagnoses"],
      ["plural", "one analysis, two analys___", "analys", "es", "", "analysis → analyses"],
      ["plural", "one criterion, two criter___", "criter", "ia", "", "criterion → criteria"],
      ["plural", "one datum, many ___", "", "data", "", "datum → data"],
      ["plural", "one sample, two sample___", "sample", "s", "", "regular plural"],
      ["plural", "one study, two stud___", "stud", "ies", "", "study → studies"],
      ["adjective", "a chron___ condition", "a chron", "ic", " condition", "chronic condition"],
      ["adjective", "an ac___ infection", "an ac", "ute", " infection", "acute infection"],
      ["adjective", "a norm___ result", "a norm", "al", " result", "normal result"],
      ["adjective", "a clinic___ trial", "a clinic", "al", " trial", "clinical trial"],
      ["verb", "The doctor diagnos___ the condition", "The doctor diagnos", "es", " the condition", "third-person singular"],
      ["verb", "The nurse monitor___ the patient", "The nurse monitor", "s", " the patient", "third-person singular"],
      ["verb", "The medicine reduc___ pain", "The medicine reduc", "es", " pain", "reduce → reduces"],
      ["past", "The patient recover___", "The patient recover", "ed", "", "regular past"],
      ["past", "The sample arriv___", "The sample arriv", "ed", "", "arrive → arrived"],
      ["past", "The wound heal___", "The wound heal", "ed", "", "regular past"],
      ["participle", "The test has confirm___ it", "The test has confirm", "ed", " it", "past participle"],
      ["participle", "The result was record___", "The result was record", "ed", "", "passive participle"],
      ["participle", "The patient was treat___", "The patient was treat", "ed", "", "passive participle"],
      ["noun", "prescribe → prescript___", "prescript", "ion", "", "noun form"],
      ["noun", "admit → admiss___", "admiss", "ion", "", "hospital admission"],
      ["noun", "refer → referr___", "referr", "al", "", "noun form"],
      ["noun", "inject → inject___", "inject", "ion", "", "noun form"],
      ["noun", "vaccinate → vaccinat___", "vaccinat", "ion", "", "noun form"],
      ["noun", "allergic → allerg___", "allerg", "y", "", "related noun"],
      ["comparison", "high risk → high___ risk", "high", "er", " risk", "comparative"],
      ["comparison", "low dose → low___ dose", "low", "er", " dose", "comparative"],
      ["comparison", "safe → saf___", "saf", "er", "", "comparative spelling"],
      ["preposition", "allergic ___ penicillin", "allergic ", "to", " penicillin", "common preposition"],
      ["preposition", "treated ___ antibiotics", "treated ", "with", " antibiotics", "treatment preposition"],
      ["preposition", "admitted ___ hospital", "admitted ", "to", " hospital", "movement/admission"],
      ["preposition", "recovery ___ surgery", "recovery ", "after", " surgery", "time relation"],
      ["preposition", "risk ___ infection", "risk ", "of", " infection", "noun complement"],
      ["phrase", "blood ___", "blood ", "pressure", "", "common clinical measure"],
      ["phrase", "side ___", "side ", "effect", "", "unwanted treatment effect"],
      ["phrase", "follow-___", "follow-", "up", "", "later medical visit"],
      ["phrase", "normal ___", "normal ", "range", "", "expected interval"],
      ["phrase", "clinical ___", "clinical ", "trial", "", "research study"],
      ["phrase", "informed ___", "informed ", "consent", "", "research permission"],
      ["phrase", "physical ___", "physical ", "therapy", "", "rehabilitation"],
    ]),
  },
  "english-literature-starter": {
    words: words("enlit", `
behold|to look at or see
hence|from this time or place
scarcely|almost not
sorrow|deep sadness
dwelling|a home or place of residence
peculiar|strange or distinctive
countenance|face or facial expression
virtue|moral goodness
folly|lack of good sense
solemn|serious and formal
wretched|very unhappy or unfortunate
endeavour|serious attempt
presently|soon or after a short time
nevertheless|despite that
acquaintance|person known but not close
fortune|luck or wealth
ought|should
indeed|truly or certainly
thus|in this way
therefore|for that reason
whereas|while in contrast
among|in the middle of several
beneath|under
beyond|farther than
within|inside
without|lacking or outside
upon|on
whilst|while
though|although
lest|to avoid the risk that
amid|among or surrounded by
ere|before
hither|to this place
thither|to that place
yonder|over there
vow|serious promise
grief|deep sadness
delight|great pleasure
dread|fear
wrath|anger
mercy|kind forgiveness
honour|high respect
shame|painful feeling of disgrace
pride|self-respect or arrogance
humble|modest or low in rank
noble|morally fine or high-born
gentle|kind or mild
fair|beautiful or just
grave|serious
fierce|violent or intense
weary|very tired
silent|without sound
lonely|alone and sad
ancient|very old
distant|far away
strange|unfamiliar
bright|full of light
dim|not bright
swift|quick
idle|not working
vain|useless or excessively proud
faint|weak or unclear
dear|loved or costly
poor|having little money
rich|having much wealth
servant|person employed to serve
master|person in authority
guest|visitor received at a place
host|person receiving guests
traveller|person on a journey
stranger|unknown person
neighbour|person living nearby
widow|woman whose spouse has died
heir|person who receives inheritance
letter|written message
estate|large property or land
inheritance|property received after death
village|small settlement
path|small road or track
hearth|fireplace area in a home
chamber|room
threshold|entrance or doorway
curtain|hanging cloth by a window
portrait|painted or photographed likeness
candle|wax light with a flame
storm|violent weather
mist|thin fog
shadow|dark shape made by blocked light
whisper|quiet speech
rumour|unconfirmed story
secret|hidden information
promise|statement that one will do something
choice|act of deciding
ambition|strong desire to succeed
fate|power or events beyond control
memory|something remembered
`),
    texts: [
      text("enlit_old_house", "The old house", "At dusk the {traveller} reached an old dwelling beyond the village. A dim {candle} burned in the window, and the door opened presently.", "At dusk the traveller reached an old home beyond the village. A dim candle burned in the window, and the door opened soon."),
      text("enlit_dinner", "A formal dinner", "The guests spoke with solemn courtesy, yet each {countenance} showed a different thought. Nevertheless, the host maintained a gentle {smile}.", "The guests spoke very politely, but each face showed a different thought. Still, the host kept a gentle smile."),
      text("enlit_letter", "An unexpected letter", "A letter arrived at noon and brought strange {news}. It spoke of an inheritance, a distant estate, and a promise made long {ago}.", "A letter arrived at noon and brought strange news. It spoke of an inheritance, a distant estate, and an old promise."),
      text("enlit_village_walk", "Through the village", "She walked beneath ancient trees, past the quiet {hearths} of neighbours, and wondered whether fortune had changed her {path}.", "She walked under old trees, past the homes of neighbours, and wondered whether luck had changed her path."),
      text("enlit_argument", "Between acquaintances", "The argument began as a small matter of {honour}. Soon pride overcame mercy, and neither acquaintance would speak the simple {truth}.", "The argument began as a small matter of honour. Soon pride overcame mercy, and neither person would speak the simple truth."),
      text("enlit_storm", "Storm at night", "The storm grew fierce after midnight. Rain struck the threshold, shadows moved upon the wall, and a lonely {whisper} crossed the chamber.", "The storm became strong after midnight. Rain hit the doorway, shadows moved on the wall, and a lonely whisper crossed the room."),
      text("enlit_abroad", "News from abroad", "News from abroad altered the family's hopes. The heir was alive, the estate was safe, and sorrow turned almost at once to {delight}.", "News from another country changed the family's hopes. The heir was alive, the property was safe, and sadness quickly became joy."),
      text("enlit_ambition", "Ambition", "Ambition may lift a person beyond fear, but without virtue it becomes vain. Thus a noble endeavour can become mere {folly}.", "Ambition may help a person overcome fear, but without moral goodness it becomes empty. In this way a noble effort can become foolishness."),
    ],
    forms: englishForms("enlit", [
      ["past", "behold → beheld", "", "beheld", "", "past of behold"],
      ["past", "write → wrote", "", "wrote", "", "past of write"],
      ["past", "speak → spoke", "", "spoke", "", "past of speak"],
      ["past", "rise → rose", "", "rose", "", "past of rise"],
      ["past", "fall → fell", "", "fell", "", "past of fall"],
      ["past", "come → came", "", "came", "", "past of come"],
      ["past", "go → went", "", "went", "", "past of go"],
      ["participle", "write → written", "", "written", "", "past participle"],
      ["participle", "speak → spoken", "", "spoken", "", "past participle"],
      ["participle", "break → broken", "", "broken", "", "past participle"],
      ["plural", "one gentleman, two ___", "", "gentlemen", "", "irregular plural"],
      ["plural", "one lady, two lad___", "lad", "ies", "", "lady → ladies"],
      ["plural", "one story, two stor___", "stor", "ies", "", "story → stories"],
      ["plural", "one wish, two wish___", "wish", "es", "", "wish → wishes"],
      ["derivation", "solemn → solemn___", "solemn", "ity", "", "noun form"],
      ["derivation", "virtuous → virtu___", "virtu", "e", "", "related noun"],
      ["derivation", "peculiar → peculiar___", "peculiar", "ity", "", "noun form"],
      ["derivation", "noble → nobil___", "nobil", "ity", "", "noun form"],
      ["derivation", "humble → humil___", "humil", "ity", "", "noun form"],
      ["derivation", "acquaint → acquaint___", "acquaint", "ance", "", "noun form"],
      ["adverb", "solemn → solemn___", "solemn", "ly", "", "adverb form"],
      ["adverb", "gentle → gent___", "gent", "ly", "", "adverb form"],
      ["adverb", "fierce → fierce___", "fierce", "ly", "", "adverb form"],
      ["adverb", "scarcely → scarce___", "scarce", "ly", "", "adverb spelling"],
      ["comparative", "bright → bright___", "bright", "er", "", "comparative"],
      ["comparative", "strange → strang___", "strang", "er", "", "drop final e"],
      ["comparative", "weary → wear___", "wear", "ier", "", "y → ier"],
      ["superlative", "noble → nobl___", "nobl", "est", "", "superlative"],
      ["superlative", "fair → fair___", "fair", "est", "", "superlative"],
      ["phrase", "___ the storm, he waited", "", "Amid", " the storm, he waited", "literary preposition"],
      ["phrase", "___ the door stood a guest", "", "Upon", " the door stood a guest", "formal/literary preposition"],
      ["phrase", "___ he leave, she spoke", "", "Ere", " he leave, she spoke", "older before"],
      ["phrase", "He came ___", "He came ", "hither", "", "to this place"],
      ["phrase", "She went ___", "She went ", "thither", "", "to that place"],
      ["phrase", "The house ___", "The house ", "yonder", "", "over there"],
      ["modal", "You ___ tell the truth", "You ", "ought", " tell the truth", "ought as duty"],
      ["connector", "He was tired; ___, he continued", "He was tired; ", "nevertheless", ", he continued", "contrast connector"],
      ["connector", "She was honest; ___ she was trusted", "She was honest; ", "therefore", " she was trusted", "result connector"],
      ["connector", "He spoke softly; ___, all listened", "He spoke softly; ", "indeed", ", all listened", "emphasis"],
      ["noun", "endeavour → endeavour___", "endeavour", "s", "", "plural"],
      ["noun", "fortune → fortune___", "fortune", "s", "", "plural"],
      ["noun", "virtue → virtue___", "virtue", "s", "", "plural"],
      ["noun", "dwelling → dwelling___", "dwelling", "s", "", "plural"],
      ["possessive", "the traveller ___ cloak", "the traveller", "'s", " cloak", "possessive"],
      ["possessive", "the widow ___ letter", "the widow", "'s", " letter", "possessive"],
      ["past", "seek → sought", "", "sought", "", "past of seek"],
      ["past", "bring → brought", "", "brought", "", "past of bring"],
      ["past", "think → thought", "", "thought", "", "past of think"],
      ["past", "weep → wept", "", "wept", "", "past of weep"],
      ["past", "hear → heard", "", "heard", "", "past of hear"],
    ]),
  },
};

packData["german-starter"] = {
  words: words("de", `
das Haus|house
die Wohnung|apartment
die Küche|kitchen
das Zimmer|room
die Tür|door
das Fenster|window
der Tisch|table
der Stuhl|chair
das Bett|bed
die Lampe|lamp
das Wasser|water
das Brot|bread
der Käse|cheese
der Apfel|apple
die Banane|banana
der Kaffee|coffee
der Tee|tea
das Frühstück|breakfast
das Mittagessen|lunch
das Abendessen|dinner
der Laden|shop
der Markt|market
das Geld|money
der Preis|price
die Karte|ticket or card
der Zug|train
der Bus|bus
der Bahnhof|train station
der Flughafen|airport
die Straße|street
die Stadt|city
das Dorf|village
links|left
rechts|right
nah|near
weit|far
heute|today
morgen|tomorrow
gestern|yesterday
der Morgen|morning
der Abend|evening
die Nacht|night
die Woche|week
der Monat|month
das Jahr|year
das Wetter|weather
der Regen|rain
der Wind|wind
die Sonne|sun
kalt|cold
warm|warm
der Mensch|person
der Freund|friend
die Familie|family
das Kind|child
der Lehrer|teacher
der Arzt|doctor
der Arbeiter|worker
der Student|student
glücklich|happy
traurig|sad
müde|tired
beschäftigt|busy
bereit|ready
wichtig|important
einfach|easy
schwierig|difficult
neu|new
alt|old
gut|good
schlecht|bad
klein|small
groß|big
sein|to be
haben|to have
gehen|to go
kommen|to come
machen|to make or do
sehen|to see
sagen|to say
wissen|to know a fact
wollen|to want
brauchen|to need
essen|to eat
trinken|to drink
kaufen|to buy
arbeiten|to work
lernen|to learn
sprechen|to speak
lesen|to read
schreiben|to write
fahren|to travel by vehicle
warten|to wait
weil|because
aber|but
auch|also
vielleicht|maybe
immer|always
oft|often
manchmal|sometimes
nie|never
`),
  texts: [
    text("de_morgen", "Morgenroutine", "Am {Morgen} trinke ich Kaffee und esse Brot mit Käse. Danach gehe ich zur {Arbeit} und lese meine Nachrichten.", "In the morning I drink coffee and eat bread with cheese. Then I go to work and read my messages."),
    text("de_cafe", "Im Café", "Im Café bestelle ich einen {Kaffee} und ein kleines Stück Kuchen. Meine Freundin kommt später und wir {sprechen} über das Wochenende.", "In the café I order a coffee and a small piece of cake. My friend comes later and we talk about the weekend."),
    text("de_zug", "Mit dem Zug", "Der {Zug} fährt um acht Uhr vom Bahnhof ab. Ich kaufe eine Karte und suche einen Platz am {Fenster}.", "The train leaves the station at eight. I buy a ticket and look for a seat by the window."),
    text("de_arbeit", "Bei der Arbeit", "Bei der {Arbeit} habe ich zwei kurze Besprechungen. Danach schreibe ich einen Bericht und beantworte wichtige {Fragen}.", "At work I have two short meetings. Then I write a report and answer important questions."),
    text("de_wohnung", "Die Wohnung", "Meine {Wohnung} ist klein, aber hell. Die Küche ist neben dem Zimmer, und der Tisch steht am {Fenster}.", "My apartment is small but bright. The kitchen is next to the room, and the table is by the window."),
    text("de_wochenende", "Wochenende", "Am Wochenende wollen wir in die {Stadt} fahren. Wenn das Wetter gut ist, besuchen wir den Markt und essen draußen.", "On the weekend we want to go to the city. If the weather is good, we visit the market and eat outside."),
    text("de_supermarkt", "Im Supermarkt", "Im Supermarkt kaufe ich Wasser, Äpfel und {Brot}. Der Preis ist gut, und die Verkäuferin ist sehr freundlich.", "In the supermarket I buy water, apples, and bread. The price is good, and the saleswoman is very friendly."),
    text("de_besuch", "Besuch", "Heute besuche ich einen {Freund}. Er wohnt weit weg, deshalb fahre ich mit dem Bus und bringe etwas zu essen mit.", "Today I visit a friend. He lives far away, so I go by bus and bring something to eat."),
    text("de_wetter", "Wetter", "Das {Wetter} ist heute kalt und windig. Trotzdem gehe ich zu Fuß, weil der Weg kurz ist und die Sonne scheint.", "The weather is cold and windy today. Still I walk, because the way is short and the sun is shining."),
    text("de_reise", "Reiseplanung", "Für die {Reise} brauche ich einen Pass, eine Karte und eine Adresse. Morgen rufe ich das Hotel an.", "For the trip I need a passport, a ticket, and an address. Tomorrow I call the hotel."),
  ],
  forms: [
    ...["Haus|Häuser", "Buch|Bücher", "Kind|Kinder", "Stadt|Städte", "Dorf|Dörfer", "Apfel|Äpfel", "Mann|Männer", "Frau|Frauen", "Zimmer|Zimmer", "Fenster|Fenster", "Tisch|Tische", "Stuhl|Stühle", "Zug|Züge", "Bus|Busse", "Tag|Tage"].map((pair) => {
      const [sg, pl] = pair.split("|");
      const stem = pl.slice(0, Math.max(1, pl.length - 2));
      const answer = pl.slice(stem.length);
      return form("de", "plural", `${sg} plural`, stem, answer, "", `${sg} → ${pl}`);
    }),
    ...[
      ["Der Mann ist hier.", "", "Der", " Mann ist hier.", "masculine nominative"],
      ["Ich sehe den Mann.", "Ich sehe ", "den", " Mann.", "masculine accusative"],
      ["Ich helfe dem Mann.", "Ich helfe ", "dem", " Mann.", "masculine dative"],
      ["Die Frau ist hier.", "", "Die", " Frau ist hier.", "feminine nominative"],
      ["Ich sehe die Frau.", "Ich sehe ", "die", " Frau.", "feminine accusative"],
      ["Ich helfe der Frau.", "Ich helfe ", "der", " Frau.", "feminine dative"],
      ["Das Kind ist hier.", "", "Das", " Kind ist hier.", "neuter nominative"],
      ["Ich sehe das Kind.", "Ich sehe ", "das", " Kind.", "neuter accusative"],
      ["Ich helfe dem Kind.", "Ich helfe ", "dem", " Kind.", "neuter dative"],
    ].map(([prompt, before, answer, after, note]) => {
      return form("de", "article", prompt, before, answer, after, note);
    }),
    ...[
      ["gehen", "ich geh", "e", "", "I go"], ["gehen", "du geh", "st", "", "you go"], ["gehen", "er geh", "t", "", "he goes"], ["gehen", "wir geh", "en", "", "we go"],
      ["haben", "ich hab", "e", "", "I have"], ["haben", "du ha", "st", "", "you have"], ["haben", "er ha", "t", "", "he has"], ["haben", "wir hab", "en", "", "we have"],
      ["sein", "ich ", "bin", "", "I am"], ["sein", "du ", "bist", "", "you are"], ["sein", "er ", "ist", "", "he is"], ["sein", "wir ", "sind", "", "we are"],
      ["sprechen", "ich sprech", "e", "", "I speak"], ["sprechen", "du sprich", "st", "", "you speak"], ["sprechen", "er sprich", "t", "", "he speaks"], ["sprechen", "wir sprech", "en", "", "we speak"],
      ["essen", "ich ess", "e", "", "I eat"], ["essen", "du iss", "t", "", "you eat"], ["essen", "er iss", "t", "", "he eats"], ["essen", "wir ess", "en", "", "we eat"],
      ["fahren", "ich fahr", "e", "", "I travel"], ["fahren", "du fähr", "st", "", "you travel"], ["fahren", "er fähr", "t", "", "he travels"], ["fahren", "wir fahr", "en", "", "we travel"],
    ].map(([verb, before, answer, after, prompt]) => form("de", "conjugation", prompt, before, answer, after, `present tense of ${verb}`)),
    ...["ein guter Mann|ein guter Mann|gut masculine nominative", "eine gute Frau|eine gute Frau|gut feminine nominative", "ein gutes Kind|ein gutes Kind|gut neuter nominative", "den guten Mann|den guten Mann|accusative adjective", "mit einem guten Freund|mit einem guten Freund|dative adjective", "eine kleine Stadt|eine kleine Stadt|klein feminine", "ein kleines Dorf|ein kleines Dorf|klein neuter", "die großen Häuser|die großen Häuser|plural adjective", "ein alter Bahnhof|ein alter Bahnhof|alt masculine", "eine neue Wohnung|eine neue Wohnung|neu feminine"].map((entry) => {
      const [phrase, result, note] = entry.split("|");
      const answer = result.match(/[A-Za-zÄÖÜäöüß]+(?=\s[A-Za-zÄÖÜäöüß]+$)/)?.[0] ?? "";
      const before = result.slice(0, result.indexOf(answer));
      const after = result.slice(result.indexOf(answer) + answer.length);
      return form("de", "agreement", phrase, before, answer, after, note);
    }),
  ],
};

packData["french-starter"] = {
  words: words("fr", `
la maison|house
l'appartement|apartment
la cuisine|kitchen
la chambre|bedroom
la porte|door
la fenêtre|window
la table|table
la chaise|chair
le lit|bed
la lampe|lamp
l'eau|water
le pain|bread
le fromage|cheese
la pomme|apple
la banane|banana
le café|coffee
le thé|tea
le petit déjeuner|breakfast
le déjeuner|lunch
le dîner|dinner
le magasin|shop
le marché|market
l'argent|money
le prix|price
le billet|ticket
le train|train
le bus|bus
la gare|train station
l'aéroport|airport
la rue|street
la ville|city
le village|village
à gauche|to the left
à droite|to the right
près|near
loin|far
aujourd'hui|today
demain|tomorrow
hier|yesterday
le matin|morning
le soir|evening
la nuit|night
la semaine|week
le mois|month
l'année|year
le temps|weather
la pluie|rain
le vent|wind
le soleil|sun
froid|cold
chaud|warm
la personne|person
l'ami|friend
la famille|family
l'enfant|child
le professeur|teacher
le médecin|doctor
le travailleur|worker
l'étudiant|student
heureux|happy
triste|sad
fatigué|tired
occupé|busy
prêt|ready
important|important
facile|easy
difficile|difficult
nouveau|new
vieux|old
bon|good
mauvais|bad
petit|small
grand|big
être|to be
avoir|to have
aller|to go
venir|to come
faire|to make or do
voir|to see
dire|to say
savoir|to know a fact
vouloir|to want
avoir besoin de|to need
manger|to eat
boire|to drink
acheter|to buy
travailler|to work
apprendre|to learn
parler|to speak
lire|to read
écrire|to write
prendre|to take
attendre|to wait
parce que|because
mais|but
aussi|also
peut-être|maybe
toujours|always
souvent|often
parfois|sometimes
jamais|never
`),
  texts: [
    text("fr_cafe", "Au café", "Au {café}, je prends un thé et un morceau de pain. Mon ami arrive bientôt, et nous parlons du {week-end}.", "At the café, I have tea and a piece of bread. My friend arrives soon, and we talk about the weekend."),
    text("fr_matin", "Le matin", "Le {matin}, je me lève tôt. Je prépare le petit déjeuner, j'ouvre la fenêtre et je regarde le {temps}.", "In the morning, I get up early. I prepare breakfast, open the window, and look at the weather."),
    text("fr_travail", "Au travail", "Au {travail}, j'écris des messages et je participe à une réunion. La journée est chargée mais utile.", "At work, I write messages and take part in a meeting. The day is busy but useful."),
    text("fr_train", "Le train", "Je prends le {train} à la gare. Le billet est dans mon sac, et la place près de la fenêtre est libre.", "I take the train at the station. The ticket is in my bag, and the seat by the window is free."),
    text("fr_courses", "Les courses", "Au marché, nous achetons des pommes, du fromage et de l'eau. Le {prix} est raisonnable aujourd'hui.", "At the market, we buy apples, cheese, and water. The price is reasonable today."),
    text("fr_famille", "Visite", "Ce soir, je visite ma {famille}. Nous préparons le dîner ensemble et nous parlons des nouvelles de la semaine.", "Tonight I visit my family. We prepare dinner together and talk about the week's news."),
    text("fr_appartement", "Appartement", "Mon {appartement} est petit mais agréable. La cuisine est claire, et la table est près de la fenêtre.", "My apartment is small but pleasant. The kitchen is bright, and the table is near the window."),
    text("fr_meteo", "Météo", "Aujourd'hui le {temps} est froid. Il y a du vent, mais le soleil apparaît dans l'après-midi.", "Today the weather is cold. There is wind, but the sun appears in the afternoon."),
    text("fr_vacances", "Vacances", "Pendant les {vacances}, nous voulons visiter une ville au bord de la mer et apprendre quelques mots nouveaux.", "During the holidays, we want to visit a city by the sea and learn some new words."),
    text("fr_cuisine", "Cuisine", "Dans la {cuisine}, je coupe des légumes et je prépare du riz. Le dîner est simple, chaud et bon.", "In the kitchen, I cut vegetables and prepare rice. Dinner is simple, warm, and good."),
  ],
  forms: [
    ...["petit|petite|a small house|une maison ", "grand|grande|a big room|une chambre ", "bon|bonne|a good idea|une idée ", "heureux|heureuse|a happy woman|une femme ", "nouveau|nouvelle|a new apartment|un appartement ", "vieux|vieille|an old house|une maison ", "français|française|a French friend|une amie ", "blanc|blanche|a white door|une porte "].map(([m, f, prompt, before]) => form("fr", "agreement", prompt, before, f, "", `${m} feminine`)),
    ...["maison|maisons", "livre|livres", "ville|villes", "travail|travaux", "journal|journaux", "animal|animaux", "enfant|enfants", "prix|prix", "choix|choix", "nez|nez"].map((pair) => {
      const [sg, pl] = pair.split("|");
      return form("fr", "plural", `${sg} plural`, "", pl, "", `${sg} → ${pl}`);
    }),
    ...[
      ["parler", "je parl", "e", "", "I speak"], ["parler", "nous parl", "ons", "", "we speak"], ["manger", "je mang", "e", "", "I eat"], ["manger", "nous mange", "ons", "", "we eat"],
      ["travailler", "je travaill", "e", "", "I work"], ["travailler", "nous travaill", "ons", "", "we work"], ["finir", "je fin", "is", "", "I finish"], ["finir", "nous fin", "issons", "", "we finish"],
      ["avoir", "j'", "ai", "", "I have"], ["avoir", "nous av", "ons", "", "we have"], ["être", "je ", "suis", "", "I am"], ["être", "nous ", "sommes", "", "we are"],
      ["aller", "je ", "vais", "", "I go"], ["aller", "nous ", "allons", "", "we go"], ["faire", "je ", "fais", "", "I do"], ["faire", "nous ", "faisons", "", "we do"],
      ["prendre", "je prend", "s", "", "I take"], ["prendre", "nous pren", "ons", "", "we take"], ["venir", "je vien", "s", "", "I come"], ["venir", "nous ven", "ons", "", "we come"],
    ].map(([verb, before, answer, after, prompt]) => form("fr", "conjugation", prompt, before, answer, after, verb)),
    ...[
      ["à + le marché", "au", " marché", "contraction à + le"], ["à + les amis", "aux", " amis", "contraction à + les"], ["de + le café", "du", " café", "contraction de + le"], ["de + les enfants", "des", " enfants", "contraction de + les"],
      ["the books", "les", " livres", "plural article"], ["the house", "la", " maison", "feminine article"], ["a friend", "un", " ami", "masculine indefinite"], ["a city", "une", " ville", "feminine indefinite"],
      ["some water", "de l'", "eau", "partitive before vowel"], ["some bread", "du", " pain", "partitive masculine"],
    ].map(([prompt, answer, after, note]) => form("fr", "article", prompt, "", answer, after, note)),
    ...[
      ["I went", "je suis ", "allé", "", "aller uses être"], ["I came", "je suis ", "venu", "", "venir uses être"], ["I worked", "j'ai ", "travaillé", "", "regular past participle"], ["I ate", "j'ai ", "mangé", "", "regular past participle"], ["I took", "j'ai ", "pris", "", "irregular participle"], ["I did", "j'ai ", "fait", "", "irregular participle"], ["I read", "j'ai ", "lu", "", "irregular participle"], ["I wrote", "j'ai ", "écrit", "", "irregular participle"],
    ].map(([prompt, before, answer, after, note]) => form("fr", "past", prompt, before, answer, after, note)),
  ],
};

packData["polish-starter"] = {
  words: words("pl", `
dom|house
mieszkanie|apartment
kuchnia|kitchen
pokój|room
drzwi|door
okno|window
stół|table
krzesło|chair
łóżko|bed
lampa|lamp
woda|water
chleb|bread
ser|cheese
jabłko|apple
banan|banana
kawa|coffee
herbata|tea
śniadanie|breakfast
obiad|lunch or dinner
kolacja|evening meal
sklep|shop
rynek|market
pieniądze|money
cena|price
bilet|ticket
pociąg|train
autobus|bus
dworzec|station
lotnisko|airport
ulica|street
miasto|city
wieś|village
w lewo|to the left
w prawo|to the right
blisko|near
daleko|far
dzisiaj|today
jutro|tomorrow
wczoraj|yesterday
rano|in the morning
wieczór|evening
noc|night
tydzień|week
miesiąc|month
rok|year
pogoda|weather
deszcz|rain
wiatr|wind
słońce|sun
zimny|cold
ciepły|warm
osoba|person
przyjaciel|friend
rodzina|family
dziecko|child
nauczyciel|teacher
lekarz|doctor
pracownik|worker
student|student
szczęśliwy|happy
smutny|sad
zmęczony|tired
zajęty|busy
gotowy|ready
ważny|important
łatwy|easy
trudny|difficult
nowy|new
stary|old
dobry|good
zły|bad
mały|small
duży|big
być|to be
mieć|to have
iść|to go on foot
jechać|to go by vehicle
przyjść|to come
robić|to do or make
widzieć|to see
mówić|to speak
wiedzieć|to know a fact
chcieć|to want
potrzebować|to need
jeść|to eat
pić|to drink
kupić|to buy
pracować|to work
uczyć się|to learn
czytać|to read
pisać|to write
czekać|to wait
rozumieć|to understand
bo|because
ale|but
też|also
może|maybe
zawsze|always
często|often
czasami|sometimes
nigdy|never
`),
  texts: [
    text("pl_rano", "Rano", "Rano piję {kawę} i jem chleb z serem. Potem idę do pracy i sprawdzam wiadomości.", "In the morning I drink coffee and eat bread with cheese. Then I go to work and check messages."),
    text("pl_zakupy", "Zakupy", "W sklepie kupuję wodę, jabłka i {chleb}. Cena jest dobra, więc płacę kartą.", "In the shop I buy water, apples, and bread. The price is good, so I pay by card."),
    text("pl_praca", "Praca", "W pracy mam krótkie spotkanie. Piszę dokument, czytam {pytania} i odpowiadam spokojnie.", "At work I have a short meeting. I write a document, read questions, and answer calmly."),
    text("pl_kawiarnia", "Kawiarnia", "W kawiarni spotykam {przyjaciela}. Zamawiamy herbatę i rozmawiamy o weekendzie.", "In the café I meet a friend. We order tea and talk about the weekend."),
    text("pl_pociag", "Pociąg", "Pociąg odjeżdża z dworca o ósmej. Mam {bilet} i miejsce przy oknie.", "The train leaves the station at eight. I have a ticket and a seat by the window."),
    text("pl_dom", "Dom", "Moje mieszkanie jest małe, ale wygodne. Kuchnia jest jasna, a stół stoi przy {oknie}.", "My apartment is small but comfortable. The kitchen is bright, and the table stands by the window."),
    text("pl_rodzina", "Rodzina", "Wieczorem odwiedzam rodzinę. Razem gotujemy kolację i mówimy o planach na {jutro}.", "In the evening I visit family. Together we cook dinner and talk about plans for tomorrow."),
    text("pl_miasto", "Miasto", "Miasto jest duże i głośne, ale lubię spacerować po małych ulicach blisko {rynku}.", "The city is large and noisy, but I like walking along small streets near the market."),
    text("pl_pogoda", "Pogoda", "Dzisiaj pogoda jest zimna. Pada {deszcz}, więc biorę parasol i ciepłą kurtkę.", "Today the weather is cold. It is raining, so I take an umbrella and a warm jacket."),
    text("pl_weekend", "Weekend", "W weekend chcemy jechać do innego miasta. Jeśli będzie słońce, odwiedzimy park i {muzeum}.", "On the weekend we want to go to another city. If it is sunny, we will visit a park and a museum."),
  ],
  forms: [
    ...["dom|domy", "pokój|pokoje", "stół|stoły", "krzesło|krzesła", "okno|okna", "miasto|miasta", "kobieta|kobiety", "mężczyzna|mężczyźni", "dziecko|dzieci", "człowiek|ludzie", "książka|książki", "pociąg|pociągi"].map((pair) => {
      const [sg, pl] = pair.split("|");
      return form("pl", "plural", `${sg} plural`, "", pl, "", `${sg} → ${pl}`);
    }),
    ...[
      ["I see a house", "Widzę ", "dom", "", "accusative masculine inanimate"],
      ["I see a woman", "Widzę kobiet", "ę", "", "accusative feminine"],
      ["I read a book", "Czytam książk", "ę", "", "accusative feminine"],
      ["I drink water", "Piję wod", "ę", "", "accusative feminine"],
      ["I am in the house", "Jestem w dom", "u", "", "locative"],
      ["I am in the city", "Jestem w mieści", "e", "", "locative"],
      ["I talk about work", "Mówię o prac", "y", "", "locative feminine"],
      ["I go to school", "Idę do szkoł", "y", "", "genitive after do"],
      ["I come from Poland", "Jestem z Polsk", "i", "", "genitive after z"],
      ["without water", "bez wod", "y", "", "genitive feminine"],
      ["with a friend", "z przyjaciel", "em", "", "instrumental masculine"],
      ["with family", "z rodzin", "ą", "", "instrumental feminine"],
    ].map(([prompt, before, answer, after, note]) => form("pl", "case", prompt, before, answer, after, note)),
    ...[
      ["good woman", "dobra kobieta", "dobra", " kobieta"], ["good man", "dobry mężczyzna", "dobry", " mężczyzna"], ["good child", "dobre dziecko", "dobre", " dziecko"],
      ["small house", "mały dom", "mały", " dom"], ["small room", "mały pokój", "mały", " pokój"], ["small city", "małe miasto", "małe", " miasto"],
      ["new book", "nowa książka", "nowa", " książka"], ["new table", "nowy stół", "nowy", " stół"], ["new window", "nowe okno", "nowe", " okno"],
      ["warm tea", "ciepła herbata", "ciepła", " herbata"], ["warm day", "ciepły dzień", "ciepły", " dzień"], ["warm milk", "ciepłe mleko", "ciepłe", " mleko"],
    ].map(([prompt, result, answer, after]) => form("pl", "agreement", prompt, "", answer, after, result)),
    ...[
      ["być", "ja jest", "em", "", "I am"], ["być", "ty jest", "eś", "", "you are"], ["być", "on ", "jest", "", "he is"], ["być", "my jest", "eśmy", "", "we are"],
      ["mieć", "ja m", "am", "", "I have"], ["mieć", "ty m", "asz", "", "you have"], ["mieć", "on m", "a", "", "he has"], ["mieć", "my m", "amy", "", "we have"],
      ["iść", "ja id", "ę", "", "I go"], ["iść", "ty idzi", "esz", "", "you go"], ["iść", "on idzi", "e", "", "he goes"], ["iść", "my idzi", "emy", "", "we go"],
      ["pracować", "ja pracuj", "ę", "", "I work"], ["pracować", "ty pracuj", "esz", "", "you work"], ["pracować", "on pracuj", "e", "", "he works"], ["pracować", "my pracuj", "emy", "", "we work"],
      ["mówić", "ja mów", "ię", "", "I speak"], ["mówić", "ty mów", "isz", "", "you speak"], ["mówić", "on mów", "i", "", "he speaks"], ["mówić", "my mów", "imy", "", "we speak"],
    ].map(([verb, before, answer, after, prompt]) => form("pl", "conjugation", prompt, before, answer, after, verb)),
    ...[
      ["I worked (male)", "pracowa", "łem", "", "masculine past"], ["I worked (female)", "pracowa", "łam", "", "feminine past"], ["he was", "on by", "ł", "", "masculine past"], ["she was", "ona by", "ła", "", "feminine past"],
    ].map(([prompt, before, answer, after, note]) => form("pl", "past", prompt, before, answer, after, note)),
  ],
};

packData["ukrainian-starter"] = {
  words: words("uk", `
дім|house
квартира|apartment
кухня|kitchen
кімната|room
двері|door
вікно|window
стіл|table
стілець|chair
ліжко|bed
лампа|lamp
вода|water
хліб|bread
сир|cheese
яблуко|apple
банан|banana
кава|coffee
чай|tea
сніданок|breakfast
обід|lunch
вечеря|dinner
магазин|shop
ринок|market
гроші|money
ціна|price
квиток|ticket
поїзд|train
автобус|bus
вокзал|station
аеропорт|airport
вулиця|street
місто|city
село|village
ліворуч|to the left
праворуч|to the right
близько|near
далеко|far
сьогодні|today
завтра|tomorrow
учора|yesterday
ранок|morning
вечір|evening
ніч|night
тиждень|week
місяць|month
рік|year
погода|weather
дощ|rain
вітер|wind
сонце|sun
холодний|cold
теплий|warm
людина|person
друг|friend
родина|family
дитина|child
учитель|teacher
лікар|doctor
працівник|worker
студент|student
щасливий|happy
сумний|sad
втомлений|tired
зайнятий|busy
готовий|ready
важливий|important
легкий|easy
важкий|difficult
новий|new
старий|old
добрий|good
поганий|bad
малий|small
великий|big
бути|to be
мати|to have
іти|to go on foot
їхати|to go by vehicle
прийти|to come
робити|to do or make
бачити|to see
казати|to say
знати|to know
хотіти|to want
потребувати|to need
їсти|to eat
пити|to drink
купити|to buy
працювати|to work
вчитися|to learn or study
говорити|to speak
читати|to read
писати|to write
чекати|to wait
тому що|because
але|but
також|also
можливо|maybe
завжди|always
часто|often
іноді|sometimes
ніколи|never
`),
  texts: [
    text("uk_ranok", "Ранок", "Вранці я п'ю {каву} і їм хліб із сиром. Потім іду на роботу і читаю повідомлення.", "In the morning I drink coffee and eat bread with cheese. Then I go to work and read messages."),
    text("uk_misto", "Місто", "Моє {місто} велике, але зручне. Біля дому є магазин, парк і зупинка автобуса.", "My city is large but convenient. Near the house there is a shop, a park, and a bus stop."),
    text("uk_transport", "Транспорт", "Я їду на роботу {автобусом}. Квиток у телефоні, а дорога займає двадцять хвилин.", "I go to work by bus. The ticket is on my phone, and the trip takes twenty minutes."),
    text("uk_robota", "Робота", "На {роботі} я маю зустріч, пишу документ і відповідаю на важливі питання.", "At work I have a meeting, write a document, and answer important questions."),
    text("uk_pokupky", "Покупки", "У магазині я купую воду, яблука і {хліб}. Ціна нормальна, і черга коротка.", "In the shop I buy water, apples, and bread. The price is normal, and the line is short."),
    text("uk_kafe", "Кафе", "У кафе я зустрічаю {друга}. Ми замовляємо чай і говоримо про плани на вихідні.", "In the café I meet a friend. We order tea and talk about weekend plans."),
    text("uk_dim", "Дім", "Моя квартира невелика, але світла. Стіл стоїть біля {вікна}, а кухня дуже зручна.", "My apartment is small but bright. The table stands near the window, and the kitchen is very convenient."),
    text("uk_zustrich", "Зустріч", "Сьогодні ввечері я зустрічаю знайому людину. Ми говоримо українською і повторюємо нові {слова}.", "This evening I meet someone I know. We speak Ukrainian and review new words."),
    text("uk_vyhidni", "Вихідні", "На вихідних ми хочемо піти в парк. Якщо буде {сонце}, візьмемо воду і трохи їжі.", "On the weekend we want to go to the park. If it is sunny, we will take water and some food."),
    text("uk_podorozh", "Подорож", "Завтра я їду в інше {місто}. Мені потрібні квиток, адреса і невелика сумка.", "Tomorrow I travel to another city. I need a ticket, an address, and a small bag."),
  ],
  forms: [
    ...["дім|доми", "місто|міста", "село|села", "вікно|вікна", "книга|книги", "дорога|дороги", "друг|друзі", "людина|люди", "дитина|діти", "стіл|столи", "стілець|стільці", "поїзд|поїзди"].map((pair) => {
      const [sg, pl] = pair.split("|");
      return form("uk", "plural", `${sg} plural`, "", pl, "", `${sg} → ${pl}`);
    }),
    ...[
      ["I see a house", "Я бачу ", "дім", "", "accusative inanimate"], ["I see a friend", "Я бачу друг", "а", "", "accusative animate"], ["I read a book", "Я читаю книг", "у", "", "accusative feminine"], ["I drink water", "Я п'ю вод", "у", "", "accusative feminine"],
      ["in the city", "у міст", "і", "", "locative"], ["in the house", "у дом", "і", "", "locative"], ["from Ukraine", "з Україн", "и", "", "genitive"], ["without water", "без вод", "и", "", "genitive"], ["with a friend", "з друг", "ом", "", "instrumental"], ["with family", "з родин", "ою", "", "instrumental feminine"],
    ].map(([prompt, before, answer, after, note]) => form("uk", "case", prompt, before, answer, after, note)),
    ...[
      ["good house", "добрий дім", "добрий", " дім"], ["good apartment", "добра квартира", "добра", " квартира"], ["good city", "добре місто", "добре", " місто"],
      ["new table", "новий стіл", "новий", " стіл"], ["new room", "нова кімната", "нова", " кімната"], ["new window", "нове вікно", "нове", " вікно"],
      ["big city", "велике місто", "велике", " місто"], ["big street", "велика вулиця", "велика", " вулиця"], ["big house", "великий дім", "великий", " дім"],
      ["warm tea", "теплий чай", "теплий", " чай"], ["warm water", "тепла вода", "тепла", " вода"], ["warm milk", "тепле молоко", "тепле", " молоко"],
    ].map(([prompt, result, answer, after]) => form("uk", "agreement", prompt, "", answer, after, result)),
    ...[
      ["бути", "я ", "є", "", "I am"], ["бути", "ми ", "є", "", "we are"], ["мати", "я ма", "ю", "", "I have"], ["мати", "ти ма", "єш", "", "you have"], ["мати", "він ма", "є", "", "he has"], ["мати", "ми ма", "ємо", "", "we have"],
      ["іти", "я ід", "у", "", "I go"], ["іти", "ти ід", "еш", "", "you go"], ["іти", "він ід", "е", "", "he goes"], ["іти", "ми ід", "емо", "", "we go"],
      ["працювати", "я працю", "ю", "", "I work"], ["працювати", "ти працю", "єш", "", "you work"], ["працювати", "він працю", "є", "", "he works"], ["працювати", "ми працю", "ємо", "", "we work"],
      ["говорити", "я говор", "ю", "", "I speak"], ["говорити", "ти говор", "иш", "", "you speak"], ["говорити", "він говор", "ить", "", "he speaks"], ["говорити", "ми говор", "имо", "", "we speak"],
      ["читати", "я чита", "ю", "", "I read"], ["читати", "ти чита", "єш", "", "you read"], ["читати", "він чита", "є", "", "he reads"], ["читати", "ми чита", "ємо", "", "we read"],
    ].map(([verb, before, answer, after, prompt]) => form("uk", "conjugation", prompt, before, answer, after, verb)),
    ...[
      ["I worked (male)", "я працюва", "в", "", "masculine past"], ["I worked (female)", "я працюва", "ла", "", "feminine past"], ["he was", "він бу", "в", "", "masculine past"], ["she was", "вона бу", "ла", "", "feminine past"],
    ].map(([prompt, before, answer, after, note]) => form("uk", "past", prompt, before, answer, after, note)),
  ],
};

packData["norwegian-bokmal-starter"] = {
  words: words("nb", `
hus|house
leilighet|apartment
kjøkken|kitchen
soverom|bedroom
bad|bathroom
vindu|window
dør|door
bord|table
stol|chair
seng|bed
lampe|lamp
telefon|phone
datamaskin|computer
veske|bag
lommebok|wallet
nøkkel|key
bok|book
papir|paper
penn|pen
vann|water
brød|bread
ris|rice
kjøtt|meat
fisk|fish
egg|egg
ost|cheese
eple|apple
banan|banana
kaffe|coffee
te|tea
frokost|breakfast
lunsj|lunch
middag|dinner
butikk|shop
marked|market
penger|money
pris|price
billett|ticket
tog|train
buss|bus
stasjon|station
flyplass|airport
gate|street
by|city
landsby|village
kart|map
venstre|left
høyre|right
nær|near
langt|far
i dag|today
i morgen|tomorrow
i går|yesterday
morgen|morning
ettermiddag|afternoon
kveld|evening
natt|night
uke|week
måned|month
år|year
vær|weather
regn|rain
vind|wind
sol|sun
kald|cold
varm|warm
person|person
venn|friend
familie|family
barn|child
lærer|teacher
lege|doctor
arbeider|worker
student|student
glad|happy
trist|sad
trøtt|tired
opptatt|busy
klar|ready
viktig|important
lett|easy
vanskelig|difficult
ny|new
gammel|old
god|good
dårlig|bad
liten|small
stor|large
å være|to be
å ha|to have
å gå|to walk or go
å komme|to come
å gjøre|to do or make
å se|to see
å si|to say
å vite|to know a fact
å kjenne|to know a person or place
å ville|to want
å trenge|to need
å spise|to eat
å drikke|to drink
å kjøpe|to buy
å arbeide|to work
å lære|to learn
å snakke|to speak
å lese|to read
å skrive|to write
fordi|because
men|but
også|also
kanskje|maybe
alltid|always
ofte|often
noen ganger|sometimes
aldri|never
`),
  texts: [
    text("nb_morgen", "Morgen", "Om morgenen drikker jeg {kaffe} og spiser brød med ost. Etterpå går jeg til {arbeid}.", "In the morning I drink coffee and eat bread with cheese. Afterwards I go to work."),
    text("nb_byen", "I byen", "Jeg bor i en {by} med mange butikker, en park og en liten stasjon. Huset mitt ligger nær sentrum.", "I live in a city with many shops, a park, and a small station. My house is near the centre."),
    text("nb_transport", "Transport", "Jeg tar {bussen} til universitetet. Billetten ligger på telefonen, og reisen tar tjue minutter.", "I take the bus to the university. The ticket is on the phone, and the trip takes twenty minutes."),
    text("nb_arbeid", "Arbeid", "På {arbeid} skriver jeg notater, leser meldinger og svarer på viktige spørsmål.", "At work I write notes, read messages, and answer important questions."),
    text("nb_butikk", "Butikk", "I butikken kjøper jeg vann, epler og {brød}. Prisen er grei, og køen er kort.", "In the shop I buy water, apples, and bread. The price is fine, and the queue is short."),
    text("nb_kafe", "Kafé", "På kafeen møter jeg en {venn}. Vi bestiller te og snakker om planer for helgen.", "At the café I meet a friend. We order tea and talk about plans for the weekend."),
    text("nb_hjem", "Hjemme", "Leiligheten min har et lite {kjøkken}, et lyst soverom og et bord ved vinduet.", "My apartment has a small kitchen, a bright bedroom, and a table by the window."),
    text("nb_vaer", "Vær", "I dag er {været} kaldt og vindfullt. Jeg tar på meg en jakke fordi det kan komme regn.", "Today the weather is cold and windy. I put on a jacket because rain may come."),
    text("nb_helg", "Helg", "I helgen vil vi gå til markedet, lage middag og se en film {hjemme}.", "At the weekend we want to go to the market, make dinner, and watch a film at home."),
    text("nb_reise", "Reise", "I morgen tar jeg {toget} til en annen by. Jeg trenger billett, adresse og en liten veske.", "Tomorrow I take the train to another city. I need a ticket, an address, and a small bag."),
  ],
  forms: [
    ...[
      ["noun", "a house", "et ", "hus", "", "neuter indefinite noun"],
      ["noun", "the house", "", "huset", "", "definite singular of hus"],
      ["noun", "houses", "", "hus", "", "neuter plural often unchanged"],
      ["noun", "the houses", "", "husene", "", "definite plural"],
      ["noun", "a book", "en ", "bok", "", "common gender noun"],
      ["noun", "the book", "", "boka", "", "definite singular"],
      ["noun", "books", "", "bøker", "", "irregular plural"],
      ["noun", "the books", "", "bøkene", "", "definite plural"],
      ["noun", "a door", "en ", "dør", "", "common gender noun"],
      ["noun", "the door", "", "døra", "", "definite singular"],
      ["noun", "doors", "", "dører", "", "regular plural"],
      ["noun", "the doors", "", "dørene", "", "definite plural"],
      ["noun", "a child", "et ", "barn", "", "neuter noun"],
      ["noun", "the child", "", "barnet", "", "definite singular"],
      ["noun", "children", "", "barn", "", "plural unchanged"],
      ["noun", "the children", "", "barna", "", "definite plural"],
      ["adjective", "a good day", "en ", "god", " dag", "common gender adjective"],
      ["adjective", "a good year", "et ", "godt", " år", "neuter adjective"],
      ["adjective", "good books", "", "gode", " bøker", "plural adjective"],
      ["adjective", "a small house", "et ", "lite", " hus", "irregular neuter of liten"],
      ["adjective", "a small car", "en ", "liten", " bil", "common gender of liten"],
      ["adjective", "small books", "", "små", " bøker", "plural of liten"],
      ["adjective", "a new apartment", "en ", "ny", " leilighet", "common gender"],
      ["adjective", "a new table", "et ", "nytt", " bord", "neuter form"],
      ["adjective", "new houses", "", "nye", " hus", "plural form"],
      ["verb", "I am", "jeg ", "er", "", "present of å være"],
      ["verb", "I was", "jeg ", "var", "", "past of å være"],
      ["verb", "I have", "jeg ", "har", "", "present of å ha"],
      ["verb", "I had", "jeg ", "hadde", "", "past of å ha"],
      ["verb", "I go", "jeg ", "går", "", "present of å gå"],
      ["verb", "I went", "jeg ", "gikk", "", "past of å gå"],
      ["verb", "I come", "jeg ", "kommer", "", "present of å komme"],
      ["verb", "I came", "jeg ", "kom", "", "past of å komme"],
      ["verb", "I do", "jeg ", "gjør", "", "present of å gjøre"],
      ["verb", "I did", "jeg ", "gjorde", "", "past of å gjøre"],
      ["verb", "I see", "jeg ", "ser", "", "present of å se"],
      ["verb", "I saw", "jeg ", "så", "", "past of å se"],
      ["verb", "I say", "jeg ", "sier", "", "present of å si"],
      ["verb", "I said", "jeg ", "sa", "", "past of å si"],
      ["verb", "I know a fact", "jeg ", "vet", "", "present of å vite"],
      ["verb", "I knew a fact", "jeg ", "visste", "", "past of å vite"],
      ["verb", "I know a person", "jeg ", "kjenner", "", "present of å kjenne"],
      ["verb", "I want", "jeg ", "vil", "", "modal verb"],
      ["verb", "I wanted", "jeg ", "ville", "", "past of å ville"],
      ["verb", "I need", "jeg ", "trenger", "", "present of å trenge"],
      ["verb", "I eat", "jeg ", "spiser", "", "present of å spise"],
      ["verb", "I ate", "jeg ", "spiste", "", "past of å spise"],
      ["verb", "I drink", "jeg ", "drikker", "", "present of å drikke"],
      ["verb", "I drank", "jeg ", "drakk", "", "past of å drikke"],
      ["word order", "today I work", "i dag ", "arbeider", " jeg", "verb-second word order"],
      ["question", "Do you speak Norwegian?", "", "Snakker", " du norsk?", "verb first in yes/no question"],
    ].map(([type, prompt, before, answer, after, note]) => form("nb", type, prompt, before, answer, after, note)),
  ],
  reference: norwayReference(),
};

function romanianWords() {
  const base = words("ro", `
eu|I
tu|you (singular)
el|he
ea|she
noi|we
voi|you (plural)
ei|they (masculine plural)
ele|they (feminine plural)
acesta|this one (masculine/neuter singular)
aceasta|this one (feminine singular)
acel|that (masculine/neuter singular)
acea|that (feminine singular)
cine|who
ce|what
când|when
unde|where
de ce|why
cum|how
cât|how much
care|which
a fi|to be
a avea|to have
a merge|to go
a veni|to come
a vrea|to want
a ști|to know
a spune|to say
a vedea|to see
a face|to do or make
a lucra|to work
a locui|to live
a vorbi|to speak
a învăța|to learn
a citi|to read
a scrie|to write
a mânca|to eat
a bea|to drink
a cumpăra|to buy
a pleca|to leave
a ajunge|to arrive
a lua|to take
a da|to give
a pune|to put
a găsi|to find
a întreba|to ask
a răspunde|to answer
a asculta|to listen
a înțelege|to understand
a deschide|to open
a închide|to close
a aștepta|to wait
a plăti|to pay
a primi|to receive
a trimite|to send
a aduce|to bring
a pregăti|to prepare
a chema|to call
a vizita|to visit
a călători|to travel
a conduce|to drive
a sta|to stay or stand
a rămâne|to remain
a putea|to be able to
a trebui|to have to
astăzi|today
mâine|tomorrow
ieri|yesterday
acum|now
apoi|then
înainte|before
după|after
devreme|early
târziu|late
mereu|always
niciodată|never
des|often
uneori|sometimes
rar|rarely
aici|here
acolo|there
aproape|near
departe|far
sus|up
jos|down
înăuntru|inside
afară|outside
stânga|left
dreapta|right
pentru că|because
dar|but
și|and
sau|or
deci|therefore
totuși|however
deși|although
dacă|if
când|when
în timp ce|while
foarte|very
mai|more
mult|much
puțin|little
destul|enough
aproape|almost
poate|maybe
sigur|sure
probabil|probably
casă|house
apartament|apartment
cameră|room
bucătărie|kitchen
baie|bathroom
dormitor|bedroom
ușă|door
fereastră|window
masă|table
scaun|chair
pat|bed
dulap|cupboard
frigider|refrigerator
aragaz|stove
chiuvetă|sink
farfurie|plate
pahar|glass
furculiță|fork
cuțit|knife
lingură|spoon
mâncare|food
apă|water
pâine|bread
lapte|milk
brânză|cheese
ou|egg
carne|meat
pește|fish
orez|rice
cartof|potato
roșie|tomato
ceapă|onion
măr|apple
fruct|fruit
legumă|vegetable
cafea|coffee
ceai|tea
suc|juice
mic dejun|breakfast
prânz|lunch
cină|dinner
magazin|shop
piață|market or square
preț|price
bani|money
card|card
bon|receipt
geantă|bag
telefon|phone
internet|internet
mesaj|message
adresă|address
număr|number
tren|train
autobuz|bus
mașină|car
taxi|taxi
bilet|ticket
gară|train station
aeroport|airport
stradă|street
drum|road
oraș|city
sat|village
centru|center
cartier|neighborhood
parc|park
hotel|hotel
restaurant|restaurant
cafenea|café
familie|family
mamă|mother
tată|father
părinte|parent
frate|brother
soră|sister
copil|child
fiu|son
fiică|daughter
soț|husband
soție|wife
prieten|friend masculine
prietenă|friend feminine
vecin|neighbor masculine
vecină|neighbor feminine
coleg|colleague masculine
colegă|colleague feminine
profesor|teacher masculine
profesoară|teacher feminine
student|student masculine
studentă|student feminine
doctor|doctor masculine
doctoriță|doctor feminine
om|person or man
femeie|woman
bărbat|man
tânăr|young man
tânără|young woman
vârstă|age
naționalitate|nationality
limbă|language
română|Romanian language
engleză|English language
fericit|happy masculine
trist|sad masculine
obosit|tired masculine
ocupat|busy masculine
liniștit|calm masculine
politicos|polite masculine
sănătos|healthy masculine
bolnav|sick masculine
durere|pain
febră|fever
farmacie|pharmacy
medicament|medicine
serviciu|job
muncă|work
birou|office
companie|company
proiect|project
ședință|meeting
document|document
cerere|application
dosar|file or case folder
experiență|experience
studii|education or studies
diplomă|degree
universitate|university
cercetare|research
știință|science
laborator|laboratory
problemă|problem
soluție|solution
întrebare|question
răspuns|answer
idee|idea
motiv|reason
decizie|decision
situație|situation
posibilitate|possibility
ocazie|opportunity
diferență|difference
avantaj|advantage
dezavantaj|disadvantage
mediu|environment
dezvoltare|development
important|important masculine
necesar|required masculine
posibil|possible masculine
similar|similar masculine
diferit|different masculine
simplu|simple masculine
greu|hard or difficult masculine
ușor|easy or light masculine
bun|good masculine
rău|bad masculine
mare|big
mic|small masculine
nou|new masculine
vechi|old masculine
frumos|beautiful masculine
rapid|fast masculine
lent|slow masculine
cald|warm masculine
rece|cold masculine
România|Romania
București|Bucharest
capitală|capital city
țară|country
cetățenie|citizenship
cetățean|citizen masculine
cetățeană|citizen feminine
Constituție|constitution
guvern|government
președinte|president
parlament|parliament
lege|law
drept|right
obligație|duty or obligation
stat|state
steag|flag
imn|anthem
Ziua Națională|National Day
Uniunea Europeană|European Union
județ|county
regiune|region
istorie|history
cultură|culture
tradiție|tradition
domiciliu|residence
pașaport|passport
act|official document
certificat|certificate
semnătură|signature
interviu|interview
jurământ|oath
respect|respect
libertate|freedom
democrație|democracy
societate|society
comunitate|community
român|Romanian man
româncă|Romanian woman
românesc|Romanian adjective masculine
albastru|blue
galben|yellow
roșu|red
unu|one
doi|two
trei|three
patru|four
cinci|five
zece|ten
sută|hundred
mie|thousand
primul|first masculine
ultimul|last masculine
toate|all feminine plural
fiecare|each
alt|other masculine
aceeași|same feminine
`);

  const phrases = [];
  const usefulPhrases = `
bună ziua|good afternoon or hello
bună seara|good evening
la revedere|goodbye
vă rog|please formal
mulțumesc|thank you
cu plăcere|you are welcome
îmi pare rău|I am sorry
nu înțeleg|I do not understand
puteți repeta|can you repeat
vorbiți mai rar|please speak more slowly
cum vă numiți|what is your name formal
mă numesc|my name is
unde locuiți|where do you live formal
cu ce vă ocupați|what do you do formal
ce limbi vorbiți|what languages do you speak
de cât timp|for how long
învăț limba română|I am learning Romanian
doresc cetățenia română|I want Romanian citizenship
capitala României|the capital of Romania
steagul României|the flag of Romania
imnul României|the anthem of Romania
Ziua Națională a României|Romania's National Day
membră a Uniunii Europene|member of the European Union feminine
acte necesare|required documents
cerere de cetățenie|citizenship application
dosar complet|complete file
interviu oficial|official interview
jurământ de credință|oath of allegiance
`;
  phrases.push(...words("ro_phrase", usefulPhrases));

  const nouns = [
    ["casă", "house"], ["apartament", "apartment"], ["cameră", "room"], ["oraș", "city"], ["stradă", "street"], ["magazin", "shop"], ["restaurant", "restaurant"], ["cafenea", "café"], ["parc", "park"], ["gară", "station"], ["serviciu", "job"], ["birou", "office"], ["familie", "family"], ["prieten", "friend"], ["zi", "day"], ["seară", "evening"], ["dimineață", "morning"], ["întrebare", "question"], ["răspuns", "answer"], ["document", "document"], ["proiect", "project"], ["ședință", "meeting"], ["călătorie", "trip"], ["bilet", "ticket"], ["masă", "meal or table"], ["mâncare", "food"], ["limbă", "language"], ["tradiție", "tradition"], ["cultură", "culture"], ["problemă", "problem"],
  ];
  const adjectives = [
    ["bună", "good"], ["nouă", "new"], ["veche", "old"], ["mică", "small"], ["mare", "big"], ["frumoasă", "beautiful"], ["importantă", "important"], ["simplă", "simple"], ["rapidă", "fast"], ["liniștită", "quiet"],
  ];
  nouns.forEach(([noun, nounEn]) => {
    adjectives.forEach(([adj, adjEn]) => {
      phrases.push({ id: `ro_coll_${slug(noun)}_${slug(adj)}`, term: `${noun} ${adj}`, translation: `${adjEn} ${nounEn}` });
    });
  });

  const actions = [
    ["merg la", "I go to"], ["locuiesc în", "I live in"], ["lucrez la", "I work at"], ["cumpăr", "I buy"], ["caut", "I look for"], ["găsesc", "I find"], ["pregătesc", "I prepare"], ["văd", "I see"], ["aștept", "I wait for"], ["vorbesc despre", "I talk about"],
  ];
  nouns.slice(0, 24).forEach(([noun, nounEn]) => {
    actions.forEach(([action, actionEn]) => {
      phrases.push({ id: `ro_action_${slug(action)}_${slug(noun)}`, term: `${action} ${noun}`, translation: `${actionEn} the ${nounEn}` });
    });
  });

  return uniqueById([...base, ...phrases]).slice(0, 560);
}

function romanianTexts() {
  return [
    text("ro_intro_self", "Introducing yourself", "Bună ziua. Mă {numesc} Alex și învăț limba română. Locuiesc într-un oraș mare, dar îmi place să vorbesc despre {familie}, muncă și planuri simple.", "Good afternoon. My name is Alex and I am learning Romanian. I live in a large city, but I like to talk about family, work, and simple plans."),
    text("ro_where_live", "Where I live", "Eu {locuiesc} într-un apartament mic, aproape de centru. În cartier sunt magazine, o farmacie, o stație de autobuz și un {parc} liniștit.", "I live in a small apartment near the center. In the neighborhood there are shops, a pharmacy, a bus stop, and a quiet park."),
    text("ro_morning", "Morning routine", "Dimineața mă trezesc devreme, beau {cafea} și citesc mesajele. Apoi pregătesc micul dejun și plec la {serviciu}.", "In the morning I wake up early, drink coffee, and read messages. Then I prepare breakfast and leave for work."),
    text("ro_work", "Going to work", "Merg la {muncă} cu autobuzul. Drumul durează douăzeci de minute. La birou am o ședință, scriu un document și răspund la {întrebări}.", "I go to work by bus. The trip takes twenty minutes. At the office I have a meeting, write a document, and answer questions."),
    text("ro_shopping", "Shopping", "La magazin cumpăr pâine, lapte, roșii și {mere}. Verific prețul, plătesc cu cardul și pun bonul în {geantă}.", "At the shop I buy bread, milk, tomatoes, and apples. I check the price, pay by card, and put the receipt in my bag."),
    text("ro_cafe", "At a café", "În cafenea comand un ceai și aștept o {prietenă}. Vorbim despre weekend, despre vreme și despre o călătorie scurtă la {munte}.", "In the café I order tea and wait for a friend. We talk about the weekend, the weather, and a short trip to the mountains."),
    text("ro_transport", "Public transport", "Autobuzul este plin, dar ajunge la timp. Am bilet pe telefon și cobor la a treia {stație}, lângă gară.", "The bus is full, but it arrives on time. I have a ticket on my phone and get off at the third stop, near the station."),
    text("ro_weekend", "Weekend plans", "În weekend vrem să vizităm un {oraș} nou. Dacă vremea este bună, mergem în parc, mâncăm la restaurant și facem fotografii.", "On the weekend we want to visit a new city. If the weather is good, we go to the park, eat at a restaurant, and take photos."),
    text("ro_weather", "Weather", "Astăzi vremea este {rece} și bate vântul. Totuși, după-amiază apare soarele, așa că fac o plimbare scurtă.", "Today the weather is cold and windy. However, in the afternoon the sun appears, so I take a short walk."),
    text("ro_friend", "Visiting a friend", "Seara vizitez un {prieten}. El locuiește departe, într-un cartier liniștit. Duc o prăjitură și stăm de vorbă până târziu.", "In the evening I visit a friend. He lives far away, in a quiet neighborhood. I bring a cake and we talk until late."),
    text("ro_apartment", "Apartment", "Apartamentul meu are o cameră luminoasă, o bucătărie mică și o {fereastră} mare. Nu este luxos, dar este curat și comod.", "My apartment has a bright room, a small kitchen, and a large window. It is not luxurious, but it is clean and comfortable."),
    text("ro_restaurant", "Restaurant", "La restaurant cer meniul și aleg o supă simplă. Chelnerul este politicos, iar {mâncarea} este caldă și bună.", "At the restaurant I ask for the menu and choose a simple soup. The waiter is polite, and the food is warm and good."),
    text("ro_family", "Talking about family", "Familia mea este mică. Am un frate și o soră. Ne sunăm des, vorbim despre {sănătate}, serviciu și planurile pentru vacanță.", "My family is small. I have a brother and a sister. We call each other often and talk about health, work, and vacation plans."),
    text("ro_profession", "Profession", "Lucrez la universitate și fac {cercetare}. Îmi place să explic idei dificile în mod simplu și să colaborez cu colegi din alte țări.", "I work at a university and do research. I like explaining difficult ideas simply and collaborating with colleagues from other countries."),
    text("ro_education", "Education", "Am studii universitare și citesc mult. Pentru mine, educația înseamnă curiozitate, {disciplină} și dorința de a înțelege lumea.", "I have university studies and read a lot. For me, education means curiosity, discipline, and the desire to understand the world."),
    text("ro_hobbies", "Hobbies", "În timpul liber citesc, merg pe jos și gătesc. Uneori ascult muzică sau învăț cuvinte noi într-o {limbă} străină.", "In my free time I read, walk, and cook. Sometimes I listen to music or learn new words in a foreign language."),
    text("ro_learning", "Learning Romanian", "Învăț limba română pentru comunicare și pentru a înțelege mai bine cultura. Repet cuvinte, citesc texte scurte și exersez {gramatica}.", "I learn Romanian for communication and to understand the culture better. I repeat words, read short texts, and practice grammar."),
    text("ro_travel", "Travel", "Când călătoresc, pregătesc din timp biletele și adresa hotelului. Îmi place să merg cu trenul și să văd {orașe} noi.", "When I travel, I prepare the tickets and hotel address in advance. I like going by train and seeing new cities."),
    text("ro_city", "My city", "Orașul meu este aglomerat, dar interesant. Are clădiri moderne, piețe vechi, restaurante bune și multe {oportunități}.", "My city is crowded but interesting. It has modern buildings, old squares, good restaurants, and many opportunities."),
    text("ro_plans", "Making plans", "Mâine ne întâlnim la ora șase. Dacă plouă, mergem la cafenea; dacă este soare, ne plimbăm prin {parc}.", "Tomorrow we meet at six. If it rains, we go to a café; if it is sunny, we walk through the park."),
    text("ro_civic_romania", "Ce știți despre România?", "România este o {țară} din Europa. Capitala este București. România are istorie, cultură, tradiții și este membră a Uniunii Europene.", "Romania is a country in Europe. The capital is Bucharest. Romania has history, culture, traditions, and is a member of the European Union."),
    text("ro_civic_capital", "Care este capitala României?", "Capitala României este {București}. Este cel mai mare oraș al țării și un centru important pentru administrație, cultură și economie.", "The capital of Romania is Bucharest. It is the country's largest city and an important center for administration, culture, and economy."),
    text("ro_civic_anthem", "Imnul României", "Imnul național al României se numește {Deșteaptă-te}, române. Este un simbol oficial al statului român.", "Romania's national anthem is called Wake Up, Romanian. It is an official symbol of the Romanian state."),
    text("ro_civic_flag", "Steagul", "Steagul României are trei culori: {albastru}, galben și roșu. Culorile sunt așezate vertical.", "The Romanian flag has three colors: blue, yellow, and red. The colors are arranged vertically."),
    text("ro_civic_day", "Ziua Națională", "Ziua Națională a României este la {1 Decembrie}. În această zi se organizează ceremonii și evenimente publice.", "Romania's National Day is on December 1. On this day ceremonies and public events are organized."),
    text("ro_civic_oath_practice", "Jurământul de credință", "Jur să fiu {devotat} patriei și poporului român, să {apăr} drepturile și interesele naționale, să {respect} Constituția și legile României.", "I swear to be devoted to the homeland and the Romanian people, to defend national rights and interests, and to respect the Constitution and the laws of Romania."),
    text("ro_civic_reference_practice", "Repere naționale", "București este {capitala} României. Imnul național se numește „{Deșteaptă-te, române!}”. Ziua Națională a României este pe {1 Decembrie}. Steagul României este {albastru}, {galben} și {roșu}.", "Bucharest is the capital of Romania. The national anthem is called “Deșteaptă-te, române!”. Romania's National Day is on 1 December. The Romanian flag is blue, yellow, and red."),
    text("ro_civic_why", "De ce doriți cetățenia?", "Doresc cetățenia română pentru că respect România, limba română și valorile democratice. Vreau să am o {legătură} stabilă cu această țară.", "I want Romanian citizenship because I respect Romania, the Romanian language, and democratic values. I want to have a stable connection with this country."),
    text("ro_civic_residence", "Unde locuiți?", "Locuiesc în prezent în străinătate, dar pot descrie adresa, domiciliul și situația mea personală în limba {română}.", "I currently live abroad, but I can describe my address, residence, and personal situation in Romanian."),
    text("ro_civic_work", "Cu ce vă ocupați?", "Mă ocup de cercetare și dezvoltare software. Lucrez cu date, documente și proiecte care cer atenție, {răbdare} și comunicare clară.", "I work in research and software development. I work with data, documents, and projects that require attention, patience, and clear communication."),
    text("ro_civic_languages", "Ce limbi vorbiți?", "Vorbesc engleză și învăț română. Pot răspunde la întrebări simple și pot explica informații despre mine, familie și {muncă}.", "I speak English and am learning Romanian. I can answer simple questions and explain information about myself, family, and work."),
    text("ro_civic_connection", "Legătura cu România", "Legătura mea cu România este construită prin limbă, cultură și interes constant. Învăț despre istorie, orașe, tradiții și viața de {zi} cu zi.", "My connection with Romania is built through language, culture, and steady interest. I learn about history, cities, traditions, and everyday life."),
    text("ro_abroad", "Living abroad", "A locui în străinătate poate fi util, dar uneori dificil. Înveți să compari sisteme, obiceiuri și moduri diferite de {comunicare}.", "Living abroad can be useful but sometimes difficult. You learn to compare systems, habits, and different ways of communication."),
    text("ro_moving", "Moving country", "Când te muți într-o altă țară, ai nevoie de documente, răbdare și informații clare. La început, fiecare {detaliu} pare important.", "When you move to another country, you need documents, patience, and clear information. At first, every detail seems important."),
    text("ro_research", "Work and research", "În cercetare, o întrebare bună este foarte importantă. Uneori soluția apare încet, după multe încercări și după o analiză {atentă}.", "In research, a good question is very important. Sometimes the solution appears slowly, after many attempts and careful analysis."),
    text("ro_cities", "Romanian cities", "În România există orașe mari și mici: București, Cluj-Napoca, Iași, Timișoara, Brașov și Constanța. Fiecare oraș are o {identitate} proprie.", "In Romania there are large and small cities: Bucharest, Cluj-Napoca, Iași, Timișoara, Brașov, and Constanța. Each city has its own identity."),
    text("ro_culture", "Culture", "Cultura se vede în limbă, mâncare, muzică, sărbători și felul în care oamenii spun povești despre familie și {istorie}.", "Culture appears in language, food, music, holidays, and the way people tell stories about family and history."),
  ];
}

function romanianForms() {
  const forms = [];
  const nouns = [
    ["casă", "case", "casa", "casele"], ["fată", "fete", "fata", "fetele"], ["carte", "cărți", "cartea", "cărțile"], ["băiat", "băieți", "băiatul", "băieții"], ["copil", "copii", "copilul", "copiii"], ["om", "oameni", "omul", "oamenii"], ["oraș", "orașe", "orașul", "orașele"], ["femeie", "femei", "femeia", "femeile"], ["bărbat", "bărbați", "bărbatul", "bărbații"], ["drum", "drumuri", "drumul", "drumurile"], ["tren", "trenuri", "trenul", "trenurile"], ["magazin", "magazine", "magazinul", "magazinele"], ["masă", "mese", "masa", "mesele"], ["scaun", "scaune", "scaunul", "scaunele"], ["ușă", "uși", "ușa", "ușile"], ["fereastră", "ferestre", "fereastra", "ferestrele"], ["limbă", "limbi", "limba", "limbile"], ["întrebare", "întrebări", "întrebarea", "întrebările"], ["răspuns", "răspunsuri", "răspunsul", "răspunsurile"], ["document", "documente", "documentul", "documentele"], ["cerere", "cereri", "cererea", "cererile"], ["dosar", "dosare", "dosarul", "dosarele"], ["cetățean", "cetățeni", "cetățeanul", "cetățenii"], ["țară", "țări", "țara", "țările"], ["lege", "legi", "legea", "legile"], ["tradiție", "tradiții", "tradiția", "tradițiile"], ["familie", "familii", "familia", "familiile"], ["prieten", "prieteni", "prietenul", "prietenii"], ["profesor", "profesori", "profesorul", "profesorii"], ["student", "studenți", "studentul", "studenții"], ["zi", "zile", "ziua", "zilele"], ["noapte", "nopți", "noaptea", "nopțile"], ["problemă", "probleme", "problema", "problemele"], ["soluție", "soluții", "soluția", "soluțiile"], ["posibilitate", "posibilități", "posibilitatea", "posibilitățile"],
  ];
  nouns.forEach(([sg, pl, def, defpl]) => {
    forms.push(form("ro", "plural", `${sg} plural`, "", pl, "", `${sg} → ${pl}`));
    forms.push(form("ro", "definite form", `definite singular of ${sg}`, "", def, "", `${sg} → ${def}`));
    forms.push(form("ro", "definite plural", `definite plural of ${pl}`, "", defpl, "", `${pl} → ${defpl}`));
  });
  const adjectives = [
    ["bun", "bună", "buni", "bune"], ["frumos", "frumoasă", "frumoși", "frumoase"], ["mic", "mică", "mici", "mici"], ["mare", "mare", "mari", "mari"], ["nou", "nouă", "noi", "noi"], ["vechi", "veche", "vechi", "vechi"], ["român", "română", "români", "române"], ["important", "importantă", "importanți", "importante"], ["simplu", "simplă", "simpli", "simple"], ["diferit", "diferită", "diferiți", "diferite"], ["obosit", "obosită", "obosiți", "obosite"], ["sănătos", "sănătoasă", "sănătoși", "sănătoase"], ["politicos", "politicoasă", "politicoși", "politicoase"], ["rapid", "rapidă", "rapizi", "rapide"], ["greu", "grea", "grei", "grele"],
  ];
  adjectives.forEach(([m, f, mpl, fpl]) => {
    forms.push(form("ro", "agreement", `feminine singular of ${m}`, "o femeie ", f, "", `${m} → ${f}`));
    forms.push(form("ro", "agreement", `masculine plural of ${m}`, "bărbați ", mpl, "", `${m} → ${mpl}`));
    forms.push(form("ro", "agreement", `feminine plural of ${m}`, "case ", fpl, "", `${m} → ${fpl}`));
    forms.push(form("ro", "agreement", `masculine singular of ${m}`, "un bărbat ", m, "", `${m} masculine singular`));
  });
  const verbs = [
    ["a fi", [["eu ", "sunt", "I am"], ["tu ", "ești", "you are"], ["el ", "este", "he is"], ["noi ", "suntem", "we are"], ["voi ", "sunteți", "you plural are"], ["ei ", "sunt", "they are"]]],
    ["a avea", [["eu a", "m", "I have"], ["tu a", "i", "you have"], ["el ar", "e", "he has"], ["noi av", "em", "we have"], ["voi av", "eți", "you plural have"], ["ei a", "u", "they have"]]],
    ["a merge", [["eu merg", "", "I go"], ["tu merg", "i", "you go"], ["el merg", "e", "he goes"], ["noi merg", "em", "we go"], ["voi merg", "eți", "you plural go"], ["ei merg", "", "they go"]]],
    ["a veni", [["eu v", "in", "I come"], ["tu v", "ii", "you come"], ["el v", "ine", "he comes"], ["noi ven", "im", "we come"], ["voi ven", "iți", "you plural come"], ["ei v", "in", "they come"]]],
    ["a face", [["eu fac", "", "I do"], ["tu fac", "i", "you do"], ["el fac", "e", "he does"], ["noi fac", "em", "we do"], ["voi fac", "eți", "you plural do"], ["ei fac", "", "they do"]]],
    ["a spune", [["eu sp", "un", "I say"], ["tu sp", "ui", "you say"], ["el sp", "une", "he says"], ["noi spun", "em", "we say"], ["voi spun", "eți", "you plural say"], ["ei sp", "un", "they say"]]],
    ["a vedea", [["eu v", "ăd", "I see"], ["tu vez", "i", "you see"], ["el ved", "e", "he sees"], ["noi ved", "em", "we see"], ["voi ved", "eți", "you plural see"], ["ei v", "ăd", "they see"]]],
    ["a ști", [["eu șt", "iu", "I know"], ["tu șt", "ii", "you know"], ["el șt", "ie", "he knows"], ["noi șt", "im", "we know"], ["voi șt", "iți", "you plural know"], ["ei șt", "iu", "they know"]]],
    ["a putea", [["eu p", "ot", "I can"], ["tu poț", "i", "you can"], ["el poat", "e", "he can"], ["noi put", "em", "we can"], ["voi put", "eți", "you plural can"], ["ei p", "ot", "they can"]]],
    ["a vrea", [["eu vr", "eau", "I want"], ["tu vr", "ei", "you want"], ["el vr", "ea", "he wants"], ["noi vr", "em", "we want"], ["voi vr", "eți", "you plural want"], ["ei vr", "eau", "they want"]]],
    ["a lucra", [["eu lucr", "ez", "I work"], ["tu lucr", "ezi", "you work"], ["el lucr", "ează", "he works"], ["noi lucr", "ăm", "we work"], ["voi lucr", "ați", "you plural work"], ["ei lucr", "ează", "they work"]]],
    ["a locui", [["eu locu", "iesc", "I live"], ["tu locu", "iești", "you live"], ["el locu", "iește", "he lives"], ["noi locu", "im", "we live"], ["voi locu", "iți", "you plural live"], ["ei locu", "iesc", "they live"]]],
    ["a vorbi", [["eu vorb", "esc", "I speak"], ["tu vorb", "ești", "you speak"], ["el vorb", "ește", "he speaks"], ["noi vorb", "im", "we speak"], ["voi vorb", "iți", "you plural speak"], ["ei vorb", "esc", "they speak"]]],
    ["a învăța", [["eu înv", "ăț", "I learn"], ["tu înv", "eți", "you learn"], ["el înv", "ață", "he learns"], ["noi învăț", "ăm", "we learn"], ["voi învăț", "ați", "you plural learn"], ["ei înv", "ață", "they learn"]]],
    ["a mânca", [["eu măn", "ânc", "I eat"], ["tu măn", "ânci", "you eat"], ["el măn", "âncă", "he eats"], ["noi mânc", "ăm", "we eat"], ["voi mânc", "ați", "you plural eat"], ["ei măn", "âncă", "they eat"]]],
    ["a bea", [["eu b", "eau", "I drink"], ["tu b", "ei", "you drink"], ["el b", "ea", "he drinks"], ["noi b", "em", "we drink"], ["voi b", "eți", "you plural drink"], ["ei b", "eau", "they drink"]]],
    ["a citi", [["eu cit", "esc", "I read"], ["tu cit", "ești", "you read"], ["el cit", "ește", "he reads"], ["noi cit", "im", "we read"], ["voi cit", "iți", "you plural read"], ["ei cit", "esc", "they read"]]],
    ["a scrie", [["eu scr", "iu", "I write"], ["tu scr", "ii", "you write"], ["el scr", "ie", "he writes"], ["noi scr", "iem", "we write"], ["voi scr", "ieți", "you plural write"], ["ei scr", "iu", "they write"]]],
    ["a cumpăra", [["eu cump", "ăr", "I buy"], ["tu cump", "eri", "you buy"], ["el cump", "ără", "he buys"], ["noi cumpăr", "ăm", "we buy"], ["voi cumpăr", "ați", "you plural buy"], ["ei cump", "ără", "they buy"]]],
  ];
  verbs.forEach(([verb, entries]) => {
    entries.forEach(([before, answer, prompt]) => {
      if (answer) forms.push(form("ro", "conjugation", prompt, before, answer, "", `present tense of ${verb}`));
    });
  });
  [
    ["I went", "am ", "mers", "a merge"], ["I came", "am ", "venit", "a veni"], ["I did", "am ", "făcut", "a face"], ["I saw", "am ", "văzut", "a vedea"], ["I said", "am ", "spus", "a spune"], ["I worked", "am ", "lucrat", "a lucra"], ["I lived", "am ", "locuit", "a locui"], ["I learned", "am ", "învățat", "a învăța"], ["I ate", "am ", "mâncat", "a mânca"], ["I drank", "am ", "băut", "a bea"], ["I read", "am ", "citit", "a citi"], ["I wrote", "am ", "scris", "a scrie"],
  ].forEach(([prompt, before, answer, note]) => forms.push(form("ro", "past", prompt, before, answer, "", `compound past of ${note}`)));
  [
    ["my book", "cartea ", "mea", "", "feminine possession"], ["my child", "copilul ", "meu", "", "masculine possession"], ["your house", "casa ", "ta", "", "feminine possession"], ["your friend", "prietenul ", "tău", "", "masculine possession"], ["our family", "familia ", "noastră", "", "feminine possession"], ["our city", "orașul ", "nostru", "", "masculine possession"],
    ["I speak with him", "vorbesc cu ", "el", "", "pronoun after preposition"], ["I speak with her", "vorbesc cu ", "ea", "", "pronoun after preposition"], ["for me", "pentru ", "mine", "", "prepositional pronoun"], ["for you", "pentru ", "tine", "", "prepositional pronoun"],
  ].forEach(([prompt, before, answer, after, note]) => forms.push(form("ro", "pronoun", prompt, before, answer, after, note)));
  return uniqueById(forms).slice(0, 240);
}

packData["romanian-starter"] = {
  words: romanianWords(),
  texts: romanianTexts(),
  forms: romanianForms(),
  reference: romanianReference(),
};

packData["english-medical-starter"] = {
  words: medicalEnglishWords(),
  texts: [],
  forms: [],
};

packData["english-literature-starter"] = {
  words: literaryEnglishWords(),
  texts: [],
  forms: [],
};

packData["english-starter"].reference = unitedKingdomReference();
packData["german-starter"].reference = germanReference();
packData["french-starter"].reference = frenchReference();
packData["polish-starter"].reference = polishReference();
packData["ukrainian-starter"].reference = ukrainianReference();

function updateCatalog(packages) {
  const catalog = {
    version: packageVersion,
    packages: packages.map((pkg) => ({
      ...pkg.metadata,
      path: `packages/${paths[pkg.metadata.id]}`,
    })),
  };
  writeFileSync(path.join(root, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
}

function validate(pkg) {
  const problems = [];
  for (const group of ["words", "texts", "forms"]) {
    const ids = new Set();
    for (const item of pkg[group]) {
      if (!item.id || ids.has(item.id)) problems.push(`${pkg.metadata.id}: duplicate or missing ${group} id ${item.id}`);
      ids.add(item.id);
      for (const [key, value] of Object.entries(item)) {
        if (key !== "before" && key !== "after" && typeof value === "string" && value.length === 0) problems.push(`${pkg.metadata.id}: empty ${group}.${key} in ${item.id}`);
      }
    }
  }
  if (pkg.metadata.wordCount !== pkg.words.length) problems.push(`${pkg.metadata.id}: metadata wordCount mismatch`);
  if (pkg.metadata.textCount !== pkg.texts.length) problems.push(`${pkg.metadata.id}: metadata textCount mismatch`);
  if (pkg.metadata.formCount !== pkg.forms.length) problems.push(`${pkg.metadata.id}: metadata formCount mismatch`);
  const terms = new Set();
  for (const entry of pkg.words) {
    if (!entry.term || !entry.translation) problems.push(`${pkg.metadata.id}: bad word ${entry.id}`);
    const normalizedTerm = entry.term.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    if (terms.has(normalizedTerm)) problems.push(`${pkg.metadata.id}: duplicate word term ${entry.term}`);
    terms.add(normalizedTerm);
    if (/TODO|placeholder|lorem ipsum|--|\[object Object\]/i.test(`${entry.term} ${entry.translation}`)) {
      problems.push(`${pkg.metadata.id}: suspicious word artifact ${entry.id}`);
    }
  }
  for (const entry of pkg.texts) {
    const gaps = [...entry.text.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    if (!gaps.length) problems.push(`${pkg.metadata.id}: text has no gaps ${entry.id}`);
    if (gaps.some((gap) => !gap.trim())) problems.push(`${pkg.metadata.id}: bad gap in ${entry.id}`);
  }
  for (const entry of pkg.forms) {
    if (!entry.answer) problems.push(`${pkg.metadata.id}: empty form answer ${entry.id}`);
    if (`${entry.before}${entry.answer}${entry.after}` !== entry.result) problems.push(`${pkg.metadata.id}: form result mismatch ${entry.id}`);
  }
  return problems;
}

const saved = Object.keys(packData).map((id) => savePackage(id, packData[id]));
updateCatalog(saved);
const problems = saved.flatMap(validate);
for (const pkg of saved) {
  console.log(`${pkg.metadata.id}: ${pkg.words.length} words, ${pkg.texts.length} texts, ${pkg.forms.length} forms`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
