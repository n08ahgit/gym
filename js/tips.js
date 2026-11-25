// =============================================================
// tips.js – Ausführungstipps je Übung (kurz, für den Satz zwischendurch)
//
// Je Übung 3 Punkte: Aufbau, Bewegung, häufigster Fehler.
// Allgemeine Regeln für Muskelaufbau (gelten für alle Übungen) stehen
// in coach.js und werden im Tipp-Fenster ergänzt.
// =============================================================

// prettier-ignore
export const TIPS = {
  // Brust
  bench_press: ['Schulterblätter zurück und nach unten ziehen, Füße fest am Boden, leichter Bogen.', 'Stange kontrolliert zur unteren Brust senken, Ellbogen ca. 45–70° vom Körper.', 'Stange berührt die Brust ohne Abfedern; nicht den Po von der Bank heben.'],
  incline_bench: ['Bank auf 30–45° – steiler verlagert die Last auf die Schultern.', 'Stange zur oberen Brust unterhalb des Schlüsselbeins senken.', 'Schulterblätter zusammen lassen, Handgelenke gerade über den Ellbogen.'],
  decline_bench: ['Beine sicher einhaken, Schulterblätter zurückziehen.', 'Stange zur unteren Brust senken, Ellbogen leicht angelegt.', 'Mit Partner oder Ablage sichern – das Ausheben ist der kritische Moment.'],
  db_bench: ['Hanteln mit den Knien hochbringen, Schulterblätter zurück.', 'Tief absenken bis zur deutlichen Dehnung in der Brust.', 'Oben nicht klacken lassen – Spannung halten, Hanteln leicht nach innen führen.'],
  db_incline: ['Bank 30–45°, Rücken flach, Schulterblätter zurück.', 'Hanteln seitlich der oberen Brust tief absenken, unten kurz Dehnung halten.', 'Ellbogen nicht ganz ausstrecken, sonst Pause für die Brust.'],
  db_fly: ['Ellbogen leicht gebeugt und fix – die Bewegung kommt nur aus der Schulter.', 'Weit absenken bis zur Dehnung, das ist der wichtigste Teil.', 'Oben nicht zusammenschlagen; Spannung endet sonst.'],
  cable_fly: ['Rolle auf Schulterhöhe, ein Schritt nach vorn, Brust raus.', 'Arme in einem Bogen nach vorn zusammenführen, Ellbogen leicht gebeugt.', 'Langsam zurück in die Dehnung, nicht von den Seilen ziehen lassen.'],
  low_cable_fly: ['Rolle ganz unten, Bogen von unten nach oben vor die Brust.', 'Zielt auf die obere Brust – Hände enden auf Kinnhöhe.', 'Ellbogenwinkel konstant halten.'],
  pec_deck: ['Sitz so einstellen, dass Griffe auf Brusthöhe sind.', 'Brust raus, Schultern unten, Arme vor dem Körper zusammenführen.', 'Langsam zurück bis zur vollen Dehnung, ohne dass die Gewichte aufsetzen.'],
  chest_press: ['Sitz so einstellen, dass Griffe auf mittlerer Brusthöhe liegen.', 'Rücken an die Lehne, Schulterblätter zurück, kontrolliert drücken.', 'Weit zurück in die Dehnung – voller Weg bringt mehr als schweres Halbdrücken.'],
  smith_bench: ['Bank so stellen, dass die Stange zur unteren Brust läuft.', 'Schulterblätter zurück, Füße fest.', 'Sicherungshaken vorher einstellen.'],
  pushup: ['Hände etwas breiter als schulterbreit, Körper eine Linie.', 'Brust bis knapp über den Boden, Ellbogen ca. 45°.', 'Zu leicht? Füße erhöhen, Pause unten oder Gewichtsweste.'],
  dips: ['Oberkörper leicht nach vorn = mehr Brust, aufrecht = mehr Trizeps.', 'Absenken, bis die Oberarme etwa parallel zum Boden sind.', 'Schultern unten lassen, nicht zu den Ohren ziehen.'],

  // Rücken
  pullup: ['Obergriff etwas breiter als schulterbreit, ganz aushängen.', 'Ellbogen nach unten zu den Hüften ziehen, Brust zur Stange.', 'Ohne Schwung; unten volle Dehnung, oben Kinn über die Stange.'],
  chinup: ['Untergriff schulterbreit, ganz aushängen.', 'Ellbogen eng nach unten führen, Brust zur Stange.', 'Kontrolliert ablassen – die Exzentrik zählt mit.'],
  assisted_pullup: ['So viel Unterstützung, dass du im Zielbereich nah ans Versagen kommst.', 'Ellbogen nach unten ziehen, Schultern unten halten.', 'Unterstützung über Wochen reduzieren – das ist deine Progression.'],
  lat_pulldown: ['Oberschenkel fest unter das Polster, Oberkörper leicht zurück.', 'Stange zur oberen Brust ziehen, Ellbogen nach unten.', 'Oben ganz strecken lassen für die Dehnung im Latissimus.'],
  close_pulldown: ['Enger Griff, Oberkörper leicht zurück.', 'Griff zur Brust ziehen, Ellbogen nah am Körper.', 'Langsam hoch bis die Arme gestreckt sind.'],
  barbell_row: ['Hüfte nach hinten, Oberkörper 30–45° über der Horizontalen, Rücken gerade.', 'Stange zum Bauchnabel ziehen, Ellbogen nach hinten.', 'Kein Hochschwingen mit dem Oberkörper – Winkel bleibt gleich.'],
  db_row: ['Eine Hand und ein Knie auf der Bank, Rücken flach.', 'Hantel zur Hüfte ziehen, Ellbogen nah am Körper.', 'Unten ganz strecken und die Schulter leicht nach vorn sinken lassen.'],
  cable_row: ['Aufrecht sitzen, Knie leicht gebeugt.', 'Griff zum Bauch ziehen, Schulterblätter zusammen.', 'Nach vorn bis zur Dehnung lassen, ohne den Rücken rund zu machen.'],
  machine_row: ['Brust ans Polster, Sitzhöhe so, dass Griffe auf Brusthöhe sind.', 'Ellbogen nach hinten ziehen, Schulterblätter zusammen.', 'Vorn ganz strecken lassen.'],
  tbar_row: ['Brust raus, Rücken gerade, Knie leicht gebeugt.', 'Griff zur Brust ziehen, Ellbogen nach hinten.', 'Gewicht nicht mit der Hüfte hochschwingen.'],
  pendlay_row: ['Stange startet jeden Satz am Boden, Oberkörper fast waagerecht.', 'Explosiv zur unteren Brust ziehen.', 'Stange ablegen, neu spannen, nächste Wiederholung.'],
  straight_arm_pulldown: ['Arme fast gestreckt, leicht nach vorn gebeugt.', 'Stange in einem Bogen zu den Oberschenkeln führen.', 'Oben die volle Dehnung im Latissimus mitnehmen.'],
  pullover: ['Quer auf der Bank, Hüfte tief, Hantel über der Brust.', 'Hinter den Kopf absenken bis zur Dehnung, Ellbogen leicht gebeugt.', 'Mit dem Latissimus zurückziehen, nicht mit den Armen drücken.'],
  deadlift: ['Stange über Mittelfuß, schulterbreit greifen, Schienbeine an die Stange.', 'Brust raus, Rücken neutral, mit den Beinen den Boden wegdrücken.', 'Stange am Körper führen, oben nicht überstrecken.'],
  rdl: ['Knie leicht gebeugt, Hüfte nach hinten schieben.', 'Stange an den Beinen entlang absenken, bis die Beinbeuger stark gedehnt sind.', 'Rücken bleibt neutral – nicht tiefer als die Dehnung zulässt.'],
  sumo_deadlift: ['Breiter Stand, Fußspitzen nach außen, Griff innen.', 'Knie nach außen drücken, Hüfte nah an die Stange.', 'Brust hoch, Stange senkrecht nach oben.'],
  rack_pull: ['Stange knapp unter oder über dem Knie in der Ablage.', 'Rücken neutral, Stange nach oben ziehen bis zur vollen Hüftstreckung.', 'Oben nicht nach hinten lehnen.'],
  back_ext: ['Polster auf Hüfthöhe, sodass du in der Hüfte beugen kannst.', 'Kontrolliert nach unten, dann bis zur geraden Linie hoch.', 'Nicht überstrecken; Zusatzgewicht vor der Brust für Progression.'],
  good_morning: ['Stange wie bei der Kniebeuge, Knie leicht gebeugt.', 'Hüfte nach hinten, Oberkörper nach vorn bis zur Dehnung.', 'Leicht beginnen – Rücken bleibt immer gerade.'],
  shrugs: ['Aufrecht, Arme gestreckt.', 'Schultern gerade nach oben zu den Ohren ziehen, kurz halten.', 'Nicht kreisen; langsam ganz runter.'],
  face_pull: ['Seil auf Kopfhöhe, Daumen zeigen nach hinten.', 'Zum Gesicht ziehen, Hände auseinander, Ellbogen hoch.', 'Am Ende Schultern nach außen drehen, kurz halten.'],
  reverse_fly: ['Brust ans Polster bzw. vorgebeugt, Arme leicht gebeugt.', 'Arme seitlich nach hinten führen – aus der hinteren Schulter.', 'Schulterblätter nicht stark zusammenziehen, sonst arbeitet der Rücken.'],

  // Schultern
  ohp: ['Stange auf der vorderen Schulter, Po und Bauch fest.', 'Senkrecht nach oben drücken, Kopf kurz nach hinten.', 'Oben Kopf durch, nicht ins Hohlkreuz fallen.'],
  db_shoulder_press: ['Sitzend mit Lehne oder stehend, Hanteln auf Ohrhöhe.', 'Nach oben drücken, Hanteln leicht zueinander.', 'Tief genug absenken (Hände etwa auf Kinnhöhe).'],
  machine_shoulder_press: ['Sitz so, dass Griffe etwa auf Schulterhöhe starten.', 'Rücken an die Lehne, kontrolliert hochdrücken.', 'Unten voller Weg, oben nicht ganz durchstrecken.'],
  arnold_press: ['Start mit Handflächen zu dir vor der Schulter.', 'Beim Drücken die Hände nach außen drehen.', 'Langsam zurückdrehen und absenken.'],
  lateral_raise: ['Leicht vorgebeugt, Ellbogen minimal gebeugt.', 'Arme seitlich bis Schulterhöhe heben, Ellbogen führen.', 'Kein Schwung – lieber leichter und dafür sauber nah ans Versagen.'],
  cable_lateral: ['Rolle unten, Kabel vor oder hinter dem Körper.', 'Arm seitlich bis Schulterhöhe heben.', 'Spannung auch unten – Vorteil gegenüber Kurzhanteln.'],
  machine_lateral: ['Sitz so, dass die Drehachse auf Schulterhöhe liegt.', 'Mit den Ellbogen gegen die Polster heben.', 'Langsam ab, ohne dass das Gewicht aufsetzt.'],
  front_raise: ['Arme leicht gebeugt, vor dem Körper.', 'Bis Augenhöhe heben, ohne Schwung.', 'Vordere Schulter arbeitet beim Drücken schon viel – oft verzichtbar.'],
  upright_row: ['Griff etwa schulterbreit (zu eng belastet die Schulter).', 'Ellbogen führen, bis etwa Schulterhöhe.', 'Bei Schmerzen vorne in der Schulter weglassen.'],
  landmine_press: ['Stangenende auf Schulterhöhe, leicht nach vorn gelehnt.', 'Schräg nach vorn oben drücken.', 'Gut bei Schulterproblemen – schonender Winkel.'],

  // Bizeps
  barbell_curl: ['Aufrecht, Ellbogen an den Seiten.', 'Hoch bis kurz vor die Schultern, ohne Ellbogen nach vorn.', 'Kein Schwung aus dem Rücken; langsam ganz absenken.'],
  db_curl: ['Ellbogen fix an der Seite.', 'Beim Hochcurlen Handfläche nach oben drehen.', 'Ganz absenken, unten nicht entspannen.'],
  hammer_curl: ['Neutraler Griff (Daumen oben), Ellbogen an der Seite.', 'Hochcurlen bis Schulterhöhe.', 'Trifft auch Oberarmmuskel und Unterarm.'],
  preacher_curl: ['Achsel an die Oberkante des Polsters.', 'Ganz absenken bis fast gestreckt – hier liegt der Wachstumsreiz.', 'Unten langsam, nicht fallen lassen.'],
  cable_curl: ['Rolle unten, einen Schritt zurück.', 'Ellbogen fix, hochcurlen.', 'Konstante Spannung – auch oben bewusst halten.'],
  incline_curl: ['Bank auf 45–60°, Arme hängen hinter dem Körper.', 'Curlen ohne die Ellbogen nach vorn zu bringen.', 'Starke Dehnung unten – sehr effektiv für den Bizeps.'],
  concentration_curl: ['Ellbogen innen am Oberschenkel abstützen.', 'Langsam hochcurlen, oben kurz anspannen.', 'Ganz strecken, ohne abzulegen.'],
  machine_curl: ['Ellbogen auf Höhe der Drehachse.', 'Kontrolliert hoch und ganz absenken.', 'Gut, um sicher nah ans Versagen zu gehen.'],

  // Trizeps
  pushdown: ['Ellbogen an den Seiten fixieren, leicht vorgebeugt.', 'Nach unten ganz strecken.', 'Ellbogen nicht nach vorn wandern lassen.'],
  rope_pushdown: ['Ellbogen fix, Seil nach unten ziehen.', 'Unten die Hände leicht auseinander ziehen.', 'Kontrolliert hoch bis ca. 90°.'],
  skullcrusher: ['Liegend, Oberarme leicht nach hinten geneigt.', 'SZ-Stange hinter den Kopf absenken – mehr Dehnung im langen Kopf.', 'Ellbogen nicht weit nach außen.'],
  overhead_ext: ['Arme über dem Kopf, Ellbogen nach vorn.', 'Tief hinter den Kopf absenken bis zur Dehnung.', 'Über-Kopf-Strecken baut den Trizeps besonders gut auf (Maeo 2023).'],
  close_bench: ['Griff schulterbreit (nicht enger), Ellbogen nah am Körper.', 'Zur unteren Brust absenken.', 'Handgelenke gerade halten.'],
  kickback: ['Oberkörper vorgebeugt, Oberarm parallel zum Boden und fix.', 'Unterarm nach hinten strecken.', 'Leicht wählen – sauber ist wichtiger als schwer.'],
  bench_dips: ['Hände hinter dir auf der Bank, Po nah an der Bank.', 'Absenken bis etwa 90° im Ellbogen.', 'Belastet die Schulter – bei Beschwerden lieber Pushdowns.'],
  triceps_machine: ['Sitz so, dass Griffe neben dem Körper sind.', 'Nach unten drücken bis zur Streckung.', 'Kontrolliert zurück.'],

  // Unterarme
  wrist_curl: ['Unterarme auf der Bank, Handgelenke über der Kante.', 'Gewicht bis in die Finger rollen lassen, dann hochcurlen.', 'Hohe Wiederholungen, langsam.'],
  reverse_curl: ['Obergriff, Ellbogen an der Seite.', 'Hochcurlen ohne Schwung.', 'Trainiert Unterarm und Oberarmmuskel.'],
  farmers_walk: ['Schwere Hanteln, aufrecht, Schultern unten.', 'Kurze, kontrollierte Schritte.', 'Strecke oder Zeit steigern, dann Gewicht.'],

  // Beine
  squat: ['Stange auf dem oberen Rücken, Füße schulterbreit, Fußspitzen leicht außen.', 'Hüfte und Knie gleichzeitig beugen, Knie in Richtung Fußspitzen.', 'Mindestens bis parallel – tiefere Kniebeugen bauen mehr Gesäß und Oberschenkel auf.'],
  front_squat: ['Stange vorn auf den Schultern, Ellbogen hoch.', 'Aufrechter Oberkörper, tief runter.', 'Ellbogen nicht fallen lassen.'],
  hack_squat: ['Füße mittig auf der Plattform, Rücken an das Polster.', 'Tief absenken, Knie dürfen über die Zehen.', 'Unten nicht abfedern, kontrolliert wenden.'],
  pendulum_squat: ['Füße mittig, Rücken an das Polster.', 'So tief wie möglich – große Dehnung im Quadrizeps.', 'Langsam ab, kräftig hoch.'],
  leg_press: ['Füße schulterbreit mittig, unterer Rücken bleibt am Polster.', 'Tief absenken, solange das Becken nicht abkippt.', 'Knie oben nicht durchstrecken.'],
  smith_squat: ['Füße etwas vor der Stange.', 'Tief runter, Rücken neutral.', 'Sicherung einstellen.'],
  goblet_squat: ['Hantel vor der Brust, Ellbogen nach unten.', 'Tief runter, Knie nach außen.', 'Gut zum Lernen der Kniebeuge.'],
  bulgarian_split: ['Hinterer Fuß auf der Bank, vorderer Fuß weit genug vorn.', 'Senkrecht absenken bis das hintere Knie fast den Boden berührt.', 'Oberkörper leicht nach vorn = mehr Gesäß.'],
  lunges: ['Großer Schritt, Oberkörper aufrecht.', 'Hinteres Knie fast bis zum Boden.', 'Über die Ferse des vorderen Fußes hochdrücken.'],
  step_up: ['Box so hoch, dass das Knie etwa 90° hat.', 'Nur mit dem oberen Bein hochdrücken.', 'Langsam wieder runter.'],
  leg_ext: ['Drehachse auf Kniehöhe, Rücken an die Lehne.', 'Ganz strecken, oben kurz halten.', 'Weit zurück in die Beugung. Lehne nach hinten = mehr Dehnung im geraden Schenkelmuskel.'],
  leg_curl_lying: ['Knie knapp über der Polsterkante, Hüfte unten.', 'Ferse zum Po ziehen.', 'Langsam strecken; Hüfte nicht anheben.'],
  leg_curl_seated: ['Polster knapp über der Ferse, Oberschenkel fest fixiert.', 'Nach unten/hinten beugen, kurz halten.', 'Sitzend wird der Beinbeuger mehr gedehnt – wächst besser als liegend (Maeo 2021).'],
  nordic_curl: ['Fersen fest fixiert, Körper gerade von Knie bis Kopf.', 'So langsam wie möglich nach vorn absinken.', 'Mit den Händen auffangen, mit Hilfe zurück.'],
  hip_thrust: ['Oberer Rücken an der Bank, Stange auf der Hüfte (mit Polster).', 'Hüfte hoch bis Oberkörper und Oberschenkel eine Linie bilden.', 'Kinn zur Brust, oben Gesäß fest anspannen.'],
  glute_bridge: ['Rücken am Boden, Füße nah am Po.', 'Hüfte hoch, Gesäß anspannen.', 'Kurz halten, langsam ab.'],
  adductor_machine: ['Weite Startposition für Dehnung.', 'Beine kontrolliert zusammendrücken.', 'Langsam zurück in die Dehnung.'],
  abductor_machine: ['Oberkörper leicht nach vorn = mehr Gesäß.', 'Beine nach außen drücken, kurz halten.', 'Kontrolliert zurück.'],
  cable_kickback: ['Manschette am Fußgelenk, Oberkörper leicht nach vorn.', 'Bein nach hinten strecken, Gesäß anspannen.', 'Nicht ins Hohlkreuz ausweichen.'],
  standing_calf: ['Fußballen auf der Kante.', 'Ganz tief in die Dehnung, unten 1–2 s halten.', 'Hoch auf die Zehenspitzen – kein Wippen.'],
  seated_calf: ['Polster auf den Oberschenkeln, Fußballen auf der Kante.', 'Tief runter, kurz halten, ganz hoch.', 'Langsam – Waden reagieren gut auf Pausen in der Dehnung.'],
  leg_press_calf: ['Fußballen unten an der Plattform, Knie gestreckt.', 'Weit in die Dehnung lassen.', 'Ganz durchdrücken.'],
  box_jump: ['Hüftbreit vor die Box.', 'Mit Armschwung explosiv springen, weich landen.', 'Runtersteigen statt springen.'],

  // Bauch / Core
  crunch: ['Füße am Boden, Hände an den Schläfen.', 'Oberkörper einrollen, Rippen zum Becken.', 'Nicht am Kopf ziehen.'],
  cable_crunch: ['Kniend, Seil neben dem Kopf.', 'Einrollen, Ellbogen zu den Knien.', 'Hüfte bleibt stehen – Bauch macht die Arbeit.'],
  ab_machine: ['Sitz so einstellen, dass du dich einrollen kannst.', 'Rippen zum Becken ziehen.', 'Langsam zurück.'],
  hanging_leg_raise: ['Aushängen, Schultern aktiv.', 'Becken einrollen und Beine heben.', 'Kein Schwung – langsam ab.'],
  leg_raise: ['Rücken flach, Hände unter dem Po.', 'Beine heben bis zur Senkrechten.', 'Langsam ab, ohne Hohlkreuz.'],
  situp: ['Füße fixiert, Hände an der Brust.', 'Einrollen bis oben.', 'Langsam ab.'],
  plank: ['Ellbogen unter den Schultern, Körper eine Linie.', 'Po und Bauch fest anspannen.', 'Zeit steigern, dann Gewicht auf den Rücken.'],
  side_plank: ['Ellbogen unter der Schulter, Körper gerade.', 'Hüfte hoch halten.', 'Beide Seiten gleich lang.'],
  russian_twist: ['Oberkörper leicht zurück, Rücken gerade.', 'Rumpf drehen, nicht nur die Arme.', 'Füße am Boden ist sicherer.'],
  ab_wheel: ['Kniend, Bauch fest, Becken eingerollt.', 'Nach vorn rollen, so weit du ohne Hohlkreuz kommst.', 'Mit dem Bauch zurückziehen.'],
  woodchopper: ['Kabel schräg, seitlich zum Zug stehen.', 'Diagonal ziehen, Rumpf dreht mit.', 'Hüfte stabil, kontrolliert zurück.'],
  pallof: ['Seitlich zum Kabel, Griff vor der Brust.', 'Arme gerade nach vorn drücken, nicht verdrehen lassen.', 'Kurz halten, zurück.'],
  dead_bug: ['Rücken flach am Boden.', 'Gegenüberliegenden Arm und Bein langsam strecken.', 'Unterer Rücken bleibt am Boden.'],

  // Ganzkörper
  power_clean: ['Wie Kreuzheben starten, Stange nah am Körper.', 'Explosiv Hüfte strecken und Stange auf die Schultern fangen.', 'Technik vor Gewicht – wenige, schnelle Wiederholungen.'],
  kb_swing: ['Hüfte nach hinten, Kugel zwischen die Beine.', 'Mit der Hüfte explosiv nach vorn schwingen.', 'Arme sind nur Seile, Rücken gerade.'],
  thruster: ['Frontkniebeuge mit Stange oder Kurzhanteln.', 'Aus der Tiefe direkt über Kopf drücken.', 'Atmung planen – sehr anstrengend.'],
  muscle_up: ['Explosiver Klimmzug bis zur Brust.', 'Oben schnell über die Stange kippen.', 'Erst saubere Klimmzüge und Dips beherrschen.'],
};

/** Allgemeine Tipps für eigene Übungen ohne Eintrag. */
export const GENERIC_TIPS = [
  'Gewicht kontrolliert absenken (ca. 2–3 Sekunden), kräftig hochbewegen.',
  'Den vollen Bewegungsweg nutzen – vor allem die gedehnte Position mitnehmen.',
  'Technik bleibt in jedem Satz gleich; wird sie unsauber, ist der Satz vorbei.',
];

export function tipsFor(exId) {
  return TIPS[exId] || GENERIC_TIPS;
}
