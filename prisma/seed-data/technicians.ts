import { json } from "./helpers";

const fullWeek = {
  mon: [[8, 12], [13, 17]],
  tue: [[8, 12], [13, 17]],
  wed: [[8, 12], [13, 17]],
  thu: [[8, 12], [13, 17]],
  fri: [[8, 12], [13, 17]],
};

const fourDay = {
  mon: [[8, 12], [13, 17]],
  tue: [[8, 12], [13, 17]],
  wed: [[8, 12], [13, 17]],
  thu: [[8, 12], [13, 17]],
  fri: [[8, 12]],
};

export const marina = {
  id: "marina_harbourline",
  name: "Harbourline Marine & Yacht Yard",
  city: "Stuart",
  state: "FL",
  laborRate: 165,
  shopSuppliesPct: 5,
  taxPct: 7,
};

export const technicians = [
  {
    id: "tech_marcus_reyes",
    name: "Marcus Reyes",
    role: "lead_tech",
    skills: json(["engine", "hydraulics", "plumbing"]),
    hourlyCost: 42,
    availability: json(fullWeek),
  },
  {
    id: "tech_tony_delgado",
    name: "Tony Delgado",
    role: "technician",
    skills: json(["engine", "electrical"]),
    hourlyCost: 36,
    availability: json(fullWeek),
  },
  {
    id: "tech_priya_nair",
    name: "Priya Nair",
    role: "technician",
    skills: json(["electrical", "plumbing"]),
    hourlyCost: 34,
    availability: json(fullWeek),
  },
  {
    id: "tech_cal_whitfield",
    name: "Cal Whitfield",
    role: "technician",
    skills: json(["fiberglass", "detailing", "haul"]),
    hourlyCost: 30,
    availability: json(fourDay),
  },
  {
    id: "tech_jo_lindqvist",
    name: "Jo Lindqvist",
    role: "technician",
    skills: json(["rigging", "canvas", "engine"]),
    hourlyCost: 38,
    availability: json(fullWeek),
  },
  {
    id: "tech_lena_okafor",
    name: "Lena Okafor",
    role: "service_manager",
    skills: json(["engine", "electrical"]),
    hourlyCost: 55,
    availability: json(fullWeek),
  },
];
