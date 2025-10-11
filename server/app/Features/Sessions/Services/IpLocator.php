<?php

namespace App\Features\Sessions\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Turns an IP address into "City, Country" for Session Monitoring, using ipwho.is (free, no key).
 * Each public IP is looked up once and cached for 30 days; local and private addresses never leave the server.
 */
class IpLocator
{
    public function locate(?string $ip): ?string
    {
        if (! $ip || ! filter_var($ip, FILTER_VALIDATE_IP)) {
            return null;
        }
        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return 'Local network';
        }
        if (! config('pharmacy.ip_location_lookup')) {
            return null;
        }

        return Cache::remember("ip-location:{$ip}", now()->addDays(30), function () use ($ip) {
            try {
                $data = Http::timeout(4)->get("https://ipwho.is/{$ip}", ['fields' => 'success,city,country'])->json();
            } catch (Throwable) {
                return null;
            }

            $place = array_filter([$data['city'] ?? null, $data['country'] ?? null]);

            return ($data['success'] ?? false) && $place ? implode(', ', $place) : null;
        });
    }
}
