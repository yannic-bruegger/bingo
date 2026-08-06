export type WordList = {
  id: string;
  name: string;
  words: string[];
};

export const WORD_LISTS: WordList[] = [
  {
    id: 'th-koeln',
    name: 'TH Köln',
    words: [
      'Vorlesung', 'Seminar', 'Professor', 'Studierende', 'Campus', 'Bibliothek',
      'Prüfung', 'Abschlussarbeit', 'Dozent', 'Mensa', 'Hörsaal', 'Studiengang',
      'Bachelor', 'Master', 'Promotion', 'Forschung', 'Klausur', 'Tutorium',
      'Einschreibung', 'Modul', 'Kreditpunkte', 'Skripte', 'Labor', 'Semester',
      'Exkursion', 'Fachschaft', 'Immatrikulation', 'Hochschulrat', 'Stipendium',
      'Lehrstuhl', 'ILIAS', 'Praktikum', 'Kolloquium', 'Regelstudienzeit',
      'Wahlpflichtfach', 'Studentenwerk',
    ],
  },
  {
    id: 'meeting',
    name: 'Meeting-Bingo',
    words: [
      'Können alle mich hören?', 'Du bist stumm', 'Lass uns das offline klären',
      'Kurzer Sync', 'Low Hanging Fruit', 'Synergien', 'Auf dem Schirm',
      'Ich teile mal meinen Screen', 'Da müssen wir nochmal ran',
      'Deep Dive', 'Roadmap', 'Stakeholder', 'Bandbreite', 'Proaktiv',
      'Am Ende des Tages', 'Quick Win', 'Blocker', 'Circle back',
      'Nur ganz kurz', 'Wer macht das Protokoll?', 'Hund bellt im Hintergrund',
      'Jemand kommt zu spät', 'Kalender voll', 'Follow-up Termin',
      'Das hätte eine Mail sein können', 'Technische Probleme', 'Nächste Schritte',
      'Ich fasse zusammen', 'Placeholder-Termin', 'Ownership',
      'Wir parken das mal', 'Best Practice', 'Alignment', 'Ballpark',
      'Habt ihr noch Fragen?', 'Ich muss leider früher raus',
    ],
  },
  {
    id: 'dev',
    name: 'Entwickler-Bingo',
    words: [
      'Works on my machine', 'Merge-Konflikt', 'Legacy Code', 'Refactoring',
      'Technische Schulden', 'Flaky Test', 'Race Condition', 'Off-by-one',
      'Null Pointer', 'Rebase oder Merge?', 'Tabs vs. Spaces', 'Rubber Duck',
      'Force Push', 'Hotfix auf Prod', 'Der Cache war schuld', 'DNS-Problem',
      'Es ist ein Feature', 'Ticket ohne Beschreibung', 'Code Review offen',
      'CI ist rot', 'Kurz neu starten', 'Dependency Update', 'Breaking Change',
      'Semikolon vergessen', 'Docker baut neu', 'Log-Zeile vergessen',
      'TODO seit 2019', 'Magic Number', 'Copy Paste', 'Regex',
      'Zeitzone falsch', 'Encoding kaputt', 'Rollback', 'Stack Overflow',
      'Es kompiliert', 'Postmortem',
    ],
  },
  {
    id: 'roadtrip',
    name: 'Roadtrip',
    words: [
      'Stau', 'Baustelle', 'Wohnmobil', 'Traktor', 'Raststätte', 'Tankstelle',
      'Blitzer', 'Regenbogen', 'Windrad', 'Kuhherde', 'Schafe', 'Brücke',
      'Tunnel', 'Gelbes Auto', 'Rotes Cabrio', 'Motorrad-Gruppe', 'Polizeiauto',
      'Krankenwagen', 'Anhalter', 'Burg', 'Kirchturm', 'See', 'Fluss',
      'Fahrradträger', 'Nummernschild aus dem Ausland', 'Hund im Auto',
      'Picknickplatz', 'Umleitung', 'Nebel', 'Sonnenuntergang', 'Schneefeld',
      'Straßenschild verbogen', 'Heißluftballon', 'Zug', 'Weinberg', 'Storch',
    ],
  },
];

export function getList(id: string): WordList | undefined {
  return WORD_LISTS.find((l) => l.id === id);
}

export const DEFAULT_LIST_ID = WORD_LISTS[0].id;
