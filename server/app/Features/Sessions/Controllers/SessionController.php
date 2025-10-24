<?php

namespace App\Features\Sessions\Controllers;

use App\Features\Sessions\Jobs\PruneOldSessions;
use App\Features\Sessions\Repositories\SessionRepository;
use App\Features\Sessions\Resources\SessionResource;
use App\Features\Sessions\Services\SessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use App\Features\Sessions\Models\SessionToken;

// Owner only: Session Monitoring & Management on the Account Provision page
class SessionController
{
    public function __construct(private SessionService $sessions, private SessionRepository $repository) {}

    /** Every sign-in from the last 7 days (tokens can't live longer): open sessions first, then by latest activity. */
    public function index(): AnonymousResourceCollection
    {
        // Housekeeping (also scheduled): rows older than 30 days can't sign in and are never shown
        $this->repository->pruneOlderThan(PruneOldSessions::KEEP_DAYS);
        // Sessions abandoned without signing out (browser closed) end once they pass the timeout
        $this->sessions->expireInactiveSessions();

        return SessionResource::collection($this->repository->recent(7))
            ->additional(['meta' => [
                'idleAfterMinutes' => config('pharmacy.session_idle_minutes'),
                'signOutAfterMinutes' => config('pharmacy.session_timeout_minutes'),
            ]]);
    }

    public function end(Request $request, SessionToken $session): JsonResponse
    {
        $this->ensureNotCurrent($request, $session);
        $this->sessions->end($session, 'Ended by the Owner');

        return response()->json([
            'message' => "{$session->tokenable->email} was signed out on ".SessionService::describeDevice($session->name).'.',
            'session' => new SessionResource($this->repository->withUser($session)),
        ]);
    }

    /** Removes the session from the list, signing it out first if it was still open. */
    public function destroy(Request $request, SessionToken $session): JsonResponse
    {
        $this->ensureNotCurrent($request, $session);
        $email = $session->tokenable?->email;
        $wasOpen = $session->ended_at === null;
        $this->repository->delete($session);
        if ($wasOpen) {
            $this->sessions->notifyEnded([$session->id], 'Ended by the Owner');
        }
        $this->sessions->announce('removed');

        return response()->json(['message' => "Session for {$email} removed."]);
    }

    private function ensureNotCurrent(Request $request, SessionToken $session): void
    {
        if ($session->id === $request->user()->currentAccessToken()->id) {
            abort(422, 'This is your current session. Use Sign Out instead.');
        }
    }
}
