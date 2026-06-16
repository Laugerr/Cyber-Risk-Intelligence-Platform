import { supabase } from "./supabase";

export type AuditAction =
  | "create" | "update" | "delete" | "import" | "sync" | "match" | "acknowledge" | "seed";

export interface AuditEntry {
  action: AuditAction | string;
  entity: string; // asset | vulnerability | alert | control | software | import | system
  entity_ref?: string; // human label: name / cve / id
  summary: string;
  actor?: string;
}

// Fire-and-forget audit write. Never throws — auditing must not break the
// operation it records.
export async function logAudit(e: AuditEntry): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      action: e.action,
      entity: e.entity,
      entity_ref: e.entity_ref ?? "",
      summary: e.summary,
      actor: e.actor ?? "analyst",
    });
  } catch {
    /* ignore */
  }
}
