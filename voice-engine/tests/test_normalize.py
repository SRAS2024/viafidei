"""normalize.py: digits, ordinals, regnal numerals and symbols per language, and that
prayer text with nothing to normalise comes back word for word."""

import pytest

from normalize import LANGS, MAX_NUMBER, normalize_for_voice, ordinal, spell_number

# --------------------------------------------------------------------------- numbers

# 0, 7, 10..21, 99, 100, 101, 1000, 2026 (as a cardinal), 123,456,789.
CARDINALS = {
    "en": [
        "zero", "seven", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
        "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "ninety-nine", "one hundred",
        "one hundred one", "one thousand", "two thousand twenty-six",
        "one hundred twenty-three million four hundred fifty-six thousand seven hundred eighty-nine",
    ],
    "es": [
        "cero", "siete", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis",
        "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "noventa y nueve", "cien",
        "ciento uno", "mil", "dos mil veintiséis",
        "ciento veintitrés millones cuatrocientos cincuenta y seis mil setecientos ochenta y nueve",
    ],
    "fr": [
        "zéro", "sept", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
        "dix-huit", "dix-neuf", "vingt", "vingt et un", "quatre-vingt-dix-neuf", "cent", "cent un",
        "mille", "deux mille vingt-six",
        "cent vingt-trois millions quatre cent cinquante-six mille sept cent quatre-vingt-neuf",
    ],
    "it": [
        "zero", "sette", "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici",
        "diciassette", "diciotto", "diciannove", "venti", "ventuno", "novantanove", "cento",
        "centouno", "mille", "duemilaventisei",
        "centoventitré milioni quattrocentocinquantaseimilasettecentottantanove",
    ],
    "de": [
        "null", "sieben", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn",
        "siebzehn", "achtzehn", "neunzehn", "zwanzig", "einundzwanzig", "neunundneunzig", "hundert",
        "hunderteins", "tausend", "zweitausendsechsundzwanzig",
        "hundertdreiundzwanzig Millionen vierhundertsechsundfünfzigtausendsiebenhundertneunundachtzig",
    ],
    "pt": [
        "zero", "sete", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
        "dezessete", "dezoito", "dezenove", "vinte", "vinte e um", "noventa e nove", "cem",
        "cento e um", "mil", "dois mil e vinte e seis",
        "cento e vinte e três milhões quatrocentos e cinquenta e seis mil setecentos e oitenta e nove",
    ],
    "pl": [
        "zero", "siedem", "dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście",
        "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście", "dwadzieścia",
        "dwadzieścia jeden", "dziewięćdziesiąt dziewięć", "sto", "sto jeden", "tysiąc",
        "dwa tysiące dwadzieścia sześć",
        "sto dwadzieścia trzy miliony czterysta pięćdziesiąt sześć tysięcy siedemset osiemdziesiąt dziewięć",
    ],
    "tl": [
        "sero", "pito", "sampu", "labing-isa", "labindalawa", "labintatlo", "labing-apat",
        "labinlima", "labing-anim", "labimpito", "labingwalo", "labinsiyam", "dalawampu",
        "dalawampu't isa", "siyamnapu't siyam", "isang daan", "isang daan at isa", "isang libo",
        "dalawang libo't dalawampu't anim",
        "isang daan at dalawampu't tatlong milyon at apat na raan at limampu't anim na libo't "
        "pitong daan at walumpu't siyam",
    ],
    "vi": [
        "không", "bảy", "mười", "mười một", "mười hai", "mười ba", "mười bốn", "mười lăm", "mười sáu",
        "mười bảy", "mười tám", "mười chín", "hai mươi", "hai mươi mốt", "chín mươi chín", "một trăm",
        "một trăm linh một", "một nghìn", "hai nghìn không trăm hai mươi sáu",
        "một trăm hai mươi ba triệu bốn trăm năm mươi sáu nghìn bảy trăm tám mươi chín",
    ],
    "ko": [
        "영", "칠", "십", "십일", "십이", "십삼", "십사", "십오", "십육", "십칠", "십팔", "십구", "이십",
        "이십일", "구십구", "백", "백일", "천", "이천이십육", "일억 이천삼백사십오만 육천칠백팔십구",
    ],
    "zh": [
        "零", "七", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
        "二十一", "九十九", "一百", "一百零一", "一千", "两千零二十六", "一亿二千三百四十五万六千七百八十九",
    ],
    "el": [
        "μηδέν", "επτά", "δέκα", "έντεκα", "δώδεκα", "δεκατρία", "δεκατέσσερα", "δεκαπέντε",
        "δεκαέξι", "δεκαεπτά", "δεκαοκτώ", "δεκαεννέα", "είκοσι", "είκοσι ένα", "ενενήντα εννέα",
        "εκατό", "εκατόν ένα", "χίλια", "δύο χιλιάδες είκοσι έξι",
        "εκατόν είκοσι τρία εκατομμύρια τετρακόσιες πενήντα έξι χιλιάδες επτακόσια ογδόντα εννέα",
    ],
}
NUMBERS = [0, 7, *range(10, 22), 99, 100, 101, 1000, 2026, 123_456_789]


@pytest.mark.parametrize("lang", sorted(CARDINALS))
def test_cardinals(lang):
    assert [spell_number(n, lang) for n in NUMBERS] == CARDINALS[lang]


def test_latin_cardinals():
    assert [spell_number(n, "la") for n in NUMBERS[:-1]] == [
        "nihil", "septem", "decem", "undecim", "duodecim", "tredecim", "quattuordecim", "quindecim",
        "sedecim", "septendecim", "duodeviginti", "undeviginti", "viginti", "viginti unus",
        "undecentum", "centum", "centum unus", "mille", "duo milia viginti sex",
    ]
    assert spell_number(28, "la") == "duodetriginta"
    assert spell_number(98, "la") == "duodecentum"
    assert spell_number(3999, "la") == "tria milia nongenti nonaginta novem"
    assert spell_number(123_456, "la") == "centum viginti tria milia quadringenti quinquaginta sex"
    with pytest.raises(ValueError):
        spell_number(1_000_000, "la")


@pytest.mark.parametrize(
    "lang,n,words",
    [
        ("fr", 71, "soixante et onze"),
        ("fr", 80, "quatre-vingts"),
        ("fr", 81, "quatre-vingt-un"),
        ("fr", 91, "quatre-vingt-onze"),
        ("fr", 200, "deux cents"),
        ("fr", 201, "deux cent un"),
        ("fr", 80_000, "quatre-vingt mille"),
        ("fr", 200_000, "deux cent mille"),
        ("it", 23, "ventitré"),
        ("it", 28, "ventotto"),
        ("it", 108, "centotto"),
        ("it", 103, "centotré"),
        ("it", 21_000, "ventunomila"),
        ("it", 1_000_000, "un milione"),
        ("es", 21_000, "veintiún mil"),
        ("es", 100_000, "cien mil"),
        ("es", 1_000_000, "un millón"),
        ("es", 21_000_000, "veintiún millones"),
        ("de", 1100, "tausendeinhundert"),
        ("de", 121_000, "hunderteinundzwanzigtausend"),
        ("de", 2_000_000, "zwei Millionen"),
        ("pt", 1100, "mil e cem"),
        ("pt", 1101, "mil cento e um"),
        ("pt", 1_200_000, "um milhão e duzentos mil"),
        ("pl", 2000, "dwa tysiące"),
        ("pl", 5000, "pięć tysięcy"),
        ("pl", 12_000, "dwanaście tysięcy"),
        ("pl", 22_000, "dwadzieścia dwa tysiące"),
        ("pl", 102_000, "sto dwa tysiące"),
        ("pl", 5_000_000, "pięć milionów"),
        ("tl", 400, "apat na raan"),
        ("tl", 600, "anim na raan"),
        ("tl", 11_000, "labing-isang libo"),
        ("tl", 100_000, "isang daang libo"),
        ("vi", 105, "một trăm linh năm"),
        ("vi", 115, "một trăm mười lăm"),
        ("vi", 1001, "một nghìn không trăm linh một"),
        ("vi", 1010, "một nghìn không trăm mười"),
        ("vi", 25, "hai mươi lăm"),
        ("ko", 10_000, "만"),
        ("ko", 100_000_000, "일억"),
        ("zh", 10_010, "一万零一十"),
        ("zh", 100_000, "十万"),
        ("zh", 1_000_001, "一百万零一"),
        ("zh", 20_000, "两万"),
        ("el", 3000, "τρεις χιλιάδες"),
        ("el", 21_000, "είκοσι μία χιλιάδες"),
        ("el", 200_000, "διακόσιες χιλιάδες"),
        ("el", 2_000_000, "δύο εκατομμύρια"),
    ],
)
def test_cardinal_details(lang, n, words):
    assert spell_number(n, lang) == words


def test_spell_number_rejects_bad_input():
    with pytest.raises(ValueError):
        spell_number(-1, "en")
    with pytest.raises(ValueError):
        spell_number(MAX_NUMBER + 1, "en")
    with pytest.raises(ValueError):
        spell_number(5, "xx")
    with pytest.raises(ValueError):
        normalize_for_voice("5", "xx")


# --------------------------------------------------------------------------- years

YEARS = {
    "en": ("In 1917.", "In nineteen seventeen."),
    "de": ("Im Jahr 1917.", "Im Jahr neunzehnhundertsiebzehn."),
    "es": ("En 1917.", "En mil novecientos diecisiete."),
    "fr": ("En 1917.", "En mille neuf cent dix-sept."),
    "it": ("Nel 1917.", "Nel millenovecentodiciassette."),
    "pt": ("Em 1917.", "Em mil novecentos e dezessete."),
    "zh": ("1917年", "一九一七年"),
    "ko": ("1917년", "천구백십칠년"),
}


@pytest.mark.parametrize("lang", sorted(YEARS))
def test_years(lang):
    text, said = YEARS[lang]
    assert normalize_for_voice(text, lang) == said


def test_english_years_and_quantities():
    assert normalize_for_voice("2026", "en") == "twenty twenty-six"
    assert normalize_for_voice("2005", "en") == "two thousand five"
    assert normalize_for_voice("1905", "en") == "nineteen oh five"
    assert normalize_for_voice("1900", "en") == "nineteen hundred"
    assert normalize_for_voice("1,000 souls", "en") == "one thousand souls"
    assert normalize_for_voice("2000", "en") == "two thousand"


def test_polish_years_before_roku():
    assert normalize_for_voice("w 1917 roku", "pl") == "w tysiąc dziewięćset siedemnastym roku"
    assert normalize_for_voice("od 2026 roku", "pl") == "od dwa tysiące dwudziestego szóstego roku"
    assert normalize_for_voice("w 2000 r.", "pl") == "w dwutysięcznym roku."
    assert normalize_for_voice("1917 r. potem", "pl") == "tysiąc dziewięćset siedemnastego roku potem"


# --------------------------------------------------------------------------- ordinals


@pytest.mark.parametrize(
    "lang,text,said",
    [
        ("en", "the 1st, 2nd, 3rd, 4th, 11th, 12th, 21st and 100th", "the first, second, third, fourth, eleventh, twelfth, twenty-first and one hundredth"),
        ("es", "el 1º, la 2ª, el 3.º y el 1er día", "el primero, la segunda, el tercero y el primer día"),
        ("pt", "o 1º e a 2ª vez", "o primeiro e a segunda vez"),
        ("it", "il 1º, la 3ª, il 23º", "il primo, la terza, il ventitreesimo"),
        ("fr", "le 1er, la 1re, la 2e, le 9e, le 21e", "le premier, la première, la deuxième, le neuvième, le vingt et unième"),
        ("fr", "au XXe siècle", "au vingtième siècle"),
        ("de", "am 8. Dezember, der 3. Tag, zum 2. Mal", "am achten Dezember, der dritte Tag, zum zweiten Mal"),
        ("tl", "ika-3 at ika-10", "ikatlo at ikasampu"),
        ("vi", "thứ 1, thứ 2, thứ 4", "thứ nhất, thứ hai, thứ tư"),
        ("el", "ο 1ος, η 2η, του 3ου", "ο πρώτος, η δεύτερη, του τρίτου"),
        ("ko", "1번째, 2번째", "첫 번째, 두 번째"),
        ("zh", "第2次", "第二次"),
    ],
)
def test_ordinal_marks(lang, text, said):
    assert normalize_for_voice(text, lang) == said


def test_ordinal_helper():
    assert ordinal(21, "en") == "twenty-first"
    assert ordinal(2, "de") == "zweite"
    assert ordinal(3, "de", case="dat") == "dritten"
    assert ordinal(23, "pl", "m", "gen") == "dwudziestego trzeciego"
    assert ordinal(3, "pl", "f", "loc") == "trzeciej"
    assert ordinal(14, "la", "m", "gen") == "quarti decimi"
    assert ordinal(2, "el", "f") == "δεύτερη"
    assert ordinal(23, "it") == "ventitreesimo"
    assert ordinal(26, "it") == "ventiseiesimo"
    assert ordinal(5, "fr") == "cinquième"
    assert ordinal(9, "fr") == "neuvième"
    assert ordinal(4, "vi") == "thứ tư"
    assert ordinal(3, "zh") == "第三"


# --------------------------------------------------------------------------- regnal numerals

REGNAL = {
    "en": ("Pope Pius X and Saint John Paul II", "Pope Pius the Tenth and Saint John Paul the Second"),
    "es": ("Juan Pablo II y Juan XXIII", "Juan Pablo segundo y Juan veintitrés"),
    "fr": ("Jean-Paul II et François Ier", "Jean-Paul deux et François premier"),
    "it": ("Giovanni Paolo II e Giovanni XXIII", "Giovanni Paolo secondo e Giovanni ventitreesimo"),
    "de": ("Johannes Paul II. betete", "Johannes Paul der Zweite betete"),
    "pt": ("João Paulo II e Bento XVI", "João Paulo segundo e Bento dezesseis"),
    "pl": ("Jan Paweł II", "Jan Paweł Drugi"),
    "la": ("Ioannes Paulus II", "Ioannes Paulus secundus"),
    "tl": ("Juan Pablo II", "Juan Pablo Segundo"),
    "vi": ("Gioan Phaolô II và Bênêđictô XVI", "Gioan Phaolô đệ nhị và Bênêđictô mười sáu"),
    "el": ("Ιωάννης Παύλος Β΄", "Ιωάννης Παύλος δεύτερος"),
    "ko": ("요한 바오로 2세", "요한 바오로 이세"),
    "zh": ("若望保禄2世", "若望保禄二世"),
}


@pytest.mark.parametrize("lang", LANGS)
def test_regnal_numeral(lang):
    text, said = REGNAL[lang]
    assert normalize_for_voice(text, lang) == said


@pytest.mark.parametrize(
    "lang,text,said",
    [
        ("en", "Vatican II", "Vatican two"),
        ("en", "Leo XIV.", "Leo the Fourteenth."),
        ("es", "Pío XII e Isabel II", "Pío doce e Isabel segunda"),
        ("es", "el siglo XX", "el siglo veinte"),
        ("it", "Leone XIV e Pio X", "Leone quattordicesimo e Pio decimo"),
        ("it", "Giovanni Paolo I.", "Giovanni Paolo primo."),
        ("de", "Leo XIV. Danach", "Leo der Vierzehnte. Danach"),
        ("de", "Kapitel IV", "Kapitel vier"),
        ("pt", "João XXIII e Pio XII", "João vinte e três e Pio doze"),
        ("pl", "Jana Pawła II", "Jana Pawła Drugiego"),
        ("pl", "Janowi Pawłowi II", "Janowi Pawłowi Drugiemu"),
        ("pl", "Stacja IV", "Stacja czwarta"),
        ("la", "Pius XII, Leo XIV, Pauli VI", "Pius duodecimus, Leo quartus decimus, Pauli sexti"),
        ("tl", "Pio XII at Juan XXIII", "Pio Dose at Juan Bente Tres"),
        ("vi", "Công đồng Vaticanô II", "Công đồng Vaticanô hai"),
        ("el", "Ιωάννου Παύλου Β΄", "Ιωάννου Παύλου δευτέρου"),
        ("el", "Λέων ΙΔ΄", "Λέων δέκατος τέταρτος"),
    ],
)
def test_regnal_details(lang, text, said):
    assert normalize_for_voice(text, lang) == said


# --------------------------------------------------------------------------- words left alone

SIGN_OF_THE_CROSS = {
    "en": "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.",
    "es": "En el nombre del Padre, y del Hijo, y del Espíritu Santo. Amén.",
    "fr": "Au nom du Père, et du Fils, et du Saint-Esprit. Amen.",
    "it": "Nel nome del Padre e del Figlio e dello Spirito Santo. Amen.",
    "de": "Im Namen des Vaters und des Sohnes und des Heiligen Geistes. Amen.",
    "pt": "Em nome do Pai e do Filho e do Espírito Santo. Amém.",
    "pl": "W imię Ojca i Syna, i Ducha Świętego. Amen.",
    "la": "In nomine Patris, et Filii, et Spiritus Sancti. Amen.",
    "tl": "Sa ngalan ng Ama, at ng Anak, at ng Espiritu Santo. Amen.",
    "vi": "Nhân danh Cha và Con và Thánh Thần. Amen.",
    "ko": "성부와 성자와 성령의 이름으로. 아멘.",
    "zh": "因父、及子、及圣神之名。阿们。",
    "el": "Εις το όνομα του Πατρός και του Υιού και του Αγίου Πνεύματος. Αμήν.",
}

PRAYER_LINES = {
    "en": "Hail Mary, full of grace, the Lord is with thee. Lord, I am not worthy that you should enter under my roof.",
    "es": "Dios te salve, María, llena eres de gracia; el Señor es contigo.",
    "fr": "Je vous salue, Marie, pleine de grâce ; le Seigneur est avec vous.",
    "it": "Ave, o Maria, piena di grazia, il Signore è con te. I santi del cielo.",
    "de": "Gegrüßet seist du, Maria, voll der Gnade, der Herr ist mit dir.",
    "pt": "Ave Maria, cheia de graça, o Senhor é convosco.",
    "pl": "Zdrowaś Maryjo, łaski pełna, Pan z Tobą. I odpuść nam nasze winy, jako i my odpuszczamy naszym winowajcom.",
    "la": "Pater noster, qui es in caelis, sanctificetur nomen tuum. Fili mi, in vi tua, di immortales.",
    "tl": "Aba Ginoong Maria, napupuno ka ng grasya, ang Panginoong Diyos ay sumasaiyo.",
    "vi": "Kính mừng Maria đầy ơn phúc, Đức Chúa Trời ở cùng Bà.",
    "ko": "은총이 가득하신 마리아님, 기뻐하소서! 주님께서 함께 계시니 여인 중에 복되시며.",
    "zh": "万福玛利亚，你充满圣宠，主与你同在。",
    "el": "Πάτερ ημών ο εν τοις ουρανοίς, αγιασθήτω το όνομά σου· ελθέτω η βασιλεία σου.",
}


@pytest.mark.parametrize("lang", LANGS)
def test_sign_of_the_cross_untouched(lang):
    assert normalize_for_voice(SIGN_OF_THE_CROSS[lang], lang) == SIGN_OF_THE_CROSS[lang]


@pytest.mark.parametrize("lang", LANGS)
def test_prayer_line_untouched(lang):
    assert normalize_for_voice(PRAYER_LINES[lang], lang) == PRAYER_LINES[lang]


def test_english_pronoun_i_is_never_a_numeral():
    for text in ("Here I am, Lord.", "Jesus I trust in You.", "Lord I believe.", "Lord, I am not worthy."):
        assert normalize_for_voice(text, "en") == text


def test_lone_i_inside_a_sentence_is_left_alone():
    assert normalize_for_voice("Chwała Ojcu I Synowi", "pl") == "Chwała Ojcu I Synowi"
    assert normalize_for_voice("Signore I santi", "it") == "Signore I santi"


def test_latin_words_that_look_like_numerals():
    for text in ("Fili mi", "in vi tua", "di immortales", "DOMINE MI", "vide, vici"):
        assert normalize_for_voice(text, "la") == text


def test_whitespace_is_collapsed():
    assert normalize_for_voice("  Hail   Mary,\n full of grace \t", "en") == "Hail Mary, full of grace"
    assert normalize_for_voice("", "en") == ""


# --------------------------------------------------------------------------- agreement


@pytest.mark.parametrize(
    "lang,text,said",
    [
        ("es", "1 vez, 1 día, 21 días, 200 personas", "una vez, un día, veintiún días, doscientas personas"),
        ("es", "1 y 2", "uno y dos"),
        ("pt", "1 vez, 2 horas, 21 vezes, 1 dia", "uma vez, duas horas, vinte e uma vezes, um dia"),
        ("it", "1 volta, 1 giorno, 1 zio", "una volta, un giorno, uno zio"),
        ("de", "1 Stunde, 1 Tag, 1 und 2", "eine Stunde, ein Tag, eins und zwei"),
        ("el", "1 φορά, 1 Θεός, 3 φορές, 3 χρόνια", "μία φορά, ένας Θεός, τρεις φορές, τρία χρόνια"),
        ("ko", "10번, 3시, 3개월, 80세", "열 번, 세 시, 삼개월, 팔십세"),
        ("zh", "2次, 2个, 22个, 2点", "两次, 两个, 二十二个, 两点"),
    ],
)
def test_agreement(lang, text, said):
    assert normalize_for_voice(text, lang) == said


# --------------------------------------------------------------------------- separators, decimals, times


@pytest.mark.parametrize(
    "lang,text,said",
    [
        ("en", "1,000,000 and 3.5", "one million and three point five"),
        ("es", "1.000 y 1,5", "mil y uno coma cinco"),
        ("fr", "2 000 ans", "deux mille ans"),
        ("de", "1.000 und 3,5", "tausend und drei Komma fünf"),
        ("zh", "3.14", "三点一四"),
        ("en", "007", "zero zero seven"),
        ("en", "1234567890", "1234567890"),
    ],
)
def test_separators_and_decimals(lang, text, said):
    assert normalize_for_voice(text, lang) == said


@pytest.mark.parametrize(
    "lang,text,said",
    [
        ("en", "at 3:00 PM", "at three PM"),
        ("en", "at 3:00", "at three o'clock"),
        ("en", "John 3:16", "John three sixteen"),
        ("de", "um 15:30 Uhr", "um fünfzehn Uhr dreißig"),
        ("de", "Johannes 3:16", "Johannes drei:sechzehn"),
        ("fr", "à 15h30", "à quinze heures trente"),
        ("es", "a las 3:30", "a las tres treinta"),
        ("pl", "o 15:00", "o piętnastej"),
        ("vi", "lúc 9:30", "lúc chín giờ ba mươi"),
        ("ko", "오후 3:30", "오후 세 시 삼십 분"),
        ("zh", "下午3:05", "下午三点零五分"),
        ("el", "στις 3:00", "στις τρεις"),
        ("tl", "alas 3:00", "alas tres"),
    ],
)
def test_times(lang, text, said):
    assert normalize_for_voice(text, lang) == said


# --------------------------------------------------------------------------- symbols


@pytest.mark.parametrize(
    "lang,text,said",
    [
        ("en", "My soul proclaims the greatness of the Lord * my spirit rejoices", "My soul proclaims the greatness of the Lord, my spirit rejoices"),
        ("la", "Magnificat * anima mea Dominum.", "Magnificat, anima mea Dominum."),
        ("en", "Glory be, * to the Father", "Glory be, to the Father"),
        ("en", "[Amen] {Alleluia} <Lord> and/or A / B", "Amen Alleluia Lord and or A, B"),
        ("en", "+ In the name of the Father", "In the name of the Father"),
        ("en", "Jesus & Mary, 50%", "Jesus and Mary, fifty percent"),
        ("es", "Fernando & Isabel, 50%", "Fernando e Isabel, cincuenta por ciento"),
        ("ko", "예수 & 마리아, 주님 & 성모", "예수와 마리아, 주님과 성모"),
        ("zh", "耶稣&玛利亚, 50%", "耶稣和玛利亚, 百分之五十"),
        ("el", "50%", "πενήντα τοις εκατό"),
    ],
)
def test_symbols(lang, text, said):
    assert normalize_for_voice(text, lang) == said


# --------------------------------------------------------------------------- idempotence

MIXED = {
    "en": "In 1917, on the 13th, at 3:00 PM, Pius X & Vatican II * 50% [Amen]",
    "es": "En 1917, el 13º día, a las 3:00, Juan Pablo II & 21 días * 50%",
    "fr": "En 1917, le 13e jour, à 15h, Jean-Paul II & le XXe siècle * 50 %",
    "it": "Nel 1917, il 13º giorno, alle 15:00, Giovanni XXIII & 1 volta * 50%",
    "de": "Im Jahr 1917, am 13. Mai, um 15:00 Uhr, Johannes Paul II. & 1 Stunde * 50%",
    "pt": "Em 1917, no 13º dia, às 15:00, João Paulo II & 2 horas * 50%",
    "pl": "W 1917 roku, o 15:00, Jan Paweł II & 22000 * 50%",
    "la": "Anno 1917, Pius XII & Leo XIII * 50",
    "tl": "Noong 1917, ika-13, alas 3:00, Juan Pablo II & 2026 * 50%",
    "vi": "Năm 1917, thứ 4, lúc 15:00, Gioan Phaolô II & 2026 * 50%",
    "ko": "1917년, 오후 3:00, 요한 바오로 2세 & 10번 * 50%",
    "zh": "1917年, 下午3:00, 若望保禄2世 & 2次 * 50%",
    "el": "Το 1917, ο 13ος, στις 3:00, Ιωάννης Παύλος Β΄ & 3 φορές * 50%",
}


@pytest.mark.parametrize("lang", LANGS)
def test_idempotent(lang):
    once = normalize_for_voice(MIXED[lang], lang)
    assert not any(ch.isdigit() for ch in once), once
    assert normalize_for_voice(once, lang) == once


@pytest.mark.parametrize("lang", LANGS)
def test_every_language_spells_every_small_number(lang):
    limit = 3999 if lang == "la" else 10_000
    for n in range(0, limit + 1, 7):
        words = spell_number(n, lang)
        assert words and not any(ch.isdigit() for ch in words)
        assert normalize_for_voice(str(n), lang)
