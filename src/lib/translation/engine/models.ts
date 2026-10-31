/**
 * The translation models, pinned to an exact Hugging Face revision with a
 * content hash for every file, so a model can never change underneath the
 * site and a corrupted download is never loaded. The first candidate for a
 * language pair is used; the next one is a fallback when the first cannot be
 * downloaded or loaded, or produces a broken sentence.
 *
 * Every model is an OPUS-MT model by the University of Helsinki (CC-BY 4.0 or
 * Apache 2.0) and runs on the engine's own Marian graph (marian.ts):
 *
 *   en>es, en>fr, en>pt, en>it         "transformer-big" Tatoeba Challenge models
 *   en>de                              the same, as converted by gsarti
 *   en>pl                              the West Slavic model (>>pol<<), then the Slavic one
 *   en>tl, en>vi, en>zh                the original OPUS-MT models (>>vie<<, >>cmn_Hans<<)
 *
 * There is deliberately NO en>ko model. The only English→Korean OPUS-MT model
 * on Hugging Face, Helsinki-NLP/opus-mt-tc-big-en-ko, was trained with separate
 * source and target vocabularies ("sepvoc") but converted with a single shared
 * (Korean) vocabulary, so English input maps mostly to <unk>: run through this
 * engine it answers "2, 4, 6 etc. are even numbers." with unrelated Korean,
 * where its model card expects "2, 4, 6 등은 짝수입니다." Korean readers get the
 * content as published (languages.ts, `hasContentModel`) until a working
 * model is pinned here.
 *
 * There are no models INTO English: parish names in other scripts are
 * transliterated, never translated (rules.ts, rule b — the name models that
 * were tried turned most names into wrong English).
 *
 * es/fr/de/pt and the ROMANCE fallback are The Augustine Journal's production
 * pins (sha256 of every file). The others were pinned from the Hugging Face
 * API on 2026-10-31: LFS files by their sha256, small git files by their git
 * blob SHA-1 (`gitSha1`), both verified after download (hub.ts). Several
 * revisions are the Hugging Face safetensors conversion (SFconvertbot) of the
 * published weights — a data-only format — exactly as the Journal pins them.
 */

export interface ModelFile {
  size: number;
  /** SHA-256 of the file (LFS files, and every file of the Journal's pins). */
  sha256?: string;
  /** Git blob SHA-1 of the file (small non-LFS files pinned from the Hub API). */
  gitSha1?: string;
}

export interface ModelCandidate {
  repo: string;
  revision: string;
  /** Sentence-initial target-language token for multilingual models. */
  targetToken: string | null;
  files: Record<string, ModelFile>;
}

/** "source>target", e.g. "en>es" or "ko>en". */
export type LanguagePair = `${string}>${string}`;

const ROMANCE_FILES: Record<string, ModelFile> = {
  "config.json": {
    size: 1403,
    sha256: "bcae8ed74fed77fb51c58462b62397fee6b1a1a34aece79183a0dd02ad329e71",
  },
  "generation_config.json": {
    size: 293,
    sha256: "837839ed0534a27084f9b980fc33f47729052dd89cb26cca7ac830765ed30e49",
  },
  "vocab.json": {
    size: 1457360,
    sha256: "f2ce5a92734a7859cb4e91dc9ccd823e4a71585efbe4bbfe25e96e3d4bf48f34",
  },
  "source.spm": {
    size: 779155,
    sha256: "b1f89e7b05828846baf19109a61029a36838f1c4f3defc218e6aee0ee2787864",
  },
  "target.spm": {
    size: 799001,
    sha256: "5e54632fe5ce5ef4108a827daccc121b7cd4ea589fbb4bd856b8dd06086166b2",
  },
  "model.safetensors": {
    size: 312062580,
    sha256: "e603d2220b47dd7ea7e3bb534b0e58b84122ebd6432809d0a85fefa973893370",
  },
};

const ROMANCE = (targetToken: string): ModelCandidate => ({
  repo: "Helsinki-NLP/opus-mt-en-ROMANCE",
  revision: "b20efd9837bd3779d6306ad15f053e819db31f83",
  targetToken,
  files: ROMANCE_FILES,
});

export const MODELS: Record<LanguagePair, ModelCandidate[]> = {
  "en>es": [
    {
      repo: "Helsinki-NLP/opus-mt-tc-big-en-es",
      revision: "8f4d4924189681076e9c642b2fd85278d793fd4d",
      targetToken: null,
      files: {
        "config.json": {
          size: 1076,
          sha256: "40cf2a78774927cd8374514a73c96a3fc2285748fae1bcdfe197e1dc1cc54692",
        },
        "generation_config.json": {
          size: 301,
          sha256: "8f8c2aeb22e87bcb1ea19cb206f4d9341d178574ab41778ab104ee7cf8db8379",
        },
        "vocab.json": {
          size: 1378022,
          sha256: "ee2728c5deb7c2dbe255df52b02b45285fda8a7c4dafc236e6d2af5dbeab5a36",
        },
        "source.spm": {
          size: 804235,
          sha256: "b1763341d3a71262ed5aacc3f8287d3c3c2f2ae82295e11d03aea80879c98009",
        },
        "target.spm": {
          size: 824118,
          sha256: "c70086dcac73d9c759cca0b5f195a073033906dcd29433d6c5fe74e66b2cc8da",
        },
        "model.safetensors": {
          size: 465549630,
          sha256: "1cc0d454aed713ccd07b4cb7801f08f72c1f885c79c6fd76d2b0d99ea0d3cd2b",
        },
      },
    },
    {
      repo: "Helsinki-NLP/opus-mt-en-es",
      revision: "fdaddf76f50fcc1583ba42f95965862a7ab30f97",
      targetToken: null,
      files: {
        "config.json": {
          size: 1473,
          sha256: "666ad3c2943674b6a789e311d221e44ec23e27f1bd9727930754bf773ec8e464",
        },
        "generation_config.json": {
          size: 293,
          sha256: "837839ed0534a27084f9b980fc33f47729052dd89cb26cca7ac830765ed30e49",
        },
        "vocab.json": {
          size: 1590040,
          sha256: "257f346d7a6b2ecceafcca8ba05648ce2fd68dfaf105fb0e913dca7198f3f6d5",
        },
        "source.spm": {
          size: 801636,
          sha256: "4dd547c24816a335e7b0b2e63376a8f1b3cbfc671eda5ab808dd44fdadaa8791",
        },
        "target.spm": {
          size: 825924,
          sha256: "e236ee6d866b635c0142114f8647f39831f9d92534aa2aad75c942f6a78ad0e3",
        },
        "model.safetensors": {
          size: 312062468,
          sha256: "b3ecbf954573c2fd95d05d3ad4618baf961793db0da07c2add2e8a3a6cd78d0b",
        },
      },
    },
  ],
  "en>fr": [
    {
      repo: "Helsinki-NLP/opus-mt-tc-big-en-fr",
      revision: "6e062862ced6f5622a589ab2aadc2a1d4978db78",
      targetToken: null,
      files: {
        "config.json": {
          size: 1076,
          sha256: "ac35de27c1645637a46d3b2f41052365ef52a7c23e169719629381f6b1fb025c",
        },
        "generation_config.json": {
          size: 301,
          sha256: "e08b63c58a6de96ea4275ac59681cefbf88663a10419e65e1510156061c43a88",
        },
        "vocab.json": {
          size: 1332010,
          sha256: "2994b7def69d6495d8f02369b57e3f04e2474f76ce64eda2921643e1f76fef41",
        },
        "source.spm": {
          size: 802408,
          sha256: "18bb5a422a53a0bd699b005c8086cbd58a85c4be427fd57ca687c958588edcc9",
        },
        "target.spm": {
          size: 819955,
          sha256: "6437b5600d2ae14888939e589773b09bc667c77e81326e20e3f57698a4078593",
        },
        "model.safetensors": {
          size: 461429130,
          sha256: "5c88b4f7a63934b8be72372b86661e616227c20be4b75612eeee7dca96494217",
        },
      },
    },
    {
      repo: "Helsinki-NLP/opus-mt-en-fr",
      revision: "c96fcd7f38a4c0d1ac9b61e255b47f3f7ff55e5e",
      targetToken: null,
      files: {
        "config.json": {
          size: 1416,
          sha256: "df92c371911b45282caac6101fe7e7f5d5e9af7f9a99356067ffe306278ce72b",
        },
        "generation_config.json": {
          size: 293,
          sha256: "4956fb9a7caaad7579cf8bb789c1e578b8a1cf48a0a8b779fda2f95dd10bbaa5",
        },
        "vocab.json": {
          size: 1339166,
          sha256: "945c604346ce15ce4aff9001001e7f925e336d942c4087017f191871162cbdc4",
        },
        "source.spm": {
          size: 778395,
          sha256: "173e9f493a668fe396d599e28d414a201193094e6ffd7a4678e5aab0f6d3d838",
        },
        "target.spm": {
          size: 802397,
          sha256: "78d0e717c77053f1c4b856d8661d9cb87c64f083a35418c087b9146300e4f585",
        },
        "model.safetensors": {
          size: 300803256,
          sha256: "c32d3003ced798c78b9ca90fb69c8e23ad5b4c64c500628bdf3303bbc9272816",
        },
      },
    },
  ],
  "en>it": [
    {
      repo: "Helsinki-NLP/opus-mt-tc-big-en-it",
      revision: "592d2cfb0797867f1dd223e49141de051faa65c7",
      targetToken: null,
      files: {
        "config.json": { size: 1076, gitSha1: "360c18ae934222e4c119671dcab536e34c3999aa" },
        "generation_config.json": {
          size: 301,
          gitSha1: "87aadaec4e35242afa0cd763e97ff5f3915f3993",
        },
        "vocab.json": { size: 1339648, gitSha1: "100dbf81a2961b9b181980d335d54a1ba3e5a3af" },
        "source.spm": {
          size: 802852,
          sha256: "50e828d41b3ea6c89ef4c3312cb74ba3d942f4d313ec19c5115aa535cb5ba286",
        },
        "target.spm": {
          size: 820134,
          sha256: "cf5ee094f498d8391ff2bbd52c4488c3d53f72175ff9b3e8094bfd45ffc77c59",
        },
        "model.safetensors": {
          size: 464309380,
          sha256: "5c8e2b4c7c161fb30cb609818d187101697d06e5c6265700adfa91126478b6d1",
        },
      },
    },
    ROMANCE(">>it<<"),
  ],
  "en>de": [
    {
      repo: "gsarti/opus-mt-tc-big-en-de",
      revision: "c2dcc36fd4e878b6fa9d7652c98f39c73dca27a1",
      targetToken: null,
      files: {
        "config.json": {
          size: 1068,
          sha256: "ce9ab042435c78b2a44f03fddecef0e2c5735a438c770da855a90777bb56c907",
        },
        "vocab.json": {
          size: 1697908,
          sha256: "48965870075904f08e6ad5a2b32874c3dcf3f9b72b089e75ea81d1425516c007",
        },
        "source.spm": {
          size: 794463,
          sha256: "209a2bf269540755fc2a29491e57c963bc8c6c1d14dab9f0779cf1dc54fc7d8c",
        },
        "target.spm": {
          size: 818726,
          sha256: "44faa3234c2e663705f548e868d84d204530af95812b24f320a6d9ace9ae6482",
        },
        "pytorch_model.bin": {
          size: 619169923,
          sha256: "94ff3bc13fb7c6e175ced0ce952d1ec47f8d836fe70045c0f2e6cbc78e92bd53",
        },
      },
    },
    {
      repo: "Helsinki-NLP/opus-mt-en-de",
      revision: "0012d6d6ff4b4dd06bee042d3294295f0e587abd",
      targetToken: null,
      files: {
        "config.json": {
          size: 1335,
          sha256: "41c7890e6f6c1f72c5c626569cfe739a8362080940edbb1747f25173f541653b",
        },
        "generation_config.json": {
          size: 293,
          sha256: "e5cccf365761fb31175fc978a75f5e857a822f173d0e447aa3a25d7cbcda15a4",
        },
        "vocab.json": {
          size: 1273232,
          sha256: "0d70d89fee4a8b4ef99a56d712163baadcabd5600a597f71515547ee70306329",
        },
        "source.spm": {
          size: 768489,
          sha256: "678f2a1177d8389f67b66299762dcc4fc567e89b07e212ba91b0c56daecf47ce",
        },
        "target.spm": {
          size: 796845,
          sha256: "bbd1f495eea99c8e21ae086d9146e0fa7b096c3dfdd9ba07ab8b631889df5c9b",
        },
        "model.safetensors": {
          size: 297903668,
          sha256: "3fb78700bce624990eff6468d0e14fbde18a6aedac35821fa8c0c4ead5fae014",
        },
      },
    },
  ],
  "en>pt": [
    {
      repo: "Helsinki-NLP/opus-mt-tc-big-en-pt",
      revision: "9f2863d807ecf91a374bdbecb8d01e402e90622e",
      targetToken: ">>pob<<",
      files: {
        "config.json": {
          size: 1076,
          sha256: "ca76b1818f066007e94fb2519c0752320cee36a5d4947bf7ef4477c845feacc5",
        },
        "generation_config.json": {
          size: 301,
          sha256: "0cf63469feb877c42fee042a5e9f429117297abee3d5641a4c347fec09597126",
        },
        "vocab.json": {
          size: 1380764,
          sha256: "dad10ad0acbf34ad92af16cb37fd71732d2b73851274698d58c5439386b506a1",
        },
        "source.spm": {
          size: 802741,
          sha256: "7a7fcf812cf03a5785daa35d4932bbbe69e7e605c0fe56fce5a3f731d6c355aa",
        },
        "target.spm": {
          size: 824855,
          sha256: "b3cf20ccd4e48a89882cfdba157c05fa1cd71a6b69517dfc80e3a34d387ea91f",
        },
        "model.safetensors": {
          size: 465035080,
          sha256: "f1772ec97f6cb5b942bb6a5555a04272960a228a523f7ed47e24014236aa1716",
        },
      },
    },
    ROMANCE(">>pt_br<<"),
  ],
  "en>pl": [
    {
      repo: "Helsinki-NLP/opus-mt-en-zlw",
      revision: "c8cec26ea249a96cb89364f48fe569a50ad1df2c",
      targetToken: ">>pol<<",
      files: {
        "config.json": { size: 1395, gitSha1: "d625a2703d35d02f638ebe60a191c091f152c021" },
        "generation_config.json": {
          size: 293,
          gitSha1: "76470771323a2725730c91b28979c0c0976d2297",
        },
        "vocab.json": { size: 1372196, gitSha1: "107b3c0653cf1ccfe04d64ca9d2f796140b5a6f3" },
        "source.spm": { size: 788226, gitSha1: "70c5075cba456fadee4d8db3bb7b825665a481e8" },
        "target.spm": { size: 815306, gitSha1: "0ae442f7efa5a5eaa7692e332984fb36fc853194" },
        "model.safetensors": {
          size: 297803120,
          sha256: "b84376bfce07e29ab137fc0095cf2cfc2ed6629ffc5378d5aa49846b020c63cb",
        },
      },
    },
    {
      repo: "Helsinki-NLP/opus-mt-en-sla",
      revision: "33d47b277dc48afadb3b7084c9813ded26418dc6",
      targetToken: ">>pol<<",
      files: {
        "config.json": { size: 1395, gitSha1: "d9cc6c5300415e8f1b97b335a9f00c692d34b791" },
        "generation_config.json": {
          size: 293,
          gitSha1: "b5578ddff28fb5bcc5f5ca959fa9df6c2b310230",
        },
        "vocab.json": { size: 1714992, gitSha1: "dafdb4bdc9b04b5feb48592010ff2efb5201226d" },
        "source.spm": { size: 791358, gitSha1: "c232215fa17d9fe3927d8f6220337bf48379396a" },
        "target.spm": { size: 860404, gitSha1: "c749c776ad99a3f9ede35b4a08e303e59b874cbc" },
        "model.safetensors": {
          size: 299500124,
          sha256: "1d5905733df3fa3f09567901e66a36c6540f513bbaf229c187b1ea71bd5eb8ef",
        },
      },
    },
  ],
  "en>tl": [
    {
      repo: "Helsinki-NLP/opus-mt-en-tl",
      revision: "17fad592db394bf500e20fc8bf2868b0a4fca62a",
      targetToken: null,
      files: {
        "config.json": { size: 1361, gitSha1: "32d4f2a3983141e7177c93aea686a71044bddaa2" },
        "generation_config.json": {
          size: 293,
          gitSha1: "016232ddd3a2eb88055a05308ffca16a202605a1",
        },
        "vocab.json": { size: 1324714, gitSha1: "6c5fc876ee57d31e014d0605bce90c7068dd8934" },
        "source.spm": { size: 826681, gitSha1: "760608b1dea9e35c52a1a64a875535e5fe9976a6" },
        "target.spm": { size: 834725, gitSha1: "47606eb5c47fddcbb21244b7e96e4baf21dd2d78" },
        "model.safetensors": {
          size: 296409812,
          sha256: "1c7747e1f1da8e6969b16a8f1cba761ea23d28ec9d8dd6cf91b8571c710e92c2",
        },
      },
    },
  ],
  "en>vi": [
    {
      repo: "Helsinki-NLP/opus-mt-en-vi",
      revision: "3ab3b2d9aa096a3b0c20668d87566bb92613aba1",
      targetToken: ">>vie<<",
      files: {
        "config.json": { size: 1394, gitSha1: "7bc4661b0a2275eaa88a624bdef5624080d5ed5d" },
        "generation_config.json": {
          size: 293,
          gitSha1: "4d3e4b20f593671e1d238c0dbf4315d490e60d93",
        },
        "vocab.json": { size: 1192392, gitSha1: "cc109f130182fe2cb7666d8482a8f30c3a43a3c5" },
        "source.spm": { size: 808612, gitSha1: "d577dd343bb74b9ef8f85676df0ccc52e2f2b9ee" },
        "target.spm": { size: 756198, gitSha1: "918444ca1e35e114cbb5ee93e127c36c883de399" },
        "model.safetensors": {
          size: 288842036,
          sha256: "652c300995d3d074c558ed799dbc9afba223441102cafee1b20e1c52a825d3a6",
        },
      },
    },
  ],
  "en>zh": [
    {
      repo: "Helsinki-NLP/opus-mt-en-zh",
      revision: "68e1208cb5c05563fa24b83785b660c65ba7b047",
      targetToken: ">>cmn_Hans<<",
      files: {
        "config.json": { size: 1403, gitSha1: "e2c7882d05248a3e47cfa69f3dc6d5cfd99a3c07" },
        "generation_config.json": {
          size: 293,
          gitSha1: "f07859fcab98712b231d115475990a962eebc851",
        },
        "vocab.json": { size: 1617791, gitSha1: "423d3deb0188828da557bb61494bf73e4b86d275" },
        "source.spm": { size: 806435, gitSha1: "3f695c68a3aeb685ded9a5db0865af02c986bebf" },
        "target.spm": { size: 804600, gitSha1: "e19744e15a0f53b209fa40dbdc9e7fc4e96771cd" },
        "model.safetensors": {
          size: 312062580,
          sha256: "2faa8895e5a0427c2ff8b9b692b1198975964d8143bb84f55193587ab62314f2",
        },
      },
    },
  ],
};

/** Short, stable identifier of a model candidate (stored with each translation). */
export function modelKey(candidate: Pick<ModelCandidate, "repo" | "revision">): string {
  return `${candidate.repo}@${candidate.revision.slice(0, 12)}`;
}

export function candidatesFor(pair: LanguagePair): ModelCandidate[] {
  return MODELS[pair] ?? [];
}

/** Total download size of a candidate, in bytes. */
export function candidateBytes(candidate: ModelCandidate): number {
  return Object.values(candidate.files).reduce((sum, f) => sum + f.size, 0);
}
