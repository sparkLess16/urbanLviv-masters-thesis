// Responsible city service per report type (FR-04). Names come from open
// sources (news, Wikipedia, the city open-data portal), the official site was
// not reachable; correct them here if the city renames a service.
//
// `default` is used everywhere; `byDistrict` holds optional exceptions keyed
// by district_id (empty for now). `name` is stored on the cluster, `name_uk`
// is kept for a Ukrainian interface.
const HOUSING_DEPARTMENT = {
  name: "Department of Housing and Infrastructure, Lviv City Council",
  name_uk:
    "Департамент житлового господарства та інфраструктури Львівської міської ради",
};

export const RESPONSIBLE_SERVICES = {
  roads: { default: HOUSING_DEPARTMENT, byDistrict: {} },
  lighting: {
    default: { name: "Lvivsvitlo", name_uk: "ЛКП «Львівсвітло»" },
    byDistrict: {},
  },
  garbage: { default: HOUSING_DEPARTMENT, byDistrict: {} },
  transport: {
    default: { name: "Lvivelectrotrans", name_uk: "ЛКП «Львівелектротранс»" },
    byDistrict: {},
  },
  parks: {
    default: { name: "Zelenyi Lviv", name_uk: "ЛКП «Зелений Львів»" },
    byDistrict: {},
  },
  buildings: {
    default: {
      name: "Building manager (ЛКП or ОСББ, determined by address)",
      name_uk: "Управитель будинку (ЛКП або ОСББ, залежно від адреси)",
    },
    byDistrict: {},
  },
  other: {
    default: { name: "City administration", name_uk: "Міська адміністрація" },
    byDistrict: {},
  },
};

export const FALLBACK_SERVICE = RESPONSIBLE_SERVICES.other.default;

// Service of a cluster: dominant type, district exception first. Never empty.
export const resolveResponsibleServiceInfo = (cluster) => {
  const entry = RESPONSIBLE_SERVICES[cluster?.type_id];
  if (!entry) return FALLBACK_SERVICE;
  return entry.byDistrict[cluster.district_id] ?? entry.default;
};

export const resolveResponsibleService = (cluster) =>
  resolveResponsibleServiceInfo(cluster).name;
