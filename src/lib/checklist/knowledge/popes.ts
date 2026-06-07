import type { CuratedEntry } from "./index";

const VATICAN = "https://www.vatican.va/";
const NEWADVENT = "https://www.newadvent.org/cathen/";

function pope(
  slug: string,
  title: string,
  papacyStart: string,
  papacyEnd: string | undefined,
  birthName: string,
  background: string,
): CuratedEntry {
  const payload: Record<string, unknown> = {
    slug,
    title,
    papacyStart,
    birthName,
    background,
    summary: `${title}, who reigned as Roman Pontiff from ${papacyStart}${
      papacyEnd ? `–${papacyEnd}` : " to the present"
    }.`,
    citations: [VATICAN, NEWADVENT],
  };
  if (papacyEnd) payload.papacyEnd = papacyEnd;
  return {
    contentType: "POPE",
    slug,
    authorityLevel: "VATICAN",
    citations: [VATICAN, NEWADVENT],
    payload,
  };
}

/**
 * Well-documented Roman Pontiffs anchoring the chronological list of popes.
 * `papacyStart` is the chronological sort key; `papacyEnd` is omitted only for
 * the currently reigning pope. Dates follow the Annuario Pontificio and
 * standard Catholic reference sources — ground-truth content the worker can
 * publish without a live fetch. The full line of 266 popes is expanded by the
 * worker from approved sources.
 */
export const popeKnowledge: CuratedEntry[] = [
  pope(
    "pope-saint-peter",
    "Pope Saint Peter",
    "30",
    "64",
    "Simon bar Jonah",
    "Saint Peter, chief of the Apostles, was appointed by Christ as the rock on which the Church is built (Matthew 16:18) and the first Bishop of Rome. He led the apostolic community after Pentecost and was martyred in Rome under Nero around AD 64; his tomb lies beneath the high altar of St. Peter's Basilica.",
  ),
  pope(
    "pope-saint-linus",
    "Pope Saint Linus",
    "67",
    "76",
    "Linus",
    "Saint Linus succeeded Saint Peter as Bishop of Rome and is named in the Roman Canon of the Mass. Early tradition, recorded by Irenaeus, lists him as the second pope.",
  ),
  pope(
    "pope-saint-clement-i",
    "Pope Saint Clement I",
    "88",
    "99",
    "Clement",
    "Saint Clement I, fourth Bishop of Rome and an Apostolic Father, wrote the Letter to the Corinthians (c. 96), the earliest surviving exercise of Roman authority over another church. Tradition holds that he was martyred under Trajan.",
  ),
  pope(
    "pope-saint-sylvester-i",
    "Pope Saint Sylvester I",
    "314",
    "335",
    "Sylvester",
    "Saint Sylvester I was Bishop of Rome during the reign of Constantine, when the Church emerged from persecution. His pontificate saw the First Council of Nicaea (325) and the building of the first great Roman basilicas.",
  ),
  pope(
    "pope-saint-damasus-i",
    "Pope Saint Damasus I",
    "366",
    "384",
    "Damasus",
    "Saint Damasus I commissioned Saint Jerome to revise the Latin Scriptures (the Vulgate), promoted the cult of the Roman martyrs, and affirmed the primacy of the Roman See.",
  ),
  pope(
    "pope-saint-leo-the-great",
    "Pope Saint Leo the Great",
    "440",
    "461",
    "Leo",
    "Pope Saint Leo I, one of only two popes called 'the Great' and a Doctor of the Church, defended the orthodox doctrine of the Incarnation in his Tome, accepted at the Council of Chalcedon (451), and famously persuaded Attila the Hun to spare Rome in 452.",
  ),
  pope(
    "pope-saint-gregory-the-great",
    "Pope Saint Gregory the Great",
    "590",
    "604",
    "Gregory",
    "Pope Saint Gregory I, a Doctor of the Church, reformed the liturgy and Church administration, sent Augustine of Canterbury to evangelize England, cared for the poor of Rome, and wrote the Pastoral Rule. Gregorian chant bears his name.",
  ),
  pope(
    "pope-saint-gregory-vii",
    "Pope Saint Gregory VII",
    "1073",
    "1085",
    "Hildebrand of Sovana",
    "Pope Saint Gregory VII led the Gregorian Reform against simony and lay investiture, asserting the freedom of the Church from secular control in the famous conflict with Emperor Henry IV at Canossa.",
  ),
  pope(
    "pope-blessed-urban-ii",
    "Pope Blessed Urban II",
    "1088",
    "1099",
    "Odo of Châtillon",
    "Blessed Pope Urban II continued the Gregorian Reform and, at the Council of Clermont in 1095, preached the First Crusade to aid the Eastern Christians and recover the Holy Land.",
  ),
  pope(
    "pope-innocent-iii",
    "Pope Innocent III",
    "1198",
    "1216",
    "Lotario dei Conti di Segni",
    "Pope Innocent III brought the medieval papacy to the height of its influence, approved the new orders of Saint Francis and Saint Dominic, and convened the Fourth Lateran Council (1215), which defined transubstantiation and reformed Church discipline.",
  ),
  pope(
    "pope-boniface-viii",
    "Pope Boniface VIII",
    "1294",
    "1303",
    "Benedetto Caetani",
    "Pope Boniface VIII proclaimed the first Holy Year (Jubilee) in 1300 and asserted papal authority in the bull Unam Sanctam during his conflict with King Philip IV of France.",
  ),
  pope(
    "pope-saint-pius-v",
    "Pope Saint Pius V",
    "1566",
    "1572",
    "Antonio Ghislieri",
    "Pope Saint Pius V, a Dominican, implemented the reforms of the Council of Trent, promulgated the Roman Catechism, Breviary, and Missal (the Tridentine Mass), and organized the Holy League whose victory at Lepanto in 1571 he attributed to the Rosary.",
  ),
  pope(
    "pope-gregory-xiii",
    "Pope Gregory XIII",
    "1572",
    "1585",
    "Ugo Boncompagni",
    "Pope Gregory XIII reformed the calendar in 1582, producing the Gregorian calendar still in use today, and was a great patron of the Jesuit colleges and the Catholic Reformation.",
  ),
  pope(
    "pope-pius-ix",
    "Pope Blessed Pius IX",
    "1846",
    "1878",
    "Giovanni Maria Mastai-Ferretti",
    "Blessed Pope Pius IX had the longest verified pontificate in history. He defined the dogma of the Immaculate Conception (1854), convened the First Vatican Council (1869-70), which defined papal infallibility, and witnessed the loss of the Papal States.",
  ),
  pope(
    "pope-leo-xiii",
    "Pope Leo XIII",
    "1878",
    "1903",
    "Vincenzo Gioacchino Pecci",
    "Pope Leo XIII inaugurated modern Catholic social teaching with the encyclical Rerum Novarum (1891) on the rights of workers, promoted the revival of Thomistic philosophy (Aeterni Patris), and fostered devotion to the Rosary.",
  ),
  pope(
    "pope-saint-pius-x",
    "Pope Saint Pius X",
    "1903",
    "1914",
    "Giuseppe Melchiorre Sarto",
    "Pope Saint Pius X promoted frequent and early Holy Communion, reformed the liturgy and sacred music, initiated the codification of canon law, and firmly opposed the errors of Modernism.",
  ),
  pope(
    "pope-benedict-xv",
    "Pope Benedict XV",
    "1914",
    "1922",
    "Giacomo della Chiesa",
    "Pope Benedict XV guided the Church through the First World War, tirelessly pursuing peace and organizing humanitarian relief, and promulgated the first Code of Canon Law in 1917.",
  ),
  pope(
    "pope-pius-xi",
    "Pope Pius XI",
    "1922",
    "1939",
    "Achille Ratti",
    "Pope Pius XI signed the Lateran Treaty (1929) establishing Vatican City, instituted the feast of Christ the King, and issued landmark encyclicals on marriage, social order, and against the totalitarian ideologies of his day.",
  ),
  pope(
    "pope-venerable-pius-xii",
    "Pope Venerable Pius XII",
    "1939",
    "1958",
    "Eugenio Pacelli",
    "Pope Pius XII led the Church through the Second World War, defined the dogma of the Assumption of the Blessed Virgin Mary (1950), and issued influential encyclicals on Scripture (Divino Afflante Spiritu) and the liturgy (Mediator Dei).",
  ),
  pope(
    "pope-saint-john-xxiii",
    "Pope Saint John XXIII",
    "1958",
    "1963",
    "Angelo Giuseppe Roncalli",
    "Pope Saint John XXIII, called 'the Good Pope,' convened the Second Vatican Council (1962) and wrote the encyclicals Mater et Magistra and Pacem in Terris. Canonized in 2014.",
  ),
  pope(
    "pope-saint-paul-vi",
    "Pope Saint Paul VI",
    "1963",
    "1978",
    "Giovanni Battista Montini",
    "Pope Saint Paul VI brought the Second Vatican Council to completion and oversaw its implementation, promulgated the revised Roman Missal, and issued the encyclical Humanae Vitae (1968). Canonized in 2018.",
  ),
  pope(
    "pope-john-paul-i",
    "Pope John Paul I",
    "1978",
    "1978",
    "Albino Luciani",
    "Pope John Paul I, 'the Smiling Pope,' reigned only thirty-three days in 1978 before his sudden death. He was the first pope to take a double name. Beatified in 2022.",
  ),
  pope(
    "pope-saint-john-paul-ii",
    "Pope Saint John Paul II",
    "1978",
    "2005",
    "Karol Józef Wojtyła",
    "Pope Saint John Paul II, the first Polish pope and first non-Italian in 455 years, reigned for nearly twenty-seven years. He helped bring down communism in Eastern Europe, founded World Youth Day, promulgated the Catechism of the Catholic Church, and canonized more saints than any predecessor. Canonized in 2014.",
  ),
  pope(
    "pope-benedict-xvi",
    "Pope Benedict XVI",
    "2005",
    "2013",
    "Joseph Aloisius Ratzinger",
    "Pope Benedict XVI, a distinguished theologian, wrote the encyclicals Deus Caritas Est, Spe Salvi, and Caritas in Veritate and the Jesus of Nazareth trilogy. In 2013 he became the first pope in nearly six centuries to resign the papacy.",
  ),
  pope(
    "pope-francis",
    "Pope Francis",
    "2013",
    "2025",
    "Jorge Mario Bergoglio",
    "Pope Francis, the first pope from the Americas and the first Jesuit pope, emphasized mercy, care for the poor, and care for creation in the encyclicals Laudato Si' and Fratelli Tutti. He convened the Synod on Synodality and proclaimed the Jubilee of Mercy. His pontificate ended with his death in 2025.",
  ),
  pope(
    "pope-leo-xiv",
    "Pope Leo XIV",
    "2025",
    undefined,
    "Robert Francis Prevost",
    "Pope Leo XIV, born in Chicago, is the first pope from the United States. An Augustinian friar who served for years as a missionary and bishop in Peru and then as Prefect of the Dicastery for Bishops, he was elected in 2025. He took the name Leo in continuity with Leo XIII and the Church's social teaching.",
  ),
];
