<?php

namespace App\Features\Sessions\Controllers;

use App\Features\Sessions\Repositories\SessionRepository;
use App\Features\Sessions\Services\PlaceNamer;
use App\Features\Sessions\Services\SessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Any signed-in user: the browser reports where this session is being used (only if the person allowed it)
class DeviceLocationController
{
    public function __invoke(Request $request, PlaceNamer $places, SessionService $sessions, SessionRepository $repository): JsonResponse
    {
        if (! config('pharmacy.device_location')) {
            abort(404);
        }

        $data = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
        ]);

        $location = $places->name((float) $data['latitude'], (float) $data['longitude']);
        if ($location) {
            $repository->setLocation($request->user()->currentAccessToken(), $location, 'device');
            $sessions->announce('location');
        }

        return response()->json(['location' => $location]);
    }
}
