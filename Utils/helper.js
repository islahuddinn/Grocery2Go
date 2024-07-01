// Helper function to calculate distance (using Haversine formula)
function calculateDistance(products, userLocation) {
  if (!products.length || !userLocation) return 0;

  const shopLocation = products[0].shop.location.coordinates;
  const [lat1, lon1] = userLocation || shopLocation;
  const [lat2, lon2] = shopLocation;

  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Helper function to calculate expected delivery time
function calculateExpectedDeliveryTime(products, userLocation, speed) {
  const distance = calculateDistance(products, userLocation);
  const time = distance / speed; // Time in hours
  return time * 60; // Convert to minutes
}

function haversineDistance(coords1, coords2) {
  if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) {
    throw new Error("Invalid coordinates");
  }

  const toRadians = (angle) => (angle * Math.PI) / 180;

  const lat1 = coords1[0];
  const lon1 = coords1[1];
  const lat2 = coords2[0];
  const lon2 = coords2[1];

  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in kilometers
}

// Calculate delivery charges based on distance
function calculateDeliveryCharges(startLocation, endLocation, ratePerKm = 5) {
  if (
    !startLocation ||
    !endLocation ||
    !startLocation.coordinates ||
    !endLocation.coordinates
  ) {
    throw new Error("Invalid start or end location");
  }
  const distance = haversineDistance(
    startLocation.coordinates,
    endLocation.coordinates
  );
  return distance * ratePerKm;
}

module.exports = {
  calculateDistance,
  calculateExpectedDeliveryTime,
  calculateDeliveryCharges,
};
