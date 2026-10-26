/*
  cities.js — what the "Add city" search looks through.

  Time zones are named after one big city each (America/Chicago), so
  people searching "Dallas" would find nothing. This list maps common
  cities to their zone. Add your own lines any time — the format is
  [ 'City name', 'Region', 'IANA/Zone' ].
  Every official zone is also searchable automatically (see app.js).
*/
window.CITIES = [
  // United States
  ['New York', 'USA · Eastern', 'America/New_York'],
  ['Boston', 'USA · Eastern', 'America/New_York'],
  ['Atlanta', 'USA · Eastern', 'America/New_York'],
  ['Miami', 'USA · Eastern', 'America/New_York'],
  ['Washington DC', 'USA · Eastern', 'America/New_York'],
  ['Philadelphia', 'USA · Eastern', 'America/New_York'],
  ['Charlotte', 'USA · Eastern', 'America/New_York'],
  ['Orlando', 'USA · Eastern', 'America/New_York'],
  ['Detroit', 'USA · Eastern', 'America/Detroit'],
  ['Indianapolis', 'USA · Eastern', 'America/Indiana/Indianapolis'],
  ['Chicago', 'USA · Central', 'America/Chicago'],
  ['Dallas', 'USA · Central', 'America/Chicago'],
  ['Houston', 'USA · Central', 'America/Chicago'],
  ['Austin', 'USA · Central', 'America/Chicago'],
  ['San Antonio', 'USA · Central', 'America/Chicago'],
  ['Minneapolis', 'USA · Central', 'America/Chicago'],
  ['Nashville', 'USA · Central', 'America/Chicago'],
  ['New Orleans', 'USA · Central', 'America/Chicago'],
  ['Kansas City', 'USA · Central', 'America/Chicago'],
  ['St. Louis', 'USA · Central', 'America/Chicago'],
  ['Denver', 'USA · Mountain', 'America/Denver'],
  ['Salt Lake City', 'USA · Mountain', 'America/Denver'],
  ['Albuquerque', 'USA · Mountain', 'America/Denver'],
  ['Boise', 'USA · Mountain', 'America/Boise'],
  ['Phoenix', 'USA · Arizona (no daylight saving)', 'America/Phoenix'],
  ['Los Angeles', 'USA · Pacific', 'America/Los_Angeles'],
  ['San Francisco', 'USA · Pacific', 'America/Los_Angeles'],
  ['San Diego', 'USA · Pacific', 'America/Los_Angeles'],
  ['Seattle', 'USA · Pacific', 'America/Los_Angeles'],
  ['Portland', 'USA · Pacific', 'America/Los_Angeles'],
  ['Las Vegas', 'USA · Pacific', 'America/Los_Angeles'],
  ['Anchorage', 'USA · Alaska', 'America/Anchorage'],
  ['Honolulu', 'USA · Hawaii', 'Pacific/Honolulu'],
  // Canada
  ['Toronto', 'Canada · Eastern', 'America/Toronto'],
  ['Ottawa', 'Canada · Eastern', 'America/Toronto'],
  ['Montreal', 'Canada · Eastern', 'America/Toronto'],
  ['Winnipeg', 'Canada · Central', 'America/Winnipeg'],
  ['Regina', 'Canada · Saskatchewan', 'America/Regina'],
  ['Calgary', 'Canada · Mountain', 'America/Edmonton'],
  ['Edmonton', 'Canada · Mountain', 'America/Edmonton'],
  ['Vancouver', 'Canada · Pacific', 'America/Vancouver'],
  ['Halifax', 'Canada · Atlantic', 'America/Halifax'],
  ["St. John's", 'Canada · Newfoundland', 'America/St_Johns'],
  // Rest of the Americas
  ['Mexico City', 'Mexico', 'America/Mexico_City'],
  ['São Paulo', 'Brazil', 'America/Sao_Paulo'],
  ['Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires'],
  // Oceania
  ['Auckland', 'New Zealand', 'Pacific/Auckland'],
  ['Wellington', 'New Zealand', 'Pacific/Auckland'],
  ['Christchurch', 'New Zealand', 'Pacific/Auckland'],
  ['Sydney', 'Australia · NSW', 'Australia/Sydney'],
  ['Melbourne', 'Australia · Victoria', 'Australia/Melbourne'],
  ['Brisbane', 'Australia · Queensland', 'Australia/Brisbane'],
  ['Adelaide', 'Australia · SA', 'Australia/Adelaide'],
  ['Perth', 'Australia · WA', 'Australia/Perth'],
  // Europe
  ['London', 'United Kingdom', 'Europe/London'],
  ['Dublin', 'Ireland', 'Europe/Dublin'],
  ['Paris', 'France', 'Europe/Paris'],
  ['Berlin', 'Germany', 'Europe/Berlin'],
  ['Amsterdam', 'Netherlands', 'Europe/Amsterdam'],
  ['Madrid', 'Spain', 'Europe/Madrid'],
  ['Rome', 'Italy', 'Europe/Rome'],
  ['Stockholm', 'Sweden', 'Europe/Stockholm'],
  // Asia & Middle East
  ['Dubai', 'UAE', 'Asia/Dubai'],
  ['Mumbai', 'India', 'Asia/Kolkata'],
  ['Bangalore', 'India', 'Asia/Kolkata'],
  ['Singapore', 'Singapore', 'Asia/Singapore'],
  ['Hong Kong', 'Hong Kong', 'Asia/Hong_Kong'],
  ['Shanghai', 'China', 'Asia/Shanghai'],
  ['Tokyo', 'Japan', 'Asia/Tokyo'],
  ['Seoul', 'South Korea', 'Asia/Seoul'],
  ['Manila', 'Philippines', 'Asia/Manila'],
  // Plain UTC is handy for logs and servers
  ['UTC', 'Coordinated Universal Time', 'UTC']
];
