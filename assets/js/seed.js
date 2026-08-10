// Seed data for the shared master venue database.
//
// NOTE: every venue, contact and email address below is fictional and uses the
// reserved example.com domain. In production this table is replaced by an import
// of the proprietary GigBook venue spreadsheet (see Admin -> Import).

const GENRE_SETS = [
  ['Indie', 'Rock', 'Alt'],
  ['Americana', 'Folk', 'Country'],
  ['Singer-songwriter', 'Folk'],
  ['Punk', 'Garage', 'Rock'],
  ['Soul', 'Funk', 'R&B'],
  ['Jazz', 'Soul'],
  ['Electronic', 'Indie'],
  ['Hip-hop', 'R&B'],
  ['Blues', 'Roots', 'Americana'],
  ['Indie', 'Pop'],
];

const CONTACTS = [
  'Rowan Estes', 'Priya Halloran', 'Devon Marsh', 'Nia Calder', 'Theo Brandt',
  'Marisol Vance', 'Kit Ferreira', 'Sam Okonkwo', 'Ines Barlow', 'Jonah Pike',
  'Elena Sorrell', 'Casey Nwosu', 'Rafe Sandoval', 'Tamsin Doyle', 'Isaac Moreau',
];

const NOTES = [
  'Books 8-10 weeks out. Email only, no phone calls.',
  'Prefers acts with a local draw of 40+. Include recent ticket counts.',
  'Weeknight support slots open most months; headline slots book far ahead.',
  'Send a single streaming link, not a full album. Short pitches get read first.',
  'Runs a listening-room policy — quiet sets, seated audience.',
  'Local support is booked by the venue, not the touring act.',
  'Backline provided. Load-in is street level.',
  'Sunday residencies available for regional acts.',
];

const PAY = ['Door split (70/30)', 'Guarantee + door', 'Door split (80/20)', 'Flat guarantee', 'Door split + bar %'];
const METHODS = ['Email', 'Email', 'Email', 'Booking form'];

const ROWS = [
  // name, city, state, lat, lng, capacity, type
  ['The Copper Owl', 'Nashville', 'TN', 36.1627, -86.7816, 250, 'Club'],
  ['Wren & Whistle', 'Nashville', 'TN', 36.1512, -86.7900, 120, 'Listening Room'],
  ['Bluebonnet Social', 'Austin', 'TX', 30.2672, -97.7431, 400, 'Club'],
  ['The Tin Armadillo', 'Austin', 'TX', 30.2540, -97.7350, 180, 'Bar'],
  ['Alder Street Hall', 'Portland', 'OR', 45.5152, -122.6784, 500, 'Theatre'],
  ['Foxglove Tavern', 'Portland', 'OR', 45.5230, -122.6600, 150, 'Bar'],
  ['Nightjar Room', 'Seattle', 'WA', 47.6062, -122.3321, 300, 'Club'],
  ['Ember Hall', 'Denver', 'CO', 39.7392, -104.9903, 650, 'Club'],
  ['The Lantern Room', 'Chicago', 'IL', 41.8781, -87.6298, 220, 'Listening Room'],
  ['Halsted Iron Works', 'Chicago', 'IL', 41.9100, -87.6480, 700, 'Club'],
  ['Northloop Assembly', 'Minneapolis', 'MN', 44.9778, -93.2650, 450, 'Club'],
  ['Gowanus Tin Shop', 'Brooklyn', 'NY', 40.6782, -73.9942, 280, 'DIY Space'],
  ['The Blue Heron', 'Brooklyn', 'NY', 40.7100, -73.9600, 350, 'Club'],
  ['Fishtown Parlour', 'Philadelphia', 'PA', 39.9700, -75.1300, 200, 'Bar'],
  ['Harborlight Hall', 'Boston', 'MA', 42.3601, -71.0589, 520, 'Theatre'],
  ['Anacostia Sound', 'Washington', 'DC', 38.9072, -77.0369, 330, 'Club'],
  ['Peachwood Stage', 'Atlanta', 'GA', 33.7490, -84.3880, 480, 'Club'],
  ['Marigny Brass House', 'New Orleans', 'LA', 29.9640, -90.0560, 240, 'Bar'],
  ['Hollowtree Stage', 'Asheville', 'NC', 35.5951, -82.5515, 300, 'Brewery'],
  ['Shockoe Sound Bar', 'Richmond', 'VA', 37.5407, -77.4360, 190, 'Bar'],
  ['Cass Corridor Works', 'Detroit', 'MI', 42.3450, -83.0620, 420, 'Club'],
  ['Short North Annex', 'Columbus', 'OH', 39.9800, -83.0050, 260, 'Club'],
  ['Ironwren Hall', 'Pittsburgh', 'PA', 40.4406, -79.9959, 350, 'Club'],
  ['Crossroads Cellar', 'Kansas City', 'MO', 39.0900, -94.5830, 210, 'Bar'],
  ['Cherokee Street Vault', 'St. Louis', 'MO', 38.5900, -90.2400, 300, 'Club'],
  ['Deep Ellum Foundry', 'Dallas', 'TX', 32.7840, -96.7830, 600, 'Club'],
  ['Bayou Bell', 'Houston', 'TX', 29.7604, -95.3698, 280, 'Bar'],
  ['Saguaro Social Club', 'Phoenix', 'AZ', 33.4484, -112.0740, 330, 'Club'],
  ['Wasatch Union Hall', 'Salt Lake City', 'UT', 40.7608, -111.8910, 400, 'Club'],
  ['Basalt Room', 'Boise', 'ID', 43.6150, -116.2023, 180, 'Listening Room'],
  ['Mission Bell Hall', 'San Francisco', 'CA', 37.7599, -122.4148, 450, 'Club'],
  ['Lake Merritt Annex', 'Oakland', 'CA', 37.8044, -122.2712, 260, 'DIY Space'],
  ['Echo Canyon', 'Los Angeles', 'CA', 34.0780, -118.2600, 500, 'Club'],
  ['The Velvet Sparrow', 'Los Angeles', 'CA', 34.0430, -118.2670, 200, 'Bar'],
  ['Harbour & Vine', 'San Diego', 'CA', 32.7157, -117.1611, 300, 'Club'],
  ['Delta Freight Hall', 'Sacramento', 'CA', 38.5816, -121.4944, 350, 'Club'],
  ['Neon Palm Lounge', 'Las Vegas', 'NV', 36.1699, -115.1398, 220, 'Bar'],
  ['High Desert Hall', 'Albuquerque', 'NM', 35.0844, -106.6504, 300, 'Club'],
  ['Ocotillo Room', 'Tucson', 'AZ', 32.2226, -110.9747, 170, 'Bar'],
  ['Little River Sound', 'Miami', 'FL', 25.8300, -80.1950, 380, 'Club'],
  ['Citrus Line Hall', 'Orlando', 'FL', 28.5383, -81.3792, 320, 'Club'],
  ['Ybor Tin Roof', 'Tampa', 'FL', 27.9640, -82.4370, 260, 'Bar'],
  ['Cooper River Room', 'Charleston', 'SC', 32.7900, -79.9400, 240, 'Listening Room'],
  ['Pinewood Social Hall', 'Raleigh', 'NC', 35.7796, -78.6382, 350, 'Club'],
  ['Bourbon Rail Room', 'Louisville', 'KY', 38.2527, -85.7585, 280, 'Bar'],
  ['Beale Street Annex', 'Memphis', 'TN', 35.1400, -90.0530, 330, 'Club'],
  ['Third Ward Brass', 'Milwaukee', 'WI', 43.0300, -87.9070, 300, 'Club'],
  ['Prairie Gold Hall', 'Omaha', 'NE', 41.2565, -95.9345, 250, 'Club'],
  ['Arkansas River Room', 'Tulsa', 'OK', 36.1540, -95.9928, 220, 'Bar'],
  ['Plains Electric', 'Oklahoma City', 'OK', 35.4676, -97.5164, 400, 'Club'],
  ['Larkin Yard', 'Buffalo', 'NY', 42.8864, -78.8600, 280, 'Brewery'],
  ['Foundry Point', 'Providence', 'RI', 41.8240, -71.4128, 240, 'Club'],
  ['Champlain Barn', 'Burlington', 'VT', 44.4759, -73.2121, 200, 'Listening Room'],
  ['Flats Ironworks', 'Cleveland', 'OH', 41.4930, -81.7050, 450, 'Club'],
  ['Fountain Square Parlour', 'Indianapolis', 'IN', 39.7550, -86.1400, 260, 'Bar'],
  ['Isthmus Hall', 'Madison', 'WI', 43.0731, -89.4012, 300, 'Club'],
  ['Adobe Lantern', 'Santa Fe', 'NM', 35.6870, -105.9378, 150, 'Listening Room'],
  ['Riverfront Tin', 'Spokane', 'WA', 47.6588, -117.4260, 230, 'Bar'],
  ['Willamette Barn', 'Eugene', 'OR', 44.0521, -123.0868, 260, 'Brewery'],
  ['Poudre Room', 'Fort Collins', 'CO', 40.5853, -105.0844, 200, 'Brewery'],
  ['Huron Union', 'Ann Arbor', 'MI', 42.2808, -83.7430, 240, 'Club'],
  ['Prairie Light Hall', 'Iowa City', 'IA', 41.6611, -91.5302, 180, 'Bar'],
  ['Oconee Social', 'Athens', 'GA', 33.9519, -83.3576, 300, 'Club'],
  ['Magic City Foundry', 'Birmingham', 'AL', 33.5186, -86.8104, 350, 'Club'],
  ['Casco Bay Room', 'Portland', 'ME', 43.6591, -70.2568, 220, 'Listening Room'],
  ['Hampden Hall', 'Baltimore', 'MD', 39.3300, -76.6300, 280, 'Club'],
  ['Old City Sound', 'Knoxville', 'TN', 35.9700, -83.9180, 240, 'Bar'],
  ['Flatiron Barn', 'Boulder', 'CO', 40.0150, -105.2705, 260, 'Brewery'],
  ['Truckee Room', 'Reno', 'NV', 39.5296, -119.8138, 200, 'Bar'],
  ['Camden Yard Room', 'Charlotte', 'NC', 35.2271, -80.8431, 320, 'Club'],
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
    const [name, city, state, lat, lng, capacity, type] = row;
    const slug = slugify(name);
    return {
      id: `ven_${slug}`,
      name,
      city,
      state,
      country: 'USA',
      lat,
      lng,
      capacity,
      type,
      genres: GENRE_SETS[i % GENRE_SETS.length],
      contactName: CONTACTS[i % CONTACTS.length],
      contactEmail: `booking@${slug}.example.com`,
      phone: '',
      website: `https://${slug}.example.com`,
      submissionMethod: METHODS[i % METHODS.length],
      payType: PAY[i % PAY.length],
      notes: NOTES[i % NOTES.length],
      status: 'active',
      source: 'seed',
      addedAt: new Date(Date.now() - (i + 3) * 86400000).toISOString(),
    };
  });
}

export const VENUE_TYPES = ['Club', 'Bar', 'Listening Room', 'Theatre', 'Brewery', 'DIY Space'];
export const ALL_GENRES = [...new Set(GENRE_SETS.flat())].sort();
