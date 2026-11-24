export interface Region {
  name: string;
  lat: number;
  lng: number;
}

/** Approximate oblast centres; stations are assigned to the nearest one. */
export const REGIONS: Region[] = [
  { name: 'Київ', lat: 50.45, lng: 30.52 },
  { name: 'Київська', lat: 50.1, lng: 30.2 },
  { name: 'Вінницька', lat: 49.23, lng: 28.47 },
  { name: 'Волинська', lat: 50.75, lng: 25.33 },
  { name: 'Дніпропетровська', lat: 48.46, lng: 35.04 },
  { name: 'Донецька', lat: 48.0, lng: 37.8 },
  { name: 'Житомирська', lat: 50.25, lng: 28.66 },
  { name: 'Закарпатська', lat: 48.62, lng: 22.29 },
  { name: 'Запорізька', lat: 47.84, lng: 35.14 },
  { name: 'Івано-Франківська', lat: 48.92, lng: 24.71 },
  { name: 'Кіровоградська', lat: 48.51, lng: 32.26 },
  { name: 'Луганська', lat: 48.57, lng: 39.31 },
  { name: 'Львівська', lat: 49.84, lng: 24.03 },
  { name: 'Миколаївська', lat: 46.97, lng: 32.0 },
  { name: 'Одеська', lat: 46.48, lng: 30.73 },
  { name: 'Полтавська', lat: 49.59, lng: 34.55 },
  { name: 'Рівненська', lat: 50.62, lng: 26.25 },
  { name: 'Сумська', lat: 50.91, lng: 34.8 },
  { name: 'Тернопільська', lat: 49.55, lng: 25.59 },
  { name: 'Харківська', lat: 49.99, lng: 36.23 },
  { name: 'Херсонська', lat: 46.64, lng: 32.62 },
  { name: 'Хмельницька', lat: 49.42, lng: 26.98 },
  { name: 'Черкаська', lat: 49.44, lng: 32.06 },
  { name: 'Чернівецька', lat: 48.29, lng: 25.94 },
  { name: 'Чернігівська', lat: 51.5, lng: 31.29 },
];

export function nearestRegion(lat: number, lng: number): string {
  let best = REGIONS[0]!;
  let bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const r of REGIONS) {
    const d = (r.lat - lat) ** 2 + ((r.lng - lng) * k) ** 2;
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best.name;
}
