import type { Metadata } from "next";
import { connectDb } from "../../../lib/db";
import { AuditLog } from "@/models/audit-log";
import { User } from "@/models/user";
import { EmptyState, PageHeader, dateTime } from "@/components/ui";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function Audit() {
  await connectDb();
  const logs = (await AuditLog.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()) as any[];
  const names = new Map(
    (
      await User.find({ _id: { $in: logs.map((l) => l.actor) } })
        .select("name")
        .lean()
    ).map((u) => [String(u._id), u.name]),
  );
  return (
    <>
      <PageHeader
        title="Audit log"
        intro="Who did what, and when. This log is append-only: there is no way to edit or delete entries from the app."
      />
      {logs.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          body="Verification decisions, fee changes, dispute outcomes and payouts are recorded here."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={String(l._id)}>
                  <td>{dateTime(l.createdAt)}</td>
                  <td>{names.get(String(l.actor)) ?? "-"}</td>
                  <td className="font-semibold">{l.action}</td>
                  <td className="text-xs">
                    {l.targetType} {l.targetId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
