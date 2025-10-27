<?php

namespace App\Features\AccessReviews\Services;

use App\Features\AccessReviews\Models\AccessReview;
use App\Features\AccessReviews\Repositories\AccessReviewRepository;
use App\Features\Accounts\Models\RoleChange;
use App\Features\Accounts\Models\User;
use App\Features\Accounts\Repositories\AccountChangeRepository;
use App\Features\Accounts\Repositories\RoleChangeRepository;
use App\Features\Accounts\Repositories\SignInRepository;
use App\Features\Accounts\Repositories\UserRepository;
use App\Features\Branches\Repositories\BranchRepository;
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
 *
 * Each account is shown as it was at the end of the period (or now, for the current period): its last sign-in on
 * or before then, and its role, status and branch then, from the sign-in and change logs.
 */
class AccessReviewGenerator
{
    public const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

    public function __construct(
        private AccessReviewRepository $reviews,
        private UserRepository $users,
        private RoleChangeRepository $roleChanges,
        private SignInRepository $signIns,
        private AccountChangeRepository $accountChanges,
        private BranchRepository $branches,
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

        // How each account stood at $asOf: changes made after it are undone
        $lastSignIns = $this->signIns->lastAtOrBefore($asOfDb);
        $historyStart = $this->signIns->historyStart();
        $rolesThen = $this->roleChanges->rolesAt($asOfDb);
        $statusesThen = $this->accountChanges->valuesAt('status', $asOfDb);
        $branchesThen = $this->accountChanges->valuesAt('branch', $asOfDb);
        $branchNames = $this->branches->namesById();

        $rows = $this->users->createdBy($asOfDb)
            ->map(function (User $user) use ($asOf, $dormantDays, $staleDays, $changes, $lastSignIns, $historyStart, $rolesThen, $statusesThen, $branchesThen, $branchNames) {
                $role = $rolesThen[$user->id] ?? $user->role;
                $status = $statusesThen->has($user->id) ? AccountStatus::from($statusesThen[$user->id]) : $user->status;
                $branchId = $branchesThen->has($user->id) ? $branchesThen[$user->id] : $user->branch_id;

                // The log's last sign-in by then; the account's own latest sign-in is just as exact when it falls by then
                // (it covers accounts whose sign-ins weren't logged, e.g. seeded ones)
                $latest = $user->last_login_at ? CarbonImmutable::parse($user->last_login_at) : null;
                $lastLogin = $lastSignIns[$user->id] ?? ($latest && $latest->lte($asOf) ? $latest : null);
                // No sign-in on record by then, though the account has signed in since: before the sign-in history
                // began only each account's latest sign-in is known, so whether it signed in by then can't be told
                $lastLoginKnown = $lastLogin !== null || ! $user->last_login_at || ($historyStart && $historyStart->lte($asOf));
                $daysSinceLogin = $lastLogin ? (int) $lastLogin->diffInDays($asOf) : null;
                $roleChanges = ($changes[$user->id] ?? collect())->map(fn (RoleChange $c) => [
                    'from' => $c->from_role->label(),
                    'to' => $c->to_role->label(),
                    'at' => $c->changed_at->toIso8601String(),
                ])->values()->all();

                $flags = [];
                if ($status === AccountStatus::Active && $lastLoginKnown && ($daysSinceLogin === null || $daysSinceLogin >= $dormantDays)) {
                    $flags[] = 'dormant';
                }
                if ($roleChanges) {
                    $flags[] = 'role_changed';
                }
                if ($status === AccountStatus::Invited && CarbonImmutable::parse($user->created_at)->diffInDays($asOf) >= $staleDays) {
                    $flags[] = 'stale_invitation';
                }
                if ($status === AccountStatus::Inactive) {
                    $flags[] = 'deactivated';
                }

                return [
                    'userId' => $user->id,
                    'fullName' => $user->full_name,
                    'email' => $user->email,
                    'role' => $role->value,
                    'roleLabel' => $role->label(),
                    'branchName' => $role === Role::Owner ? 'All Branches' : ($branchNames[$branchId] ?? null),
                    'status' => $status->label(),
                    'createdAt' => $user->created_at->copy()->setTimezone(config('pharmacy.timezone'))->toDateString(),
                    'lastLoginAt' => $lastLogin?->toIso8601String(),
                    'daysSinceLogin' => $daysSinceLogin,
                    // false: signed in at some point, but no record of whether it was by the end of the period
                    'lastLoginKnown' => $lastLoginKnown,
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
