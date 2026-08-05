export const QLT_PER_NAIRA = 10;

export function qltToNaira(qlt: number) {
  return qlt / QLT_PER_NAIRA;
}

export function formatNairaFromQlt(qlt: number, options?: Intl.NumberFormatOptions) {
  return qltToNaira(qlt).toLocaleString("en-NG", options);
}
