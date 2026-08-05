export type GeoLocationType = "country" | "region" | "city" | "locality" | "postal_code";

export type GeoLocation = {
  id: string;
  name: string;
  type: GeoLocationType;
  country: string;
  countryCode: string;
  region?: string;
  latitude: number;
  longitude: number;
  population?: number;
  boundary: {
    type: "bbox" | "polygon";
    coordinates: number[] | number[][][];
  };
  aliases: string[];
};

const nigerianStates: Array<{
  name: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
}> = [
  { name: "Abia State", latitude: 5.4527, longitude: 7.5248, aliases: ["abia", "umuahia"] },
  { name: "Adamawa State", latitude: 9.3265, longitude: 12.3984, aliases: ["adamawa", "yola"] },
  { name: "Akwa Ibom State", latitude: 5.0077, longitude: 7.8537, aliases: ["akwa ibom", "uyo"] },
  { name: "Anambra State", latitude: 6.2209, longitude: 6.9369, aliases: ["anambra", "awka", "onitsha", "nnewi"] },
  { name: "Bauchi State", latitude: 10.3158, longitude: 9.8442, aliases: ["bauchi"] },
  { name: "Bayelsa State", latitude: 4.7719, longitude: 6.0699, aliases: ["bayelsa", "yenagoa"] },
  { name: "Benue State", latitude: 7.3369, longitude: 8.7404, aliases: ["benue", "makurdi"] },
  { name: "Borno State", latitude: 11.8846, longitude: 13.151, aliases: ["borno", "maiduguri"] },
  { name: "Cross River State", latitude: 5.8702, longitude: 8.5988, aliases: ["cross river", "calabar"] },
  { name: "Delta State", latitude: 5.5325, longitude: 5.8987, aliases: ["delta", "asaba", "warri"] },
  { name: "Ebonyi State", latitude: 6.2649, longitude: 8.0137, aliases: ["ebonyi", "abakaliki"] },
  { name: "Edo State", latitude: 6.5438, longitude: 5.8987, aliases: ["edo", "benin city"] },
  { name: "Ekiti State", latitude: 7.719, longitude: 5.311, aliases: ["ekiti", "ado ekiti"] },
  { name: "Enugu State", latitude: 6.5364, longitude: 7.4356, aliases: ["enugu"] },
  { name: "FCT - Abuja", latitude: 9.0765, longitude: 7.3986, aliases: ["abuja", "fct", "federal capital territory"] },
  { name: "Gombe State", latitude: 10.3638, longitude: 11.1928, aliases: ["gombe"] },
  { name: "Imo State", latitude: 5.572, longitude: 7.0588, aliases: ["imo", "owerri"] },
  { name: "Jigawa State", latitude: 12.228, longitude: 9.5616, aliases: ["jigawa", "dutse"] },
  { name: "Kaduna State", latitude: 10.5105, longitude: 7.4165, aliases: ["kaduna"] },
  { name: "Kano State", latitude: 12.0022, longitude: 8.592, aliases: ["kano"] },
  { name: "Katsina State", latitude: 12.3797, longitude: 7.6306, aliases: ["katsina"] },
  { name: "Kebbi State", latitude: 12.4539, longitude: 4.1975, aliases: ["kebbi", "birnin kebbi"] },
  { name: "Kogi State", latitude: 7.7337, longitude: 6.6906, aliases: ["kogi", "lokoja"] },
  { name: "Kwara State", latitude: 8.9669, longitude: 4.3874, aliases: ["kwara", "ilorin"] },
  { name: "Lagos State", latitude: 6.5244, longitude: 3.3792, aliases: ["lagos", "eko"] },
  { name: "Nasarawa State", latitude: 8.4998, longitude: 8.1997, aliases: ["nasarawa", "lafia"] },
  { name: "Niger State", latitude: 9.9309, longitude: 5.5983, aliases: ["niger", "minna"] },
  { name: "Ogun State", latitude: 7.1608, longitude: 3.3486, aliases: ["ogun", "abeokuta"] },
  { name: "Ondo State", latitude: 7.2571, longitude: 5.2058, aliases: ["ondo", "akure"] },
  { name: "Osun State", latitude: 7.5629, longitude: 4.52, aliases: ["osun", "oshogbo", "osogbo"] },
  { name: "Oyo State", latitude: 7.3775, longitude: 3.947, aliases: ["oyo", "ibadan"] },
  { name: "Plateau State", latitude: 9.2182, longitude: 9.5179, aliases: ["plateau", "jos"] },
  { name: "Rivers State", latitude: 4.8156, longitude: 7.0498, aliases: ["rivers", "port harcourt", "ph"] },
  { name: "Sokoto State", latitude: 13.0059, longitude: 5.2476, aliases: ["sokoto"] },
  { name: "Taraba State", latitude: 8.8937, longitude: 11.3596, aliases: ["taraba", "jalingo"] },
  { name: "Yobe State", latitude: 12.2939, longitude: 11.439, aliases: ["yobe", "damaturu"] },
  { name: "Zamfara State", latitude: 12.1704, longitude: 6.6641, aliases: ["zamfara", "gusau"] },
];

const stateLocations: GeoLocation[] = nigerianStates.map((state) => ({
  id: `region-${state.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-ng`,
  name: state.name,
  type: "region",
  country: "Nigeria",
  countryCode: "NG",
  region: state.name,
  latitude: state.latitude,
  longitude: state.longitude,
  boundary: {
    type: "bbox",
    coordinates: [state.longitude - 0.7, state.latitude - 0.7, state.longitude + 0.7, state.latitude + 0.7],
  },
  aliases: state.aliases ?? [state.name.replace(/ State$/, "")],
}));

const featuredLocations: GeoLocation[] = [
  {
    id: "country-ng",
    name: "Nigeria",
    type: "country",
    country: "Nigeria",
    countryCode: "NG",
    latitude: 9.082,
    longitude: 8.6753,
    population: 223800000,
    boundary: { type: "bbox", coordinates: [2.6769, 4.2704, 14.6779, 13.8856] },
    aliases: ["ng", "naija"],
  },
  {
    id: "region-lagos-ng",
    name: "Lagos State",
    type: "region",
    country: "Nigeria",
    countryCode: "NG",
    region: "Lagos",
    latitude: 6.5244,
    longitude: 3.3792,
    population: 15900000,
    boundary: { type: "bbox", coordinates: [2.706, 6.393, 4.352, 6.702] },
    aliases: ["lagos", "eko"],
  },
  {
    id: "city-lagos-ng",
    name: "Lagos",
    type: "city",
    country: "Nigeria",
    countryCode: "NG",
    region: "Lagos State",
    latitude: 6.5244,
    longitude: 3.3792,
    population: 15300000,
    boundary: { type: "bbox", coordinates: [3.098, 6.393, 3.601, 6.702] },
    aliases: ["lagos city", "eko"],
  },
  {
    id: "locality-ikeja-ng",
    name: "Ikeja",
    type: "locality",
    country: "Nigeria",
    countryCode: "NG",
    region: "Lagos State",
    latitude: 6.6018,
    longitude: 3.3515,
    population: 470000,
    boundary: { type: "bbox", coordinates: [3.304, 6.557, 3.397, 6.646] },
    aliases: ["ikeja lagos", "allen avenue", "computer village"],
  },
  {
    id: "locality-lekki-ng",
    name: "Lekki",
    type: "locality",
    country: "Nigeria",
    countryCode: "NG",
    region: "Lagos State",
    latitude: 6.4698,
    longitude: 3.5852,
    population: 400000,
    boundary: { type: "bbox", coordinates: [3.452, 6.397, 3.738, 6.543] },
    aliases: ["lekki phase 1", "lekki peninsula"],
  },
  {
    id: "locality-yaba-ng",
    name: "Yaba",
    type: "locality",
    country: "Nigeria",
    countryCode: "NG",
    region: "Lagos State",
    latitude: 6.5158,
    longitude: 3.3779,
    population: 120000,
    boundary: { type: "bbox", coordinates: [3.355, 6.498, 3.398, 6.535] },
    aliases: ["yaba lagos", "sabo yaba"],
  },
  {
    id: "locality-victoria-island-ng",
    name: "Victoria Island",
    type: "locality",
    country: "Nigeria",
    countryCode: "NG",
    region: "Lagos State",
    latitude: 6.4281,
    longitude: 3.4219,
    population: 250000,
    boundary: { type: "bbox", coordinates: [3.392, 6.412, 3.458, 6.453] },
    aliases: ["vi", "v.i", "victoria island lagos"],
  },
  {
    id: "locality-ajah-ng",
    name: "Ajah",
    type: "locality",
    country: "Nigeria",
    countryCode: "NG",
    region: "Lagos State",
    latitude: 6.4696,
    longitude: 3.5857,
    population: 300000,
    boundary: { type: "bbox", coordinates: [3.543, 6.427, 3.672, 6.516] },
    aliases: ["ajah lagos", "sangotedo"],
  },
  {
    id: "locality-surulere-ng",
    name: "Surulere",
    type: "locality",
    country: "Nigeria",
    countryCode: "NG",
    region: "Lagos State",
    latitude: 6.5006,
    longitude: 3.358,
    population: 690000,
    boundary: { type: "bbox", coordinates: [3.326, 6.475, 3.381, 6.526] },
    aliases: ["surulere lagos"],
  },
  {
    id: "locality-oshodi-ng",
    name: "Oshodi",
    type: "locality",
    country: "Nigeria",
    countryCode: "NG",
    region: "Lagos State",
    latitude: 6.555,
    longitude: 3.3436,
    population: 630000,
    boundary: { type: "bbox", coordinates: [3.304, 6.524, 3.383, 6.586] },
    aliases: ["oshodi isolo", "isolo"],
  },
  {
    id: "region-fct-ng",
    name: "FCT - Abuja",
    type: "region",
    country: "Nigeria",
    countryCode: "NG",
    region: "Federal Capital Territory",
    latitude: 9.0765,
    longitude: 7.3986,
    population: 3800000,
    boundary: { type: "bbox", coordinates: [6.75, 8.396, 7.617, 9.357] },
    aliases: ["abuja", "fct", "federal capital territory"],
  },
  {
    id: "city-abuja-ng",
    name: "Abuja",
    type: "city",
    country: "Nigeria",
    countryCode: "NG",
    region: "FCT - Abuja",
    latitude: 9.0765,
    longitude: 7.3986,
    population: 1236000,
    boundary: { type: "bbox", coordinates: [7.25, 8.84, 7.55, 9.2] },
    aliases: ["abuja city", "fct"],
  },
  {
    id: "city-kano-ng",
    name: "Kano",
    type: "city",
    country: "Nigeria",
    countryCode: "NG",
    region: "Kano State",
    latitude: 12.0022,
    longitude: 8.592,
    population: 4100000,
    boundary: { type: "bbox", coordinates: [8.43, 11.88, 8.72, 12.12] },
    aliases: ["kano city"],
  },
  {
    id: "city-ibadan-ng",
    name: "Ibadan",
    type: "city",
    country: "Nigeria",
    countryCode: "NG",
    region: "Oyo State",
    latitude: 7.3775,
    longitude: 3.947,
    population: 3600000,
    boundary: { type: "bbox", coordinates: [3.75, 7.22, 4.1, 7.52] },
    aliases: ["ibadan oyo"],
  },
  {
    id: "city-port-harcourt-ng",
    name: "Port Harcourt",
    type: "city",
    country: "Nigeria",
    countryCode: "NG",
    region: "Rivers State",
    latitude: 4.8156,
    longitude: 7.0498,
    population: 1900000,
    boundary: { type: "bbox", coordinates: [6.89, 4.72, 7.16, 4.93] },
    aliases: ["ph", "portharcourt", "rivers"],
  },
];

const stateNames = new Set(stateLocations.map((location) => location.name));
const locations: GeoLocation[] = [
  ...featuredLocations.filter((location) => location.type !== "region" || !stateNames.has(location.name)),
  ...stateLocations,
];

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreLocation(location: GeoLocation, query: string) {
  const haystack = [location.name, location.region, location.country, ...location.aliases]
    .filter(Boolean)
    .map((item) => normalize(String(item)));

  if (haystack.some((item) => item === query)) return 100;
  if (haystack.some((item) => item.startsWith(query))) return 80;
  if (haystack.some((item) => item.includes(query))) return 55;
  return 0;
}

export function searchLocations(query: string, limit = 8) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];

  return locations
    .map((location) => ({ location, score: scoreLocation(location, normalizedQuery) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.location.population ?? 0) - (a.location.population ?? 0))
    .slice(0, limit)
    .map((item) => item.location);
}
