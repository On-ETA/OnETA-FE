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
  strong: "#1FCB68",
  light: "#E4FCEB",
};

export function getTransitColors(segment) {
  const name = String(
    segment?.transitName ??
      segment?.routeNumber ??
      segment?.busNumber ??
      segment?.raw?.transitName ??
      "",
  ).trim();

  const line = SUBWAY_LINE_COLORS.find(([label]) =>
    label.length === 1 ? new RegExp(`(^|\\D)${label}호선`).test(name) : name.includes(label),
  );

  return line
    ? { strong: line[1], light: line[2], isSubway: true }
    : { ...DEFAULT_TRANSIT_COLORS, isSubway: false };
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
