"""
The bake-off's test set: the same prayers in every language, in the Church's standard
wording, exactly as the website hands them to the engine (Greek through the site's
own monotonic conversion), plus the short reference line each designed voice is made
and locked on (the Glory Be, which is not in the test set).

Test set: the Sign of the Cross (src/lib/pray-along/sign-of-the-cross.ts), the Our
Father and the Hail Mary; for Latin: Signum Crucis, Pater Noster, Ave Maria, Gloria
Patri (the site's own Latin records).
"""

from __future__ import annotations

import re
import unicodedata

MAX_CLIP_CHARS = 300  # src/lib/pray-along/speech-text.ts


def site_monotonic(text: str) -> str:
    """src/lib/pray-along/speech-text.ts toMonotonicGreek, as the site sends Greek."""
    t = unicodedata.normalize("NFD", text)
    t = re.sub("[̓̔̄̆ͅ]", "", t)
    t = re.sub("[̀͂]", "́", t)
    t = re.sub("́(?=́)", "", t)
    return unicodedata.normalize("NFC", t)


SIGN = {
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
    "el": site_monotonic("Εἰς τὸ ὄνομα τοῦ Πατρὸς καὶ τοῦ Υἱοῦ καὶ τοῦ Ἁγίου Πνεύματος. Ἀμήν."),
}

OUR_FATHER = {
    "en": "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread, and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.",
    "es": "Padre nuestro, que estás en el cielo, santificado sea tu Nombre; venga a nosotros tu reino; hágase tu voluntad en la tierra como en el cielo. Danos hoy nuestro pan de cada día; perdona nuestras ofensas, como también nosotros perdonamos a los que nos ofenden; no nos dejes caer en la tentación, y líbranos del mal. Amén.",
    "fr": "Notre Père, qui es aux cieux, que ton nom soit sanctifié, que ton règne vienne, que ta volonté soit faite sur la terre comme au ciel. Donne-nous aujourd'hui notre pain de ce jour. Pardonne-nous nos offenses, comme nous pardonnons aussi à ceux qui nous ont offensés. Et ne nous laisse pas entrer en tentation, mais délivre-nous du Mal. Amen.",
    "it": "Padre nostro, che sei nei cieli, sia santificato il tuo nome, venga il tuo regno, sia fatta la tua volontà, come in cielo così in terra. Dacci oggi il nostro pane quotidiano, e rimetti a noi i nostri debiti come anche noi li rimettiamo ai nostri debitori, e non abbandonarci alla tentazione, ma liberaci dal male. Amen.",
    "de": "Vater unser im Himmel, geheiligt werde dein Name. Dein Reich komme. Dein Wille geschehe, wie im Himmel, so auf der Erde. Unser tägliches Brot gib uns heute. Und vergib uns unsere Schuld, wie auch wir vergeben unsern Schuldigern. Und führe uns nicht in Versuchung, sondern erlöse uns von dem Bösen. Amen.",
    "pt": "Pai nosso que estais nos céus, santificado seja o vosso nome; venha a nós o vosso reino; seja feita a vossa vontade, assim na terra como no céu. O pão nosso de cada dia nos dai hoje; perdoai-nos as nossas ofensas, assim como nós perdoamos a quem nos tem ofendido; e não nos deixeis cair em tentação, mas livrai-nos do mal. Amém.",
    "pl": "Ojcze nasz, który jesteś w niebie, święć się imię Twoje; przyjdź królestwo Twoje; bądź wola Twoja jako w niebie, tak i na ziemi. Chleba naszego powszedniego daj nam dzisiaj; i odpuść nam nasze winy, jako i my odpuszczamy naszym winowajcom; i nie wódź nas na pokuszenie, ale nas zbaw ode złego. Amen.",
    "la": "Pater noster, qui es in caelis, sanctificetur nomen tuum; adveniat regnum tuum; fiat voluntas tua, sicut in caelo, et in terra. Panem nostrum quotidianum da nobis hodie; et dimitte nobis debita nostra, sicut et nos dimittimus debitoribus nostris; et ne nos inducas in tentationem; sed libera nos a malo. Amen.",
    "tl": "Ama namin, sumasalangit ka, sambahin ang ngalan mo. Mapasaamin ang kaharian mo. Sundin ang loob mo, dito sa lupa para nang sa langit. Bigyan mo kami ngayon ng aming kakanin sa araw-araw. At patawarin mo kami sa aming mga sala, para nang pagpapatawad namin sa nagkakasala sa amin. At huwag mo kaming ipahintulot sa tukso, at iadya mo kami sa lahat ng masama. Amen.",
    "vi": "Lạy Cha chúng con ở trên trời, chúng con nguyện danh Cha cả sáng, nước Cha trị đến, ý Cha thể hiện dưới đất cũng như trên trời. Xin Cha cho chúng con hôm nay lương thực hằng ngày, và tha nợ chúng con, như chúng con cũng tha kẻ có nợ chúng con. Xin chớ để chúng con sa chước cám dỗ, nhưng cứu chúng con cho khỏi sự dữ. Amen.",
    "ko": "하늘에 계신 우리 아버지, 아버지의 이름이 거룩히 빛나시며, 아버지의 나라가 오시며, 아버지의 뜻이 하늘에서와 같이 땅에서도 이루어지소서. 오늘 저희에게 일용할 양식을 주시고, 저희에게 잘못한 이를 저희가 용서하오니 저희 죄를 용서하시고, 저희를 유혹에 빠지지 않게 하시고, 악에서 구하소서. 아멘.",
    "zh": "我们的天父，愿你的名受显扬；愿你的国来临；愿你的旨意奉行在人间，如同在天上。求你今天赏给我们日用的食粮；求你宽恕我们的罪过，如同我们宽恕别人一样；不要让我们陷于诱惑；但救我们免于凶恶。阿们。",
    "el": site_monotonic(
        "Πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς· ἁγιασθήτω τὸ ὄνομά σου· ἐλθέτω ἡ βασιλεία σου· "
        "γενηθήτω τὸ θέλημά σου, ὡς ἐν οὐρανῷ καὶ ἐπὶ τῆς γῆς· τὸν ἄρτον ἡμῶν τὸν ἐπιούσιον "
        "δὸς ἡμῖν σήμερον· καὶ ἄφες ἡμῖν τὰ ὀφειλήματα ἡμῶν, ὡς καὶ ἡμεῖς ἀφίεμεν τοῖς "
        "ὀφειλέταις ἡμῶν· καὶ μὴ εἰσενέγκῃς ἡμᾶς εἰς πειρασμόν, ἀλλὰ ῥῦσαι ἡμᾶς ἀπὸ τοῦ "
        "πονηροῦ. Ἀμήν."
    ),
}

HAIL_MARY = {
    "en": "Hail Mary, full of grace, the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
    "es": "Dios te salve, María, llena eres de gracia, el Señor es contigo. Bendita tú eres entre todas las mujeres, y bendito es el fruto de tu vientre, Jesús. Santa María, Madre de Dios, ruega por nosotros, pecadores, ahora y en la hora de nuestra muerte. Amén.",
    "fr": "Je vous salue, Marie, pleine de grâce ; le Seigneur est avec vous. Vous êtes bénie entre toutes les femmes, et Jésus, le fruit de vos entrailles, est béni. Sainte Marie, Mère de Dieu, priez pour nous, pauvres pécheurs, maintenant et à l'heure de notre mort. Amen.",
    "it": "Ave, o Maria, piena di grazia, il Signore è con te. Tu sei benedetta fra le donne e benedetto è il frutto del tuo seno, Gesù. Santa Maria, Madre di Dio, prega per noi peccatori, adesso e nell'ora della nostra morte. Amen.",
    "de": "Gegrüßet seist du, Maria, voll der Gnade, der Herr ist mit dir. Du bist gebenedeit unter den Frauen, und gebenedeit ist die Frucht deines Leibes, Jesus. Heilige Maria, Mutter Gottes, bitte für uns Sünder jetzt und in der Stunde unseres Todes. Amen.",
    "pt": "Ave Maria, cheia de graça, o Senhor é convosco; bendita sois vós entre as mulheres, e bendito é o fruto do vosso ventre, Jesus. Santa Maria, Mãe de Deus, rogai por nós, pecadores, agora e na hora de nossa morte. Amém.",
    "pl": "Zdrowaś Maryjo, łaski pełna, Pan z Tobą, błogosławionaś Ty między niewiastami i błogosławiony owoc żywota Twojego, Jezus. Święta Maryjo, Matko Boża, módl się za nami grzesznymi teraz i w godzinę śmierci naszej. Amen.",
    "la": "Ave Maria, gratia plena, Dominus tecum. Benedicta tu in mulieribus, et benedictus fructus ventris tui, Iesus. Sancta Maria, Mater Dei, ora pro nobis peccatoribus, nunc et in hora mortis nostrae. Amen.",
    "tl": "Aba Ginoong Maria, napupuno ka ng grasya, ang Panginoong Diyos ay sumasaiyo. Bukod kang pinagpala sa babaeng lahat, at pinagpala naman ang iyong anak na si Hesus. Santa Maria, Ina ng Diyos, ipanalangin mo kaming makasalanan, ngayon at kung kami ay mamamatay. Amen.",
    "vi": "Kính mừng Maria đầy ơn phúc, Đức Chúa Trời ở cùng Bà, Bà có phúc lạ hơn mọi người nữ, và Giêsu con lòng Bà gồm phúc lạ. Thánh Maria Đức Mẹ Chúa Trời, cầu cho chúng con là kẻ có tội, khi nay và trong giờ lâm tử. Amen.",
    "ko": "은총이 가득하신 마리아님, 기뻐하소서! 주님께서 함께 계시니 여인 중에 복되시며 태중의 아들 예수님 또한 복되시나이다. 천주의 성모 마리아님, 이제와 저희 죽을 때에 저희 죄인을 위하여 빌어주소서. 아멘.",
    "zh": "万福玛利亚，你充满圣宠，主与你同在，你在妇女中受赞颂，你的亲子耶稣同受赞颂。天主圣母玛利亚，求你现在和我们临终时，为我们罪人祈求天主。阿们。",
    "el": site_monotonic(
        "Θεοτόκε Παρθένε, χαῖρε, κεχαριτωμένη Μαρία, ὁ Κύριος μετὰ σοῦ. εὐλογημένη σὺ ἐν "
        "γυναιξί, καὶ εὐλογημένος ὁ καρπὸς τῆς κοιλίας σου, ὅτι Σωτῆρα ἔτεκες τῶν ψυχῶν ἡμῶν."
    ),
}

GLORIA_PATRI_LA = "Gloria Patri, et Filio, et Spiritui Sancto. Sicut erat in principio, et nunc, et semper, et in saecula saeculorum. Amen."

# The line every designed voice is designed and locked on (the Glory Be; modern
# spelling for Greek, since it is only the voice's own reference).
REFERENCE = {
    "en": "Glory be to the Father, and to the Son, and to the Holy Spirit, as it was in the beginning, is now, and ever shall be, world without end. Amen.",
    "es": "Gloria al Padre, y al Hijo, y al Espíritu Santo. Como era en el principio, ahora y siempre, por los siglos de los siglos. Amén.",
    "fr": "Gloire au Père, et au Fils, et au Saint-Esprit, comme il était au commencement, maintenant et toujours, et pour les siècles des siècles. Amen.",
    "it": "Gloria al Padre e al Figlio e allo Spirito Santo. Come era nel principio, e ora e sempre, nei secoli dei secoli. Amen.",
    "de": "Ehre sei dem Vater und dem Sohn und dem Heiligen Geist, wie im Anfang, so auch jetzt und alle Zeit und in Ewigkeit. Amen.",
    "pt": "Glória ao Pai e ao Filho e ao Espírito Santo. Como era no princípio, agora e sempre. Amém.",
    "pl": "Chwała Ojcu i Synowi, i Duchowi Świętemu. Jak była na początku, teraz i zawsze, i na wieki wieków. Amen.",
    "tl": "Luwalhati sa Ama, at sa Anak, at sa Espiritu Santo. Kapara noong unang-una, ngayon at magpakailanman, at magpasawalang hanggan. Amen.",
    "vi": "Sáng danh Đức Chúa Cha, và Đức Chúa Con, và Đức Chúa Thánh Thần. Như đã có trước vô cùng, và bây giờ, và hằng có, và đời đời chẳng cùng. Amen.",
    "ko": "영광이 성부와 성자와 성령께, 처음과 같이 이제와 항상 영원히. 아멘.",
    "zh": "愿光荣归于父，及子，及圣神，起初如何，今日亦然，直到永远。阿们。",
    "el": "Δόξα Πατρί και Υιώ και Αγίω Πνεύματι, και νυν και αεί και εις τους αιώνας των αιώνων. Αμήν.",
}


def split_clips(text: str, limit: int = MAX_CLIP_CHARS) -> list[str]:
    """Cuts a prayer into clips of at most `limit` characters at sentence/clause ends."""
    if len(text) <= limit:
        return [text]
    parts = re.split(r"(?<=[.;·!?。；])\s*", text)
    out, cur = [], ""
    for p in parts:
        if not p:
            continue
        if cur and len(cur) + 1 + len(p) > limit:
            out.append(cur.strip())
            cur = p
        else:
            cur = f"{cur} {p}" if cur and not re.search(r"[　-鿿]$", cur) else cur + p
    if cur.strip():
        out.append(cur.strip())
    return out


def test_set(lang: str) -> list[tuple[str, str]]:
    """[(clip name, exact text)] for a language, prayers cut into clips as the site cuts them."""
    items = [("sign", SIGN[lang])]
    for name, src in (("our_father", OUR_FATHER), ("hail_mary", HAIL_MARY)):
        parts = split_clips(src[lang])
        for i, p in enumerate(parts):
            items.append((f"{name}{'_' + str(i + 1) if len(parts) > 1 else ''}", p))
    if lang == "la":
        items.append(("gloria_patri", GLORIA_PATRI_LA))
    return items
