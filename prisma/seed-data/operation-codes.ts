/**
 * Operation codes (the yard's labour standards) and the parts kits attached to
 * them. Kit quantities are per engine for engine-category operations; the
 * estimate builder multiplies by Vessel.engineCount. Engine kits list parts for
 * several engine brands; the builder filters KitItems by Part.fitsEngineMakes
 * against the vessel's engine make.
 */

export interface OpCodeSeed {
  code: string;
  description: string;
  category: string;
  standardHours: number;
  laborRate?: number;
  keywords: string[];
  maintenanceIntervalMonths?: number;
  /** partNumber -> qty (per engine for engine-category ops) */
  kit?: Record<string, number>;
}

export const operationCodes: OpCodeSeed[] = [
  // ---------------------------------------------------------------- engine
  {
    code: "ENG-IMP-01", description: "Replace raw water pump impeller", category: "engine", standardHours: 1.0,
    maintenanceIntervalMonths: 24,
    keywords: ["impeller", "chewed up", "missing vanes", "vanes", "raw water impeller", "sea water impeller", "water pump impeller", "running hot", "overheating", "no water flow", "weak tell tale", "replace impeller"],
    kit: { "47-8M0104229": 1, "25-8M0055285": 1, "8M0159831": 1, "6CE-W0078-01-00": 1, "21951346": 1, "3907908": 1, "129470-42530": 1 },
  },
  {
    code: "ENG-RWP-01", description: "Replace raw water pump assembly", category: "engine", standardHours: 2.5,
    keywords: ["raw water pump", "sea water pump", "pump weeping", "weeping at the seal", "pump seal leak", "pump leaking", "pump bearing", "seawater pump", "replace pump", "running hot", "pump shaft"],
    kit: { "8M0139545": 1, "8M0114145": 1, "3593875": 1, "4089392": 1, "119773-42600": 1 },
  },
  {
    code: "ENG-CLF-01", description: "Flush closed cooling system", category: "engine", standardHours: 1.0,
    maintenanceIntervalMonths: 24,
    keywords: ["flush cooling", "coolant flush", "cooling system flush", "flush the cooling system", "antifreeze", "closed cooling", "fresh water cooling", "coolant change", "overheating", "running hot"],
    kit: { "92-813696K01": 2, "22899282": 1, "CC2825": 2 },
  },
  {
    code: "ENG-HEX-01", description: "Inspect and clean heat exchanger", category: "engine", standardHours: 1.5,
    keywords: ["heat exchanger", "vane debris", "impeller debris", "clean heat exchanger", "exchanger clogged", "end caps", "tube bundle", "running hot at cruise", "overheat at cruise", "check the heat exchanger"],
    kit: { "27-8M0066811": 1, "3583929": 1, "3990770": 1, "119773-44150": 1 },
  },
  {
    code: "ENG-OIL-01", description: "Engine oil and filter change", category: "engine", standardHours: 1.0,
    maintenanceIntervalMonths: 12,
    keywords: ["oil change", "oil and filter", "engine oil", "oil filter", "service", "annual service", "100 hour", "lube", "oil is black", "oil due"],
    kit: { "35-866340Q03": 1, "92-8M0078629": 2, "22030848": 1, "23909460": 2, "3401544": 1, "18-9910": 4, "119305-35170": 1, "35-8M0162830": 1, "92-8M0175540": 2, "69J-13440-04-00": 1, "LUB-MRNMD-10-04": 2 },
  },
  {
    code: "ENG-ANO-01", description: "Replace engine anodes", category: "engine", standardHours: 0.75,
    maintenanceIntervalMonths: 12,
    keywords: ["engine anodes", "zincs", "pencil zincs", "anodes gone", "anodes wasted", "zinc replacement", "engine zincs", "corrosion", "sacrificial anode"],
    kit: { "97-8M0107930": 1, "3593984": 1, "3927866": 1, "27210-200550": 3, "6CE-45371-00-00": 1, "6CE-45251-00-00": 1 },
  },
  {
    code: "ENG-FUL-01", description: "Replace fuel filters and water separator", category: "engine", standardHours: 0.75,
    maintenanceIntervalMonths: 12,
    keywords: ["fuel filter", "water separator", "racor", "fuel filters", "water in fuel", "stalling", "bogging", "fuel starvation", "loss of power", "bad fuel"],
    kit: { "35-8M0154778": 1, "21624740": 1, "3401545": 1, "129470-55810": 1, "104211-55710": 1, "6CE-24563-00-00": 1, "8M0198071": 1, "18-7959": 1 },
  },
  {
    code: "ENG-BLT-01", description: "Replace serpentine belt", category: "engine", standardHours: 0.75,
    keywords: ["belt", "serpentine belt", "drive belt", "belt squeal", "belt cracked", "belt glazed", "alternator belt", "belt dust"],
    kit: { "57-8M0079636": 1, "22567321": 1, "3287127": 1, "128990-77350": 1, "121850-77350": 1 },
  },
  {
    code: "ENG-TST-01", description: "Replace thermostat", category: "engine", standardHours: 1.0,
    keywords: ["thermostat", "stuck thermostat", "running cold", "temp swings", "temperature fluctuating", "overheats at idle", "thermostat housing"],
    kit: { "807252Q5": 1, "21951348": 1, "3906415": 1, "119773-44530": 1, "6CE-W0093-00-00": 1 },
  },
  {
    code: "ENG-DIA-01", description: "Engine diagnostic scan and sea trial", category: "engine", standardHours: 1.5,
    keywords: ["diagnostic", "scan", "check engine", "fault code", "alarm", "sea trial", "rough idle", "misfire", "engine light", "beeping", "troubleshoot", "intermittent"],
  },
  {
    code: "ENG-PLG-01", description: "Replace spark plugs", category: "engine", standardHours: 1.0,
    maintenanceIntervalMonths: 24,
    keywords: ["spark plugs", "plugs", "plugs fouled", "misfire", "rough running", "tune up", "ignition"],
    kit: { "33-8M0179789": 8, "6CE-11603-00-00": 1 },
  },
  {
    code: "ENG-EXH-01", description: "Replace exhaust manifold and riser", category: "engine", standardHours: 4.0,
    keywords: ["exhaust manifold", "riser", "elbow", "water in cylinder", "manifold corroded", "rusty exhaust", "exhaust leak", "hydro lock", "manifolds"],
    kit: { "864591T02": 1, "8M0071364": 1, "27-8M0048921": 1 },
  },
  {
    code: "ENG-STR-01", description: "Replace starter motor", category: "engine", standardHours: 1.5,
    keywords: ["starter", "won't crank", "no crank", "click no start", "starter solenoid", "starter dragging", "slow crank"],
    kit: { "50-8M0090635": 1 },
  },
  {
    code: "ENG-ALT-01", description: "Replace alternator", category: "engine", standardHours: 1.5,
    keywords: ["alternator", "not charging", "charging light", "low voltage underway", "alternator bearing", "voltage dropping", "batteries not charging underway"],
    kit: { "8M0095472": 1 },
  },
  {
    code: "ENG-HOS-01", description: "Replace raw water hoses and clamps", category: "engine", standardHours: 2.0,
    keywords: ["hoses", "raw water hose", "hose clamps", "hose cracked", "hose soft", "hose leaking", "clamps rusted", "exhaust hose"],
    kit: { "32-8M0090218": 1, "54-8M0074005": 8 },
  },
  {
    code: "ENG-OB1-01", description: "Outboard 100 hour service", category: "engine", standardHours: 2.0,
    maintenanceIntervalMonths: 12,
    keywords: ["100 hour service", "outboard service", "annual outboard", "yamaha service", "verado service", "service due", "outboard oil change", "lower unit lube", "water pump"],
    kit: { "69J-13440-04-00": 1, "LUB-MRNMD-10-04": 2, "6CE-24563-00-00": 1, "90793-0AS16-00": 1, "6CE-W0078-01-00": 1, "35-8M0162830": 1, "92-8M0175540": 2, "8M0198071": 1, "92-858064K01": 1 },
  },
  {
    code: "ENG-MNT-01", description: "Replace engine mounts", category: "engine", standardHours: 3.0,
    keywords: ["engine mounts", "motor mounts", "vibration", "mounts collapsed", "mounts rotten", "alignment", "shaking at idle"],
  },
  {
    code: "ENG-INJ-01", description: "Clean and test fuel injectors", category: "engine", standardHours: 2.5,
    keywords: ["injectors", "injector cleaning", "fuel injector", "smoking", "black smoke", "rough idle", "poor economy", "injector test"],
  },
  // ------------------------------------------------------------------ drive
  {
    code: "DRV-LU-01", description: "Lower unit reseal / rebuild", category: "drive", standardHours: 4.0,
    keywords: ["lower unit", "lower unit is toast", "toast", "gear lube milky", "milky oil", "water in gear lube", "prop shaft seal", "reseal", "gearcase", "grinding in gear", "lower unit leaking"],
    kit: { "26-8M0161236": 1, "6CE-W0001-40-00": 1, "92-858064K01": 2, "90793-0AS16-00": 2 },
  },
  {
    code: "DRV-LU-02", description: "Replace lower unit assembly", category: "drive", standardHours: 2.5,
    keywords: ["replace lower unit", "new lower unit", "gearcase assembly", "lower unit cracked", "hit a rock", "grounding damage", "gears stripped", "lower unit is toast"],
    kit: { "1600-8M0140360": 1, "6CE-45300-00-8D": 1 },
  },
  {
    code: "DRV-GL-01", description: "Lower unit gear lube service", category: "drive", standardHours: 0.5,
    maintenanceIntervalMonths: 12,
    keywords: ["gear lube", "gear oil", "lower unit oil", "gearcase lube", "drain and fill", "gear lube change"],
    kit: { "92-858064K01": 1, "90793-0AS16-00": 1 },
  },
  {
    code: "DRV-BEL-01", description: "Replace sterndrive bellows and gimbal bearing", category: "drive", standardHours: 3.5,
    maintenanceIntervalMonths: 36,
    keywords: ["bellows", "gimbal bearing", "water in bilge", "bellows cracked", "bellows torn", "gimbal noise", "howling in turns", "sterndrive", "outdrive", "bravo"],
    kit: { "30-803100T1": 1, "30-879194A02": 1 },
  },
  {
    code: "DRV-PRP-01", description: "Propeller removal, inspection and reinstall", category: "drive", standardHours: 0.5,
    keywords: ["prop", "propeller", "prop inspection", "dinged prop", "prop pull", "vibration", "fishing line", "prop hub"],
  },
  {
    code: "DRV-PRP-02", description: "Replace propeller", category: "drive", standardHours: 0.75,
    keywords: ["replace prop", "new prop", "propeller replacement", "bent prop", "blade broken", "spun hub", "prop is shot"],
    kit: { "48-8M0151264": 1 },
  },
  {
    code: "DRV-UJ-01", description: "Replace u-joints and drive coupler", category: "drive", standardHours: 3.0,
    keywords: ["u-joints", "u joint", "clunk", "driveshaft", "coupler", "coupler worn", "vibration under load", "outdrive clunk"],
    kit: { "26-8M0053180": 1 },
  },
  {
    code: "DRV-TRM-01", description: "Replace outboard trim/tilt motor", category: "drive", standardHours: 1.5,
    keywords: ["trim motor", "tilt motor", "trim won't go up", "trim stuck", "power tilt", "trim slow", "trim pump outboard", "tilt leaking"],
    kit: { "8M0097106": 1, "6CE-82810-00-00": 1, "6E5-43352-00-00": 1 },
  },
  // ------------------------------------------------------------- electrical
  {
    code: "ELE-BAT-01", description: "Replace house battery bank", category: "electrical", standardHours: 1.5,
    maintenanceIntervalMonths: 48,
    keywords: ["house batteries", "house bank", "batteries not holding charge", "batteries dead", "battery bank", "won't hold a charge", "deep cycle", "batteries are shot", "agm", "replace batteries"],
    kit: { "31M-AGM": 3, "ANC-252294": 6, "CRC-06026": 1 },
  },
  {
    code: "ELE-BAT-02", description: "Replace start battery", category: "electrical", standardHours: 0.5,
    keywords: ["start battery", "starting battery", "cranking battery", "won't start", "battery dead", "slow crank"],
    kit: { "34M-PC1500": 1 },
  },
  {
    code: "ELE-BLG-01", description: "Replace bilge pump float switch", category: "electrical", standardHours: 0.75,
    keywords: ["float switch", "bilge switch", "float stuck", "bilge pump not coming on", "bilge won't turn on", "switch stuck", "automatic bilge", "float switch stuck"],
    kit: { "RULE-35A": 1 },
  },
  {
    code: "ELE-BLG-02", description: "Replace bilge pump", category: "electrical", standardHours: 1.0,
    keywords: ["bilge pump", "bilge pump dead", "pump not running", "water in bilge", "rule pump", "bilge pump burned out", "replace bilge pump"],
    kit: { "RULE-24": 1, "RULE-35A": 1 },
  },
  {
    code: "ELE-CHG-01", description: "Replace battery charger", category: "electrical", standardHours: 2.0,
    keywords: ["charger", "battery charger", "charger dead", "not charging on shore power", "charger fault", "promariner", "onboard charger"],
    kit: { "PRO-PS3": 1 },
  },
  {
    code: "ELE-TRM-01", description: "Clean and reseal battery terminals and cables", category: "electrical", standardHours: 1.0,
    keywords: ["terminals", "corroded terminals", "corrosion on terminals", "battery cables", "green corrosion", "loose terminal", "cable ends", "clean terminals"],
    kit: { "ANC-252294": 4, "CRC-06026": 1, "ANC-3M-HS": 1 },
  },
  {
    code: "ELE-DIA-01", description: "Electrical system diagnostic", category: "electrical", standardHours: 1.5,
    keywords: ["electrical diagnostic", "short", "blowing fuses", "breaker tripping", "intermittent power", "voltage drop", "wiring", "gremlin", "trace wiring"],
  },
  {
    code: "ELE-NAV-01", description: "Replace navigation lights", category: "electrical", standardHours: 1.0,
    keywords: ["nav lights", "navigation lights", "running lights", "bow light", "stern light", "anchor light", "lights out", "light not working"],
    kit: { "AT-BC14": 1, "AT-ST26": 1 },
  },
  {
    code: "ELE-SHP-01", description: "Replace shore power inlet", category: "electrical", standardHours: 1.5,
    keywords: ["shore power", "inlet", "shore power inlet", "melted plug", "burnt inlet", "no shore power", "dock power", "30 amp"],
    kit: { "MAR-9250": 1 },
  },
  {
    code: "ELE-GPS-01", description: "Install chartplotter / MFD", category: "electrical", standardHours: 3.0,
    keywords: ["chartplotter", "mfd", "garmin", "simrad", "raymarine", "install electronics", "plotter", "fishfinder", "transducer"],
  },
  // --------------------------------------------------------------- plumbing
  {
    code: "PLB-HED-01", description: "Rebuild marine head", category: "plumbing", standardHours: 2.0,
    keywords: ["head", "toilet", "head rebuild", "head won't flush", "head leaking", "joker valve", "head pump", "marine toilet"],
    kit: { "JAB-29045": 1 },
  },
  {
    code: "PLB-HED-02", description: "Replace macerator pump", category: "plumbing", standardHours: 1.5,
    keywords: ["macerator", "macerator pump", "holding tank won't pump", "overboard discharge", "macerator dead", "waste pump"],
    kit: { "JAB-18590": 1 },
  },
  {
    code: "PLB-FWP-01", description: "Replace fresh water pump", category: "plumbing", standardHours: 1.0,
    keywords: ["fresh water pump", "water pump cycling", "no water pressure", "pressure pump", "faucet no water", "pump runs constantly", "freshwater"],
    kit: { "JAB-31395": 1 },
  },
  {
    code: "PLB-SEA-01", description: "Replace seacock / thru-hull", category: "plumbing", standardHours: 2.0,
    keywords: ["seacock", "thru-hull", "through hull", "seacock seized", "seacock frozen", "valve won't close", "thru hull corroded", "bronze valve"],
    kit: { "GRO-BV1250": 1, "GRO-TH1250": 1, "3M-5200": 1 },
  },
  {
    code: "PLB-WH-01", description: "Replace water heater", category: "plumbing", standardHours: 2.5,
    keywords: ["water heater", "hot water", "no hot water", "heater leaking", "heater element", "water heater tank"],
  },
  // ------------------------------------------------------------------- hull
  {
    code: "HUL-BTM-01", description: "Bottom paint, sand and recoat", category: "hull", standardHours: 8.0,
    maintenanceIntervalMonths: 12,
    keywords: ["bottom paint", "bottom job", "antifouling", "growth", "barnacles", "hull fouled", "repaint bottom", "sand and paint", "ablative", "bottom is fouled"],
    kit: { "PET-1863": 3, "3M-2020": 2, "3M-01034": 1 },
  },
  {
    code: "HUL-ZNC-01", description: "Replace hull and shaft anodes", category: "hull", standardHours: 1.0,
    maintenanceIntervalMonths: 12,
    keywords: ["shaft zinc", "shaft anode", "hull anode", "zincs gone", "hull zincs", "prop shaft zinc", "anodes wasted", "transom anode"],
    kit: { "CMP-X3": 2, "MG-DUO": 2 },
  },
  {
    code: "HUL-GEL-01", description: "Gelcoat repair, minor", category: "hull", standardHours: 3.0,
    keywords: ["gelcoat", "gel coat", "chip", "gouge", "scratch", "dock rash", "spider cracks", "crazing", "cosmetic repair", "rub rail damage"],
    kit: { "SPY-GEL": 1 },
  },
  {
    code: "HUL-BLS-01", description: "Blister repair and barrier coat", category: "hull", standardHours: 12.0,
    keywords: ["blisters", "osmosis", "barrier coat", "hull blisters", "pox", "peel and barrier coat", "blistering"],
    kit: { "INT-2000E": 4, "WS-105": 1, "WS-205": 1, "WS-406": 1 },
  },
  {
    code: "HUL-STF-01", description: "Repack stuffing box / replace shaft seal", category: "hull", standardHours: 2.0,
    keywords: ["stuffing box", "packing gland", "shaft seal", "dripping", "shaft dripping too much", "dripless seal", "pss seal", "water at shaft", "repack"],
    kit: { "WM-FLAX": 3 },
  },
  {
    code: "HUL-SRV-01", description: "Hull and running gear survey", category: "hull", standardHours: 2.0,
    keywords: ["survey", "haul out inspection", "running gear", "cutless bearing", "shaft play", "rudder play", "inspection", "pre purchase"],
  },
  // ----------------------------------------------------------------- canvas
  {
    code: "CNV-BIM-01", description: "Replace bimini canvas", category: "canvas", standardHours: 2.0,
    keywords: ["bimini", "bimini top", "canvas torn", "sunbrella", "bimini ripped", "top faded", "canvas replacement"],
    kit: { "SUN-4601": 8, "YKK-10": 6 },
  },
  {
    code: "CNV-ENC-01", description: "Replace enclosure panels and isinglass", category: "canvas", standardHours: 4.0,
    keywords: ["enclosure", "isinglass", "eisenglass", "clear panels", "strataglass", "panels cloudy", "zippers broken", "side curtains"],
    kit: { "STR-40": 6, "YKK-10": 12, "SUN-4601": 4 },
  },
  {
    code: "CNV-CVR-01", description: "Replace mooring cover", category: "canvas", standardHours: 1.5,
    keywords: ["mooring cover", "boat cover", "cover torn", "cockpit cover", "cover snaps", "cover shrunk"],
  },
  // ---------------------------------------------------------------- rigging
  {
    code: "RIG-STD-01", description: "Standing rigging inspection", category: "rigging", standardHours: 2.0, laborRate: 175,
    maintenanceIntervalMonths: 12,
    keywords: ["standing rigging", "rig inspection", "rigging inspection", "go up the mast", "check the rig", "shrouds", "stays", "swage", "swage cracked", "rig check", "mast inspection"],
  },
  {
    code: "RIG-FST-01", description: "Replace forestay", category: "rigging", standardHours: 3.0, laborRate: 175,
    keywords: ["forestay", "headstay", "forestay cracked", "cracked swage", "swage fitting", "forestay wire", "replace forestay", "broken strands", "meat hooks"],
    kit: { "HAY-316-14": 55, "HAY-SW14": 1, "HAY-SE14": 1, "HAY-TB14": 1, "LOC-PIN": 1 },
  },
  {
    code: "RIG-HAL-01", description: "Replace halyard", category: "rigging", standardHours: 1.5, laborRate: 175,
    keywords: ["halyard", "main halyard", "jib halyard", "halyard chafed", "chafe", "running rigging", "line worn", "halyard frayed", "replace halyard", "sheave"],
    kit: { "NE-STA716": 110, "RON-SPL": 1 },
  },
  {
    code: "RIG-SHR-01", description: "Replace shrouds", category: "rigging", standardHours: 6.0, laborRate: 175,
    keywords: ["shrouds", "replace shrouds", "cap shrouds", "lowers", "rigging wire", "rerig", "re-rig", "new standing rigging", "spreaders"],
    kit: { "HAY-316-14": 180, "HAY-SW14": 4, "HAY-SE14": 4, "HAY-TB14": 4 },
  },
  {
    code: "RIG-FRL-01", description: "Service roller furler", category: "rigging", standardHours: 2.0, laborRate: 175,
    keywords: ["furler", "roller furler", "furler stiff", "furler jammed", "furling", "harken furler", "drum", "furler bearings"],
    kit: { "HAR-FRL-MK4": 1 },
  },
  {
    code: "RIG-MST-01", description: "Mast unstep and restep", category: "rigging", standardHours: 4.0, laborRate: 175,
    keywords: ["unstep", "restep", "mast down", "pull the mast", "mast step", "mast crane", "step the mast"],
  },
  // ------------------------------------------------------------------- haul
  {
    code: "HAL-HLB-01", description: "Haul, pressure wash and block", category: "haul", standardHours: 2.0,
    keywords: ["haul", "haul out", "pressure wash", "block", "travel lift", "haul and block", "on the hard", "pull the boat"],
  },
  {
    code: "HAL-LNC-01", description: "Launch", category: "haul", standardHours: 1.0,
    keywords: ["launch", "splash", "put back in", "relaunch", "back in the water"],
  },
  {
    code: "HAL-SHR-01", description: "Shrink wrap for storage", category: "haul", standardHours: 3.0,
    keywords: ["shrink wrap", "wrap", "storage cover", "winter storage", "shrinkwrap"],
    kit: { "DS-7MIL": 1, "DS-TAPE": 2 },
  },
  // -------------------------------------------------------------- detailing
  {
    code: "DET-WAX-01", description: "Compound and wax topsides", category: "detailing", standardHours: 6.0,
    maintenanceIntervalMonths: 12,
    keywords: ["wax", "compound", "buff", "oxidised", "oxidized", "chalky", "polish", "detail", "shine", "faded gelcoat"],
    kit: { "3M-MW": 1, "CJ-WAX": 1 },
  },
  {
    code: "DET-INT-01", description: "Interior detail", category: "detailing", standardHours: 3.0,
    keywords: ["interior detail", "cabin clean", "mildew", "cushions", "carpet", "interior cleaning", "deep clean"],
  },
  {
    code: "DET-TEK-01", description: "Teak clean and seal", category: "detailing", standardHours: 4.0,
    keywords: ["teak", "teak grey", "teak seal", "swim platform teak", "teak oil", "brightwork", "teak cleaning"],
    kit: { "SEM-TEAK": 2 },
  },
  // ---------------------------------------------------------- winterisation
  {
    code: "WNT-ENG-01", description: "Winterise inboard engine", category: "winterisation", standardHours: 2.0,
    maintenanceIntervalMonths: 12,
    keywords: ["winterise", "winterize", "winterization", "lay up", "layup", "antifreeze the engine", "fog the engine", "storage prep", "winter prep", "put away for the season"],
    kit: { "STR-ANTI": 4, "STR-FOG": 1, "STR-STAB": 1 },
  },
  {
    code: "WNT-OB-01", description: "Winterise outboard", category: "winterisation", standardHours: 1.0,
    maintenanceIntervalMonths: 12,
    keywords: ["winterise outboard", "winterize outboard", "fog outboard", "outboard layup", "stabilise fuel", "outboard storage"],
    kit: { "STR-FOG": 1, "STR-STAB": 1, "MAR-FUELC-ON-00": 1 },
  },
  {
    code: "WNT-FW-01", description: "Winterise fresh water and head systems", category: "winterisation", standardHours: 1.5,
    maintenanceIntervalMonths: 12,
    keywords: ["winterise water system", "winterize plumbing", "pink antifreeze", "fresh water winterise", "head winterise", "blow out lines", "drain tanks"],
    kit: { "STR-ANTI": 3 },
  },
  // ---------------------------------------------------------- commissioning
  {
    code: "COM-SPR-01", description: "Spring commissioning, inboard", category: "commissioning", standardHours: 3.0,
    maintenanceIntervalMonths: 12,
    keywords: ["commissioning", "spring commission", "de-winterise", "dewinterize", "recommission", "get her ready", "season start", "wake up the engine"],
    kit: { "35-866340Q03": 1, "92-8M0078629": 2, "35-8M0154778": 1 },
  },
  {
    code: "COM-SEA-01", description: "Sea trial and systems check", category: "commissioning", standardHours: 1.5,
    keywords: ["sea trial", "systems check", "shakedown", "test run", "run the boat", "check everything", "post repair test"],
  },
  // ------------------------------------------------------------- hydraulics
  {
    code: "HYD-TAB-01", description: "Replace trim tab actuator", category: "hydraulics", standardHours: 1.5,
    keywords: ["trim tab", "trim tab actuator", "actuator leaking", "actuator weeping", "tab won't move", "trim tabs stuck", "bennett", "tab cylinder", "starboard trim tab", "port trim tab", "actuator is leaking"],
    kit: { "BEN-A1101": 1, "BEN-AFK": 1, "BEN-OIL": 1 },
  },
  {
    code: "HYD-TAB-02", description: "Replace trim tab pump and reservoir", category: "hydraulics", standardHours: 2.0,
    keywords: ["trim tab pump", "hpu", "power unit", "tab pump", "tabs not responding", "pump hums", "reservoir empty", "tab motor"],
    kit: { "BEN-V351": 1, "BEN-OIL": 2 },
  },
  {
    code: "HYD-STR-01", description: "Replace hydraulic steering cylinder", category: "hydraulics", standardHours: 2.5,
    keywords: ["steering cylinder", "steering leaking", "cylinder leaking", "seastar cylinder", "steering ram", "hydraulic steering leak", "steering hard"],
    kit: { "SEA-HC5345": 1, "SEA-HA5430": 2 },
  },
  {
    code: "HYD-STR-02", description: "Bleed and top up hydraulic steering", category: "hydraulics", standardHours: 1.0,
    keywords: ["bleed steering", "steering spongy", "air in steering", "steering fluid", "top up steering", "helm pump", "steering loose"],
    kit: { "SEA-HA5430": 2 },
  },
];

/** Codes with a maintenance interval; the generator keeps their history controlled. */
export const intervalCodes = operationCodes
  .filter((o) => o.maintenanceIntervalMonths)
  .map((o) => o.code);
