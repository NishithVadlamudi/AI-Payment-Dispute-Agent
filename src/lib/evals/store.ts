import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "../db/client";
import { evalReportSchema, type EvalReport } from "./schemas";
import { TraceUnavailableError } from "../observability/errors";

export function createEvalStore(db: DatabaseClient) {
  return {
    async save(report: EvalReport) {
      const { error } = await db
        .from("eval_reports")
        .upsert(evalReportSchema.parse(report));
      if (error) throw new TraceUnavailableError();
    },
    async recent() {
      const { data, error } = await db
        .from("eval_reports")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw new TraceUnavailableError();
      return z.array(evalReportSchema).parse(data);
    },
  };
}
