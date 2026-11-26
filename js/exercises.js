// =============================================================
// exercises.js – Muskelgruppen + eingebaute Übungsdatenbank
//
// Neue Übung ergänzen: eine Zeile in RAW einfügen:
//   [id, Name, 'Synonym1|Synonym2', 'primär1,primär2', 'sekundär1', einseitig?]
// einseitig = 1: links und rechts werden getrennt eingetragen (z. B. 20 kg × 10/9).
// Die id darf sich später nie ändern (sonst geht "Letztes Mal" verloren).
// =============================================================

import { data } from './store.js';

/** Muskelgruppen (Schlüssel = Muskel-Gruppe in der Körpergrafik, bodyimage.js). */
export const MUSCLES = {
  chest: 'Brust',
  front_delts: 'Vordere Schulter',
  side_delts: 'Seitliche Schulter',
  rear_delts: 'Hintere Schulter',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  abs: 'Bauch',
  obliques: 'Seitlicher Bauch',
  traps: 'Nacken / Trapez',
  upper_back: 'Oberer Rücken',
  lats: 'Latissimus',
  lower_back: 'Unterer Rücken',
  glutes: 'Gesäß',
  quads: 'Beinstrecker (Quadrizeps)',
  hamstrings: 'Beinbeuger',
  adductors: 'Adduktoren',
  calves: 'Waden',
};

// prettier-ignore
const RAW = [
  // Brust
  ['bench_press', 'Bankdrücken', 'Bench Press|Flachbankdrücken|Langhantel Bankdrücken|Flachbank', 'chest', 'triceps,front_delts'],
  ['incline_bench', 'Schrägbankdrücken', 'Incline Bench Press|Schrägbank Langhantel|Schrägbank', 'chest,front_delts', 'triceps'],
  ['decline_bench', 'Negativ-Bankdrücken', 'Decline Bench Press|Negativbank', 'chest', 'triceps'],
  ['db_bench', 'Kurzhantel-Bankdrücken', 'Dumbbell Bench Press|KH Bankdrücken|DB Bench', 'chest', 'triceps,front_delts'],
  ['db_incline', 'Kurzhantel-Schrägbankdrücken', 'Incline Dumbbell Press|KH Schrägbank|Schrägbank Kurzhantel', 'chest,front_delts', 'triceps'],
  ['db_fly', 'Fliegende (Kurzhantel)', 'Dumbbell Fly|Flys|Flyes|Kurzhantel Fliegende', 'chest', 'front_delts'],
  ['cable_fly', 'Kabelzug-Fliegende', 'Cable Fly|Cable Crossover|Kabel Crossover|Kabelziehen', 'chest', 'front_delts'],
  ['low_cable_fly', 'Kabelzug-Fliegende von unten', 'Low to High Cable Fly|Kabel von unten', 'chest,front_delts', ''],
  ['pec_deck', 'Butterfly-Maschine', 'Pec Deck|Butterfly|Chest Fly Machine', 'chest', 'front_delts'],
  ['chest_press', 'Brustpresse', 'Chest Press|Machine Chest Press|Brustpresse Maschine', 'chest', 'triceps,front_delts'],
  ['smith_bench', 'Bankdrücken Multipresse', 'Smith Machine Bench Press|Smith Bankdrücken', 'chest', 'triceps,front_delts'],
  ['pushup', 'Liegestütze', 'Push-Up|Pushups|Liegestütz', 'chest', 'triceps,front_delts,abs'],
  ['dips', 'Dips', 'Barrenstütz|Chest Dips|Barren Dips', 'chest,triceps', 'front_delts'],

  // Rücken
  ['pullup', 'Klimmzüge', 'Pull-Up|Pullups|Klimmzug', 'lats', 'biceps,upper_back'],
  ['chinup', 'Klimmzüge Untergriff', 'Chin-Up|Chinups', 'lats,biceps', 'upper_back'],
  ['assisted_pullup', 'Klimmzüge mit Unterstützung', 'Assisted Pull-Up|Klimmzugmaschine|Gravitron', 'lats', 'biceps,upper_back'],
  ['lat_pulldown', 'Latzug', 'Lat Pulldown|Latziehen|Lat Zug|Latzug breit', 'lats', 'biceps,upper_back'],
  ['close_pulldown', 'Latzug eng', 'Close Grip Lat Pulldown|V-Griff Latzug|enger Latzug', 'lats', 'biceps,upper_back'],
  ['barbell_row', 'Langhantelrudern', 'Barbell Row|Vorgebeugtes Rudern|Bent Over Row|LH Rudern', 'upper_back,lats', 'biceps,rear_delts,lower_back'],
  ['db_row', 'Kurzhantelrudern', 'Dumbbell Row|Einarmiges Rudern|One Arm Row|KH Rudern', 'lats,upper_back', 'biceps,rear_delts', 1],
  ['cable_row', 'Rudern am Kabelzug', 'Seated Cable Row|Kabelrudern|Sitzendes Rudern|Low Row', 'upper_back,lats', 'biceps,rear_delts'],
  ['machine_row', 'Rudermaschine', 'Machine Row|Rudern Maschine|Chest Supported Row', 'upper_back,lats', 'biceps,rear_delts'],
  ['tbar_row', 'T-Bar-Rudern', 'T-Bar Row|T Bar Rudern', 'upper_back,lats', 'biceps,lower_back'],
  ['pendlay_row', 'Pendlay-Rudern', 'Pendlay Row', 'upper_back,lats', 'lower_back,biceps'],
  ['straight_arm_pulldown', 'Überzüge am Kabel', 'Straight Arm Pulldown|Pullover Kabel|Lat Pullover', 'lats', 'triceps'],
  ['pullover', 'Überzüge Kurzhantel', 'Dumbbell Pullover|Pullover', 'lats,chest', 'triceps'],
  ['deadlift', 'Kreuzheben', 'Deadlift|Kreuz heben|Conventional Deadlift', 'lower_back,glutes,hamstrings', 'quads,traps,forearms'],
  ['rdl', 'Rumänisches Kreuzheben', 'Romanian Deadlift|RDL|Gestrecktes Kreuzheben|Stiff Leg Deadlift', 'hamstrings,glutes', 'lower_back'],
  ['sumo_deadlift', 'Sumo-Kreuzheben', 'Sumo Deadlift', 'glutes,quads,adductors', 'lower_back,hamstrings'],
  ['rack_pull', 'Rack Pulls', 'Rack Pull|Teilkreuzheben', 'lower_back,traps', 'glutes,hamstrings'],
  ['back_ext', 'Rückenstrecker', 'Back Extension|Hyperextension|Hyperextensions|Rückenstrecken', 'lower_back', 'glutes,hamstrings'],
  ['good_morning', 'Good Mornings', 'Good Morning', 'hamstrings,lower_back', 'glutes'],
  ['shrugs', 'Shrugs', 'Schulterheben|Nackenheben|Shrug', 'traps', 'forearms'],
  ['face_pull', 'Face Pulls', 'Face Pull|Seil zum Gesicht', 'rear_delts,upper_back', 'traps'],
  ['reverse_fly', 'Reverse Butterfly', 'Reverse Fly|Rear Delt Fly|Reverse Flys|Butterfly reverse', 'rear_delts', 'upper_back'],

  // Schultern
  ['ohp', 'Schulterdrücken Langhantel', 'Overhead Press|OHP|Military Press|Schulterdrücken stehend|Shoulder Press', 'front_delts', 'side_delts,triceps'],
  ['db_shoulder_press', 'Kurzhantel-Schulterdrücken', 'Dumbbell Shoulder Press|Schulterdrücken KH|Shoulder Press Dumbbell', 'front_delts', 'side_delts,triceps'],
  ['machine_shoulder_press', 'Schulterpresse', 'Shoulder Press Machine|Schulterdrücken Maschine', 'front_delts', 'side_delts,triceps'],
  ['arnold_press', 'Arnold Press', 'Arnold Drücken', 'front_delts,side_delts', 'triceps'],
  ['lateral_raise', 'Seitheben', 'Lateral Raise|Seitheben Kurzhantel|Side Raise|Seitliches Heben', 'side_delts', 'traps'],
  ['cable_lateral', 'Seitheben am Kabel', 'Cable Lateral Raise|Kabel Seitheben', 'side_delts', '', 1],
  ['machine_lateral', 'Seitheben Maschine', 'Lateral Raise Machine', 'side_delts', ''],
  ['front_raise', 'Frontheben', 'Front Raise|Frontheben Kurzhantel', 'front_delts', 'chest'],
  ['upright_row', 'Aufrechtes Rudern', 'Upright Row', 'side_delts,traps', 'biceps'],
  ['landmine_press', 'Landmine Press', 'Landmine Drücken', 'front_delts,chest', 'triceps'],

  // Bizeps
  ['barbell_curl', 'Langhantel-Curls', 'Barbell Curl|SZ-Curls|SZ Curls|EZ Bar Curl|Bizepscurls Langhantel', 'biceps', 'forearms'],
  ['db_curl', 'Kurzhantel-Curls', 'Dumbbell Curl|Bizeps Curls|Bizepscurls|KH Curls', 'biceps', 'forearms'],
  ['hammer_curl', 'Hammer Curls', 'Hammercurls|Hammer Curl', 'biceps,forearms', ''],
  ['preacher_curl', 'Scottcurls', 'Preacher Curl|Scott Curls|Larry Scott|Scottbank', 'biceps', ''],
  ['cable_curl', 'Kabel-Curls', 'Cable Curl|Bizeps Kabel|Bizepscurls Kabel', 'biceps', 'forearms'],
  ['incline_curl', 'Schrägbank-Curls', 'Incline Dumbbell Curl|Incline Curl', 'biceps', ''],
  ['concentration_curl', 'Konzentrationscurls', 'Concentration Curl', 'biceps', '', 1],
  ['machine_curl', 'Bizepsmaschine', 'Biceps Curl Machine|Bizeps Maschine', 'biceps', ''],

  // Trizeps
  ['pushdown', 'Trizepsdrücken am Kabel', 'Triceps Pushdown|Pushdown|Trizeps Kabel|Trizepsdrücken', 'triceps', ''],
  ['rope_pushdown', 'Trizepsdrücken mit Seil', 'Rope Pushdown|Seil Pushdown|Trizeps Seil', 'triceps', ''],
  ['skullcrusher', 'French Press', 'Skull Crusher|Stirndrücken|SZ French Press|Skullcrusher', 'triceps', ''],
  ['overhead_ext', 'Trizepsdrücken über Kopf', 'Overhead Triceps Extension|Overhead Extension|Kabel über Kopf', 'triceps', ''],
  ['close_bench', 'Enges Bankdrücken', 'Close Grip Bench Press|Bankdrücken eng', 'triceps,chest', 'front_delts'],
  ['kickback', 'Trizeps-Kickbacks', 'Triceps Kickback|Kickbacks', 'triceps', '', 1],
  ['bench_dips', 'Dips an der Bank', 'Bench Dips|Bankdips', 'triceps', 'chest,front_delts'],
  ['triceps_machine', 'Trizepsmaschine', 'Triceps Machine|Dip Maschine|Dipmaschine', 'triceps', 'chest'],

  // Unterarme
  ['wrist_curl', 'Handgelenk-Curls', 'Wrist Curl|Unterarmcurls|Unterarm Curls', 'forearms', ''],
  ['reverse_curl', 'Reverse Curls', 'Reverse Curl|Obergriff Curls', 'forearms,biceps', ''],
  ['farmers_walk', 'Farmer’s Walk', 'Farmers Walk|Farmers Carry|Bauerngang', 'forearms,traps', 'abs,glutes'],

  // Beine
  ['squat', 'Kniebeuge', 'Squat|Back Squat|Kniebeugen|Langhantel Kniebeuge', 'quads,glutes', 'hamstrings,lower_back,adductors'],
  ['front_squat', 'Frontkniebeuge', 'Front Squat|Frontkniebeugen', 'quads', 'glutes,abs'],
  ['hack_squat', 'Hackenschmidt', 'Hack Squat|Hackenschmidt Kniebeuge|Hackenschmidtmaschine', 'quads', 'glutes'],
  ['pendulum_squat', 'Pendulum Squat', 'Pendel Kniebeuge', 'quads', 'glutes'],
  ['leg_press', 'Beinpresse', 'Leg Press|Beinpressen', 'quads,glutes', 'hamstrings,adductors'],
  ['smith_squat', 'Kniebeuge Multipresse', 'Smith Machine Squat|Smith Squat', 'quads,glutes', ''],
  ['goblet_squat', 'Goblet Squat', 'Goblet Kniebeuge', 'quads,glutes', 'abs'],
  ['bulgarian_split', 'Bulgarian Split Squats', 'Bulgarische Kniebeuge|Split Squat|Bulgarian', 'quads,glutes', 'hamstrings,adductors', 1],
  ['lunges', 'Ausfallschritte', 'Lunges|Ausfallschritt|Walking Lunges', 'quads,glutes', 'hamstrings', 1],
  ['step_up', 'Step-Ups', 'Aufsteiger|Step Up', 'quads,glutes', '', 1],
  ['leg_ext', 'Beinstrecker', 'Leg Extension|Beinstrecken|Leg Extensions', 'quads', ''],
  ['leg_curl_lying', 'Beinbeuger liegend', 'Lying Leg Curl|Leg Curl|Beinbeugen', 'hamstrings', 'calves'],
  ['leg_curl_seated', 'Beinbeuger sitzend', 'Seated Leg Curl|Leg Curl sitzend', 'hamstrings', ''],
  ['nordic_curl', 'Nordic Curls', 'Nordic Hamstring Curl|Nordics', 'hamstrings', ''],
  ['hip_thrust', 'Hip Thrust', 'Hip Thrusts|Hüftstoß|Hüftheben', 'glutes', 'hamstrings'],
  ['glute_bridge', 'Glute Bridge', 'Beckenheben|Bridge', 'glutes', 'hamstrings'],
  ['adductor_machine', 'Adduktorenmaschine', 'Adductor Machine|Adduktoren|Beine zusammen', 'adductors', ''],
  ['abductor_machine', 'Abduktorenmaschine', 'Abductor Machine|Abduktoren|Beine auseinander', 'glutes', ''],
  ['cable_kickback', 'Glute Kickbacks am Kabel', 'Cable Kickback|Kickback Kabel|Glute Kickback', 'glutes', 'hamstrings', 1],
  ['standing_calf', 'Wadenheben stehend', 'Standing Calf Raise|Wadenheben|Calf Raise|Waden', 'calves', ''],
  ['seated_calf', 'Wadenheben sitzend', 'Seated Calf Raise', 'calves', ''],
  ['leg_press_calf', 'Wadenheben Beinpresse', 'Calf Press|Wadendrücken', 'calves', ''],
  ['box_jump', 'Box Jumps', 'Box Jump|Kastensprünge', 'quads,glutes', 'calves'],

  // Bauch / Core
  ['crunch', 'Crunches', 'Crunch|Bauchpresse', 'abs', ''],
  ['cable_crunch', 'Kabel-Crunches', 'Cable Crunch|Kniender Crunch', 'abs', ''],
  ['ab_machine', 'Bauchmaschine', 'Ab Crunch Machine|Bauch Maschine', 'abs', ''],
  ['hanging_leg_raise', 'Hängendes Beinheben', 'Hanging Leg Raise|Beinheben hängend|Knee Raise', 'abs', 'obliques,forearms'],
  ['leg_raise', 'Beinheben liegend', 'Lying Leg Raise|Beinheben', 'abs', ''],
  ['situp', 'Sit-ups', 'Situps|Sit up', 'abs', ''],
  ['plank', 'Plank', 'Unterarmstütz|Planke|Brett', 'abs', 'obliques'],
  ['side_plank', 'Seitstütz', 'Side Plank', 'obliques', 'abs'],
  ['russian_twist', 'Russian Twist', 'Russian Twists', 'obliques', 'abs'],
  ['ab_wheel', 'Ab Wheel', 'Bauchroller|Ab Roller|Rollout', 'abs', 'lats'],
  ['woodchopper', 'Holzhacker', 'Woodchopper|Cable Woodchop', 'obliques', 'abs'],
  ['pallof', 'Pallof Press', 'Anti Rotation', 'obliques,abs', ''],
  ['dead_bug', 'Dead Bug', 'Deadbug', 'abs', ''],

  // Einseitige Varianten (links/rechts getrennt)
  ['single_arm_cable_row', 'Einarmiges Kabelrudern', 'Single Arm Cable Row|Kabelrudern einarmig', 'lats,upper_back', 'biceps,rear_delts', 1],
  ['single_arm_pulldown', 'Einarmiger Latzug', 'Single Arm Lat Pulldown|Latzug einarmig', 'lats', 'biceps', 1],
  ['single_arm_db_press', 'Einarmiges Kurzhantel-Schulterdrücken', 'Single Arm Dumbbell Press|Schulterdrücken einarmig', 'front_delts', 'side_delts,triceps', 1],
  ['single_arm_chest_press', 'Einarmige Brustpresse', 'Single Arm Chest Press|Brustpresse einarmig', 'chest', 'triceps,front_delts', 1],
  ['single_arm_cable_curl', 'Einarmige Kabel-Curls (Bayesian)', 'Bayesian Curl|Single Arm Cable Curl|Kabelcurl einarmig', 'biceps', '', 1],
  ['single_arm_pushdown', 'Einarmiges Trizepsdrücken am Kabel', 'Single Arm Pushdown|Trizeps einarmig', 'triceps', '', 1],
  ['single_arm_overhead_ext', 'Einarmiges Trizepsdrücken über Kopf', 'Single Arm Overhead Extension', 'triceps', '', 1],
  ['single_leg_press', 'Einbeinige Beinpresse', 'Single Leg Press|Beinpresse einbeinig', 'quads,glutes', 'hamstrings', 1],
  ['single_leg_ext', 'Einbeiniger Beinstrecker', 'Single Leg Extension|Beinstrecker einbeinig', 'quads', '', 1],
  ['single_leg_curl', 'Einbeiniger Beinbeuger', 'Single Leg Curl|Beinbeuger einbeinig', 'hamstrings', '', 1],
  ['single_leg_rdl', 'Einbeiniges Rumänisches Kreuzheben', 'Single Leg RDL|Einbeiniges Kreuzheben', 'hamstrings,glutes', 'lower_back', 1],
  ['single_leg_calf', 'Einbeiniges Wadenheben', 'Single Leg Calf Raise|Wadenheben einbeinig', 'calves', '', 1],
  ['single_leg_hip_thrust', 'Einbeiniger Hip Thrust', 'Single Leg Hip Thrust', 'glutes', 'hamstrings', 1],

  // Ganzkörper
  ['power_clean', 'Umsetzen', 'Power Clean|Clean', 'glutes,hamstrings,traps', 'quads,lower_back'],
  ['kb_swing', 'Kettlebell Swings', 'KB Swing|Kettlebell Swing', 'glutes,hamstrings', 'lower_back'],
  ['thruster', 'Thrusters', 'Thruster', 'quads,front_delts', 'glutes,triceps'],
  ['muscle_up', 'Muscle-Ups', 'Muscle Up', 'lats,chest', 'triceps'],
];

const split = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

/** Eingebaute Übungen als Objekte. */
export const BUILTIN = RAW.map(([id, name, aliases, primary, secondary, uni]) => ({
  id,
  name,
  aliases: aliases ? aliases.split('|') : [],
  primary: split(primary),
  secondary: split(secondary),
  uni: !!uni,
}));

const BUILTIN_BY_ID = new Map(BUILTIN.map((e) => [e.id, e]));

/** Alle Übungen: eingebaute + eigene. */
export function allExercises() {
  return [...BUILTIN, ...data.customExercises.map((e) => ({ aliases: [], secondary: [], ...e, custom: true }))];
}

/** Übung per id (eingebaut oder eigene) oder null. */
export function getExercise(id) {
  return BUILTIN_BY_ID.get(id) || data.customExercises.find((e) => e.id === id) || null;
}

/** "Brust, Trizeps" */
export function muscleNames(keys) {
  return (keys || []).map((k) => MUSCLES[k] || k).join(', ');
}
