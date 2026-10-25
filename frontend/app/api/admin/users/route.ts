import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getUserFacingError } from "@/lib/user-facing-error";
import { getSupabaseAdminClient } from "@backend/index";

function getErrorMessage(error: unknown, fallback: string) {
  return getUserFacingError(error, fallback);
}

function getAdminClient() {
  return getSupabaseAdminClient();
}

/**
 * Resolves the trusted business_id for the caller.
 * If the caller is an owner and has no business record yet, it auto-creates one.
 */
async function resolveCallerBusiness(
  adminClient: ReturnType<typeof getAdminClient>,
  callerId: string,
  callerRole: string,
  callerName: string,
  existingBusinessId?: string | null,
): Promise<string | null> {
  if (existingBusinessId) return existingBusinessId;

  if (callerRole === "owner") {
    // Check if businesses table has a row for this owner
    try {
      const { data: business } = await adminClient
        .from("businesses")
        .select("id")
        .eq("owner_id", callerId)
        .maybeSingle();

      if (business?.id) {
        // Link to profile
        await adminClient
          .from("profiles")
          .update({ business_id: business.id })
          .eq("id", callerId);
        return business.id;
      }

      // Auto-create business for owner
      const { data: newBiz, error: createBizError } = await adminClient
        .from("businesses")
        .insert({
          owner_id: callerId,
          name: `${callerName.trim() || "Fluxa"} Store`,
        })
        .select("id")
        .maybeSingle();

      if (newBiz?.id) {
        await adminClient
          .from("profiles")
          .update({ business_id: newBiz.id })
          .eq("id", callerId);
        return newBiz.id;
      }
    } catch (bizErr) {
      console.warn("Unable to resolve/create business in businesses table:", bizErr);
    }
  }

  return null;
}

// GET: Ambil daftar staf milik bisnis pemanggil saja
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan login terlebih dahulu." },
        { status: 401 },
      );
    }

    const adminClient = getAdminClient();
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("id, role, full_name, approval_status, business_id")
      .eq("id", user.id)
      .maybeSingle();

    if (
      !callerProfile ||
      callerProfile.approval_status !== "approved" ||
      !["admin", "owner", "super_admin"].includes(callerProfile.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden: Hak akses ditolak." },
        { status: 403 },
      );
    }

    // Super Admin can see all or filter by query
    if (callerProfile.role === "super_admin") {
      const { data: allUsers } = await adminClient
        .from("profiles")
        .select("id, full_name, role, phone, email, created_at, business_id")
        .order("created_at", { ascending: false });
      return NextResponse.json({ users: allUsers || [] });
    }

    const businessId = await resolveCallerBusiness(
      adminClient,
      user.id,
      callerProfile.role,
      callerProfile.full_name,
      callerProfile.business_id,
    );

    let query = adminClient
      .from("profiles")
      .select("id, full_name, role, phone, email, created_at, business_id")
      .order("created_at", { ascending: false });

    if (callerProfile.role === "admin") {
      query = query.eq("role", "kasir");
    }

    if (businessId) {
      query = query.eq("business_id", businessId);
    } else {
      query = query.eq("id", user.id);
    }

    const { data: users, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    return NextResponse.json({ users: users || [] });
  } catch (error: unknown) {
    console.error("API Error get users:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Terjadi kesalahan server.") },
      { status: 500 },
    );
  }
}

// POST: Tambah akun staf (Admin hanya boleh buat kasir untuk bisnisnya)
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan login terlebih dahulu." },
        { status: 401 },
      );
    }

    const adminClient = getAdminClient();
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("id, role, approval_status, full_name, business_id")
      .eq("id", user.id)
      .maybeSingle();

    if (
      !callerProfile ||
      callerProfile.approval_status !== "approved" ||
      !["admin", "owner", "super_admin"].includes(callerProfile.role)
    ) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Hanya Admin atau Owner yang dapat membuat pengguna.",
        },
        { status: 403 },
      );
    }

    // Resolve tenant business
    const businessId = await resolveCallerBusiness(
      adminClient,
      user.id,
      callerProfile.role,
      callerProfile.full_name,
      callerProfile.business_id,
    );

    const body = await req.json();
    const { full_name, email, password, phone } = body;

    if (!full_name || !email || !password) {
      return NextResponse.json(
        { error: "Nama lengkap, email, dan password wajib diisi." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter." },
        { status: 400 },
      );
    }

    // Guard: Admin HANYA boleh menambahkan akun kasir
    let targetRole = "kasir";
    if (
      (callerProfile.role === "owner" || callerProfile.role === "super_admin") &&
      body.role &&
      ["kasir", "admin"].includes(body.role)
    ) {
      targetRole = body.role;
    }

    // 1. Buat user di Auth Supabase
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role: targetRole,
          phone: phone?.trim() || null,
          business_id: businessId ?? null,
        },
      });

    if (authError) {
      return NextResponse.json(
        {
          error: getErrorMessage(
            authError,
            "Akun belum dapat dibuat. Silakan periksa data dan coba lagi.",
          ),
        },
        { status: 400 },
      );
    }

    const createdUser = authData.user;

    // 2. Simpan profil staf dengan penugasan business_id yang valid
    const profilePayload: Record<string, unknown> = {
      id: createdUser.id,
      full_name: full_name.trim(),
      role: targetRole,
      phone: phone?.trim() || null,
      email: email.trim().toLowerCase(),
      approval_status: "approved",
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (businessId) {
      profilePayload.business_id = businessId;
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(profilePayload)
      .select()
      .single();

    if (profileError) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
        createdUser.id,
      );
      if (cleanupError) {
        console.error("Unable to remove user after profile upsert failed.", cleanupError);
      }
      console.error("Unable to save staff profile.", profileError);

      return NextResponse.json(
        { error: "Profil pengguna belum dapat disimpan." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: createdUser.id,
        full_name: full_name.trim(),
        role: targetRole,
        phone: phone?.trim() || null,
        email: email.trim().toLowerCase(),
        business_id: businessId,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("API Error create user:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Terjadi kesalahan server.") },
      { status: 500 },
    );
  }
}

// PUT: Edit akun staf (Terikat ketat ke bisnis pemanggil)
export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan login." },
        { status: 401 },
      );
    }

    const adminClient = getAdminClient();
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("id, role, approval_status, full_name, business_id")
      .eq("id", user.id)
      .maybeSingle();

    if (
      !callerProfile ||
      callerProfile.approval_status !== "approved" ||
      !["admin", "owner", "super_admin"].includes(callerProfile.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden: Hak akses ditolak." },
        { status: 403 },
      );
    }

    const businessId = await resolveCallerBusiness(
      adminClient,
      user.id,
      callerProfile.role,
      callerProfile.full_name,
      callerProfile.business_id,
    );

    const body = await req.json();
    const { id, full_name, phone, password } = body;

    if (!id || !full_name) {
      return NextResponse.json(
        { error: "ID dan nama lengkap wajib diisi." },
        { status: 400 },
      );
    }

    // Ambil target profile
    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 },
      );
    }

    if (targetProfile.role === "super_admin") {
      return NextResponse.json(
        { error: "Akun Super Admin hanya dapat dikelola melalui proses Super Admin." },
        { status: 403 },
      );
    }

    // Multi-tenant check: Target user MUST belong to the caller's business
    if (callerProfile.role !== "super_admin") {
      if (businessId && targetProfile.business_id && targetProfile.business_id !== businessId) {
        return NextResponse.json(
          { error: "Akses ditolak: Staf ini bukan anggota bisnis Anda." },
          { status: 403 },
        );
      }
    }

    // Guard: Admin HANYA boleh edit akun kasir
    if (callerProfile.role === "admin" && targetProfile.role !== "kasir") {
      return NextResponse.json(
        { error: "Akses ditolak: Admin hanya berwenang mengelola akun kasir." },
        { status: 403 },
      );
    }

    // Update profile (business_id is protected and cannot be changed via PUT)
    const updateProfileData: Database["public"]["Tables"]["profiles"]["Update"] = {
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let nextRole = targetProfile.role;
    if (
      (callerProfile.role === "owner" || callerProfile.role === "super_admin") &&
      body.role &&
      ["kasir", "admin"].includes(body.role)
    ) {
      updateProfileData.role = body.role;
      nextRole = body.role;
    }

    const { error: updateProfErr } = await adminClient
      .from("profiles")
      .update(updateProfileData)
      .eq("id", id);

    if (updateProfErr) {
      console.error("Unable to update user profile:", updateProfErr);
      return NextResponse.json(
        { error: "Data profil belum dapat diperbarui. Silakan coba lagi." },
        { status: 400 },
      );
    }

    // Update auth metadata & password
    const authUpdatePayload: {
      user_metadata: Record<string, unknown>;
      password?: string;
    } = {
      user_metadata: {
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        role: nextRole,
      },
    };
    if (password && password.trim().length >= 6) {
      authUpdatePayload.password = password.trim();
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
      id,
      authUpdatePayload,
    );
    if (authUpdateError) {
      console.error("Auth account update failed after profile update:", authUpdateError);
      return NextResponse.json(
        {
          error: "Profil tersimpan, tetapi perubahan pada akun belum dapat diselesaikan.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        ...targetProfile,
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        role: nextRole,
      },
    });
  } catch (error: unknown) {
    console.error("API Error update user:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Terjadi kesalahan server.") },
      { status: 500 },
    );
  }
}

// DELETE: Hapus akun staf (Terikat ketat ke bisnis pemanggil)
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan login." },
        { status: 401 },
      );
    }

    const adminClient = getAdminClient();
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("id, role, approval_status, full_name, business_id")
      .eq("id", user.id)
      .maybeSingle();

    if (
      !callerProfile ||
      callerProfile.approval_status !== "approved" ||
      !["admin", "owner", "super_admin"].includes(callerProfile.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden: Hak akses ditolak." },
        { status: 403 },
      );
    }

    const businessId = await resolveCallerBusiness(
      adminClient,
      user.id,
      callerProfile.role,
      callerProfile.full_name,
      callerProfile.business_id,
    );

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID pengguna wajib disertakan." },
        { status: 400 },
      );
    }

    if (id === user.id) {
      return NextResponse.json(
        { error: "Tidak dapat menghapus akun Anda sendiri." },
        { status: 400 },
      );
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 },
      );
    }

    if (targetProfile.role === "super_admin") {
      return NextResponse.json(
        { error: "Akun Super Admin tidak dapat dihapus." },
        { status: 403 },
      );
    }

    // Multi-tenant check: Target user MUST belong to the caller's business
    if (callerProfile.role !== "super_admin") {
      if (businessId && targetProfile.business_id && targetProfile.business_id !== businessId) {
        return NextResponse.json(
          { error: "Akses ditolak: Staf ini bukan anggota bisnis Anda." },
          { status: 403 },
        );
      }
    }

    // Guard: Admin HANYA boleh hapus akun kasir
    if (callerProfile.role === "admin" && targetProfile.role !== "kasir") {
      return NextResponse.json(
        { error: "Akses ditolak: Admin hanya berwenang menghapus akun kasir." },
        { status: 403 },
      );
    }

    const { error: delAuthErr } = await adminClient.auth.admin.deleteUser(id);
    if (delAuthErr) {
      await adminClient.from("profiles").delete().eq("id", id);
    }

    return NextResponse.json({
      success: true,
      message: `Akun ${targetProfile.full_name} berhasil dihapus.`,
    });
  } catch (error: unknown) {
    console.error("API Error delete user:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Terjadi kesalahan server.") },
      { status: 500 },
    );
  }
}
