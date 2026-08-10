// Seed data for the shared venue database — Melbourne and regional Victoria.
//
// NOTE: every venue, contact and email address below is fictional and uses the reserved
// example.com domain. In production this table is replaced by an import of the real
// 222-venue GigFinder spreadsheet (Admin → Import spreadsheet).

const GENRE_SETS = [
  ['Indie', 'Rock', 'Alt'],
  ['Punk', 'Garage', 'Post-punk'],
  ['Folk', 'Alt-country', 'Americana'],
  ['Jazz', 'Soul', 'Funk'],
  ['Electronic', 'Indie'],
  ['Hip-hop', 'R&B', 'Soul'],
  ['Blues', 'Roots'],
  ['Metal', 'Hardcore'],
  ['Singer-songwriter', 'Folk'],
  ['Experimental', 'Post-rock'],
];

const CONTACTS = [
  'Sarah Liu', 'Tom Briggs', 'Jess Park', 'Maria Conti', 'Dave Chen',
  'Amy Wu', 'Leon Rowe', 'Pia Nowak', 'Marcus Hale', 'Nina Okafor',
  'Ruby Fenton', 'Sam Delaney', 'Hana Ito', 'Joel Mataki', 'Bec Turner',
];

const NOTES = [
  'Books 6-8 weeks out. Email only, no phone calls.',
  'Wants a local draw of 40+. Include recent door numbers.',
  'Weeknight supports open most months; Fridays book far ahead.',
  'One streaming link, not a full album. Short pitches get read first.',
  'Listening-room policy — seated, quiet sets.',
  'Local support is booked by the venue, not the touring act.',
  'Backline provided. Load-in off the laneway.',
  'Sunday arvo residencies available for local acts.',
];

const PAY = ['Door split 70/30', 'Guarantee + door', 'Door split 80/20', 'Flat fee', 'Revenue share'];
const METHODS = ['Email', 'Email', 'Email', 'Booking form'];

const ROWS = [
  // name, suburb, lat, lng, capacity, type
  ['The Rusted Anchor', 'Fitzroy', -37.7986, 144.9784, 220, 'Band Room'],
  ['Bandit Bar', 'Fitzroy', -37.7960, 144.9800, 120, 'Bar'],
  ['The Tin Pony', 'Collingwood', -37.8020, 144.9840, 300, 'Band Room'],
  ['Smith Street Social', 'Collingwood', -37.8005, 144.9845, 180, 'Bar'],
  ['Hotel Vulture', 'Abbotsford', -37.8030, 144.9970, 260, 'Pub'],
  ['The Paper Crane', 'Abbotsford', -37.8045, 144.9950, 90, 'Listening Room'],
  ['Cremorne Electric', 'Cremorne', -37.8280, 144.9930, 420, 'Warehouse'],
  ['The Swallow', 'Richmond', -37.8183, 144.9985, 150, 'Pub'],
  ['Burnley Bandroom', 'Richmond', -37.8250, 145.0050, 340, 'Band Room'],
  ['The Gasworks Room', 'South Melbourne', -37.8330, 144.9600, 280, 'Theatre'],
  ['Emerald Hall', 'Albert Park', -37.8420, 144.9530, 500, 'Theatre'],
  ['Pier & Anchor', 'Port Melbourne', -37.8390, 144.9440, 200, 'Pub'],
  ['The Salt Room', 'St Kilda', -37.8680, 144.9810, 380, 'Band Room'],
  ['Acland Underground', 'St Kilda', -37.8690, 144.9790, 240, 'Club'],
  ['The Blue Wren', 'Elwood', -37.8810, 144.9820, 110, 'Listening Room'],
  ['Balaclava Social Club', 'Balaclava', -37.8690, 144.9930, 160, 'Bar'],
  ['Chapel & Vine', 'Prahran', -37.8510, 144.9930, 320, 'Club'],
  ['The Windsor Arms', 'Windsor', -37.8560, 144.9920, 190, 'Pub'],
  ['South Yarra Sound', 'South Yarra', -37.8380, 144.9930, 260, 'Bar'],
  ['The Copper Kettle', 'Armadale', -37.8560, 145.0180, 130, 'Listening Room'],
  ['Malvern Town Room', 'Malvern', -37.8590, 145.0280, 450, 'Theatre'],
  ['The Sparrow & Gun', 'Brunswick', -37.7670, 144.9600, 240, 'Pub'],
  ['Sydney Road Social', 'Brunswick', -37.7700, 144.9605, 300, 'Band Room'],
  ['Lygon Warehouse', 'Brunswick East', -37.7680, 144.9760, 400, 'Warehouse'],
  ['The Bottlebrush', 'Northcote', -37.7700, 145.0000, 280, 'Band Room'],
  ['High Street Hotel', 'Northcote', -37.7720, 145.0010, 350, 'Pub'],
  ['Thornbury Tin Shed', 'Thornbury', -37.7570, 145.0000, 200, 'Warehouse'],
  ['The Preston Standard', 'Preston', -37.7410, 145.0000, 260, 'Pub'],
  ['Coburg Bowls Club', 'Coburg', -37.7440, 144.9640, 180, 'Club'],
  ['Carlton Cellar', 'Carlton', -37.8000, 144.9670, 140, 'Bar'],
  ['The Rathdowne', 'Carlton North', -37.7860, 144.9720, 170, 'Pub'],
  ['Fairfield Amphitheatre', 'Fairfield', -37.7770, 145.0180, 700, 'Theatre'],
  ['Alphington Boathouse', 'Alphington', -37.7790, 145.0300, 220, 'Bar'],
  ['The Ivanhoe Standard', 'Ivanhoe', -37.7690, 145.0430, 190, 'Pub'],
  ['Footscray Foundry', 'Footscray', -37.8000, 144.9000, 480, 'Warehouse'],
  ['The Barkly', 'Footscray', -37.8010, 144.9010, 260, 'Pub'],
  ['Yarraville Picture Room', 'Yarraville', -37.8160, 144.8900, 320, 'Theatre'],
  ['Seddon Social', 'Seddon', -37.8060, 144.8930, 120, 'Bar'],
  ['Williamstown Pier Hall', 'Williamstown', -37.8600, 144.8990, 300, 'Band Room'],
  ['Sunshine Workers Club', 'Sunshine', -37.7880, 144.8330, 240, 'Club'],
  ['The Kensington Rail', 'Kensington', -37.7940, 144.9280, 160, 'Pub'],
  ['North Melbourne Meatworks', 'North Melbourne', -37.8000, 144.9430, 520, 'Warehouse'],
  ['Docklands Shed', 'Docklands', -37.8150, 144.9460, 800, 'Warehouse'],
  ['Southbank Bandroom', 'Southbank', -37.8230, 144.9640, 600, 'Band Room'],
  ['The Flinders Cellar', 'Melbourne CBD', -37.8170, 144.9670, 200, 'Bar'],
  ['Lonsdale Loft', 'Melbourne CBD', -37.8110, 144.9620, 260, 'Club'],
  ['The Little Lane', 'Melbourne CBD', -37.8140, 144.9660, 90, 'Listening Room'],
  ['Swanston Grand', 'Melbourne CBD', -37.8100, 144.9640, 1200, 'Theatre'],
  ['The Hawthorn Standard', 'Hawthorn', -37.8220, 145.0350, 230, 'Pub'],
  ['Kew Court Room', 'Kew', -37.8060, 145.0300, 180, 'Listening Room'],
  ['Camberwell Cellars', 'Camberwell', -37.8260, 145.0680, 210, 'Bar'],
  ['The Caulfield Arms', 'Caulfield', -37.8770, 145.0240, 250, 'Pub'],
  ['Elsternwick Empire', 'Elsternwick', -37.8850, 145.0000, 400, 'Theatre'],
  ['Bentleigh RSL Stage', 'Bentleigh', -37.9180, 145.0360, 300, 'Club'],
  ['Cheltenham Bowls', 'Cheltenham', -37.9640, 145.0560, 170, 'Club'],
  ['Mordialloc Pier Bar', 'Mordialloc', -38.0050, 145.0870, 140, 'Bar'],
  ['Chelsea Beach Hotel', 'Chelsea', -38.0520, 145.1170, 220, 'Pub'],
  ['Frankston Foundry', 'Frankston', -38.1440, 145.1230, 380, 'Band Room'],
  ['Mornington Boathouse', 'Mornington', -38.2180, 145.0380, 260, 'Bar'],
  ['Dandenong Drill Hall', 'Dandenong', -37.9870, 145.2150, 340, 'Warehouse'],
  ['Springvale Social', 'Springvale', -37.9490, 145.1520, 190, 'Club'],
  ['Ringwood Rail Room', 'Ringwood', -37.8140, 145.2290, 250, 'Band Room'],
  ['Box Hill Town Stage', 'Box Hill', -37.8190, 145.1220, 420, 'Theatre'],
  ['Eltham Barn', 'Eltham', -37.7130, 145.1470, 200, 'Brewery'],
  ['Belgrave Hillside', 'Belgrave', -37.9110, 145.3550, 180, 'Listening Room'],
  ['Healesville Winery Stage', 'Healesville', -37.6540, 145.5170, 350, 'Brewery'],
  ['Werribee Riverside', 'Werribee', -37.9000, 144.6600, 240, 'Pub'],
  ['Melton Mechanics', 'Melton', -37.6830, 144.5810, 210, 'Club'],
  ['Geelong Wharf Shed', 'Geelong', -38.1480, 144.3610, 550, 'Warehouse'],
  ['The Torquay Surf Club', 'Torquay', -38.3320, 144.3160, 300, 'Club'],
  ['Lorne Pier Room', 'Lorne', -38.5400, 143.9750, 220, 'Bar'],
  ['Ballarat Trades Hall', 'Ballarat', -37.5620, 143.8500, 400, 'Theatre'],
  ['Bendigo Tin Mine', 'Bendigo', -36.7570, 144.2790, 320, 'Band Room'],
  ['Castlemaine Goods Shed', 'Castlemaine', -37.0630, 144.2170, 280, 'Warehouse'],
  ['Daylesford Spa Hall', 'Daylesford', -37.3430, 144.1450, 190, 'Listening Room'],
  ['Warrnambool Breakwater', 'Warrnambool', -38.3830, 142.4870, 260, 'Pub'],
  ['Shepparton Riverside', 'Shepparton', -36.3800, 145.4000, 230, 'Club'],
  ['Wangaratta Jazz Room', 'Wangaratta', -36.3560, 146.3120, 300, 'Listening Room'],
  ['Bright Alpine Brewery', 'Bright', -36.7300, 146.9600, 250, 'Brewery'],
];

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function seedVenues() {
  return ROWS.map((row, i) => {
    const [name, suburb, lat, lng, capacity, type] = row;
    const slug = slugify(name);
    return {
      id: `ven_${slug}`,
      name,
      city: suburb,
      state: 'VIC',
      country: 'Australia',
      lat,
      lng,
      capacity,
      type,
      genres: GENRE_SETS[i % GENRE_SETS.length],
      contactName: CONTACTS[i % CONTACTS.length],
      contactEmail: `bookings@${slug}.example.com`,
      phone: '',
      website: `https://${slug}.example.com`,
      submissionMethod: METHODS[i % METHODS.length],
      payType: PAY[i % PAY.length],
      notes: NOTES[i % NOTES.length],
      status: 'active',
      visibility: 'shared',
      ownerId: null,
      source: 'seed',
      addedAt: new Date(Date.now() - (i + 3) * 86400000).toISOString(),
    };
  });
}

export const VENUE_TYPES = ['Pub', 'Band Room', 'Bar', 'Club', 'Listening Room', 'Warehouse', 'Brewery', 'Theatre'];
export const ALL_GENRES = [...new Set(GENRE_SETS.flat())].sort();
