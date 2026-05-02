export type ParishSeed = {
  slug: string;
  name: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  phone?: string;
  websiteUrl?: string;
  diocese?: string;
  latitude?: number;
  longitude?: number;
};

export const PARISHES: ParishSeed[] = [
  {
    slug: "st-patricks-cathedral-new-york",
    name: "Saint Patrick's Cathedral",
    address: "5 East 51st Street",
    city: "New York",
    region: "New York",
    country: "United States",
    phone: "+1 212-753-2261",
    websiteUrl: "https://saintpatrickscathedral.org",
    diocese: "Archdiocese of New York",
    latitude: 40.7584,
    longitude: -73.9762,
  },
  {
    slug: "basilica-national-shrine-washington",
    name: "Basilica of the National Shrine of the Immaculate Conception",
    address: "400 Michigan Ave NE",
    city: "Washington",
    region: "District of Columbia",
    country: "United States",
    phone: "+1 202-526-8300",
    websiteUrl: "https://www.nationalshrine.org",
    diocese: "Archdiocese of Washington",
    latitude: 38.9332,
    longitude: -77.0007,
  },
  {
    slug: "notre-dame-paris",
    name: "Cathédrale Notre-Dame de Paris",
    address: "6 Parvis Notre-Dame",
    city: "Paris",
    region: "Île-de-France",
    country: "France",
    websiteUrl: "https://www.notredamedeparis.fr",
    diocese: "Archdiocese of Paris",
    latitude: 48.853,
    longitude: 2.3499,
  },
  {
    slug: "westminster-cathedral-london",
    name: "Westminster Cathedral",
    address: "Victoria Street",
    city: "London",
    region: "England",
    country: "United Kingdom",
    phone: "+44 20 7798 9055",
    websiteUrl: "https://www.westminstercathedral.org.uk",
    diocese: "Diocese of Westminster",
    latitude: 51.4973,
    longitude: -0.1407,
  },
  {
    slug: "basilica-guadalupe-mexico",
    name: "Basílica de Nuestra Señora de Guadalupe",
    address: "Plaza de las Américas 1",
    city: "Mexico City",
    region: "Mexico City",
    country: "Mexico",
    websiteUrl: "https://virgendeguadalupe.org.mx",
    diocese: "Archdiocese of Mexico",
    latitude: 19.4847,
    longitude: -99.1174,
  },
  {
    slug: "st-peters-basilica-rome",
    name: "Saint Peter's Basilica",
    address: "Piazza San Pietro",
    city: "Vatican City",
    region: "Vatican",
    country: "Holy See",
    websiteUrl: "https://www.vatican.va",
    diocese: "Diocese of Rome",
    latitude: 41.9022,
    longitude: 12.4539,
  },
  {
    slug: "sagrada-familia-barcelona",
    name: "Basílica de la Sagrada Família",
    address: "Carrer de Mallorca 401",
    city: "Barcelona",
    region: "Catalonia",
    country: "Spain",
    websiteUrl: "https://sagradafamilia.org",
    diocese: "Archdiocese of Barcelona",
    latitude: 41.4036,
    longitude: 2.1744,
  },
  {
    slug: "santo-spirito-florence",
    name: "Basilica di Santo Spirito",
    address: "Piazza di Santo Spirito",
    city: "Florence",
    region: "Tuscany",
    country: "Italy",
    diocese: "Archdiocese of Florence",
    latitude: 43.7658,
    longitude: 11.2484,
  },
];
