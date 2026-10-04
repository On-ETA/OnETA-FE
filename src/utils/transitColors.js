const SUBWAY_LINE_COLORS = [
  ["1", "#1D4F91", "#3264B8"],
  ["2", "#009D3E", "#00B84D"],
  ["3", "#EF7C1C", "#FF8C32"],
  ["4", "#2495D0", "#42ABE2"],
  ["5", "#996CAC", "#B07CC0"],
  ["6", "#CD7C2F", "#D99342"],
  ["7", "#747F00", "#A6BD22"],
  ["8", "#E6186C", "#F06F9A"],
  ["9", "#BDB092", "#C4B39B"],
  ["수인분당", "#F5A200", "#F7B83B"],
  ["신분당", "#D31145", "#EF4663"],
  ["경의중앙", "#73C6A4", "#63D8B0"],
  ["경춘", "#009D8B", "#1AB59C"],
  ["공항철도", "#00A3D9", "#24A8E0"],
];

const DEFAULT_TRANSIT_COLORS = {
  strong: "#33D878",
  light: "#8BE9B2",
};

const BUS_TYPE_COLORS = [
  { key: "b_ga", labels: ["간선", "TRUNK"], strong: "#1668BB", light: "#1A7EE1" },
  { key: "b_ji", labels: ["지선", "BRANCH", "VILLAGE"], strong: "#249A1C", light: "#2BB522" },
  { key: "b_gw", labels: ["광역", "METROPOLITAN"], strong: "#D81E1E", light: "#F33A3A" },
  { key: "b_s", labels: ["순환", "CIRCULAR"], strong: "#E19300", light: "#FAAF00" },
];

function getTransitName(segment) {
  return [
    segment?.transitName,
    segment?.routeNumber,
    segment?.busNumber,
    segment?.raw?.transitName,
    segment?.raw?.busType,
    segment?.raw?.routeType,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function getTransitColors(segment) {
  const name = getTransitName(segment);

  const line = SUBWAY_LINE_COLORS.find(([label]) =>
    label.length === 1 ? new RegExp(`(^|\\D)${label}호선`).test(name) : name.includes(label),
  );

  if (line) {
    return { strong: line[1], light: line[2], isSubway: true };
  }

  const busType = BUS_TYPE_COLORS.find(({ labels }) =>
    labels.some((label) => name.toUpperCase().includes(label)),
  );

  return busType
    ? { strong: busType.strong, light: busType.light, busIconKey: busType.key, isSubway: false }
    : { ...DEFAULT_TRANSIT_COLORS, busIconKey: "b_o", isSubway: false };
}

export function getBusIconKey(segment) {
  return getTransitColors(segment).busIconKey ?? "b_o";
}

export function getSubwayIconKey(segment) {
  const name = String(
    segment?.transitName ?? segment?.routeNumber ?? segment?.busNumber ?? segment?.raw?.transitName ?? "",
  ).trim();

  if (/수인분당/.test(name)) return "s_b";
  if (/신분당/.test(name)) return "n_b";
  if (/공항철도/.test(name)) return "a_c";
  if (/경춘/.test(name)) return "g_c";
  if (/경의중앙/.test(name)) return "g_g";

  const line = name.match(/([1-9])호선/);
  return line ? `s_${line[1]}` : null;
}
