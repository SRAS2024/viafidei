import type { LiturgyEntrySeed } from "./liturgyEntries";

/**
 * Seed entries for major papal encyclicals from Leo XIII through Francis.
 * Each entry is stored as a LiturgyEntry row with kind=GENERAL and
 * slug pattern `encyclical-<name>` so the public timeline can surface
 * them chronologically.
 *
 * Body text is a brief authoritative summary of the encyclical's purpose
 * and central teaching, drawn from the Holy See's own document
 * descriptions. Each row carries the issuing Pope's name in the body
 * for clear attribution.
 *
 * The ingestion pipeline appends additional encyclicals over time;
 * these seeds give the catalog its baseline content immediately.
 */
export const ENCYCLICAL_ENTRIES: LiturgyEntrySeed[] = [
  // ── Leo XIII (1878–1903) ──
  {
    slug: "encyclical-aeterni-patris",
    kind: "GENERAL",
    title: "Aeterni Patris (1879) — Pope Leo XIII",
    summary: "On the restoration of Christian philosophy.",
    body: "Issued by Pope Leo XIII on 4 August 1879, Aeterni Patris called for the renewal of Catholic philosophical study following the thought of St. Thomas Aquinas. It became the charter of the modern Thomistic revival in Catholic universities and seminaries.",
  },
  {
    slug: "encyclical-rerum-novarum",
    kind: "GENERAL",
    title: "Rerum Novarum (1891) — Pope Leo XIII",
    summary: "On capital and labor; foundation of modern Catholic social teaching.",
    body: "Promulgated by Pope Leo XIII on 15 May 1891, Rerum Novarum addressed the condition of the working classes, affirmed the right to private property and a just wage, defended the right of workers to form associations, and rejected both unrestrained capitalism and revolutionary socialism. It is the foundational document of modern Catholic social teaching.",
  },
  {
    slug: "encyclical-providentissimus-deus",
    kind: "GENERAL",
    title: "Providentissimus Deus (1893) — Pope Leo XIII",
    summary: "On the study of Holy Scripture.",
    body: "Pope Leo XIII's encyclical of 18 November 1893 established the modern Catholic approach to Scripture study, defending biblical inerrancy while welcoming responsible historical and linguistic scholarship.",
  },

  // ── Pius X (1903–1914) ──
  {
    slug: "encyclical-e-supremi",
    kind: "GENERAL",
    title: "E Supremi (1903) — Pope Pius X",
    summary: "To restore all things in Christ.",
    body: "Pope Pius X's inaugural encyclical of 4 October 1903 set the program 'Instaurare omnia in Christo' — to restore all things in Christ — as the keynote of his pontificate.",
  },
  {
    slug: "encyclical-pascendi-dominici-gregis",
    kind: "GENERAL",
    title: "Pascendi Dominici Gregis (1907) — Pope Pius X",
    summary: "On the doctrines of the Modernists.",
    body: "Issued 8 September 1907, Pascendi systematically catalogued and condemned Modernist errors in Catholic theology, calling for stricter doctrinal oversight in seminaries and Catholic publications.",
  },

  // ── Benedict XV (1914–1922) ──
  {
    slug: "encyclical-ad-beatissimi-apostolorum",
    kind: "GENERAL",
    title: "Ad Beatissimi Apostolorum (1914) — Pope Benedict XV",
    summary: "Appeal for peace amid the Great War.",
    body: "Pope Benedict XV's first encyclical, 1 November 1914, condemned the catastrophe of the First World War and pleaded for a just peace among the Christian nations of Europe.",
  },

  // ── Pius XI (1922–1939) ──
  {
    slug: "encyclical-ubi-arcano-dei-consilio",
    kind: "GENERAL",
    title: "Ubi Arcano Dei Consilio (1922) — Pope Pius XI",
    summary: "On the peace of Christ in the kingdom of Christ.",
    body: "Pius XI's programmatic first encyclical of 23 December 1922 framed his pontificate around Christ's peace and kingship, leading later to the institution of the Solemnity of Christ the King.",
  },
  {
    slug: "encyclical-quas-primas",
    kind: "GENERAL",
    title: "Quas Primas (1925) — Pope Pius XI",
    summary: "On the institution of the Feast of Christ the King.",
    body: "Issued 11 December 1925, Quas Primas established the universal liturgical feast of the Kingship of Our Lord Jesus Christ, affirming Christ's authority over individuals, families, and nations.",
  },
  {
    slug: "encyclical-casti-connubii",
    kind: "GENERAL",
    title: "Casti Connubii (1930) — Pope Pius XI",
    summary: "On Christian marriage.",
    body: "Pius XI's encyclical of 31 December 1930 affirmed the sacramentality, indissolubility, and openness to life of Christian marriage, and condemned contraception, eugenics, and abortion.",
  },
  {
    slug: "encyclical-quadragesimo-anno",
    kind: "GENERAL",
    title: "Quadragesimo Anno (1931) — Pope Pius XI",
    summary: "Forty years after Rerum Novarum — reconstruction of the social order.",
    body: "Released 15 May 1931 on the fortieth anniversary of Rerum Novarum, Quadragesimo Anno developed Catholic social teaching with the principle of subsidiarity and proposed a corporatist alternative to both liberalism and socialism.",
  },
  {
    slug: "encyclical-mit-brennender-sorge",
    kind: "GENERAL",
    title: "Mit Brennender Sorge (1937) — Pope Pius XI",
    summary: "On the Church and the German Reich.",
    body: "Pius XI's encyclical of 14 March 1937 — drafted in German for immediate impact — condemned Nazi racial ideology, the deification of the state, and the persecution of Catholics in Nazi Germany.",
  },
  {
    slug: "encyclical-divini-redemptoris",
    kind: "GENERAL",
    title: "Divini Redemptoris (1937) — Pope Pius XI",
    summary: "On atheistic communism.",
    body: "Five days after Mit Brennender Sorge, on 19 March 1937, Pius XI issued Divini Redemptoris condemning atheistic communism as 'intrinsically wrong' and setting out a positive program of Christian social reform.",
  },

  // ── Pius XII (1939–1958) ──
  {
    slug: "encyclical-summi-pontificatus",
    kind: "GENERAL",
    title: "Summi Pontificatus (1939) — Pope Pius XII",
    summary: "On the unity of human society at the outbreak of war.",
    body: "Issued 20 October 1939, just weeks after the outbreak of the Second World War, Pius XII's first encyclical condemned racism, totalitarianism, and the violation of treaties and pleaded for the unity of the human family under Christ.",
  },
  {
    slug: "encyclical-mystici-corporis-christi",
    kind: "GENERAL",
    title: "Mystici Corporis Christi (1943) — Pope Pius XII",
    summary: "On the Mystical Body of Christ.",
    body: "Pius XII's encyclical of 29 June 1943 developed a comprehensive theology of the Church as the Mystical Body of Christ, a teaching later integrated by the Second Vatican Council into Lumen Gentium.",
  },
  {
    slug: "encyclical-divino-afflante-spiritu",
    kind: "GENERAL",
    title: "Divino Afflante Spiritu (1943) — Pope Pius XII",
    summary: "On promoting biblical studies.",
    body: "Released 30 September 1943, Divino Afflante Spiritu opened the way for modern Catholic biblical scholarship by encouraging the use of original languages and historical criticism in interpreting Sacred Scripture.",
  },
  {
    slug: "encyclical-mediator-dei",
    kind: "GENERAL",
    title: "Mediator Dei (1947) — Pope Pius XII",
    summary: "On the sacred liturgy.",
    body: "Pius XII's encyclical of 20 November 1947 provided the first comprehensive papal teaching on the liturgy in modern times and prepared the way for the conciliar liturgical reform.",
  },
  {
    slug: "encyclical-humani-generis",
    kind: "GENERAL",
    title: "Humani Generis (1950) — Pope Pius XII",
    summary: "Concerning some false opinions threatening Catholic doctrine.",
    body: "Issued 12 August 1950, Humani Generis cautioned against errors in contemporary Catholic theology, including imprudent applications of evolutionary theory to questions of the human soul.",
  },

  // ── John XXIII (1958–1963) ──
  {
    slug: "encyclical-mater-et-magistra",
    kind: "GENERAL",
    title: "Mater et Magistra (1961) — Pope John XXIII",
    summary: "On Christianity and social progress.",
    body: "John XXIII's encyclical of 15 May 1961 updated Catholic social teaching for the post-war world, addressing economic development, the dignity of farm labor, international aid, and the universal destination of goods.",
  },
  {
    slug: "encyclical-pacem-in-terris",
    kind: "GENERAL",
    title: "Pacem in Terris (1963) — Pope John XXIII",
    summary: "On peace among all peoples in truth, justice, charity, and liberty.",
    body: "Issued 11 April 1963 — Holy Thursday, six weeks before the Pope's death — Pacem in Terris was the first encyclical addressed to 'all people of good will' and laid out a charter of human rights grounded in the natural law.",
  },

  // ── Paul VI (1963–1978) ──
  {
    slug: "encyclical-ecclesiam-suam",
    kind: "GENERAL",
    title: "Ecclesiam Suam (1964) — Pope Paul VI",
    summary: "On the Church.",
    body: "Paul VI's inaugural encyclical of 6 August 1964 reflected on the Church's awareness of herself, her renewal, and her dialogue with the modern world.",
  },
  {
    slug: "encyclical-mysterium-fidei",
    kind: "GENERAL",
    title: "Mysterium Fidei (1965) — Pope Paul VI",
    summary: "On the doctrine and worship of the Holy Eucharist.",
    body: "Released 3 September 1965, Mysterium Fidei reaffirmed the Real Presence and the doctrine of transubstantiation against contemporary attempts to reduce the Eucharist to mere symbolism.",
  },
  {
    slug: "encyclical-populorum-progressio",
    kind: "GENERAL",
    title: "Populorum Progressio (1967) — Pope Paul VI",
    summary: "On the development of peoples.",
    body: "Paul VI's encyclical of 26 March 1967 declared that 'development is the new name for peace' and called on developed nations to assist the integral development of the world's poor.",
  },
  {
    slug: "encyclical-sacerdotalis-caelibatus",
    kind: "GENERAL",
    title: "Sacerdotalis Caelibatus (1967) — Pope Paul VI",
    summary: "On the celibacy of the priest.",
    body: "Issued 24 June 1967, Sacerdotalis Caelibatus reaffirmed the discipline of priestly celibacy in the Latin Church.",
  },
  {
    slug: "encyclical-humanae-vitae",
    kind: "GENERAL",
    title: "Humanae Vitae (1968) — Pope Paul VI",
    summary: "On the regulation of birth.",
    body: "Paul VI's encyclical of 25 July 1968 reaffirmed the Church's constant teaching against artificial contraception and articulated a positive vision of conjugal love as unitive and procreative.",
  },

  // ── John Paul II (1978–2005) ──
  {
    slug: "encyclical-redemptor-hominis",
    kind: "GENERAL",
    title: "Redemptor Hominis (1979) — Pope John Paul II",
    summary: "The Redeemer of Man.",
    body: "John Paul II's inaugural encyclical of 4 March 1979 set out the Christocentric vision of his pontificate: the human person finds his identity and dignity in Christ the Redeemer.",
  },
  {
    slug: "encyclical-dives-in-misericordia",
    kind: "GENERAL",
    title: "Dives in Misericordia (1980) — Pope John Paul II",
    summary: "Rich in Mercy.",
    body: "Released 30 November 1980, Dives in Misericordia developed the theology of God the Father's mercy, especially as revealed in the parable of the Prodigal Son and at the Cross.",
  },
  {
    slug: "encyclical-laborem-exercens",
    kind: "GENERAL",
    title: "Laborem Exercens (1981) — Pope John Paul II",
    summary: "On human work.",
    body: "John Paul II's encyclical of 14 September 1981 — the ninetieth anniversary of Rerum Novarum — articulated a Christian theology of work centered on the dignity of the human worker over the priority of capital.",
  },
  {
    slug: "encyclical-slavorum-apostoli",
    kind: "GENERAL",
    title: "Slavorum Apostoli (1985) — Pope John Paul II",
    summary: "Commemorating Saints Cyril and Methodius.",
    body: "Issued 2 June 1985, Slavorum Apostoli marked the eleventh centenary of the evangelizing work of Saints Cyril and Methodius among the Slavic peoples.",
  },
  {
    slug: "encyclical-dominum-et-vivificantem",
    kind: "GENERAL",
    title: "Dominum et Vivificantem (1986) — Pope John Paul II",
    summary: "On the Holy Spirit in the life of the Church and the world.",
    body: "John Paul II's encyclical of 18 May 1986 — the third panel of his trinitarian triptych — developed the theology of the Holy Spirit as Lord and Giver of Life.",
  },
  {
    slug: "encyclical-redemptoris-mater",
    kind: "GENERAL",
    title: "Redemptoris Mater (1987) — Pope John Paul II",
    summary: "On the Blessed Virgin Mary in the life of the pilgrim Church.",
    body: "Issued 25 March 1987 in preparation for the Marian Year, Redemptoris Mater presented Our Lady as the type and exemplar of pilgrim faith.",
  },
  {
    slug: "encyclical-sollicitudo-rei-socialis",
    kind: "GENERAL",
    title: "Sollicitudo Rei Socialis (1987) — Pope John Paul II",
    summary: "On the social concern of the Church.",
    body: "Released 30 December 1987, Sollicitudo Rei Socialis took up Populorum Progressio twenty years on and named 'structures of sin' that block authentic development.",
  },
  {
    slug: "encyclical-redemptoris-missio",
    kind: "GENERAL",
    title: "Redemptoris Missio (1990) — Pope John Paul II",
    summary: "On the permanent validity of the Church's missionary mandate.",
    body: "John Paul II's encyclical of 7 December 1990 reaffirmed the obligation of mission ad gentes against tendencies to reduce evangelization to dialogue.",
  },
  {
    slug: "encyclical-centesimus-annus",
    kind: "GENERAL",
    title: "Centesimus Annus (1991) — Pope John Paul II",
    summary: "On the hundredth anniversary of Rerum Novarum.",
    body: "Issued 1 May 1991, Centesimus Annus appraised the collapse of communism and outlined a Christian vision of authentic freedom rooted in truth.",
  },
  {
    slug: "encyclical-veritatis-splendor",
    kind: "GENERAL",
    title: "Veritatis Splendor (1993) — Pope John Paul II",
    summary: "On fundamental questions of the Church's moral teaching.",
    body: "Released 6 August 1993, Veritatis Splendor reaffirmed the existence of intrinsically evil acts and rejected proportionalism and consequentialism in moral theology.",
  },
  {
    slug: "encyclical-evangelium-vitae",
    kind: "GENERAL",
    title: "Evangelium Vitae (1995) — Pope John Paul II",
    summary: "On the value and inviolability of human life.",
    body: "John Paul II's encyclical of 25 March 1995 defended human life from conception to natural death and condemned abortion, euthanasia, and the death penalty in most circumstances.",
  },
  {
    slug: "encyclical-ut-unum-sint",
    kind: "GENERAL",
    title: "Ut Unum Sint (1995) — Pope John Paul II",
    summary: "On commitment to ecumenism.",
    body: "Released 25 May 1995, Ut Unum Sint reaffirmed the Catholic commitment to Christian unity and opened the door for dialogue on the exercise of the papal ministry.",
  },
  {
    slug: "encyclical-fides-et-ratio",
    kind: "GENERAL",
    title: "Fides et Ratio (1998) — Pope John Paul II",
    summary: "On the relationship between faith and reason.",
    body: "Issued 14 September 1998, Fides et Ratio defended philosophy's role in the search for ultimate truth and condemned both fideism and rationalism.",
  },
  {
    slug: "encyclical-ecclesia-de-eucharistia",
    kind: "GENERAL",
    title: "Ecclesia de Eucharistia (2003) — Pope John Paul II",
    summary: "On the Eucharist in its relationship to the Church.",
    body: "John Paul II's encyclical of 17 April 2003 — Holy Thursday of the Year of the Rosary — reflected on the Eucharist as the source and summit of the Church's life.",
  },

  // ── Benedict XVI (2005–2013) ──
  {
    slug: "encyclical-deus-caritas-est",
    kind: "GENERAL",
    title: "Deus Caritas Est (2005) — Pope Benedict XVI",
    summary: "God is love.",
    body: "Benedict XVI's inaugural encyclical of 25 December 2005 treated the inseparable unity of eros and agape, divine and human love, and the Church's diakonia of charity.",
  },
  {
    slug: "encyclical-spe-salvi",
    kind: "GENERAL",
    title: "Spe Salvi (2007) — Pope Benedict XVI",
    summary: "On Christian hope.",
    body: "Released 30 November 2007, Spe Salvi reflected on the nature of Christian hope as informed by the encounter with Jesus Christ.",
  },
  {
    slug: "encyclical-caritas-in-veritate",
    kind: "GENERAL",
    title: "Caritas in Veritate (2009) — Pope Benedict XVI",
    summary: "On integral human development in charity and truth.",
    body: "Benedict XVI's social encyclical of 29 June 2009 reframed economic development around the requirements of truth and charity, addressing globalization, finance, and ecology.",
  },
  {
    slug: "encyclical-lumen-fidei",
    kind: "GENERAL",
    title: "Lumen Fidei (2013) — Pope Francis (with Pope Benedict XVI)",
    summary: "The light of faith.",
    body: "Begun by Pope Benedict XVI and completed by Pope Francis after Benedict's resignation, Lumen Fidei was released 29 June 2013 as the trinitarian completion of Benedict's encyclicals on charity and hope.",
  },

  // ── Francis (2013–) ──
  {
    slug: "encyclical-laudato-si",
    kind: "GENERAL",
    title: "Laudato Si' (2015) — Pope Francis",
    summary: "On care for our common home.",
    body: "Francis's encyclical of 24 May 2015 set out an integral ecology that links environmental degradation, the cry of the poor, and the throwaway culture, and called for global ecological conversion.",
  },
  {
    slug: "encyclical-fratelli-tutti",
    kind: "GENERAL",
    title: "Fratelli Tutti (2020) — Pope Francis",
    summary: "On fraternity and social friendship.",
    body: "Released 3 October 2020 at Assisi, Fratelli Tutti developed a vision of universal fraternity grounded in the Good Samaritan and addressed populism, migration, and the rejection of war.",
  },
  {
    slug: "encyclical-dilexit-nos",
    kind: "GENERAL",
    title: "Dilexit Nos (2024) — Pope Francis",
    summary: "On the human and divine love of the Heart of Jesus Christ.",
    body: "Francis's encyclical of 24 October 2024 reflected on devotion to the Sacred Heart of Jesus, drawing on the long Catholic tradition from John Eudes and Margaret Mary Alacoque to Benedict XVI.",
  },

  // ── Earlier landmark encyclicals ──
  {
    slug: "encyclical-mirari-vos",
    kind: "GENERAL",
    title: "Mirari Vos (1832) — Pope Gregory XVI",
    summary: "On liberalism and religious indifferentism.",
    body: "Pope Gregory XVI's encyclical of 15 August 1832 condemned the errors of religious indifferentism, unrestrained freedom of conscience, and the separation of Church and state as understood in early liberal philosophy.",
  },
  {
    slug: "encyclical-quanta-cura",
    kind: "GENERAL",
    title: "Quanta Cura (1864) — Blessed Pope Pius IX",
    summary: "Condemning prevalent errors of the day; issued with the Syllabus.",
    body: "Pius IX's encyclical of 8 December 1864 condemned a series of errors related to naturalism, the autonomy of the state from any moral authority, and the rejection of revealed religion. Promulgated together with the Syllabus Errorum.",
  },
  {
    slug: "encyclical-mysterium-fidei-paul-vi",
    kind: "GENERAL",
    title: "Indulgentiarum Doctrina (1967) — Pope Paul VI",
    summary: "On the doctrine of indulgences.",
    body: "Paul VI's apostolic constitution of 1 January 1967 (functionally encyclical in weight) revised the discipline of indulgences in light of contemporary theology while reaffirming the Catholic doctrine of the communion of saints and the treasury of merits.",
  },
  {
    slug: "encyclical-veritatis-gaudium",
    kind: "GENERAL",
    title: "Veritatis Gaudium (2017) — Pope Francis",
    summary: "On ecclesiastical universities and faculties.",
    body: "Francis's apostolic constitution of 8 December 2017 reformed the canonical norms governing ecclesiastical universities and faculties, calling for a renewed theological formation oriented toward the mission of the Church in the contemporary world.",
  },
  {
    slug: "encyclical-quanta-est-cura-pius-xi",
    kind: "GENERAL",
    title: "Ad Caeli Reginam (1954) — Pope Pius XII",
    summary: "On the queenship of Mary; instituted the feast.",
    body: "Pope Pius XII's encyclical of 11 October 1954 — the closing of the Marian Year — established the universal feast of the Queenship of the Blessed Virgin Mary and articulated the dogmatic basis for the queenship as a participation in Christ's kingship.",
  },
];
