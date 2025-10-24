<?php

namespace App\Features\AccessReviews\Services;

use App\Features\AccessReviews\Models\AccessReview;
use App\Features\AccessReviews\Repositories\AccessReviewRepository;
use App\Features\Accounts\Models\RoleChange;
use App\Features\Accounts\Models\User;
use App\Features\Accounts\Repositories\RoleChangeRepository;
use App\Features\Accounts\Repositories\UserRepository;
use App\Shared\Enums\AccountStatus;
use App\Shared\Enums\Role;
use Carbon\CarbonImmutable;

/**
 * Access review for a period the Owner picks (today, this week, this month, this quarter, this year or a custom range): a snapshot of every account with its role and last login, flagging what
 * management should look at:
 *  - dormant            active, but no sign-in for ACCESS_REVIEW_DORMANT_DAYS (default 90)
 *  - role_changed       role changed during the period (possible privilege creep)
 *  - stale_invitation   invited ACCESS_REVIEW_STALE_INVITATION_DAYS ago (default 30), never accepted
 *  - deactivated        blocked but still on file
 */
class AccessReviewGenerator
{
    public const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

    public function __construct(
        private AccessReviewRepository $reviews,
        private UserRepository $users,
        private RoleChangeRepository $roleChanges,
    ) {}

    /** Now in the pharmacy's local time (PHARMACY_TIMEZONE), so "today" matches the clock on the wall. */
    public static function localNow(): CarbonImmutable
    {
        return CarbonImmutable::now(config('pharmacy.timezone'));
    }

    /** The current period up to now, for "Generate": today, this week, this month, this quarter or this year. */
    public function currentPeriodToDate(string $type): array
    {
        $now = self::localNow();

        return [match ($type) {
            'daily' => $now->startOfDay(),
            'weekly' => $now->startOfWeek(),
            'monthly' => $now->startOfMonth(),
            'quarterly' => $now->firstOfQuarter(),
            'yearly' => $now->startOfYear(),
        }, $now];
    }

    /**
     * The last finished period, which gives a Complete report: yesterday, last week (Mon–Sun),
     * last month, last quarter or last year.
     */
    public function previousPeriod(string $type): array
    {
        $now = self::localNow();
        $start = match ($type) {
            'daily' => $now->subDay()->startOfDay(),
            'weekly' => $now->startOfWeek()->subWeek(),
            'monthly' => $now->startOfMonth()->subMonthNoOverflow(),
            'quarterly' => $now->firstOfQuarter()->subQuarter(),
            'yearly' => $now->startOfYear()->subYear(),
        };

        return [$start, match ($type) {
            'daily' => $start->endOfDay(),
            'weekly' => $start->endOfWeek(),
            'monthly' => $start->endOfMonth(),
            'quarterly' => $start->lastOfQuarter()->endOfDay(),
            'yearly' => $start->endOfYear(),
        }];
    }

    public function generate(CarbonImmutable $start, CarbonImmutable $end, string $type, ?User $by = null, bool $scheduled = false): AccessReview
    {
        $asOf = $end->min(self::localNow());
        // Periods are in the pharmacy's local time; stored timestamps are in the app timezone (UTC)
        $dbTimezone = config('app.timezone');
        [$fromDb, $asOfDb] = [$start->setTimezone($dbTimezone), $asOf->setTimezone($dbTimezone)];
        $dormantDays = (int) config('pharmacy.access_review_dormant_days');
        $staleDays = (int) config('pharmacy.access_review_stale_invitation_days');

        $changes = $this->roleChanges->betweenByUser($fromDb, $asOfDb);

        $rows = $this->users->createdBy($asOfDb)
            ->map(function (User $user) use ($asOf, $dormantDays, $staleDays, $changes) {
                $lastLogin = $user->last_login_at ? CarbonImmutable::parse($user->last_login_at) : null;
                $daysSinceLogin = $lastLogin ? (int) $lastLogin->diffInDays($asOf) : null;
                $roleChanges = ($changes[$user->id] ?? collect())->map(fn (RoleChange $c) => [
                    'from' => $c->from_role->label(),
                    'to' => $c->to_role->label(),
                    'at' => $c->changed_at->toIso8601String(),
                ])->values()->all();

                $flags = [];
                if ($user->status === AccountStatus::Active && ($daysSinceLogin === null || $daysSinceLogin >= $dormantDays)) {
                    $flags[] = 'dormant';
                }
                if ($roleChanges) {
                    $flags[] = 'role_changed';
                }
                if ($user->status === AccountStatus::Invited && CarbonImmutable::parse($user->created_at)->diffInDays($asOf) >= $staleDays) {
                    $flags[] = 'stale_invitation';
                }
                if ($user->status === AccountStatus::Inactive) {
                    $flags[] = 'deactivated';
                }

                return [
                    'userId' => $user->id,
                    'fullName' => $user->full_name,
                    'email' => $user->email,
                    'role' => $user->role->value,
                    'roleLabel' => $user->role->label(),
                    'branchName' => $user->isOwner() ? 'All Branches' : $user->branch?->name,
                    'status' => $user->status->label(),
                    'createdAt' => $user->created_at->copy()->setTimezone(config('pharmacy.timezone'))->toDateString(),
                    'lastLoginAt' => $lastLogin?->toIso8601String(),
                    'daysSinceLogin' => $daysSinceLogin,
                    'roleChanges' => $roleChanges,
                    'flags' => $flags,
                ];
            });

        $count = fn (string $flag) => $rows->filter(fn ($row) => in_array($flag, $row['flags'], true))->count();
        $summary = [
            'totalUsers' => $rows->count(),
            'byRole' => collect(Role::cases())->mapWithKeys(fn (Role $role) => [$role->label() => $rows->where('role', $role->value)->count()])->all(),
            'dormant' => $count('dormant'),
            'roleChanged' => $count('role_changed'),
            'staleInvitations' => $count('stale_invitation'),
            'deactivated' => $count('deactivated'),
            'needsAttention' => $rows->filter(fn ($row) => $row['flags'])->count(),
            'dormantDays' => $dormantDays,
            'asOf' => $asOf->toIso8601String(),
        ];

        return $this->reviews->create([
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'period_type' => $type,
            'scheduled' => $scheduled,
            'generated_by' => $by?->id,
            'summary' => $summary,
            'rows' => $rows->values()->all(),
        ]);
    }
}
