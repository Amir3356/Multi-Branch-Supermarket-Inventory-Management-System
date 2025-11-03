<?php

namespace App\Shared\Enums;

/**
 * Staff roles and what each one may open (RBAC).
 *
 * Section keys match the React app's PATHS keys, so the sidebar and route
 * guards on the client are driven by the same list the API enforces.
 */
enum Role: string
{
    case Owner = 'owner';
    case Pharmacist = 'pharmacist';
    case Cashier = 'cashier';
    case PurchaseOfficer = 'purchase_officer';

    /** Works across every branch, so no branch is assigned: the Owner, and the Procurement Officer who buys for all of them */
    public function coversAllBranches(): bool
    {
        return $this === self::Owner || $this === self::PurchaseOfficer;
    }

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'Owner',
            self::Pharmacist => 'Pharmacist',
            self::Cashier => 'Cashier',
            self::PurchaseOfficer => 'Procurement Officer',
        };
    }

    /** Sidebar sections this role can open; the first one is where they land after signing in (their Dashboard). */
    public function sections(): array
    {
        return match ($this) {
            self::Owner => ['dashboard', 'accounts', 'branches', 'auditLogs', 'reports'],
            self::Pharmacist => ['dashboard', 'inventory', 'returnRequests', 'transfers', 'damaged', 'policy', 'reports', 'notifications'],
            self::Cashier => ['dashboard', 'sales', 'customerReturns', 'reports'],
            self::PurchaseOfficer => ['dashboard', 'purchases', 'supplierReturns', 'reports'],
        };
    }

    public function homeSection(): string
    {
        return $this->sections()[0];
    }

    /** Roles the Owner can invite. The Owner account itself is created from the command line. */
    public static function staff(): array
    {
        return [self::Pharmacist, self::Cashier, self::PurchaseOfficer];
    }
}
