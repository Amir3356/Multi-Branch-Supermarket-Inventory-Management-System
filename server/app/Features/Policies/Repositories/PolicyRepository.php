<?php

namespace App\Features\Policies\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Policies\Models\PolicySetting;

// Every database read and write for the policy
class PolicyRepository
{
    /** The policy (created with the defaults if the row is missing) */
    public function current(): PolicySetting
    {
        return PolicySetting::with('editor')->first()
            ?? PolicySetting::create(['default_min_stock' => 20, 'expiry_warning_days' => 60]);
    }

    public function update(array $attributes, User $by): PolicySetting
    {
        $policy = $this->current();
        $policy->update($attributes + ['updated_by' => $by->id]);

        return $policy->load('editor');
    }
}
