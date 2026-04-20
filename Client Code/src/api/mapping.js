const nominatimSearch = async (query) => {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&q=' +
    encodeURIComponent(query) +
    '&countrycodes=us&limit=1&email=sahasta@saimithrallc.com';

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Geocoding failed: ' + response.status);
  }

  return response.json();
};

export const getLatLongFromAddress = async (address) => {
  let data = await nominatimSearch(address);

  // Fallback: if full address fails, try without street (city + state + zip)
  if ((!Array.isArray(data) || data.length === 0) && address.includes(',')) {
    const parts = address.split(',').map((s) => s.trim());
    if (parts.length > 2) {
      const fallback = parts.slice(1).join(', ');
      data = await nominatimSearch(fallback);
    }
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Address not found');
  }

  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
  };
};

export const getOSMMapElement = (latitude, longitude) => {
  const iframe = document.createElement('iframe');

  iframe.width = '100%';
  iframe.height = '450';
  iframe.loading = 'lazy';
  iframe.style.border = '0';

  const bbox = [
    longitude - 0.01,
    latitude - 0.01,
    longitude + 0.01,
    latitude + 0.01,
  ].join('%2C');

  iframe.src =
    'https://www.openstreetmap.org/export/embed.html' +
    '?bbox=' +
    bbox +
    '&layer=mapnik' +
    '&marker=' +
    latitude +
    '%2C' +
    longitude;

  return iframe;
};
