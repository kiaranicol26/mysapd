import { FACTION_GUILD_ID, membershipDisabled } from "./discordMembership";

/** Highest rank first: a member with several rank roles gets the highest. */
const RANK_ORDER = ["Comisario", "Inspector", "Capitan", "Teniente", "Sargento", "Cabo", "Oficial", "Cadete", "Aspirante"];

export async function discord(path: string, init?: RequestInit) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["DISCORD_API_KEY"];
  if (!lovable || !key) throw new Error("El bot de Discord no está configurado");
  const res = await fetch(`https://connector-gateway.lovable.dev/discord/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
  });
  // Only an actual missing-member response establishes that the member left.
  if (res.status === 404 && /^guilds\/\d+\/members\/\d+$/.test(path)) return null;
  // Discord returns 404 Unknown Channel for threads deleted manually; treat that as a confirmed missing thread.
  if (res.status === 404 && /^channels\/\d+$/.test(path) && (!init?.method || init.method === "GET")) return null;
  if (!res.ok) throw new Error("No se pudo verificar Discord. Intentá nuevamente en unos momentos.");
  return res.status === 204 ? null : res.json();
}

export async function factionMember(discordId: string | null | undefined) {
  if (!discordId) return null;
  return discord(`guilds/${FACTION_GUILD_ID}/members/${discordId}`);
}

export async function checkInstructorMembership(row: { id: string; discord_id?: string | null }, admin: { from: (table: string) => any }) {
  const member = await factionMember(row.discord_id);
  const disabled = membershipDisabled(member, row.discord_id);
  const { error } = await admin.from("instructors").update({
    discord_inhabilitado: disabled, discord_checked_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (error) throw new Error("No se pudo actualizar el estado de la cuenta");
  return !disabled;
}

type GuildMember = {
  user?: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  nick?: string | null;
  avatar?: string | null;
  roles?: string[];
  joined_at?: string;
};

const SCAN_KEY = "guild_scan_at";
const SCAN_INTERVAL = 60_000;

function nickParts(m: GuildMember) {
  const raw = m.nick || m.user?.global_name || m.user?.username || "";
  const tag = raw.match(/^\s*(\[[A-Za-z]{3}\])/)?.[1] ?? null;
  const sinTag = raw.replace(/^\s*\[[^\]]+\]\s*\|?\s*/, "");
  const placa = sinTag.match(/#(\d+)\s*$/)?.[1] ?? null;
  // Discord nicknames sometimes use "|" as a visual separator, not as part of the name.
  const name = sinTag.replace(/\s*#\d+\s*$/, "").replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").trim().slice(0, 60);
  return { tag, placa, name };
}

function buildNick(tag: string | null, name: string, placa: string | null) {
  const suf = ` #${placa ?? "0000"}`;
  const pre = tag ? `${tag} ` : "";
  return `${pre}${name.slice(0, 32 - suf.length - pre.length)}${suf}`;
}

/**
 * Escanea el servidor de Discord: a todo miembro con el rol "Policia" sin
 * usuario en la web le crea uno (rol Usuario, sin apartados) y le ajusta el
 * apodo a [TAG]Nombre #placa. Limitado a una pasada cada 10 minutos.
 */
export async function syncGuildPolice(admin: { from: (table: string) => any }, options: { force?: boolean } = {}) {
  try {
    const { data: marker, error: markerReadError } = await admin.from("app_settings").select("value").eq("key", SCAN_KEY).maybeSingle();
    if (markerReadError) throw new Error("No se pudo comprobar el intervalo de sincronización de Discord");
    if (!options.force && marker?.value && Date.now() - new Date(marker.value).getTime() < SCAN_INTERVAL) return null;
    const { error: markerWriteError } = await admin.from("app_settings").upsert({ key: SCAN_KEY, value: new Date().toISOString() });
    // Fail closed: if the rate-limit marker cannot be persisted, do not start
    // a potentially expensive scan that could be repeated on every request.
    if (markerWriteError) throw new Error("No se pudo reservar la sincronización de Discord");

    const roles = (await discord(`guilds/${FACTION_GUILD_ID}/roles`)) as { id: string; name: string }[];
    const policeRole = roles.find(r => r.name.toLowerCase().includes("polic"));
    if (!policeRole) return null;

    // Ensure one Discord role exists per rank; create missing ones (needs "Manage Roles").
    const normRole = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const rankRoleIds = new Map<string, string>();
    for (const rango of RANK_ORDER) {
      let role = roles.find(r => normRole(r.name) === normRole(rango));
      if (!role) {
        try {
          role = (await discord(`guilds/${FACTION_GUILD_ID}/roles`, {
            method: "POST", body: JSON.stringify({ name: rango, hoist: false, mentionable: false }),
          })) as { id: string; name: string };
        } catch { role = undefined; }
      }
      if (role?.id) rankRoleIds.set(rango, role.id);
    }

    const members: GuildMember[] = [];
    for (let after = "0";;) {
      const page = (await discord(`guilds/${FACTION_GUILD_ID}/members?limit=1000&after=${after}`)) as GuildMember[];
      // A malformed or interrupted page must never be treated as a complete
      // guild snapshot; otherwise a forced sync could report success on partial data.
      if (!Array.isArray(page)) throw new Error("Discord devolvió una página de miembros inválida");
      if (!page.length) break;
      if (page.some(member => !member.user?.id)) {
        throw new Error("Discord devolvió miembros sin ID; se canceló la sincronización");
      }
      members.push(...page);
      if (page.length < 1000) break;
      after = page[page.length - 1].user!.id;
      // The safety cap is intentional, but reaching it must not silently
      // process only the first 5,000 members and claim a complete sync.
      if (members.length >= 5000) {
        const nextPage = (await discord(`guilds/${FACTION_GUILD_ID}/members?limit=1000&after=${after}`)) as GuildMember[];
        if (!Array.isArray(nextPage)) throw new Error("No se pudo confirmar el final del listado de Discord");
        if (nextPage.length) throw new Error("El servidor supera el límite seguro de 5.000 miembros; no se aplicaron cambios parciales");
        break;
      }
    }

    const police = members.filter(m => !m.user?.bot && m.user?.id && m.roles?.includes(policeRole.id));
    const { data: existing, error: existingError } = await admin.from("instructors").select("id, name, tag, avatar_url, discord_id, discord_username, placa");
    // Never create accounts from an incomplete snapshot: without this check a
    // transient database read failure could make every police member look new.
    if (existingError || !existing) throw new Error("No se pudo consultar el personal existente antes de sincronizar Discord");
    const byDiscord = new Map(existing.filter((r: any) => r.discord_id).map((r: any) => [r.discord_id, r]));

    let created = 0, renamed = 0, datesUpdated = 0;
    for (const m of police) {
      const { tag, placa, name } = nickParts(m);
      if (!name) continue;
      let row = byDiscord.get(m.user!.id) as any;
      if (!row) {
        const { randomBytes } = await import("crypto");
        const id = `DC-${randomBytes(4).toString("hex").toUpperCase()}`;
        const ins = await admin.from("instructors").insert({
          id, name, role: "Usuario", discord_id: m.user!.id, discord_username: m.user!.username,
          secciones: [], created_by: "Auto Discord", placa,
        }).select("id, name, discord_id, placa").single();
        if (ins.error || !ins.data) continue;
        row = ins.data;
        byDiscord.set(m.user!.id, row);
        created++;
        await admin.from("logs").insert({ instructor_id: id, instructor_name: name, action: "REGISTRO_AUTO_DISCORD", details: { discord: m.user!.username } });
      }
      // Discord is the source of truth for tag, display name, username and avatar.
      const oldName = String(row.name ?? "").trim();
      const discordName = name.trim();
      const avatar = m.avatar ? "https://cdn.discordapp.com/guilds/" + FACTION_GUILD_ID + "/users/" + m.user!.id + "/avatars/" + m.avatar + ".png?size=512" : m.user?.avatar ? "https://cdn.discordapp.com/avatars/" + m.user.id + "/" + m.user.avatar + ".png?size=512" : null;
      const profilePatch: Record<string, string | null> = {};
      if (discordName && discordName !== oldName) profilePatch.name = discordName;
      if (tag !== (row.tag ?? null)) profilePatch.tag = tag;
      if (m.user!.username !== row.discord_username) profilePatch.discord_username = m.user!.username;
      if (avatar && avatar !== row.avatar_url) profilePatch.avatar_url = avatar;
      if (placa && placa !== (row.placa ?? null)) profilePatch.placa = placa;
      if (Object.keys(profilePatch).length) {
        const { error: profileError } = await admin.from("instructors").update(profilePatch).eq("id", row.id);
        if (profileError) throw new Error("No se pudo sincronizar el perfil desde Discord");
      }
      // Las fichas históricas sin instructor_id no se vinculan por nombre:
      // un nombre único hoy no demuestra identidad y puede pertenecer a otra persona.
      if (discordName && discordName !== oldName) {
        // Only the stable instructor_id link may be renamed automatically.
        const { error: linkedRenameError } = await admin.from("pd_members")
          .update({ nombre: discordName }).eq("instructor_id", row.id);
        if (linkedRenameError) throw new Error("No se pudo actualizar el nombre en Registro PD");
        // Salary entries still lack instructor_id. Keep historical names intact
        // until a stable foreign key can be introduced and backfilled safely.
        row.name = discordName;
        renamed++;
      }

      // El estado de Instructor se administra manualmente desde Registro PD.
      // Rank = highest Discord rank role the member holds; no default rank.
      const rangoDiscord = RANK_ORDER.find(r => { const id = rankRoleIds.get(r); return id && m.roles?.includes(id); }) ?? null;
      if (rangoDiscord) {
        const base = `guilds/${FACTION_GUILD_ID}/members/${m.user!.id}/roles/`;
        for (const [r, id] of rankRoleIds) {
          if (r !== rangoDiscord && m.roles?.includes(id)) {
            try { await discord(base + id, { method: "DELETE" }); } catch { /* ignore */ }
          }
        }
      }
      {
        const pdPatch: Record<string, string | null> = { rango: rangoDiscord };
        if (placa) pdPatch.placa = placa;
        const { error: linkedPdError } = await admin.from("pd_members")
          .update(pdPatch).eq("instructor_id", row.id);
        if (linkedPdError) throw new Error("No se pudo sincronizar el rango en Registro PD");
      }
      row.tag = tag;
      if (placa) row.placa = placa;
      row.discord_username = m.user!.username;
      row.avatar_url = avatar ?? row.avatar_url;
      if (m.joined_at) {
        const { error: dateError } = await admin.from("instructors").update({ discord_joined_at: m.joined_at }).eq("id", row.id);
        if (dateError) {
          if (options.force) throw new Error("No se pudieron guardar las fechas de ingreso de Discord. Verificá que esté aplicada la migración discord_joined_at en Supabase.");
        } else {
          datesUpdated++;
        }
      }
      const want = buildNick(tag, row.name, row.placa ?? placa);
      const current = m.nick || "";
      if (current !== want) {
        try {
          await discord(`guilds/${FACTION_GUILD_ID}/members/${m.user!.id}`, { method: "PATCH", body: JSON.stringify({ nick: want }) });
        } catch { /* sin permiso para ese miembro (dueño, rol más alto) */ }
      }
    }
    // Membership: anyone not present in the guild (or without Police role) stops
    // showing as enabled. Alto Mando is never disabled to avoid locking admins out.
    const policeIds = new Set(police.map(m => m.user!.id));
    const { data: allRows } = await admin.from("instructors").select("id, discord_id, is_alto_mando, discord_inhabilitado");
    let disabledCount = 0;
    for (const r of (allRows ?? []) as any[]) {
      const shouldDisable = !r.is_alto_mando && (!r.discord_id || !policeIds.has(r.discord_id));
      if (!!r.discord_inhabilitado !== shouldDisable) {
        await admin.from("instructors").update({ discord_inhabilitado: shouldDisable, discord_checked_at: new Date().toISOString() }).eq("id", r.id);
      }
      if (shouldDisable) disabledCount++;
    }
    await mergeDuplicatePdMembers(admin);
    return { created, renamed, datesUpdated, total: police.length, disabled: disabledCount };
  } catch (e) {
    console.error("syncGuildPolice", e);
    if (options.force) throw e;
    return null;
  }
}
const normName = (s: string | null | undefined) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_]+/g, " ").trim().toLowerCase();

/** Merges legacy (unlinked) Registro PD rows into the linked row with the same name, moving salary rows without duplicating months. */
export async function mergeDuplicatePdMembers(admin: { from: (table: string) => any }) {
  const { data: pd } = await admin.from("pd_members").select("id, nombre, instructor_id, created_at");
  if (!pd) return 0;
  const linkedByName = new Map<string, any[]>();
  for (const r of pd as any[]) if (r.instructor_id) {
    const k = normName(r.nombre); linkedByName.set(k, [...(linkedByName.get(k) ?? []), r]);
  }
  let merged = 0;
  for (const legacy of pd as any[]) {
    if (legacy.instructor_id) continue;
    const targets = linkedByName.get(normName(legacy.nombre));
    if (!targets || targets.length !== 1) continue; // ambiguous: leave for manual review
    const target = targets[0];
    const { data: rows } = await admin.from("salary_entries").select("id, month_id, pd_member_id").in("pd_member_id", [legacy.id, target.id]);
    const targetMonths = new Set((rows ?? []).filter((r: any) => r.pd_member_id === target.id).map((r: any) => r.month_id));
    for (const r of (rows ?? []) as any[]) {
      if (r.pd_member_id !== legacy.id) continue;
      if (targetMonths.has(r.month_id)) {
        // Keep the legacy row (it has history like pagado/nota) and drop the auto-created one.
        await admin.from("salary_entries").delete().eq("pd_member_id", target.id).eq("month_id", r.month_id);
      }
      await admin.from("salary_entries").update({ pd_member_id: target.id }).eq("id", r.id);
    }
    const { error } = await admin.from("pd_members").delete().eq("id", legacy.id);
    if (!error) merged++;
  }
  return merged;
}


const certificatePublicationQueues = new Map<string, Promise<any>>();

export async function publishTrainingCertificateToForum(
  admin: { from: (table: string) => any; storage: any },
  trainingId: string,
  certificateDataUrl?: string,
  force = false,
) {
  const { data: initial, error: initialError } = await admin.from("pd_trainings")
    .select("id, pd_member_id").eq("id", trainingId).maybeSingle();
  if (initialError || !initial) throw new Error("No se encontró la capacitación para publicar");

  // Serialize publications for one SAPD inside the same server runtime. The
  // database reservation below also protects thread creation across runtimes.
  const memberKey = String(initial.pd_member_id);
  const previous = certificatePublicationQueues.get(memberKey) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(() =>
    publishTrainingCertificateToForumUnlocked(admin, trainingId, certificateDataUrl, force)
  );
  certificatePublicationQueues.set(memberKey, current);
  try {
    return await current;
  } finally {
    if (certificatePublicationQueues.get(memberKey) === current) {
      certificatePublicationQueues.delete(memberKey);
    }
  }
}

async function publishTrainingCertificateToForumUnlocked(
  admin: { from: (table: string) => any; storage: any },
  trainingId: string,
  certificateDataUrl?: string,
  force = false,
) {
  const { data: training, error: trainingError } = await admin.from("pd_trainings")
    .select("id, pd_member_id, section, training, training_other, awarded_at, instructor_pd_member_id, certificate_image_url, discord_published_at, discord_published_forum_id")
    .eq("id", trainingId).maybeSingle();
  if (trainingError || !training) throw new Error("No se encontró la capacitación para publicar");
  const { data: member } = await admin.from("pd_members")
    .select("id, nombre, legajo, instructor_id, discord_forum_thread_id")
    .eq("id", training.pd_member_id).maybeSingle();
  const { data: linkedInstructor } = member?.instructor_id
    ? await admin.from("instructors").select("discord_id").eq("id", member.instructor_id).maybeSingle()
    : { data: null };
  const forumId = "1569585390355218482";
  if (training.discord_published_at && training.discord_published_forum_id === forumId && !force) {
    return { ok: true as const, alreadyPublished: true, threadId: null, imageUrl: training.certificate_image_url };
  }
  const discordMention = linkedInstructor?.discord_id ? "<@" + linkedInstructor.discord_id + ">" : "";
  if (!/^\d{17,20}$/.test(forumId)) throw new Error("Configurá un ID válido de canal Foro en Administración → Configuración Web");
  if (!member) throw new Error("No se encontró el SAPD asociado a la capacitación");

  let imageUrl = String(certificateDataUrl ?? training.certificate_image_url ?? "");
  if (imageUrl.startsWith("data:image/")) {
    const match = imageUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error("El certificado no contiene un PNG válido");
    const bucket = "mysapd-certificados";
    const { data: buckets } = await admin.storage.listBuckets();
    if (!(buckets ?? []).some((b: any) => b.name === bucket)) {
      const { error } = await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: ["image/png"],
      });
      if (error && !String(error.message).toLowerCase().includes("already exists")) {
        throw new Error("No se pudo crear el almacenamiento de certificados");
      }
    }
    const objectPath = member.id + "/" + training.id + ".png";
    const bytes = Buffer.from(match[1], "base64");
    const { error: uploadError } = await admin.storage.from(bucket).upload(objectPath, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (uploadError) throw new Error("No se pudo subir el certificado al almacenamiento");
    imageUrl = admin.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
    const { error: updateError } = await admin.from("pd_trainings")
      .update({ certificate_image_url: imageUrl }).eq("id", training.id);
    if (updateError) throw new Error("No se pudo guardar el enlace permanente del certificado");
  }
  if (!/^https:\/\//i.test(imageUrl)) {
    throw new Error("El certificado todavía no tiene una imagen pública para Discord");
  }

  // Discord receives the public PNG URL as plain message content. Discord may
  // show its native link preview, but mySAPD does not construct or send embeds.
  const certificateMessage = [discordMention, imageUrl].filter(Boolean).join("\n");

  let createdThreadForThisCall = false;
  const makeThread = async (reservation: string) => {
    const safeTitle = String(member.nombre ?? "SAPD").trim().replace(/\s+/g, "_").slice(0, 100);
    let created: { id?: string };
    try {
      created = await discord("channels/" + forumId + "/threads", {
      method: "POST",
      body: JSON.stringify({
        name: safeTitle,
        auto_archive_duration: 10080,
        message: {
          content: certificateMessage,
        },
      }),
    }) as { id?: string };
    } catch (error) {
      await admin.from("pd_members").update({ discord_forum_thread_id: null })
        .eq("id", member.id).eq("discord_forum_thread_id", reservation);
      throw error;
    }
    if (!created?.id) {
      await admin.from("pd_members").update({ discord_forum_thread_id: null })
        .eq("id", member.id).eq("discord_forum_thread_id", reservation);
      throw new Error("Discord no devolvió el ID de la publicación del foro");
    }
    const { error } = await admin.from("pd_members").update({ discord_forum_thread_id: created.id })
      .eq("id", member.id).eq("discord_forum_thread_id", reservation);
    if (error) throw new Error("La publicación se creó, pero no se pudo vincular al SAPD en mySAPD");
    createdThreadForThisCall = true;
    return created.id;
  };

  let threadId: string | null = null;
  const deadline = Date.now() + 90_000;
  while (!threadId && Date.now() < deadline) {
    const { data: latest, error: readError } = await admin.from("pd_members")
      .select("discord_forum_thread_id").eq("id", member.id).maybeSingle();
    if (readError) throw new Error("No se pudo comprobar la publicación existente del SAPD");
    const currentThread = String(latest?.discord_forum_thread_id ?? "");

    if (currentThread && !currentThread.startsWith("pending:")) {
      try {
        const savedThread = await discord("channels/" + currentThread) as { parent_id?: string };
        if (savedThread?.parent_id === forumId) {
          threadId = currentThread;
          break;
        }
      } catch {
        // The saved thread was deleted or is inaccessible.
      }
      // A valid thread in another forum is not reusable: start a fresh
      // publication in the configured destination and link it to this SAPD.
      await admin.from("pd_members").update({ discord_forum_thread_id: null })
        .eq("id", member.id).eq("discord_forum_thread_id", currentThread);
      continue;
    }

    if (currentThread.startsWith("pending:")) {
      const pendingAt = Number(currentThread.split(":")[1]);
      if (Number.isFinite(pendingAt) && Date.now() - pendingAt > 120_000) {
        const takeover = "pending:" + Date.now() + ":" + Math.random().toString(36).slice(2, 9);
        const { data: claimed } = await admin.from("pd_members")
          .update({ discord_forum_thread_id: takeover })
          .eq("id", member.id).eq("discord_forum_thread_id", currentThread)
          .select("id").maybeSingle();
        if (claimed) threadId = await makeThread(takeover);
      } else {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      continue;
    }

    const reservation = "pending:" + Date.now() + ":" + Math.random().toString(36).slice(2, 9);
    const { data: claimed, error: claimError } = await admin.from("pd_members")
      .update({ discord_forum_thread_id: reservation })
      .eq("id", member.id).is("discord_forum_thread_id", null)
      .select("id").maybeSingle();
    if (claimError) throw new Error("No se pudo reservar la publicación única del SAPD");
    if (claimed) {
      threadId = await makeThread(reservation);
    } else {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  if (!threadId) throw new Error("La publicación del SAPD sigue ocupada. Volvé a intentar en unos segundos.");

  // Another request may have completed this exact training while this request
  // was waiting for the member's thread. Re-check before appending the URL.
  const { data: latestTraining, error: latestTrainingError } = await admin.from("pd_trainings")
    .select("discord_published_at, discord_published_forum_id, certificate_image_url").eq("id", training.id).maybeSingle();
  if (latestTrainingError) throw new Error("No se pudo verificar el estado de publicación del certificado");
  if (latestTraining?.discord_published_at && (!force || latestTraining.discord_published_forum_id === forumId)) {
    return { ok: true as const, alreadyPublished: true, threadId, imageUrl: latestTraining.certificate_image_url ?? imageUrl };
  }

  // A new forum post already contains its first certificate URL. Existing posts
  // receive one plain-URL message per training, so certificates stay grouped.
  if (!createdThreadForThisCall) {
    await discord("channels/" + threadId + "/messages", {
      method: "POST",
      body: JSON.stringify({ content: certificateMessage }),
    });
  }

  const { error: publicationError } = await admin.from("pd_trainings").update({
    certificate_image_url: imageUrl,
    discord_published_at: new Date().toISOString(),
    discord_published_forum_id: forumId,
  }).eq("id", training.id);
  if (publicationError) throw new Error("El certificado se publicó, pero no se pudo registrar la sincronización en mySAPD");
  return { ok: true as const, threadId, imageUrl };
}
