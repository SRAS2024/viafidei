/**
 * Static index of the vendored Douay-Rheims JSON store (one file per book,
 * Paratext/USFM code as the key). Static imports keep the module bundler-safe
 * for the Next.js server build and the worker alike; the store is loaded once
 * per process. Server/worker only — never import from client components.
 */

import type { BookCode } from "../books";

import GEN from "./GEN.json";
import EXO from "./EXO.json";
import LEV from "./LEV.json";
import NUM from "./NUM.json";
import DEU from "./DEU.json";
import JOS from "./JOS.json";
import JDG from "./JDG.json";
import RUT from "./RUT.json";
import B1SA from "./1SA.json";
import B2SA from "./2SA.json";
import B1KI from "./1KI.json";
import B2KI from "./2KI.json";
import B1CH from "./1CH.json";
import B2CH from "./2CH.json";
import EZR from "./EZR.json";
import NEH from "./NEH.json";
import TOB from "./TOB.json";
import JDT from "./JDT.json";
import EST from "./EST.json";
import B1MA from "./1MA.json";
import B2MA from "./2MA.json";
import JOB from "./JOB.json";
import PSA from "./PSA.json";
import PRO from "./PRO.json";
import ECC from "./ECC.json";
import SNG from "./SNG.json";
import WIS from "./WIS.json";
import SIR from "./SIR.json";
import ISA from "./ISA.json";
import JER from "./JER.json";
import LAM from "./LAM.json";
import BAR from "./BAR.json";
import EZK from "./EZK.json";
import DAN from "./DAN.json";
import HOS from "./HOS.json";
import JOL from "./JOL.json";
import AMO from "./AMO.json";
import OBA from "./OBA.json";
import JON from "./JON.json";
import MIC from "./MIC.json";
import NAM from "./NAM.json";
import HAB from "./HAB.json";
import ZEP from "./ZEP.json";
import HAG from "./HAG.json";
import ZEC from "./ZEC.json";
import MAL from "./MAL.json";
import MAT from "./MAT.json";
import MRK from "./MRK.json";
import LUK from "./LUK.json";
import JHN from "./JHN.json";
import ACT from "./ACT.json";
import ROM from "./ROM.json";
import B1CO from "./1CO.json";
import B2CO from "./2CO.json";
import GAL from "./GAL.json";
import EPH from "./EPH.json";
import PHP from "./PHP.json";
import COL from "./COL.json";
import B1TH from "./1TH.json";
import B2TH from "./2TH.json";
import B1TI from "./1TI.json";
import B2TI from "./2TI.json";
import TIT from "./TIT.json";
import PHM from "./PHM.json";
import HEB from "./HEB.json";
import JAS from "./JAS.json";
import B1PE from "./1PE.json";
import B2PE from "./2PE.json";
import B1JN from "./1JN.json";
import B2JN from "./2JN.json";
import B3JN from "./3JN.json";
import JUD from "./JUD.json";
import REV from "./REV.json";

export interface DouayBook {
  code: string;
  name: string;
  translation: string;
  /** chapter number (as a string) → verse number (as a string) → verse text */
  chapters: Record<string, Record<string, string>>;
}

export const DRA_BOOKS: Record<BookCode, DouayBook> = {
  GEN: GEN,
  EXO: EXO,
  LEV: LEV,
  NUM: NUM,
  DEU: DEU,
  JOS: JOS,
  JDG: JDG,
  RUT: RUT,
  "1SA": B1SA,
  "2SA": B2SA,
  "1KI": B1KI,
  "2KI": B2KI,
  "1CH": B1CH,
  "2CH": B2CH,
  EZR: EZR,
  NEH: NEH,
  TOB: TOB,
  JDT: JDT,
  EST: EST,
  "1MA": B1MA,
  "2MA": B2MA,
  JOB: JOB,
  PSA: PSA,
  PRO: PRO,
  ECC: ECC,
  SNG: SNG,
  WIS: WIS,
  SIR: SIR,
  ISA: ISA,
  JER: JER,
  LAM: LAM,
  BAR: BAR,
  EZK: EZK,
  DAN: DAN,
  HOS: HOS,
  JOL: JOL,
  AMO: AMO,
  OBA: OBA,
  JON: JON,
  MIC: MIC,
  NAM: NAM,
  HAB: HAB,
  ZEP: ZEP,
  HAG: HAG,
  ZEC: ZEC,
  MAL: MAL,
  MAT: MAT,
  MRK: MRK,
  LUK: LUK,
  JHN: JHN,
  ACT: ACT,
  ROM: ROM,
  "1CO": B1CO,
  "2CO": B2CO,
  GAL: GAL,
  EPH: EPH,
  PHP: PHP,
  COL: COL,
  "1TH": B1TH,
  "2TH": B2TH,
  "1TI": B1TI,
  "2TI": B2TI,
  TIT: TIT,
  PHM: PHM,
  HEB: HEB,
  JAS: JAS,
  "1PE": B1PE,
  "2PE": B2PE,
  "1JN": B1JN,
  "2JN": B2JN,
  "3JN": B3JN,
  JUD: JUD,
  REV: REV,
};
