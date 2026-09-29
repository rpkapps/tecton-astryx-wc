/**
 * Two-letter ("Su") stand-alone weekday headers per locale. `Intl` cannot express CLDR's *short*
 * weekday width (it offers abbreviated, "Sun", and narrow, "S"), so the compact calendar header reads
 * this table, generated once from Unicode CLDR 48.2.0 (data: Unicode License; table adapted from
 * upstream, MIT). Locales it does not list fall back to `Intl`'s abbreviated names.
 */

/** Seven names, Sunday first. */
export type WeekdayNames = readonly [string, string, string, string, string, string, string];

const NAMES: Readonly<Record<string, WeekdayNames>> = {
  af: ['So.', 'Ma.', 'Di.', 'Wo.', 'Do.', 'Vr.', 'Sa.'],
  ar: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  'ar-SA': ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  ca: ['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.'],
  cs: ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'],
  da: ['sø.', 'ma.', 'ti.', 'on.', 'to.', 'fr.', 'lø.'],
  de: ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'],
  el: ['Κυ', 'Δε', 'Τρ', 'Τε', 'Πέ', 'Πα', 'Σά'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  es: ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'],
  fi: ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'],
  fr: ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'],
  he: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
  hu: ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'],
  it: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  nl: ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'],
  no: ['sø.', 'ma.', 'ti.', 'on.', 'to.', 'fr.', 'lø.'],
  pl: ['nie', 'pon', 'wto', 'śro', 'czw', 'pią', 'sob'],
  pt: ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'],
  'pt-PT': ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'],
  ro: ['du.', 'lu.', 'ma.', 'mi.', 'joi', 'vi.', 'sâ.'],
  ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  sr: ['не', 'по', 'ут', 'ср', 'че', 'пе', 'су'],
  sv: ['sö', 'må', 'ti', 'on', 'to', 'fr', 'lö'],
  tr: ['Pa', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'],
  uk: ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  'zh-TW': ['日', '一', '二', '三', '四', '五', '六'],
};

/**
 * The stand-alone short names for a locale (exact tag, then language), `null` when the table has none,
 * and English for a language tag that is not valid at all.
 */
export function getStandaloneShortWeekdayNames(locale: string): WeekdayNames | null {
  try {
    const parsed = new Intl.Locale(locale);
    return NAMES[parsed.baseName] ?? NAMES[parsed.language] ?? null;
  } catch {
    return NAMES.en!;
  }
}
