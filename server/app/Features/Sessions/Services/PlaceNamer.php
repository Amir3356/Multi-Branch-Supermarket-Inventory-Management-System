<?php

namespace App\Features\Sessions\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Turns a device's latitude/longitude into "City, Sub-city, Country" (e.g. "Addis Ababa, Bole, Ethiopia")
 * using OpenStreetMap's free Nominatim service. Its usage policy asks for an app name in each request,
 * at most one request per second, and caching, so each ~100 m spot is looked up once per 30 days.
 */
class PlaceNamer
{
    public function name(float $latitude, float $longitude): ?string
    {
        $key = sprintf('place-name:%.3f,%.3f', $latitude, $longitude);

        return Cache::remember($key, now()->addDays(30), function () use ($latitude, $longitude) {
            try {
                $address = Http::timeout(6)
                    ->withUserAgent(config('app.name').' Session Monitoring ('.config('app.url').')')
                    ->get('https://nominatim.openstreetmap.org/reverse', [
                        'format' => 'jsonv2',
                        'lat' => $latitude,
                        'lon' => $longitude,
                        'zoom' => 16,
                        'addressdetails' => 1,
                        'accept-language' => 'en',
                    ])
                    ->json('address');
            } catch (Throwable) {
                return null;
            }

            return $address ? $this->format($address) : null;
        });
    }

    private function format(array $address): ?string
    {
        // Addis Ababa's sub-cities (Bole, Kirkos, Arada…) come back as "county"; the city is often only the state
        $city = $address['city'] ?? $address['town'] ?? $address['village'] ?? $address['state_district'] ?? $address['state'] ?? null;
        $area = $address['county'] ?? $address['city_district'] ?? $address['suburb'] ?? $address['neighbourhood'] ?? null;
        $parts = array_unique(array_filter([$city, $area, $address['country'] ?? null]));

        return $parts ? implode(', ', $parts) : null;
    }
}
