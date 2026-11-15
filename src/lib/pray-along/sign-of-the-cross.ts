/**
 * The Sign of the Cross the audio opens and closes every prayer with, in the
 * language it prays in (the owner's words: "In the name of the Father, and of the Son,
 * and of the Holy Spirit. Amen.").
 *
 * Each text is the form the Church uses in that language: the English and Latin of the
 * Roman Missal, the bishops' conferences' own wording elsewhere (Korean: the Catholic
 * Bishops' Conference of Korea; Chinese: the mainland Catholic form with 圣神 and
 * 阿们; Greek: the Byzantine formula, said with modern pronunciation).
 *
 * Pure: no I/O, no React.
 */

import type { AudioLang } from "./languages";
import { foldForCompare } from "./speech-text";

export const SIGN_OF_THE_CROSS: Readonly<Record<AudioLang, string>> = {
  en: "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.",
  es: "En el nombre del Padre, y del Hijo, y del Espíritu Santo. Amén.",
  fr: "Au nom du Père, et du Fils, et du Saint-Esprit. Amen.",
  it: "Nel nome del Padre e del Figlio e dello Spirito Santo. Amen.",
  de: "Im Namen des Vaters und des Sohnes und des Heiligen Geistes. Amen.",
  pt: "Em nome do Pai e do Filho e do Espírito Santo. Amém.",
  pl: "W imię Ojca i Syna, i Ducha Świętego. Amen.",
  la: "In nomine Patris, et Filii, et Spiritus Sancti. Amen.",
  tl: "Sa ngalan ng Ama, at ng Anak, at ng Espiritu Santo. Amen.",
  vi: "Nhân danh Cha và Con và Thánh Thần. Amen.",
  ko: "성부와 성자와 성령의 이름으로. 아멘.",
  zh: "因父、及子、及圣神之名。阿们。",
  el: "Εις το όνομα του Πατρός και του Υιού και του Αγίου Πνεύματος. Αμήν.",
};

/** The opening words that mark a text as already beginning with the Sign of the Cross. */
const OPENINGS: Readonly<Record<AudioLang, string[]>> = {
  en: ["in the name of the father"],
  es: ["en el nombre del padre", "por la senal de la santa cruz"],
  fr: ["au nom du pere"],
  it: ["nel nome del padre", "in nome del padre"],
  de: ["im namen des vaters"],
  pt: ["em nome do pai", "pelo sinal da santa cruz"],
  pl: ["w imie ojca"],
  la: ["in nomine patris"],
  tl: ["sa ngalan ng ama"],
  vi: ["nhan danh cha"],
  ko: ["성부와 성자와 성령의 이름으로"],
  zh: ["因父"],
  el: ["εις το ονομα του πατρος"],
};

/** Does `text` open with the Sign of the Cross (in its language or in English)? */
export function opensWithSignOfTheCross(text: string, lang: AudioLang): boolean {
  const folded = foldForCompare(text).slice(0, 80);
  return [...OPENINGS[lang], ...OPENINGS.en].some((o) => folded.startsWith(foldForCompare(o)));
}

/**
 * Does `text` close with the Sign of the Cross: does its last opening phrase begin a
 * stretch no longer than the Sign of the Cross itself? A short prayer that only OPENS
 * with it ("In the name of the Father… Amen. O God, come to my assistance.") does not.
 */
export function closesWithSignOfTheCross(text: string, lang: AudioLang): boolean {
  const folded = foldForCompare(text);
  return ([lang, "en"] as const).some((l) => {
    const whole = foldForCompare(SIGN_OF_THE_CROSS[l]).length;
    return OPENINGS[l].some((o) => {
      const at = folded.lastIndexOf(foldForCompare(o));
      return at >= 0 && folded.length - at <= whole + 12;
    });
  });
}
