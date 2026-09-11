/**
 * 25 customers and 30 vessels. IDs are deterministic so the eval golden set and
 * fixtures can reference them.
 */

export const customers = [
  { id: "cus_patterson_dana", name: "Dana Patterson", email: "dana.patterson@example.com", phone: "(772) 555-0141" },
  { id: "cus_whitaker_tom", name: "Tom Whitaker", email: "tom.whitaker@example.com", phone: "(772) 555-0192" },
  { id: "cus_marsh_ellen", name: "Ellen Marsh", email: "ellen.marsh@example.com", phone: "(561) 555-0117" },
  { id: "cus_kowalski_ben", name: "Ben Kowalski", email: "ben.kowalski@example.com", phone: "(772) 555-0163" },
  { id: "cus_alvarez_marisol", name: "Marisol Alvarez", email: "marisol.alvarez@example.com", phone: "(561) 555-0128" },
  { id: "cus_greer_hank", name: "Hank Greer", email: "hank.greer@example.com", phone: "(772) 555-0109" },
  { id: "cus_oyelaran_femi", name: "Femi Oyelaran", email: "femi.oyelaran@example.com", phone: "(407) 555-0154" },
  { id: "cus_donnelly_shauna", name: "Shauna Donnelly", email: "shauna.donnelly@example.com", phone: "(772) 555-0176" },
  { id: "cus_chen_michael", name: "Michael Chen", email: "michael.chen@example.com", phone: "(561) 555-0185" },
  { id: "cus_rivera_luis", name: "Luis Rivera", email: "luis.rivera@example.com", phone: "(772) 555-0132" },
  { id: "cus_hollis_grace", name: "Grace Hollis", email: "grace.hollis@example.com", phone: "(772) 555-0148" },
  { id: "cus_nakamura_ken", name: "Ken Nakamura", email: "ken.nakamura@example.com", phone: "(305) 555-0171" },
  { id: "cus_burke_aidan", name: "Aidan Burke", email: "aidan.burke@example.com", phone: "(772) 555-0113" },
  { id: "cus_fontaine_claire", name: "Claire Fontaine", email: "claire.fontaine@example.com", phone: "(561) 555-0139" },
  { id: "cus_mbeki_sam", name: "Sam Mbeki", email: "sam.mbeki@example.com", phone: "(772) 555-0158" },
  { id: "cus_thornton_beth", name: "Beth Thornton", email: "beth.thornton@example.com", phone: "(772) 555-0167" },
  { id: "cus_vasquez_ramon", name: "Ramon Vasquez", email: "ramon.vasquez@example.com", phone: "(305) 555-0124" },
  { id: "cus_ostrowski_peter", name: "Peter Ostrowski", email: "peter.ostrowski@example.com", phone: "(772) 555-0181" },
  { id: "cus_adebayo_tunde", name: "Tunde Adebayo", email: "tunde.adebayo@example.com", phone: "(954) 555-0146" },
  { id: "cus_lindgren_sofia", name: "Sofia Lindgren", email: "sofia.lindgren@example.com", phone: "(772) 555-0195" },
  { id: "cus_hargrove_walt", name: "Walt Hargrove", email: "walt.hargrove@example.com", phone: "(772) 555-0102" },
  { id: "cus_pham_linh", name: "Linh Pham", email: "linh.pham@example.com", phone: "(561) 555-0166" },
  { id: "cus_okonkwo_ada", name: "Ada Okonkwo", email: "ada.okonkwo@example.com", phone: "(772) 555-0137" },
  { id: "cus_sullivan_pat", name: "Pat Sullivan", email: "pat.sullivan@example.com", phone: "(772) 555-0119" },
  { id: "cus_brennan_kate", name: "Kate Brennan", email: "kate.brennan@example.com", phone: "(561) 555-0173" },
].map((c) => ({ ...c, portalEnabled: true, arBalance: 0 }));

export type Propulsion = "outboard" | "sterndrive" | "inboard" | "sail";

export interface VesselSeed {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  lengthFt: number;
  hin: string;
  engineMake: string;
  engineModel: string;
  engineCount: number;
  engineHours: number;
  location: string;
  customerId: string;
  /** Not a DB column; used by the work order generator to pick sensible jobs. */
  propulsion: Propulsion;
}

export const vessels: VesselSeed[] = [
  { id: "ves_reel_therapy", name: "Reel Therapy", make: "Sea Ray", model: "400 Sundancer", year: 2019, lengthFt: 40, hin: "SERK81904471", engineMake: "MerCruiser", engineModel: "8.2 MAG ECT", engineCount: 2, engineHours: 640, location: "Slip C-12", customerId: "cus_patterson_dana", propulsion: "sterndrive" },
  { id: "ves_salt_shaker", name: "Salt Shaker", make: "Grady-White", model: "Canyon 306", year: 2021, lengthFt: 30, hin: "GDYD12152217", engineMake: "Yamaha", engineModel: "F300", engineCount: 2, engineHours: 410, location: "Slip B-04", customerId: "cus_whitaker_tom", propulsion: "outboard" },
  { id: "ves_windward_sky", name: "Windward Sky", make: "Catalina", model: "385", year: 2016, lengthFt: 38.5, hin: "CTYF61638522", engineMake: "Yanmar", engineModel: "3YM30AE", engineCount: 1, engineHours: 1150, location: "Slip A-08", customerId: "cus_marsh_ellen", propulsion: "sail" },
  { id: "ves_blue_heron", name: "Blue Heron", make: "Boston Whaler", model: "285 Conquest", year: 2018, lengthFt: 28, hin: "BWCB81877120", engineMake: "Mercury", engineModel: "Verado 300", engineCount: 2, engineHours: 520, location: "Rack B-07", customerId: "cus_kowalski_ben", propulsion: "outboard" },
  { id: "ves_second_wind", name: "Second Wind", make: "Beneteau", model: "Oceanis 41", year: 2014, lengthFt: 41, hin: "BEYH31444880", engineMake: "Yanmar", engineModel: "4JH45", engineCount: 1, engineHours: 1820, location: "Slip A-02", customerId: "cus_alvarez_marisol", propulsion: "sail" },
  { id: "ves_lady_luck", name: "Lady Luck", make: "Viking", model: "55 Convertible", year: 2012, lengthFt: 55, hin: "VKYA21255081", engineMake: "Cummins", engineModel: "QSM11", engineCount: 2, engineHours: 2900, location: "Slip D-01", customerId: "cus_greer_hank", propulsion: "inboard" },
  { id: "ves_off_the_clock", name: "Off the Clock", make: "Regulator", model: "28", year: 2020, lengthFt: 28, hin: "RGLE02028104", engineMake: "Yamaha", engineModel: "F300", engineCount: 2, engineHours: 310, location: "Rack A-12", customerId: "cus_oyelaran_femi", propulsion: "outboard" },
  { id: "ves_persistence", name: "Persistence", make: "Pursuit", model: "S 328", year: 2017, lengthFt: 32, hin: "PURG71732871", engineMake: "Yamaha", engineModel: "F300", engineCount: 2, engineHours: 690, location: "Slip B-09", customerId: "cus_donnelly_shauna", propulsion: "outboard" },
  { id: "ves_serendipity", name: "Serendipity", make: "Sea Ray", model: "350 Sundancer", year: 2015, lengthFt: 35, hin: "SERD41599023", engineMake: "MerCruiser", engineModel: "8.2 MAG", engineCount: 2, engineHours: 780, location: "Slip C-05", customerId: "cus_chen_michael", propulsion: "sterndrive" },
  { id: "ves_knot_working", name: "Knot Working", make: "Boston Whaler", model: "230 Outrage", year: 2019, lengthFt: 23, hin: "BWCF81933915", engineMake: "Mercury", engineModel: "Verado 250", engineCount: 1, engineHours: 350, location: "Rack A-03", customerId: "cus_rivera_luis", propulsion: "outboard" },
  { id: "ves_summer_salt", name: "Summer Salt", make: "Grady-White", model: "Freedom 275", year: 2022, lengthFt: 27, hin: "GDYC22261805", engineMake: "Yamaha", engineModel: "F250", engineCount: 2, engineHours: 190, location: "Rack B-02", customerId: "cus_hollis_grace", propulsion: "outboard" },
  { id: "ves_tenacity", name: "Tenacity", make: "Viking", model: "42 Open", year: 2010, lengthFt: 42, hin: "VKYK11042233", engineMake: "Cummins", engineModel: "QSC8.3", engineCount: 2, engineHours: 3400, location: "Slip D-04", customerId: "cus_nakamura_ken", propulsion: "inboard" },
  { id: "ves_irish_wake", name: "Irish Wake", make: "Beneteau", model: "Gran Turismo 40", year: 2018, lengthFt: 40, hin: "BEYB61805174", engineMake: "Volvo Penta", engineModel: "D4-300", engineCount: 2, engineHours: 610, location: "Slip C-02", customerId: "cus_burke_aidan", propulsion: "inboard" },
  { id: "ves_c_est_la_vie", name: "C'est la Vie", make: "Catalina", model: "355", year: 2013, lengthFt: 35.5, hin: "CTYE31335519", engineMake: "Yanmar", engineModel: "3YM30", engineCount: 1, engineHours: 1400, location: "Slip A-10", customerId: "cus_fontaine_claire", propulsion: "sail" },
  { id: "ves_nautilus", name: "Nautilus", make: "Sea Ray", model: "270 SLX", year: 2016, lengthFt: 27, hin: "SERH61641038", engineMake: "MerCruiser", engineModel: "6.2 MPI", engineCount: 1, engineHours: 480, location: "Rack C-01", customerId: "cus_mbeki_sam", propulsion: "sterndrive" },
  { id: "ves_carpe_diem", name: "Carpe Diem", make: "Pursuit", model: "DC 326", year: 2019, lengthFt: 32, hin: "PURA91932612", engineMake: "Yamaha", engineModel: "F300", engineCount: 2, engineHours: 540, location: "Slip B-11", customerId: "cus_thornton_beth", propulsion: "outboard" },
  { id: "ves_la_sirena", name: "La Sirena", make: "Sea Ray", model: "310 Sundancer", year: 2011, lengthFt: 31, hin: "SERC11122104", engineMake: "MerCruiser", engineModel: "350 MAG", engineCount: 2, engineHours: 1050, location: "Slip C-08", customerId: "cus_vasquez_ramon", propulsion: "sterndrive" },
  { id: "ves_northern_light", name: "Northern Light", make: "Boston Whaler", model: "345 Conquest", year: 2015, lengthFt: 34, hin: "BWCD51590346", engineMake: "Mercury", engineModel: "Verado 300", engineCount: 3, engineHours: 890, location: "Slip B-14", customerId: "cus_ostrowski_peter", propulsion: "outboard" },
  { id: "ves_high_cotton", name: "High Cotton", make: "Viking", model: "48 Convertible", year: 2008, lengthFt: 48, hin: "VKYJ20848117", engineMake: "Cummins", engineModel: "QSM11", engineCount: 2, engineHours: 4100, location: "Slip D-06", customerId: "cus_adebayo_tunde", propulsion: "inboard" },
  { id: "ves_fika", name: "Fika", make: "Beneteau", model: "Oceanis 46.1", year: 2020, lengthFt: 46, hin: "BEYK62077891", engineMake: "Yanmar", engineModel: "4JH57", engineCount: 1, engineHours: 520, location: "Slip A-01", customerId: "cus_lindgren_sofia", propulsion: "sail" },
  { id: "ves_reel_estate", name: "Reel Estate", make: "Regulator", model: "34", year: 2017, lengthFt: 34, hin: "RGLH71734220", engineMake: "Yamaha", engineModel: "F350", engineCount: 2, engineHours: 720, location: "Slip B-06", customerId: "cus_hargrove_walt", propulsion: "outboard" },
  { id: "ves_seas_the_day", name: "Seas the Day", make: "Sea Ray", model: "SLX 400", year: 2021, lengthFt: 40, hin: "SERJ22111883", engineMake: "MerCruiser", engineModel: "8.2 MAG ECT", engineCount: 2, engineHours: 280, location: "Slip C-14", customerId: "cus_pham_linh", propulsion: "sterndrive" },
  { id: "ves_daydream", name: "Daydream", make: "Grady-White", model: "Fisherman 257", year: 2018, lengthFt: 25, hin: "GDYG81848331", engineMake: "Yamaha", engineModel: "F300", engineCount: 1, engineHours: 430, location: "Rack A-07", customerId: "cus_okonkwo_ada", propulsion: "outboard" },
  { id: "ves_wanderlust", name: "Wanderlust", make: "Catalina", model: "320", year: 2009, lengthFt: 32, hin: "CTYB20932107", engineMake: "Yanmar", engineModel: "3GM30F", engineCount: 1, engineHours: 2100, location: "Slip A-06", customerId: "cus_sullivan_pat", propulsion: "sail" },
  { id: "ves_kingfisher", name: "Kingfisher", make: "Pursuit", model: "OS 385", year: 2014, lengthFt: 38, hin: "PURC31438544", engineMake: "Yamaha", engineModel: "F350", engineCount: 2, engineHours: 1100, location: "Slip B-01", customerId: "cus_brennan_kate", propulsion: "outboard" },
  // Second vessels for existing customers (30 total).
  { id: "ves_little_luck", name: "Little Luck", make: "Boston Whaler", model: "170 Montauk", year: 2020, lengthFt: 17, hin: "BWCE02055127", engineMake: "Mercury", engineModel: "90 FourStroke", engineCount: 1, engineHours: 120, location: "Rack A-15", customerId: "cus_greer_hank", propulsion: "outboard" },
  { id: "ves_serenity_now", name: "Serenity Now", make: "Grady-White", model: "Canyon 336", year: 2022, lengthFt: 33, hin: "GDYA12270021", engineMake: "Yamaha", engineModel: "F300", engineCount: 2, engineHours: 150, location: "Slip B-03", customerId: "cus_chen_michael", propulsion: "outboard" },
  { id: "ves_blue_heron_ii", name: "Blue Heron II", make: "Regulator", model: "25", year: 2016, lengthFt: 25, hin: "RGLF41625199", engineMake: "Yamaha", engineModel: "F300", engineCount: 1, engineHours: 610, location: "Rack B-10", customerId: "cus_kowalski_ben", propulsion: "outboard" },
  { id: "ves_lagom", name: "Lagom", make: "Sea Ray", model: "SPX 210", year: 2019, lengthFt: 21, hin: "SERK41966770", engineMake: "MerCruiser", engineModel: "4.5 MPI", engineCount: 1, engineHours: 210, location: "Rack C-04", customerId: "cus_lindgren_sofia", propulsion: "sterndrive" },
  { id: "ves_cotton_tail", name: "Cotton Tail", make: "Pursuit", model: "C 238", year: 2015, lengthFt: 23, hin: "PURD91523811", engineMake: "Yamaha", engineModel: "F250", engineCount: 1, engineHours: 560, location: "Rack A-09", customerId: "cus_adebayo_tunde", propulsion: "outboard" },
];

export const vesselRows = vessels.map(({ propulsion, ...v }) => {
  void propulsion; // not a DB column
  return v;
});
