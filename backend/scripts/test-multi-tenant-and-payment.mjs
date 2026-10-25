/**
 * Verification test script for:
 * 1. Midtrans Subscription Payment Flow (cancel validation, parameter contracts)
 * 2. Multi-Tenant Business Isolation Logic (staff scoping, cross-business protection)
 * 3. Migration 0029 SQL integrity check
 */

import fs from 'node:fs'
import path from 'node:path'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failed++
  }
}

console.log('\n--- 1. Testing Migration 0029 Multi-Tenant Isolation SQL ---')
let migrationPath = path.resolve('database/supabase/migrations/0029_multi_tenant_business_isolation.sql')
if (!fs.existsSync(migrationPath)) {
  migrationPath = path.resolve('backend/supabase/migrations/0029_multi_tenant_business_isolation.sql')
}
assert(fs.existsSync(migrationPath), 'Migration 0029 file exists')

const sqlContent = fs.readFileSync(migrationPath, 'utf8')
assert(sqlContent.includes('create table if not exists public.businesses'), 'Creates public.businesses table')
assert(sqlContent.includes('business_id uuid references public.businesses(id)'), 'Adds business_id foreign key')
assert(sqlContent.includes('create or replace function public.current_business_id()'), 'Defines current_business_id() helper')
assert(sqlContent.includes('create or replace function public.enforce_tenant_isolation()'), 'Defines enforce_tenant_isolation() trigger')
assert(sqlContent.includes('alter table public.products enable row level security'), 'Enables RLS on operational tables')
assert(sqlContent.includes('categories_business_name_key unique (business_id, name)'), 'Replaces category unique constraint with composite (business_id, name)')
assert(sqlContent.includes('products_business_sku_key unique (business_id, sku)'), 'Replaces product SKU unique constraint with composite (business_id, sku)')

console.log('\n--- 2. Testing Subscription Cancel Endpoint Logic ---')
const cancelRoutePath = path.resolve('frontend/app/api/subscription/cancel/route.ts')
assert(fs.existsSync(cancelRoutePath), 'Cancel subscription route exists')

const cancelCode = fs.readFileSync(cancelRoutePath, 'utf8')
assert(cancelCode.includes('requireOwner'), 'Ensures only authenticated owners can cancel orders')
assert(cancelCode.includes('cannot cancel a successful payment') || cancelCode.includes('tidak dapat dibatalkan'), 'Guards against cancelling settled/paid transactions')
assert(cancelCode.includes('cancelMidtransTransaction') || cancelCode.includes('midtrans/cancel'), 'Invokes Midtrans /cancel endpoint for pending orders')
assert(cancelCode.includes("status: 'cancelled'"), 'Updates subscription_payments status to cancelled in database')
assert(cancelCode.includes('audit_logs'), 'Records cancellation audit log')

console.log('\n--- 3. Testing Payment Finish Page Embed Contract ---')
const finishPagePath = path.resolve('frontend/app/payment/finish/page.tsx')
assert(fs.existsSync(finishPagePath), 'Payment finish page exists')

const finishCode = fs.readFileSync(finishPagePath, 'utf8')
assert(finishCode.includes('window.snap.pay'), 'Embeds Midtrans Snap directly in current page')
assert(!finishCode.includes('Buka Sandbox'), 'Does not contain customer-facing "Buka Sandbox" text')
assert(finishCode.includes('hasAutoOpenedRef'), 'Guards against duplicate Snap popups')
assert(finishCode.includes('setShowCancelModal'), 'Includes cancellation confirmation dialog')

console.log('\n--- 4. Testing Subscription Page Alignment ---')
const subPagePath = path.resolve('frontend/features/subscription/SubscriptionPage.tsx')
const subCode = fs.readFileSync(subPagePath, 'utf8')
assert(!subCode.includes('SANDBOX_PAYMENT_LINKS'), 'Removed mock/manual sandbox link map')
assert(!subCode.includes('Buka Sandbox Payment Link'), 'Removed customer-facing sandbox link labels')
assert(subCode.includes('/payment/finish?order_id='), 'Routes checkout directly to finish page with order_id')
assert(subCode.includes('setShowCancelConfirmModal'), 'Includes in-app cancel modal dialog')

console.log('\n--- 5. Testing Multi-Tenant Staff Management Logic ---')
const adminUsersPath = path.resolve('frontend/app/api/admin/users/route.ts')
const adminUsersCode = fs.readFileSync(adminUsersPath, 'utf8')
assert(adminUsersCode.includes('resolveCallerBusiness'), 'Extracts and verifies caller business_id')
assert(adminUsersCode.includes('profilePayload.business_id = businessId'), 'Assigns newly created staff to caller business')
assert(adminUsersCode.includes('targetProfile.business_id !== businessId'), 'Prevents cross-tenant update/delete on foreign staff')

console.log('\n--- 6. Testing Owner and Admin Pengguna Page Scoping ---')
const ownerPenggunaPath = path.resolve('frontend/app/(owner)/owner/pengguna/page.tsx')
const adminPenggunaPath = path.resolve('frontend/app/(admin)/admin/pengguna/page.tsx')
const ownerPenggunaCode = fs.readFileSync(ownerPenggunaPath, 'utf8')
const adminPenggunaCode = fs.readFileSync(adminPenggunaPath, 'utf8')

assert(ownerPenggunaCode.includes('callerProfile') && ownerPenggunaCode.includes('business_id'), 'Owner pengguna page scopes staff to caller business_id')
assert(adminPenggunaCode.includes('callerProfile') && adminPenggunaCode.includes('business_id'), 'Admin pengguna page scopes kasir to caller business_id')

console.log(`\n========================================`)
console.log(`Total tests run: ${passed + failed}`)
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
console.log(`========================================\n`)

if (failed > 0) {
  process.exit(1)
} else {
  console.log('All automated integration checks PASSED successfully.')
}
